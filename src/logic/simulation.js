import { BUILDINGS, STRATA, EPOCHS, RESOURCES, TECHS, ECONOMIC_INFLUENCE, WEALTH_DECAY_RATE, TREATY_TYPE_LABELS, OFFICIAL_SIM_CONFIG } from '../config';
import { calculateArmyPopulation, calculateArmyFoodNeed, calculateArmyCapacityNeed, calculateArmyMaintenance, calculateArmyScalePenalty } from '../config';
import { getBuildingEffectiveConfig, getUpgradeCost, getMaxUpgradeLevel, BUILDING_UPGRADES } from '../config/buildingUpgrades';
import { buildOwnershipListFromLegacy, providesOwnerJobs, OWNER_TYPES } from '../config/ownerTypes';
import { isResourceUnlocked } from '../utils/resources';
import { calculateForeignPrice } from '../utils/foreignTrade';
import { simulateBattle, UNIT_TYPES } from '../config/militaryUnits';
import { getEnemyUnitsForEpoch } from '../config/militaryActions';
import { calculateLivingStandardData, getSimpleLivingStandard, calculateWealthMultiplier, calculateLuxuryConsumptionMultiplier, calculateUnlockMultiplier } from '../utils/livingStandard';
import { calculateLivingStandards } from './population/needs';
import { applyBuyPriceControl, applySellPriceControl } from './officials/cabinetSynergy';
import { calculateAIGiftAmount, calculateAIPeaceTribute, calculateAISurrenderDemand } from '../utils/diplomaticUtils';
import { debugLog } from '../utils/debugFlags';
import { processPriceConvergence } from './diplomacy/treatyEffects';
import {
    calculateCoalitionInfluenceShare,
    calculateLegitimacy,
    getLegitimacyTaxModifier,
    getLegitimacyApprovalModifier,
    getCoalitionApprovalCapPenalty,
    isCoalitionMember,
    getGovernmentType, // Determine current polity
} from './rulingCoalition';
import { getPolityEffects } from '../config/polityEffects';
import { calculateNaturalRecovery } from '../config/reputationSystem';

const getTreatyLabel = (type) => TREATY_TYPE_LABELS[type] || type;
const isTreatyActive = (treaty, tick) => !Number.isFinite(treaty?.endDay) || tick < treaty.endDay;

let cachedPotentialResourcesKey = null;
let cachedPotentialResourcesSet = null;

const processNationTreaties = ({ nation, tick, resources, logs, onTreasuryChange }) => {
    const treaties = Array.isArray(nation.treaties) ? nation.treaties : [];
    const activeTreaties = [];
    const expiredTreaties = [];
    let maintenanceTotal = 0;

    treaties.forEach((treaty) => {
        if (isTreatyActive(treaty, tick)) {
            activeTreaties.push(treaty);
            if (treaty.direction === 'player_to_ai' && Number.isFinite(treaty.maintenancePerDay)) {
                maintenanceTotal += Math.max(0, treaty.maintenancePerDay);
            }
        } else {
            expiredTreaties.push(treaty);
        }
    });

    if (expiredTreaties.length > 0) {
        expiredTreaties.forEach((treaty) => {
            logs.push(`Treaty with ${nation.name} expired (${getTreatyLabel(treaty.type)}).`);
        });
    }

    if (maintenanceTotal > 0 && resources) {
        const currentSilver = resources.silver || 0;
        const paid = Math.max(0, Math.min(currentSilver, maintenanceTotal));
        resources.silver = currentSilver - paid;
        if (typeof onTreasuryChange === 'function' && paid > 0) {
            onTreasuryChange(-paid, 'treaty_maintenance');
        }
        nation.budget = (nation.budget || 0) + paid;
        nation.wealth = (nation.wealth || 0) + paid;
    }

    nation.treaties = activeTreaties;
};


// ============================================================================
// REFACTORED MODULE IMPORTS
// These modules contain functions extracted from this file for better organization
// ============================================================================
import {
    // Constants
    ROLE_PRIORITY,
    JOB_MIGRATION_RATIO,
    PRICE_FLOOR,
    BASE_WAGE_REFERENCE,
    SPECIAL_TRADE_RESOURCES,
    MERCHANT_SAFE_STOCK,
    MERCHANT_CAPACITY_PER_POP,
    MERCHANT_CAPACITY_WEALTH_DIVISOR,
    MERCHANT_LOG_VOLUME_RATIO,
    MERCHANT_LOG_PROFIT_THRESHOLD,
    PEACE_REQUEST_COOLDOWN_DAYS,
    FERTILITY_BASE_RATE,
    FERTILITY_BASELINE_RATE,
    LOW_POP_THRESHOLD,
    LOW_POP_GUARANTEE,
    WEALTH_BASELINE,
    STABILITY_INERTIA,
    MAX_CONCURRENT_WARS,
    GLOBAL_WAR_COOLDOWN,
    TECH_MAP,
    // Helper functions
    clamp,
    isTradableResource,
    getBasePrice,
    scaleEffectValues,
    computePriceMultiplier,
    calculateMinProfitMargin,
    // [FIX] Safe wealth handling to prevent overflow
    safeWealth,
    MAX_SAFE_WEALTH,
    // [PERF] Performance utilities
    shouldRunThisTick,
    tickCache,
    getBuildingLevelDistribution,
    RATE_LIMIT_CONFIG,
} from './utils';

import {
    // Wage functions
    computeLivingCosts,
    buildLivingCostMap,
    getLivingCostFloor,
    getExpectedWage,
    calculateWeightedAverageWage,
    updateWages,
    // Tax functions
    initializeTaxBreakdown,
    getHeadTaxRate as getHeadTaxRateFromModule,
    getResourceTaxRate as getResourceTaxRateFromModule,
    getBusinessTaxRate as getBusinessTaxRateFromModule,
    collectHeadTax,
    calculateFinalTaxes,
    // Trading functions
    simulateMerchantTrade,
    analyzeTradeOpportunities,
} from './economy';

import {
    // Job functions
    initializeJobsAvailable,
    initializeWageTracking,
    initializeExpenseTracking,
    allocatePopulation,
    handleLayoffs,
    fillVacancies,
    handleJobMigration,
    // Growth functions
    initializeWealth,
} from './population';

import {
    // Approval functions
    calculateClassApproval as calculateClassApprovalFromModule,
    calculateDecreeApprovalModifiers,
    // Buff functions
    calculateBuffsAndDebuffs,
    calculateStability as calculateStabilityFromModule,
    calculateClassInfluence,
} from './stability';

import {
    // Building effect functions
    initializeBonuses,
    applyEffects,
    applyTechEffects,
    applyDecreeEffects,
    applyFestivalEffects,
    applyPolityEffects, // Apply polity effects helper
    calculateTotalMaxPop,
} from './buildings';
import { getAggregatedOfficialEffects, getOfficialInfluencePoints, getAggregatedStanceEffects } from '../logic/officials/manager';
import {
    getCabinetStatus,
    calculateOfficialCapacity,
} from './officials/manager';
import {
    calculateQuotaEffects,
    processOwnerExpansions,
    calculateBuildingProfit
} from './officials/cabinetSynergy'; // [FIX] Import directly from source
import {
    ECONOMIC_MINISTER_ROLES,
    MINISTER_LABELS,
    buildMinisterRoster,
    getMinisterStatValue,
    getMinisterProductionBonus,
    getMinisterTradeBonus,
    getMinisterMilitaryBonus,
    getMinisterTrainingSpeedBonus,
    getMinisterDiplomaticBonus,
    isBuildingInMinisterScope,
    isBuildingUnlockedForMinister,
    scoreBuildingShortage,
} from './officials/ministers';
import {
    getInventoryTargetDaysMultiplier,
    getPopulationGrowthMultiplier,
    getArmyMaintenanceMultiplier,
    getMaxConsumptionMultiplierBonus,
    getRelationChangeMultipliers,
    getBuildingCostGrowthFactor,
    getBuildingCostBaseMultiplier
} from '../config/difficulty';
import { EconomyLedger, TRANSACTION_CATEGORIES } from './economy/ledger';
import {
    calculateFinancialStatus,
    calculateOfficialPropertyProfit,
    processOfficialBuildingUpgrade,
    processOfficialInvestment,
    FINANCIAL_STATUS,
} from './officials/officialInvestment';
import { LOYALTY_CONFIG } from '../config/officials';
import { isStanceSatisfied } from '../config/politicalStances';
import { migrateOfficialForInvestment } from './officials/migration';
import { calculateBuildingCost, applyBuildingCostModifier } from '../utils/buildingUpgradeUtils';
import { calculateSilverCost } from '../utils/economy';

// ============================================================================
// All helper functions and constants have been migrated to modules:
// - initializeWealth -> ./population/growth.js
// - TECH_MAP -> ./utils/constants.js
// - simulateMerchantTrade -> ./economy/trading.js
// ============================================================================

// ============================================================================
// DIPLOMACY MODULE IMPORTS (Phase 5 Migration)
// These modules handle AI nation behavior, war, diplomacy, and economy
// ============================================================================
import {
    // AI War functions
    processRebelWarActions,
    checkRebelSurrender,
    processAIMilitaryAction,
    checkAIPeaceRequest,
    checkAISurrenderDemand,
    checkMercyPeace,
    checkWarDeclaration,
    processCollectiveAttackWarmonger,
    processAIAIWarDeclaration,
    processAIAIWarProgression,
    // AI Diplomacy functions
    initializeForeignRelations,
    processMonthlyRelationDecay,
    processAllyColdEvents,
    processAIGiftDiplomacy,
    processAITrade,
    processAIPlayerTrade,
    processAIPlayerInteraction,
    processAIAllianceFormation,
    processAIOrganizationRecruitment,
    processAIOrganizationMaintenance,
    processAIOrganizationInvitesToPlayer,
    checkAIBreakAlliance,
    processNationRelationDecay,
    processVassalUpdates,
    initializeNationEconomyData,
    updateNationEconomyData,
    // AI Economy functions
    updateAINationInventory,
    initializeAIDevelopmentBaseline,
    processAIIndependentGrowth,
    updateAIDevelopment,
    checkAIEpochProgression,
    initializeRebelEconomy,
    processPostWarRecovery,
    processInstallmentPayment,
    // International Organization functions
    processOrganizationMonthlyUpdate,
    getOrganizationEffects,
    shouldDisbandOrganization,
    ORGANIZATION_TYPE_CONFIGS,
    // Population Migration functions
    processMonthlyMigration,
    applyMigrationToPopStructure,
    generateMigrationLogs,
    // Rebellion System functions
    processRebellionSystemDaily,
    getRebellionRiskAssessment,
} from './diplomacy';
import { calculateOverseasInvestmentSummary, processOverseasInvestments, processForeignInvestments, processOverseasInvestmentUpgrades, processForeignInvestmentUpgrades } from './diplomacy/overseasInvestment';
import { processManualTradeRoutes } from './economy/manualTrade';

export const simulateTick = ({
    resources,
    buildings,
    population,
    popStructure: previousPopStructure = {},
    birthAccumulator: previousBirthAccumulator = 0,
    decrees,
    gameSpeed,
    epoch,
    market,
    classWealth,
    classApproval: previousApproval = {},
    activeBuffs: productionBuffs = [],
    activeDebuffs: productionDebuffs = [],
    taxPolicies,
    army = {},
    militaryWageRatio = 1,
    militaryQueue = [],
    nations = [],
    diplomacyOrganizations = null,
    tick = 0,
    techsUnlocked = [],
    activeFestivalEffects = [],
    classWealthHistory,
    classNeedsHistory,
    merchantState = { pendingTrades: [], lastTradeTime: 0 },
    tradeRouteTax: initialTradeRouteTax = 0,
    maxPopBonus = 0,
    eventApprovalModifiers = {},
    eventStabilityModifier = 0,
    currentStability = 50, // NEW: Current stability for inertia calculation
    // Economic modifiers from events
    eventResourceDemandModifiers = {},   // { resourceKey: percentModifier }
    eventStratumDemandModifiers = {},    // { stratumKey: percentModifier }
    eventBuildingProductionModifiers = {}, // { buildingIdOrCat: percentModifier }
    livingStandardStreaks = {},
    buildingUpgrades = {}, // 建筑升级状态
    rulingCoalition = [], // 执政联盟成员阶层
    previousLegitimacy = 0, // 上一tick的合法性值，用于计算税收修正
    migrationCooldowns = {}, // 阶层迁移冷却状态

    difficulty, // 游戏难度设置
    officials = [], // 官员列表
    officialsSimCursor = 0, // 官员分片模拟游标
    activeDecrees, // [NEW] Reform decrees
    officialsPaid = true, // 是否足额支付薪水
    ministerAssignments = {}, // [NEW] Minister role assignments
    ministerAutoExpansion = {}, // [NEW] Minister auto-expansion toggle for each role
    lastMinisterExpansionDay = 0,
    quotaTargets = {}, // [NEW] Quota system targets for Left Dominance
    expansionSettings = {}, // [NEW] Expansion settings for Right Dominance
    cabinetStatus = {}, // [NEW] Cabinet status for synergy/dominance
    priceControls = null, // [NEW] 政府价格管制设置
    previousTaxShock = {}, // [NEW] 上一tick各阶层的累积税收冲击值，用于防止"快速抬税后降税"的漏洞
    eventEffectSettings = {}, // [NEW] Event effect settings including log visibility
    foreignInvestments = [], // [NEW] Foreign investments for profit calculation
    overseasInvestments = [], // [NEW] Overseas investments for processing
    tradeRoutes = {}, // [NEW] Trade routes for manual trade processing
    foreignInvestmentPolicy = 'normal', // [NEW] Policy for foreign investments
    tradeOpportunities: previousTradeOpportunities = null, // [NEW] Cache for trade opportunities
    diplomaticReputation = 50, // [NEW] Player's diplomatic reputation (0-100)
}) => {
    // console.log('[TICK START]', tick); // Commented for performance
    const perfSections = {};
    const perfTime = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
    const perfUserTimingEnabled = typeof performance !== 'undefined'
        && typeof performance.mark === 'function'
        && typeof performance.measure === 'function'
        && (typeof window !== 'undefined' && window.__PERF_USER_TIMING === true);
    const perfMarkStart = (label) => {
        if (!perfUserTimingEnabled) return;
        const startMark = `sim:${label}:start`;
        const endMark = `sim:${label}:end`;
        const measureName = `sim:${label}`;
        performance.clearMarks(startMark);
        performance.clearMarks(endMark);
        performance.clearMeasures(measureName);
        performance.mark(startMark);
    };
    const perfMarkEnd = (label) => {
        if (!perfUserTimingEnabled) return;
        const startMark = `sim:${label}:start`;
        const endMark = `sim:${label}:end`;
        const measureName = `sim:${label}`;
        performance.mark(endMark);
        performance.measure(measureName, startMark, endMark);
    };
    const perfStartAll = perfTime();
    const perfStart = (label) => {
        perfSections[label] = (perfSections[label] || 0) - perfTime();
        perfMarkStart(label);
    };
    const perfEnd = (label) => {
        perfSections[label] = (perfSections[label] || 0) + perfTime();
        perfMarkEnd(label);
    };
    perfMarkStart('simulateTick');

    const res = { ...resources };
    const getSlice = (list, slices) => {
        if (!Array.isArray(list) || list.length === 0) return [];
        if (!slices || slices <= 1 || list.length <= slices) return list;
        const size = Math.ceil(list.length / slices);
        const start = (tick % slices) * size;
        return list.slice(start, start + size);
    };
    const priceMap = { ...(market?.prices || {}) };
    let calculatedTradeRouteTax = 0;

    // === Process Manual Trade Routes (Worker Side) ===
    let tradeRouteSummary = null;
    const shouldUpdateManualTrade = shouldRunThisTick(tick, 'manualTrade');
    if (shouldUpdateManualTrade && tradeRoutes && tradeRoutes.routes && tradeRoutes.routes.length > 0) {
        perfStart('manualTrade');
        const manualTradeSlices = Math.max(1, RATE_LIMIT_CONFIG.manualTradeSlices || 1);
        const slicedRoutes = getSlice(tradeRoutes.routes, manualTradeSlices);
        tradeRouteSummary = processManualTradeRoutes({
            tradeRoutes: { ...tradeRoutes, routes: slicedRoutes },
            nations,
            resources: res, // Pass current resources snapshot
            daysElapsed: tick,
            market: { prices: priceMap },
            popStructure: previousPopStructure,
            taxPolicies,
            diplomacyOrganizations
        });
        perfEnd('manualTrade');

        if (tradeRouteSummary) {
            calculatedTradeRouteTax = tradeRouteSummary.tradeTax || 0;

            // [MOVED] Resource deltas application moved to after log system initialization
            // to ensure silver changes are properly tracked.
        }
    }

    // === 资源变化追踪系统 ===
    // Silver change log (aggregated for performance)
    // 使用 Map 聚合：每个 reason 只维护一个累加值，而不是记录每一条
    const silverChangeTotals = new Map();
    const silverChangeLog = {
        // 记录方法：累加到对应的 key
        record: (amount, reason) => {
            if (!Number.isFinite(amount) || amount === 0) return;
            const key = reason || 'unknown';
            silverChangeTotals.set(key, (silverChangeTotals.get(key) || 0) + amount);
        },
        // 兼容数组 push 的调用（Ledger 用）
        push: (entry) => {
            if (!entry || !Number.isFinite(entry.amount) || entry.amount === 0) return;
            const key = entry.reason || 'unknown';
            silverChangeTotals.set(key, (silverChangeTotals.get(key) || 0) + entry.amount);
        },
        // 转换为数组供 useGameLoop 使用
        toArray: () => Array.from(silverChangeTotals.entries()).map(([reason, amount]) => ({
            amount,
            reason,
        })),
        // 兼容数组的 length 属性
        get length() { return silverChangeTotals.size; },
    };
    const trackSilverChange = (amount, reason) => {
        silverChangeLog.record(amount, reason);
    };

    // General resource change log (for all resource types)
    const resourceChangeLog = {};
    const trackResourceChange = (resourceType, amount, reason) => {
        if (!resourceChangeLog[resourceType]) {
            resourceChangeLog[resourceType] = [];
        }
        resourceChangeLog[resourceType].push({ amount, reason, balance: res[resourceType] || 0 });
    };

    // Track trade tax in silver log if any
    if (calculatedTradeRouteTax > 0) {
        // We add it to 'rates' later, but for 'trackSilverChange' purposes we should log it?
        // Actually trackSilverChange is defined below. We will call it there.
    }

    // Helper: modify res[resourceType] AND track the change in one call (for traceability)
    const applyResourceChange = (resourceType, amount, reason) => {
        if (amount === 0) return;
        res[resourceType] = (res[resourceType] || 0) + amount;
        trackResourceChange(resourceType, amount, reason);
        // Also track silver changes in the dedicated log for financial reporting
        if (resourceType === 'silver') {
            trackSilverChange(amount, reason);
        }
    };

    // Convenience wrapper for silver (most common case)
    const applySilverChange = (amount, reason) => {
        applyResourceChange('silver', amount, reason);
    };

    // Record trade tax if calculated
    if (calculatedTradeRouteTax > 0) {
        // Note: Manual trade logic adds the *resources* (import/export), but the tax revenue
        // is usually handled as a separate silver addition.
    }
    // [FIX] Trade tax is calculated per-tick based on active routes.
    // Do not add initialTradeRouteTax (previous tick's value) to avoid double counting/accumulation.
    const tradeRouteTax = calculatedTradeRouteTax;

    // [FIXED] Apply trade route resource deltas AFTER log system is initialized
    if (tradeRouteSummary && tradeRouteSummary.resourceDelta) {
        Object.entries(tradeRouteSummary.resourceDelta).forEach(([key, delta]) => {
            // Use applyResourceChange to ensure logging (especially for silver)
            applyResourceChange(key, delta, 'trade_route_transaction');
        });
    }

    // Adapter callback for external modules (different argument order)
    // External modules call: onResourceChange(delta, reason, resourceType)
    const onResourceChangeCallback = (delta, reason, resourceType) => {
        applyResourceChange(resourceType, delta, reason);
    };

    // === 阶层财富变化追踪系统 ===
    // Class wealth change log (for financial reporting)
    const classWealthChangeLog = {};
    const trackClassWealthChange = (stratumKey, amount, reason) => {
        if (!classWealthChangeLog[stratumKey]) {
            classWealthChangeLog[stratumKey] = [];
        }
        classWealthChangeLog[stratumKey].push({ amount, reason, balance: wealth[stratumKey] || 0 });
    };

    // Helper: modify wealth[stratumKey] AND track the change in one call (for traceability)
    // Used for non-ledger wealth changes (layoffs, decay, capital flight, etc.)
    const applyClassWealthChange = (stratumKey, amount, reason) => {
        if (amount === 0) return;
        wealth[stratumKey] = Math.max(0, (wealth[stratumKey] || 0) + amount);
        trackClassWealthChange(stratumKey, amount, reason);
    };

    // Helper: transfer wealth between strata with tracking (for population transfers)
    const transferClassWealth = (fromStratum, toStratum, amount, reason) => {
        if (amount <= 0) return;
        const available = wealth[fromStratum] || 0;
        const actualTransfer = Math.min(available, amount);
        if (actualTransfer > 0) {
            applyClassWealthChange(fromStratum, -actualTransfer, `${reason}_out`);
            applyClassWealthChange(toStratum, actualTransfer, `${reason}_in`);
        }
    };

    const startingSilver = res.silver || 0;

    // === Process Overseas & Foreign Investments (Worker Side) ===
    let updatedOverseasInvestments = [...overseasInvestments];
    let updatedForeignInvestments = [...foreignInvestments];
    let investmentLogs = [];
    // NEW: Track supply source breakdown
    const supplyBreakdown = {};

    // NEW: Detailed financial tracking
    const classFinancialData = {};

    // NEW: Per-building realized financial stats for UI (single tick snapshot)
    // buildingFinancialData[buildingId] = {
    //   wagesByRole: { [role]: totalPaid },
    //   paidWagePerWorkerByRole: { [role]: avgPaidPerFilledWorker },
    //   filledByRole: { [role]: filledWorkers },
    //   wagePaidRatioByOwner: { [ownerKey]: paid/bill },
    //   ownerRevenue: totalOwnerRevenue,
    //   productionCosts: totalInputCosts,
    //   businessTaxPaid: totalBusinessTaxPaid,
    // }
    const buildingFinancialData = {};

    // DEBUG: Building production debug data
    const buildingDebugData = {};

    if (Object.keys(STRATA).length > 0) {
        Object.keys(STRATA).forEach(key => {
            classFinancialData[key] = {
                income: { wage: 0, ownerRevenue: 0, subsidy: 0, salary: 0, militaryPay: 0, tradeImportRevenue: 0, layoffTransfer: 0 },
                expense: {
                    headTax: 0,
                    transactionTax: 0,
                    businessTax: 0,
                    tariffs: 0,
                    essentialNeeds: {},  // 基础需求消费 { resource: cost }
                    luxuryNeeds: {},     // 奢侈需求消费 { resource: cost }
                    decay: 0,
                    productionCosts: 0,
                    wages: 0,  // 工资支出（业主支付给工人）
                    tradeExportPurchase: 0, // 贸易出口购买成本
                    capitalFlight: 0, // 资本外逃
                    buildingCost: 0, // 建筑建造/升级成本
                    layoffTransfer: 0 // 裁员时随人口转移的财富
                }
            };
        });
    }

    // WAR STATE: Check if player is at war with any nation
    // Used for wartime modifiers (3x military stratum demand, 3x army maintenance)
    const isPlayerAtWar = (nations || []).some(n => n.isAtWar === true);
    const WAR_MILITARY_MULTIPLIER = 3.0; // Wartime multiplier for military class needs and army maintenance

    const policies = taxPolicies || {};
    const headTaxRates = policies.headTaxRates || {};
    const resourceTaxRates = policies.resourceTaxRates || {};
    const businessTaxRates = policies.businessTaxRates || {};
    const livingCostBreakdown = computeLivingCosts(priceMap, headTaxRates, resourceTaxRates);
    const priceLivingCosts = buildLivingCostMap(
        livingCostBreakdown,
        ECONOMIC_INFLUENCE?.price || {}
    );
    const wageLivingCosts = buildLivingCostMap(
        livingCostBreakdown,
        ECONOMIC_INFLUENCE?.wage || {}
    );
    // 注意：不再在此处全局解构 market 参数，而是在价格计算循环中动态获取
    // 这样可以支持每个资源使用不同的经济参数配置
    const previousWages = market?.wages || {};
    const getLivingCostFloor = (role) => {
        const base = wageLivingCosts?.[role];
        if (!Number.isFinite(base) || base <= 0) {
            return BASE_WAGE_REFERENCE * 0.8;
        }
        return Math.max(BASE_WAGE_REFERENCE * 0.8, base * 1.1);
    };
    const getExpectedWage = (role) => {
        const prev = previousWages?.[role];
        if (Number.isFinite(prev) && prev > 0) {
            return Math.max(PRICE_FLOOR, prev);
        }
        const starting = STRATA[role]?.startingWealth;
        if (Number.isFinite(starting) && starting > 0) {
            return Math.max(BASE_WAGE_REFERENCE * 0.5, starting / 40, getLivingCostFloor(role));
        }
        return Math.max(defaultWageEstimate, getLivingCostFloor(role));
    };
    const demand = {};
    const demandBreakdown = {};
    const supply = {};
    const wealth = initializeWealth(classWealth);

    // Apply Overseas Investment Profits (Calculated above) to Wealth
    // We need to re-run calculation or extract it?
    // Actually, processOverseasInvestments depends on 'classWealth' input.
    // If we pass the raw 'classWealth' param, it's fine.
    // But we need to update the 'wealth' object (which is the working copy) with the profits.
    // Let's move the Overseas Investment execution AFTER wealth init?
    // Yes, cleaner.
    // [FIX] 添加缺失的 getHeadTaxRate 本地包装函数
    const getHeadTaxRate = (key) => getHeadTaxRateFromModule(key, headTaxRates);

    const getResourceTaxRate = (resource) => {
        const rate = resourceTaxRates[resource];
        if (typeof rate === 'number') return rate; // 允许负税率
        return 0;
    };
    const getBusinessTaxRate = (buildingId) => {
        const rate = businessTaxRates[buildingId];
        if (typeof rate === 'number') return rate; // 允许负税率（补贴）
        return 1; // 默认税率系数为1，与UI显示一致
    };
    // REFACTORED: Use imported function from ./economy/taxes
    const taxBreakdown = initializeTaxBreakdown();

    // Initialize Ledger
    const ledger = new EconomyLedger({
        resources: res,
        wealth: wealth,
        officials: officials, // Note: officials array reference passed, but modification might need care
        classFinancialData: classFinancialData,
        taxBreakdown: taxBreakdown,
        silverChangeLog: silverChangeLog,
        buildingFinancialData: buildingFinancialData,
        classWealthChangeLog: classWealthChangeLog, // Track all class wealth changes
    }, { safeWealth });

    // REFACTORED: Use imported function from ./buildings/effects
    const bonuses = initializeBonuses();

    // [DEBUG] Track incomePercentBonus accumulation
    const bonusDebug = {
        afterInit: bonuses.incomePercentBonus || 0,
        afterOfficials: 0,
        afterStance: 0,
        afterTechs: 0,
        afterDecrees: 0,
        afterFestivals: 0,
    };

    // === Execute Investment Logic (Now that Wealth/Ledger is ready) ===

    // 1. Overseas Investments (Player -> AI)
    if (overseasInvestments.length > 0) {
        perfStart('overseasInvestments');
        const oiResult = processOverseasInvestments({
            overseasInvestments, // Use original input
            nations,
            organizations: diplomacyOrganizations?.organizations || [],
            resources: res,
            marketPrices: priceMap,
            classWealth: wealth, // Use the working wealth object (simulating direct mutation)
            daysElapsed: tick,
        });

        updatedOverseasInvestments = oiResult.updatedInvestments;
        investmentLogs.push(...oiResult.logs);

        // Apply profits to wealth
        if (oiResult.profitByStratum) {
            Object.entries(oiResult.profitByStratum).forEach(([stratum, profit]) => {
                if (profit > 0) {
                    // Update wealth directly
                    wealth[stratum] = (wealth[stratum] || 0) + profit;
                    // Log in financial data
                    if (classFinancialData[stratum]) {
                        classFinancialData[stratum].income.ownerRevenue = (classFinancialData[stratum].income.ownerRevenue || 0) + profit;
                    }
                }
            });
        }

        // Apply market/player resource changes
        if (oiResult.playerInventoryChanges) {
            Object.entries(oiResult.playerInventoryChanges).forEach(([key, delta]) => {
                // [FIX] Use applyResourceChange to ensure tracking (especially for silver)
                applyResourceChange(key, delta, 'overseas_investment_return');
            });
        }

        // [FIX] Apply market changes to target nations (supply/demand impact)
        if (oiResult.marketChanges) {
            // marketChanges structure: { [nationId]: { [resource]: amount } }
            Object.entries(oiResult.marketChanges).forEach(([nationId, changes]) => {
                const nation = nations.find(n => n.id === nationId);
                if (nation && nation.inventory) {
                    Object.entries(changes).forEach(([resKey, amount]) => {
                        nation.inventory[resKey] = Math.max(0, (nation.inventory[resKey] || 0) + amount);
                    });
                }
            });
        }

        // [NEW] 将投资效果传递到附庸国对象，用于动态阶层经济计算
        if (oiResult.nationInvestmentEffects) {
            Object.entries(oiResult.nationInvestmentEffects).forEach(([nationId, effects]) => {
                const nation = nations.find(n => n.id === nationId);
                if (nation) {
                    // 存储投资效果供 updateSocialClasses 使用
                    nation._investmentEffects = effects;
                }
            });
        }
        perfEnd('overseasInvestments');

        // Process Upgrades
        perfStart('overseasUpgrades');
        const upgradeResult = processOverseasInvestmentUpgrades({
            overseasInvestments: updatedOverseasInvestments,
            nations,
            classWealth: wealth,
            marketPrices: priceMap,
            daysElapsed: tick,
        });

        if (upgradeResult.upgrades && upgradeResult.upgrades.length > 0) {
            updatedOverseasInvestments = upgradeResult.updatedInvestments;
            investmentLogs.push(...upgradeResult.logs);
            // Deduct costs
            if (upgradeResult.wealthChanges) {
                Object.entries(upgradeResult.wealthChanges).forEach(([stratum, delta]) => {
                    // delta is negative for cost
                    wealth[stratum] = Math.max(0, (wealth[stratum] || 0) + delta);
                });
            }
        }
        perfEnd('overseasUpgrades');
    }

    perfStart('bonusesApply');
    // 2.1 Calculate Cabinet Effects
    // [NEW] Calculate cabinet status to get synergy, dominance, and reform decree effects
    // const capacity = calculateOfficialCapacity(buildings);
    // const cabinetStatus = getCabinetStatus(officials, activeDecrees, capacity, epoch); // Moved to useGameLoop.js

    // Apply Cabinet Synergy & Dominance Effects
    if (cabinetStatus.effects) {
        // Administrative Efficiency -> Tax Efficiency
        if (cabinetStatus.effects.adminEfficiency) {
            bonuses.taxEfficiencyBonus = (bonuses.taxEfficiencyBonus || 0) + cabinetStatus.effects.adminEfficiency;
        }

        // Stability Modifier
        if (cabinetStatus.effects.stabilityMod) {
            bonuses.stabilityBonus = (bonuses.stabilityBonus || 0) + cabinetStatus.effects.stabilityMod;
        }

        // Trade Bonus (from Dominance)
        if (cabinetStatus.effects.tradeBonusMod) {
            bonuses.tradeBonusMod = (bonuses.tradeBonusMod || 0) + cabinetStatus.effects.tradeBonusMod;
        }

        // Diplomatic Relations (from Dominance)
        if (cabinetStatus.effects.diplomaticRelationsMod) {
            bonuses.diplomaticBonus = (bonuses.diplomaticBonus || 0) + cabinetStatus.effects.diplomaticRelationsMod;
        }

        // Approval Bonuses (from Dominance)
        if (cabinetStatus.effects.approvalBonus) {
            Object.entries(cabinetStatus.effects.approvalBonus).forEach(([stratum, val]) => {
                bonuses.stanceApprovalEffects = bonuses.stanceApprovalEffects || {};
                bonuses.stanceApprovalEffects[stratum] = (bonuses.stanceApprovalEffects[stratum] || 0) + val;
            });
        }

        // Organization Growth (from Synergy)
        if (cabinetStatus.effects.organizationGrowthMod) {
            // We map this to a new bonus property that can be used where organization is processed
            bonuses.organizationGrowthMod = (bonuses.organizationGrowthMod || 0) + cabinetStatus.effects.organizationGrowthMod;
        }

        // Research Speed (Science) if present in effects (e.g. from specific synergy levels if any)
        if (cabinetStatus.effects.researchSpeed) {
            bonuses.scienceBonus = (bonuses.scienceBonus || 0) + cabinetStatus.effects.researchSpeed;
        }
    }

    // Apply Reform Decree Effects
    if (cabinetStatus.decreeEffects) {
        applyEffects(cabinetStatus.decreeEffects, bonuses);
    }

    // === 应用官员效果（含薪水不足减益） ===
    const activeOfficialEffects = getAggregatedOfficialEffects(officials, officialsPaid);
    const officialEffectsForBonuses = {
        ...activeOfficialEffects,
        passive: activeOfficialEffects.passiveGains,
        passivePercent: activeOfficialEffects.passivePercentGains,
        resourceDemandMod: activeOfficialEffects.decreeResourceDemandMod,
        stratumDemandMod: activeOfficialEffects.decreeStratumDemandMod,
        maxPop: activeOfficialEffects.extraMaxPop,
        incomePercent: activeOfficialEffects.incomePercentBonus,
    };
    applyEffects(officialEffectsForBonuses, bonuses);
    
    // [DEBUG] Track after officials
    bonusDebug.afterOfficials = bonuses.incomePercentBonus || 0;
    // === 应用官员专属效果到 bonuses ===
    // 科研速度 → scienceBonus
    if (activeOfficialEffects.researchSpeed) {
        bonuses.scienceBonus = (bonuses.scienceBonus || 0) + activeOfficialEffects.researchSpeed;
    }
    // 税收效率 → 存储供税收计算使用
    bonuses.taxEfficiencyBonus = activeOfficialEffects.taxEfficiency || 0;
    // 腐败 → 存储供税收计算使用 (负面效果)
    bonuses.corruption = activeOfficialEffects.corruption || 0;
    // 收入百分比 → 存储供财政计算使用
    if (activeOfficialEffects.incomePercentBonus) {
        bonuses.incomePercentBonus = (bonuses.incomePercentBonus || 0) + activeOfficialEffects.incomePercentBonus;
    }
    // 人口增长 → 存储供人口计算使用
    bonuses.populationGrowthBonus = activeOfficialEffects.populationGrowth || 0;
    // 军费降低 → 存储供军费计算使用
    bonuses.militaryUpkeepMod = activeOfficialEffects.militaryUpkeep || 0;
    // 贸易加成 → 存储供贸易计算使用
    bonuses.tradeBonusMod = activeOfficialEffects.tradeBonus || 0;
    // 建筑成本 → 存储供建筑购买使用
    bonuses.buildingCostMod = activeOfficialEffects.buildingCostMod || 0;
    // 战时生产加成 → 存储供生产计算使用
    bonuses.wartimeProduction = activeOfficialEffects.wartimeProduction || 0;
    // 资源浪费 → 存储供需求/生产消耗使用
    bonuses.resourceWaste = activeOfficialEffects.resourceWaste || {};
    // 联盟满意度 → 存储供满意度计算使用
    bonuses.coalitionApproval = activeOfficialEffects.coalitionApproval || 0;
    // 合法性加成 → 存储供合法性修正使用
    bonuses.legitimacyBonus = activeOfficialEffects.legitimacyBonus || 0;
    // 组织度增长修正（负值降低增长）
    bonuses.organizationGrowthMod = (bonuses.organizationGrowthMod || 0) + (activeOfficialEffects.organizationDecay || 0);
    // 派系冲突 → 稳定度惩罚
    bonuses.factionConflict = (bonuses.factionConflict || 0) + (activeOfficialEffects.factionConflict || 0);
    // 外交冷却修正
    bonuses.diplomaticCooldown = activeOfficialEffects.diplomaticCooldown || 0;
    // 外交关系衰减
    bonuses.diplomaticIncident = activeOfficialEffects.diplomaticIncident || 0;
    // 外交加成 → 存储供外交关系计算使用
    bonuses.diplomaticBonus = activeOfficialEffects.diplomaticBonus || 0;
    // 生产原料成本修正 → 存储供建筑生产计算使用
    bonuses.officialProductionInputCost = activeOfficialEffects.productionInputCost || {};

    // === 应用政治立场效果 ===
    // 构建简化的游戏状态用于条件检查
    const stanceCheckState = {
        classApproval: previousApproval,
        classInfluence: market?.classInfluence || {},
        totalInfluence: market?.totalInfluence || 1,
        classLivingStandard: market?.classLivingStandard || {},
        classIncome: market?.classIncome || {},
        stability: currentStability / 100, // 转换为0-1
        legitimacy: previousLegitimacy,
        taxPolicies: policies,
        rulingCoalition,
        atWar: isPlayerAtWar,
        population,
        epoch,
        buildings: buildings,
    };
    const stanceResult = getAggregatedStanceEffects(officials, stanceCheckState);
    const stanceEffects = stanceResult.aggregatedEffects;

    // 应用立场效果到 bonuses
    if (stanceEffects.stability) {
        bonuses.stabilityBonus = (bonuses.stabilityBonus || 0) + stanceEffects.stability;
    }
    if (stanceEffects.legitimacyBonus) {
        bonuses.legitimacyBonus = (bonuses.legitimacyBonus || 0) + stanceEffects.legitimacyBonus;
    }
    if (stanceEffects.gatherBonus) {
        bonuses.categoryBonuses.gather = (bonuses.categoryBonuses.gather || 0) + stanceEffects.gatherBonus;
    }
    if (stanceEffects.industryBonus) {
        bonuses.categoryBonuses.industry = (bonuses.categoryBonuses.industry || 0) + stanceEffects.industryBonus;
    }
    if (stanceEffects.tradeBonus) {
        bonuses.tradeBonusMod = (bonuses.tradeBonusMod || 0) + stanceEffects.tradeBonus;
    }
    if (stanceEffects.researchSpeed) {
        bonuses.scienceBonus = (bonuses.scienceBonus || 0) + stanceEffects.researchSpeed;
    }
    if (stanceEffects.taxEfficiency) {
        bonuses.taxEfficiencyBonus = (bonuses.taxEfficiencyBonus || 0) + stanceEffects.taxEfficiency;
    }
    if (stanceEffects.incomePercentBonus) {
        bonuses.incomePercentBonus = (bonuses.incomePercentBonus || 0) + stanceEffects.incomePercentBonus;
    }
    
    // [DEBUG] Track after stance
    bonusDebug.afterStance = bonuses.incomePercentBonus || 0;
    
    if (stanceEffects.buildingCostMod) {
        bonuses.buildingCostMod = (bonuses.buildingCostMod || 0) + stanceEffects.buildingCostMod;
    }
    if (stanceEffects.needsReduction) {
        bonuses.needsReduction = (bonuses.needsReduction || 0) + stanceEffects.needsReduction;
    }
    if (stanceEffects.populationGrowth) {
        bonuses.populationGrowthBonus = (bonuses.populationGrowthBonus || 0) + stanceEffects.populationGrowth;
    }
    if (stanceEffects.militaryBonus) {
        bonuses.militaryBonus = (bonuses.militaryBonus || 0) + stanceEffects.militaryBonus;
    }
    if (stanceEffects.organizationDecay) {
        bonuses.organizationGrowthMod = (bonuses.organizationGrowthMod || 0) + stanceEffects.organizationDecay;
    }
    if (stanceEffects.cultureBonus) {
        bonuses.cultureBonus = (bonuses.cultureBonus || 0) + stanceEffects.cultureBonus;
    }
    if (stanceEffects.diplomaticBonus) {
        bonuses.diplomaticBonus = (bonuses.diplomaticBonus || 0) + stanceEffects.diplomaticBonus;
    }
    // 立场满意度效果存储供后续使用
    bonuses.stanceApprovalEffects = stanceEffects.approval || {};
    // 立场生产成本效果存储供后续使用
    bonuses.stanceProductionInputCost = stanceEffects.productionInputCost || {};

    // === 部长任命加成 ===
    const ministerRoster = buildMinisterRoster(officials || []);
    const ministerEffects = {
        buildingBonuses: {},
        tradeBonusMod: 0,
        militaryBonus: 0,
        militaryTrainingSpeed: 0,
        diplomaticBonus: 0,
    };

    ECONOMIC_MINISTER_ROLES.forEach((role) => {
        const officialId = ministerAssignments?.[role];
        const official = officialId ? ministerRoster.get(officialId) : null;
        if (!official) return;
        const statValue = getMinisterStatValue(official, role);
        const productionBonus = getMinisterProductionBonus(role, statValue);
        if (productionBonus) {
            BUILDINGS.forEach((building) => {
                if (!isBuildingUnlockedForMinister(building, epoch, techsUnlocked)) return;
                if (!isBuildingInMinisterScope(building, role)) return;
                ministerEffects.buildingBonuses[building.id] =
                    (ministerEffects.buildingBonuses[building.id] || 0) + productionBonus;
            });
        }
        if (role === 'commerce') {
            ministerEffects.tradeBonusMod += getMinisterTradeBonus(statValue);
        }
    });

    const militaryOfficialId = ministerAssignments?.military;
    const militaryOfficial = militaryOfficialId ? ministerRoster.get(militaryOfficialId) : null;
    if (militaryOfficial) {
        const statValue = getMinisterStatValue(militaryOfficial, 'military');
        ministerEffects.militaryBonus += getMinisterMilitaryBonus(statValue);
        ministerEffects.militaryTrainingSpeed = getMinisterTrainingSpeedBonus(statValue);
    }

    const diplomacyOfficialId = ministerAssignments?.diplomacy;
    const diplomacyOfficial = diplomacyOfficialId ? ministerRoster.get(diplomacyOfficialId) : null;
    if (diplomacyOfficial) {
        const statValue = getMinisterStatValue(diplomacyOfficial, 'diplomacy');
        ministerEffects.diplomaticBonus += getMinisterDiplomaticBonus(statValue);
    }

    Object.entries(ministerEffects.buildingBonuses).forEach(([buildingId, value]) => {
        bonuses.buildingBonuses[buildingId] = (bonuses.buildingBonuses[buildingId] || 0) + value;
    });
    if (ministerEffects.tradeBonusMod) {
        bonuses.tradeBonusMod = (bonuses.tradeBonusMod || 0) + ministerEffects.tradeBonusMod;
    }
    if (ministerEffects.militaryBonus) {
        bonuses.militaryBonus = (bonuses.militaryBonus || 0) + ministerEffects.militaryBonus;
    }
    if (ministerEffects.diplomaticBonus) {
        bonuses.diplomaticBonus = (bonuses.diplomaticBonus || 0) + ministerEffects.diplomaticBonus;
    }
    bonuses.militaryTrainingSpeed = ministerEffects.militaryTrainingSpeed;

    // Destructure for backward compatibility with existing code
    const {
        buildingBonuses,
        categoryBonuses,
        passiveGains,
        passivePercentGains,   // NEW: percentage-based passive resource modifiers
        perPopPassiveGains,    // NEW: per-population passive gains
        decreeResourceDemandMod,
        decreeStratumDemandMod,
        decreeResourceSupplyMod,
    } = bonuses;
    // Use let for mutable values
    let { decreeSilverIncome, decreeSilverExpense, extraMaxPop, maxPopPercent,
        productionBonus, industryBonus, taxBonus, needsReduction } = bonuses;

    const boostBuilding = (id, percent) => {
        if (!id || typeof percent !== 'number') return;
        const factor = 1 + percent;
        if (!Number.isFinite(factor) || factor <= 0) return;
        buildingBonuses[id] = (buildingBonuses[id] || 1) * factor;
    };

    const boostCategory = (category, percent) => {
        if (!category || typeof percent !== 'number') return;
        const factor = 1 + percent;
        if (!Number.isFinite(factor) || factor <= 0) return;
        categoryBonuses[category] = (categoryBonuses[category] || 1) * factor;
    };

    const addPassiveGain = (resource, amount) => {
        if (!resource || typeof amount !== 'number') return;
        passiveGains[resource] = (passiveGains[resource] || 0) + amount;
    };

    // Apply effects using imported module functions
    // Apply tech effects using module function
    applyTechEffects(techsUnlocked, bonuses);
    bonusDebug.afterTechs = bonuses.incomePercentBonus || 0;

    // Apply decree effects using module function
    // Timed reform decrees are sourced from `activeDecrees`.
    // We convert `{ decreeId: { effects } }` into the legacy structure expected by applyDecreeEffects.
    const decreesFromActive = activeDecrees
        ? Object.entries(activeDecrees).map(([id, data]) => ({
            id,
            active: true,
            modifiers: data?.effects || data?.modifiers
        }))
        : [];

    // Permanent legacy policy decrees are sourced from `decrees` (array of {id, active, modifiers}).
    const permanentDecrees = Array.isArray(decrees) ? decrees.filter(d => d && d.active) : [];

    applyDecreeEffects([...decreesFromActive, ...permanentDecrees], bonuses);
    bonusDebug.afterDecrees = bonuses.incomePercentBonus || 0;

    // Apply festival effects using module function
    applyFestivalEffects(activeFestivalEffects, bonuses);
    bonusDebug.afterFestivals = bonuses.incomePercentBonus || 0;

    // Apply active buffs (Strata bonuses)
    if (Array.isArray(productionBuffs)) {
        productionBuffs.forEach(buff => {
            applyEffects(buff, bonuses);
        });
    }

    // Apply active debuffs (Strata penalties)
    if (Array.isArray(productionDebuffs)) {
        productionDebuffs.forEach(debuff => {
            applyEffects(debuff, bonuses);
        });
    }

    // Apply Polity Effects (Government Type Bonuses)
    // 根据当前执政联盟计算政体，并应用政体效果
    // Use previous tick data to avoid circular dependency and TDZ issues
    let currentPolityEffects = null;
    if (rulingCoalition && rulingCoalition.length > 0) {
        const influenceData = calculateClassInfluence({
            popStructure: previousPopStructure,
            classWealthResult: classWealth
        });
        const currentPolity = getGovernmentType(
            rulingCoalition,
            influenceData.classInfluence,
            influenceData.totalInfluence
        );
        currentPolityEffects = getPolityEffects(currentPolity.name);
        applyPolityEffects(currentPolityEffects, bonuses);
    }

    // Apply Epoch bonuses
    if (EPOCHS && EPOCHS[epoch] && EPOCHS[epoch].bonuses) {
        applyEffects(EPOCHS[epoch].bonuses, bonuses);
    }
    perfEnd('bonusesApply');

    // Sync mutable values back from bonuses object after module function calls
    decreeSilverIncome = bonuses.decreeSilverIncome;
    decreeSilverExpense = bonuses.decreeSilverExpense;
    extraMaxPop = bonuses.extraMaxPop;
    maxPopPercent = bonuses.maxPopPercent;
    productionBonus = bonuses.productionBonus;
    industryBonus = bonuses.industryBonus;
    taxBonus = bonuses.taxBonus;
    needsReduction = bonuses.needsReduction;
    const incomePercentBonus = bonuses.incomePercentBonus || 0; // NEW: income percentage bonus
    
    // [DEBUG] Log incomePercentBonus accumulation if abnormal
    if (Math.abs(incomePercentBonus) > 0.5) {
        console.warn('[INCOME BONUS ACCUMULATION]', {
            tick,
            final: incomePercentBonus.toFixed(4),
            breakdown: bonusDebug,
            officialsCount: officials.length,
            activeDecreesCount: activeDecrees ? Object.keys(activeDecrees).length : 0,
            techsCount: techsUnlocked.length,
            festivalsCount: activeFestivalEffects.length,
        });
    }

    // computePriceMultiplier is imported from ./utils/helpers

    const getPrice = (resource) => {
        if (!priceMap[resource]) {
            priceMap[resource] = getBasePrice(resource);
        }
        priceMap[resource] = Math.max(PRICE_FLOOR, priceMap[resource]);
        return priceMap[resource];
    };

    // When producing a building, we set this so sellProduction can attribute revenue to that building.
    let currentBuildingId = null;

    const sellProduction = (resource, amount, ownerKey) => {
        // 特殊处理银币产出：直接作为所有者收入，不进入国库，不交税
        if (resource === 'silver' && amount > 0) {
            roleWagePayout[ownerKey] = (roleWagePayout[ownerKey] || 0) + amount;
            // 使用 Ledger 记录收入
            ledger.transfer('void', ownerKey, amount, TRANSACTION_CATEGORIES.INCOME.OWNER_REVENUE, TRANSACTION_CATEGORIES.INCOME.OWNER_REVENUE, { buildingId: currentBuildingId });
            return;
        }
        if (amount <= 0) return;
        res[resource] = (res[resource] || 0) + amount;
        if (isTradableResource(resource)) {
            supply[resource] = (supply[resource] || 0) + amount;
            const marketPrice = getPrice(resource);

            // [NEW] 价格管制检查（出售侧）：政府保底收购或收超额利润税
            // 只有左派主导且启用时才生效
            const leftFactionDominant = cabinetStatus?.dominance?.panelType === 'plannedEconomy';
            const priceControlActive = leftFactionDominant && priceControls?.enabled && priceControls.governmentBuyPrices?.[resource] !== undefined;

            let effectivePrice = marketPrice;
            if (priceControlActive) {
                const pcResult = applySellPriceControl({
                    resourceKey: resource,
                    amount,
                    marketPrice,
                    priceControls,
                    taxBreakdown,
                    resources: res,
                    onTreasuryChange: trackSilverChange,
                });
                if (pcResult.success) {
                    effectivePrice = pcResult.effectivePrice;
                }
            }

            const grossIncome = effectivePrice * amount;
            const netIncome = grossIncome;

            // 记录owner的净销售收入 (本地追踪)
            roleWagePayout[ownerKey] = (roleWagePayout[ownerKey] || 0) + netIncome;

            // 使用 Ledger 记录收入
            ledger.transfer('void', ownerKey, netIncome, TRANSACTION_CATEGORIES.INCOME.OWNER_REVENUE, TRANSACTION_CATEGORIES.INCOME.OWNER_REVENUE, { buildingId: currentBuildingId });
        }
    };

    perfStart('preProduction');
    const rates = {};
    const builds = buildings;
    const producedResources = new Set();
    const jobsAvailable = {};
    const roleWageStats = {};
    const roleWagePayout = {};
    const directIncomeApplied = {};
    const roleVacancyTargets = {};
    let totalMaxPop = 5;
    let militaryCapacity = 0; // 新增：军事容量
    totalMaxPop += extraMaxPop;
    totalMaxPop += maxPopBonus;
    const armyPopulationDemand = calculateArmyPopulation(army);
    const armyFoodNeed = calculateArmyFoodNeed(army);

    // 计算当前军队数量（只包括已完成训练的）
    const currentArmyCount = Object.values(army).reduce((sum, count) => sum + count, 0);
    // 训练队列数量将在后面单独处理
    const totalArmyCount = currentArmyCount;

    ROLE_PRIORITY.forEach(role => jobsAvailable[role] = 0);
    ROLE_PRIORITY.forEach(role => {
        roleWageStats[role] = { totalSlots: 0, weightedWage: 0 };
        roleWagePayout[role] = 0;
    });

    // [FIX] Separate Labor Income vs Total Income for Wage Calculation
    // role WagePayout includes owner revenue, which distorts wage expectations if used for labor market logic.
    const roleLaborIncome = {};
    const roleLivingExpense = {};
    ROLE_PRIORITY.forEach(role => {
        roleLaborIncome[role] = 0;
        roleLivingExpense[role] = 0;
    });

    // Track class expenses (spending on resources)
    const roleExpense = {};
    Object.keys(STRATA).forEach(key => {
        roleExpense[key] = 0;
    });

    // Track head tax paid separately (not part of living expenses)
    const roleHeadTaxPaid = {};
    Object.keys(STRATA).forEach(key => {
        roleHeadTaxPaid[key] = 0;
    });

    // Track business tax paid separately (not part of living expenses)
    const roleBusinessTaxPaid = {};
    Object.keys(STRATA).forEach(key => {
        roleBusinessTaxPaid[key] = 0;
    });

    const applyRoleIncomeToWealth = () => {
        // [REFACTORED] Wealth is now updated immediately via Ledger.
        // This function is kept empty or removed to prevent double counting.
        // We keep it empty if called elsewhere, or remove calls.
        // For now, empty implementation.
    };

    // console.log('[TICK] Processing buildings...'); // Commented for performance
    BUILDINGS.forEach(b => {
        const count = builds[b.id] || 0;
        if (count > 0) {
            const { fullLevelCounts } = getBuildingLevelDistribution(
                tick,
                b.id,
                buildingUpgrades,
                count
            );

            // 遍历每个等级，累加其效果
            Object.entries(fullLevelCounts).forEach(([lvlStr, lvlCount]) => {
                if (lvlCount <= 0) return;
                const level = parseInt(lvlStr);
                const config = getBuildingEffectiveConfig(b, level);

                // Apply building-specific and category bonuses
                // Note: buildingBonuses and categoryBonuses use additive mode (0 = no bonus, 0.12 = +12%)
                let buildingBonus = 1 + (buildingBonuses[b.id] || 0);
                const catBonus = 1 + (categoryBonuses[b.cat] || 0);
                buildingBonus *= catBonus;

                // maxPop - 乘以该等级建筑数量
                if (config.output?.maxPop) {
                    totalMaxPop += (config.output.maxPop * buildingBonus * lvlCount);
                }

                // militaryCapacity - 乘以该等级建筑数量
                if (config.output?.militaryCapacity) {
                    militaryCapacity += (config.output.militaryCapacity * buildingBonus * lvlCount);
                }

                // jobs - 使用升级后的配置，乘以该等级建筑数量
                if (config.jobs) {
                    for (let role in config.jobs) {
                        jobsAvailable[role] = (jobsAvailable[role] || 0) + config.jobs[role] * lvlCount;
                    }
                }

                // 记录已生产的资源类型
                if (config.output) {
                    Object.entries(config.output).forEach(([resKey, amount]) => {
                        if (!RESOURCES[resKey]) return;
                        if ((amount || 0) > 0) {
                            producedResources.add(resKey);
                        }
                    });
                }
            });
        }
    });
    // console.log('[TICK] Buildings processed. militaryCapacity:', militaryCapacity); // Commented for performance

    // ========== 统一业主系统：修正非阶层业主的建筑岗位 ==========
    // 使用 buildOwnershipListFromLegacy 从分散数据源构建业主信息
    // 然后根据业主类型调整 jobsAvailable
    // 核心逻辑：只有阶层业主(STRATUM)才提供业主岗位，其他类型(官员/外资/国企)不提供

    // 每个建筑的实际岗位需求（考虑外资/官员减少业主岗位）
    perfStart('ownerJobsAdjust');
    const buildingJobsRequired = {};

    BUILDINGS.forEach(building => {
        const buildingCount = buildings[building.id] || 0;
        if (buildingCount <= 0) return;

        const { fullLevelCounts: levelCounts } = getBuildingLevelDistribution(
            tick,
            building.id,
            buildingUpgrades,
            buildingCount
        );

        const totalJobsByRole = {};
        let ownerSlotsTotal = 0;
        Object.entries(levelCounts).forEach(([lvlStr, lvlCount]) => {
            if (lvlCount <= 0) return;
            const lvl = parseInt(lvlStr);
            const config = getBuildingEffectiveConfig(building, lvl);
            const jobs = config.jobs || {};
            Object.entries(jobs).forEach(([role, perBuilding]) => {
                totalJobsByRole[role] = (totalJobsByRole[role] || 0) + perBuilding * lvlCount;
            });
            if (building.owner && jobs[building.owner]) {
                ownerSlotsTotal += jobs[building.owner] * lvlCount;
            }
        });

        if (Object.keys(totalJobsByRole).length <= 0) return;

        buildingJobsRequired[building.id] = totalJobsByRole;

        const ownerRole = building.owner;
        if (!ownerRole || ownerSlotsTotal <= 0) return;

        const ownershipList = buildOwnershipListFromLegacy(
            building.id,
            buildingCount,
            officials,
            foreignInvestments,
            building
        );

        let nonStratumCount = 0;
        ownershipList.forEach(ownership => {
            if (!providesOwnerJobs(ownership.ownerType)) {
                nonStratumCount += ownership.count || 0;
            }
        });

        if (nonStratumCount > 0) {
            const averageOwnerSlots = buildingCount > 0 ? ownerSlotsTotal / buildingCount : 0;
            const slotsToRemove = averageOwnerSlots * nonStratumCount;
            if (jobsAvailable[ownerRole]) {
                jobsAvailable[ownerRole] = Math.max(0, jobsAvailable[ownerRole] - slotsToRemove);
            }
            buildingJobsRequired[building.id][ownerRole] = Math.max(
                0,
                (buildingJobsRequired[building.id][ownerRole] || 0) - slotsToRemove
            );
        }
    });
    perfEnd('ownerJobsAdjust');

    // Calculate potential resources: resources from buildings that are unlocked (can be built)
    perfStart('potentialResources');
    const potentialResources = (() => {
        const techKey = Array.isArray(techsUnlocked) ? techsUnlocked.join('|') : '';
        const cacheKey = `${epoch}|${techKey}`;
        if (cachedPotentialResourcesKey === cacheKey && cachedPotentialResourcesSet) {
            return cachedPotentialResourcesSet;
        }
        const set = new Set();
        BUILDINGS.forEach(b => {
            // Check if building is unlocked: epoch requirement met AND tech requirement met (if any)
            const epochUnlocked = (b.epoch ?? 0) <= epoch;
            const techUnlocked = !b.requiresTech || techsUnlocked.includes(b.requiresTech);

            if (epochUnlocked && techUnlocked && b.output) {
                Object.entries(b.output).forEach(([resKey, amount]) => {
                    if (!RESOURCES[resKey]) return;
                    if ((amount || 0) > 0) {
                        set.add(resKey);
                    }
                });
            }
        });
        cachedPotentialResourcesKey = cacheKey;
        cachedPotentialResourcesSet = set;
        return set;
    })();
    perfEnd('potentialResources');

    if (maxPopPercent !== 0) {
        const multiplier = Math.max(0, 1 + maxPopPercent);
        totalMaxPop = Math.max(0, totalMaxPop * multiplier);
    }
    totalMaxPop = Math.floor(totalMaxPop);

    // 军人岗位包括：已有军队 + 等待人员的岗位 + 训练中的岗位
    // 计算已有军队的人口需求
    let currentArmyPopNeeded = 0;
    Object.entries(army).forEach(([unitId, count]) => {
        if (!count || count <= 0) return;
        const unit = UNIT_TYPES[unitId];
        const popCost = unit?.populationCost || 1;
        currentArmyPopNeeded += count * popCost;
    });

    // 计算队列中的人口需求
    const queuePopNeeded = (militaryQueue || []).reduce((sum, item) => {
        if (item.status === 'waiting' || item.status === 'training') {
            const unit = UNIT_TYPES[item.unitId];
            const popCost = unit?.populationCost || 1;
            return sum + popCost;
        }
        return sum;
    }, 0);

    // 总岗位需求 = 现有军队人口 + 队列所需人口
    const soldierJobsNeeded = currentArmyPopNeeded + queuePopNeeded;
    // console.log('[TICK] Adding soldier jobs. currentArmyPop:', currentArmyPopNeeded, 'queuePop:', queuePopNeeded, 'total:', soldierJobsNeeded); // Commented for performance
    if (soldierJobsNeeded > 0) {
        jobsAvailable.soldier = (jobsAvailable.soldier || 0) + soldierJobsNeeded;
    }
    // console.log('[TICK] Soldier jobs added. jobsAvailable.soldier:', jobsAvailable.soldier); // Commented for performance

    perfStart('populationJobs');
    // 职业持久化：基于上一帧状态进行增减，而非每帧重置
    // console.log('[TICK] Starting population allocation...'); // Commented for performance
    const hasPreviousPopStructure = previousPopStructure && Object.keys(previousPopStructure).length > 0;
    let popStructure = {};

    let diff = 0;

    if (!hasPreviousPopStructure) {
        // 首次运行：按岗位需求进行一次性初始分配
        // 这能确保例如军队/训练队列产生的 `soldier` 岗位在开局就能拿到人
        let remainingPop = population;
        ROLE_PRIORITY.forEach(role => {
            const slots = Math.max(0, jobsAvailable[role] || 0);
            const filled = Math.min(remainingPop, slots);
            popStructure[role] = filled;
            remainingPop -= filled;
        });
        popStructure.unemployed = Math.max(0, remainingPop);
    } else {
        // 继承上一帧状态
        ROLE_PRIORITY.forEach(role => {
            const prevCount = (previousPopStructure[role] || 0);
            popStructure[role] = Math.max(0, prevCount);
        });
        popStructure.unemployed = Math.max(0, (previousPopStructure.unemployed || 0));

        // 处理人口变化（增长或减少）
        const assignedPop = ROLE_PRIORITY.reduce((sum, role) => sum + (popStructure[role] || 0), 0) + (popStructure.unemployed || 0);
        diff = population - assignedPop;

        if (diff > 0) {
            // 人口增长：新人加入失业者
            popStructure.unemployed = (popStructure.unemployed || 0) + diff;
        } else if (diff < 0) {
            // 人口减少：仅从失业者中扣除，不自动从各职业扣除（防止人口被吸走）
            let reductionNeeded = -diff;
            const unemployedReduction = Math.min(popStructure.unemployed || 0, reductionNeeded);
            if (unemployedReduction > 0) {
                popStructure.unemployed -= unemployedReduction;
                reductionNeeded -= unemployedReduction;
            }

            // 注释掉自动从各职业扣除人口的逻辑
            // 如果还需要减少人口，保持现状（不自动重新分配）
            if (reductionNeeded > 0) {
                const initialTotal = ROLE_PRIORITY.reduce((sum, role) => sum + (popStructure[role] || 0), 0);
                if (initialTotal > 0) {
                    const baseReduction = reductionNeeded;
                    ROLE_PRIORITY.forEach((role, index) => {
                        if (reductionNeeded <= 0) return;
                        const current = popStructure[role] || 0;
                        if (current <= 0) return;
                        const proportion = current / initialTotal;
                        let remove = Math.floor(proportion * baseReduction);
                        if (remove <= 0 && reductionNeeded > 0) remove = 1;
                        if (index === ROLE_PRIORITY.length - 1) {
                            remove = Math.min(current, reductionNeeded);
                        } else {
                            remove = Math.min(current, Math.min(remove, reductionNeeded));
                        }
                        if (remove <= 0) return;
                        popStructure[role] = current - remove;
                        reductionNeeded -= remove;
                        // 注意：财富不扣除，留给幸存者均摊（变相增加人均财富）
                    });
                    if (reductionNeeded > 0) {
                        ROLE_PRIORITY.forEach(role => {
                            if (reductionNeeded <= 0) return;
                            const current = popStructure[role] || 0;
                            if (current <= 0) return;
                            const remove = Math.min(current, reductionNeeded);
                            popStructure[role] = current - remove;
                            reductionNeeded -= remove;
                        });
                    }
                }
            }
        }
    }
    popStructure.unemployed = Math.max(0, popStructure.unemployed || 0);

    // REFACTORED: Use calculateWeightedAverageWage imported from ./economy/wages
    const defaultWageEstimate = calculateWeightedAverageWage(popStructure, previousWages);

    // 处理岗位上限（裁员）：如果职业人数超过岗位数，将多出的人转为失业
    // 注意：official 阶层不参与自由流动，人数由雇佣的官员数决定
    ROLE_PRIORITY.forEach(role => {
        if (role === 'official') return; // 官员不参与普通裁员逻辑

        const current = popStructure[role] || 0;
        const slots = Math.max(0, jobsAvailable[role] || 0);
        if (current > slots) {
            const layoffs = current - slots;
            const roleWealth = wealth[role] || 0;
            const perCapWealth = current > 0 ? roleWealth / current : 0;

            // 裁员：人口移至失业，并携带财富
            popStructure[role] = slots;
            popStructure.unemployed = (popStructure.unemployed || 0) + layoffs;

            if (perCapWealth > 0) {
                const transfer = perCapWealth * layoffs;
                // Use ledger for tracking layoff wealth transfer
                ledger.transfer(role, 'unemployed', transfer, TRANSACTION_CATEGORIES.EXPENSE.LAYOFF_TRANSFER, TRANSACTION_CATEGORIES.EXPENSE.LAYOFF_TRANSFER);
            }
        }
    });

    // === 官员阶层特殊处理 ===
    // 官员人数 = min(建筑提供的岗位, 雇佣的官员数)
    const officialJobs = jobsAvailable.official || 0;
    const hiredOfficialCount = Array.isArray(officials) ? officials.length : 0;
    const actualOfficialCount = hiredOfficialCount; // Allow all hired officials to be counted, even if exceeding jobs
    popStructure.official = actualOfficialCount;
    // 官员财富由每位官员独立持有，不计入 wealth.official（清零以避免重复）
    wealth.official = 0;

    let taxModifier = 1.0;

    // 执政联盟合法性计算（初步，待影响力计算后会精确计算）
    // 此处使用上一tick的数据估算，避免循环依赖
    let coalitionLegitimacy = 0;
    // 使用上一tick的合法性计算税收修正（避免循环依赖）
    let legitimacyTaxModifier = getLegitimacyTaxModifier(previousLegitimacy);

    // 将合法性税收修正和庆典/政令/科技的税收加成整合到总体税收修正中
    // bonuses.taxBonus 是来自 effects.taxIncome 的累加值（如庆典效果、政令效果等）
    const effectiveTaxModifier = Math.max(0, taxModifier * legitimacyTaxModifier * (1 + (bonuses.taxBonus || 0)));
    
    // [FIX] 提前定义空岗位收入预估函数，用于 fillVacancies 时的智能工资判断
    // 逻辑与 simulation 尾部的 estimateVacantRoleIncome 类似，但只能使用上一 tick 的数据 (market.wages)
    const estimatePotentialIncomeForVacancy = (role) => {
        const VACANT_BONUS = 1.2;
        let ownerIncome = 0;
        let ownerSlots = 0;
        let employeeWage = 0;
        let employeeSlots = 0;

        BUILDINGS.forEach(building => {
            const count = builds[building.id] || 0;
            if (count <= 0) return;

            const config = getBuildingEffectiveConfig(building, 0);
            const jobs = config.jobs || {};
            const roleSlots = jobs[role] || 0;
            if (roleSlots <= 0) return;

            const isOwner = building.owner === role;

            if (isOwner) {
                // 业主预估：产出 - 成本 - 雇员工资 - 税
                let outputValue = 0;
                if (config.output) {
                    Object.entries(config.output).forEach(([resource, amount]) => {
                        // 跳过特殊资源
                        if (!RESOURCES[resource]) return;
                        const price = priceMap[resource] || getBasePrice(resource);
                        outputValue += amount * price;
                    });
                }
                let inputCost = 0;
                if (config.input) {
                    Object.entries(config.input).forEach(([resource, amount]) => {
                        const price = priceMap[resource] || getBasePrice(resource);
                        inputCost += amount * price;
                    });
                }
                let wageCost = 0;
                Object.entries(jobs).forEach(([jobRole, slots]) => {
                    if (jobRole === role || !slots || slots <= 0) return;
                    // 使用上一 tick 的工资作为参考
                    const avgPaidWage = market?.wages?.[jobRole] ?? getExpectedWage(jobRole);
                    wageCost += avgPaidWage * slots;
                });

                const headBase = STRATA[role]?.headTaxBase ?? 0.01;
                const headTaxCost = headBase * getHeadTaxRate(role) * effectiveTaxModifier;
                const businessTaxBase = building.businessTaxBase ?? 0.1;
                const businessTaxRate = policies?.businessTaxRates?.[building.id] ?? 1;
                const businessTaxCost = businessTaxBase * businessTaxRate;

                const netProfit = outputValue - inputCost - wageCost - headTaxCost - businessTaxCost;
                const profitPerOwner = roleSlots > 0 ? netProfit / roleSlots : 0;

                ownerIncome += profitPerOwner * roleSlots * count;
                ownerSlots += roleSlots * count;
            } else {
                // 雇员预估：使用上一 tick 市场工资，如果为 0 则尝试从 building 属性推断
                // 注意：这里是一个关键点，如果没有历史工资，我们应该相信 building 的 wagePressure 吗？
                // simulation 尾部的逻辑是直接取 market.wages，但这里正是因为 market.wages 低才导致没人来
                // 既然是雇员，主要看"期望工资" + "空缺加成"
                // 但如果该岗位是高利润行业的工人，应该能给得起高工资。
                // 简单起见，我们对雇员也应用 VACANT_BONUS 到 getExpectedWage 上
                const avgPaidWage = market?.wages?.[role] ?? getExpectedWage(role);

                // 计算税后（虽然这里只算工资部分，统一后面处理）
                employeeWage += avgPaidWage * roleSlots * count;
                employeeSlots += roleSlots * count;
            }
        });

        const totalSlots = ownerSlots + employeeSlots;
        if (totalSlots <= 0) return getExpectedWage(role);

        // 如果是纯雇员岗位且历史工资极低，尝试根据行业利润反推？
        // 目前暂不搞太复杂，先仅对"有产出但没工资"的情况做兜底
        // 但对于 worker 这种纯雇员，如果 market.wages 是 0，这里算出来还是 0
        // 需要一个机制让"空的高利润工厂"广播高工资
        // 在 building production loop 中我们有 wagePressure，但这里还是 start of tick

        // 改进：如果是雇员，且计算出的 employeeWage 很低，但所在的工厂很赚钱...
        // 这太复杂了。目前先复用原有逻辑，依赖 VACANT_BONUS 提升吸引力
        const totalIncome = ownerIncome + employeeWage;
        const averageIncome = totalIncome / totalSlots;
        return Math.max(getExpectedWage(role), averageIncome * VACANT_BONUS);
    };

    // [FIX] 智能工资获取器
    const getSmartExpectedWage = (role) => {
        const currentPop = popStructure[role] || 0;
        // 如果没人干这个活，或者人很少，就使用"画饼"模式（预估潜力）来吸引人
        if (currentPop <= 5) {
            const potential = estimatePotentialIncomeForVacancy(role);
            const standard = getExpectedWage(role);
            return Math.max(potential, standard);
        }
        return getExpectedWage(role);
    };

    // 自动填补（招工）：使用 job.js 中的 fillVacancies 函数，支持阶层流动
    const filledResult = fillVacancies({
        popStructure,
        jobsAvailable,
        wealth,
        getExpectedWage: getSmartExpectedWage, // [FIX] 使用智能工资预估
        getHeadTaxRate,
        effectiveTaxModifier
    });
    perfEnd('populationJobs');

    // 重新赋值更新后的人口结构和财富
    // 注意：fillVacancies 会直接修改传入的对象引用，但在 React/Redux 模式下通常建议返回新对象
    // 这里 fillVacancies 返回了 { popStructure, wealth }，我们将其解构回来确保引用正确
    // (虽然 simulation.js 中 popStructure 和 wealth 是局部变量，可以直接修改)
    // 保持代码清晰：
    // const { popStructure: updatedPop, wealth: updatedWealth } = filledResult;

    const classApproval = {};
    const classInfluence = {};
    const classWealthResult = {};
    const approvalBreakdown = {}; // NEW: per-stratum approval calculation breakdown for UI traceability
    const logs = [];
    const vassalDiplomacyRequests = [];
    const aggregatedLogs = new Map();
    const buildingJobFill = {};
    const buildingStaffingRatios = {};

    const recordAggregatedLog = (message) => {
        if (!message) return;
        const count = aggregatedLogs.get(message) || 0;
        aggregatedLogs.set(message, count + 1);
    };

    perfStart('passiveGains');
    Object.entries(passiveGains).forEach(([resKey, amountPerDay]) => {
        if (!amountPerDay) return;
        const gain = amountPerDay;
        const current = res[resKey] || 0;
        if (gain >= 0) {
            applyResourceChange(resKey, gain, 'passive_gain');
            rates[resKey] = (rates[resKey] || 0) + gain;
        } else {
            const needed = Math.abs(gain);
            const spent = Math.min(current, needed);
            if (spent > 0) {
                applyResourceChange(resKey, -spent, 'passive_cost');
                rates[resKey] = (rates[resKey] || 0) - spent;
            }
        }
    });

    // NEW: Apply per-population passive gains (scales with total population)
    const totalPopulation = population || 0;
    Object.entries(perPopPassiveGains || {}).forEach(([resKey, amountPerPop]) => {
        if (!amountPerPop || totalPopulation <= 0) return;
        const gain = amountPerPop * totalPopulation;
        const current = res[resKey] || 0;
        if (gain >= 0) {
            applyResourceChange(resKey, gain, 'passive_pop_gain');
            rates[resKey] = (rates[resKey] || 0) + gain;
        } else {
            const needed = Math.abs(gain);
            const spent = Math.min(current, needed);
            if (spent > 0) {
                applyResourceChange(resKey, -spent, 'passive_pop_cost');
                rates[resKey] = (rates[resKey] || 0) - spent;
            }
        }
    });

    // NEW: Apply percentage-based passive resource modifiers
    // These scale with current resource rates (positive modifier increases production, negative decreases)
    Object.entries(passivePercentGains || {}).forEach(([resKey, percent]) => {
        if (!percent) return;
        const currentRate = rates[resKey] || 0;
        // For positive rates: modifier increases/decreases the production
        // For negative rates (consumption): modifier increases/decreases the consumption
        if (currentRate !== 0) {
            const modification = Math.abs(currentRate) * percent;
            if (currentRate >= 0) {
                // Production resource: positive percent = more production
                applyResourceChange(resKey, modification, 'passive_percent_gain');
                rates[resKey] = currentRate + modification;
            } else {
                // Consumption resource: positive percent = less consumption (better)
                applyResourceChange(resKey, -modification, 'passive_percent_cost');
                rates[resKey] = currentRate - modification;
            }
        } else {
            // If rate is 0, use a base value scaled by population for the modifier
            const baseValue = totalPopulation * 0.01; // 1% of population as base
            const modification = baseValue * percent;
            applyResourceChange(resKey, modification, 'passive_percent_base_gain');
            rates[resKey] = (rates[resKey] || 0) + modification;
        }
    });

    const zeroApprovalClasses = {};
    // 允许负的 needsReduction (即增加需求)，下限设为 -2 (需求翻3倍)，上限 0.95
    const effectiveNeedsReduction = Math.max(-2, Math.min(0.95, needsReduction || 0));
    const needsRequirementMultiplier = 1 - effectiveNeedsReduction;

    // [FIX] 保存税前存款快照，用于后续TaxShock计算
    // 这样即使税收榨干了存款，也能正确计算税收占比来触发惩罚
    const preTaxWealth = {};
    Object.keys(STRATA).forEach(key => {
        preTaxWealth[key] = wealth[key] || 0;
    });

    perfStart('headTax');
    Object.keys(STRATA).forEach(key => {
        if (key === 'official') return;
        const count = popStructure[key] || 0;
        if (count === 0) return;
        const def = STRATA[key];
        if (wealth[key] === undefined) {
            wealth[key] = def.startingWealth || 0;
        }
        const headRate = getHeadTaxRate(key);
        const headBase = STRATA[key]?.headTaxBase ?? 0.01;
        const plannedPerCapitaTax = headBase * headRate * effectiveTaxModifier;
        const available = Math.max(0, wealth[key] || 0);
        const maxPerCapitaTax = available / Math.max(1, count);
        const effectivePerCapitaTax = plannedPerCapitaTax >= 0
            ? Math.min(plannedPerCapitaTax, maxPerCapitaTax)
            : plannedPerCapitaTax;
        const due = count * effectivePerCapitaTax;
        
        // [DEBUG] 人头税征收调试日志
        // if (Math.abs(headRate) > 5) { // 只在税率异常高时输出
        //     console.log(`[HEAD TAX DEBUG] ${key}:`, {
        //         人口: count,
        //         财富总额: available.toFixed(2),
        //         人均财富: maxPerCapitaTax.toFixed(2),
        //         税率倍数: headRate.toFixed(2),
        //         计划人均税额: plannedPerCapitaTax.toFixed(2),
        //         实际人均税额: effectivePerCapitaTax.toFixed(2),
        //         应缴总额: due.toFixed(2),
        //         实际支付: Math.min(available, due).toFixed(2),
        //         是否受限: plannedPerCapitaTax > maxPerCapitaTax ? '是' : '否'
        //     });
        // }
        
        if (due !== 0) {
            if (due > 0) {
                const paid = Math.min(available, due);
                ledger.transfer(key, 'state', paid, TRANSACTION_CATEGORIES.EXPENSE.HEAD_TAX, TRANSACTION_CATEGORIES.EXPENSE.HEAD_TAX);
                // 记录人头税支出 (本地追踪用于逻辑判断)
                roleHeadTaxPaid[key] = (roleHeadTaxPaid[key] || 0) + paid;
                roleExpense[key] = (roleExpense[key] || 0) + paid;
                roleLivingExpense[key] = (roleLivingExpense[key] || 0) + paid;
            } else {
                const subsidyNeeded = -due;
                const treasury = res.silver || 0;
                if (treasury >= subsidyNeeded) {
                    ledger.transfer('state', key, subsidyNeeded, TRANSACTION_CATEGORIES.INCOME.SUBSIDY, TRANSACTION_CATEGORIES.INCOME.SUBSIDY);
                    // 记录政府补助收入 (本地追踪)
                    roleWagePayout[key] = (roleWagePayout[key] || 0) + subsidyNeeded;
                    roleLaborIncome[key] = (roleLaborIncome[key] || 0) + subsidyNeeded;
                }
            }
        }
        classApproval[key] = previousApproval[key] ?? 50;
        if ((classApproval[key] || 0) <= 0) {
            zeroApprovalClasses[key] = true;
        }
    });

    perfEnd('preProduction');
    const forcedLabor = !!(activeDecrees && activeDecrees.forced_labor);

    // console.log('[TICK] Starting production loop...'); // Commented for performance
    perfStart('productionLoop');
    BUILDINGS.forEach(b => {
        const count = builds[b.id] || 0;
        if (count === 0) return;

        // --- 计算升级加成后的基础数值 ---
        const { fullLevelCounts: levelCounts, level0Count, hasUpgrades } = getBuildingLevelDistribution(
            tick,
            b.id,
            buildingUpgrades,
            count
        );
        const effectiveOps = { input: {}, output: {}, jobs: {} };

        // === 构建 owner 分组映射 ===
        // 每个 owner 可能拥有不同等级的建筑，记录 { ownerKey: { levels: { lvl: count }, totalCount: N } }
        const ownerLevelGroups = {};
        Object.entries(levelCounts).forEach(([lvlStr, lvlCount]) => {
            if (lvlCount <= 0) return;
            const lvl = parseInt(lvlStr);
            const config = getBuildingEffectiveConfig(b, lvl);
            const ownerKey = config.owner || 'state';
            if (!ownerLevelGroups[ownerKey]) {
                ownerLevelGroups[ownerKey] = { levels: {}, totalCount: 0 };
            }
            ownerLevelGroups[ownerKey].levels[lvl] = lvlCount;
            ownerLevelGroups[ownerKey].totalCount += lvlCount;
        });

        // 初始化所有涉及的 owner 的财富
        Object.keys(ownerLevelGroups).forEach(ownerKey => {
            if (wealth[ownerKey] === undefined) {
                wealth[ownerKey] = STRATA[ownerKey]?.startingWealth || 0;
            }
        });

        // 获取主要 owner（用于向后兼容现有逻辑中的部分判断）
        const primaryOwnerKey = b.owner || 'state';

        let multiplier = 1.0;

        if (!hasUpgrades && level0Count === count) {
            // 无升级快速路径
            if (b.input) for (const [k, v] of Object.entries(b.input)) effectiveOps.input[k] = v * count;
            if (b.output) for (const [k, v] of Object.entries(b.output)) effectiveOps.output[k] = v * count;
            if (b.jobs) for (const [k, v] of Object.entries(b.jobs)) effectiveOps.jobs[k] = v * count;
        } else {
            // 聚合计算各等级建筑的input/output/jobs
            for (const [lvlStr, lvlCount] of Object.entries(levelCounts)) {
                if (lvlCount <= 0) continue;
                const lvl = parseInt(lvlStr);
                const config = getBuildingEffectiveConfig(b, lvl);
                if (config.input) for (const [k, v] of Object.entries(config.input)) effectiveOps.input[k] = (effectiveOps.input[k] || 0) + v * lvlCount;
                if (config.output) for (const [k, v] of Object.entries(config.output)) effectiveOps.output[k] = (effectiveOps.output[k] || 0) + v * lvlCount;
                if (config.jobs) for (const [k, v] of Object.entries(config.jobs)) effectiveOps.jobs[k] = (effectiveOps.jobs[k] || 0) + v * lvlCount;
            }
        }
        // -----------------------------
        const currentEpoch = EPOCHS[epoch];

        // ========== 加法叠加模式 ==========
        // 收集所有加成百分比，最后统一计算 multiplier = 1 + 所有加成之和
        let bonusSum = 0;

        // 1. 时代加成
        if (currentEpoch && currentEpoch.bonuses) {
            if (b.cat === 'gather' && currentEpoch.bonuses.gatherBonus) {
                bonusSum += currentEpoch.bonuses.gatherBonus;
            }
            if (b.cat === 'industry' && currentEpoch.bonuses.industryBonus) {
                bonusSum += currentEpoch.bonuses.industryBonus;
            }
        }

        // 2. 全局生产/工业 modifier（来自 buff/debuff）
        let productionBonusSum = 0;
        let industryBonusSum = 0;
        productionBuffs.forEach(buff => {
            if (buff.production) productionBonusSum += buff.production;
            if (buff.industryBonus) industryBonusSum += buff.industryBonus;
        });
        productionDebuffs.forEach(debuff => {
            if (debuff.production) productionBonusSum += debuff.production;
            if (debuff.industryBonus) industryBonusSum += debuff.industryBonus;
        });
        // 政令加成
        productionBonusSum += productionBonus;
        industryBonusSum += industryBonus;

        if (b.cat === 'gather' || b.cat === 'civic') {
            bonusSum += productionBonusSum;
        }
        if (b.cat === 'industry') {
            bonusSum += industryBonusSum;
        }

        // 2.5 战时产出加成（仅在战争中生效）
        if (isPlayerAtWar && bonuses.wartimeProduction) {
            bonusSum += bonuses.wartimeProduction;
        }

        // 3. 类别加成（categoryBonuses 现在直接存储加成百分比，如 0.25 = +25%）
        const categoryBonus = categoryBonuses[b.cat];
        if (categoryBonus && categoryBonus !== 0) {
            bonusSum += categoryBonus;
        }

        // 4. 事件加成
        const buildingSpecificMod = eventBuildingProductionModifiers[b.id] || 0;
        const buildingCategoryMod = eventBuildingProductionModifiers[b.cat] || 0;
        const buildingAllMod = eventBuildingProductionModifiers['all'] || 0;
        bonusSum += buildingSpecificMod + buildingCategoryMod + buildingAllMod;

        // 5. 建筑特定科技加成（buildingBonuses 现在直接存储加成百分比，如 0.25 = +25%）
        const buildingBonus = buildingBonuses[b.id];
        if (buildingBonus && buildingBonus !== 0) {
            bonusSum += buildingBonus;
        }

        // 应用加成：基础乘数 × (1 + 总加成)
        multiplier *= (1 + bonusSum);

        // Init per-building realized financial stats container
        if (!buildingFinancialData[b.id]) {
            buildingFinancialData[b.id] = {
                wagesByRole: {},
                paidWagePerWorkerByRole: {},
                filledByRole: {},
                wagePaidRatioByOwner: {},
                ownerRevenue: 0,
                productionCosts: 0,
                businessTaxPaid: 0,
            };
        }

        let staffingRatio = 1.0;
        let totalSlots = 0;
        let filledSlots = 0;
        const roleExpectedWages = {};
        let expectedWageBillBase = 0;
        const wagePlans = [];
        const jobRequirements = buildingJobsRequired[b.id] || effectiveOps.jobs;
        // Each wage plan may include ownerKey so we can apply per-owner distribution ratios
        // when actually paying wages.
        if (Object.keys(jobRequirements).length > 0) {
            buildingJobFill[b.id] = buildingJobFill[b.id] || {};

            // [CRITICAL FIX] 使用瓶颈法则计算到岗率
            // 生产受限于最低的非业主角色填充率（工人是生产的瓶颈）
            // 业主可以管理但不能替代工人生产
            let minNonOwnerFillRate = Infinity;
            let hasNonOwnerRole = false;

            for (let role in jobRequirements) {
                const roleRequired = jobRequirements[role];
                if (!roleWageStats[role]) {
                    roleWageStats[role] = { totalSlots: 0, weightedWage: 0 };
                }
                totalSlots += roleRequired;
                const totalRoleJobs = jobsAvailable[role];
                const totalRolePop = popStructure[role];
                const fillRate = totalRoleJobs > 0 ? Math.min(1, totalRolePop / totalRoleJobs) : 0;
                const roleFilled = roleRequired * fillRate;
                filledSlots += roleFilled;
                buildingJobFill[b.id][role] = roleFilled;

                // Track filled workers for per-building wage averaging
                buildingFinancialData[b.id].filledByRole[role] =
                    (buildingFinancialData[b.id].filledByRole[role] || 0) + roleFilled;

                // [CRITICAL FIX] 对于非业主角色，追踪最低填充率作为生产瓶颈
                const isOwnerRole = Object.keys(ownerLevelGroups).includes(role);
                if (!isOwnerRole && roleRequired > 0) {
                    hasNonOwnerRole = true;
                    const roleFillRate = roleRequired > 0 ? roleFilled / roleRequired : 0;
                    minNonOwnerFillRate = Math.min(minNonOwnerFillRate, roleFillRate);
                }

                const vacancySlots = Math.max(0, roleRequired - roleFilled);
                if (vacancySlots > 1e-3) {
                    const availableSlots = vacancySlots >= 1 ? Math.floor(vacancySlots) : 1;
                    const vacancyList = roleVacancyTargets[role] || (roleVacancyTargets[role] = []);
                    vacancyList.push({
                        buildingId: b.id,
                        buildingName: b.name || b.id,
                        availableSlots,
                    });
                }
                if (!isOwnerRole && roleFilled > 0) {
                    const cached = roleExpectedWages[role] ?? getExpectedWage(role);
                    const livingFloor = getLivingCostFloor(role);
                    const adjustedWage = Math.max(cached, livingFloor);
                    roleExpectedWages[role] = adjustedWage;
                    expectedWageBillBase += roleFilled * adjustedWage;
                    wagePlans.push({
                        role,
                        ownerKey: b.owner || 'state',
                        roleSlots: roleRequired,
                        filled: roleFilled,
                        baseWage: adjustedWage,
                    });
                }
            }

            // [CRITICAL FIX] 到岗率计算使用瓶颈法则：
            // - 如果有非业主角色（工人），使用最低工人填充率作为生产上限
            // - 如果只有业主角色（如农场只有peasant），使用平均填充率
            if (hasNonOwnerRole) {
                // 有工人角色时，生产受最低工人填充率限制
                staffingRatio = minNonOwnerFillRate === Infinity ? 0 : minNonOwnerFillRate;
            } else if (totalSlots > 0) {
                // 只有业主角色时（自营建筑），使用普通平均
                staffingRatio = filledSlots / totalSlots;
            }

            if (totalSlots > 0) {
                buildingStaffingRatios[b.id] = staffingRatio;
            }
            // [FIX] REMOVED early return for empty buildings
            // We need to proceed to calculate POTENTIAL wage offers to attract workers
            // if (totalSlots > 0 && filledSlots <= 0) {
            //    return;
            // }
        }

        // Capture multiplier BEFORE staffing application for potential calculation
        const potentialMultiplierBeforeStaffing = multiplier;

        multiplier *= staffingRatio;

        if (forcedLabor && (b.jobs?.serf || b.jobs?.miner)) {
            multiplier *= 1.2;
        }

        const baseMultiplier = multiplier;
        // simBaseMultiplier: What production WOULD be if fully staffed (for stats/estimation)
        const simBaseMultiplier = baseMultiplier > 0 ? baseMultiplier : potentialMultiplierBeforeStaffing;

        let resourceLimit = 1;
        let inputCostPerMultiplier = 0;
        let isInLowEfficiencyMode = false;

        // === 应用生产成本修正（官员效果 + 政治立场效果） ===
        // 只对有 input 且有 output 的建筑生效（加工类建筑）
        const hasInput = Object.keys(effectiveOps.input).length > 0;
        const hasOutput = Object.keys(effectiveOps.output).some(k => k !== 'maxPop' && k !== 'militaryCapacity');
        if (hasInput && hasOutput) {
            // 合并官员效果和政治立场效果
            const officialInputCostMod = bonuses.officialProductionInputCost?.[b.id] || 0;
            const stanceInputCostMod = bonuses.stanceProductionInputCost?.[b.id] || 0;
            const totalInputCostMod = officialInputCostMod + stanceInputCostMod;

            // 应用修正：正值增加消耗，负值减少消耗
            if (totalInputCostMod !== 0) {
                const inputModMultiplier = 1 + totalInputCostMod;
                // 确保修正后的消耗不低于原始的 20%
                const safeMultiplier = Math.max(0.2, inputModMultiplier);
                for (const [resKey, amount] of Object.entries(effectiveOps.input)) {
                    effectiveOps.input[resKey] = amount * safeMultiplier;
                }
            }

            // 资源浪费：对投入资源增加额外消耗
            if (bonuses.resourceWaste) {
                for (const [resKey, amount] of Object.entries(effectiveOps.input)) {
                    const wasteMod = bonuses.resourceWaste?.[resKey] || 0;
                    if (!wasteMod) continue;
                    const wasteMultiplier = Math.max(0, 1 + wasteMod);
                    effectiveOps.input[resKey] = amount * wasteMultiplier;
                }
            }
        }

        if (Object.keys(effectiveOps.input).length > 0) {
            for (const [resKey, totalAmount] of Object.entries(effectiveOps.input)) {
                // Skip input requirement if resource is not unlocked yet (prevents early game deadlock)
                if (!isResourceUnlocked(resKey, epoch, techsUnlocked)) {
                    continue;
                }

                const perMultiplierAmount = totalAmount;
                // Use simBaseMultiplier to check if we COULD produce if staffed
                const requiredAtBase = perMultiplierAmount * simBaseMultiplier;
                if (requiredAtBase <= 0) continue;
                const available = res[resKey] || 0;
                if (available <= 0) {
                    resourceLimit = 0;
                } else {
                    resourceLimit = Math.min(resourceLimit, available / requiredAtBase);
                }
                if (isTradableResource(resKey)) {
                    const price = getPrice(resKey);
                    const taxRate = getResourceTaxRate(resKey); // Allow negative
                    inputCostPerMultiplier += perMultiplierAmount * price * (1 + taxRate);
                }
            }
        }

        // 防死锁机制：采集类建筑在缺少输入原料时进入低效模式
        let targetMultiplier = baseMultiplier * Math.max(0, Math.min(1, resourceLimit));
        // Potential target multiplier (if staffed)
        let simTargetMultiplier = simBaseMultiplier * Math.max(0, Math.min(1, resourceLimit));

        if (b.cat === 'gather' && resourceLimit === 0 && Object.keys(effectiveOps.input).length > 0) {
            // 进入低效模式：20%效率，不消耗原料
            targetMultiplier = baseMultiplier * 0.2;
            simTargetMultiplier = simBaseMultiplier * 0.2;
            isInLowEfficiencyMode = true;
            inputCostPerMultiplier = 0; // 低效模式下不消耗原料，因此成本为0

            // 添加日志提示（每个建筑类型只提示一次，避免刷屏）
            const inputNames = Object.keys(effectiveOps.input).map(k => RESOURCES[k]?.name || k).join('、');
            if (tick % 30 === 0) { // 每30个tick提示一次
                recordAggregatedLog(`?? ${b.name} 缺少 ${inputNames}，工人正在徒手作业（效率20%）`);
            }
        }

        let outputValuePerMultiplier = 0;
        let producesTradableOutput = false;
        if (Object.keys(effectiveOps.output).length > 0) {
            for (const [resKey, totalAmount] of Object.entries(effectiveOps.output)) {
                if (resKey === 'maxPop') continue;
                if (!isTradableResource(resKey)) continue;
                producesTradableOutput = true;
                const perMultiplierAmount = totalAmount;
                const grossValue = perMultiplierAmount * getPrice(resKey);
                // 修正：生产者只获得商品的基础市场价值，消费税或补贴发生在消费端
                // 之前的逻辑错误地认为生产者获得补贴，或承担税收
                const netValue = grossValue;
                outputValuePerMultiplier += netValue;
            }
        }

        const baseWageCostPerMultiplier = simBaseMultiplier > 0 ? expectedWageBillBase / simBaseMultiplier : expectedWageBillBase;
        // All estimates use SIMULATED/POTENTIAL multiplier to generate correct wage pressure signals
        const estimatedRevenue = outputValuePerMultiplier * simTargetMultiplier;
        const estimatedInputCost = inputCostPerMultiplier * simTargetMultiplier;
        const baseWageCost = baseWageCostPerMultiplier * simTargetMultiplier;
        const valueAvailableForLabor = Math.max(0, estimatedRevenue - estimatedInputCost);
        const wageCoverage = baseWageCost > 0 ? valueAvailableForLabor / baseWageCost : 1;
        const wagePressure = (() => {
            if (!Number.isFinite(wageCoverage)) return 1;
            if (wageCoverage >= 1) {
                return Math.min(3.0, 1 + (wageCoverage - 1) * 0.5);
            }
            return Math.max(0.65, 1 - (1 - wageCoverage) * 0.5);
        })();
        const wageCostPerMultiplier = baseWageCostPerMultiplier * wagePressure;
        const estimatedWageCost = wageCostPerMultiplier * simTargetMultiplier;

        // 预估营业税成本
        // 军事类建筑不收营业税
        // 居住类建筑（无owner且产出maxPop的civic建筑）不收营业税
        const isHousingBuilding = b.cat === 'civic' && !b.owner && b.output?.maxPop > 0;
        const isMilitaryBuilding = b.cat === 'military';
        // 营业税额 = 建筑基准税额 × 税率系数
        // businessTaxBase 默认为 0.1，税率系数由玩家设置（默认1）
        const businessTaxBase = b.businessTaxBase ?? 0.1;
        const businessTaxMultiplier = (isHousingBuilding || isMilitaryBuilding) ? 0 : getBusinessTaxRate(b.id);
        const businessTaxPerBuilding = businessTaxBase * businessTaxMultiplier;
        // Use simTargetMultiplier for estimate
        const estimatedBusinessTax = businessTaxPerBuilding * count * simTargetMultiplier;

        const totalOperatingCostPerMultiplier = inputCostPerMultiplier + wageCostPerMultiplier;
        // Actual multiplier tracks real production (0 if empty)
        let actualMultiplier = targetMultiplier;
        // Sim multiplier tracks potential production (full capacity)
        let simActualMultiplier = simTargetMultiplier;

        let debugMarginRatio = null;
        let debugData = null;

        // BUG FIX: 实际可支付的工资不能超过 (收入 - 原料成本)
        // 如果市场工资过高，建筑只会支付它能支付的部分，而不是削减产量
        // 这避免了工资通胀导致的产量崩溃
        const actualPayableWageCost = Math.min(estimatedWageCost, valueAvailableForLabor);
        // 计算实际每单位乘数的工资成本（用于affordableMultiplier计算）
        const actualWageCostPerMultiplier = targetMultiplier > 0 ? actualPayableWageCost / targetMultiplier : 0;
        // 实际运营成本 = 原料成本 + 实际可支付工资成本
        const actualOperatingCostPerMultiplier = inputCostPerMultiplier + actualWageCostPerMultiplier;

        if (producesTradableOutput) {

            // 将营业税计入总成本（正税增加成本，负税（补贴）减少成本）
            const estimatedCost = estimatedInputCost + actualPayableWageCost + estimatedBusinessTax;
            if (estimatedCost > 0 && estimatedRevenue <= 0) {
                actualMultiplier = 0;
                debugMarginRatio = 0;
            } else if (estimatedCost > 0 && estimatedRevenue < estimatedCost * 0.98) {
                const marginRatio = Math.max(0, Math.min(1, estimatedRevenue / estimatedCost));
                debugMarginRatio = marginRatio;
                actualMultiplier = targetMultiplier * marginRatio;
                simActualMultiplier = simTargetMultiplier * marginRatio;
            } else {
                debugMarginRatio = estimatedCost > 0 ? estimatedRevenue / estimatedCost : null;
            }
            // DEBUG: 存储调试数据到局部变量
            debugData = {
                baseMultiplier,
                resourceLimit,
                targetMultiplier,
                estimatedRevenue,
                estimatedInputCost,
                estimatedWageCost,
                actualPayableWageCost, // 新增：实际可支付的工资成本
                actualWageCostPerMultiplier, // 新增：实际每单位工资成本
                actualOperatingCostPerMultiplier, // 新增：实际运营成本
                estimatedBusinessTax,
                estimatedCost,
                marginRatio: debugMarginRatio,
                actualMultiplierAfterMargin: actualMultiplier,
                outputValuePerMultiplier,
                inputCostPerMultiplier,
                wageCostPerMultiplier,
                count,
                // Additional debug info for wage investigation
                expectedWageBillBase,
                baseWageCostPerMultiplier,
                wagePressure,
                baseWageCost,
                wageCoverage,
                valueAvailableForLabor,
                wagePlans,
            };
        }
        if (actualOperatingCostPerMultiplier > 0) {
            // 检查所有 owner 的财富是否足够支付运营成本
            // BUG FIX: 使用实际可支付的运营成本，而不是基于市场工资的成本
            let minAffordableMultiplier = Infinity;
            const ownerDetails = [];
            Object.entries(ownerLevelGroups).forEach(([oKey, group]) => {
                const ownerProportion = group.totalCount / count;
                const ownerOperatingCost = actualOperatingCostPerMultiplier * ownerProportion;
                const ownerCash = wealth[oKey] || 0;
                const ownerAffordable = ownerOperatingCost > 0 ? ownerCash / ownerOperatingCost : Infinity;
                minAffordableMultiplier = Math.min(minAffordableMultiplier, ownerAffordable);
                ownerDetails.push({ owner: oKey, proportion: ownerProportion, operatingCost: ownerOperatingCost, cash: ownerCash, affordable: ownerAffordable });
            });
            const affordableMultiplier = minAffordableMultiplier === Infinity ? targetMultiplier : minAffordableMultiplier;
            const simAffordableMultiplier = minAffordableMultiplier === Infinity ? simTargetMultiplier : minAffordableMultiplier;

            actualMultiplier = Math.min(actualMultiplier, Math.max(0, affordableMultiplier));
            simActualMultiplier = Math.min(simActualMultiplier, Math.max(0, simAffordableMultiplier));
            // DEBUG: 更新调试数据
            if (debugData) {
                debugData.totalOperatingCostPerMultiplier = totalOperatingCostPerMultiplier;
                debugData.minAffordableMultiplier = minAffordableMultiplier;
                debugData.affordableMultiplier = affordableMultiplier;
                debugData.actualMultiplierAfterAffordable = actualMultiplier;
                debugData.ownerDetails = ownerDetails;
            }
        }
        // 存储调试数据到 buildingDebugData
        if (debugData) {
            buildingDebugData[b.id] = debugData;
        }

        if (!Number.isFinite(actualMultiplier) || actualMultiplier < 0) {
            actualMultiplier = 0;
        }

        const zeroApprovalFactor = 0.3;
        let approvalMultiplier = 1;
        // 检查所有 owner 的满意度
        Object.keys(ownerLevelGroups).forEach(oKey => {
            if (zeroApprovalClasses[oKey]) {
                approvalMultiplier = Math.min(approvalMultiplier, zeroApprovalFactor);
            }
        });
        if (Object.keys(jobRequirements).length > 0) {
            Object.keys(jobRequirements).forEach(role => {
                if (zeroApprovalClasses[role]) {
                    approvalMultiplier = Math.min(approvalMultiplier, zeroApprovalFactor);
                }
            });
        }
        actualMultiplier *= approvalMultiplier;
        simActualMultiplier *= approvalMultiplier;

        const utilization = baseMultiplier > 0 ? Math.min(1, actualMultiplier / baseMultiplier) : 0;
        // Sim utilization is what drives the wage OFFER signal
        const simUtilization = simBaseMultiplier > 0 ? Math.min(1, simActualMultiplier / simBaseMultiplier) : 0;

        // [UI同步] 将实际产出效率和减产原因存入buildingFinancialData，供UI显示
        buildingFinancialData[b.id].actualMultiplier = actualMultiplier;
        buildingFinancialData[b.id].targetMultiplier = targetMultiplier;
        buildingFinancialData[b.id].baseMultiplier = baseMultiplier;
        buildingFinancialData[b.id].productionEfficiency = targetMultiplier > 0 ? actualMultiplier / targetMultiplier : 0;
        // 记录减产原因
        const reductionReasons = [];
        if (baseMultiplier < 1 && staffingRatio < 1) {
            reductionReasons.push({ type: 'staffing', label: '人员不足', factor: staffingRatio });
        }
        if (resourceLimit < 1) {
            reductionReasons.push({ type: 'resource', label: '原料不足', factor: resourceLimit });
        }
        if (debugMarginRatio !== null && debugMarginRatio < 1) {
            reductionReasons.push({ type: 'margin', label: '利润不足', factor: debugMarginRatio });
        }
        if (debugData?.affordableMultiplier !== undefined && debugData.affordableMultiplier < targetMultiplier) {
            reductionReasons.push({ type: 'cashflow', label: '现金流不足', factor: debugData.affordableMultiplier / targetMultiplier });
        }
        if (approvalMultiplier < 1) {
            reductionReasons.push({ type: 'approval', label: '满意度过低', factor: approvalMultiplier });
        }
        buildingFinancialData[b.id].reductionReasons = reductionReasons;

        let plannedWageBill = 0;

        // 低效模式下不消耗输入原料（徒手采集）
        if (Object.keys(effectiveOps.input).length > 0 && !isInLowEfficiencyMode) {
            // === 按等级精确计算每个等级的资源需求 ===
            // 构建 levelInputNeeds: { lvl: { resKey: amount } }
            const levelInputNeeds = {};
            Object.entries(levelCounts).forEach(([lvlStr, lvlCount]) => {
                if (lvlCount <= 0) return;
                const lvl = parseInt(lvlStr);
                const config = getBuildingEffectiveConfig(b, lvl);
                if (!config.input || Object.keys(config.input).length === 0) return;
                levelInputNeeds[lvl] = {};
                Object.entries(config.input).forEach(([resKey, perBuildingAmount]) => {
                    // 该等级的总需求 = 单建筑需求 × 建筑数量 × 实际效率
                    levelInputNeeds[lvl][resKey] = perBuildingAmount * lvlCount * actualMultiplier;
                });
            });

            // 遍历每个资源，按等级比例分配实际消费量
            for (const [resKey, totalAmount] of Object.entries(effectiveOps.input)) {
                if (!isResourceUnlocked(resKey, epoch, techsUnlocked)) continue;

                const amountNeeded = totalAmount * actualMultiplier;
                if (!amountNeeded || amountNeeded <= 0) continue;
                const available = res[resKey] || 0;
                const consumed = Math.min(amountNeeded, available);
                const consumeRatio = amountNeeded > 0 ? consumed / amountNeeded : 0;

                if (isTradableResource(resKey)) {
                    const price = getPrice(resKey);
                    const taxRate = getResourceTaxRate(resKey);

                    // === 按等级精确分配成本 ===
                    Object.entries(levelInputNeeds).forEach(([lvlStr, resNeeds]) => {
                        const lvl = parseInt(lvlStr);
                        const levelNeed = resNeeds[resKey] || 0;
                        if (levelNeed <= 0) return;

                        // 该等级实际消费量 = 需求量 × 消费比例
                        const levelConsumed = levelNeed * consumeRatio;
                        if (levelConsumed <= 0) return;

                        const config = getBuildingEffectiveConfig(b, lvl);
                        const ownerKey = config.owner || 'state';

                        const baseCost = levelConsumed * price;
                        const taxPaid = baseCost * taxRate;
                        let totalCost = baseCost;

                        if (taxPaid < 0) {
                            const subsidyAmount = Math.abs(taxPaid);
                            if ((res.silver || 0) >= subsidyAmount) {
                                ledger.transfer('state', ownerKey, subsidyAmount, TRANSACTION_CATEGORIES.INCOME.SUBSIDY, TRANSACTION_CATEGORIES.INCOME.SUBSIDY);
                                totalCost -= subsidyAmount;
                                roleWagePayout[ownerKey] = (roleWagePayout[ownerKey] || 0) + subsidyAmount;
                            }
                        } else if (taxPaid > 0) {
                            ledger.transfer(ownerKey, 'state', taxPaid, TRANSACTION_CATEGORIES.EXPENSE.RESOURCE_TAX, TRANSACTION_CATEGORIES.EXPENSE.RESOURCE_TAX);
                            totalCost += taxPaid;
                        }

                        // Pay base cost
                        ledger.transfer(ownerKey, 'void', baseCost, TRANSACTION_CATEGORIES.EXPENSE.PRODUCTION_COST, TRANSACTION_CATEGORIES.EXPENSE.PRODUCTION_COST, { buildingId: b.id });
                        roleExpense[ownerKey] = (roleExpense[ownerKey] || 0) + totalCost;

                        // Per-building realized production input costs (manual update for building stats if ledger doesn't support aggregate yet)
                        buildingFinancialData[b.id].productionCosts += totalCost;
                    });

                    demand[resKey] = (demand[resKey] || 0) + consumed;
                    if (!demandBreakdown[resKey]) demandBreakdown[resKey] = { buildings: {}, pop: 0 };
                    demandBreakdown[resKey].buildings[b.id] = (demandBreakdown[resKey].buildings[b.id] || 0) + consumed;
                }
                if (consumed <= 0) continue;
                res[resKey] = available - consumed;
                rates[resKey] = (rates[resKey] || 0) - consumed;
            }
        }

        if (Object.keys(jobRequirements).length > 0) {
            Object.entries(jobRequirements).forEach(([role, totalAmount]) => {
                const roleSlots = totalAmount;
                if (roleSlots <= 0) return;
                if (!roleWageStats[role]) {
                    roleWageStats[role] = { totalSlots: 0, weightedWage: 0 };
                }
                roleWageStats[role].totalSlots += roleSlots;
            });
        }

        // === 按等级分别计算工资压力因子 ===
        // 每个等级可能有不同的产出价值，因此 wagePressure 应该不同
        const levelWagePressures = {};
        Object.entries(levelCounts).forEach(([lvlStr, lvlCount]) => {
            const lvl = parseInt(lvlStr);
            const config = getBuildingEffectiveConfig(b, lvl);

            // 计算该等级的产出价值
            let levelOutputValue = 0;
            if (config.output) {
                Object.entries(config.output).forEach(([resKey, amount]) => {
                    if (resKey === 'maxPop') return;
                    if (!isTradableResource(resKey)) return;
                    const perBuildingAmount = amount;
                    const grossValue = perBuildingAmount * getPrice(resKey);
                    // 修正：生产者只获得商品的基础市场价值
                    levelOutputValue += grossValue;
                });
            }

            // 计算该等级的输入成本
            let levelInputCost = 0;
            if (config.input) {
                Object.entries(config.input).forEach(([resKey, amount]) => {
                    if (!isResourceUnlocked(resKey, epoch, techsUnlocked)) return;
                    if (isTradableResource(resKey)) {
                        levelInputCost += amount * getPrice(resKey);
                    }
                });
            }

            // 计算该等级的工资成本（使用基础工资估算）
            let levelWageCost = 0;
            const levelOwnerKey = config.owner || 'state';
            if (config.jobs) {
                Object.entries(config.jobs).forEach(([role, slots]) => {
                    if (role === levelOwnerKey) return;
                    const wage = roleExpectedWages[role] ?? getExpectedWage(role);
                    levelWageCost += slots * wage;
                });
            }

            // 计算该等级的工资压力因子
            const valueAvailable = Math.max(0, levelOutputValue - levelInputCost);
            const coverage = levelWageCost > 0 ? valueAvailable / levelWageCost : 1;
            let levelWagePressure = 1;
            if (!Number.isFinite(coverage)) {
                levelWagePressure = 1;
            } else if (coverage >= 1) {
                levelWagePressure = Math.min(3.0, 1 + (coverage - 1) * 0.5);
            } else {
                levelWagePressure = Math.max(0.65, 1 - (1 - coverage) * 0.5);
            }
            levelWagePressures[lvl] = levelWagePressure;
        });

        // 计算整体加权平均的 wagePressure（用于向后兼容）
        let totalWeightedPressure = 0;
        let totalWeight = 0;
        Object.entries(levelCounts).forEach(([lvlStr, lvlCount]) => {
            const lvl = parseInt(lvlStr);
            const pressure = levelWagePressures[lvl] || 1;
            totalWeightedPressure += pressure * lvlCount;
            totalWeight += lvlCount;
        });
        const avgWagePressure = totalWeight > 0 ? totalWeightedPressure / totalWeight : wagePressure;


        // Get building's wage config for max wage multiplier
        const buildingWageConfig = b.marketConfig?.wage || {};
        const wageMode = buildingWageConfig.wageMode;
        const subsistenceMultiplier = buildingWageConfig.subsistenceMultiplier || 1.5;

        const preparedWagePlans = wagePlans.map(plan => {
            // ownerKey is required for per-building wage distribution payment.
            // Prefer plan.ownerKey if already provided; fallback to building's default owner.
            const planOwnerKey = plan.ownerKey || b.owner || 'state';

            // 根据角色在各等级的分布，计算加权平均的工资压力因子
            let planWagePressure = avgWagePressure;

            // 如果有多个等级，按比例计算该角色的平均工资压力
            if (Object.keys(levelCounts).length > 1) {
                let roleWeightedPressure = 0;
                let roleWeight = 0;
                Object.entries(levelCounts).forEach(([lvlStr, lvlCount]) => {
                    const lvl = parseInt(lvlStr);
                    const config = getBuildingEffectiveConfig(b, lvl);
                    const roleSlots = config.jobs?.[plan.role] || 0;
                    if (roleSlots > 0) {
                        const pressure = levelWagePressures[lvl] || 1;
                        roleWeightedPressure += pressure * roleSlots * lvlCount;
                        roleWeight += roleSlots * lvlCount;
                    }
                });
                if (roleWeight > 0) {
                    planWagePressure = roleWeightedPressure / roleWeight;
                }
            }

            let expectedSlotWage = plan.baseWage * utilization * planWagePressure;

            // NEW: Subsistence wage mode - wage is based on living costs, not market wages
            // This prevents the runaway wage inflation/deflation feedback loop
            if (wageMode === 'subsistence') {
                // Get the role's living cost as the wage base
                const roleLivingCost = wageLivingCosts?.[plan.role] || getLivingCostFloor(plan.role);
                // Wage = living cost × multiplier (e.g., 1.5 = subsistence + 50% buffer)
                // This is a FIXED wage based on actual needs, not market dynamics
                expectedSlotWage = roleLivingCost * subsistenceMultiplier;
            }

            const due = expectedSlotWage * plan.filled;
            plannedWageBill += due;
            return {
                ...plan,
                ownerKey: planOwnerKey,
                expectedSlotWage,
                wagePressure: planWagePressure, // 保存用于调试
                wageMode, // Track for debugging
                subsistenceMultiplier: wageMode === 'subsistence' ? subsistenceMultiplier : undefined,
            };
        });

        // Wage payment must follow EACH building's actual wage distribution level.
        // Previously we computed a global wageRatio pooled by owners which could desync from
        // building-level payout displays and create runaway wage bills.
        const ownerPaidRatio = {}; // { ownerKey: paid / bill }

        // Keep a copy for UI debug/inspection
        buildingFinancialData[b.id].wagePaidRatioByOwner = ownerPaidRatio;

        if (plannedWageBill > 0) {
            // === 按等级精确计算每个 owner 的工资责任 ===
            // 构建 ownerWageBills: { ownerKey: totalWageBill }
            const ownerWageBills = {};
            Object.entries(levelCounts).forEach(([lvlStr, lvlCount]) => {
                if (lvlCount <= 0) return;
                const lvl = parseInt(lvlStr);
                const config = getBuildingEffectiveConfig(b, lvl);
                const ownerKey = config.owner || 'state';
                if (!ownerWageBills[ownerKey]) ownerWageBills[ownerKey] = 0;

                // 计算该等级的工资成本
                if (config.jobs) {
                    Object.entries(config.jobs).forEach(([role, slots]) => {
                        // 跳过业主角色
                        if (role === ownerKey) return;

                        let wage;
                        // Subsistence wage mode - use fixed living-cost based wages
                        if (wageMode === 'subsistence') {
                            const roleLivingCost = wageLivingCosts?.[role] || getLivingCostFloor(role);
                            wage = roleLivingCost * subsistenceMultiplier;
                        } else {
                            // Default: use market-based expected wage
                            wage = getExpectedWage(role);
                        }

                        const levelWageCost = slots * lvlCount * wage * utilization * (levelWagePressures[lvl] || 1);
                        ownerWageBills[ownerKey] += levelWageCost;
                    });
                }
            });

            // 按每个 owner 的实际工资责任支付（并记录每个 owner 的支付比例）
            Object.entries(ownerWageBills).forEach(([oKey, ownerBill]) => {
                if (ownerBill <= 0) {
                    ownerPaidRatio[oKey] = 0;
                    return;
                }
                const available = wealth[oKey] || 0;

                // Prioritize owner's own basic needs before paying wages
                let reservedWealth = 0;
                const ownerDef = STRATA[oKey];
                if (ownerDef && ownerDef.needs) {
                    Object.entries(ownerDef.needs).forEach(([resKey, amount]) => {
                        const price = getPrice(resKey);
                        reservedWealth += amount * price;
                    });
                    reservedWealth *= 1.2;
                }

                const disposableWealth = Math.max(0, available - reservedWealth);
                const paid = Math.min(disposableWealth, ownerBill);

                ledger.transfer(oKey, 'void', paid, TRANSACTION_CATEGORIES.EXPENSE.WAGES_PAID, TRANSACTION_CATEGORIES.EXPENSE.WAGES_PAID, { buildingId: b.id });
                roleExpense[oKey] = (roleExpense[oKey] || 0) + paid;

                ownerPaidRatio[oKey] = ownerBill > 0 ? paid / ownerBill : 0;
            });
        }

        // Pay wages following building-level "distribution" (owner-paid-ratio).
        // Also update wage stats by the ACTUAL average wage paid for this role.
        preparedWagePlans.forEach(plan => {
            const ratio = ownerPaidRatio[plan.ownerKey] ?? 0;
            const actualSlotWage = plan.expectedSlotWage * ratio;

            // Stats: use SIMULATED utilization to ensure empty buildings broadcast their wage ability
            // If utilizing actualSlotWage, it would be 0 for empty buildings
            const statSlotWage = plan.baseWage * simUtilization * plan.wagePressure;
            roleWageStats[plan.role].weightedWage += statSlotWage * plan.roleSlots;

            if (plan.filled > 0 && actualSlotWage > 0) {
                const payout = actualSlotWage * plan.filled;

                // Per-building wage totals (for UI)
                buildingFinancialData[b.id].wagesByRole[plan.role] =
                    (buildingFinancialData[b.id].wagesByRole[plan.role] || 0) + payout;

                // 使用 Ledger 发放工资
                ledger.transfer('void', plan.role, payout, TRANSACTION_CATEGORIES.INCOME.WAGE, TRANSACTION_CATEGORIES.INCOME.WAGE, { buildingId: b.id });

                roleWagePayout[plan.role] = (roleWagePayout[plan.role] || 0) + payout;
                roleLaborIncome[plan.role] = (roleLaborIncome[plan.role] || 0) + payout; // Wages are labor income
            }
        });

        // Compute avg paid wage per filled worker for UI
        Object.entries(buildingFinancialData[b.id].wagesByRole).forEach(([role, totalPaid]) => {
            const filled = buildingFinancialData[b.id].filledByRole[role] || 0;
            if (filled > 0) {
                buildingFinancialData[b.id].paidWagePerWorkerByRole[role] = totalPaid / filled;
            }
        });

        if (Object.keys(effectiveOps.output).length > 0) {
            // === 按等级精确计算产出收入分配 ===
            // 构建 levelOutputAmounts: { lvl: { resKey: amount } }
            const levelOutputAmounts = {};
            Object.entries(levelCounts).forEach(([lvlStr, lvlCount]) => {
                if (lvlCount <= 0) return;
                const lvl = parseInt(lvlStr);
                const config = getBuildingEffectiveConfig(b, lvl);
                if (!config.output || Object.keys(config.output).length === 0) return;
                levelOutputAmounts[lvl] = {};
                Object.entries(config.output).forEach(([resKey, perBuildingAmount]) => {
                    levelOutputAmounts[lvl][resKey] = perBuildingAmount * lvlCount * actualMultiplier;
                });
            });

            for (const [resKey, totalAmount] of Object.entries(effectiveOps.output)) {
                let amount = totalAmount * actualMultiplier;
                if (!amount || amount <= 0) continue;

                // 为可交易资源添加产出浮动（80%-120%）
                let variationFactor = 1;
                if (isTradableResource(resKey) && resKey !== 'silver') {
                    const resourceDef = RESOURCES[resKey];
                    const resourceMarketConfig = resourceDef?.marketConfig || {};
                    const defaultMarketInfluence = ECONOMIC_INFLUENCE?.market || {};
                    const outputVariation = resourceMarketConfig.outputVariation !== undefined
                        ? resourceMarketConfig.outputVariation
                        : (defaultMarketInfluence.outputVariation || 0.2);

                    variationFactor = 1 + (Math.random() * 2 - 1) * outputVariation;
                    amount *= variationFactor;

                    const supplyMod = decreeResourceSupplyMod[resKey] || 0;
                    if (supplyMod !== 0) {
                        amount *= (1 + supplyMod);
                    }

                    if (resKey === 'science' && bonuses.scienceBonus) {
                        amount *= (1 + bonuses.scienceBonus);
                    }
                    if (resKey === 'culture' && bonuses.cultureBonus) {
                        amount *= (1 + bonuses.cultureBonus);
                    }
                }

                if (resKey === 'maxPop') continue;
                if (isTradableResource(resKey)) {
                    // === 按等级精确分配产出收入 ===
                    Object.entries(levelOutputAmounts).forEach(([lvlStr, resOutputs]) => {
                        const lvl = parseInt(lvlStr);
                        const levelBaseOutput = resOutputs[resKey] || 0;
                        if (levelBaseOutput <= 0) return;

                        // 该等级实际产出 = 基础产出 × 浮动因子 × 各种加成
                        // 计算该等级占总产出的比例
                        const baseTotal = totalAmount * actualMultiplier;
                        const proportion = baseTotal > 0 ? levelBaseOutput / baseTotal : 0;
                        const levelAmount = amount * proportion;

                        if (levelAmount <= 0) return;

                        const config = getBuildingEffectiveConfig(b, lvl);
                        const ownerKey = config.owner || 'state';
                        currentBuildingId = b.id;
                        sellProduction(resKey, levelAmount, ownerKey);
                        currentBuildingId = null;
                    });

                    rates[resKey] = (rates[resKey] || 0) + amount;
                    if (!supplyBreakdown[resKey]) supplyBreakdown[resKey] = { buildings: {}, imports: 0 };
                    supplyBreakdown[resKey].buildings[b.id] = (supplyBreakdown[resKey].buildings[b.id] || 0) + amount;
                } else {
                    if (resKey === 'silver') {
                        // [FIX] 银币产出需要按 owner 分配，不能直接全额进国库
                        Object.entries(levelOutputAmounts).forEach(([lvlStr, resOutputs]) => {
                            const lvl = parseInt(lvlStr);
                            const levelBaseOutput = resOutputs[resKey] || 0;
                            if (levelBaseOutput <= 0) return;

                            // 计算该等级(即该owner)应得的份额
                            const baseTotal = totalAmount * actualMultiplier;
                            const proportion = baseTotal > 0 ? levelBaseOutput / baseTotal : 0;
                            const levelAmount = amount * proportion;

                            if (levelAmount <= 0) return;

                            const config = getBuildingEffectiveConfig(b, lvl);
                            const ownerKey = config.owner || 'state';

                            if (ownerKey === 'state') {
                                applyResourceChange(resKey, levelAmount, 'building_production_direct');
                            } else {
                                // 私有建筑产出的银币直接进入业主口袋
                                ledger.transfer('void', ownerKey, levelAmount, 'building_production_direct', 'building_production_direct', { buildingId: b.id });
                            }
                        });
                    } else {
                        applyResourceChange(resKey, amount, 'building_production_direct');
                    }
                }
            }
        }

        // 营业税收取：每次建筑产出时收取固定银币值
        // businessTaxPerBuilding 已在上面声明，直接使用
        // [FIX] 营业税应该根据实际到岗率征收，空置建筑不应产生营业税
        // 使用 staffingRatio 确保只对有工人的建筑征税
        if (businessTaxPerBuilding !== 0 && count > 0) {
            const effectiveStaffingRatio = staffingRatio || 0;
            const totalBusinessTax = businessTaxPerBuilding * count * effectiveStaffingRatio;

            if (totalBusinessTax > 0) {
                // 正值：按 owner 比例收税
                Object.entries(ownerLevelGroups).forEach(([oKey, group]) => {
                    const proportion = group.totalCount / count;
                    const ownerTax = totalBusinessTax * proportion;
                    const ownerWealth = wealth[oKey] || 0;
                    if (ownerWealth >= ownerTax) {
                        ledger.transfer(oKey, 'state', ownerTax, TRANSACTION_CATEGORIES.EXPENSE.BUSINESS_TAX, TRANSACTION_CATEGORIES.EXPENSE.BUSINESS_TAX, { buildingId: b.id });
                        roleBusinessTaxPaid[oKey] = (roleBusinessTaxPaid[oKey] || 0) + ownerTax;
                        roleExpense[oKey] = (roleExpense[oKey] || 0) + ownerTax;
                    } else if (tick % 30 === 0 && ownerWealth < ownerTax * 0.5) {
                        recordAggregatedLog(`?? ${STRATA[oKey]?.name || oKey} 无力支付 ${b.name} 的营业税，政府放弃征收。`);
                    }
                });
                // taxBreakdown 由 Ledger 自动更新
            } else if (totalBusinessTax < 0) {
                // 负值：按 owner 比例发放补贴
                const subsidyAmount = Math.abs(totalBusinessTax);
                const treasury = res.silver || 0;
                if (treasury >= subsidyAmount) {
                    Object.entries(ownerLevelGroups).forEach(([oKey, group]) => {
                        const proportion = group.totalCount / count;
                        const ownerSubsidy = subsidyAmount * proportion;
                        ledger.transfer('state', oKey, ownerSubsidy, TRANSACTION_CATEGORIES.INCOME.SUBSIDY, TRANSACTION_CATEGORIES.INCOME.SUBSIDY);
                        roleWagePayout[oKey] = (roleWagePayout[oKey] || 0) + ownerSubsidy;
                    });
                } else {
                    if (tick % 30 === 0) {
                        recordAggregatedLog(`?? 国库空虚，无法为 ${b.name} 支付营业补贴！`);
                    }
                }
            }
        }

        if (b.id === 'market') {
            const marketOwnerKey = b.owner || 'merchant';
            const hasMerchants = (popStructure[marketOwnerKey] || 0) > 0;
            const canTradeThisTick = tick % 5 === 0;
            if (hasMerchants && canTradeThisTick) {
                const merchantWealth = wealth[marketOwnerKey] || 0;
                let availableMerchantWealth = merchantWealth;
                if (availableMerchantWealth <= 0) {
                    // 没有可用于贸易的资金
                } else {
                    const surpluses = [];
                    Object.entries(res).forEach(([resKey, amount]) => {
                        if (!isTradableResource(resKey) || resKey === 'silver') return;
                        if ((amount || 0) <= 300) return;
                        if ((rates[resKey] || 0) < 0) return;

                        const localPrice = getPrice(resKey);
                        surpluses.push({ resource: resKey, stock: amount, localPrice });
                    });

                    if (surpluses.length > 0) {
                        const shortageTargets = [];
                        Object.keys(RESOURCES).forEach(resourceKey => {
                            if (!isTradableResource(resourceKey) || resourceKey === 'silver') return;
                            const stock = res[resourceKey] || 0;
                            const netRate = rates[resourceKey] || 0;
                            const demandGap = Math.max(0, (demand[resourceKey] || 0) - (supply[resourceKey] || 0));
                            const stockGap = Math.max(0, 200 - stock);
                            const netDeficit = netRate < 0 ? Math.abs(netRate) : 0;
                            const shortageAmount = Math.max(demandGap, stockGap, netDeficit);
                            if (shortageAmount <= 0) return;
                            const importPrice = Math.max(PRICE_FLOOR, getPrice(resourceKey) * 1.15);
                            const requiredValue = shortageAmount * importPrice;
                            if (requiredValue <= 0) return;
                            shortageTargets.push({ resource: resourceKey, shortageAmount, importPrice, requiredValue });
                        });

                        if (shortageTargets.length > 0) {
                            shortageTargets.sort((a, b) => b.requiredValue - a.requiredValue);
                            const logThreshold = 10;

                            shortageTargets.forEach(target => {
                                if (availableMerchantWealth <= 0) return;
                                let remainingAmount = target.shortageAmount;
                                let remainingValue = target.requiredValue;

                                for (const surplus of surpluses) {
                                    if (availableMerchantWealth <= 0) break;
                                    if (remainingAmount <= 0 || remainingValue <= 0) break;

                                    const sourceResource = surplus.resource;
                                    const sourcePrice = surplus.localPrice;
                                    if (sourcePrice <= 0) continue;
                                    const currentStock = res[sourceResource] || 0;
                                    if (currentStock <= 0) continue;

                                    const demandLimit = remainingValue / sourcePrice;
                                    const inventoryLimit = currentStock * 0.05;
                                    const wealthLimit = availableMerchantWealth / sourcePrice;
                                    const exportAmount = Math.min(demandLimit, inventoryLimit, wealthLimit);
                                    if (!Number.isFinite(exportAmount) || exportAmount <= 0) continue;

                                    const exportValue = exportAmount * sourcePrice;
                                    availableMerchantWealth -= exportValue;
                                    ledger.transfer(marketOwnerKey, 'void', exportValue, TRANSACTION_CATEGORIES.EXPENSE.TRADE_EXPORT_PURCHASE, TRANSACTION_CATEGORIES.EXPENSE.TRADE_EXPORT_PURCHASE);
                                    roleExpense[marketOwnerKey] = (roleExpense[marketOwnerKey] || 0) + exportValue;

                                    applyResourceChange(sourceResource, -exportAmount, 'trade_export_deduction');
                                    supply[sourceResource] = (supply[sourceResource] || 0) + exportAmount;
                                    rates[sourceResource] = (rates[sourceResource] || 0) - exportAmount;
                                    surplus.stock = Math.max(0, surplus.stock - exportAmount);
                                    remainingValue = Math.max(0, remainingValue - exportValue);

                                    // NEW: Track export demand (resource consumed by trade)
                                    if (!demandBreakdown[sourceResource]) demandBreakdown[sourceResource] = { buildings: {}, pop: 0, exports: 0 };
                                    demandBreakdown[sourceResource].exports = (demandBreakdown[sourceResource].exports || 0) + exportAmount;

                                    if (target.importPrice <= 0) continue;
                                    let importAmount = exportValue / target.importPrice;
                                    if (!Number.isFinite(importAmount) || importAmount <= 0) continue;
                                    importAmount = Math.min(importAmount, remainingAmount);
                                    if (importAmount <= 0) continue;

                                    const importCost = importAmount * target.importPrice;
                                    ledger.transfer('void', marketOwnerKey, importCost, TRANSACTION_CATEGORIES.INCOME.TRADE_IMPORT_REVENUE, TRANSACTION_CATEGORIES.INCOME.TRADE_IMPORT_REVENUE);
                                    availableMerchantWealth += importCost;

                                    applyResourceChange(target.resource, importAmount, 'trade_import_gain');
                                    supply[target.resource] = (supply[target.resource] || 0) + importAmount;
                                    rates[target.resource] = (rates[target.resource] || 0) + importAmount;

                                    // NEW: Track import supply
                                    if (!supplyBreakdown[target.resource]) supplyBreakdown[target.resource] = { buildings: {}, imports: 0 };
                                    supplyBreakdown[target.resource].imports = (supplyBreakdown[target.resource].imports || 0) + importAmount;

                                    remainingAmount = Math.max(0, remainingAmount - importAmount);

                                    // Record full import revenue as income, not just profit
                                    // This ensures income - expense = wealth change
                                    if (importCost > 0) {
                                        directIncomeApplied[marketOwnerKey] = (directIncomeApplied[marketOwnerKey] || 0) + importCost;
                                        roleWagePayout[marketOwnerKey] = (roleWagePayout[marketOwnerKey] || 0) + importCost;
                                    }

                                    if (importCost > logThreshold) {
                                        const fromName = RESOURCES[sourceResource]?.name || sourceResource;
                                        const toName = RESOURCES[target.resource]?.name || target.resource;
                                        // logs.push(`?? 市场：商人动用自有资金 ${exportValue.toFixed(1)} 银币购入 ${exportAmount.toFixed(1)} ${fromName}，换回 ${importAmount.toFixed(1)} ${toName}。`);
                                    }
                                }
                            });
                        }
                    }
                }
            }
        }

        // NOTE: 工资支付已在 produceBuilding 的 preparedWagePlans.forEach 中处理
        // 这里只需要统计总岗位数，不能重复支付工资（之前的 BUG）
        if (b.jobs) {
            Object.entries(b.jobs).forEach(([role, perBuilding]) => {
                const roleSlots = perBuilding * count;
                if (roleSlots <= 0) return;
                // 只统计岗位数，不再重复支付工资
                // roleWageStats[role].totalSlots 已在 produceBuilding 中更新
            });
        }
    });
    perfEnd('headTax');
    perfEnd('passiveGains');
    perfEnd('productionLoop');

    // === 新军费计算系统 ===
    const hasArmyUnits = army && Object.values(army).some(count => count > 0);
    const hasArmyQueue = Array.isArray(militaryQueue) && militaryQueue.some(item => item.status === 'waiting' || item.status === 'training');
    const epochMultiplier = 1 + epoch * 0.1;
    const effectiveWageMultiplier = Math.max(0.5, militaryWageRatio ?? 1);
    let armyExpenseResult = {
        dailyExpense: 0,
        resourceCost: 0,
        epochMultiplier,
        scalePenalty: 1,
        wageMultiplier: effectiveWageMultiplier,
        resourceConsumption: {},
    };

    let militaryDebug = {
        totalArmyCost: 0,
        availableSilver: res.silver,
        applied: false,
        reason: null,
        logSizeBefore: silverChangeLog.length
    };

    if (hasArmyUnits || hasArmyQueue) {
        // 1. 获取军队资源维护需求
        const armyMaintenanceMultiplier = getArmyMaintenanceMultiplier(difficulty);
        const baseArmyMaintenance = calculateArmyMaintenance(army);
        // Apply difficulty multiplier
        Object.keys(baseArmyMaintenance).forEach(key => {
            baseArmyMaintenance[key] = Math.ceil((baseArmyMaintenance[key] || 0) * armyMaintenanceMultiplier);
        });

        // Apply wartime multiplier: 3x army maintenance during war
        const armyMaintenance = {};
        Object.entries(baseArmyMaintenance).forEach(([resource, amount]) => {
            armyMaintenance[resource] = isPlayerAtWar ? amount * WAR_MILITARY_MULTIPLIER : amount;
        });

        // 2. 从市场购买维护资源（消耗资源、增加需求）
        let totalResourceCost = 0;
        const armyResourceConsumption = {};

        Object.entries(armyMaintenance).forEach(([resource, needed]) => {
            if (needed <= 0) return;
            if (resource === 'silver') {
                // 银币直接计入成本
                totalResourceCost += needed;
                return;
            }

            // 从市场购买：消耗库存资源
            const available = res[resource] || 0;
            const consumed = Math.min(available, needed);

            if (consumed > 0) {
                res[resource] = available - consumed;
                rates[resource] = (rates[resource] || 0) - consumed;
                armyResourceConsumption[resource] = consumed;

                // 增加市场需求（影响价格）
                demand[resource] = (demand[resource] || 0) + needed;
            }

            // Use price controls (planned economy) for maintenance resource pricing as well.
            // This prevents the player from paying market-price upkeep while also enforcing guided prices elsewhere.
            // NOTE: For upkeep we treat it as a "government purchase" (the army consumes goods),
            // so we apply the BUY-side price control (government sell price to the buyer).
            const marketPrice = getPrice(resource);
            let effectivePrice = marketPrice;
            if (priceControls?.enabled) {
                const pcResult = applyBuyPriceControl({
                    resourceKey: resource,
                    amount: needed,
                    marketPrice,
                    priceControls,
                    taxBreakdown,
                    resources: res,
                    onTreasuryChange: trackSilverChange,
                });
                effectivePrice = pcResult.effectivePrice;
            }
            totalResourceCost += needed * effectivePrice;

            // 如果资源不足，记录日志
            if (consumed < needed && tick % 30 === 0) {
                const shortage = needed - consumed;
                recordAggregatedLog(`?? 军队维护资源不足：缺少 ${RESOURCES[resource]?.name || resource} ${shortage.toFixed(1)}/日`);
            }
        });

        perfStart('armyMaintenance');
        // 3. 计算时代加成和规模惩罚
        const armyPopulation = calculateArmyPopulation(army);
        const scalePenalty = calculateArmyScalePenalty(armyPopulation, population);

        // 4. 总军费 = 资源成本 × 时代加成 × 规模惩罚 × 军饷倍率
        const totalArmyCost = totalResourceCost * epochMultiplier * scalePenalty * effectiveWageMultiplier;

        // 记录军费数据（用于战争赔款计算）
        armyExpenseResult = {
            dailyExpense: totalArmyCost,
            resourceCost: totalResourceCost,
            epochMultiplier,
            scalePenalty,
            wageMultiplier: effectiveWageMultiplier,
            resourceConsumption: armyResourceConsumption
        };

        // [DEBUG] Military Logic Inspection
        militaryDebug = {
            totalArmyCost,
            availableSilver: res.silver,
            applied: false,
            reason: null,
            logSizeBefore: silverChangeLog.length
        };

        if (totalArmyCost > 0) {
        // [DEBUG] Military Log Trace
        // console.log('[Simulation] Applying military cost:', totalArmyCost, 'Reason:', 'expense_army_maintenance');
        const available = res.silver || 0;
        if (available >= totalArmyCost) {
            // [FIX] Use Ledger for correct wealth transfer (State -> Soldier)
            ledger.transfer('state', 'soldier', totalArmyCost, TRANSACTION_CATEGORIES.EXPENSE.MAINTENANCE, TRANSACTION_CATEGORIES.INCOME.MILITARY_PAY);

            militaryDebug.applied = true;
            militaryDebug.reason = 'expense_army_maintenance';

            rates.silver = (rates.silver || 0) - totalArmyCost;
            roleWagePayout.soldier = (roleWagePayout.soldier || 0) + totalArmyCost;
            roleLaborIncome.soldier = (roleLaborIncome.soldier || 0) + totalArmyCost; // Army pay is labor income
            // [FIX] 同步到 classFinancialData 以保持概览和财务面板数据一致
            if (classFinancialData.soldier) {
                classFinancialData.soldier.income.militaryPay = (classFinancialData.soldier.income.militaryPay || 0) + totalArmyCost;
            }

            // [DEBUG] Verify Log Immediate
            const logLast = silverChangeLog.toArray().pop(); // .toArray() returns copy, get last
            militaryDebug.logEntryFound = logLast && logLast.reason === TRANSACTION_CATEGORIES.EXPENSE.MAINTENANCE;
            militaryDebug.logSizeAfter = silverChangeLog.length;
        } else if (totalArmyCost > 0) {
            // 部分支付
            const partialPay = available * 0.9; // 留10%底
            if (partialPay > 0) {
                // [FIX] Use Ledger for partial payment too
                ledger.transfer('state', 'soldier', partialPay, TRANSACTION_CATEGORIES.EXPENSE.MAINTENANCE, TRANSACTION_CATEGORIES.INCOME.MILITARY_PAY);

                rates.silver = (rates.silver || 0) - partialPay;
                roleWagePayout.soldier = (roleWagePayout.soldier || 0) + partialPay;
                // [FIX] 同步到 classFinancialData 以保持概览和财务面板数据一致
                if (classFinancialData.soldier) {
                    classFinancialData.soldier.income.militaryPay = (classFinancialData.soldier.income.militaryPay || 0) + partialPay;
                }
            }
            logs.push(`?? 军饷不足！应付${totalArmyCost.toFixed(0)}银币，仅能支付${partialPay.toFixed(0)}银币，军心不稳。`);
        }
        }
        perfEnd('armyMaintenance');
    }

    // console.log('[TICK] Production loop completed.'); // Commented for performance

    // Add all tracked income (civilian + military) to the wealth of each class
    // applyRoleIncomeToWealth(); // Removed to prevent double counting (called again at end of tick)

    // console.log('[TICK] Starting needs calculation...'); // Commented for performance
    perfStart('needsConsumption');
    perfStart('socialEconomy');
    const needsReport = {};
    const classShortages = {};
    // 收集各阶层的财富乘数（用于UI显示"谁吃到了buff"）
    const stratumWealthMultipliers = {};
    // [FIX] 添加缺失的 stratumConsumption 初始化，用于追踪各阶层消费
    const stratumConsumption = {};
    Object.keys(STRATA).forEach(key => {
        if (key === 'official') {
            needsReport[key] = { satisfactionRatio: 1, totalTrackedNeeds: 0 };
            classShortages[key] = [];
            return;
        }
        const def = STRATA[key];
        const count = popStructure[key] || 0;
        if (count === 0 || !def.needs) {
            needsReport[key] = { satisfactionRatio: 1, totalTrackedNeeds: 0 };
            classShortages[key] = [];
            return;
        }

        let satisfactionSum = 0;
        let tracked = 0;
        const shortages = []; // 改为对象数组，记录短缺原因

        // Calculate wealth ratio for this stratum (used for luxury needs unlock)
        const startingWealthForLuxury = def.startingWealth || 1;
        const currentWealthPerCapita = (wealth[key] || 0) / Math.max(1, count);
        const wealthRatioForLuxury = currentWealthPerCapita / startingWealthForLuxury;
        const baseNeedsForCost = def.needs || {};
        let essentialCostPerCapita = 0;
        ['food', 'cloth'].forEach(resKey => {
            if (baseNeedsForCost[resKey]) {
                const marketPrice = getPrice(resKey);
                const basePrice = RESOURCES[resKey]?.basePrice || 1;
                const effectivePrice = Math.max(marketPrice, basePrice);
                essentialCostPerCapita += baseNeedsForCost[resKey] * effectivePrice;
            }
        });
        const incomePerCapita = (roleWagePayout[key] || 0) / Math.max(1, count);
        const incomeRatioForLuxury = essentialCostPerCapita > 0
            ? incomePerCapita / essentialCostPerCapita
            : (incomePerCapita > 0 ? 10 : 0);
        // Apply difficulty bonus to max consumption multiplier
        const maxConsumptionMultiplier = Math.max(1, (def.maxConsumptionMultiplier || 6) + getMaxConsumptionMultiplierBonus(difficulty));
        const consumptionMultiplier = calculateWealthMultiplier(
            incomeRatioForLuxury,
            wealthRatioForLuxury,
            def.wealthElasticity || 1.0,
            maxConsumptionMultiplier
        );
        const livingStandardLevel = getSimpleLivingStandard(incomeRatioForLuxury).level;
        const luxuryConsumptionMultiplier = calculateLuxuryConsumptionMultiplier({
            consumptionMultiplier,
            incomeRatio: incomeRatioForLuxury,
            wealthRatio: wealthRatioForLuxury,
            livingStandardLevel,
        });

        const unlockMultiplier = calculateUnlockMultiplier(
            incomeRatioForLuxury,
            wealthRatioForLuxury,
            def.wealthElasticity || 1.0,
            livingStandardLevel
        );

        // Merge base needs with unlocked luxury needs based on unlock multiplier
        const effectiveNeeds = { ...def.needs };
        if (def.luxuryNeeds) {
            // Sort thresholds to apply in order
            const thresholds = Object.keys(def.luxuryNeeds).map(Number).sort((a, b) => a - b);
            for (const threshold of thresholds) {
                if (unlockMultiplier >= threshold) {
                    const luxuryNeedsAtThreshold = def.luxuryNeeds[threshold];
                    for (const [resKey, amount] of Object.entries(luxuryNeedsAtThreshold)) {
                        // Add to existing need or create new
                        effectiveNeeds[resKey] =
                            (effectiveNeeds[resKey] || 0) + (amount * luxuryConsumptionMultiplier);
                    }
                }
            }
        }

        for (const [resKey, perCapita] of Object.entries(effectiveNeeds)) {
            const resourceInfo = RESOURCES[resKey];
            // Check if resource requires a technology to unlock
            if (resourceInfo && resourceInfo.unlockTech) {
                // Skip this resource if the required tech is not unlocked
                if (!techsUnlocked.includes(resourceInfo.unlockTech)) {
                    continue;
                }
            } else if (resourceInfo && typeof resourceInfo.unlockEpoch === 'number' && resourceInfo.unlockEpoch > epoch) {
                // Fallback to epoch check for resources without tech requirement
                continue;
            }
            if (!potentialResources.has(resKey)) {
                // 只有已解锁建筑能产出的资源才会产生需求
                continue;
            }

            // 基础需求量
            let requirement = perCapita * count * needsRequirementMultiplier;
            if (requirement <= 0) continue;

            const wasteMod = bonuses.resourceWaste?.[resKey] || 0;
            if (wasteMod !== 0) {
                requirement *= (1 + wasteMod);
            }

            // Apply economic modifiers (events + decrees)
            // 1. Resource-specific demand modifier (e.g., cloth demand +20%)
            const eventResourceMod = eventResourceDemandModifiers[resKey] || 0;
            const decreeResourceMod = decreeResourceDemandMod[resKey] || 0;
            const totalResourceDemandMod = eventResourceMod + decreeResourceMod;
            if (totalResourceDemandMod !== 0) {
                requirement *= (1 + totalResourceDemandMod);
            }
            // 2. Stratum-specific demand modifier (e.g., noble consumption +15%)
            const eventStratumMod = eventStratumDemandModifiers[key] || 0;
            const decreeStratumMod = decreeStratumDemandMod[key] || 0;
            const totalStratumDemandMod = eventStratumMod + decreeStratumMod;
            if (totalStratumDemandMod !== 0) {
                requirement *= (1 + totalStratumDemandMod);
            }

            // 3. Wartime military class demand multiplier (3x for soldier during war)
            if (isPlayerAtWar && key === 'soldier') {
                requirement *= WAR_MILITARY_MULTIPLIER;
            }

            // 新增：计算官员平均贪婪度（仅在计算官员阶层需求时生效）
            let officialGreedModifier = 1.0;
            if (key === 'official' && officials && officials.length > 0) {
                const totalGreed = officials.reduce((sum, off) => sum + (off.greed || 1.0), 0);
                officialGreedModifier = totalGreed / officials.length;
            }

            // 应用需求弹性调整
            if (isTradableResource(resKey)) {
                const resourceMarketConfig = resourceInfo?.marketConfig || {};
                const defaultMarketInfluence = ECONOMIC_INFLUENCE?.market || {};
                const demandElasticity = resourceMarketConfig.demandElasticity !== undefined
                    ? resourceMarketConfig.demandElasticity
                    : (defaultMarketInfluence.demandElasticity || 0.5);

                // 1. 财富影响：阶层财富相对于起始财富的变化
                const startingWealth = def.startingWealth || 1;
                const currentWealth = (wealth[key] || 0) / Math.max(1, count);

                // New Hybrid Wealth for Demand: Max(Real Wealth, Projected Monthly Income)
                const currentIncome = (roleWagePayout[key] || 0) / Math.max(1, count);
                const projectedIncomeWealth = Math.max(0, currentIncome) * 30;
                const effectiveWealth = Math.max(currentWealth, projectedIncomeWealth);

                const wealthRatio = effectiveWealth / startingWealth;
                // 2024-12更新：使用统一的calculateWealthMultiplier函数
                // 该函数现在支持高财富比率补偿低收入
                // incomeRatio在这里使用wealthRatio近似（因为高财富意味着历史上收入高）
                let wealthElasticity = def.wealthElasticity || 1.0;

                // 应用官员贪婪度修正：贪婪度直接放大财富弹性，意味着越有钱越想通过消费展示
                if (key === 'official') {
                    wealthElasticity *= officialGreedModifier;
                }

                const maxMultiplier = Math.max(1, (def.maxConsumptionMultiplier || 6) + getMaxConsumptionMultiplierBonus(difficulty));
                const wealthMultiplier = calculateWealthMultiplier(wealthRatio, wealthRatio, wealthElasticity, maxMultiplier);
                // 记录财富乘数（取最后一次计算的值，用于UI显示）
                if (!stratumWealthMultipliers[key] || Math.abs(wealthMultiplier - 1) > Math.abs(stratumWealthMultipliers[key] - 1)) {
                    stratumWealthMultipliers[key] = wealthMultiplier;
                }

                // 2. 价格影响：当前价格相对于基础价格的变化
                const currentPrice = getPrice(resKey);
                const basePrice = resourceInfo.basePrice || 1;
                const priceRatio = currentPrice / basePrice;
                // 价格变化对需求的影响：价格上涨→需求下降，价格下跌→需求上涨
                // 使用需求弹性：价格变化1%，需求反向变化elasticity%
                const priceMultiplier = Math.pow(priceRatio, -demandElasticity);

                // 3. 每日随机浮动（80%-120%）
                const dailyVariation = 0.8 + Math.random() * 0.4;

                // 综合调整需求
                requirement *= wealthMultiplier * priceMultiplier * dailyVariation;

                // 确保需求不会变成负数或过大
                requirement = Math.max(0, requirement);
                requirement = Math.min(requirement, perCapita * count * needsRequirementMultiplier * 8); // 最多8倍（配合更低的财富乘数上限）
            }
            const available = res[resKey] || 0;
            let satisfied = 0;

            if (isTradableResource(resKey)) {
                const marketPrice = getPrice(resKey);

                // [NEW] 价格管制检查：只有左派主导且启用时才生效
                const leftFactionDominant = cabinetStatus?.dominance?.panelType === 'plannedEconomy';
                const priceControlActive = leftFactionDominant && priceControls?.enabled && priceControls.governmentSellPrices?.[resKey] !== undefined && priceControls.governmentSellPrices[resKey] !== null;

                // Determine tentative effective price for affordability check
                // Note: If treasury runs out during application, we revert to market price, 
                // but we calculate consumption based on the hope of government price.
                let tentativePrice = marketPrice;
                if (priceControlActive) {
                    tentativePrice = priceControls.governmentSellPrices[resKey];
                }

                const priceWithTax = tentativePrice * (1 + getResourceTaxRate(resKey));
                const affordable = priceWithTax > 0 ? Math.min(requirement, (wealth[key] || 0) / priceWithTax) : requirement;
                const amount = Math.min(requirement, available, affordable);

                // 先不统计需求，等实际消费后再统计
                if (amount > 0) {
                    res[resKey] = available - amount;
                    rates[resKey] = (rates[resKey] || 0) - amount;

                    // [NEW] Apply Price Control (Financial Transaction)
                    let finalEffectivePrice = marketPrice;
                    if (priceControlActive) {
                        const pcResult = applyBuyPriceControl({
                            resourceKey: resKey,
                            amount,
                            marketPrice,
                            priceControls,
                            taxBreakdown,
                            resources: res,
                            onTreasuryChange: trackSilverChange,
                        });
                        // If success (treasury sufficient for subsidy), use gov price
                        // If fail (treasury empty), it returns marketPrice
                        finalEffectivePrice = pcResult.effectivePrice;
                    }

                    const taxRate = getResourceTaxRate(resKey);
                    const baseCost = amount * finalEffectivePrice;
                    const taxPaid = baseCost * taxRate;
                    let totalCost = baseCost;

                    if (taxPaid < 0) {
                        const subsidyAmount = Math.abs(taxPaid);
                        if ((res.silver || 0) >= subsidyAmount) {
                            ledger.transfer('state', key, subsidyAmount, TRANSACTION_CATEGORIES.INCOME.SUBSIDY, TRANSACTION_CATEGORIES.INCOME.SUBSIDY);
                            totalCost -= subsidyAmount;
                            // Record consumption subsidy as income
                            roleWagePayout[key] = (roleWagePayout[key] || 0) + subsidyAmount;
                            roleLaborIncome[key] = (roleLaborIncome[key] || 0) + subsidyAmount; // Subsidy is personal income
                        } else {
                            if (tick % 20 === 0) {
                                recordAggregatedLog(`国库空虚，无法为 ${STRATA[key]?.name || key} 支付 ${RESOURCES[resKey]?.name || resKey} 消费补贴！`);
                            }
                        }
                    } else if (taxPaid > 0) {
                        ledger.transfer(key, 'state', taxPaid, TRANSACTION_CATEGORIES.EXPENSE.RESOURCE_TAX, TRANSACTION_CATEGORIES.EXPENSE.RESOURCE_TAX);
                        totalCost += taxPaid;
                    }

                    // Wealth deduction for consumption
                    const isEssential = def.needs && def.needs.hasOwnProperty(resKey);
                    const expenseCat = isEssential ? TRANSACTION_CATEGORIES.EXPENSE.ESSENTIAL_CONSUMPTION : TRANSACTION_CATEGORIES.EXPENSE.LUXURY_CONSUMPTION;

                    ledger.transfer(key, 'void', totalCost, expenseCat, expenseCat, { resource: resKey, quantity: amount, price: finalEffectivePrice });

                    roleExpense[key] = (roleExpense[key] || 0) + totalCost;
                    roleLivingExpense[key] = (roleLivingExpense[key] || 0) + totalCost; // Needs consumption is living expense
                    satisfied = amount;

                    // 统计实际消费的需求量，而不是原始需求量
                    demand[resKey] = (demand[resKey] || 0) + amount;

                    // NEW: Track consumption by stratum
                    if (!stratumConsumption[key]) stratumConsumption[key] = {};
                    stratumConsumption[key][resKey] = (stratumConsumption[key][resKey] || 0) + amount;
                }

                // 记录短缺原因
                const ratio = requirement > 0 ? satisfied / requirement : 1;
                satisfactionSum += ratio;
                tracked += 1;
                if (ratio < 0.99) {
                    // 判断短缺原因：买不起 vs 缺货
                    const canAfford = affordable >= requirement * 0.99;
                    const inStock = available >= requirement * 0.99;
                    let reason = 'both'; // 既缺货又买不起
                    if (canAfford && !inStock) {
                        reason = 'outOfStock'; // 有钱但缺货
                    } else if (!canAfford && inStock) {
                        reason = 'unaffordable'; // 有货但买不起
                    }
                    shortages.push({ resource: resKey, reason });
                }
            } else {
                const amount = Math.min(requirement, available);
                if (amount > 0) {
                    res[resKey] = available - amount;
                    satisfied = amount;
                }

                const ratio = requirement > 0 ? satisfied / requirement : 1;
                satisfactionSum += ratio;
                tracked += 1;
                if (ratio < 0.99) {
                    // 非交易资源只可能是缺货
                    shortages.push({ resource: resKey, reason: 'outOfStock' });
                }
            }
        }

        needsReport[key] = {
            satisfactionRatio: tracked > 0 ? satisfactionSum / tracked : 1,
            totalTrackedNeeds: tracked,
        };
        classShortages[key] = shortages;
    });

    // 计算劳动效率，特别关注食物和布料的基础需求
    let workforceNeedWeighted = 0;
    let workforceTotal = 0;
    let basicNeedsDeficit = 0; // 基础需求缺失的严重程度

    Object.keys(STRATA).forEach(key => {
        const count = popStructure[key] || 0;
        if (count <= 0) return;
        workforceTotal += count;
        const needLevel = needsReport[key]?.satisfactionRatio ?? 1;
        workforceNeedWeighted += needLevel * count;

        // 检查食物和布料的基础需求满足情况
        const def = STRATA[key];
        if (def && def.needs) {
            const shortages = classShortages[key] || [];
            const hasBasicShortage = shortages.some(s => s.resource === 'food' || s.resource === 'cloth');

            if (hasBasicShortage) {
                // 基础需求未满足，累计缺失人口数
                basicNeedsDeficit += count;
            }
        }
    });

    const laborNeedAverage = workforceTotal > 0 ? workforceNeedWeighted / workforceTotal : 1;
    let laborEfficiencyFactor = 0.3 + 0.7 * laborNeedAverage;

    // 如果有基础需求缺失，额外降低效率
    if (basicNeedsDeficit > 0 && workforceTotal > 0) {
        const basicDeficitRatio = basicNeedsDeficit / workforceTotal;
        // 基础需求缺失导致额外的效率惩罚：最多额外降低40%效率
        const basicPenalty = basicDeficitRatio * 0.4;
        laborEfficiencyFactor = Math.max(0.1, laborEfficiencyFactor - basicPenalty);

        if (basicDeficitRatio > 0.1) {
            logs.push(`基础需求（食物/布料）严重短缺，劳动效率大幅下降！`);
        }
    }

    if (laborEfficiencyFactor < 0.999) {
        Object.entries(rates).forEach(([resKey, value]) => {
            const resInfo = RESOURCES[resKey];
            if (!resInfo || resKey === 'silver' || (resInfo.type && resInfo.type === 'virtual')) return;
            if (value > 0) {
                const reduction = value * (1 - laborEfficiencyFactor);
                rates[resKey] = value - reduction;
                res[resKey] = Math.max(0, (res[resKey] || 0) - reduction);
            }
        });
        // logs.push('劳动力因需求未满足而效率下降。');
    }
    perfEnd('needsConsumption');

    // Decree approval modifiers now come from `activeDecrees` (timed system)
    const decreesFromActiveForApproval = activeDecrees
        ? Object.entries(activeDecrees).map(([id, data]) => ({
            id,
            active: true,
            modifiers: data?.effects || data?.modifiers
        }))
        : [];

    let decreeApprovalModifiers = calculateDecreeApprovalModifiers(decreesFromActiveForApproval);

    // Keep a few legacy special-cases, but key off `activeDecrees`
    // Forced labor static penalty is handled by calculateDecreeApprovalModifiers

    if (activeDecrees?.tithe) {
        const titheDue = (popStructure.cleric || 0) * 2 * effectiveTaxModifier;
        if (titheDue > 0) {
            const available = wealth.cleric || 0;
            const paid = Math.min(available, titheDue);
            ledger.transfer('cleric', 'state', paid, TRANSACTION_CATEGORIES.EXPENSE.HEAD_TAX, TRANSACTION_CATEGORIES.EXPENSE.HEAD_TAX);
            roleExpense.cleric = (roleExpense.cleric || 0) + paid;
        }
    }

    // REFACTORED: Use shared calculateLivingStandards function from needs.js
    // incorporating new Income-Expense Balance Model

    // ====================================================================================================
    // 5. Advanced Cabinet Mechanics (Left/Right Dominance Active Effects)
    // ====================================================================================================

    perfStart('cabinetMechanics');
    // --- Left Dominance: Planned Economy (Quota System) ---
    // User sets target population ratios. We adjust actual population towards targets.
    const quotaControls = quotaTargets && typeof quotaTargets === 'object' && Object.prototype.hasOwnProperty.call(quotaTargets, 'targets')
        ? quotaTargets
        : { enabled: true, targets: quotaTargets || {} };

    if (cabinetStatus.dominance?.faction === 'left' && quotaControls?.enabled && quotaControls.targets && Object.keys(quotaControls.targets).length > 0) {
        const { adjustments, approvalPenalties, adminCost } = calculateQuotaEffects(popStructure, quotaControls.targets);

        // [FIX] Population Conservation Logic
        // Calculate total population BEFORE adjustments to ensure conservation
        const previousTotalPop = Object.values(popStructure).reduce((a, b) => a + b, 0);
        let newTotalPop = 0;
        let maxPopStratum = null;
        let maxPopValue = -1;

        // Apply population adjustments
        Object.entries(adjustments).forEach(([stratum, change]) => {
            if (popStructure[stratum] !== undefined) {
                // Apply change
                popStructure[stratum] = Math.max(0, Math.round(popStructure[stratum] + change));
            }
        });

        // Recalculate total after adjustments
        Object.keys(popStructure).forEach(s => {
            const val = popStructure[s];
            newTotalPop += val;
            if (val > maxPopValue) {
                maxPopValue = val;
                maxPopStratum = s;
            }
        });

        // Correction for rounding errors (Conservation of Mass)
        const diff = previousTotalPop - newTotalPop;
        if (diff !== 0 && maxPopStratum) {
            popStructure[maxPopStratum] += diff;
            // Ensure we didn't drop below zero (unlikely unless diff is huge negative)
            if (popStructure[maxPopStratum] < 0) {
                popStructure[maxPopStratum] = 0;
            }
        }

        // Apply approval penalties
        Object.entries(approvalPenalties).forEach(([stratum, penalty]) => {
            if (classApproval[stratum]) {
                // calculateQuotaEffects returns 'penalty' as a value like 5 for -5 approval.
                // Apply 5% of the calculated penalty per day as "dissatisfaction pressure".
                classApproval[stratum] -= penalty * 0.05;
            }
        });
    }

    // --- Right Dominance: Free Market (Owner Expansion) ---
    // Owners automatically build new buildings using their wealth.
    let newBuildingsCount = { ...buildings };
    // [DEBUG] 临时调试信息 - 追踪自由市场机制问题
    const _freeMarketDebug = {
        // 传入的 cabinetStatus
        cabinetStatusReceived: {
            hasCabinetStatus: !!cabinetStatus,
            hasDominance: !!cabinetStatus?.dominance,
            dominanceFaction: cabinetStatus?.dominance?.faction,
            synergy: cabinetStatus?.synergy,
            level: cabinetStatus?.level,
        },
        // expansionSettings 检查
        expansionSettings: {
            hasSettings: !!expansionSettings,
            settingsKeys: expansionSettings ? Object.keys(expansionSettings) : [],
            allowedCount: expansionSettings
                ? Object.values(expansionSettings).filter(s => s?.allowed).length
                : 0,
        },
        // 最终条件判断
        conditionCheck: {
            isDominanceRight: cabinetStatus?.dominance?.faction === 'right',
            hasExpansionSettings: !!expansionSettings,
            willProcess: cabinetStatus?.dominance?.faction === 'right' && !!expansionSettings,
        },
        epochParam: epoch,
    };

    // [NEW DEBUG] 详细输出传入的参数
    // console.log('[FREE MARKET SIMULATION DEBUG]', {
    //     dominanceCheck: {
    //         hasDominance: !!cabinetStatus?.dominance,
    //         faction: cabinetStatus?.dominance?.faction,
    //         isRightWing: cabinetStatus?.dominance?.faction === 'right',
    //     },
    //     expansionCheck: {
    //         hasSettings: !!expansionSettings,
    //         settingsCount: expansionSettings ? Object.keys(expansionSettings).length : 0,
    //         allowedBuildings: expansionSettings
    //             ? Object.entries(expansionSettings).filter(([k, v]) => v?.allowed).map(([k]) => k)
    //             : [],
    //     },
    //     willCallProcessExpansions:
    //         !!cabinetStatus?.dominance &&
    //         cabinetStatus.dominance.faction === 'right' &&
    //         !!expansionSettings,
    // });

    if (cabinetStatus.dominance?.faction === 'right' && expansionSettings) {
        // 构造 market 对象，包含 prices 和 wages 用于利润计算
        const marketForExpansion = {
            prices: priceMap,
            wages: market?.wages || {}
        };

        // We pass BUILDINGS, wealth, settings, counts, market with wages, and tax policies
        const { expansions, wealthDeductions } = processOwnerExpansions(
            BUILDINGS,
            wealth,
            expansionSettings,
            newBuildingsCount,
            marketForExpansion,
            taxPolicies,  // [NEW] 传递税收政策用于营业税计算
            buildingStaffingRatios
        );

        // Apply expansions
        if (expansions.length > 0) {
            // logs.push(`Free Market: Expanding ${expansions.length} buildings.`);
            expansions.forEach(exp => {
                const id = exp.buildingId;
                newBuildingsCount[id] = (newBuildingsCount[id] || 0) + 1;
                // logs.push(`- ${exp.owner} built ${id} for ${exp.cost}`);
            });

            // Apply wealth deductions
            Object.entries(wealthDeductions).forEach(([stratum, amount]) => {
                if (wealth[stratum]) {
                    ledger.transfer(stratum, 'void', amount, TRANSACTION_CATEGORIES.EXPENSE.BUILDING_COST, TRANSACTION_CATEGORIES.EXPENSE.BUILDING_COST);
                }
            });
            // Update the main `builds` object for the rest of the tick
            Object.assign(builds, newBuildingsCount);
        }
    }
    perfEnd('cabinetMechanics');

    // ====================================================================================================
    // 6. Return Simulation Result
    // ====================================================================================================
    // Move official processing here so their wealth is aggregated into `wealth` BEFORE
    // calculateLivingStandards runs. This ensures StrataPanel shows correct data.
    perfStart('officialsSim');

    let totalOfficialWealth = 0;
    let totalOfficialExpense = 0;
    let totalOfficialIncome = 0; // Track income for UI
    let totalOfficialLaborIncome = 0; // Track labor income (salary + subsidy)
    const pendingOfficialUpgrades = [];
    const officialMarketSnapshot = {
        prices: priceMap,
        wages: market?.wages || {},
    };

    const officialList = Array.isArray(officials) ? officials : [];
    const officialCount = officialList.length;
    // [OPTIMIZATION REMOVED] 移除批处理机制，所有官员每个Tick都进行完整计算
    // 原因：
    // 1. 建筑生产、工资发放、盈利都是每个Tick更新的
    // 2. 官员的收入（薪水、产业收益）和支出（消费、税收）应该实时计算
    // 3. 投资决策已有内置冷却时间（INVESTMENT_COOLDOWN=90, UPGRADE_COOLDOWN=60），不会造成性能问题
    const updatedOfficials = officialCount === 0 ? [] : officialList.map((official, index) => {
        if (!official) return official;
        const normalizedOfficial = migrateOfficialForInvestment(official, tick);

        // 初始化 wealth（向后兼容：旧存档可能没有 wealth）
        // [FIX] 添加安全检查：财富上限1兆（1e12），防止极大数值导致系统崩溃
        const MAX_WEALTH = 1e12; // 最大财富：1兆
        let rawWealth = typeof normalizedOfficial.wealth === 'number' ? normalizedOfficial.wealth : 400;
        // 检查是否为有效数值，无效则重置为400
        if (!Number.isFinite(rawWealth) || rawWealth < 0) {
            rawWealth = 400;
        }
        let currentWealth = Math.min(rawWealth, MAX_WEALTH);

        // [DEBUG] 追踪官员财富变化
        const debugInitialWealth = currentWealth;

        // 收入：如果足额支付薪水，获得薪水
        if (officialsPaid && typeof normalizedOfficial.salary === 'number') {
            currentWealth += normalizedOfficial.salary;
            totalOfficialIncome += normalizedOfficial.salary;
            totalOfficialLaborIncome += normalizedOfficial.salary; // Add to labor income
            // console.log(`[OFFICIAL DEBUG] ${normalizedOfficial.name}: Salary paid! +${normalizedOfficial.salary}, wealth: ${debugInitialWealth} -> ${currentWealth}`);
            // 记录俸禄到财务数据
            if (classFinancialData.official) {
                classFinancialData.official.income.salary = (classFinancialData.official.income.salary || 0) + normalizedOfficial.salary;
            }
        } else {
            // console.log(`[OFFICIAL DEBUG] ${normalizedOfficial.name}: NO SALARY! officialsPaid=${officialsPaid}, salary=${normalizedOfficial.salary}, wealth=${currentWealth}`);
        }

        // 支出：官员独立购买商品，更新市场供需与税收
        const officialNeeds = STRATA.official?.needs || { food: 1.2, cloth: 0.2 };
        const officialLuxuryNeeds = STRATA.official?.luxuryNeeds || {};
        let dailyExpense = 0;
        let luxuryExpense = 0;
        let essentialExpense = 0;
        let headTaxPaid = 0;
        let investmentCost = 0;
        let upgradeCost = 0;
        const expenseBreakdown = {};
        // Soft cap: limit luxury spending per tick to reduce extreme wealth swings.
        const LUXURY_SPEND_CAP_RATIO = 0.05;
        const luxuryBudgetBase = (normalizedOfficial.salary || 0) * 6;
        let luxuryBudgetRemaining = Math.max(luxuryBudgetBase, currentWealth * LUXURY_SPEND_CAP_RATIO);

        const consumeOfficialResource = (resource, amountPerCapita, isLuxury = false) => {
            if (!resource || amountPerCapita <= 0) return;
            const resourceInfo = RESOURCES[resource];
            if (resourceInfo?.unlockTech && !techsUnlocked.includes(resourceInfo.unlockTech)) return;
            if (resourceInfo && typeof resourceInfo.unlockEpoch === 'number' && resourceInfo.unlockEpoch > epoch) return;
            if (potentialResources && !potentialResources.has(resource)) return;

            let requirement = amountPerCapita * needsRequirementMultiplier;
            if (requirement <= 0) return;

            const wasteMod = bonuses.resourceWaste?.[resource] || 0;
            if (wasteMod !== 0) {
                requirement *= (1 + wasteMod);
            }

            const eventResourceMod = eventResourceDemandModifiers[resource] || 0;
            const decreeResourceMod = decreeResourceDemandMod[resource] || 0;
            const totalResourceDemandMod = eventResourceMod + decreeResourceMod;
            if (totalResourceDemandMod !== 0) {
                requirement *= (1 + totalResourceDemandMod);
            }

            const eventStratumMod = eventStratumDemandModifiers.official || 0;
            const decreeStratumMod = decreeStratumDemandMod.official || 0;
            const totalStratumDemandMod = eventStratumMod + decreeStratumMod;
            if (totalStratumDemandMod !== 0) {
                requirement *= (1 + totalStratumDemandMod);
            }

            const available = res[resource] || 0;
            if (isTradableResource(resource)) {
                const price = getPrice(resource);
                const taxRate = getResourceTaxRate(resource);
                const priceWithTax = price * (1 + taxRate);
                const luxuryBudgetAffordable = isLuxury && priceWithTax > 0
                    ? luxuryBudgetRemaining / priceWithTax
                    : Infinity;
                const affordable = priceWithTax > 0
                    ? Math.min(requirement, currentWealth / priceWithTax, luxuryBudgetAffordable)
                    : requirement;
                const amount = Math.min(requirement, available, affordable);
                if (amount <= 0) return;

                res[resource] = available - amount;
                rates[resource] = (rates[resource] || 0) - amount;
                demand[resource] = (demand[resource] || 0) + amount;

                const baseCost = amount * price;
                const taxPaid = baseCost * taxRate;
                let totalCost = baseCost;

                if (taxPaid < 0) {
                    const subsidyAmount = Math.abs(taxPaid);
                    if ((res.silver || 0) >= subsidyAmount) {
                        ledger.transfer('state', 'official', subsidyAmount, TRANSACTION_CATEGORIES.INCOME.SUBSIDY, TRANSACTION_CATEGORIES.INCOME.SUBSIDY);
                        totalCost -= subsidyAmount;
                        totalOfficialIncome += subsidyAmount;
                        totalOfficialLaborIncome += subsidyAmount; // Add to labor income
                    } else if (tick % 20 === 0) {
                        recordAggregatedLog(`国库空虚，无法为 官员 支付 ${RESOURCES[resource]?.name || resource} 消费补贴！`);
                    }
                } else if (taxPaid > 0) {
                    ledger.transfer('official', 'state', taxPaid, TRANSACTION_CATEGORIES.EXPENSE.RESOURCE_TAX, TRANSACTION_CATEGORIES.EXPENSE.RESOURCE_TAX);
                    totalCost += taxPaid;
                }

                currentWealth = Math.max(0, currentWealth - totalCost);
                dailyExpense += totalCost;
                if (isLuxury) {
                    luxuryExpense += totalCost;
                    luxuryBudgetRemaining = Math.max(0, luxuryBudgetRemaining - totalCost);
                } else {
                    essentialExpense += totalCost;
                }
                if (!expenseBreakdown[resource]) {
                    expenseBreakdown[resource] = { amount: 0, cost: 0, tax: 0, luxuryCost: 0, essentialCost: 0 };
                }
                expenseBreakdown[resource].amount += amount;
                expenseBreakdown[resource].cost += totalCost;
                expenseBreakdown[resource].tax += taxPaid;
                if (isLuxury) {
                    expenseBreakdown[resource].luxuryCost += totalCost;
                } else {
                    expenseBreakdown[resource].essentialCost += totalCost;
                }

                if (!stratumConsumption.official) stratumConsumption.official = {};
                stratumConsumption.official[resource] = (stratumConsumption.official[resource] || 0) + amount;

                // 使用 Ledger 记录支出 (更新 classFinancialData 和 aggregate wealth)
                const expenseCat = isLuxury ? TRANSACTION_CATEGORIES.EXPENSE.LUXURY_CONSUMPTION : TRANSACTION_CATEGORIES.EXPENSE.ESSENTIAL_CONSUMPTION;
                ledger.transfer('official', 'void', totalCost, expenseCat, expenseCat, { resource, quantity: amount, price });
            } else {
                const amount = Math.min(requirement, available);
                if (amount > 0) {
                    res[resource] = available - amount;
                    if (!expenseBreakdown[resource]) {
                        expenseBreakdown[resource] = { amount: 0, cost: 0, tax: 0, luxuryCost: 0, essentialCost: 0 };
                    }
                    expenseBreakdown[resource].amount += amount;
                }
            }
        };

        Object.entries(officialNeeds).forEach(([resource, baseAmount]) => {
            consumeOfficialResource(resource, baseAmount, false);
        });

        // 基于财富水平的奢侈需求
        // [FIX] 限制wealthRatio上限防止数值溢出（极大财富值会导致后续计算爆炸）
        const rawWealthRatio = currentWealth / 400; // 相对于初始财富的比例
        const wealthRatio = Math.min(rawWealthRatio, 1e9); // 上限10亿倍
        if (wealthRatio >= 1.0 && officialLuxuryNeeds) {
            const wealthBase = Math.max(1, Math.min(currentWealth / 400, 1e9));
            // [FIX] 限制消费乘数上限为100倍，防止极大财富导致的消费爆炸
            const rawConsumptionMultiplier = 1.0 + Math.log10(wealthBase) * 1.6;
            const consumptionMultiplier = Math.min(100.0, Number.isFinite(rawConsumptionMultiplier) ? rawConsumptionMultiplier : 1.0);
            const salaryBase = Math.max(1, Math.min((normalizedOfficial.salary || 0) / 400, 1e9));
            const rawSalaryMultiplier = 1.0 + Math.log10(salaryBase) * 1.2;
            const salaryMultiplier = Math.min(8.0, Number.isFinite(rawSalaryMultiplier) ? rawSalaryMultiplier : 1.0);
            const luxuryThresholds = Object.keys(officialLuxuryNeeds)
                .map(Number)
                .filter(t => t <= wealthRatio)
                .sort((a, b) => b - a);

            luxuryThresholds.forEach(threshold => {
                const needs = officialLuxuryNeeds[threshold];
                if (!needs) return;
                Object.entries(needs).forEach(([resource, amount]) => {
                    consumeOfficialResource(resource, amount * consumptionMultiplier * salaryMultiplier, true);
                });
            });
        }

        // [DEBUG] 追踪财富变化 - 商品消费后（人头税之前）
        const debugAfterGoodsConsumption = currentWealth;

        // 人头税：官员拥有独立财富，因此在此单独结算
        const headRate = getHeadTaxRate('official');
        const headBase = STRATA.official?.headTaxBase ?? 0.01;
        const plannedPerCapitaTax = headBase * headRate * effectiveTaxModifier;
        if (plannedPerCapitaTax !== 0) {
            if (plannedPerCapitaTax > 0) {
                const taxPaid = Math.min(currentWealth, plannedPerCapitaTax);
                headTaxPaid = taxPaid;
                currentWealth = Math.max(0, currentWealth - taxPaid);
                ledger.transfer('official', 'state', taxPaid, TRANSACTION_CATEGORIES.EXPENSE.HEAD_TAX, TRANSACTION_CATEGORIES.EXPENSE.HEAD_TAX);

                roleHeadTaxPaid.official = (roleHeadTaxPaid.official || 0) + taxPaid;
                roleExpense.official = (roleExpense.official || 0) + taxPaid;
            } else {
                const subsidyNeeded = Math.abs(plannedPerCapitaTax);
                const treasury = res.silver || 0;
                if (treasury >= subsidyNeeded) {
                    ledger.transfer('state', 'official', subsidyNeeded, TRANSACTION_CATEGORIES.INCOME.SUBSIDY, TRANSACTION_CATEGORIES.INCOME.SUBSIDY);
                    currentWealth += subsidyNeeded;
                    totalOfficialIncome += subsidyNeeded;
                    totalOfficialLaborIncome += subsidyNeeded; // Add to labor income
                }
            }
        }

        // [BUG FIX] 移除重复扣支出的代码
        // dailyExpense 已在 consumeOfficialResource 中实时从 currentWealth 扣除（第2948行）
        // 这里不应该再扣一次，否则会导致官员财富被双重扣减，存款无法积累

        // [DEBUG] 追踪财富变化 - 人头税后
        const debugAfterConsumption = currentWealth;
        const debugPlannedHeadTax = plannedPerCapitaTax;

        // 官员产业收益结算（独立核算）
        let totalPropertyIncome = 0;
        const actualProfitCache = {};
        const getActualProfitPerBuilding = (buildingId) => {
            if (actualProfitCache[buildingId] !== undefined) return actualProfitCache[buildingId];
            const finance = buildingFinancialData?.[buildingId];
            const totalCount = builds?.[buildingId] || 0;
            if (!finance || totalCount <= 0) {
                actualProfitCache[buildingId] = null;
                return null;
            }
            const ownerRevenue = finance.ownerRevenue || 0;
            const productionCosts = finance.productionCosts || 0;
            const businessTaxPaid = finance.businessTaxPaid || 0;
            const totalWagesPaid = Object.values(finance.wagesByRole || {})
                .reduce((sum, val) => sum + (Number.isFinite(val) ? val : 0), 0);
            const totalProfit = ownerRevenue - productionCosts - businessTaxPaid - totalWagesPaid;
            const perBuildingProfit = totalCount > 0 ? totalProfit / totalCount : 0;
            actualProfitCache[buildingId] = Number.isFinite(perBuildingProfit) ? perBuildingProfit : 0;
            return actualProfitCache[buildingId];
        };

        const ownedPropertiesList = Array.isArray(normalizedOfficial.ownedProperties)
            ? normalizedOfficial.ownedProperties
            : [];
        let propertySummary = normalizedOfficial._propertySummary;
        const expectedSummaryCount = ownedPropertiesList.length;
        if (!propertySummary || propertySummary.totalCount !== expectedSummaryCount) {
            const summary = { byBuilding: {}, byBuildingLevel: {}, totalCount: expectedSummaryCount };
            ownedPropertiesList.forEach((prop) => {
                if (!prop?.buildingId) return;
                summary.byBuilding[prop.buildingId] = (summary.byBuilding[prop.buildingId] || 0) + 1;
                if (!summary.byBuildingLevel[prop.buildingId]) {
                    summary.byBuildingLevel[prop.buildingId] = {};
                }
                const lvl = prop.level || 0;
                summary.byBuildingLevel[prop.buildingId][lvl] = (summary.byBuildingLevel[prop.buildingId][lvl] || 0) + 1;
            });
            propertySummary = summary;
        }

        Object.entries(propertySummary?.byBuilding || {}).forEach(([buildingId, count]) => {
            if (!count) return;
            const perBuildingProfit = getActualProfitPerBuilding(buildingId);
            if (perBuildingProfit === null) {
                // Fallback to estimated profit if actual data is missing
                const estimatedProfit = calculateOfficialPropertyProfit(
                    { buildingId },
                    officialMarketSnapshot,
                    taxPolicies,
                    buildingStaffingRatios,
                    builds
                );
                if (estimatedProfit !== 0) {
                    totalPropertyIncome += estimatedProfit * count;
                }
                return;
            }
            if (perBuildingProfit !== 0) {
                totalPropertyIncome += perBuildingProfit * count;
            }
        });
        if (totalPropertyIncome !== 0) {
            currentWealth = Math.max(0, currentWealth + totalPropertyIncome);
            totalOfficialIncome += totalPropertyIncome;
            if (totalPropertyIncome > 0) {
                ledger.transfer('void', 'official', totalPropertyIncome, TRANSACTION_CATEGORIES.INCOME.OWNER_REVENUE, TRANSACTION_CATEGORIES.INCOME.OWNER_REVENUE);
            }
        }

        // [DEBUG] 追踪财富变化 - 产业收益后
        const debugAfterProperty = currentWealth;

        // 计算财务满意度
        const totalIncomeForSatisfaction = (normalizedOfficial.salary || 0) + totalPropertyIncome;
        const financialSatisfaction = calculateFinancialStatus(
            { ...normalizedOfficial, wealth: currentWealth },
            dailyExpense,
            totalIncomeForSatisfaction
        );
        const baseSalary = Number.isFinite(normalizedOfficial.baseSalary)
            ? normalizedOfficial.baseSalary
            : (normalizedOfficial.salary || 0);
        const salaryRatio = baseSalary > 0 ? (normalizedOfficial.salary || 0) / baseSalary : 1;
        let salarySatisfaction = 'satisfied';
        if (salaryRatio < 0.4) {
            salarySatisfaction = 'desperate';
        } else if (salaryRatio < 0.7) {
            salarySatisfaction = 'struggling';
        } else if (salaryRatio < 0.95) {
            salarySatisfaction = 'uncomfortable';
        }
        const satisfactionOrder = ['satisfied', 'uncomfortable', 'struggling', 'desperate'];
        // 如果财务状况良好(satisfied，即财富充足)，直接使用财务满意度，忽略薪资满意度
        // 避免有钱人仅因薪资比例低就被判定为不满意
        let combinedSatisfaction;
        if (financialSatisfaction === 'satisfied') {
            combinedSatisfaction = 'satisfied';
        } else {
            // 财务状况不佳时，取两者中更差的
            const finalSatisfactionIndex = Math.max(
                satisfactionOrder.indexOf(financialSatisfaction),
                satisfactionOrder.indexOf(salarySatisfaction)
            );
            combinedSatisfaction = satisfactionOrder[finalSatisfactionIndex] || financialSatisfaction;
        }

        // 产业投资决策
        const investmentDecision = processOfficialInvestment(
            { ...normalizedOfficial, wealth: currentWealth },
            tick,
            officialMarketSnapshot,
            taxPolicies,
            cabinetStatus,
            builds,
            difficulty,
            epoch,
            techsUnlocked
        );

        const ownedProperties = Array.isArray(normalizedOfficial.ownedProperties)
            ? [...normalizedOfficial.ownedProperties]
            : [];
        let nextPropertySummary = propertySummary ? {
            byBuilding: { ...(propertySummary.byBuilding || {}) },
            byBuildingLevel: { ...(propertySummary.byBuildingLevel || {}) },
            totalCount: propertySummary.totalCount ?? ownedProperties.length,
        } : null;
        const investmentProfile = { ...normalizedOfficial.investmentProfile };

        const MAX_INVEST_SPEND_RATIO = 0.25;
        const investBudget = currentWealth * MAX_INVEST_SPEND_RATIO;
        if (investmentDecision && investmentDecision.cost <= investBudget && currentWealth >= investmentDecision.cost) {
            currentWealth = Math.max(0, currentWealth - investmentDecision.cost);
            investmentCost = investmentDecision.cost;
            const instanceId = `${investmentDecision.buildingId}_off_${normalizedOfficial.id}_${tick}_${Math.floor(Math.random() * 1000)}`;
            ownedProperties.push({
                buildingId: investmentDecision.buildingId,
                instanceId,
                purchaseDay: tick,
                purchaseCost: investmentDecision.cost,
                level: 0,
            });
            if (!nextPropertySummary) {
                nextPropertySummary = { byBuilding: {}, byBuildingLevel: {}, totalCount: ownedProperties.length };
            }
            nextPropertySummary.byBuilding[investmentDecision.buildingId] =
                (nextPropertySummary.byBuilding[investmentDecision.buildingId] || 0) + 1;
            if (!nextPropertySummary.byBuildingLevel[investmentDecision.buildingId]) {
                nextPropertySummary.byBuildingLevel[investmentDecision.buildingId] = {};
            }
            nextPropertySummary.byBuildingLevel[investmentDecision.buildingId][0] =
                (nextPropertySummary.byBuildingLevel[investmentDecision.buildingId][0] || 0) + 1;
            nextPropertySummary.totalCount = ownedProperties.length;
            investmentProfile.lastInvestmentDay = tick;
            builds[investmentDecision.buildingId] = (builds[investmentDecision.buildingId] || 0) + 1;
            if (investmentDecision.buildingId && (eventEffectSettings?.logVisibility?.showOfficialLogs ?? true)) {
                // Log investment
                logs.push(`🏗️ 官员${normalizedOfficial.name}投资了 ${investmentDecision.buildingId}（花费 ${Math.ceil(investmentDecision.cost)} 银）`);
            }
        }

        // 产业升级决策
        const upgradeDecision = processOfficialBuildingUpgrade(
            { ...normalizedOfficial, wealth: currentWealth, ownedProperties, investmentProfile },
            tick,
            officialMarketSnapshot,
            taxPolicies,
            cabinetStatus,
            builds,
            buildingUpgrades,
            difficulty
        );

        const MAX_UPGRADE_SPEND_RATIO = 0.2;
        const upgradeBudget = currentWealth * MAX_UPGRADE_SPEND_RATIO;
        if (upgradeDecision && upgradeDecision.cost <= upgradeBudget && currentWealth >= upgradeDecision.cost) {
            currentWealth = Math.max(0, currentWealth - upgradeDecision.cost);
            upgradeCost = upgradeDecision.cost;
            const targetProp = ownedProperties[upgradeDecision.propertyIndex];
            if (targetProp) {
                const fromLevel = targetProp.level || 0;
                targetProp.level = upgradeDecision.toLevel;
                investmentProfile.lastUpgradeDay = tick;
                pendingOfficialUpgrades.push({
                    buildingId: upgradeDecision.buildingId,
                    fromLevel: upgradeDecision.fromLevel,
                    toLevel: upgradeDecision.toLevel,
                    officialName: normalizedOfficial.name,
                    cost: upgradeDecision.cost,
                });
                if (nextPropertySummary?.byBuildingLevel?.[upgradeDecision.buildingId]) {
                    const levelMap = nextPropertySummary.byBuildingLevel[upgradeDecision.buildingId];
                    if (levelMap[fromLevel]) {
                        levelMap[fromLevel] = Math.max(0, levelMap[fromLevel] - 1);
                        if (levelMap[fromLevel] <= 0) {
                            delete levelMap[fromLevel];
                        }
                    }
                    levelMap[upgradeDecision.toLevel] = (levelMap[upgradeDecision.toLevel] || 0) + 1;
                }
            }
        }

        // [DEBUG] 追踪财富变化 - 投资/升级后
        const debugAfterInvestment = currentWealth;
        const debugInvestmentCost = investmentDecision?.cost || 0;
        const debugUpgradeCost = upgradeDecision?.cost || 0;

        totalOfficialWealth += currentWealth;
        totalOfficialExpense += dailyExpense;

        // ========== 忠诚度更新 ==========
        let newLoyalty = normalizedOfficial.loyalty ?? 75; // 默认值兼容旧存档
        let newLowLoyaltyDays = normalizedOfficial.lowLoyaltyDays ?? 0;

        // 政治诉求满足程度
        // 注意：politicalStance 可能是字符串（stanceId）或对象，需要兼容两种情况
        const stanceId = typeof normalizedOfficial.politicalStance === 'string'
            ? normalizedOfficial.politicalStance
            : normalizedOfficial.politicalStance?.stanceId;
        // conditionParams 存储在单独字段 stanceConditionParams 中
        const conditionParams = normalizedOfficial.stanceConditionParams || [];

        // 计算总影响力（从classInfluence对象累加）
        const computedTotalInfluence = Object.values(classInfluence || {}).reduce((sum, v) => sum + (v || 0), 0);

        // [FIX] 构建 classIncome 时，由于 roleWagePayout.official 在循环结束后才设置，
        // 这里需要为官员阶层使用当前官员的薪资作为预估收入
        const estimatedClassIncome = {
            ...roleWagePayout,
            // 官员收入使用当前官员的薪资（如果有支付的话）加上产业收入预估
            official: officialsPaid ? (normalizedOfficial.salary || 0) + (normalizedOfficial.lastDayPropertyIncome || 0) : 0
        };

        const stanceGameState = {
            classApproval: classApproval,
            classInfluence: classInfluence,
            classIncome: estimatedClassIncome,  // [FIX] 使用包含官员收入预估的数据
            totalInfluence: computedTotalInfluence,
            stability: (currentStability ?? 50) / 100,
            rulingCoalition: rulingCoalition,
            legitimacy: previousLegitimacy ?? 0,
            taxPolicies: taxPolicies,
            prices: priceMap,
            epoch: epoch,
            population: previousPopStructure ? Object.values(previousPopStructure).reduce((s, v) => s + (v || 0), 0) : 0,
            atWar: (nations || []).some(n => n.isAtWar),
        };
        const isStanceMet = isStanceSatisfied(
            stanceId,
            stanceGameState,
            conditionParams
        );

        // 应用忠诚度变化
        const { DAILY_CHANGES, COUP_THRESHOLD, MAX, MIN } = LOYALTY_CONFIG;

        // 记录各个因素的贡献值
        const loyaltyChangeFactors = [];
        let totalLoyaltyChange = 0;

        // 政治诉求
        const stanceChange = isStanceMet ? DAILY_CHANGES.stanceSatisfied : DAILY_CHANGES.stanceUnsatisfied;
        newLoyalty += stanceChange;
        totalLoyaltyChange += stanceChange;
        loyaltyChangeFactors.push({
            factor: isStanceMet ? 'stanceSatisfied' : 'stanceUnsatisfied',
            value: stanceChange,
        });

        // 财务状况
        let financialChange = 0;
        if (combinedSatisfaction === 'satisfied') {
            financialChange = DAILY_CHANGES.financialSatisfied;
            loyaltyChangeFactors.push({ factor: 'financialSatisfied', value: financialChange });
        } else if (combinedSatisfaction === 'uncomfortable') {
            financialChange = DAILY_CHANGES.financialUncomfortable;
            loyaltyChangeFactors.push({ factor: 'financialUncomfortable', value: financialChange });
        } else if (combinedSatisfaction === 'struggling') {
            financialChange = DAILY_CHANGES.financialStruggling;
            loyaltyChangeFactors.push({ factor: 'financialStruggling', value: financialChange });
        } else if (combinedSatisfaction === 'desperate') {
            financialChange = DAILY_CHANGES.financialDesperate;
            loyaltyChangeFactors.push({ factor: 'financialDesperate', value: financialChange });
        }
        newLoyalty += financialChange;
        totalLoyaltyChange += financialChange;

        // 国家稳定度
        const stabilityValue = (currentStability ?? 50) / 100; // currentStability是0-100，转为0-1
        let stabilityChange = 0;
        if (stabilityValue > 0.7) {
            stabilityChange = DAILY_CHANGES.stabilityHigh;
            loyaltyChangeFactors.push({ factor: 'stabilityHigh', value: stabilityChange });
        } else if (stabilityValue < 0.3) {
            stabilityChange = DAILY_CHANGES.stabilityLow;
            loyaltyChangeFactors.push({ factor: 'stabilityLow', value: stabilityChange });
        }
        newLoyalty += stabilityChange;
        totalLoyaltyChange += stabilityChange;

        // 薪资发放
        const salaryChange = officialsPaid ? DAILY_CHANGES.salaryPaid : DAILY_CHANGES.salaryUnpaid;
        newLoyalty += salaryChange;
        totalLoyaltyChange += salaryChange;
        loyaltyChangeFactors.push({
            factor: officialsPaid ? 'salaryPaid' : 'salaryUnpaid',
            value: salaryChange,
        });

        // 限制范围
        const oldLoyalty = normalizedOfficial.loyalty ?? 75;
        newLoyalty = Math.max(MIN, Math.min(MAX, newLoyalty));

        // 追踪低忠诚度持续天数
        if (newLoyalty < COUP_THRESHOLD) {
            newLowLoyaltyDays += 1;
        } else {
            newLowLoyaltyDays = 0;
        }

        return {
            ...normalizedOfficial,
            // [FIX] 确保返回的财富值在安全范围内
            wealth: Math.min(MAX_WEALTH, Number.isFinite(currentWealth) ? Math.max(0, currentWealth) : 400),
            lastDayExpense: dailyExpense,
            lastDayHeadTaxPaid: headTaxPaid,
            financialSatisfaction: combinedSatisfaction,
            ownedProperties,
            investmentProfile,
            lastDayPropertyIncome: totalPropertyIncome,
            lastDayExpenseBreakdown: expenseBreakdown,
            lastDayLuxuryExpense: luxuryExpense,
            lastDayEssentialExpense: essentialExpense,
            lastDayInvestmentCost: investmentCost,
            lastDayUpgradeCost: upgradeCost,
            lastDayNetChange: currentWealth - debugInitialWealth,
            lastDayCorruptionIncome: 0,
            _propertySummary: nextPropertySummary ? {
                ...nextPropertySummary,
                byBuilding: { ...(nextPropertySummary.byBuilding || {}) },
                byBuildingLevel: { ...(nextPropertySummary.byBuildingLevel || {}) },
                totalCount: nextPropertySummary.totalCount ?? ownedProperties.length,
            } : propertySummary,
            // 忠诚度系统
            loyalty: newLoyalty,
            lowLoyaltyDays: newLowLoyaltyDays,
            isStanceSatisfied: isStanceMet,
            // 忠诚度变化详情
            loyaltyChange: newLoyalty - oldLoyalty, // 实际变化量（考虑了上下限）
            loyaltyChangeFactors: loyaltyChangeFactors, // 各因素的贡献
            loyaltyChangeTotal: totalLoyaltyChange, // 理论变化量（未考虑上下限）
            // [DEBUG] 调试字段
            _debug: {
                initialWealth: debugInitialWealth,
                salaryPaid: officialsPaid,
                salaryAmount: normalizedOfficial.salary || 0,
                wealthAfterSalary: debugInitialWealth + (officialsPaid ? (normalizedOfficial.salary || 0) : 0),
                dailyExpense: dailyExpense,
                wealthAfterGoods: debugAfterGoodsConsumption,
                headTaxPlanned: debugPlannedHeadTax,
                headTaxPaid: headTaxPaid,
                wealthAfterTax: debugAfterConsumption,
                propertyIncome: totalPropertyIncome,
                wealthAfterProperty: debugAfterProperty,
                investmentCost: investmentCost || debugInvestmentCost,
                upgradeCost: upgradeCost || debugUpgradeCost,
                wealthAfterInvestment: debugAfterInvestment,
                wealthFinal: currentWealth,
            },
        };
    });

    // Sync Aggregate Stats for UI correctness
    wealth.official = totalOfficialWealth;
    roleExpense.official = (roleExpense.official || 0) + totalOfficialExpense;
    // [FIX] Update official labor stats
    roleLivingExpense.official = roleExpense.official; // Capture all official living expenses (Head Tax + Consumption)
    roleLaborIncome.official = totalOfficialLaborIncome;
    perfEnd('officialsSim');

    perfStart('livingStandards');
    const livingStandardsResult = calculateLivingStandards({
        popStructure: { ...popStructure, official: 0 }, // Exclude official to prevent double count/deduction
        wealth,
        classIncome: roleWagePayout,
        classExpense: roleExpense, // 新增：支出数据
        classShortages,
        epoch,
        techsUnlocked,
        priceMap: getPrice, // 传递价格获取函数
        livingStandardStreaks
    });

    // Manually inject official stats (derived from independent simulation)
    const updatedOfficialCount = updatedOfficials.length;
    if (updatedOfficialCount > 0) {
        const avgWealth = totalOfficialWealth / updatedOfficialCount;
        let pLevel = '赤贫';
        let pCap = 30;

        if (avgWealth > 300) { pLevel = '奢华'; pCap = 95; }
        else if (avgWealth > 100) { pLevel = '富裕'; pCap = 85; }
        else if (avgWealth > 50) { pLevel = '小康'; pCap = 75; }
        else if (avgWealth > 20) { pLevel = '温饱'; pCap = 60; }
        else { pLevel = '贫困'; pCap = 45; }

        const wealthRatio = avgWealth / 400;
        const styleMap = {
            '奢华': { icon: 'Crown', color: 'text-purple-400' },
            '富裕': { icon: 'Gem', color: 'text-blue-400' },
            '小康': { icon: 'Home', color: 'text-green-400' },
            '温饱': { icon: 'UtensilsCrossed', color: 'text-yellow-400' },
            '贫困': { icon: 'AlertTriangle', color: 'text-orange-400' },
            '赤贫': { icon: 'Skull', color: 'text-red-500' }
        };
        const style = styleMap[pLevel] || styleMap['赤贫'];

        livingStandardsResult.classLivingStandard.official = {
            level: pLevel,
            satisfaction: 1.0,
            satisfactionRate: 1.0,
            approvalCap: pCap,
            needsMet: 1.0,
            wealthRatio: wealthRatio,
            wealthPerCapita: avgWealth, // 修复：添加人均财富字段
            wealthMultiplier: Math.min(6, 1 + Math.log(Math.max(1, avgWealth / 100)) * 0.5), // 基于收入的消费能力
            icon: style.icon,
            color: style.color,
            bgColor: style.color.replace('text-', 'bg-').replace('-400', '-900/20'),
            borderColor: style.color.replace('text-', 'border-').replace('-400', '-500/30'),
            score: avgWealth > 300 ? 90 : avgWealth > 100 ? 75 : avgWealth > 50 ? 60 : avgWealth > 20 ? 45 : 25,
        };

        // Update streaks
        const prevStreak = livingStandardStreaks.official || {};
        const isSame = prevStreak.level === pLevel;
        livingStandardsResult.livingStandardStreaks.official = {
            level: pLevel,
            streak: isSame ? (prevStreak.streak || 0) + 1 : 1
        };
    }

    const classLivingStandard = livingStandardsResult.classLivingStandard;
    const updatedLivingStandardStreaks = livingStandardsResult.livingStandardStreaks;
    perfEnd('livingStandards');

    // [NEW] 累积税收冲击值：用于防止"快速抬税后降税"的漏洞
    // 当税率降低后，累积冲击会缓慢衰减，而非立即消失
    perfStart('approvalCalc');
    const updatedTaxShock = {};

    Object.keys(STRATA).forEach(key => {
        const count = popStructure[key] || 0;
        if (count === 0) return;
        const satisfactionInfo = needsReport[key];
        const satisfaction = satisfactionInfo?.satisfactionRatio ?? 1;

        // 获取生活水平对满意度的上限影响
        const livingStandard = classLivingStandard[key];
        let livingStandardApprovalCap = livingStandard?.approvalCap ?? 100;

        // 执政联盟阶层的approvalCap惩罚（期望提高）
        const isCoalition = isCoalitionMember(key, rulingCoalition);
        if (isCoalition) {
            const livingLevel = livingStandard?.level || '温饱';
            const penalty = getCoalitionApprovalCapPenalty(livingLevel, true);
            livingStandardApprovalCap = Math.max(0, livingStandardApprovalCap - penalty);
        }

        let targetApproval = 70; // Base approval

        // Scale base approval with living standard
        const livingLevel = livingStandard?.level;
        if (livingLevel === '奢华') targetApproval = 95;
        else if (livingLevel === '富裕') targetApproval = 85;
        else if (livingLevel === '小康') targetApproval = 75;

        if (isCoalition && bonuses.coalitionApproval) {
            targetApproval += bonuses.coalitionApproval;
        }

        // Tax Burden Logic
        const headRate = getHeadTaxRate(key);
        const headBase = STRATA[key]?.headTaxBase ?? 0.01;
        const taxPerCapita = Math.max(0, (roleHeadTaxPaid[key] || 0) / Math.max(1, count));
        const incomePerCapita = (roleWagePayout[key] || 0) / Math.max(1, count);
        const wealthPerCapita = (wealth[key] || 0) / Math.max(1, count);

        const taxBurdenFromIncome = incomePerCapita > 0.001 && taxPerCapita > incomePerCapita * 0.5;
        const canAffordFromWealth = wealthPerCapita > taxPerCapita * 100;

        if (taxBurdenFromIncome && !canAffordFromWealth) {
            targetApproval = Math.min(targetApproval, 40); // Tax burden cap
        } else if (headRate < 0.6) {
            targetApproval += 5; // Tax relief bonus
        }

        // 税收冲击：当人头税占存款比例过高时，产生反感
        // [FIX] 使用税前存款计算税收冲击，避免"榨干后无惩罚"的漏洞
        const headTaxPaidPerCapita = (roleHeadTaxPaid[key] || 0) / Math.max(1, count);
        // 税前人均存款用于TaxShock计算
        const preTaxWealthPerCapita = (preTaxWealth[key] || 0) / Math.max(1, count);
        // 税收占存款的比例（每天税收 / 税前人均存款）
        const taxToWealthRatio = preTaxWealthPerCapita > 0.01 ? headTaxPaidPerCapita / preTaxWealthPerCapita : 0;
        // 当税收超过存款的5%时开始产生冲击，超过20%时达到最大惩罚
        // [ENHANCED] 最大惩罚从25提升到50，更严厉惩罚压榨行为
        // 5%以下无惩罚，5%-20%线性增长到25，20%-100%继续增长到50
        const taxShockThreshold = 0.05; // 5%阈值
        const taxShockMaxRatio = 0.20;  // 20%达到中等惩罚
        const taxShockExtremeRatio = 1.0; // 100%达到最大惩罚
        let instantTaxShock = 0;
        if (taxToWealthRatio > taxShockThreshold && headTaxPaidPerCapita > 0) {
            if (taxToWealthRatio <= taxShockMaxRatio) {
                // 5%-20%: 0-25分线性增长
                instantTaxShock = ((taxToWealthRatio - taxShockThreshold) / (taxShockMaxRatio - taxShockThreshold)) * 25;
            } else {
                // 20%-100%: 25-50分线性增长
                instantTaxShock = 25 + Math.min(25, ((taxToWealthRatio - taxShockMaxRatio) / (taxShockExtremeRatio - taxShockMaxRatio)) * 25);
            }
        }

        // [NEW] 累积税收冲击机制：防止"快速抬税后降税"的漏洞
        // 原理：民众对被剥削的记忆不会因税率降低而立即消失
        // - 当前冲击会累加到历史累积值
        // - 历史累积值每tick衰减一定比例（模拟愤怒逐渐平息）
        // - 最终惩罚取当前冲击和累积冲击的较大值
        const prevAccumulatedShock = previousTaxShock[key] || 0;
        const taxShockDecayRate = 0.03; // 每tick衰减3%（约需23天衰减50%）
        const taxShockAccumulationRate = 0.5; // 当前冲击的50%会累加到历史值

        // 累积公式：旧累积 * (1 - 衰减率) + 新冲击 * 累积率
        const newAccumulatedShock = Math.max(0,
            prevAccumulatedShock * (1 - taxShockDecayRate) + instantTaxShock * taxShockAccumulationRate
        );
        updatedTaxShock[key] = newAccumulatedShock;

        // 最终惩罚：取即时冲击和累积冲击的较大值
        // 这确保了：
        // 1. 高税期间：即时冲击占主导
        // 2. 降税后：累积冲击继续生效，逐渐衰减
        const taxShockPenalty = Math.max(instantTaxShock, newAccumulatedShock);

        // Resource Shortage Logic - 区分基础需求和奢侈需求短缺
        const shortages = classShortages[key] || [];
        const basicShortages = shortages.filter(s => s.isBasic);
        const luxuryShortages = shortages.filter(s => !s.isBasic);
        const totalNeeds = satisfactionInfo?.totalTrackedNeeds ?? 0;

        // 基础需求短缺 - 严重惩罚
        if (basicShortages.length > 0 && totalNeeds > 0) {
            if (basicShortages.length >= Object.keys(STRATA[key]?.needs || {}).length) {
                // 所有基础需求都短缺 → 上限0
                targetApproval = Math.min(targetApproval, 0);
            } else {
                // 部分基础需求短缺 → 上限30
                targetApproval = Math.min(targetApproval, 30);
            }
        }

        // 奢侈需求短缺 - 较轻惩罚，与缺少数量相关
        // 每缺少1种奢侈品，惩罚-3，最多惩罚-15
        if (luxuryShortages.length > 0) {
            const luxuryPenalty = Math.min(15, luxuryShortages.length * 3);
            targetApproval -= luxuryPenalty;
        }

        const livingTracker = updatedLivingStandardStreaks[key] || {};
        if (livingTracker.level === '赤贫' || livingTracker.level === '贫困') {
            const penaltyBase = livingTracker.level === '赤贫' ? 2.5 : 1.5;
            const penalty = Math.min(30, Math.ceil((livingTracker.streak || 0) * penaltyBase));
            if (penalty > 0) {
                targetApproval -= penalty;
            }
        }

        // Sustained needs satisfaction bonus (reward consecutive ticks of high fulfillment)
        let sustainedBonus = 0;
        const needsHistory = (classNeedsHistory || {})[key];
        if (needsHistory && needsHistory.length > 0) {
            const threshold = 0.95;
            const maxWindow = 20;
            let consecutiveSatisfied = 0;
            for (let i = needsHistory.length - 1; i >= 0 && consecutiveSatisfied < maxWindow; i--) {
                if (needsHistory[i] >= threshold) {
                    consecutiveSatisfied += 1;
                } else {
                    break;
                }
            }
            if (consecutiveSatisfied >= 3) {
                sustainedBonus = Math.min(15, consecutiveSatisfied * 0.6);
                targetApproval = Math.min(100, targetApproval + sustainedBonus);
            }
        }

        // Wealth Trend Logic
        let trend = 0;
        let trendBonus = 0;
        const history = (classWealthHistory || {})[key];
        if (history && history.length >= 20) { // Check for 20 ticks of history
            const recentWealth = history.slice(-10).reduce((a, b) => a + b, 0) / 10;
            const pastWealth = history.slice(-20, -10).reduce((a, b) => a + b, 0) / 10;

            if (pastWealth > 1) { // Avoid division by zero or tiny numbers
                trend = (recentWealth - pastWealth) / pastWealth;
                trendBonus = Math.min(15, Math.abs(trend) * 50); // Scale bonus with trend, cap at 15

                if (trend > 0.05) { // Modest but sustained growth
                    targetApproval += trendBonus;
                } else if (trend < -0.05) { // Modest but sustained decline
                    targetApproval -= trendBonus;
                }
            }
        }

        // Positive satisfaction bonus
        if (satisfaction >= 0.98) {
            targetApproval = Math.min(100, targetApproval + 10);
        }

        // Unemployed penalty
        if (key === 'unemployed') {
            const ratio = count / Math.max(1, population);
            const penalty = 2 + ratio * 30;
            targetApproval -= penalty;
        }

        // Build per-stratum approval breakdown (so UI can explain *exactly* why approval is low)
        // Numbers represent contributions to target/current approval in this tick.
        approvalBreakdown[key] = {
            baseTarget: 0,
            livingStandardBase: 0,
            taxReliefBonus: 0,
            luxuryShortagePenalty: 0,
            povertyPenalty: 0,
            sustainedNeedsBonus: 0,
            wealthTrendBonus: 0,
            positiveSatisfactionBonus: 0,
            unemployedPenalty: 0,
            eventBonus: 0,
            decreeBonus: 0,
            officialTargetBonus: 0,
            legitimacyPenalty: 0,  // [NEW] 非法政府惩罚
            taxShockPenalty: 0,
            shockCapApplied: null,
            currentApprovalStart: 0,
            targetApprovalPreShockCap: 0,
            targetApprovalFinal: 0,
            adjustmentSpeed: 0.02,
            inertiaDelta: 0,
            effectiveApprovalCap: livingStandardApprovalCap,
            capApplied: null,
            approvalAfterCap: 0,
            approvalFinal: 0,
        };

        // Base / living standard target
        approvalBreakdown[key].baseTarget = 70;
        approvalBreakdown[key].livingStandardBase = (targetApproval - 70);

        // Tax relief bonus
        // (Only the explicit +5 is recorded here; tax burden cap effect is tracked via target changes elsewhere)
        if (headRate < 0.6) {
            approvalBreakdown[key].taxReliefBonus = 5;
        }

        // Luxury shortage penalty (if any)
        if ((luxuryShortages?.length || 0) > 0) {
            approvalBreakdown[key].luxuryShortagePenalty = -Math.min(15, luxuryShortages.length * 3);
        }

        // Poverty penalty (if any)
        if ((livingTracker?.level === '赤贫' || livingTracker?.level === '贫困')) {
            const penaltyBase = livingTracker.level === '赤贫' ? 2.5 : 1.5;
            const penalty = Math.min(30, Math.ceil((livingTracker.streak || 0) * penaltyBase));
            approvalBreakdown[key].povertyPenalty = -penalty;
        }

        // Sustained needs bonus
        if (sustainedBonus) {
            approvalBreakdown[key].sustainedNeedsBonus = sustainedBonus;
        }

        // Wealth trend bonus/penalty
        if (trendBonus && trend && Math.abs(trend) > 0.05) {
            approvalBreakdown[key].wealthTrendBonus = (trend > 0 ? trendBonus : -trendBonus);
        }

        // Positive satisfaction bonus
        if (satisfaction >= 0.98) {
            approvalBreakdown[key].positiveSatisfactionBonus = 10;
        }

        // Unemployed penalty
        if (key === 'unemployed') {
            const ratio = count / Math.max(1, population);
            const penalty = 2 + ratio * 30;
            approvalBreakdown[key].unemployedPenalty = -penalty;
        }

        // Event / decree / official
        const eventBonus = eventApprovalModifiers?.[key] || 0;
        if (eventBonus) {
            targetApproval += eventBonus;
            approvalBreakdown[key].eventBonus = eventBonus;
        }

        const decreeBonus = decreeApprovalModifiers[key] || 0;
        if (decreeBonus) {
            targetApproval += decreeBonus;
            approvalBreakdown[key].decreeBonus = decreeBonus;
        }

        const officialBonus = activeOfficialEffects?.approval?.[key] || 0;
        if (officialBonus > 0) {
            targetApproval += officialBonus;
            approvalBreakdown[key].officialTargetBonus = officialBonus;
        }

        // [FIX] 非法政府惩罚：使用上一tick的合法性来影响目标满意度
        // 而不是在惯性计算之后直接扣除当前好感度（这会导致无限下降的BUG）
        const prevLegitimacyModifier = getLegitimacyApprovalModifier(previousLegitimacy);
        if (prevLegitimacyModifier < 0) {
            targetApproval += prevLegitimacyModifier;  // 应用到目标，通过惯性缓慢影响
            approvalBreakdown[key].legitimacyPenalty = prevLegitimacyModifier;
        }

        // Effective cap (negative official bonus reduces cap)
        let effectiveApprovalCap = livingStandardApprovalCap;
        if (officialBonus < 0) {
            effectiveApprovalCap = Math.max(0, livingStandardApprovalCap + officialBonus);
        }
        approvalBreakdown[key].effectiveApprovalCap = effectiveApprovalCap;

        let currentApproval = classApproval[key] || 50;
        approvalBreakdown[key].currentApprovalStart = currentApproval;
        approvalBreakdown[key].adjustmentSpeed = 0.02;

        // Tax shock (applies to current approval, and may apply an extra cap)
        if (taxShockPenalty > 1) {
            currentApproval = Math.max(0, currentApproval - taxShockPenalty);
            approvalBreakdown[key].taxShockPenalty = -taxShockPenalty;

            // [ENHANCED] 冲击越大上限越低，最低可到0（极端压榨将引发彻底反感）
            if (taxShockPenalty > 5) {
                const shockCap = Math.max(0, 70 - taxShockPenalty * 2);
                approvalBreakdown[key].shockCapApplied = shockCap;
                targetApproval = Math.min(targetApproval, shockCap);
            }
        }

        approvalBreakdown[key].targetApprovalPreShockCap = targetApproval;
        approvalBreakdown[key].targetApprovalFinal = targetApproval;

        // Inertia move towards target
        const adjustmentSpeed = 0.02; // How slowly approval changes per tick
        let newApproval = currentApproval + (targetApproval - currentApproval) * adjustmentSpeed;
        approvalBreakdown[key].inertiaDelta = (newApproval - currentApproval);

        // Apply cap
        const beforeCap = newApproval;
        newApproval = Math.min(newApproval, effectiveApprovalCap);
        if (newApproval !== beforeCap) {
            approvalBreakdown[key].capApplied = effectiveApprovalCap;
        }
        approvalBreakdown[key].approvalAfterCap = newApproval;

        approvalBreakdown[key].approvalFinal = Math.max(0, Math.min(100, newApproval));

        classApproval[key] = Math.max(0, Math.min(100, newApproval));
    });

    if ((popStructure.unemployed || 0) === 0 && previousApproval.unemployed !== undefined) {
        classApproval.unemployed = Math.min(100, previousApproval.unemployed + 5);
    }
    perfEnd('socialEconomy');
    perfEnd('approvalCalc');


    let nextPopulation = population;
    let raidPopulationLoss = 0;

    // Wealth Decay (Lifestyle Inflation)
    // Prevents infinite accumulation by "burning" a small percentage of wealth daily
    // representing maintenance, services, and non-goods consumption.
    // NEW: Decay is based on per-capita wealth percentage, not total wealth
    perfStart('wealthDecay');
    Object.keys(STRATA).forEach(key => {
        const currentWealth = wealth[key] || 0;
        const population = popStructure[key] || 0;

        if (currentWealth > 0 && population > 0) {
            // Check living standard to see if decay should apply
            // Only apply decay if living standard is at least "Comfortable" (小康)
            // Levels: 赤贫 (Destitute), 贫困 (Poor), 温饱 (Subsistence), 小康 (Comfortable)...
            const standard = classLivingStandard[key];
            const level = standard?.level;

            // Skip decay for Destitute, Poor, and Subsistence
            if (level === '赤贫' || level === '贫困' || level === '温饱') {
                return;
            }

            // Calculate per-capita wealth and apply decay rate
            // 根据生活水平档位设置不同的挥霍率，刚进入小康时挥霍很少
            const perCapitaWealth = currentWealth / population;
            const wealthRatio = WEALTH_BASELINE > 0 ? perCapitaWealth / WEALTH_BASELINE : 0;

            // Safeguard: Only apply decay if they have accumulated some wealth buffer (e.g. > 120% baseline)
            // This prevents "newly comfortable" strata from immediately losing their savings
            if (wealthRatio < 1.2 && level !== '奢华') {
                return;
            }

            let decayRate = WEALTH_DECAY_RATE; // 默认0.5% (奢华)
            if (level === '小康') {
                decayRate = 0.001; // 0.1% - 刚进入小康，挥霍很少
            } else if (level === '富裕') {
                decayRate = 0.003; // 0.3% - 开始享受生活
            }
            // '奢华' 保持默认的0.5%

            const perCapitaDecay = perCapitaWealth * decayRate;
            // Removed Math.max(1, floor(...)) to allow fractional decay and prevent subsidy waste
            // Use toFixed(2) for clean display and deduction
            const rawDecay = perCapitaDecay * population;
            let decay = parseFloat(rawDecay.toFixed(2));

            // [NEW] Cap decay at 50% of current tick's luxury spending
            // Represents that lavish spending (waste) cannot exceed a fraction of actual luxury consumption
            let totalLuxurySpend = 0;
            if (classFinancialData[key] && classFinancialData[key].expense && classFinancialData[key].expense.luxuryNeeds) {
                Object.values(classFinancialData[key].expense.luxuryNeeds).forEach(item => {
                    totalLuxurySpend += (item.cost || 0);
                });
            }
            const maxDecay = parseFloat((totalLuxurySpend * 0.5).toFixed(2));
            decay = Math.min(decay, maxDecay);

            if (decay > 0) {
                ledger.transfer(key, 'void', decay, TRANSACTION_CATEGORIES.EXPENSE.DECAY, TRANSACTION_CATEGORIES.EXPENSE.DECAY);
                // Record decay as expense so UI balances
                roleExpense[key] = (roleExpense[key] || 0) + decay;
            }
        }
    });

    perfStart('influenceCalc');
    // [FIX] Apply safe wealth limit to ALL strata wealth values before returning
    // This is the final safety net to prevent any overflow that might have slipped through
    Object.keys(STRATA).forEach(key => {
        classWealthResult[key] = safeWealth(wealth[key] || 0);
    });

    let totalWealth = Object.values(classWealthResult).reduce((sum, val) => sum + val, 0);

    Object.keys(STRATA).forEach(key => {
        const count = popStructure[key] || 0;
        if (count === 0) return;
        const def = STRATA[key];
        const wealthShare = classWealthResult[key] || 0;
        const wealthFactor = totalWealth > 0 ? wealthShare / totalWealth : 0;
        classInfluence[key] = (def.influenceBase * count) + (wealthFactor * 10);
    });

    const baseTotalInfluence = Object.values(classInfluence).reduce((sum, val) => sum + val, 0);

    // 应用官员对出身阶层的影响力加成（方案A：直接增加“绝对影响力点数”，避免后期被阶层基数稀释）
    const officialInfluencePoints = getOfficialInfluencePoints(officials || [], officialsPaid, {
        classInfluence,
        totalInfluence: baseTotalInfluence,
        polityEffects: currentPolityEffects,
        currentDay: tick,
    });
    Object.entries(officialInfluencePoints).forEach(([stratum, points]) => {
        if (classInfluence[stratum] !== undefined && points > 0) {
            classInfluence[stratum] += points;
        }
    });

    let totalInfluence = Object.values(classInfluence).reduce((sum, val) => sum + val, 0);

    // 执政联盟合法性精确计算（影响力已计算完成）
    const coalitionInfluenceShare = calculateCoalitionInfluenceShare(rulingCoalition, classInfluence, totalInfluence);
    coalitionLegitimacy = calculateLegitimacy(coalitionInfluenceShare);
    if (bonuses.legitimacyBonus) {
        coalitionLegitimacy = Math.max(0, Math.min(100, coalitionLegitimacy * (1 + bonuses.legitimacyBonus)));
    }
    legitimacyTaxModifier = getLegitimacyTaxModifier(coalitionLegitimacy);
    const legitimacyApprovalModifier = getLegitimacyApprovalModifier(coalitionLegitimacy);
    perfEnd('influenceCalc');

    // [FIX BUG] 非法政府满意度惩罚的应用方式已改变：
    // 之前的 BUG: 每个 tick 都直接从当前好感度扣除 -15，导致无限下降
    // 修复: 惩罚已在上方惯性计算循环中应用到 targetApproval，这里不再重复应用
    // 保留此处代码注释以说明设计意图
    // NOTE: legitimacyApprovalModifier 现在应该在 approvalBreakdown 中体现（需要在上方循环添加）

    perfStart('exodusAndPenalties');
    let exodusPopulationLoss = 0;
    let extraStabilityPenalty = 0;
    if (bonuses.factionConflict) {
        extraStabilityPenalty += bonuses.factionConflict;
    }
    // 修正人口外流（Exodus）：愤怒人口离开时带走财富（资本外逃）
    Object.keys(STRATA).forEach(key => {
        const count = popStructure[key] || 0;
        if (count === 0) return;
        const approval = classApproval[key] || 50;
        if (approval >= 25) return;
        const influenceShare = totalInfluence > 0 ? (classInfluence[key] || 0) / totalInfluence : 0;
        const className = STRATA[key]?.name || key;
        if (approval < 20 && influenceShare < 0.07) {
            const leavingRate = Math.max(0.03, (20 - approval) / 200);
            const leaving = Math.min(count, Math.max(1, Math.floor(count * leavingRate)));
            if (leaving > 0) {
                const currentWealth = wealth[key] || 0;
                const perCapWealth = count > 0 ? currentWealth / count : 0;
                const fleeingCapital = perCapWealth * leaving;

                // 关键修改：扣除离开人口带走的财富（资本外逃）
                // Note: This is NOT recorded as expense because it's population movement,
                // not economic activity. The wealth moves with the people leaving.
                if (fleeingCapital > 0) {
                    ledger.transfer(key, 'void', fleeingCapital, TRANSACTION_CATEGORIES.EXPENSE.CAPITAL_FLIGHT, TRANSACTION_CATEGORIES.EXPENSE.CAPITAL_FLIGHT);
                }

                // [FIX] 同步更新popStructure，确保人口真正从该阶层移除
                // 这样房屋/岗位才能空出来被新人填补
                popStructure[key] = Math.max(0, count - leaving);
            }
            exodusPopulationLoss += leaving;

            // 生成详细的短缺原因日志
            const shortageDetails = (classShortages[key] || []).map(shortage => {
                const resKey = typeof shortage === 'string' ? shortage : shortage.resource;
                const reason = typeof shortage === 'string' ? 'outOfStock' : shortage.reason;
                const resName = RESOURCES[resKey]?.name || resKey;

                if (reason === 'unaffordable') {
                    return `${resName}(买不起)`;
                } else if (reason === 'outOfStock') {
                    return `${resName}(缺货)`;
                } else if (reason === 'both') {
                    return `${resName}(缺货且买不起)`;
                }
                return resName;
            }).join('、');

            const shortageMsg = shortageDetails ? `，短缺资源：${shortageDetails}` : '';
            logs.push(`${className} 阶层对政局失望，${leaving} 人离开了国家，带走了 ${(leaving * (wealth[key] || 0) / Math.max(1, count)).toFixed(1)} 银币${shortageMsg}。`);
        } else if (influenceShare >= 0.12) {
            const penalty = Math.min(0.2, 0.05 + influenceShare * 0.15);
            extraStabilityPenalty += penalty;

            // 为稳定度惩罚也添加短缺详情
            const shortageDetails = (classShortages[key] || []).map(shortage => {
                const resKey = typeof shortage === 'string' ? shortage : shortage.resource;
                const reason = typeof shortage === 'string' ? 'outOfStock' : shortage.reason;
                const resName = RESOURCES[resKey]?.name || resKey;

                if (reason === 'unaffordable') {
                    return `${resName}(买不起)`;
                } else if (reason === 'outOfStock') {
                    return `${resName}(缺货)`;
                } else if (reason === 'both') {
                    return `${resName}(缺货且买不起)`;
                }
                return resName;
            }).join('、');

            const shortageMsg = shortageDetails ? `（短缺：${shortageDetails}）` : '';
            logs.push(`${className} 阶层的愤怒正在削弱社会稳定${shortageMsg}。`);
        }
    });
    perfEnd('exodusAndPenalties');

    perfStart('buffsDebuffs');
    const newActiveBuffs = [];
    const newActiveDebuffs = [];

    Object.keys(STRATA).forEach(key => {
        const def = STRATA[key];
        if (!def.buffs || (popStructure[key] || 0) === 0) return;
        const approval = classApproval[key] || 50;
        const satisfiedNeeds = (needsReport[key]?.satisfactionRatio ?? 1) >= 0.9;
        const influenceShare = totalInfluence > 0 ? (classInfluence[key] || 0) / totalInfluence : 0;
        const buffMultiplier = influenceShare > 0.8 ? 2 : influenceShare > 0.5 ? 1.5 : 1;
        const hasInfluenceBuffPrivilege = approval >= 85 && influenceShare >= 0.3;
        const meetsStandardBuffCondition = approval >= 85 && satisfiedNeeds;

        if ((hasInfluenceBuffPrivilege || meetsStandardBuffCondition) && def.buffs.satisfied) {
            const scaledBuff = scaleEffectValues(def.buffs.satisfied, buffMultiplier);
            newActiveBuffs.push({
                class: key,
                ...scaledBuff,
            });
        } else if (approval < 40 && def.buffs.dissatisfied && influenceShare >= 0.3) {
            const scaledDebuff = scaleEffectValues(def.buffs.dissatisfied, buffMultiplier);
            newActiveDebuffs.push({
                class: key,
                ...scaledDebuff,
            });
        }
    });

    // REFACTORED: Using module function for stability calculation
    // This ensures consistency and proper application of all bonuses (including festivals)
    perfStart('stabilityCalc');
    const {
        stabilityValue,
        targetStability,
        efficiency,
        stabilityFactor
    } = calculateStabilityFromModule({
        popStructure,
        classApproval,
        classInfluence,
        totalInfluence,
        newActiveBuffs,
        newActiveDebuffs,
        eventStabilityModifier,
        extraStabilityPenalty,
        currentStability,
        stabilityBonus: bonuses.stabilityBonus || 0
    });
    perfEnd('buffsDebuffs');
    perfEnd('wealthDecay');
    perfEnd('stabilityCalc');

    const visibleEpoch = epoch;
    // 记录本回合来自战争赔款（含分期）的财政收入
    let warIndemnityIncome = 0;
    const playerPopulationBaseline = Math.max(5, population || 5);
    const playerWealthBaseline = Math.max(100, (res.silver ?? resources?.silver ?? 0));

    // Track global peace request cooldown - find the most recent peace request across all nations
    // This prevents multiple AI nations from spamming peace requests simultaneously
    let lastGlobalPeaceRequest = -Infinity;
    const shouldUpdatePrices = shouldRunThisTick(tick, 'priceUpdate');
    const shouldUpdateTrade = shouldRunThisTick(tick, 'tradeUpdate');
    const shouldUpdateDiplomacy = shouldRunThisTick(tick, 'diplomacyUpdate');
    const shouldUpdateAI = shouldRunThisTick(tick, 'aiDecision');
    const shouldUpdateMerchantTrade = shouldRunThisTick(tick, 'merchantTrade');
    (nations || []).forEach(n => {
        if (n.lastPeaceRequestDay && n.lastPeaceRequestDay > lastGlobalPeaceRequest) {
            lastGlobalPeaceRequest = n.lastPeaceRequestDay;
        }
    });

    let updatedOrganizations = diplomacyOrganizations?.organizations ? [...diplomacyOrganizations.organizations] : [];
    let organizationUpdatesOccurred = false;

    perfStart('aiNationUpdate');
    const aiSliceCount = Math.max(1, RATE_LIMIT_CONFIG.aiNationUpdateSlices || 1);
    const aiTargets = getSlice(nations || [], aiSliceCount);
    const aiTargetIds = new Set(aiTargets.map(n => n?.id));

    let updatedNations = (nations || []).map(nation => {
        const next = { ...nation };
        const shouldProcessAIForNation = next.id === 'player' || aiTargetIds.has(next.id);

        // [UI COMPATIBILITY] Derive alliedWithPlayer from organization membership
        next.alliedWithPlayer = updatedOrganizations.some(org =>
            org.type === 'military_alliance' &&
            org.members.includes(nation.id) &&
            org.members.includes('player')
        );

        // Apply manual trade deltas (from processManualTradeRoutes)
        if (tradeRouteSummary?.nationDelta && tradeRouteSummary.nationDelta[nation.id]) {
            const delta = tradeRouteSummary.nationDelta[nation.id];
            next.budget = Math.max(0, (next.budget || 0) + (delta.budget || 0));
            next.relation = Math.min(100, Math.max(-100, (next.relation || 0) + (delta.relation || 0)));
            if (delta.inventory) {
                next.inventory = next.inventory || {};
                Object.entries(delta.inventory).forEach(([k, v]) => {
                    next.inventory[k] = Math.max(0, (next.inventory[k] || 0) + v);
                });
            }
        }

        // [MODIFIED] AI国家不再因时代过期而消失，发展完全独立
        const isVisibleToPlayer = visibleEpoch >= (nation.appearEpoch ?? 0)
            && (nation.expireEpoch == null || visibleEpoch <= nation.expireEpoch);
        if (!isVisibleToPlayer) {
            if (next.isAtWar) {
                next.isAtWar = false;
                next.warScore = 0;
                next.warDuration = 0;
                next.warStartDay = null;
                next.enemyLosses = 0;
                next.warTarget = null;
                next.isPeaceRequesting = false;
                next.peaceTribute = null;
            }
            return next;
        }

        // ========================================================================
        // [PERFORMANCE OPTIMIZATION] Skip all AI logic for destroyed nations
        // Annexed nations or nations with zero population should not execute any simulation
        // This prevents "unknown nations" in alliances and reduces CPU usage
        // ========================================================================
        const isDestroyedNation = next.isAnnexed || (next.population || 0) <= 0;
        if (isDestroyedNation) {
            // Clear any ongoing wars or diplomatic actions
            if (next.isAtWar) {
                next.isAtWar = false;
                next.warScore = 0;
                next.warDuration = 0;
                next.warStartDay = null;
                next.enemyLosses = 0;
                next.warTarget = null;
                next.isPeaceRequesting = false;
                next.peaceTribute = null;
                next.warTotalExpense = 0;
            }
            // Clear foreign wars
            if (next.foreignWars) {
                next.foreignWars = {};
            }
            // Clear installment payments
            if (next.installmentPayment) {
                next.installmentPayment = null;
            }
            // Clear any diplomatic actions
            next.relation = 0;
            next.alliedWithPlayer = false;
            
            // Skip all AI simulation for this nation
            return next;
        }

        // Initialize nation epoch if not present (Independent AI Era System)
        if (next.epoch === undefined) {
            // If already initialized (legacy save), sync to global epoch once to maintain status quo
            if (next.foreignPower?.initializedAtTick) {
                next.epoch = visibleEpoch;
            } else {
                // New spawn: start at its historical appearance era
                next.epoch = next.appearEpoch ?? 0;
            }
        }

        processNationTreaties({ nation: next, tick, resources: res, logs, onTreasuryChange: trackSilverChange });

        if (next.isRebelNation) {
            // REFACTORED: Using module function for rebel economy initialization
            initializeRebelEconomy(next);

            // REFACTORED: Using module function for rebel war actions
            if (next.isAtWar) {
                const rebelResult = processRebelWarActions({
                    nation: next,
                    tick,
                    epoch,
                    resources: res,
                    population,
                    army,
                    logs,
                    onTreasuryChange: trackSilverChange,
                    onResourceChange: onResourceChangeCallback,
                });
                raidPopulationLoss += rebelResult.raidPopulationLoss;
            }

            // REFACTORED: Using module function for rebel surrender check
            checkRebelSurrender({ nation: next, tick, logs });

            return next;
        }

        next.foreignPower = { ...(next.foreignPower || {}) };
        const foreignPowerProfile = next.foreignPower;
        const templateWealth = next.wealthTemplate || next.wealth || 800;
        if (foreignPowerProfile.baseRating == null) {
            foreignPowerProfile.baseRating = Math.max(0.4, templateWealth / 800);
        }
        const resolvedVolatility = Math.min(
            0.9,
            Math.max(0.1, foreignPowerProfile.volatility ?? next.marketVolatility ?? 0.3)
        );
        foreignPowerProfile.volatility = resolvedVolatility;
        if (foreignPowerProfile.appearEpoch == null) {
            foreignPowerProfile.appearEpoch = next.appearEpoch ?? 0;
        }
        if (foreignPowerProfile.populationFactor == null) {
            const agricultureBoost = next.culturalTraits?.agriculturalFocus ? 1.15 : 1;
            foreignPowerProfile.populationFactor = clamp(
                foreignPowerProfile.baseRating * agricultureBoost,
                0.6,
                2.5
            );
        }
        if (foreignPowerProfile.wealthFactor == null) {
            const eraBoost = 1 + Math.max(0, foreignPowerProfile.appearEpoch) * 0.05;
            foreignPowerProfile.wealthFactor = clamp(
                foreignPowerProfile.baseRating * eraBoost,
                0.5,
                3.5
            );
        }

        if (!foreignPowerProfile.initializedAtTick) {
            const eraGap = Math.max(0, visibleEpoch - (foreignPowerProfile.appearEpoch ?? 0));
            const eraBonus = 1 + eraGap * 0.08;
            
            // [MODIFIED] Generate dynamic strength relative to player
            // Some nations will be weaker (0.3-0.9x), some similar (0.9-1.5x), some stronger (1.5-10x)
            const strengthRoll = Math.random();
            let strengthMultiplier;
            
            if (strengthRoll < 0.3) {
                // 30% chance: Weak nation (0.3-0.9x player strength)
                strengthMultiplier = 0.3 + Math.random() * 0.6;
            } else if (strengthRoll < 0.6) {
                // 30% chance: Similar strength (0.9-1.5x player strength)
                strengthMultiplier = 0.9 + Math.random() * 0.6;
            } else if (strengthRoll < 0.85) {
                // 25% chance: Strong nation (1.5-3x player strength)
                strengthMultiplier = 1.5 + Math.random() * 1.5;
            } else {
                // 15% chance: Very strong nation (3-10x player strength)
                strengthMultiplier = 3 + Math.random() * 7;
            }
            
            // Apply nation's base characteristics and era bonus
            const basePopFactor = foreignPowerProfile.populationFactor * eraBonus;
            const baseWealthFactor = foreignPowerProfile.wealthFactor * eraBonus;
            
            // Combine with strength multiplier
            const popFactor = clamp(
                basePopFactor * strengthMultiplier,
                0.3,  // Allow weaker nations
                10.0  // Allow much stronger nations
            );
            const wealthFactor = clamp(
                baseWealthFactor * strengthMultiplier,
                0.3,  // Allow weaker nations
                10.0  // Allow much stronger nations
            );
            
            const basePopInit = Math.max(3, Math.round(playerPopulationBaseline * popFactor));
            const baseWealthInit = Math.max(100, Math.round(playerWealthBaseline * wealthFactor));
            next.population = basePopInit;
            next.wealth = baseWealthInit;
            next.budget = Math.max(50, baseWealthInit * 0.5);
            next.economyTraits = {
                ...(next.economyTraits || {}),
                basePopulation: basePopInit,
                baseWealth: baseWealthInit,
            };
            foreignPowerProfile.populationFactor = popFactor;
            foreignPowerProfile.wealthFactor = wealthFactor;
            foreignPowerProfile.initializedAtTick = tick;
            foreignPowerProfile.playerSnapshot = {
                population: playerPopulationBaseline,
                wealth: playerWealthBaseline,
            };
            if (!next.wealthTemplate) {
                next.wealthTemplate = baseWealthInit;
            }
        }

        if (!shouldProcessAIForNation) {
            return next;
        }

        // REFACTORED: Using module function for foreign economy simulation
        if (shouldUpdateTrade) {
            updateAINationInventory({ nation: next, tick, gameSpeed });
        }
        if (next.isAtWar) {
            next.warDuration = (next.warDuration || 0) + 1;
            // 累计与该国战争期间的军费支出（用于战争赔款计算）
            // 注意：如果同时与多个国家交战，军费按国家数量分摊
            const warringNationsCount = (nations || []).filter(n => n.isAtWar).length || 1;
            const dailyExpenseShare = (armyExpenseResult?.dailyExpense || 0) / warringNationsCount;
            next.warTotalExpense = (next.warTotalExpense || 0) + dailyExpenseShare;

            if (visibleEpoch >= 1 && shouldUpdateAI) {
                // REFACTORED: Using module function for AI military action
                const militaryResult = processAIMilitaryAction({
                    nation: next,
                    tick,
                    epoch,
                    resources: res,
                    army,
                    logs,
                    difficultyLevel: difficulty,
                    onTreasuryChange: trackSilverChange,
                    onResourceChange: onResourceChangeCallback,
                });
                raidPopulationLoss += militaryResult.raidPopulationLoss;
            }
            // REFACTORED: Using module function for AI peace request check
            // Pass global cooldown to prevent multiple nations from requesting peace simultaneously
            if (shouldUpdateAI) {
                const peaceRequested = checkAIPeaceRequest({ nation: next, tick, lastGlobalPeaceRequest, logs });
                if (peaceRequested) {
                    lastGlobalPeaceRequest = tick; // Update global cooldown for subsequent nations
                }

                // REFACTORED: Using module function for AI surrender demand check
                // 传入玩家财富，使赔款计算与玩家主动求和时一致
                checkAISurrenderDemand({ nation: next, tick, population, playerWealth: playerWealthBaseline, logs });

                // Check if AI should offer unconditional peace when player is in desperate situation
                checkMercyPeace({ nation: next, tick, population, playerWealth: playerWealthBaseline, resources: res, logs });
            }
        } else if (next.warDuration) {
            next.warDuration = 0;
            next.warTotalExpense = 0; // 清除战争军费记录
        }
        const relation = next.relation ?? 50;

        // REFACTORED: Using module function for relation decay
        if (shouldUpdateDiplomacy) {
            processNationRelationDecay(next, difficulty);
        }

        const relationMultipliers = getRelationChangeMultipliers(difficulty);

        if (bonuses.diplomaticIncident && !next.isRebelNation && !next.isAtWar) {
            // On hard: worsening is easier
            const dailyPenalty = (bonuses.diplomaticIncident / 30) * relationMultipliers.bad;
            next.relation = Math.min(100, Math.max(0, (next.relation ?? 50) - dailyPenalty));
        }

        // 应用官员和政治立场的外交加成到玩家与AI的关系
        if (bonuses.diplomaticBonus && !next.isRebelNation && !next.isAtWar) {
            // On hard: improving is harder
            const dailyBonus = (bonuses.diplomaticBonus / 30) * relationMultipliers.good;
            next.relation = Math.min(100, Math.max(0, (next.relation ?? 50) + dailyBonus));
        }

        // REFACTORED: Using module function for AI alliance breaking check
        if (shouldUpdateDiplomacy) {
            const breakResult = checkAIBreakAlliance(next, logs, { organizations: updatedOrganizations });
            if (breakResult && breakResult.memberLeaveRequests) {
                breakResult.memberLeaveRequests.forEach(req => {
                    const orgIndex = updatedOrganizations.findIndex(o => o.id === req.orgId);
                    if (orgIndex >= 0) {
                        const org = updatedOrganizations[orgIndex];
                        updatedOrganizations[orgIndex] = {
                            ...org,
                            members: org.members.filter(m => m !== req.nationId)
                        };
                        organizationUpdatesOccurred = true;
                    }
                });
            }
        }

        const aggression = next.aggression ?? 0.2;
        const hostility = Math.max(0, (50 - relation) / 70);
        const unrest = stabilityValue < 35 ? 0.02 : 0;


        // REFACTORED: Using module function for war declaration check
        if (shouldUpdateAI) {
            checkWarDeclaration({
                nation: next,
                nations,
                tick,
                epoch: visibleEpoch,
                resources: res,
                stabilityValue,
                logs,
                difficultyLevel: difficulty,
                diplomacyOrganizations: { organizations: updatedOrganizations }, // [NEW] Pass organization state
            });
        }


        // REFACTORED: Using module function for installment payment
        warIndemnityIncome += processInstallmentPayment({
            nation: next,
            resources: res,
            logs,
            onTreasuryChange: trackSilverChange,
        });

        // REFACTORED: Using module function for post-war recovery
        processPostWarRecovery(next);

        // REFACTORED: Using module functions for AI development system
        if (shouldUpdateTrade) {
            initializeAIDevelopmentBaseline({ nation: next, tick });
            processAIIndependentGrowth({ nation: next, tick, difficulty });

            // [NEW] Check for independent epoch progression
            checkAIEpochProgression(next, logs);

            updateAIDevelopment({
                nation: next,
                epoch: next.epoch, // [MODIFIED] Use nation's own epoch for development
                playerPopulationBaseline,
                playerWealthBaseline,
                tick,
                difficulty,
            });
        }

        return next;
    });
    perfEnd('aiNationUpdate');


    // REFACTORED: Using module function for foreign relations initialization
    updatedNations = initializeForeignRelations(updatedNations);


    // REFACTORED: Using module function for monthly relation decay
    const isMonthTick = tick % 30 === 0;
    if (isMonthTick && shouldUpdateDiplomacy) {
        perfStart('monthlyRelationDecay');
        updatedNations = processMonthlyRelationDecay(updatedNations, difficulty);
        perfEnd('monthlyRelationDecay');
    }

    // ========================================================================
    // [PERFORMANCE OPTIMIZATION] Periodic cleanup of destroyed nations
    // Remove annexed nations with zero population every 100 days to reduce memory usage
    // ========================================================================
    const isCleanupTick = tick % 100 === 0;
    if (isCleanupTick) {
        const beforeCount = updatedNations.length;
        updatedNations = updatedNations.filter(n => {
            // Always keep player
            if (n.id === 'player') return true;
            // Remove annexed nations with zero or negative population
            if (n.isAnnexed && (n.population || 0) <= 0) {
                logs.push(`🗑️ 国家 "${n.name}" 已被完全清除（已吞并且人口为0）。`);
                return false;
            }
            return true;
        });
        const removedCount = beforeCount - updatedNations.length;
        if (removedCount > 0) {
            logs.push(`♻️ 系统清理：移除了 ${removedCount} 个已消失的国家，优化性能。`);
        }
    }

    // ========================================================================
    // INTERNATIONAL ORGANIZATION MONTHLY UPDATE (Phase 2 Integration)
    // Process organization membership fees and effects
    // ========================================================================
    let organizationUpdateResult = null;
    if (isMonthTick && shouldUpdateDiplomacy && diplomacyOrganizations?.organizations?.length > 0) {
        perfStart('orgMonthly');
        organizationUpdateResult = processOrganizationMonthlyUpdate({
            organizations: diplomacyOrganizations.organizations,
            nations: updatedNations,
            playerWealth: res.silver || 0,
            daysElapsed: tick,
        });

        // 扣除组织成员费
        if (organizationUpdateResult.fees.player > 0) {
            const feeToDeduct = Math.min(res.silver || 0, organizationUpdateResult.fees.player);
            if (feeToDeduct > 0) {
                applySilverChange(-feeToDeduct, 'organization_membership_fee');
            }
        }

        // 更新AI国家的费用
        if (organizationUpdateResult.fees.ai) {
            for (const [nationId, fee] of Object.entries(organizationUpdateResult.fees.ai)) {
                const nation = updatedNations.find(n => n.id === nationId);
                if (nation) {
                    nation.wealth = Math.max(0, (nation.wealth || 0) - fee);
                }
            }
        }

        // 添加日志
        organizationUpdateResult.logs.forEach(log => logs.push(log));
        perfEnd('orgMonthly');
    }

    // ========================================================================
    // POPULATION MIGRATION MONTHLY UPDATE (Phase 2 Integration)
    // Process international population movement
    // ========================================================================
    let populationMigrationResult = null;
    if (isMonthTick && shouldUpdateDiplomacy) {
        perfStart('migrationMonthly');
        populationMigrationResult = processMonthlyMigration({
            nations: updatedNations,
            epoch,
            playerPopulation: nextPopulation,
            playerResources: res,
            classApproval: previousApproval,
            daysElapsed: tick,
            maxPop: totalMaxPop, // [NEW] Pass maxPop for cap enforcement
        });

        // 应用人口变化
        if (populationMigrationResult.immigrantsIn > 0 || populationMigrationResult.emigrantsOut > 0) {
            const netMigration = populationMigrationResult.immigrantsIn - populationMigrationResult.emigrantsOut;
            nextPopulation = Math.max(10, nextPopulation + netMigration);

            // 应用人口结构变化
            if (Object.keys(populationMigrationResult.byStratum).length > 0) {
                popStructure = applyMigrationToPopStructure(
                    popStructure,
                    populationMigrationResult.byStratum,
                    nextPopulation - netMigration  // 变化前的人口
                );
            }

            // 添加移民日志
            const migrationLogs = generateMigrationLogs(populationMigrationResult.events);
            migrationLogs.forEach(log => logs.push(log));
        }
        perfEnd('migrationMonthly');
    }

    // ========================================================================
    // REBELLION SYSTEM DAILY UPDATE (Phase 4 Integration)
    // Process AI nation stability, dissident organization, and civil wars
    // ========================================================================
    let rebellionSystemResult = null;
    if (shouldUpdateDiplomacy) {
        perfStart('rebellionDaily');
        rebellionSystemResult = processRebellionSystemDaily(updatedNations, {
            daysElapsed: tick,
            epoch,
        });

        // 应用叛乱系统更新
        if (rebellionSystemResult && rebellionSystemResult.updates) {
            for (const update of rebellionSystemResult.updates) {
                const nationIndex = updatedNations.findIndex(n => n.id === update.id);
                if (nationIndex >= 0) {
                    updatedNations[nationIndex] = {
                        ...updatedNations[nationIndex],
                        ...update,
                    };
                }
            }
        }

        // 处理叛乱事件
        if (rebellionSystemResult && rebellionSystemResult.events) {
            for (const event of rebellionSystemResult.events) {
                if (event.type === 'civil_war_started') {
                    logs.push(`⚔️ ${event.nationName} 爆发内战！反对派势力与政府军交战中...`);
                } else if (event.type === 'civil_war_ended') {
                    if (event.winner === 'rebels') {
                        logs.push(`🏴 ${event.nationName} 的叛军取得胜利，政权更迭为${event.newGovernment || '新政府'}！`);
                    } else {
                        logs.push(`🏛️ ${event.nationName} 的政府军平定叛乱，恢复秩序。`);
                    }
                }
            }
        }
        perfEnd('rebellionDaily');
    }

    // ========================================================================
    // VASSAL SYSTEM DAILY UPDATE
    // Ensure vassal social structure updates and apply independence/tribute logic
    // ========================================================================
    perfStart('vassalUpdates');
    const vassalMarketPrices = market?.prices || {};
    const playerAtWar = updatedNations.some(n => n.isAtWar && n.warTarget === 'player');
    const playerMilitary = Object.values(army || {}).reduce((sum, count) => sum + count, 0) / 100;
    
    // 构建满意度上限计算所需的上下文
    const satisfactionContext = {
        suzereainWealth: res.silver || 10000,
        suzereainPopulation: population || 1000000,
        suzereainMilitary: playerMilitary,
        suzereainAtWar: playerAtWar,
        suzereainReputation: diplomaticReputation ?? 50, // Use actual reputation value
        hasIndependenceSupport: false,  // TODO: 可以检查是否有支持独立的势力
    };
    
    updatedNations = updatedNations.map(nation => {
        if (nation.vassalOf !== 'player') return nation;
        const initialized = initializeNationEconomyData({ ...nation }, vassalMarketPrices);
        return updateNationEconomyData(initialized, vassalMarketPrices, satisfactionContext);
    });

    const vassalSliceCount = Math.max(1, RATE_LIMIT_CONFIG.vassalUpdateSlices || 1);
    const vassalNations = updatedNations.filter(n => n.vassalOf === 'player');
    const vassalTargets = getSlice(vassalNations, vassalSliceCount);
    const vassalTargetIds = vassalTargets.map(v => v.id);

    const vassalResult = processVassalUpdates({
        nations: updatedNations,
        updateIds: vassalTargetIds,
        daysElapsed: tick,
        epoch,
        playerMilitary: Math.max(0.5, playerMilitary),
        playerStability: stabilityValue,
        playerAtWar,
        playerWealth: res.silver || 0,
        playerPopulation: population || 1000000,
        officials,
        difficultyLevel: difficulty,
        logs,
    });
    updatedNations = vassalResult.nations;

    if (vassalResult.tributeIncome > 0) {
        applySilverChange(vassalResult.tributeIncome, 'vassal_tribute_income');
    }
    if (vassalResult.resourceTribute && Object.keys(vassalResult.resourceTribute).length > 0) {
        Object.entries(vassalResult.resourceTribute).forEach(([resourceKey, amount]) => {
            if (amount > 0) {
                applyResourceChange(resourceKey, amount, 'vassal_tribute_cash');
            }
        });
    }
    if (vassalResult.totalControlCost > 0) {
        applySilverChange(-vassalResult.totalControlCost, 'vassal_control_cost');
    }

    if (vassalResult.vassalEvents && vassalResult.vassalEvents.length > 0) {
        vassalResult.vassalEvents.forEach(event => {
            if (event.type === 'independence_war') {
                logs.push(`VASSAL_INDEPENDENCE_WAR:${JSON.stringify(event)}`);
            }
        });
    }
    perfEnd('vassalUpdates');

    // Filter visible nations for diplomacy processing
    const visibleNations = updatedNations.filter(n =>
        epoch >= (n.appearEpoch ?? 0)
        && (n.expireEpoch == null || epoch <= n.expireEpoch)
        && !n.isRebelNation
        && !n.isAnnexed // 排除已被吞并的国家
    );
    const diplomacySliceCount = Math.max(1, RATE_LIMIT_CONFIG.diplomacyUpdateSlices || 1);
    const diplomacyTargets = getSlice(visibleNations, diplomacySliceCount);

    // ========================================================================
    // PRICE CONVERGENCE DAILY UPDATE (Phase 4.2 Integration)
    // Process market price convergence for free trade agreement nations
    // ========================================================================
    let priceConvergenceResult = null;
    if (shouldUpdateDiplomacy && market?.prices) {
        perfStart('priceConvergence');
        priceConvergenceResult = processPriceConvergence(market.prices, updatedNations, tick);

        // 更新市场价格
        if (priceConvergenceResult.marketPrices) {
            market = {
                ...market,
                prices: priceConvergenceResult.marketPrices,
            };
        }

        // 更新AI国家价格
        if (priceConvergenceResult.nationPriceUpdates) {
            for (const update of priceConvergenceResult.nationPriceUpdates) {
                const nationIndex = updatedNations.findIndex(n => n.id === update.nationId);
                if (nationIndex >= 0) {
                    updatedNations[nationIndex] = {
                        ...updatedNations[nationIndex],
                        nationPrices: update.nationPrices,
                    };
                }
            }
        }

        // 添加日志
        if (priceConvergenceResult.logs) {
            priceConvergenceResult.logs.forEach(log => logs.push(log));
        }
        perfEnd('priceConvergence');
    }

    perfStart('diplomacyAI');
    // REFACTORED: Using module function for ally cold events
    // Note: Must use visibleNations to avoid triggering events for destroyed/expired nations
    if (shouldUpdateDiplomacy) {
        processAllyColdEvents(diplomacyTargets, tick, logs, difficulty);
    }

    // REFACTORED: Using module function for AI gift diplomacy
    if (shouldUpdateDiplomacy) {
        processAIGiftDiplomacy(diplomacyTargets, logs);
    }


    // REFACTORED: Using module function for AI-AI trade
    if (shouldUpdateTrade) {
        processAITrade(diplomacyTargets, logs, diplomacyOrganizations, vassalDiplomacyRequests, tick);
    }


    // REFACTORED: Using module function for AI-Player trade
    if (shouldUpdateTrade) {
        processAIPlayerTrade(diplomacyTargets, tick, res, market, logs, policies, diplomacyOrganizations, trackSilverChange);
    }


    // REFACTORED: Using module function for AI-Player interaction
    if (shouldUpdateDiplomacy) {
        processAIPlayerInteraction(diplomacyTargets, tick, epoch, logs);
    }

    // REFACTORED: AI invites player to join organizations
    if (shouldUpdateDiplomacy) {
        processAIOrganizationInvitesToPlayer(diplomacyTargets, tick, logs, { organizations: updatedOrganizations }, visibleEpoch);
    }


    // REFACTORED: Using module function for AI-AI alliance formation
    if (shouldUpdateDiplomacy) {
        const allianceResult = processAIAllianceFormation(
            diplomacyTargets,
            tick,
            logs,
            { organizations: updatedOrganizations },
            visibleEpoch,
            vassalDiplomacyRequests,
        );
        const recruitResult = processAIOrganizationRecruitment(
            diplomacyTargets,
            tick,
            logs,
            { organizations: updatedOrganizations },
            visibleEpoch,
            vassalDiplomacyRequests,
        );

        if (allianceResult && allianceResult.createdOrganizations.length > 0) {
            updatedOrganizations.push(...allianceResult.createdOrganizations);
            organizationUpdatesOccurred = true;
        }

        const joinRequests = [
            ...(allianceResult?.memberJoinRequests || []),
            ...(recruitResult?.memberJoinRequests || []),
        ];

        if (joinRequests.length > 0) {
            joinRequests.forEach(req => {
                const orgIndex = updatedOrganizations.findIndex(o => o.id === req.orgId);
                if (orgIndex >= 0) {
                    const org = updatedOrganizations[orgIndex];
                    const orgConfig = ORGANIZATION_TYPE_CONFIGS[org.type];
                    const maxMembers = orgConfig?.maxMembers || Infinity;
                    if (!org.members.includes(req.nationId) && org.members.length < maxMembers) {
                        updatedOrganizations[orgIndex] = {
                            ...org,
                            members: [...org.members, req.nationId]
                        };
                        organizationUpdatesOccurred = true;
                    }
                }
            });
        }

        const maintenanceResult = processAIOrganizationMaintenance(
            diplomacyTargets,
            tick,
            logs,
            { organizations: updatedOrganizations },
            visibleEpoch,
            vassalDiplomacyRequests,
        );
        if (maintenanceResult?.memberLeaveRequests?.length) {
            maintenanceResult.memberLeaveRequests.forEach(req => {
                const orgIndex = updatedOrganizations.findIndex(o => o.id === req.orgId);
                if (orgIndex >= 0) {
                    const org = updatedOrganizations[orgIndex];
                    if (org.members.includes(req.nationId)) {
                        updatedOrganizations[orgIndex] = {
                            ...org,
                            members: org.members.filter(m => m !== req.nationId),
                        };
                        organizationUpdatesOccurred = true;
                    }
                }
            });
        }

        // [FIX] Clean up annexed/destroyed nations from organization memberships
        // This prevents "unknown nations" from appearing in alliance/trade bloc lists
        const validNationIds = new Set(updatedNations
            .filter(n => !n.isAnnexed && n.population > 0)
            .map(n => n.id)
        );
        validNationIds.add('player'); // Player is always valid

        updatedOrganizations = updatedOrganizations.map(org => {
            const originalMemberCount = org.members?.length || 0;
            const cleanedMembers = (org.members || []).filter(memberId => validNationIds.has(memberId));
            
            if (cleanedMembers.length < originalMemberCount) {
                organizationUpdatesOccurred = true;
                const removedCount = originalMemberCount - cleanedMembers.length;
                if (removedCount > 0) {
                    logs.push(`🏛️ "${org.name}" 清理了 ${removedCount} 个已消失的成员国。`);
                }
            }
            
            return {
                ...org,
                members: cleanedMembers,
            };
        });

        const filteredOrgs = [];
        updatedOrganizations.forEach(org => {
            const keepSoloPlayerOrg = org?.members?.includes('player') && org.members.length === 1;
            if (shouldDisbandOrganization(org) && !keepSoloPlayerOrg) {
                logs.push(`🏛️ "${org.name}" 因成员不足而解散。`);
                organizationUpdatesOccurred = true;
                return;
            }
            filteredOrgs.push(org);
        });
        updatedOrganizations = filteredOrgs;
    }


    // REFACTORED: Using module functions for AI-AI war system
    if (shouldUpdateAI) {
        processCollectiveAttackWarmonger(diplomacyTargets, tick, logs, { organizations: updatedOrganizations });
        processAIAIWarDeclaration(
            diplomacyTargets,
            updatedNations,
            tick,
            logs,
            { organizations: updatedOrganizations },
            vassalDiplomacyRequests,
        );
        processAIAIWarProgression(diplomacyTargets, updatedNations, tick, logs, vassalDiplomacyRequests);
    }
    perfEnd('diplomacyAI');

    // Population fertility calculations (uses constants from ./utils/constants)
    let fertilityBirths = 0;
    let birthAccumulator = Math.max(0, previousBirthAccumulator || 0);
    let remainingCapacity = Math.max(0, totalMaxPop - nextPopulation);
    if (remainingCapacity > 0) {
        const popGrowthMultiplier = getPopulationGrowthMultiplier(difficulty);
        if (Math.random() < 0.01) console.log(`[DEBUG] PopGrowth: diff=${difficulty}, mult=${popGrowthMultiplier}`);
        const baselineContribution = Math.max(0, population || 0) * FERTILITY_BASELINE_RATE * popGrowthMultiplier;
        birthAccumulator += baselineContribution;
        if (population < LOW_POP_THRESHOLD) {
            const missingRatio = Math.max(0, (LOW_POP_THRESHOLD - population) / LOW_POP_THRESHOLD);
            birthAccumulator += LOW_POP_GUARANTEE * missingRatio * popGrowthMultiplier;
        }
        const baselineBirths = Math.min(remainingCapacity, Math.floor(birthAccumulator));
        if (baselineBirths > 0) {
            fertilityBirths += baselineBirths;
            birthAccumulator -= baselineBirths;
            remainingCapacity -= baselineBirths;
        }
    }
    if (remainingCapacity > 0) {
        Object.keys(STRATA).forEach(key => {
            if (remainingCapacity <= 0) return;
            const count = popStructure[key] || 0;
            if (count <= 0) return;
            const approval = classApproval[key] ?? 50;
            const approvalFactor = Math.max(0, (approval - 25) / 75);
            if (approvalFactor <= 0) return;
            const totalWealthForStratum = classWealthResult[key] || 0;
            const perCapitaWealth = count > 0 ? totalWealthForStratum / count : 0;
            const wealthFactor = Math.max(0.3, Math.min(2, perCapitaWealth / WEALTH_BASELINE));
            const birthRate = FERTILITY_BASE_RATE * approvalFactor * wealthFactor * (1 + (bonuses.populationGrowthBonus || 0));
            if (birthRate <= 0) return;
            let expectedBirths = count * birthRate;
            if (expectedBirths <= 0) return;
            const guaranteed = Math.floor(expectedBirths);
            let births = guaranteed;
            const fractional = expectedBirths - guaranteed;
            if (Math.random() < fractional) {
                births += 1;
            }
            if (births <= 0) return;
            births = Math.min(births, remainingCapacity);
            if (births <= 0) return;
            fertilityBirths += births;
            remainingCapacity -= births;
        });
    }
    if (fertilityBirths > 0) {
        popStructure.unemployed = (popStructure.unemployed || 0) + fertilityBirths;
        nextPopulation = Math.min(totalMaxPop, nextPopulation + fertilityBirths);
    }
    if ((res.food || 0) <= 0) {
        res.food = 0;
        if (Math.random() > 0.9 && nextPopulation > 2) {
            nextPopulation = nextPopulation - 1;
            // [FIX] 同步从popStructure中扣减，优先从失业者扣
            if ((popStructure.unemployed || 0) > 0) {
                popStructure.unemployed = popStructure.unemployed - 1;
            } else {
                // 如果没有失业者，随机从一个有人的阶层扣
                const rolesWithPop = ROLE_PRIORITY.filter(r => (popStructure[r] || 0) > 0);
                if (rolesWithPop.length > 0) {
                    const randomRole = rolesWithPop[Math.floor(Math.random() * rolesWithPop.length)];
                    popStructure[randomRole] = Math.max(0, (popStructure[randomRole] || 0) - 1);
                }
            }
            logs.push("饥荒导致人口减少！");
        }
    }

    // 基础需求（食物/布料）长期未满足导致死亡
    let starvationDeaths = 0;
    Object.keys(STRATA).forEach(key => {
        // Officials are immune to starvation death (handled by salary/hiring logic)
        if (key === 'official') return;

        const count = popStructure[key] || 0;
        if (count === 0) return;

        const def = STRATA[key];
        if (!def || !def.needs) return;

        // 检查食物和布料需求是否满足
        const shortages = classShortages[key] || [];
        const lackingFood = shortages.some(s => (typeof s === 'string' ? s : s.resource) === 'food');
        const lackingCloth = shortages.some(s => (typeof s === 'string' ? s : s.resource) === 'cloth');

        // 检查历史记录，判断是否长期缺乏
        const needsHistory = (classNeedsHistory || {})[key];
        if (needsHistory && needsHistory.length >= 5) {
            // 检查最近5个tick的需求满足情况
            const recentHistory = needsHistory.slice(-5);
            const avgSatisfaction = recentHistory.reduce((a, b) => a + b, 0) / recentHistory.length;

            // NEW: Tiered Starvation System
            // Tier 1: Malnutrition (<85% satisfaction) -> Low death rate (0.5% - 2%)
            // Tier 2: Severe Starvation (<50% satisfaction) -> High death rate (2% - 10%)
            if ((lackingFood || lackingCloth) && avgSatisfaction < 0.85) {
                const className = def.name || key;
                let deathRate = 0;

                if (avgSatisfaction < 0.5) {
                    // Severe Starvation: Scale from 2% at 50% sat to 10% at 0% sat
                    // Formula: 0.02 + (percentage_missing_from_50 / 50) * 0.08
                    deathRate = 0.02 + ((0.5 - avgSatisfaction) / 0.5 * 0.08);
                } else {
                    // Malnutrition: Scale from 0.5% at 85% sat to 2% at 50% sat
                    // Range is 0.35 (0.85 - 0.50)
                    deathRate = 0.005 + ((0.85 - avgSatisfaction) / 0.35 * 0.015);
                }

                const deaths = Math.max(1, Math.floor(count * deathRate));

                if (deaths > 0) {
                    popStructure[key] = Math.max(0, count - deaths);
                    starvationDeaths += deaths;

                    const reason = lackingFood && lackingCloth ? '食物和布料' : (lackingFood ? '食物' : '布料');
                    recordAggregatedLog(`${className} 阶层因长期缺乏${reason}，${deaths} 人死亡！`);
                }
            }
        }
    });

    // [FIX] 计算nextPopulation时，直接使用popStructure的总和
    // 因为exodus和starvation已经在popStructure中正确扣减了
    // 只有raidPopulationLoss需要单独处理（如果有的话）
    const popStructureTotal = ROLE_PRIORITY.reduce((sum, role) => sum + (popStructure[role] || 0), 0)
        + (popStructure.unemployed || 0);

    // raidPopulationLoss 如果存在，且未在popStructure中扣减，则单独处理
    if (raidPopulationLoss > 0) {
        // 从失业者中优先扣减raid损失
        let raidReduction = raidPopulationLoss;
        if ((popStructure.unemployed || 0) >= raidReduction) {
            popStructure.unemployed = popStructure.unemployed - raidReduction;
        } else {
            const fromUnemployed = popStructure.unemployed || 0;
            popStructure.unemployed = 0;
            raidReduction -= fromUnemployed;
            // 剩余的按比例从各阶层扣减
            const totalPop = ROLE_PRIORITY.reduce((sum, role) => sum + (popStructure[role] || 0), 0);
            if (totalPop > 0 && raidReduction > 0) {
                ROLE_PRIORITY.forEach(role => {
                    if (raidReduction <= 0) return;
                    const current = popStructure[role] || 0;
                    if (current <= 0) return;
                    const proportion = current / totalPop;
                    const remove = Math.min(current, Math.max(1, Math.floor(proportion * raidReduction)));
                    popStructure[role] = current - remove;
                    raidReduction -= remove;
                });
            }
        }
    }

    // 最终人口 = popStructure的总和
    nextPopulation = ROLE_PRIORITY.reduce((sum, role) => sum + (popStructure[role] || 0), 0)
        + (popStructure.unemployed || 0);
    nextPopulation = Math.max(0, Math.floor(nextPopulation));

    Object.keys(res).forEach(k => {
        if (res[k] < 0) res[k] = 0;
    });

    // console.log('[TICK] Starting price and wage updates...'); // Commented for performance
    perfStart('marketEconomy');
    let updatedPrices = { ...priceMap };
    let updatedWages = { ...(market?.wages || {}) };
    const wageSmoothing = 0.35;

    if (shouldUpdatePrices) {
        perfStart('marketUpdate');
        updatedWages = {};
        Object.entries(roleWageStats).forEach(([role, data]) => {

            let currentSignal = 0;

            const pop = popStructure[role] || 0;



            if (pop > 0) {

                // [FIX] Use roleLaborIncome and roleLivingExpense to calculate wage signal
                // This prevents high Owner Revenue (Profit) from artificially inflating the expected Labor Wage.
                const laborIncome = roleLaborIncome[role] || 0;
                const livingExpense = roleLivingExpense[role] || 0;

                // If a role has NO labor income (e.g. pure Capitalist who only owns buildings),
                // we should not let their profit signal drive labor wages.
                // However, if they have NO labor income, their "Wage Signal" might simply be their Living Expenses
                // (i.e. if they were to work, they'd need at least this much).

                // Fallback: if no labor income but has general income, we might be in a weird state.
                // Ideally, we just look at Labor Income - Living Expense.

                let effectiveIncome = laborIncome;
                let effectiveExpense = livingExpense;

                // If completely zero labor income (no one working in this role),
                // the signal would be -Expense/Pop (negative).
                // This correctly pushes wages up ( Wait? No. (Inc - Exp) -> Signal. Signal is target. Negative Target -> 0 wage?)
                // Wait, logic: smoothed = prev + (currentSignal - prev) * k.
                // If Signal < 0. Wage -> 0.
                // This implies: "We are starving (Expense > Income), so we accept LOWER wages??"
                // NO. The simulation logic assumes "Signal" is "What we CAN SAVE".
                // That assumption seems flawed if it drives expected wage.

                // Actually, let's keep the formula structure but swap variables.
                // If the game economy relies on "Savings" as the signal for "Worker Wealth" -> "Wage Expectation",
                // then we are doing the right thing by removing Owner Profit (which is huge wealth).

                // Special Case: If labor income is 0 (pure owner), do not drive wage to negative infinity.
                // Just use 0 or keep previous.
                if (laborIncome === 0 && roleWageStats[role].totalSlots === 0) {
                    // No one working. Use previous wage as signal (no change).
                    currentSignal = previousWages[role] || 0;
                } else {
                    currentSignal = (effectiveIncome - effectiveExpense) / pop;
                }

            } else {

                if (data.weightedWage > 0 && data.totalSlots > 0) {

                    currentSignal = data.weightedWage / data.totalSlots;

                } else {

                    currentSignal = previousWages[role] || 0;

                }

            }



            currentSignal = Math.max(0, currentSignal);



            const prev = previousWages[role] || 0;

            const smoothed = prev + (currentSignal - prev) * wageSmoothing;



            updatedWages[role] = parseFloat(smoothed.toFixed(2));

        });



        const demandPopulation = Math.max(0, nextPopulation ?? population ?? 0);

        // calculateMinProfitMargin is imported from ./utils/helpers

        // 获取全局默认的市场参数（作为 fallback）
        const defaultMarketInfluence = ECONOMIC_INFLUENCE?.market || {};
        const defaultSupplyDemandWeight = Math.max(0, defaultMarketInfluence.supplyDemandWeight ?? 1);
        const defaultVirtualDemandPerPop = Math.max(0, defaultMarketInfluence.virtualDemandPerPop || 0);
        // 应用难度乘数到库存目标天数（低难度=更多缓冲=更稳定经济，高难度=更少缓冲=更波动经济）
        const inventoryMultiplier = getInventoryTargetDaysMultiplier(difficulty);
        const defaultInventoryTargetDays = Math.max(0.1, (defaultMarketInfluence.inventoryTargetDays ?? 1.5) * inventoryMultiplier);
        const defaultInventoryPriceImpact = Math.max(0, defaultMarketInfluence.inventoryPriceImpact ?? 0.25);

        // 新的市场价格算法：每个建筑有自己的出售价格，市场价是加权平均
        Object.keys(RESOURCES).forEach(resource => {
            if (!isTradableResource(resource)) return;

            const resourceDef = RESOURCES[resource];
            const resourceMarketConfig = resourceDef?.marketConfig || {};

            // 获取资源的经济参数
            const supplyDemandWeight = resourceMarketConfig.supplyDemandWeight !== undefined
                ? Math.max(0, resourceMarketConfig.supplyDemandWeight)
                : defaultSupplyDemandWeight;
            const virtualDemandPerPop = resourceMarketConfig.virtualDemandPerPop !== undefined
                ? Math.max(0, resourceMarketConfig.virtualDemandPerPop)
                : defaultVirtualDemandPerPop;
            // 资源特定的库存目标天数也应用难度乘数
            const inventoryTargetDays = resourceMarketConfig.inventoryTargetDays !== undefined
                ? Math.max(0.1, resourceMarketConfig.inventoryTargetDays * inventoryMultiplier)
                : defaultInventoryTargetDays;
            const inventoryPriceImpact = resourceMarketConfig.inventoryPriceImpact !== undefined
                ? Math.max(0, resourceMarketConfig.inventoryPriceImpact)
                : defaultInventoryPriceImpact;

            const sup = supply[resource] || 0;
            const dem = demand[resource] || 0;
            const virtualDemandBaseline = virtualDemandPerPop * demandPopulation;
            const adjustedDemand = dem + virtualDemandBaseline;


            // 计算当前库存可以支撑多少天
            const dailyDemand = adjustedDemand;
            const inventoryStock = res[resource] || 0;
            // 当库存为0时，无论需求如何都应该触发短缺价格（返回极低天数）
            // 当库存>0但需求=0时，库存充足，返回目标天数
            const inventoryDays = inventoryStock <= 0
                ? 0.01  // 库存为0时，视为极度短缺，触发最大涨价
                : (dailyDemand > 0 ? inventoryStock / dailyDemand : inventoryTargetDays);

            // DEBUG: 价格计算调试日志（每5个tick输出一次，避免刷屏）
            // if (tick % 5 === 0 && (resource === 'food' || resource === 'cloth' || resource === 'tools')) {
            //     console.log(`[价格调试] ${RESOURCES[resource]?.name || resource}:`, {
            //         tick,
            //         inventoryStock: inventoryStock.toFixed(2),
            //         demand: dem.toFixed(2),
            //         virtualDemand: virtualDemandBaseline.toFixed(2),
            //         dailyDemand: dailyDemand.toFixed(2),
            //         inventoryDays: inventoryDays.toFixed(2),
            //         inventoryTargetDays,
            //         inventoryRatio: (inventoryDays / inventoryTargetDays).toFixed(3),
            //         currentPrice: (priceMap[resource] || 0).toFixed(2),
            //     });
            // }


            // 收集所有生产该资源的建筑及其出售价格
            const buildingPrices = [];
            let totalOutput = 0;

            BUILDINGS.forEach(building => {
                const buildingCount = builds[building.id] || 0;
                if (buildingCount <= 0) return;

                // 获取该建筑的升级等级分布（缓存）
                const { fullLevelCounts: levelCounts } = getBuildingLevelDistribution(
                    tick,
                    building.id,
                    buildingUpgrades,
                    buildingCount
                );

                // 按等级分组计算
                Object.entries(levelCounts).forEach(([levelStr, count]) => {
                    const level = parseInt(levelStr);
                    const config = getBuildingEffectiveConfig(building, level);

                    const outputAmount = config.output?.[resource];
                    if (!outputAmount || outputAmount <= 0) return;

                    // 使用基础建筑的 marketConfig（升级配置可以覆盖，否则沿用基础）
                    const buildingMarketConfig = building.marketConfig || {};
                    const buildingPriceWeights = buildingMarketConfig.price || ECONOMIC_INFLUENCE?.price || {};
                    const buildingWageWeights = buildingMarketConfig.wage || ECONOMIC_INFLUENCE?.wage || {};

                    const resourceSpecificPriceLivingCosts = buildLivingCostMap(
                        livingCostBreakdown,
                        buildingPriceWeights
                    );
                    const resourceSpecificWageLivingCosts = buildLivingCostMap(
                        livingCostBreakdown,
                        buildingWageWeights
                    );

                    // 计算原材料成本（含税）- 使用升级后的 input
                    let inputCost = 0;
                    if (config.input) {
                        Object.entries(config.input).forEach(([inputKey, amount]) => {
                            if (!amount || amount <= 0) return;
                            const inputPrice = priceMap[inputKey] || getBasePrice(inputKey);
                            const inputTaxRate = getResourceTaxRate(inputKey);

                            // 原材料成本 = 价格 × 数量 × (1 + 税率)
                            // 如果税率为负（补贴），则成本降低
                            const baseCost = amount * inputPrice;
                            const taxCost = baseCost * inputTaxRate;
                            inputCost += baseCost + taxCost;
                        });
                    }

                    // 计算工资成本 - 使用升级后的 jobs，但 owner 从基础建筑获取
                    let laborCost = 0;
                    const ownerKey = building.owner;
                    const effectiveJobs = config.jobs || {};
                    const isSelfOwned = ownerKey && effectiveJobs[ownerKey];
                    if (Object.keys(effectiveJobs).length > 0 && !isSelfOwned) {
                        Object.entries(effectiveJobs).forEach(([role, slots]) => {
                            if (!slots || slots <= 0) return;
                            const wage = updatedWages[role] || getExpectedWage(role);
                            laborCost += slots * wage;
                        });
                    }

                    // 计算营业税成本
                    const businessTaxMultiplier = policies?.businessTaxRates?.[building.id] ?? 1;
                    const businessTaxBase = building.businessTaxBase ?? 0.1;
                    const businessTaxCost = businessTaxBase * businessTaxMultiplier;

                    // 计算业主生活需求成本 - 使用升级后的 jobs 中的 owner 数量
                    let ownerLivingCost = 0;
                    if (ownerKey) {
                        const ownerLivingCostBase = resourceSpecificWageLivingCosts[ownerKey] || 0;
                        ownerLivingCost = ownerLivingCostBase * (effectiveJobs[ownerKey] || 0);
                    }

                    // 成本价 = (原材料成本含税 + 工资成本 + 营业税成本 + 业主生活需求成本) / 产出数量
                    const totalCost = inputCost + laborCost + businessTaxCost + ownerLivingCost;
                    const costPrice = totalCost / outputAmount;

                    // === 三层价格模型 ===
                    // 1. 计算供需调整系数（基于库存天数）
                    const inventoryRatio = inventoryDays / inventoryTargetDays;
                    let priceMultiplier = 1.0;

                    if (inventoryRatio < 0.5) {
                        // 库存紧张，大幅涨价
                        priceMultiplier = 1.0 + (1.0 - inventoryRatio * 2) * 5.0; // 最高6倍
                    } else if (inventoryRatio < 1.0) {
                        // 库存偏低，适度涨价
                        priceMultiplier = 1.0 + (1.0 - inventoryRatio) * 1.0; // 1.0-2.0倍
                    } else if (inventoryRatio > 2.0) {
                        // 库存积压，大幅降价
                        // 修正：从上一档位(1.0-2.0)的结束点(0.7)继续下降，保持连贯性
                        priceMultiplier = 0.7 - (inventoryRatio - 2.0) * 0.3; // 最低0.1倍
                        priceMultiplier = Math.max(0.1, priceMultiplier);
                    } else if (inventoryRatio > 1.0) {
                        // 库存充足，适度降价
                        priceMultiplier = 1.0 - (inventoryRatio - 1.0) * 0.3; // 0.7-1.0倍
                    }

                    // 2. 获取基础价格（市场认可的合理价格）
                    const basePrice = getBasePrice(resource);

                    // 3. 计算市场价格（基于basePrice和供需关系）
                    let marketBasedPrice = basePrice * priceMultiplier;

                    // 4. 最终价格 = 市场价格（允许低于成本价）
                    // 当供过于求时，价格可能低于成本，生产者会亏损
                    // 这会促使生产者减产或转行，实现市场自我调节
                    let sellingPrice = marketBasedPrice;

                    // 不超过物价限额
                    const minPrice = resourceDef.minPrice ?? PRICE_FLOOR;
                    const maxPrice = resourceDef.maxPrice;
                    sellingPrice = Math.max(sellingPrice, minPrice);
                    if (maxPrice !== undefined) {
                        sellingPrice = Math.min(sellingPrice, maxPrice);
                    }

                    // 记录该建筑等级的出售价格和产量
                    const levelOutput = outputAmount * count;
                    totalOutput += levelOutput;
                    buildingPrices.push({
                        price: sellingPrice,
                        output: levelOutput
                    });
                });
            });

            // 计算市场价：所有建筑的加权平均价格
            let marketPrice = 0;
            if (totalOutput > 0 && buildingPrices.length > 0) {
                let weightedSum = 0;
                buildingPrices.forEach(bp => {
                    weightedSum += bp.price * bp.output;
                });
                marketPrice = weightedSum / totalOutput;
            } else {
                // 如果没有建筑生产，根据库存情况调整基础价格
                const basePrice = getBasePrice(resource);
                const inventoryRatio = inventoryDays / inventoryTargetDays;
                let priceMultiplier = 1.0;

                if (inventoryRatio < 0.5) {
                    // 库存紧张，大幅涨价
                    priceMultiplier = 1.0 + (1.0 - inventoryRatio * 2) * 5.0; // 最高6倍
                } else if (inventoryRatio < 1.0) {
                    // 库存偏低，适度涨价
                    priceMultiplier = 1.0 + (1.0 - inventoryRatio) * 1.0; // 1.0-2.0倍
                } else if (inventoryRatio > 2.0) {
                    // 库存积压，大幅降价
                    // 修正：从上一档位(1.0-2.0)的结束点(0.7)继续下降，保持连贯性
                    priceMultiplier = 0.7 - (inventoryRatio - 2.0) * 0.3; // 最低0.1倍
                    priceMultiplier = Math.max(0.1, priceMultiplier);
                } else if (inventoryRatio > 1.0) {
                    // 库存充足，适度降价
                    priceMultiplier = 1.0 - (inventoryRatio - 1.0) * 0.3; // 0.7-1.0倍
                }

                marketPrice = basePrice * priceMultiplier;

                // 限制价格范围
                const minPrice = resourceDef.minPrice ?? PRICE_FLOOR;
                const maxPrice = resourceDef.maxPrice;
                marketPrice = Math.max(marketPrice, minPrice);
                if (maxPrice !== undefined) {
                    marketPrice = Math.min(marketPrice, maxPrice);
                }
            }


            // 战争物价上涨：计算与玩家直接交战的敌对国家数量
            // 注意：统计与玩家交战的AI国家（nation.isAtWar表示该AI与玩家交战）
            let warCount = 0;
            updatedNations.forEach(n => {
                if (n.isAtWar === true) {
                    warCount++;
                }
            });
            // AI国家之间的战争也会影响物价（国际局势紧张）
            let foreignWarCount = 0;
            updatedNations.forEach(n => {
                if (!n.isPlayer && n.foreignWars) {
                    Object.values(n.foreignWars).forEach(war => {
                        if (war?.isAtWar) foreignWarCount++;
                    });
                }
            });
            foreignWarCount = Math.floor(foreignWarCount / 2); // 每场战争被计算两次，需要除以2

            // 战争物价系数：每场与玩家的战争增加2.5%物价，每场AI间战争增加1%物价
            const warPriceMultiplier = 1 + (warCount * 0.025) + (foreignWarCount * 0.01);

            // 【修复】将战争乘数应用到目标价格（marketPrice），而非平滑后的价格
            // 这样平滑处理会正确地向战争调整后的目标价格移动，避免价格卡在上限
            const warAdjustedMarketPrice = marketPrice * warPriceMultiplier;

            // 平滑处理：向战争调整后的目标价格平滑移动
            const prevPrice = priceMap[resource] || warAdjustedMarketPrice;
            const smoothed = prevPrice + (warAdjustedMarketPrice - prevPrice) * 0.1;

            // 应用价格限制
            const minPrice = resourceDef.minPrice ?? PRICE_FLOOR;
            const maxPrice = resourceDef.maxPrice;
            let finalPrice = smoothed;
            finalPrice = Math.max(finalPrice, minPrice);
            if (maxPrice !== undefined) {
                finalPrice = Math.min(finalPrice, maxPrice);
            }

            updatedPrices[resource] = parseFloat(finalPrice.toFixed(2));
        });
        perfEnd('marketUpdate');
    }
    perfEnd('marketEconomy');

    const getLastTickNetIncomePerCapita = (role) => {
        const history = (classWealthHistory || {})[role];
        if (!history || history.length < 2) return null;
        const lastWealth = history[history.length - 1];
        const prevWealth = history[history.length - 2];
        const prevPop = Math.max(1, (previousPopStructure?.[role] || 0));
        return (lastWealth - prevWealth) / prevPop;
    };

    const hasBuildingVacancyForRole = (role) => {
        const list = roleVacancyTargets[role];
        if (!list || list.length === 0) return false;
        return list.some(entry => entry && entry.availableSlots > 0);
    };

    const reserveBuildingVacancyForRole = (role, desiredCount) => {
        const list = roleVacancyTargets[role];
        if (!list || list.length === 0 || desiredCount <= 0) return null;
        let bestIndex = -1;
        let bestSlots = 0;
        for (let i = 0; i < list.length; i++) {
            const entry = list[i];
            if (!entry) continue;
            const slots = entry.availableSlots >= 1 ? Math.floor(entry.availableSlots) : (entry.availableSlots > 0 ? 1 : 0);
            if (slots > bestSlots) {
                bestSlots = slots;
                bestIndex = i;
            }
        }
        if (bestIndex === -1 || bestSlots <= 0) return null;
        const chosen = list[bestIndex];
        const assigned = Math.min(desiredCount, bestSlots);
        const result = {
            buildingId: chosen.buildingId,
            buildingName: chosen.buildingName,
            count: assigned,
        };
        chosen.availableSlots -= assigned;
        if (chosen.availableSlots <= 0) {
            list.splice(bestIndex, 1);
        }
        return result;
    };

    const sumLockedCapital = (trades = []) => {
        if (!Array.isArray(trades)) return 0;
        return trades.reduce((sum, trade) => sum + Math.max(0, trade?.capitalLocked || 0), 0);
    };

    const previousMerchantLockedCapital = Math.max(0, merchantState?.lockedCapital ?? sumLockedCapital(merchantState?.pendingTrades || []));

    // 【修复】在转职评估前先执行商人交易，确保商人收入被正确计算
    const previousMerchantWealth = classWealthResult.merchant || 0;
    // DEBUG: 调试商人贸易调用
    debugLog('simulation', '[SIMULATION DEBUG] Calling simulateMerchantTrade, policies:', {
        hasExportTariff: !!policies.exportTariffMultipliers,
        hasImportTariff: !!policies.importTariffMultipliers,
        merchantPop: popStructure?.merchant || 0,
    });
    const updatedMerchantState = simulateMerchantTrade({
        ledger, // [REFACTORED] Pass ledger for financial transactions
        res,
        wealth,
        popStructure,
        supply,
        demand,
        nations: updatedNations,
        tick,
        taxPolicies: policies,
        taxBreakdown,
        getLocalPrice: getPrice,
        roleExpense,
        roleWagePayout,
        pendingTrades: merchantState.pendingTrades || [],
        lastTradeTime: merchantState.lastTradeTime || 0,
        gameSpeed,
        classFinancialData, // Pass detailed financial tracking
        logs,
        potentialResources, // [FIX] Restrict trade to producible resources

        // Trade 2.0: player merchant assignments (backward compatible)
        merchantAssignments: merchantState.merchantAssignments || merchantState.assignments || null,

        // Trade 2.0: per-resource preference multipliers (1 = neutral)
        merchantTradePreferences: merchantState.merchantTradePreferences || null,

        // Control whether to log merchant trade initiation messages
        shouldLogMerchantTrades: eventEffectSettings?.logVisibility?.showMerchantTradeLogs ?? true,
        // Throttle new trades to reduce workload
        allowNewTrades: shouldUpdateMerchantTrade,
        // [NEW] Control official logs
        shouldLogOfficialEvents: eventEffectSettings?.logVisibility?.showOfficialLogs ?? true,

        // Treasury change callback for resource tracking
        onTreasuryChange: applySilverChange,

        // NEW: Pass breakdown objects for tracking imports/exports in UI
        supplyBreakdown,
        demandBreakdown,
    });
    const merchantLockedCapital = Math.max(0, updatedMerchantState.lockedCapital ?? sumLockedCapital(updatedMerchantState.pendingTrades));
    updatedMerchantState.lockedCapital = merchantLockedCapital;
    const merchantCapitalInvested = updatedMerchantState.capitalInvestedThisTick || 0;
    if ('capitalInvestedThisTick' in updatedMerchantState) {
        delete updatedMerchantState.capitalInvestedThisTick;
    }

    // Generate merchant trade summary log (aggregate completed trades for this tick)
    const completedTrades = updatedMerchantState.completedTrades || [];
    if (completedTrades.length > 0) {
        // Aggregate by type, resource and partner
        const tradeSummary = { export: {}, import: {} };
        const partnerSummary = {}; // { partnerId: { name, exports: [], imports: [] } }
        let totalProfit = 0;
        completedTrades.forEach(trade => {
            const key = trade.resource;
            if (!tradeSummary[trade.type][key]) {
                tradeSummary[trade.type][key] = { amount: 0, profit: 0 };
            }
            tradeSummary[trade.type][key].amount += trade.amount;
            tradeSummary[trade.type][key].profit += trade.profit;
            totalProfit += trade.profit;

            // 按伙伴国家分组
            const partnerId = trade.partnerId || 'unknown';
            if (!partnerSummary[partnerId]) {
                const partnerNation = updatedNations.find(n => n?.id === partnerId);
                partnerSummary[partnerId] = {
                    name: partnerNation?.name || partnerId,
                    exports: [],
                    imports: []
                };
            }
            const resName = RESOURCES[key]?.name || key;
            if (trade.type === 'export') {
                partnerSummary[partnerId].exports.push(`${resName}x${trade.amount.toFixed(1)}`);
            } else {
                partnerSummary[partnerId].imports.push(`${resName}x${trade.amount.toFixed(1)}`);
            }
        });

        // Generate enhanced summary log message with partner info
        const partnerParts = [];
        Object.values(partnerSummary).forEach(p => {
            const items = [];
            if (p.exports.length > 0) items.push(`出口${p.exports.join(',')}`);
            if (p.imports.length > 0) items.push(`进口${p.imports.join(',')}`);
            if (items.length > 0) {
                partnerParts.push(`${p.name}(${items.join(', ')})`);
            }
        });

        if (partnerParts.length > 0 && updatedMerchantState.shouldLogMerchantTrades) {
            const profitText = totalProfit >= 0 ? `盈利${totalProfit.toFixed(1)}` : `亏损${Math.abs(totalProfit).toFixed(1)}`;
            logs.push(`📦 商人贸易完成: ${partnerParts.join('; ')}，${profitText}银币`);
        }


        // 应用官员贸易加成到商人财富
        if (bonuses.tradeBonusMod && totalProfit > 0) {
            const tradeBonus = totalProfit * bonuses.tradeBonusMod;
            wealth.merchant = (wealth.merchant || 0) + tradeBonus;
            if (classFinancialData?.merchant) {
                classFinancialData.merchant.income.ownerRevenue = (classFinancialData.merchant.income.ownerRevenue || 0) + tradeBonus;
            }
        }
    }
    // Clean up completedTrades from state (not needed for persistence)
    if ('completedTrades' in updatedMerchantState) {
        delete updatedMerchantState.completedTrades;
    }

    // 增强转职（Migration）逻辑：基于市场价格和潜在收益的职业流动
    const roleVacancies = {};
    ROLE_PRIORITY.forEach(role => {
        roleVacancies[role] = Math.max(0, (jobsAvailable[role] || 0) - (popStructure[role] || 0));
    });

    const getRoleWealthSnapshot = (role) => {
        if (role === 'merchant') {
            return (classWealthResult.merchant || 0) + merchantLockedCapital;
        }
        return classWealthResult[role] || 0;
    };
    const getPrevRoleWealthSnapshot = (role) => {
        if (role === 'merchant') {
            return (classWealth?.merchant || 0) + previousMerchantLockedCapital;
        }
        return classWealth?.[role] || 0;
    };

    const vacantRoleIncomeCache = tickCache.getOrCompute(tick, 'vacantRoleIncomeCache', () => new Map());

    /**
     * 为空岗位预估收入（区分业主和雇员）
     * 解决恶性循环：无人工作 → 收入为0 → 更无人愿意去
     * @param {string} role - 角色key
     * @returns {number} 预估的人均收入
     */
    const estimateVacantRoleIncome = (role) => {
        if (vacantRoleIncomeCache.has(role)) {
            return vacantRoleIncomeCache.get(role);
        }
        // 空岗位吸引力加成系数
        const VACANT_BONUS = 1.2;

        let ownerIncome = 0;
        let ownerSlots = 0;
        let employeeWage = 0;
        let employeeSlots = 0;

        BUILDINGS.forEach(building => {
            const count = builds[building.id] || 0;
            if (count <= 0) return;

            const config = getBuildingEffectiveConfig(building, 0);
            const jobs = config.jobs || {};
            const roleSlots = jobs[role] || 0;
            if (roleSlots <= 0) return;

            const isOwner = building.owner === role;

            if (isOwner) {
                // ===== 业主收入预估 =====
                // 计算建筑产出价值
                let outputValue = 0;
                if (config.output) {
                    Object.entries(config.output).forEach(([resource, amount]) => {
                        if (!amount || amount <= 0) return;
                        if (!RESOURCES[resource]) return; // 跳过 maxPop, militaryCapacity 等
                        const price = priceMap[resource] || getBasePrice(resource);
                        outputValue += amount * price;
                    });
                }

                // 计算原材料成本
                let inputCost = 0;
                if (config.input) {
                    Object.entries(config.input).forEach(([resource, amount]) => {
                        if (!amount || amount <= 0) return;
                        const price = priceMap[resource] || getBasePrice(resource);
                        inputCost += amount * price;
                    });
                }

                // 计算雇员工资支出（除业主外的其他岗位）
                // 使用“实际发出的平均工资”（market.wages / updatedWages），而不是理论预期工资
                let wageCost = 0;
                Object.entries(jobs).forEach(([jobRole, slots]) => {
                    if (jobRole === role || !slots || slots <= 0) return;
                    const avgPaidWage = updatedWages?.[jobRole] ?? market?.wages?.[jobRole] ?? getExpectedWage(jobRole);
                    wageCost += avgPaidWage * slots;
                });

                // 计算税费成本（人头税 + 营业税）
                const headBase = STRATA[role]?.headTaxBase ?? 0.01;
                const headTaxCost = headBase * getHeadTaxRate(role) * effectiveTaxModifier;
                const businessTaxBase = building.businessTaxBase ?? 0.1;
                const businessTaxRate = policies?.businessTaxRates?.[building.id] ?? 1;
                const businessTaxCost = businessTaxBase * businessTaxRate;

                // 业主净收入 = 产出 - 原材料 - 雇员工资 - 税费
                const netProfit = outputValue - inputCost - wageCost - headTaxCost - businessTaxCost;
                const profitPerOwner = roleSlots > 0 ? netProfit / roleSlots : 0;

                ownerIncome += profitPerOwner * roleSlots * count;
                ownerSlots += roleSlots * count;

            } else {
                // ===== 雇员工资预估 =====
                // Use the actual average wage that this role is currently being paid,
                // otherwise vacancy signals can be wildly optimistic/pessimistic.
                const avgPaidWage = updatedWages?.[role] ?? market?.wages?.[role] ?? getExpectedWage(role);

                // 计算税后工资
                const headBase = STRATA[role]?.headTaxBase ?? 0.01;
                const taxCost = headBase * getHeadTaxRate(role) * effectiveTaxModifier;
                const netWage = avgPaidWage - taxCost;

                employeeWage += netWage * roleSlots * count;
                employeeSlots += roleSlots * count;
            }
        });

        // 计算加权平均收入
        const totalSlots = ownerSlots + employeeSlots;
        if (totalSlots <= 0) {
            // 没有建筑提供这个岗位：也使用“岗位发出工资的平均数”作为信号
            const avgPaidWage = updatedWages?.[role] ?? market?.wages?.[role] ?? getExpectedWage(role);
            const fallback = avgPaidWage * VACANT_BONUS;
            vacantRoleIncomeCache.set(role, fallback);
            return fallback;
        }

        const totalIncome = ownerIncome + employeeWage;
        const averageIncome = totalIncome / totalSlots;

        // 应用吸引力加成
        const result = Math.max(0, averageIncome * VACANT_BONUS);
        vacantRoleIncomeCache.set(role, result);
        return result;
    };

    const activeRoleMetrics = ROLE_PRIORITY.map(role => {
        const pop = popStructure[role] || 0;
        const wealthNow = getRoleWealthSnapshot(role);
        const prevWealth = getPrevRoleWealthSnapshot(role);
        const delta = wealthNow - prevWealth;
        const perCap = pop > 0 ? wealthNow / pop : 0;
        const perCapWealthDelta = pop > 0 ? delta / pop : 0;

        const totalIncome = roleWagePayout[role] || 0;
        const totalExpense = roleExpense[role] || 0;
        const capitalOutlayAdjustment = role === 'merchant' ? merchantCapitalInvested : 0;
        const netIncome = totalIncome - totalExpense + capitalOutlayAdjustment;
        const netIncomePerCapita = netIncome / Math.max(1, pop);
        const roleWage = updatedWages[role] || getExpectedWage(role);
        const headTaxBase = STRATA[role]?.headTaxBase ?? 0.01;
        const taxCostPerCapita = headTaxBase * getHeadTaxRate(role) * effectiveTaxModifier;
        const disposableWage = roleWage - taxCostPerCapita;
        const lastTickIncome = getLastTickNetIncomePerCapita(role);
        const effectivePerCapDelta = role === 'merchant' ? netIncomePerCapita : perCapWealthDelta;
        const historicalIncomePerCapita = lastTickIncome !== null ? lastTickIncome : effectivePerCapDelta;
        const fallbackIncome = netIncomePerCapita !== 0 ? netIncomePerCapita : disposableWage;

        // 【空岗位预估收入】当该行业无人工作时，使用基于建筑产出的预估收入
        // 解决恶性循环：无人工作 → 收入为0 → 更无人愿意去
        let incomeSignal;
        if (pop === 0) {
            // 无人工作时，使用预估收入（区分业主和雇员）
            incomeSignal = estimateVacantRoleIncome(role);
        } else if (role === 'merchant' || historicalIncomePerCapita !== 0) {
            // 商人特例：优先使用当前运营收入（Net Income），忽略因进货导致的财富（Wealth）波动
            incomeSignal = role === 'merchant' ? fallbackIncome : historicalIncomePerCapita;
        } else {
            incomeSignal = fallbackIncome;
        }
        const stabilityBonus = perCap > 0 ? perCap * 0.002 : 0;

        // 以上一tick的人均净收入为主导，辅以小幅稳定度奖励，避免理论工资误导
        const potentialIncome = incomeSignal + stabilityBonus;

        return {
            role,
            pop,
            perCap,
            perCapDelta: effectivePerCapDelta,
            potentialIncome,
            vacancy: roleVacancies[role] || 0,
        };
    });

    // 过滤掉 'official' 阶层，防止其参与自动转职（官员只能通过任命产生）
    const migrationRoles = activeRoleMetrics.filter(r => r.role !== 'official');

    const totalMigratablePop = migrationRoles.reduce((sum, r) => r.pop > 0 ? sum + r.pop : sum, 0);
    const averagePotentialIncome = totalMigratablePop > 0
        ? migrationRoles.reduce((sum, r) => sum + (r.potentialIncome * r.pop), 0) / totalMigratablePop
        : 0;

    // 计算平均人均财富，用于判断富裕阶层的转职阈值
    const averagePerCapWealth = totalMigratablePop > 0
        ? migrationRoles.reduce((sum, r) => sum + (r.perCap * r.pop), 0) / totalMigratablePop
        : 0;

    // ============== 计算供需比和角色-资源映射（用于资源短缺紧急转职）==============
    // Supply/Demand ratio for each resource
    const supplyDemandRatio = {};
    Object.keys(RESOURCES).forEach(resKey => {
        const s = supply[resKey] || 0;
        const d = demand[resKey] || 0;
        // Avoid division by zero
        supplyDemandRatio[resKey] = d > 0 ? s / d : (s > 0 ? 999 : 1);
    });

    // Build roleProducesResource: which roles produce which resources
    // Based on building outputs and their owner/worker roles
    const roleProducesResource = {};
    BUILDINGS.forEach(building => {
        const count = builds[building.id] || 0;
        if (count <= 0) return;

        const config = getBuildingEffectiveConfig(building, 0);
        const outputs = config.output || {};
        const jobs = config.jobs || {};

        // Get resources this building produces
        const producedResources = Object.keys(outputs).filter(r => RESOURCES[r]);

        if (producedResources.length === 0) return;

        // Add these resources to all roles that work at this building
        Object.keys(jobs).forEach(role => {
            if (!roleProducesResource[role]) {
                roleProducesResource[role] = [];
            }
            producedResources.forEach(res => {
                if (!roleProducesResource[role].includes(res)) {
                    roleProducesResource[role].push(res);
                }
            });
        });

        // Also add to owner role
        if (building.owner && !roleProducesResource[building.owner]) {
            roleProducesResource[building.owner] = [];
        }
        if (building.owner) {
            producedResources.forEach(res => {
                if (!roleProducesResource[building.owner].includes(res)) {
                    roleProducesResource[building.owner].push(res);
                }
            });
        }
    });

    // 使用handleJobMigration处理阶层迁移（包含tier阻力系数和冷却机制）
    const migrationResult = handleJobMigration({
        popStructure,
        wealth,
        roleMetrics: migrationRoles,
        hasBuildingVacancyForRole,
        reserveBuildingVacancyForRole,
        logs,
        migrationCooldowns,
        // New: resource shortage data for survival migration
        supplyDemandRatio,
        roleProducesResource
    });
    // 更新迁移后的状态
    Object.assign(popStructure, migrationResult.popStructure);
    Object.assign(wealth, migrationResult.wealth);
    const updatedMigrationCooldowns = migrationResult.migrationCooldowns;

    // 商人交易已在转职逻辑前执行，这里只需应用收入到财富
    applyRoleIncomeToWealth();

    // Sync classWealthResult and totalWealth to include income for all classes
    Object.keys(STRATA).forEach(key => {
        classWealthResult[key] = Math.max(0, wealth[key] || 0);
    });
    totalWealth = Object.values(classWealthResult).reduce((sum, val) => sum + val, 0);

    // [FIX] 同步更新 classLivingStandard 中的 wealthPerCapita
    // 因为 calculateLivingStandards 在 wealth 完全更新前调用，导致 wealthPerCapita 可能滞后
    // 注意：跳过官员阶层，因为官员财富使用独立管理机制（在第 3306-3320 行已正确设置）
    Object.keys(STRATA).forEach(key => {
        // 跳过官员阶层，官员的 wealthPerCapita 在官员模拟循环后已正确设置
        if (key === 'official') return;
        if (classLivingStandard[key]) {
            const count = popStructure[key] || 0;
            const wealthValue = classWealthResult[key] || 0;
            const startingWealth = STRATA[key]?.startingWealth || 100;
            const newWealthPerCapita = count > 0 ? wealthValue / count : 0;
            classLivingStandard[key].wealthPerCapita = newWealthPerCapita;
            classLivingStandard[key].wealthRatio = startingWealth > 0 ? newWealthPerCapita / startingWealth : 0;
        }
    });

    // ========== 部长自动扩建系统 ==========
    let nextLastMinisterExpansionDay = Number.isFinite(lastMinisterExpansionDay) ? lastMinisterExpansionDay : 0;
    const shouldAttemptMinisterExpansion = ECONOMIC_MINISTER_ROLES.some((role) => ministerAssignments?.[role]);

    if (shouldAttemptMinisterExpansion && (tick - nextLastMinisterExpansionDay >= 10)) {
        const difficultyLevel = difficulty || 'normal';
        const growthFactor = getBuildingCostGrowthFactor(difficultyLevel);
        const baseMultiplier = getBuildingCostBaseMultiplier(difficultyLevel);
        const buildingCostMod = bonuses.buildingCostMod || 0;
        const marketForMinister = {
            prices: priceMap,
            wages: market?.wages || {},
        };
        let bestCandidate = null;

        ECONOMIC_MINISTER_ROLES.forEach((role) => {
            const officialId = ministerAssignments?.[role];
            const official = officialId ? ministerRoster.get(officialId) : null;
            if (!official) return;
            
            // [NEW] Check if auto-expansion is enabled for this minister
            const autoExpansionEnabled = ministerAutoExpansion?.[role] ?? true;
            if (!autoExpansionEnabled) return;

            BUILDINGS.forEach((building) => {
                if (!isBuildingUnlockedForMinister(building, epoch, techsUnlocked)) return;
                if (!isBuildingInMinisterScope(building, role)) return;

                const staffingRatioRaw = buildingStaffingRatios?.[building.id];
                const staffingRatio = Number.isFinite(staffingRatioRaw) ? staffingRatioRaw : 1;
                if (staffingRatio < 0.95) return;

                const shortageScore = scoreBuildingShortage(building, supplyDemandRatio);
                if (shortageScore <= 0) return;

                const currentCount = builds[building.id] || 0;
                const rawCost = calculateBuildingCost(building.baseCost, currentCount, growthFactor, baseMultiplier);
                const adjustedCost = applyBuildingCostModifier(rawCost, buildingCostMod, building.baseCost);
                const silverCost = calculateSilverCost(adjustedCost, { prices: priceMap });
                if (!Number.isFinite(silverCost) || silverCost <= 0) return;
                if ((res.silver || 0) < silverCost) return;

                const profitResult = calculateBuildingProfit(building, marketForMinister, taxPolicies);
                const profit = profitResult?.profit ?? 0;
                const operatingCost = (profitResult?.inputValue ?? 0) + (profitResult?.wageCost ?? 0) + (profitResult?.businessTax ?? 0);
                
                // [FIX] ROI should be calculated based on operating costs, not construction costs
                // ROI = profit / operating_cost (per turn profitability)
                const roi = operatingCost > 0 ? profit / operatingCost : 0;
                
                // [FIX] Consider market saturation: if too many buildings exist, skip
                // Estimate: if current supply already meets 80%+ of demand, don't build more
                const outputRes = Object.keys(building.output || {})[0];
                if (outputRes) {
                    const supplyRatio = supplyDemandRatio[outputRes];
                    if (supplyRatio && supplyRatio > 0.8) {
                        // Market is already well-supplied, building more will crash prices
                        return;
                    }
                }
                
                // Require ROI at least 0.3 (30% margin over costs) to ensure profitability
                if (roi <= 0.3) return;

                if (!bestCandidate || shortageScore > bestCandidate.shortageScore ||
                    (shortageScore === bestCandidate.shortageScore && roi > bestCandidate.roi) ||
                    (shortageScore === bestCandidate.shortageScore && roi === bestCandidate.roi && profit > bestCandidate.profit) ||
                    (shortageScore === bestCandidate.shortageScore && roi === bestCandidate.roi && profit === bestCandidate.profit && silverCost < bestCandidate.silverCost)) {
                    bestCandidate = {
                        role,
                        building,
                        shortageScore,
                        silverCost,
                        profit,
                        roi,
                    };
                }
            });
        });

        if (bestCandidate) {
            applyResourceChange('silver', -bestCandidate.silverCost, 'minister_expansion');
            builds[bestCandidate.building.id] = (builds[bestCandidate.building.id] || 0) + 1;
            nextLastMinisterExpansionDay = tick;
            logs.push(`🏛️ ${MINISTER_LABELS[bestCandidate.role] || bestCandidate.role} 扩建了 ${bestCandidate.building.name}（花费 ${Math.ceil(bestCandidate.silverCost)} 银币）`);
        }
    }

    const updatedMerchantWealth = Math.max(0, wealth.merchant || 0);
    const merchantWealthDelta = updatedMerchantWealth - previousMerchantWealth;
    if (merchantWealthDelta !== 0) {
        // ClassWealthResult and totalWealth already updated above
        const merchantDef = STRATA.merchant;
        if (merchantDef) {
            const merchantCount = popStructure.merchant || 0;
            const newInfluence = (merchantDef.influenceBase * merchantCount) + (totalWealth > 0 ? (updatedMerchantWealth / totalWealth) * 10 : 0);
            const influenceDelta = newInfluence - (classInfluence.merchant || 0);
            classInfluence.merchant = newInfluence;
            totalInfluence += influenceDelta;
        }
    }

    // ========== 业主自动升级建筑系统 ==========
    // Owner Auto-Upgrade: Wealthy owners will automatically upgrade their buildings
    // Uses BASE cost (no scaling with existing upgrades) as per user requirement
    const updatedBuildingUpgrades = { ...buildingUpgrades };
    const OWNER_UPGRADE_WEALTH_THRESHOLD = 1.5; // Per-capita wealth must be >= 1.5x base upgrade cost
    const OWNER_UPGRADE_CHANCE_PER_TICK = 0.02; // 2% chance per tick per eligible building type

    BUILDINGS.forEach(b => {
        const buildingId = b.id;
        const count = builds[buildingId] || 0;
        if (count <= 0) return;

        // Skip buildings without upgrades or without an owner (state-owned)
        const maxLevel = getMaxUpgradeLevel(buildingId);
        if (maxLevel <= 0) return;

        const ownerKey = b.owner;
        if (!ownerKey || ownerKey === 'state') return;

        // Get owner's population and wealth
        const ownerPop = popStructure[ownerKey] || 0;
        if (ownerPop <= 0) return;

        const ownerWealth = wealth[ownerKey] || 0;
        const perCapitaWealth = ownerWealth / ownerPop;

        // Get current upgrade distribution for this building
        const currentLevelCounts = updatedBuildingUpgrades[buildingId] || {};

        // Count buildings at each level
        let accounted = 0;
        for (const [, lvlCount] of Object.entries(currentLevelCounts)) {
            if (typeof lvlCount === 'number' && lvlCount > 0) {
                accounted += lvlCount;
            }
        }
        const level0Count = count - accounted; // Buildings at level 0

        // Find the lowest level building that can be upgraded
        // Start from level 0 and go up
        for (let fromLevel = 0; fromLevel < maxLevel; fromLevel++) {
            const atThisLevel = fromLevel === 0 ? level0Count : (currentLevelCounts[fromLevel] || 0);
            if (atThisLevel <= 0) continue;

            // Get BASE upgrade cost (no scaling, existingUpgradeCount = 0)
            const baseCost = getUpgradeCost(buildingId, fromLevel + 1, 0);
            if (!baseCost) continue;

            // Calculate total cost in silver (resources at market price)
            let totalSilverCost = 0;
            for (const [resource, amount] of Object.entries(baseCost)) {
                if (resource === 'silver') {
                    totalSilverCost += amount;
                } else {
                    const price = priceMap[resource] || 1;
                    totalSilverCost += amount * price;
                }
            }

            // Check if owner is wealthy enough (per-capita wealth >= threshold * cost)
            if (perCapitaWealth < OWNER_UPGRADE_WEALTH_THRESHOLD * totalSilverCost) {
                continue; // Owner not wealthy enough for this upgrade
            }

            // Random chance to trigger upgrade
            if (Math.random() > OWNER_UPGRADE_CHANCE_PER_TICK) {
                continue; // Upgrade not triggered this tick
            }

            // Check if market has enough resources
            const hasResources = Object.entries(baseCost).every(([resource, amount]) => {
                if (resource === 'silver') return true;
                return (res[resource] || 0) >= amount;
            });

            if (!hasResources) {
                continue; // Not enough resources in market
            }

            // Check if owner can afford (has enough wealth)
            if (ownerWealth < totalSilverCost) {
                continue; // Owner doesn't have enough wealth
            }

            // === Execute the upgrade ===

            // 1. Deduct resources from market
            Object.entries(baseCost).forEach(([resource, amount]) => {
                if (resource !== 'silver') {
                    applyResourceChange(resource, -amount, 'building_construction_cost');
                }
            });

            // 2. Deduct cost from owner's wealth
            ledger.transfer(ownerKey, 'void', totalSilverCost, TRANSACTION_CATEGORIES.EXPENSE.BUILDING_COST, TRANSACTION_CATEGORIES.EXPENSE.BUILDING_COST);

            // 3. Update building upgrade levels
            if (!updatedBuildingUpgrades[buildingId]) {
                updatedBuildingUpgrades[buildingId] = {};
            }

            // Decrease count at fromLevel (if > 0)
            if (fromLevel > 0) {
                updatedBuildingUpgrades[buildingId][fromLevel] =
                    Math.max(0, (updatedBuildingUpgrades[buildingId][fromLevel] || 0) - 1);
                if (updatedBuildingUpgrades[buildingId][fromLevel] <= 0) {
                    delete updatedBuildingUpgrades[buildingId][fromLevel];
                }
            }

            // Increase count at toLevel
            const toLevel = fromLevel + 1;
            updatedBuildingUpgrades[buildingId][toLevel] =
                (updatedBuildingUpgrades[buildingId][toLevel] || 0) + 1;

            // Clean up empty entries
            if (Object.keys(updatedBuildingUpgrades[buildingId]).length === 0) {
                delete updatedBuildingUpgrades[buildingId];
            }

            // 4. Log the upgrade
            const ownerName = STRATA[ownerKey]?.name || ownerKey;
            const upgradeName = BUILDING_UPGRADES[buildingId]?.[fromLevel]?.name || `等级${toLevel}`;
            logs.push(`??? ${ownerName}自发投资了自己的产业 ${b.name} → ${upgradeName}（花费 ${Math.ceil(totalSilverCost)} 银币）`);

            // Only upgrade one building per type per tick to avoid rapid changes
            break;
        }
    });

    // ========== 官员产业升级落地 ==========
    if (pendingOfficialUpgrades.length > 0) {
        pendingOfficialUpgrades.forEach(upgrade => {
            const { buildingId, fromLevel, toLevel, officialName, cost } = upgrade;
            if (!updatedBuildingUpgrades[buildingId]) {
                updatedBuildingUpgrades[buildingId] = {};
            }

            if (fromLevel > 0) {
                updatedBuildingUpgrades[buildingId][fromLevel] =
                    Math.max(0, (updatedBuildingUpgrades[buildingId][fromLevel] || 0) - 1);
                if (updatedBuildingUpgrades[buildingId][fromLevel] <= 0) {
                    delete updatedBuildingUpgrades[buildingId][fromLevel];
                }
            }

            updatedBuildingUpgrades[buildingId][toLevel] =
                (updatedBuildingUpgrades[buildingId][toLevel] || 0) + 1;

            if (Object.keys(updatedBuildingUpgrades[buildingId]).length === 0) {
                delete updatedBuildingUpgrades[buildingId];
            }

            logs.push(`??? 官员${officialName}升级了 ${buildingId}（花费 ${Math.ceil(cost)} 银）`);
        });
    }

    // Update classWealthResult after owner upgrades
    Object.keys(STRATA).forEach(key => {
        classWealthResult[key] = Math.max(0, wealth[key] || 0);
    });
    totalWealth = Object.values(classWealthResult).reduce((sum, val) => sum + val, 0);

    // 税收效率：在“入库口径”为实际支付的前提下，税收效率应在征收环节就影响“实际入库”。
    // 目前 Ledger 的 taxBreakdown.xxx 代表真实转入国库的税额（实际支付），因此这里不再二次扣除“效率损失”。
    // 依然保留税收效率用于 UI 展示与后续系统（如需要可在征收处注入效率）。
    const rawTaxEfficiency = efficiency * (1 + (bonuses.taxEfficiencyBonus || 0) - (bonuses.corruption || 0));
    const effectiveTaxEfficiency = Math.max(0, Math.min(1, rawTaxEfficiency));

    // 由于 taxBreakdown 现在是“实际入库”，collectedXxx 直接等于 taxBreakdown.xxx。
    const collectedHeadTax = taxBreakdown.headTax;
    const collectedIndustryTax = taxBreakdown.industryTax;
    const collectedBusinessTax = taxBreakdown.businessTax;
    const collectedTariff = (taxBreakdown.tariff || 0); // 关税收入

    const taxBaseForCorruption = taxBreakdown.headTax + taxBreakdown.industryTax + taxBreakdown.businessTax + (taxBreakdown.tariff || 0);
    const efficiencyNoCorruption = Math.max(0, Math.min(1, efficiency * (1 + (bonuses.taxEfficiencyBonus || 0))));

    // console.log('[TAX DEBUG] Efficiency Calc (no post-deduction):', {
    //     efficiency,
    //     bonuses: bonuses.taxEfficiencyBonus,
    //     rawTaxEfficiency,
    //     effectiveTaxEfficiency,
    //     taxBase: taxBaseForCorruption,
    //     officialsCount: updatedOfficials.length
    // });

    // 腐败分配逻辑：将部分税收收入视为被贪污挪走（真实从国库扣除），并按权重分配给官员财富。
    const corruptionLoss = Math.max(0, taxBaseForCorruption * (efficiencyNoCorruption - effectiveTaxEfficiency));
    if (corruptionLoss > 0 && updatedOfficials.length > 0) {
        const paidMultiplier = officialsPaid ? 1 : 0.5;
        const weights = updatedOfficials.map(official => {
            const base = (official.effects?.corruption || 0) + (official.drawbacks?.corruption || 0);
            const financialPenalty = FINANCIAL_STATUS[official.financialSatisfaction]?.corruption || 0;
            return Math.max(0, (base + financialPenalty) * paidMultiplier);
        });
        const totalWeight = weights.reduce((sum, val) => sum + val, 0);
        const fallbackShare = corruptionLoss / updatedOfficials.length;
        let distributed = 0;

        updatedOfficials.forEach((official, index) => {
            const share = totalWeight > 0 ? corruptionLoss * (weights[index] / totalWeight) : fallbackShare;
            if (share <= 0) return;
            official.wealth = Math.max(0, (official.wealth || 0) + share);
            official.lastDayCorruptionIncome = (official.lastDayCorruptionIncome || 0) + share;
            official.lastDayNetChange = (official.lastDayNetChange || 0) + share;
            if (official._debug) {
                official._debug.corruptionIncome = (official._debug.corruptionIncome || 0) + share;
            }
            distributed += share;
        });

        if (distributed > 0) {
            // Corruption is treated as real embezzlement: money is taken from the treasury and ends up in officials' wealth.
            // 1) Reduce treasury silver
            applySilverChange(-distributed, 'corruption');

            // 2) Increase officials wealth snapshot (used by UI)
            totalOfficialWealth += distributed;
            wealth.official = totalOfficialWealth;
            classWealthResult.official = Math.max(0, wealth.official);
            totalWealth = Object.values(classWealthResult).reduce((sum, val) => sum + val, 0);
            totalOfficialIncome += distributed;

            // 3) Record the flow in the ledger (state -> official)
            ledger.transfer(
                'state',
                'official',
                distributed,
                TRANSACTION_CATEGORIES.INCOME.CORRUPTION,
                TRANSACTION_CATEGORIES.INCOME.CORRUPTION
            );
        }
    }

    const tariffSubsidy = taxBreakdown.tariffSubsidy || 0; // 关税补贴支出
    const totalCollectedTax = collectedHeadTax + collectedIndustryTax + collectedBusinessTax + collectedTariff;

    // NEW: Apply income percentage bonus (from tech/decree effects)
    // [FIX] Add safety check to prevent abnormal tax multiplication
    const rawIncomePercentBonus = incomePercentBonus || 0;
    const MAX_INCOME_BONUS = 2.0; // Maximum 200% bonus (3x multiplier)
    const clampedIncomePercentBonus = Math.max(-0.5, Math.min(MAX_INCOME_BONUS, rawIncomePercentBonus));
    const incomePercentMultiplier = Math.max(0, 1 + clampedIncomePercentBonus);

    // [DEBUG] 税收汇总调试 - 增强版
    // if (Math.abs(rawIncomePercentBonus) > 0.01 || incomePercentMultiplier > 1.5) {
    //     console.log('[TAX INCOME BONUS DEBUG]', {
    //         'tick': tick,
    //         'rawIncomePercentBonus': rawIncomePercentBonus.toFixed(4),
    //         'clampedIncomePercentBonus': clampedIncomePercentBonus.toFixed(4),
    //         'incomePercentMultiplier': incomePercentMultiplier.toFixed(4),
    //         'bonuses.incomePercentBonus': (bonuses.incomePercentBonus || 0).toFixed(4),
    //         'taxBreakdown.headTax': taxBreakdown.headTax.toFixed(2),
    //         'taxBreakdown.industryTax': taxBreakdown.industryTax.toFixed(2),
    //         'taxBreakdown.businessTax': taxBreakdown.businessTax.toFixed(2),
    //     });
    // }
    
    // console.log('[TAX SUMMARY DEBUG]', {
    //     'taxBreakdown.headTax（实际入库）': taxBreakdown.headTax.toFixed(2),
    //     '税收效率': effectiveTaxEfficiency.toFixed(3),
    //     'collectedHeadTax（实际入库）': collectedHeadTax.toFixed(2),
    //     '收入倍率': incomePercentMultiplier.toFixed(3),
    //     'finalHeadTax（最终显示）': (collectedHeadTax * incomePercentMultiplier).toFixed(2)
    // });

    // 将税收与战争赔款一并视为财政收入
    const baseFiscalIncome = totalCollectedTax + warIndemnityIncome;

    // 税收处理
    // 注意：Ledger 已将税收 (taxBreakdown.xxx) 添加到国库并记录日志
    // 税收效率损失已通过腐败分配给官员（第 6082-6105 行）
    // 这里只需要处理收入倍率加成（如果 incomePercentMultiplier > 1）

    // 计算最终税额（用于 rates 显示）
    const finalHeadTax = collectedHeadTax * incomePercentMultiplier;
    const finalIndustryTax = collectedIndustryTax * incomePercentMultiplier;
    const finalBusinessTax = collectedBusinessTax * incomePercentMultiplier;
    const finalTariff = collectedTariff * incomePercentMultiplier;

    // 收入倍率加成部分（额外收入）
    if (incomePercentMultiplier > 1) {
        const headTaxBonus = collectedHeadTax * (incomePercentMultiplier - 1);
        const industryTaxBonus = collectedIndustryTax * (incomePercentMultiplier - 1);
        const businessTaxBonus = collectedBusinessTax * (incomePercentMultiplier - 1);
        const tariffBonus = collectedTariff * (incomePercentMultiplier - 1);

        if (headTaxBonus > 0) applySilverChange(headTaxBonus, 'headTax'); // 累加到 Ledger 的记录
        if (industryTaxBonus > 0) applySilverChange(industryTaxBonus, 'transactionTax');
        if (businessTaxBonus > 0) applySilverChange(businessTaxBonus, 'businessTax');
        if (tariffBonus > 0) applySilverChange(tariffBonus, 'tariffs');
    }

    // 更新 rates（用于 UI 显示）
    rates.silver = (rates.silver || 0) + finalHeadTax + finalIndustryTax + finalBusinessTax + finalTariff;

    // 5. 战争赔款加成部分
    // NOTE: processInstallmentPayment() already recorded the base amount with 'installment_payment_income'
    // Here we only add the bonus portion from incomePercentMultiplier (if any)
    const warIndemnityBonus = warIndemnityIncome * (incomePercentMultiplier - 1);
    if (warIndemnityBonus > 0) {
        applySilverChange(warIndemnityBonus, 'income_war_indemnity_bonus');
        rates.silver = (rates.silver || 0) + warIndemnityBonus;
    }
    // Update rates for display (base amount was already added in processInstallmentPayment)
    if (warIndemnityIncome > 0) {
        rates.silver = (rates.silver || 0) + warIndemnityIncome;
    }

    // 6. 政令收入
    if (decreeSilverIncome > 0) {
        applySilverChange(decreeSilverIncome, 'income_policy');
        rates.silver = (rates.silver || 0) + decreeSilverIncome;
    }

    // 7. 政令支出 (此前未扣除，现修正)
    if (decreeSilverExpense > 0) {
        const expense = Math.min(res.silver || 0, decreeSilverExpense);
        if (expense > 0) {
            applySilverChange(-expense, 'expense_policy');
            rates.silver = (rates.silver || 0) - expense;
        }
    }

    taxBreakdown.policyIncome = decreeSilverIncome;
    taxBreakdown.policyExpense = decreeSilverExpense;

    const totalFiscalIncome = (totalCollectedTax + warIndemnityIncome) * incomePercentMultiplier;

    const priceControlIncome = taxBreakdown.priceControlIncome || 0;
    const priceControlExpense = taxBreakdown.priceControlExpense || 0;
    const effectiveTradeRouteTax = Number.isFinite(tradeRouteTax) ? tradeRouteTax : 0;

    // Price control income is added to silver here (expense was deducted in real-time)
    if (priceControlIncome !== 0) {
        applySilverChange(priceControlIncome, 'income_price_control');
        rates.silver = (rates.silver || 0) + priceControlIncome;
    }

    if (effectiveTradeRouteTax !== 0) {
        applySilverChange(effectiveTradeRouteTax, 'income_trade_route');
        rates.silver = (rates.silver || 0) + effectiveTradeRouteTax;
    }

    const netTax = totalCollectedTax
        - taxBreakdown.subsidy
        - tariffSubsidy // 关税补贴支出
        + warIndemnityIncome
        + decreeSilverIncome
        - decreeSilverExpense
        + effectiveTradeRouteTax
        + priceControlIncome
        - priceControlExpense;
    const taxes = {
        total: netTax,
        efficiency,
        breakdown: {
            headTax: collectedHeadTax,
            industryTax: collectedIndustryTax,
            businessTax: collectedBusinessTax,
            tariff: collectedTariff, // 新增：关税收入
            tariffSubsidy, // 新增：关税补贴支出
            subsidy: taxBreakdown.subsidy,
            warIndemnity: warIndemnityIncome,
            policyIncome: decreeSilverIncome,
            policyExpense: decreeSilverExpense,
            priceControlIncome: priceControlIncome,
            priceControlExpense: priceControlExpense,
            tradeRouteTax: effectiveTradeRouteTax,
            baseFiscalIncome,
            totalFiscalIncome,
            incomePercentMultiplier,
            // DEBUG: 调试关税策略
            _debug_tariffPolicies: {
                hasExport: !!policies.exportTariffMultipliers,
                hasImport: !!policies.importTariffMultipliers,
                rawTariff: taxBreakdown.tariff || 0,
            },
        },
    };

    // === 官员独立财务计算 ===
    // Official processing moved to early simulation phase (before living standards)
    // Set official income for UI report (after applyRoleIncomeToWealth to avoid double count in wealth)
    roleWagePayout.official = totalOfficialIncome || 0;
    // Explicitly clear official shortages to prevent "ghost" warnings from generic logic
    if (classShortages) classShortages.official = [];

    if (aggregatedLogs.size > 0) {
        aggregatedLogs.forEach((count, message) => {
            logs.push(count > 1 ? `${message}（共${count}处）` : message);
        });
    }

    // 2. Foreign Investments (AI -> Player) - Executed AFTER jobFill is populated
    if (foreignInvestments.length > 0) {
        perfStart('foreignInvestments');
        const fiResult = processForeignInvestments({
            foreignInvestments: updatedForeignInvestments,
            nations: updatedNations, // Use updated nations
            organizations: diplomacyOrganizations?.organizations || [],
            playerMarket: { prices: updatedPrices },
            playerResources: res,
            foreignInvestmentPolicy,
            daysElapsed: tick,
            jobFill: buildingJobFill,
            buildings: builds,
        });

        updatedForeignInvestments = fiResult.updatedInvestments;
        investmentLogs.push(...fiResult.logs);

        if (fiResult.taxRevenue > 0) {
            applySilverChange(fiResult.taxRevenue, 'foreign_investment_tax');
        }

        // Apply market changes (from foreign operation)
        if (fiResult.marketChanges) {
            Object.entries(fiResult.marketChanges).forEach(([key, delta]) => {
                // If it's resource accumulation/depletion in player market
                // Note: processForeignInvestments returns 'marketChanges' for player resource changes
                // But wait, the function modifies playerResources directly? No, it takes it as input.
                // It returns marketChanges.
                // Let's verify `processForeignInvestments` implementation.
                // It calculates profit but does NOT modify `playerResources` in place inside calculation.
                // It returns `marketChanges`.
                // [FIX] Silver produced by foreign investors belongs to them (profit), not the state treasury.
                if (key === 'silver') return;

                // [FIX] Use applyResourceChange to ensure tracking
                applyResourceChange(key, delta, 'autonomous_investment_return');
            });
        }

        // Foreign Upgrades
        perfEnd('foreignInvestments');
        perfStart('foreignUpgrades');
        const upgradeResult = processForeignInvestmentUpgrades({
            foreignInvestments: updatedForeignInvestments,
            nations: updatedNations,
            playerMarket: { prices: updatedPrices },
            playerResources: res,
            buildingUpgrades: updatedBuildingUpgrades, // Use the updated upgrades from earlier
            buildingCounts: builds,
            daysElapsed: tick,
        });

        if (upgradeResult.upgrades && upgradeResult.upgrades.length > 0) {
            updatedForeignInvestments = upgradeResult.updatedInvestments;
            investmentLogs.push(...upgradeResult.logs);
            // Costs are deducted from owner nation wealth inside updateNations?
            // No, processForeignInvestmentUpgrades just returns the result. We need to update nations.
            // But we already finished mapping updatedNations.
            // We should update `updatedNations` again.
            upgradeResult.upgrades.forEach(u => {
                const nation = updatedNations.find(n => n.id === u.ownerNationId);
                if (nation) {
                    nation.wealth = Math.max(0, (nation.wealth || 0) - u.cost);
                }
            });
        }
        perfEnd('foreignUpgrades');
    }

    // Merge investment logs
    logs.push(...investmentLogs);
    // Add manual trade logs
    if (tradeRouteSummary?.tradeLog) {
        // Gated by log settings? Usually handled in UI, but simulation just returns them.
        logs.push(...tradeRouteSummary.tradeLog);
    }

    // Trade Opportunities Analysis (Throttled: every 10 ticks)
    const tradeOpportunities = (tick % 10 === 0)
        ? analyzeTradeOpportunities({
            nations: updatedNations,
            res,
            supply,
            demand,
            market: { prices: updatedPrices },
            tick,
            taxPolicies: policies,
            merchantTradePreferences: updatedMerchantState.merchantTradePreferences
        })
        : previousTradeOpportunities;

    // console.log('[TICK END]', tick, 'militaryCapacity:', militaryCapacity); // Commented for performance

    // [NEW] Calculate foreign investment stats
    const foreignStats = calculateOverseasInvestmentSummary(updatedForeignInvestments);

    if (organizationUpdatesOccurred) {
        updatedNations = updatedNations.map(nation => {
            const memberships = updatedOrganizations
                .filter(org => org.members?.includes(nation.id))
                .map(org => org.id);
            return {
                ...nation,
                organizationMemberships: memberships,
            };
        });
    }

    // Calculate diplomatic reputation natural recovery (daily)
    const updatedDiplomaticReputation = calculateNaturalRecovery(diplomaticReputation);

    const perfTotalMs = perfTime() - perfStartAll;
    // [OPTIMIZATION REMOVED] 移除游标递增逻辑，不再需要批处理
    perfMarkEnd('simulateTick');

    return {
        officialsSimCursor: 0, // 保留字段以兼容旧存档，但不再使用
        _perf: {
            totalMs: perfTotalMs,
            sections: perfSections,
        },
        tradeOpportunities,
        tradeRoutes: tradeRoutes ? { ...tradeRoutes, routes: tradeRoutes.routes.filter(r => !tradeRouteSummary?.routesToRemove?.includes(r)) } : undefined,
        overseasInvestments: updatedOverseasInvestments,
        foreignInvestments: updatedForeignInvestments,
        resources: res,
        rates,
        popStructure,
        maxPop: totalMaxPop,
        militaryCapacity, // 新增：军事容量
        population: nextPopulation,
        birthAccumulator,
        classApproval,
        approvalBreakdown,
        classInfluence,
        classWealth: classWealthResult,
        classLivingStandard, // 各阶层生活水平数据
        totalInfluence,
        totalWealth,
        activeBuffs: newActiveBuffs,
        activeDebuffs: newActiveDebuffs,
        stability: stabilityValue,
        legitimacy: coalitionLegitimacy, // 执政联盟合法性
        legitimacyTaxModifier, // 税收修正系数
        logs,
        vassalDiplomacyRequests,
        market: {
            prices: updatedPrices,
            demand,
            supply,
            wages: updatedWages,
            needsShortages: classShortages,
            stratumConsumption, // NEW: Return actual consumption breakdown
            supplyBreakdown,    // NEW: Return supply breakdown
            demandBreakdown,    // NEW: Return demand breakdown
        },
        classIncome: roleWagePayout,
        classExpense: roleExpense,
        jobFill: buildingJobFill,
        jobsAvailable,
        buildingJobsRequired, // 每个建筑的实际岗位需求（考虑外资/官员减少业主岗位）
        taxes,
        classFinancialData, // NEW: Return detailed financial data
        buildingFinancialData, // NEW: Per-building realized financial stats for UI
        buildingDebugData,  // DEBUG: Building production debug data
        dailyMilitaryExpense: armyExpenseResult, // 新增：每日军费数据（用于战争赔款计算）
        needsShortages: classShortages,
        needsReport,
        livingStandardStreaks: updatedLivingStandardStreaks,
        nations: updatedNations,
        merchantState: updatedMerchantState,
        buildingUpgrades: updatedBuildingUpgrades, // Owner auto-upgrade results
        migrationCooldowns: updatedMigrationCooldowns, // 阶层迁移冷却状态
        migrationCooldowns: updatedMigrationCooldowns, // 阶层迁移冷却状态
        diplomacyOrganizations: organizationUpdatesOccurred ? { organizations: updatedOrganizations } : null,
        taxShock: updatedTaxShock, // [NEW] 各阶层累积税收冲击值
        // 加成修饰符数据，供UI显示"谁吃到了buff"
        modifiers: {
            // 需求修饰符
            resourceDemand: {
                ...decreeResourceDemandMod, ...Object.fromEntries(
                    Object.entries(eventResourceDemandModifiers).map(([k, v]) => [k, (decreeResourceDemandMod[k] || 0) + v])
                )
            },
            stratumDemand: {
                ...decreeStratumDemandMod, ...Object.fromEntries(
                    Object.entries(eventStratumDemandModifiers).map(([k, v]) => [k, (decreeStratumDemandMod[k] || 0) + v])
                )
            },
            // 供给修饰符
            resourceSupply: decreeResourceSupplyMod,
            // 建筑产出修饰符
            buildingProduction: { ...buildingBonuses, ...eventBuildingProductionModifiers },
            categoryProduction: categoryBonuses,
            // 来源分解（用于显示哪些是政令/事件加成）
            sources: {
                decreeResourceDemand: decreeResourceDemandMod,
                decreeStratumDemand: decreeStratumDemandMod,
                decreeResourceSupply: decreeResourceSupplyMod,
                eventResourceDemand: eventResourceDemandModifiers,
                eventStratumDemand: eventStratumDemandModifiers,
                eventBuildingProduction: eventBuildingProductionModifiers,
                techBuildingBonus: buildingBonuses,
                techCategoryBonus: categoryBonuses,
                // 全局生产加成（来自政令和节日）
                productionBonus: productionBonus,
                industryBonus: industryBonus,
                // 军事加成
                militaryBonus: bonuses.militaryBonus,
                // 阶层财富增长对需求的影响（财富越高需求越高）
                // 阶层财富增长对需求的影响（财富越高需求越高）
                stratumWealthMultiplier: stratumWealthMultipliers,
                // 建筑原料消耗修正（官员效果 + 政治立场效果，累加合并）
                productionInputCost: (() => {
                    const merged = {};
                    const official = bonuses.officialProductionInputCost || {};
                    const stance = bonuses.stanceProductionInputCost || {};
                    // 合并所有 key
                    const allKeys = new Set([...Object.keys(official), ...Object.keys(stance)]);
                    allKeys.forEach(key => {
                        merged[key] = (official[key] || 0) + (stance[key] || 0);
                    });
                    return merged;
                })(),
            },
            // 官员效果修饰符（供外部使用）
            officialEffects: {
                buildingCostMod: bonuses.buildingCostMod || 0,
                militaryUpkeepMod: bonuses.militaryUpkeepMod || 0,
                taxEfficiencyBonus: bonuses.taxEfficiencyBonus || 0,
                corruption: bonuses.corruption || 0,
                populationGrowthBonus: bonuses.populationGrowthBonus || 0,
                tradeBonusMod: bonuses.tradeBonusMod || 0,
                organizationGrowthMod: bonuses.organizationGrowthMod || 0,
                wartimeProduction: bonuses.wartimeProduction || 0,
                resourceWaste: bonuses.resourceWaste || {},
                coalitionApproval: bonuses.coalitionApproval || 0,
                legitimacyBonus: bonuses.legitimacyBonus || 0,
                factionConflict: bonuses.factionConflict || 0,
                diplomaticCooldown: bonuses.diplomaticCooldown || 0,
                diplomaticIncident: bonuses.diplomaticIncident || 0,
            },
            ministerEffects: {
                buildingBonuses: ministerEffects.buildingBonuses || {},
                tradeBonusMod: ministerEffects.tradeBonusMod || 0,
                militaryBonus: ministerEffects.militaryBonus || 0,
                militaryTrainingSpeed: ministerEffects.militaryTrainingSpeed || 0,
                diplomaticBonus: ministerEffects.diplomaticBonus || 0,
            },
        },
        foreignInvestmentStats: foreignStats, // [NEW] Return calculated foreign stats
        army, // 确保返回army状态，以便保存战斗损失
        officials: updatedOfficials, // 更新后的官员列表（含财务数据）
        // 计算有效官员容量（基于时代、政体和科技）
        effectiveOfficialCapacity: calculateOfficialCapacity(epoch, currentPolityEffects || {}, techsUnlocked),
        buildings: builds, // [FIX] Return updated building counts (including Free Market expansions)
        lastMinisterExpansionDay: nextLastMinisterExpansionDay,
        diplomaticReputation: updatedDiplomaticReputation, // [NEW] Return updated diplomatic reputation
        // [DEBUG] 临时调试字段 - 追踪自由市场机制问题
        _debug: {
            freeMarket: _freeMarketDebug,
            // [DEBUG] Log the log - 使用聚合后的数据
            silverChangeLog: (() => {
                const logArray = silverChangeLog.toArray();
                const hasMilitary = logArray.some(e => e.reason === 'expense_army_maintenance');
                console.log('[Simulation End] silverChangeLog has military?', hasMilitary, 'Entries:', logArray.length);
                return logArray;
            })(),
            classWealthChangeLog, // 阶层财富变化追踪日志
            startingSilver,  // tick开始时的银币
            endingSilver: res.silver || 0, // tick结束时的银币
            militaryDebugInfo: militaryDebug // [DEBUG] Pass explicit debug info
        },
    };
};
