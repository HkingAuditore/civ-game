import { BUILDINGS, STRATA, EPOCHS, RESOURCES, TECHS, ECONOMIC_INFLUENCE, TREATY_TYPE_LABELS, OFFICIAL_SIM_CONFIG, getTreatyDailyMaintenance } from '../config';
import { calculateArmyPopulation, calculateArmyFoodNeed, calculateArmyCapacityNeed, calculateArmyMaintenance, calculateArmyScalePenalty } from '../config';
import { getBuildingEffectiveConfig, getUpgradeCost, getMaxUpgradeLevel, BUILDING_UPGRADES } from '../config/buildingUpgrades';
import { BUILDING_CHAINS } from '../config/buildingChains';
import { buildOwnershipListFromLegacy, providesOwnerJobs, OWNER_TYPES } from '../config/ownerTypes';
import { getAvailableResourceSet, isResourceDemandActive, isResourceUnlocked } from '../utils/resources';
import { calculateForeignPrice } from '../utils/foreignTrade';
import { simulateBattle, UNIT_TYPES } from '../config/militaryUnits';
import { getEnemyUnitsForEpoch } from '../config/militaryActions';
import { calculateLivingStandardData, getSimpleLivingStandard, calculateWealthMultiplier, calculateLuxuryConsumptionMultiplier, calculateUnlockMultiplier, calculatePriceAwareLivingStandardThresholds, getPriceAwareLivingStandardLevel } from '../utils/livingStandard';

import { calculateLivingStandards } from './population/needs';
import { applyBuyPriceControl, applySellPriceControl } from './officials/cabinetSynergy';
import { calculateAIGiftAmount, calculateAIPeaceTribute, calculateAISurrenderDemand } from '../utils/diplomaticUtils';
import { debugLog, isDebugEnabled } from '../utils/debugFlags';
import { processPriceConvergence } from './diplomacy/treatyEffects';
import { MINISTER_EXPANSION_CONFIG } from '../config/ministerExpansion';
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
import { calculateNaturalRecovery, calculatePeriodicReputationChange, calculateVassalPolicyReputationChange } from '../config/reputationSystem';
import { aggregateWarDamagedBuildings, calculateMilitaryIndustryBoost, calculateWartimeTradeDisruption } from './diplomacy/warEconomy';
import { WAR_ECONOMY, TAX_BASE_RATES, DISCOVERY_CONFIG } from '../config/gameConstants';
import { isNationVisible, isAppearedButUndiscovered } from '../utils/nationVisibility';
import { applyIdeologyEffects, evaluateTriggerEffects, evaluateSynergyEffects, evaluateAntiSynergyEffects, applyConverters, applyRuleMods, mergeRuleMods } from './ideology/ideologyEffects';
import { ideologyEventBus, IDEOLOGY_EVENTS } from './ideology/ideologyEventBus';
import { buildIdeologyScalingContext, scaleLegacyMilestoneThreshold } from './ideology/ideologyScaling.js';
import { canForeignTradeResource } from './utils/helpers';

const getTreatyLabel = (type) => TREATY_TYPE_LABELS[type] || type;
const isTreatyActive = (treaty, tick) => !Number.isFinite(treaty?.endDay) || tick < treaty.endDay;

let cachedAvailableResourcesKey = null;
let cachedAvailableResourcesSet = null;

const mergeInvestmentByKey = (investments = [], incoming, getKey) => {
    if (!incoming) return investments;
    const next = [...investments];
    const incomingKey = getKey(incoming);
    const index = next.findIndex(inv => inv?.status === 'operating' && getKey(inv) === incomingKey);
    if (index === -1) {
        next.push(incoming);
        return next;
    }

    const current = next[index];
    next[index] = {
        ...current,
        count: (current.count || 1) + (incoming.count || 1),
        investmentAmount: (current.investmentAmount || 0) + (incoming.investmentAmount || 0),
        dailyProfit: (current.dailyProfit || 0) + (incoming.dailyProfit || 0),
        jobsProvided: (current.jobsProvided || 0) + (incoming.jobsProvided || 0),
        createdDay: Math.min(current.createdDay || incoming.createdDay || 0, incoming.createdDay || 0),
        operatingData: {
            ...(current.operatingData || {}),
            ...(incoming.operatingData || {}),
            profit: (current.operatingData?.profit || 0) + (incoming.operatingData?.profit || 0),
            profitRepatriated: (current.operatingData?.profitRepatriated || 0) + (incoming.operatingData?.profitRepatriated || 0),
            taxPaid: (current.operatingData?.taxPaid || 0) + (incoming.operatingData?.taxPaid || 0),
        },
    };
    return next;
};

const migrateAnnexedNationCapital = ({
    nations = [],
    overseasInvestments = [],
    foreignInvestments = [],
    tick = 0,
    logs = [],
}) => {
    const annexedThisTick = (nations || []).filter(n => n?.isAnnexed && n?.annexedBy && n?.annexedAt === tick);
    if (annexedThisTick.length === 0) {
        return { overseasInvestments, foreignInvestments };
    }

    const annexedMap = new Map(annexedThisTick.map(n => [n.id, n.annexedBy]));
    let nextOverseasInvestments = [];
    (overseasInvestments || []).forEach(investment => {
        const successorNationId = annexedMap.get(investment?.targetNationId);
        if (!successorNationId || investment?.status !== 'operating') {
            nextOverseasInvestments.push(investment);
            return;
        }
        nextOverseasInvestments = mergeInvestmentByKey(nextOverseasInvestments, {
            ...investment,
            targetNationId: successorNationId,
            id: `oi_${successorNationId}_${investment.buildingId}_${investment.createdDay || tick}`,
        }, getOverseasInvestmentGroupKey);
        logs.push(`💼 ${investment.targetNationId} 被吞并后，你在该国的 ${investment.buildingId} 投资已转移至 ${successorNationId}。`);
    });

    let nextForeignInvestments = [];
    (foreignInvestments || []).forEach(investment => {
        const successorNationId = annexedMap.get(investment?.ownerNationId);
        if (!successorNationId || investment?.status !== 'operating') {
            nextForeignInvestments.push(investment);
            return;
        }
        nextForeignInvestments = mergeInvestmentByKey(nextForeignInvestments, {
            ...investment,
            ownerNationId: successorNationId,
            id: `fi_${successorNationId}_${investment.buildingId}_${investment.createdDay || tick}`,
        }, getForeignInvestmentGroupKey);
        logs.push(`🏦 ${investment.ownerNationId} 被吞并后，其在我国的 ${investment.buildingId} 外资权益已转移至 ${successorNationId}。`);
    });

    return {
        overseasInvestments: nextOverseasInvestments,
        foreignInvestments: nextForeignInvestments,
    };
};

const processNationTreaties = ({ nation, tick, resources, logs, onTreasuryChange, playerWealth }) => {
    const treaties = Array.isArray(nation.treaties) ? nation.treaties : [];

    if (treaties.length > 0 && isDebugEnabled('simulation')) {
        debugLog('simulation', '[TREATY MAINTENANCE DEBUG]', {
            nationName: nation.name,
            treatyCount: treaties.length,
            treaties: treaties.map(t => ({
                type: t.type,
                endDay: t.endDay,
                active: isTreatyActive(t, tick),
                direction: t.direction,
                maintenance: t.maintenancePerDay
            })),
            currentTick: tick
        });
    }

    const activeTreaties = [];
    const expiredTreaties = [];
    let maintenanceTotal = 0;

    treaties.forEach((treaty) => {
        if (isTreatyActive(treaty, tick)) {
            activeTreaties.push(treaty);
            if (treaty.direction === 'player_to_ai') {
                let dailyMaintenance = 0;

                // 先计算当前应有的维护费（使用新公式）
                const recalculatedMaintenance = getTreatyDailyMaintenance(
                    treaty.type,
                    playerWealth || 0,
                    nation.wealth || 0
                );

                // 如果条约中有玩家自定义的维护?
                if (Number.isFinite(treaty.maintenancePerDay) && treaty.maintenancePerDay > 0) {
                    // 检查是否在合理范围内（不超过新公式计算值的10倍）
                    // 如果超过，说明是旧版本的异常值，需要重新计?
                    const maxReasonable = Math.max(recalculatedMaintenance * 10, 10000);

                    if (treaty.maintenancePerDay <= maxReasonable) {
                        // 在合理范围内，使用玩家自定义的?
                        dailyMaintenance = treaty.maintenancePerDay;
                    } else {
                        // 超出合理范围，使用新公式重新计算
                        dailyMaintenance = recalculatedMaintenance;
                    }
                } else {
                    // 没有自定义值或值为0，使用新公式
                    dailyMaintenance = recalculatedMaintenance;
                }

                maintenanceTotal += Math.max(0, dailyMaintenance);
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
    CRITICAL_SHORTAGE_THRESHOLD,
    CRITICAL_RESOURCES,
    SUBSIDY_INCOME_SIGNAL_BONUS,
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
    setDynamicFrequencyContext,
    startTickBudget,
    checkTickBudget,
    recordTickComplete,
    logTickSegments,
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
    processStateManagedInvestment,
    calculateStateManagedProfitSplit,
    calculateEfficiencyBonus,
    FINANCIAL_STATUS,
} from './officials/officialInvestment';
import { LOYALTY_CONFIG, PROPERTY_POLICY_CONFIG } from '../config/officials';
import { isStanceSatisfied } from '../config/politicalStances';
import { migrateOfficialForInvestment } from './officials/migration';
import { calculateBuildingCost, applyBuildingCostModifier, areUpgradeInputsUnlocked } from '../utils/buildingUpgradeUtils';
import { calculateSilverCost } from '../utils/economy';

const buildInitialMinisterExpansionCooldowns = () => ({
    global: 0,
    agriculture: 0,
    industry: 0,
    commerce: 0,
    civic: 0,
});

const normalizeMinisterExpansionCooldowns = (value) => {
    const base = buildInitialMinisterExpansionCooldowns();
    if (Number.isFinite(value)) {
        return {
            ...base,
            global: value,
            agriculture: value,
            industry: value,
            commerce: value,
            civic: value,
        };
    }
    if (!value || typeof value !== 'object') {
        return base;
    }
    return {
        ...base,
        ...value,
    };
};

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
    processAIWarPreparations,
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
    calculateEnhancedTribute,
    initializeNationEconomyData,
    updateNationEconomyData,
    // AI Economy functions (Refactored System)
    AIEconomyService,
    migrateNationEconomy,
    EconomyDebugger,
    checkAIEpochProgression,
    scaleNewlyUnlockedNation,
    // Nation Discovery functions
    processGradualDiscovery,
    processAINationDiscovery,
    discoverOnWar,
    discoverNationsOnEpochChange,
    initializeRebelEconomy,
    processPostWarRecovery,
    processInstallmentPayment,
    // International Organization functions
    processOrganizationMonthlyUpdate,
    getOrganizationEffects,
    shouldDisbandOrganization,
    ORGANIZATION_TYPE_CONFIGS,
    getOrganizationMaxMembers,
    // Population Migration functions
    processMonthlyMigration,
    applyMigrationToPopStructure,
    generateMigrationLogs,
    // Rebellion System functions
    processRebellionSystemDaily,
    getRebellionRiskAssessment,
    // War Economy functions
    generateAIBuildingProfile,
    processAIBuildingRecovery,
} from './diplomacy';
import { calculateAITreasuryTargetRatio } from './diplomacy/economyUtils';
import {
    calculateOverseasInvestmentSummary,
    processOverseasInvestments,
    processForeignInvestments,
    processOverseasInvestmentUpgrades,
    processForeignInvestmentUpgrades,
    getOverseasInvestmentGroupKey,
    getForeignInvestmentGroupKey,
} from './diplomacy/overseasInvestment';
import { getFrontlineEconomicModifiers, getEffectiveFrontWarScore } from './diplomacy/frontSystem';

// V2: Helper — compute average approval across all strata
function _calcAvgApproval(classApproval) {
    if (!classApproval || typeof classApproval !== 'object') return 50;
    const values = Object.values(classApproval).filter(v => typeof v === 'number');
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 50;
}

const PLAYER_CIVILIAN_WEALTH_BASELINE_WEIGHT = 0.35;
const calculatePlayerComparableWealth = (resources = {}, classWealth = {}) => {
    const treasury = Number(resources?.silver || 0);
    const civilianWealth = Object.values(classWealth || {}).reduce((sum, value) => {
        return sum + Math.max(0, Number(value) || 0);
    }, 0);

    // AI national wealth is a macro stock, not a 1:1 mirror of every private holding.
    // Blend treasury with a conservative slice of civilian wealth so foreign economies
    // can keep pace with the player's real economic maturity without exploding upward.
    return Math.max(
        100,
        Math.round(treasury + civilianWealth * PLAYER_CIVILIAN_WEALTH_BASELINE_WEIGHT)
    );
};

// [PERF] Module-level reusable Map for silverChangeTotals — avoids allocating a new Map every tick
const _reusableSilverMap = new Map();

// [PERF] Module-level reusable objects for building production loop — avoids allocating per-building per-tick
const _reusableEffectiveOps = { input: {}, output: {}, jobs: {} };
const _reusableOwnerLevelGroups = {};

// [PERF] Module-level reusable objects for high-frequency temporary variables
// 避免每 tick 分配新对象，减少 GC 压力
const _reusableSupplyBreakdown = {};
const _reusableResourceLossBreakdown = {};
const _reusableRoleLaborIncome = {};
const _reusableRoleExpense = {};
const _reusableRoleHeadTaxPaid = {};
const _reusableRoleBusinessTaxPaid = {};
const _reusableRoleTaxableIncome = {}; // [FIX] 应税收入追踪（工资+业主收入+军饷，不含补贴）

/** Clear all own keys from a plain object (reuse without allocation) */
function _clearObj(obj) {
    for (const k in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, k)) delete obj[k];
    }
}

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
    classLivingStandard: currentClassLivingStandard = {},
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
    classWealthHistory,
    classNeedsHistory,
    merchantState = { pendingTrades: [], lastTradeTime: 0 },
    maxPopBonus = 0,
    eventApprovalModifiers = {},
    eventStabilityModifier = 0,
    currentStability = 50, // NEW: Current stability for inertia calculation
    // Economic modifiers from events
    eventResourceDemandModifiers = {},   // { resourceKey: percentModifier }
    eventStratumDemandModifiers = {},    // { stratumKey: percentModifier }
    eventBuildingProductionModifiers = {}, // { buildingIdOrCat: percentModifier }
    livingStandardStreaks = {},
    buildingUpgrades = {}, // 建筑升级状?
    rulingCoalition = [], // 执政联盟成员阶层
    previousLegitimacy = 0, // 上一tick的合法性值，用于计算税收修正
    migrationCooldowns = {}, // 阶层迁移冷却状?

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
    previousTaxShock = {}, // [NEW] 上一tick各阶层的累积税收冲击值，用于防止"快速抬税后降税"的漏?
    eventEffectSettings = {}, // [NEW] Event effect settings including log visibility
    foreignInvestments = [], // [NEW] Foreign investments for profit calculation
    overseasInvestments = [], // [NEW] Overseas investments for processing
    foreignInvestmentPolicy = 'normal', // [NEW] Policy for foreign investments
    foreignInvestmentPolicyOverrides = {}, // [NEW] Per-nation tax policy overrides
    tradeOpportunities: previousTradeOpportunities = null, // [NEW] Cache for trade opportunities
    diplomaticReputation = 50, // [NEW] Player's diplomatic reputation (0-100)
    // [NEW] Military corps & battle system (pass-through for state preservation)
    militaryCorps = [],
    generals = [],
    activeFronts = [],
    activeBattles = [],
    // 理念系统
    equippedIdeologies = [],  // 已装备的理念对象列表 [{ id, level, effects, ... }]
    ideologySynergies = [],   // 联动配置数组
    antiSynergies = [],       // 反协同配置数组
    ideologyMetrics = null,
    // [PERF] 性能模式标志，主线程传入
    _isLowPerformance = false,
    // [PERF] Full tick 标志：非 full tick 时跳过 buildingFinancialData 等详细计算
    _isFullTick = true,
}) => {
    if (!Number.isFinite(tick)) {
        const parsedTick = Number(tick);
        tick = Number.isFinite(parsedTick) ? parsedTick : 0;
    }
    tick = Math.max(0, tick);
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
        // 立即清理 marks 和 measures 防止内存堆积
        performance.clearMarks(startMark);
        performance.clearMarks(endMark);
        performance.clearMeasures(measureName);
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

    // [PERF] 设置动态频率上下文：根据当前存活AI国家数量自动调整所有deferred/batch级操作的执行频率
    const _aliveAINationCount = (nations || []).filter(n => !n.isAnnexed && (n.population || 0) > 0 && n.id !== 'player').length;
    setDynamicFrequencyContext(_aliveAINationCount, _isLowPerformance);
    // [PERF] 开始预算计时
    startTickBudget();

    const res = { ...resources };
    const _resSilverAtSpread = res.silver || 0; // [DIAG] immediately after spread copy
    const _earlyStartingSilver = res.silver || 0; // [FIX] capture before any modifications
    const getSlice = (list, slices) => {
        if (!Array.isArray(list) || list.length === 0) return [];
        if (!slices || slices <= 1 || list.length <= slices) return list;
        const size = Math.ceil(list.length / slices);
        const start = (tick % slices) * size;
        return list.slice(start, start + size);
    };
    const priceMap = { ...(market?.prices || {}) };

    const _simDebugEnabled = isDebugEnabled('simulation');

    // [PERF] 非 full tick 时跳过 buildingFinancialData / classFinancialData 等详细计算
    // 这些数据仅供 UI 面板显示，主线程有 fullTickCacheRef 缓存上一次 full tick 的值
    const _shouldComputeFinancialDetail = _isFullTick || _simDebugEnabled;

    // === 资源变化追踪系统 ===
    // Silver change log (aggregated for performance)
    // [PERF] Reuse module-level Map to avoid creating a new Map every tick (reduces GC pressure)
    _reusableSilverMap.clear();
    const silverChangeTotals = _reusableSilverMap;
    const silverChangeLog = {
        // 记录方法：累加到对应?key
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
        // 兼容数组?length 属?
        get length() { return silverChangeTotals.size; },
    };
    const trackSilverChange = (amount, reason) => {
        silverChangeLog.record(amount, reason);
    };

    // 国有建筑银币产出累加器（用于财政估算）
    let stateBuildingSilverOutput = 0;

    const trackResourceChange = _simDebugEnabled
        ? (() => {
            const _log = {};
            return (resourceType, amount, reason) => {
                if (!_log[resourceType]) _log[resourceType] = [];
                _log[resourceType].push({ amount, reason, balance: res[resourceType] || 0 });
            };
        })()
        : () => {};

    // Helper: modify res[resourceType] AND track the change in one call (for traceability)
    const applyResourceChange = (resourceType, amount, reason) => {
        if (amount === 0) return;
        if (!Number.isFinite(amount)) return;
        const newVal = (res[resourceType] || 0) + amount;
        // 银币可以为负（欠债），其他资源不可低于 0
        res[resourceType] = resourceType === 'silver' ? newVal : Math.max(0, newVal);
        trackResourceChange(resourceType, amount, reason);
        if (resourceType === 'silver') {
            trackSilverChange(amount, reason);
        }
    };

    // Convenience wrapper for silver (most common case)
    const applySilverChange = (amount, reason) => {
        applyResourceChange('silver', amount, reason);
    };

    // [FIX] 贸易系统已在 simulateMerchantTrade 中直接结算资源、国家库存与关税。
    // 旧的 tradeRouteSummary / calculatedTradeRouteTax 链路已被移除，避免残留引用和重复结算。
    const tradeRouteTax = 0;

    // Adapter callback for external modules (different argument order)
    // External modules call: onResourceChange(delta, reason, resourceType)
    const onResourceChangeCallback = (delta, reason, resourceType) => {
        applyResourceChange(resourceType, delta, reason);
    };

    const classWealthChangeLog = _simDebugEnabled ? {} : null;
    const trackClassWealthChange = _simDebugEnabled
        ? (stratumKey, amount, reason) => {
            if (!classWealthChangeLog[stratumKey]) classWealthChangeLog[stratumKey] = [];
            classWealthChangeLog[stratumKey].push({ amount, reason, balance: wealth[stratumKey] || 0 });
        }
        : () => {};

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

    const startingSilver = _earlyStartingSilver; // [FIX] use pre-modification baseline

    // [DIAGNOSTIC] Silver audit checkpoint helper
    let _lastCheckpointSilver = res.silver || 0;
    let _lastCheckpointAudit = Array.from(silverChangeTotals.values()).reduce((s, v) => s + v, 0);
    const _silverCheckpoint = (phase) => {
        const curSilver = res.silver || 0;
        const auditSum = Array.from(silverChangeTotals.values()).reduce((s, v) => s + v, 0);
        const silverDelta = curSilver - _lastCheckpointSilver;
        const auditDelta = auditSum - _lastCheckpointAudit;
        const phaseGap = silverDelta - auditDelta;
        if (Math.abs(phaseGap) > 0.1 && _simDebugEnabled) {
            debugLog('simulation', `🟡 [SIM检查点:${phase}] 阶段差异: ${phaseGap.toFixed(2)} | silver变化: ${silverDelta.toFixed(2)} | 审计变化: ${auditDelta.toFixed(2)}`);
        }
        _lastCheckpointSilver = curSilver;
        _lastCheckpointAudit = auditSum;
    };

    // === Process Overseas & Foreign Investments (Worker Side) ===
    // COW: 不预先拷贝，由后续处理函数返回新数组
    let updatedOverseasInvestments = overseasInvestments;
    let updatedForeignInvestments = foreignInvestments;
    // [PERF] 投资升级仍保持低频守卫（默认每20tick执行一次）
    const shouldUpgradeOverseasInvestment = shouldRunThisTick(tick, 'overseasInvestment');
    const shouldUpgradeForeignInvestment = shouldRunThisTick(tick, 'foreignInvestment');
    // [PERF] 切片化：利润结算每tick执行一个切片，切片数作为倍率补偿轮转间隔
    const oiSliceCount = Math.max(1, RATE_LIMIT_CONFIG.overseasInvestmentSlices || 5);
    const fiSliceCount = Math.max(1, RATE_LIMIT_CONFIG.foreignInvestmentSlices || 5);
    // NEW: Track supply source breakdown
    // [PERF] 复用模块级对象，避免每 tick 分配新对象
    _clearObj(_reusableSupplyBreakdown);
    const supplyBreakdown = _reusableSupplyBreakdown;
    _clearObj(_reusableResourceLossBreakdown);
    const resourceLossBreakdown = _reusableResourceLossBreakdown;

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
    const buildingDebugData = _simDebugEnabled ? {} : null;

    if (Object.keys(STRATA).length > 0) {
        Object.keys(STRATA).forEach(key => {
            classFinancialData[key] = {
                income: { wage: 0, ownerRevenue: 0, subsidy: 0, salary: 0, militaryPay: 0, tradeImportRevenue: 0, layoffTransfer: 0, taxableIncome: 0 },
                expense: {
                    headTax: 0,
                    transactionTax: 0,
                    businessTax: 0,
                    tariffs: 0,
                    essentialNeeds: {},  // 基础需求消费 { resource: cost }
                    luxuryNeeds: {},     // 奢侈需求消费 { resource: cost }
                    decay: 0,
                    productionCosts: 0,
                    wages: 0,  // 工资支出（业主支付给工人?
                    tradeExportPurchase: 0, // 贸易出口购买成本
                    transportCost: 0, // 海外投资运输成本
                    capitalFlight: 0, // 资本外?
                    buildingCost: 0, // 建筑建?升级成本
                    layoffTransfer: 0 // 裁员时随人口转移的财?
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
    const previousWages = market?.wages || {};
    const livingCostBreakdown = computeLivingCosts(priceMap, headTaxRates, resourceTaxRates, previousWages);
    const priceLivingCosts = buildLivingCostMap(
        livingCostBreakdown,
        ECONOMIC_INFLUENCE?.price || {}
    );
    const wageLivingCosts = buildLivingCostMap(
        livingCostBreakdown,
        ECONOMIC_INFLUENCE?.wage || {}
    );
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
    // [FIX] 添加缺失?getHeadTaxRate 本地包装函数
    const getHeadTaxRate = (key) => getHeadTaxRateFromModule(key, headTaxRates);

    const getResourceTaxRate = (resource) => {
        const rate = resourceTaxRates[resource];
        if (typeof rate === 'number') return rate; // 允许负税?
        return 0;
    };
    const getBusinessTaxRate = (buildingId) => {
        // 使用模块级函数确保截断逻辑（TAX_LIMITS.MAX_BUSINESS_TAX）生效
        return getBusinessTaxRateFromModule(buildingId, businessTaxRates);
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

    // [DEBUG] Track taxBonus accumulation (migrated from incomePercentBonus)
    const bonusDebug = {
        afterInit: bonuses.taxBonus || 0,
        afterOfficials: 0,
        afterStance: 0,
        afterTechs: 0,
        afterDecrees: 0,
    };

    // === Execute Investment Logic (Now that Wealth/Ledger is ready) ===

    // 1. Overseas Investments (Player -> AI)
    // [PERF] 切片轮转：每tick结算一个切片，切片数作为倍率补偿轮转间隔
    if (overseasInvestments.length > 0) {
        perfStart('overseasInvestments');
        // 切片化：将投资列表分成 oiSliceCount 个切片，每tick只处理一个
        const oiSlicedInvestments = getSlice(overseasInvestments, oiSliceCount);
        // 实际切片数：当投资数 <= 切片数时退化为全量（ticksElapsed=1）
        const oiEffectiveSlices = (overseasInvestments.length <= oiSliceCount) ? 1 : oiSliceCount;

        const oiResult = processOverseasInvestments({
            overseasInvestments: oiSlicedInvestments,
            nations,
            organizations: diplomacyOrganizations?.organizations || [],
            resources: res,
            marketPrices: priceMap,
            classWealth: wealth,
            taxPolicies: policies,
            daysElapsed: tick,
            ticksElapsed: oiEffectiveSlices, // 切片化：用切片数替代原频率值作为倍率
        });

        // 合并更新：切片结果只包含本切片的投资，需与未处理的投资合并
        if (oiEffectiveSlices <= 1) {
            // 全量模式：直接使用返回结果
            updatedOverseasInvestments = oiResult.updatedInvestments;
        } else {
            // 切片模式：将切片结果合并回完整列表
            const updatedMap = new Map(oiResult.updatedInvestments.map(inv => [inv.id, inv]));
            updatedOverseasInvestments = overseasInvestments.map(inv => updatedMap.get(inv.id) || inv);
        }
        // Apply profits to wealth
        if (oiResult.profitByStratum) {
            Object.entries(oiResult.profitByStratum).forEach(([stratum, profit]) => {
                if (profit > 0) {
                    wealth[stratum] = (wealth[stratum] || 0) + profit;
                }
            });
        }
        
        // [FIX] 记录海外投资的成本和收入到classFinancialData
        if (oiResult.costsByStratum) {
            Object.entries(oiResult.costsByStratum).forEach(([stratum, costs]) => {
                if (classFinancialData[stratum]) {
                    classFinancialData[stratum].income.ownerRevenue = (classFinancialData[stratum].income.ownerRevenue || 0) + costs.outputValue;
                    classFinancialData[stratum].expense.productionCosts = (classFinancialData[stratum].expense.productionCosts || 0) + costs.inputCost;
                    classFinancialData[stratum].expense.wages = (classFinancialData[stratum].expense.wages || 0) + costs.wageCost;
                    classFinancialData[stratum].expense.businessTax = (classFinancialData[stratum].expense.businessTax || 0) + costs.businessTaxCost;
                    classFinancialData[stratum].expense.transportCost = (classFinancialData[stratum].expense.transportCost || 0) + costs.transportCost;
                }
            });
        }

        if (oiResult.tariffRevenue > 0) {
            applySilverChange(oiResult.tariffRevenue, 'overseas_investment_tariff');
            taxBreakdown.tariff = (taxBreakdown.tariff || 0) + oiResult.tariffRevenue;
        }
        if (oiResult.tariffSubsidy > 0) {
            applySilverChange(-oiResult.tariffSubsidy, 'overseas_investment_tariff_subsidy');
            taxBreakdown.tariffSubsidy = (taxBreakdown.tariffSubsidy || 0) + oiResult.tariffSubsidy;
        }

        // Apply market/player resource changes
        if (oiResult.playerInventoryChanges) {
            Object.entries(oiResult.playerInventoryChanges).forEach(([key, delta]) => {
                applyResourceChange(key, delta, 'overseas_investment_return');
            });
        }

        // [FIX] Apply market changes to target nations (supply/demand impact)
        if (oiResult.marketChanges) {
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
                    nation._investmentEffects = effects;
                }
            });
        }
        perfEnd('overseasInvestments');
    }

    // 海外投资升级：保持低频执行（与利润结算独立）
    if (overseasInvestments.length > 0 && shouldUpgradeOverseasInvestment) {
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
            if (upgradeResult.wealthChanges) {
                Object.entries(upgradeResult.wealthChanges).forEach(([stratum, delta]) => {
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

    const baseIdeologyRuleMods = equippedIdeologies?.length ? applyRuleMods(equippedIdeologies) : {};
    const ideologyOfficialBonusMod = baseIdeologyRuleMods.official_bonus?._global || 0;
    const scaleOfficialEffects = (effects, modifier) => {
        if (!modifier) return effects;
        const multiplier = Math.max(0, 1 + modifier);
        const scaleValue = (value) => {
            if (typeof value === 'number') return value * multiplier;
            if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
            const scaled = {};
            Object.entries(value).forEach(([key, nested]) => {
                scaled[key] = typeof nested === 'number' ? nested * multiplier : nested;
            });
            return scaled;
        };
        const scaledEffects = {};
        Object.entries(effects || {}).forEach(([key, value]) => {
            scaledEffects[key] = scaleValue(value);
        });
        return scaledEffects;
    };

    // === 应用官员效果（含薪水不足减益?===
    const activeOfficialEffects = scaleOfficialEffects(
        getAggregatedOfficialEffects(officials, officialsPaid),
        ideologyOfficialBonusMod
    );
    const officialEffectsForBonuses = {
        ...activeOfficialEffects,
        passive: activeOfficialEffects.passiveGains,
        passivePercent: activeOfficialEffects.passivePercentGains,
        resourceDemandMod: activeOfficialEffects.decreeResourceDemandMod,
        stratumDemandMod: activeOfficialEffects.decreeStratumDemandMod,
        maxPop: activeOfficialEffects.extraMaxPop,
        taxIncome: activeOfficialEffects.taxBonus, // [MIGRATED] 原 incomePercent → taxIncome
    };
    applyEffects(officialEffectsForBonuses, bonuses);

    // [DEBUG] Track after officials
    bonusDebug.afterOfficials = bonuses.taxBonus || 0;
    // === 应用官员专属效果?bonuses ===
    // 科研速度 ?scienceBonus
    if (activeOfficialEffects.researchSpeed) {
        bonuses.scienceBonus = (bonuses.scienceBonus || 0) + activeOfficialEffects.researchSpeed;
    }
    // 税收效率 ?存储供税收计算使?
    bonuses.taxEfficiencyBonus = activeOfficialEffects.taxEfficiency || 0;
    // 腐败 存储供税收计算使用(负面效果)
    bonuses.corruption = activeOfficialEffects.corruption || 0;
    // 税收加成 存储供财政计算使用 [MIGRATED] 原 incomePercentBonus → taxBonus
    if (activeOfficialEffects.taxBonus) {
        bonuses.taxBonus = (bonuses.taxBonus || 0) + activeOfficialEffects.taxBonus;
    }
    // 人口增长 ?存储供人口计算使?
    bonuses.populationGrowthBonus = activeOfficialEffects.populationGrowth || 0;
    // 军费降低 ?存储供军费计算使?
    bonuses.militaryUpkeepMod = activeOfficialEffects.militaryUpkeep || 0;
    // 军队战力加成 ?存储供战斗力计算使用
    if (activeOfficialEffects.militaryBonus) {
        bonuses.militaryBonus = (bonuses.militaryBonus || 0) + activeOfficialEffects.militaryBonus;
    }
    // 贸易加成 ?存储供贸易计算使?
    bonuses.tradeBonusMod = activeOfficialEffects.tradeBonus || 0;
    // 建筑成本 ?存储供建筑购买使?
    bonuses.buildingCostMod = activeOfficialEffects.buildingCostMod || 0;
    // 战时生产加成 ?存储供生产计算使?
    bonuses.wartimeProduction = activeOfficialEffects.wartimeProduction || 0;
    // 资源浪费 ?存储供需?生产消耗使?
    bonuses.resourceWaste = activeOfficialEffects.resourceWaste || {};
    // 联盟满意度 存储供满意度计算使用
    bonuses.coalitionApproval = activeOfficialEffects.coalitionApproval || 0;
    // 合法性加成 存储供合法性修正使用
    bonuses.legitimacyBonus = activeOfficialEffects.legitimacyBonus || 0;
    // 组织度增长修正（负值降低增长）
    bonuses.organizationGrowthMod = (bonuses.organizationGrowthMod || 0) + (activeOfficialEffects.organizationDecay || 0);
    // 派系冲突 ?稳定度惩?
    bonuses.factionConflict = (bonuses.factionConflict || 0) + (activeOfficialEffects.factionConflict || 0);
    // 外交冷却修正
    bonuses.diplomaticCooldown = activeOfficialEffects.diplomaticCooldown || 0;
    // 外交关系衰减
    bonuses.diplomaticIncident = activeOfficialEffects.diplomaticIncident || 0;
    // 外交加成 ?存储供外交关系计算使?
    bonuses.diplomaticBonus = activeOfficialEffects.diplomaticBonus || 0;
    // 生产原料成本修正 ?存储供建筑生产计算使?
    bonuses.officialProductionInputCost = activeOfficialEffects.productionInputCost || {};

    // === 应用政治立场效果 ===
    // 构建简化的游戏状态用于条件检?
    const stanceCheckState = {
        classApproval: previousApproval,
        classInfluence: market?.classInfluence || {},
        totalInfluence: market?.totalInfluence || 1,
        classLivingStandard: currentClassLivingStandard || {},
        classIncome: market?.classIncome || {},
        stability: currentStability / 100, // 转换?-1
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

    // 应用立场效果?bonuses
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
    // Cap taxEfficiencyBonus at 1.0 (100%) so that rawEfficiency = efficiency * (1 + bonus - corruption)
    // never exceeds 1.0 when corruption is 0, keeping displayed bonus consistent with actual effect.
    bonuses.taxEfficiencyBonus = Math.min(1.0, bonuses.taxEfficiencyBonus || 0);

    if (stanceEffects.taxBonus) {
        bonuses.taxBonus = (bonuses.taxBonus || 0) + stanceEffects.taxBonus;
    }

    // [DEBUG] Track after stance
    bonusDebug.afterStance = bonuses.taxBonus || 0;

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
    // 立场生产成本效果存储供后续使?
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
        if (!Number.isFinite(percent)) return;
        // 加法模式：与 applyEffects 和生产循环一致（0 = 无加成，0.12 = +12%）
        buildingBonuses[id] = (buildingBonuses[id] || 0) + percent;
    };

    const boostCategory = (category, percent) => {
        if (!category || typeof percent !== 'number') return;
        if (!Number.isFinite(percent)) return;
        // 加法模式：与 applyEffects 和生产循环一致（0 = 无加成，0.25 = +25%）
        categoryBonuses[category] = (categoryBonuses[category] || 0) + percent;
    };

    const addPassiveGain = (resource, amount) => {
        if (!resource || typeof amount !== 'number') return;
        passiveGains[resource] = (passiveGains[resource] || 0) + amount;
    };

    // Apply effects using imported module functions
    // Apply tech effects using module function
    applyTechEffects(techsUnlocked, bonuses);
    bonusDebug.afterTechs = bonuses.taxBonus || 0;

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

    // Apply active buffs (Strata bonuses)
    if (Array.isArray(productionBuffs)) {
        productionBuffs.forEach(buff => {
            // Ideology-sourced buffs: route taxIncome to virtualTaxIncome (phantom silver)
            if (buff.source === 'ideology' && typeof buff.taxIncome === 'number') {
                const { taxIncome: taxVal, ...restBuff } = buff;
                applyEffects(restBuff, bonuses);
                bonuses.virtualTaxIncome = (bonuses.virtualTaxIncome || 0) + taxVal;
            } else {
                applyEffects(buff, bonuses);
            }
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

    // Apply Ideology effects（理念效果：基础数值 + 条件触发 + 联动 + 转化引擎 + 规则修改）
    let ideologySynergyResult = null;
    let ideologyRuleMods = {};
    // Snapshot bonuses before ideology effects for delta tracking
    const _preIdeoCatBonuses = { ...bonuses.categoryBonuses };
    const _preIdeoProductionBonus = bonuses.productionBonus;
    const _preIdeoIndustryBonus = bonuses.industryBonus;
    if (equippedIdeologies && equippedIdeologies.length > 0) {
        applyIdeologyEffects(equippedIdeologies, bonuses);

        // Compute buildingCategoryCounts: count buildings by category (gather/industry/civic/military)
        // 同时维护 'all' 聚合，便于理念配置使用 category: 'all' 表示"任意建筑总数"
        const buildingCategoryCounts = {};
        for (const b of BUILDINGS) {
            const count = buildings[b.id] || 0;
            if (count > 0 && b.cat) {
                buildingCategoryCounts[b.cat] = (buildingCategoryCounts[b.cat] || 0) + count;
                buildingCategoryCounts.all = (buildingCategoryCounts.all || 0) + count;
            }
        }

        // Compute completedChains: count building chains where all buildings have at least 1 built
        let completedChains = 0;
        if (typeof BUILDING_CHAINS === 'object' && BUILDING_CHAINS) {
            for (const chain of Object.values(BUILDING_CHAINS)) {
                if (chain.buildings && chain.buildings.length > 0) {
                    const allBuilt = chain.buildings.every(bId => (buildings[bId] || 0) > 0);
                    if (allBuilt) completedChains++;
                }
            }
        }

        // Compute totalBuildings for converter source
        let totalBuildings = 0;
        for (const b of BUILDINGS) {
            totalBuildings += (buildings[b.id] || 0);
        }

        // --- V2: per-building-id counts for building_specific_bonus trigger ---
        const buildingCounts = {};
        for (const b of BUILDINGS) {
            const cnt = buildings[b.id] || 0;
            if (cnt > 0) buildingCounts[b.id] = cnt;
        }

        // --- V2: unit category counts for unit_count_bonus trigger ---
        // 同时维护 'all' / '_all' 聚合，便于配置使用 category: 'all' 表示"任何兵种总数"
        const unitCategoryCounts = {};
        if (army && typeof army === 'object') {
            for (const [unitId, count] of Object.entries(army)) {
                const unitDef = UNIT_TYPES?.[unitId];
                if (unitDef?.category && count > 0) {
                    unitCategoryCounts[unitDef.category] = (unitCategoryCounts[unitDef.category] || 0) + count;
                    unitCategoryCounts.all = (unitCategoryCounts.all || 0) + count;
                    unitCategoryCounts._all = (unitCategoryCounts._all || 0) + count;
                }
            }
        }

        // --- V2: trade volume estimation from merchant auto-trade ---
        const tradeVolume = (merchantState?.pendingTrades || []).reduce((sum, t) => sum + (t.value || t.amount || 0), 0);

        const ideologyTriggerState = {
            popStructure: previousPopStructure,
            epoch,
            techsUnlocked,
            resources,
            completedChains,
            buildingCategoryCounts,
            // New fields for converters and event-driven effects
            officialCount: Array.isArray(officials) ? officials.filter(o => o.hired).length : 0,
            isAtWar: nations.some(n => n.isAtWar),
            warScore: nations.find(n => n.isAtWar)?.warScore || 0,
            totalBuildings,
            stability: currentStability || 50,
            population: population || 0,
            treasury: resources?.silver || 0,
            // === V2: extended state fields ===
            warCount: (nations || []).filter(n => n.isAtWar).length,
            friendlyCount: (nations || []).filter(n => !n.isAnnexed && !n.isAtWar && (n.relation || 0) >= 50).length,
            vassalCount: (nations || []).filter(n => n.vassalOf === 'player' || n.isAnnexed).length,
            tradeVolume,
            unemployment: previousPopStructure?.unemployed || 0,
            legitimacy: previousLegitimacy ?? 50,
            avgApproval: _calcAvgApproval(previousApproval),
            militarySize: Object.values(army || {}).reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0),
            buildingCounts,
            unitCategoryCounts,
            classLivingStandard: currentClassLivingStandard || {},
            classApproval: previousApproval || {},
            officials: officials || [],
            rulingCoalition: rulingCoalition || [],
            ideologyScaling: buildIdeologyScalingContext({
                epoch,
                ideologyMetrics,
                population,
                totalBuildings,
                militarySize: Object.values(army || {}).reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0),
                vassalCount: (nations || []).filter(n => n.vassalOf === 'player' || n.isAnnexed).length,
            }),
        };

        // Pipeline: base effects → converters → trigger effects → synergy effects → rule mods
        applyConverters(equippedIdeologies, ideologyTriggerState, bonuses);
        const ideologyOneTimeEffects = evaluateTriggerEffects(equippedIdeologies, ideologyTriggerState, bonuses);
        // 处理理念资源消耗（resource_drain 类型）
        if (ideologyOneTimeEffects.resourceDrains) {
            for (const [resKey, amount] of Object.entries(ideologyOneTimeEffects.resourceDrains)) {
                if (resources[resKey] != null) {
                    resources[resKey] = Math.max(0, resources[resKey] - amount);
                }
            }
        }
        // 处理理念人口加成（flatPop）
        if (ideologyOneTimeEffects.flatPop) {
            bonuses.extraMaxPop = (bonuses.extraMaxPop || 0) + ideologyOneTimeEffects.flatPop;
        }
        const equippedIds = equippedIdeologies.map(i => i.id);
        const synergyResult = evaluateSynergyEffects(equippedIds, ideologySynergies, bonuses);
        const antiSynergyResult = evaluateAntiSynergyEffects(equippedIds, antiSynergies, bonuses);
        ideologySynergyResult = {
            ...synergyResult,
            activeAntiSynergies: antiSynergyResult.activeAntiSynergies,
        };
        ideologyRuleMods = mergeRuleMods(
            applyRuleMods(equippedIdeologies),
            synergyResult.mechanicEffects?.ruleMods || []
        );

        // === V2: 将 ruleMods 中的全局修正注入 bonuses ===
        // corruption_mod: 叠加到腐败率（负值=减少腐败）
        const ideoCorruptionMod = ideologyRuleMods.corruption_mod?._global || 0;
        if (ideoCorruptionMod) bonuses.corruption = Math.max(0, (bonuses.corruption || 0) + ideoCorruptionMod);
        // official_bonus: 作为官员体系整体强度修正，供 UI/后续系统消费
        bonuses.ideoOfficialBonusMod = ideologyRuleMods.official_bonus?._global || 0;
        // official_capacity: 理念加官员上限（整数加成）
        bonuses.ideoOfficialCapacityBonus = Math.floor(ideologyRuleMods.official_capacity?._global || 0);
        // tax_modifier: 作用于整体征税倍率，和 taxIncome 区分开
        bonuses.ideoTaxModifier = ideologyRuleMods.tax_modifier?._global || 0;
        // cooldown_mod: 供外交/军事/策略行动统一读取
        bonuses.ideoCooldownMod = ideologyRuleMods.cooldown_mod?._global || 0;
        // trade_route_mod: 叠加到贸易加成
        const ideoTradeMod = ideologyRuleMods.trade_route_mod?._global || 0;
        if (ideoTradeMod) bonuses.tradeBonusMod = (bonuses.tradeBonusMod || 0) + ideoTradeMod;
        // tech_cost_mod: 存到 bonuses 供 hooks 层消费
        bonuses.ideoTechCostMod = ideologyRuleMods.tech_cost_mod?._global || 0;
        // building_cost_mod: 按 scope 合并后存到 bonuses 供 hooks 层消费
        bonuses.ideoBuildingCostMod = ideologyRuleMods.building_cost_mod || {};
        // recruit_cost_mod: 按 scope 存到 bonuses 供 hooks 层消费
        bonuses.ideoRecruitCostMod = ideologyRuleMods.recruit_cost_mod || {};
        // maintenance_cost_mod: 按 scope 存到 bonuses 供军费计算
        bonuses.ideoMaintenanceCostMod = ideologyRuleMods.maintenance_cost_mod || {};
        // price_volatility_mod: 全局价格波动衰减
        bonuses.ideoPriceVolatilityMod = ideologyRuleMods.price_volatility_mod?._global || 0;
        // resource_price_mod: 按资源 scope 存储
        bonuses.ideoResourcePriceMod = ideologyRuleMods.resource_price_mod || {};
        // wages_mod: 按阶层 scope 存储
        bonuses.ideoWagesMod = ideologyRuleMods.wages_mod || {};
        // stratum_output_mod: 按阶层 scope 存储
        bonuses.ideoStratumOutputMod = ideologyRuleMods.stratum_output_mod || {};
        // building_input_mod: 按建筑分类 scope 存储
        bonuses.ideoBuildingInputMod = ideologyRuleMods.building_input_mod || {};
        // unit_attack_mod / unit_defense_mod: 按兵种 scope 存储
        bonuses.ideoUnitAttackMod = ideologyRuleMods.unit_attack_mod || {};
        bonuses.ideoUnitDefenseMod = ideologyRuleMods.unit_defense_mod || {};
        // diplomatic_influence: 全局外交影响力
        bonuses.ideoDiplomaticInfluence = ideologyRuleMods.diplomatic_influence?._global || 0;
    }
    // Compute ideology-specific contribution deltas for UI display
    const _ideologyCategoryBonus = {
        gather: (bonuses.categoryBonuses.gather || 0) - (_preIdeoCatBonuses.gather || 0),
        industry: (bonuses.categoryBonuses.industry || 0) - (_preIdeoCatBonuses.industry || 0),
        civic: (bonuses.categoryBonuses.civic || 0) - (_preIdeoCatBonuses.civic || 0),
        military: (bonuses.categoryBonuses.military || 0) - (_preIdeoCatBonuses.military || 0),
    };
    const _ideologyProductionBonus = bonuses.productionBonus - _preIdeoProductionBonus;
    const _ideologyIndustryBonus = bonuses.industryBonus - _preIdeoIndustryBonus;

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
    // [MIGRATED] incomePercentBonus 已全部迁移到 taxBonus，通过 effectiveTaxModifier 在征收阶段生效
    const incomePercentBonus = 0; // 保留变量以兼容后续引用，但值恒为0

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
        // 特殊处理银币产出：直接作为所有者收入，不进入国库，不交?
        if (resource === 'silver' && amount > 0) {
            roleWagePayout[ownerKey] = (roleWagePayout[ownerKey] || 0) + amount;
            roleTaxableIncome[ownerKey] = (roleTaxableIncome[ownerKey] || 0) + amount; // 业主银币产出应税
            // 使用 Ledger 记录收入
            ledger.transfer('void', ownerKey, amount, TRANSACTION_CATEGORIES.INCOME.OWNER_REVENUE, TRANSACTION_CATEGORIES.INCOME.OWNER_REVENUE, { buildingId: currentBuildingId });
            if (currentBuildingId && buildingFinancialData[currentBuildingId]) {
                buildingFinancialData[currentBuildingId].ownerRevenue += amount;
            }
            return;
        }
        if (amount <= 0) return;
        res[resource] = (res[resource] || 0) + amount;
        if (isTradableResource(resource)) {
            supply[resource] = (supply[resource] || 0) + amount;
            const marketPrice = getPrice(resource);

            // [NEW] 价格管制检查（出售侧）：政府保底收购或收超额利润税
            // 只有左派主导且启用时才生?
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

            // 记录owner的净销售收?(本地追踪)
            roleWagePayout[ownerKey] = (roleWagePayout[ownerKey] || 0) + netIncome;
            roleTaxableIncome[ownerKey] = (roleTaxableIncome[ownerKey] || 0) + netIncome; // 业主销售收入应税

            // 使用 Ledger 记录收入
            ledger.transfer('void', ownerKey, netIncome, TRANSACTION_CATEGORIES.INCOME.OWNER_REVENUE, TRANSACTION_CATEGORIES.INCOME.OWNER_REVENUE, { buildingId: currentBuildingId });

            if (currentBuildingId && buildingFinancialData[currentBuildingId]) {
                buildingFinancialData[currentBuildingId].ownerRevenue += netIncome;
            }
        }
    };

    perfStart('preProduction');
    const rates = {};
    const builds = { ...buildings };
    let _buildingsModified = false;

    // ========== 战争经济：建筑现已真实销毁，直接使用 builds ==========
    const playerActiveFrontsForDamage = (activeFronts || []).filter(front =>
        front?.status === 'active' && (front.attackerId === 'player' || front.defenderId === 'player')
    );
    // 统计战损（仅用于UI显示，不再用于虚拟扣减）
    const warDamagedBuildings = aggregateWarDamagedBuildings(playerActiveFrontsForDamage, 'player');
    // effectiveBuilds 现在等于 builds（建筑已在战线推进时真实销毁）
    const effectiveBuilds = { ...builds };

    // 战时军工繁荣和贸易中?
    const activeWarCount = playerActiveFrontsForDamage.length;
    const { militaryBoost: warMilitaryBoost, miningBoost: warMiningBoost } = calculateMilitaryIndustryBoost(isPlayerAtWar);
    const { tradeDisruptionPenalty: warTradeDisruption } = calculateWartimeTradeDisruption(activeWarCount);

    let frontlineProductionPenalty = 0;
    let frontlineTaxEfficiencyPenalty = 0; // 方案A：收集税收效率惩?
    if (playerActiveFrontsForDamage.length > 0) {
        const silverIncomeEstimate = Object.values(res || {}).reduce((sum, value) => sum + Number(value || 0), 0) * 0.1;
        playerActiveFrontsForDamage.forEach((front) => {
            const playerSide = front.attackerId === 'player' ? 'attacker' : front.defenderId === 'player' ? 'defender' : null;
            const deployedUnits = playerSide
                ? (front.assignedCorps?.[playerSide] || []).reduce((sum, corpsId) => {
                    const corps = (militaryCorps || []).find((item) => item?.id === corpsId);
                    if (!corps) return sum;
                    return sum + Object.values(corps.units || {}).reduce((unitSum, count) => unitSum + Number(count || 0), 0);
                }, 0)
                : 0;
            const modifiers = getFrontlineEconomicModifiers(front, 'player', tick, deployedUnits, silverIncomeEstimate, res);
            frontlineProductionPenalty += Number(modifiers.productionPenalty || 0);
            frontlineTaxEfficiencyPenalty += Number(modifiers.taxEfficiencyPenalty || 0);
        });
        frontlineProductionPenalty = Math.min(0.80, frontlineProductionPenalty);
        frontlineTaxEfficiencyPenalty = Math.min(0.80, frontlineTaxEfficiencyPenalty);
    }
    const frontlineProductionFactor = Math.max(0, 1 - frontlineProductionPenalty);

    const jobsAvailable = {};
    const roleWageStats = {};
    const roleWagePayout = {};
    const directIncomeApplied = {};
    const roleVacancyTargets = {};
    let totalMaxPop = 5;
    let militaryCapacity = 0; // 新增：军事容?
    totalMaxPop += extraMaxPop;
    totalMaxPop += maxPopBonus;
    const armyPopulationDemand = calculateArmyPopulation(army);
    const armyFoodNeed = calculateArmyFoodNeed(army);

    // 计算当前军队数量（只包括已完成训练的?
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
    // [PERF] 复用模块级对象，避免每 tick 分配新对象
    _clearObj(_reusableRoleLaborIncome);
    const roleLaborIncome = _reusableRoleLaborIncome;
    const roleLivingExpense = {};
    ROLE_PRIORITY.forEach(role => {
        roleLaborIncome[role] = 0;
        roleLivingExpense[role] = 0;
    });

    // [FIX] 应税收入追踪：只包含工资、业主收入、军饷等应税项目，补贴不计入
    // 用于人头税课税基数计算，替代包含补贴的 roleWagePayout
    _clearObj(_reusableRoleTaxableIncome);
    const roleTaxableIncome = _reusableRoleTaxableIncome;
    ROLE_PRIORITY.forEach(role => {
        roleTaxableIncome[role] = 0;
    });

    // Track class expenses (spending on resources)
    _clearObj(_reusableRoleExpense);
    const roleExpense = _reusableRoleExpense;
    Object.keys(STRATA).forEach(key => {
        roleExpense[key] = 0;
    });

    // Track head tax paid separately (not part of living expenses)
    _clearObj(_reusableRoleHeadTaxPaid);
    const roleHeadTaxPaid = _reusableRoleHeadTaxPaid;
    Object.keys(STRATA).forEach(key => {
        roleHeadTaxPaid[key] = 0;
    });

    // Track business tax paid separately (not part of living expenses)
    _clearObj(_reusableRoleBusinessTaxPaid);
    const roleBusinessTaxPaid = _reusableRoleBusinessTaxPaid;
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

                // maxPop / militaryCapacity 是容量属性，不是生产资源
                // 不应受生产加成（理念/科技/时代等）影响
                // maxPop 的百分比加成由专门的 maxPopPercent 在后续统一处理
                // maxPop - 乘以该等级建筑数（纯基础值）
                if (config.output?.maxPop) {
                    totalMaxPop += (config.output.maxPop * lvlCount);
                }

                // militaryCapacity - 乘以该等级建筑数（纯基础值）
                if (config.output?.militaryCapacity) {
                    militaryCapacity += (config.output.militaryCapacity * lvlCount);
                }

                // jobs - 使用升级后的配置，乘以该等级建筑数量
                if (config.jobs) {
                    for (let role in config.jobs) {
                        jobsAvailable[role] = (jobsAvailable[role] || 0) + config.jobs[role] * lvlCount;
                    }
                }
            });
        }
    });
    // console.log('[TICK] Buildings processed. militaryCapacity:', militaryCapacity); // Commented for performance

    // ========== 统一业主系统：修正非阶层业主的建筑岗?==========
    // 使用 buildOwnershipListFromLegacy 从分散数据源构建业主信息
    // 然后根据业主类型调整 jobsAvailable
    // 核心逻辑：只有阶层业?STRATUM)才提供业主岗位，其他类型(官员/外资/国企)不提?

    // 每个建筑的实际岗位需求（考虑外资/官员减少业主岗位?
    perfStart('ownerJobsAdjust');
    const buildingJobsRequired = {};
    // [BUGFIX] 记录每个建筑类型的业主分布，用于按比例分摊工资责任
    // 修复：1 个本国阶层业主被错误地承担了同类型 N 栋建筑（含外资/官员私产/国有）的全部雇员工资
    // 结构：{ buildingId: { stratumCount, officialCount, officialOwners: { officialId: count }, foreignCount, stateCount, stateManagedBy: { officialId: count }, totalCount } }
    const buildingOwnershipMap = {};

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

        // [BUGFIX] 即使没有 owner 也要构建 ownership（虽然此时通常无需分摊）
        const ownershipList = buildOwnershipListFromLegacy(
            building.id,
            buildingCount,
            officials,
            foreignInvestments,
            building
        );

        // [BUGFIX] 汇总业主分布并保存到 map，供后续工资支付分摊使用
        const ownershipSummary = {
            stratumCount: 0,
            officialCount: 0,
            officialOwners: {}, // { officialId: count }
            foreignCount: 0,
            stateCount: 0,
            stateManagedBy: {}, // { officialId: count } 代经营关系
            totalCount: buildingCount,
        };
        let nonStratumCount = 0;
        ownershipList.forEach(ownership => {
            const cnt = ownership.count || 0;
            switch (ownership.ownerType) {
                case OWNER_TYPES.STRATUM:
                    ownershipSummary.stratumCount += cnt;
                    break;
                case OWNER_TYPES.OFFICIAL:
                    ownershipSummary.officialCount += cnt;
                    Object.entries(ownership.details || {}).forEach(([officialId, c]) => {
                        ownershipSummary.officialOwners[officialId] = (ownershipSummary.officialOwners[officialId] || 0) + c;
                    });
                    break;
                case OWNER_TYPES.FOREIGN:
                    ownershipSummary.foreignCount += cnt;
                    break;
                case OWNER_TYPES.STATE:
                    ownershipSummary.stateCount += cnt;
                    Object.entries(ownership.details || {}).forEach(([officialId, c]) => {
                        ownershipSummary.stateManagedBy[officialId] = (ownershipSummary.stateManagedBy[officialId] || 0) + c;
                    });
                    break;
                default:
                    break;
            }
            if (!providesOwnerJobs(ownership.ownerType)) {
                nonStratumCount += cnt;
            }
        });
        buildingOwnershipMap[building.id] = ownershipSummary;

        const ownerRole = building.owner;
        if (!ownerRole || ownerSlotsTotal <= 0) return;

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

    // Calculate available resources: resources backed by already built output buildings
    perfStart('availableResources');
    const availableResources = (() => {
        const cacheKey = Object.entries(buildings || {})
            .filter(([, count]) => Number(count) > 0)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([buildingId, count]) => `${buildingId}:${count}`)
            .join('|');

        if (cachedAvailableResourcesKey === cacheKey && cachedAvailableResourcesSet) {
            return cachedAvailableResourcesSet;
        }

        const set = getAvailableResourceSet(buildings);
        cachedAvailableResourcesKey = cacheKey;
        cachedAvailableResourcesSet = set;
        return set;
    })();
    perfEnd('availableResources');

    if (maxPopPercent !== 0) {
        const multiplier = Math.max(0, 1 + maxPopPercent);
        totalMaxPop = Math.max(0, totalMaxPop * multiplier);
    }
    totalMaxPop = Math.floor(totalMaxPop);

    // 军人岗位包括：已有军?+ 等待人员的岗?+ 训练中的岗位
    // 计算已有军队的人口需?（包含散兵 army 和军团 militaryCorps 内的所有单位）
    let currentArmyPopNeeded = 0;
    // 合并散兵和军团内单位，与军饷计算保持一致
    const allUnitsForJobCalc = { ...(army || {}) };
    if (Array.isArray(militaryCorps)) {
        for (const corps of militaryCorps) {
            if (corps?.isAI) continue; // 跳过AI军团
            for (const [unitId, count] of Object.entries(corps?.units || {})) {
                if (count > 0) {
                    allUnitsForJobCalc[unitId] = (allUnitsForJobCalc[unitId] || 0) + count;
                }
            }
        }
    }
    Object.entries(allUnitsForJobCalc).forEach(([unitId, count]) => {
        if (!count || count <= 0) return;
        const unit = UNIT_TYPES[unitId];
        const popCost = unit?.populationCost || 1;
        currentArmyPopNeeded += count * popCost;
    });

    // 计算队列中的人口需求 [FIX] 必须乘以batch.count，否则岗位需求严重低估
    const queuePopNeeded = (militaryQueue || []).reduce((sum, item) => {
        if (item.status === 'waiting' || item.status === 'training') {
            const unit = UNIT_TYPES[item.unitId];
            const popCost = unit?.populationCost || 1;
            const cnt = item.count || 1;
            return sum + popCost * cnt;
        }
        return sum;
    }, 0);

    // 总岗位需?= 现有军队人口 + 队列所需人口
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
        // 首次运行：按岗位需求进行一次性初始分?
        // 这能确保例如军队/训练队列产生?`soldier` 岗位在开局就能拿到?
        let remainingPop = population;
        ROLE_PRIORITY.forEach(role => {
            const slots = Math.max(0, jobsAvailable[role] || 0);
            const filled = Math.min(remainingPop, slots);
            popStructure[role] = filled;
            remainingPop -= filled;
        });
        popStructure.unemployed = Math.max(0, remainingPop);
    } else {
        // 继承上一帧状?
        ROLE_PRIORITY.forEach(role => {
            const prevCount = (previousPopStructure[role] || 0);
            popStructure[role] = Math.max(0, prevCount);
        });
        popStructure.unemployed = Math.max(0, (previousPopStructure.unemployed || 0));

        // 处理人口变化（增长或减少?
        const assignedPop = ROLE_PRIORITY.reduce((sum, role) => sum + (popStructure[role] || 0), 0) + (popStructure.unemployed || 0);
        diff = population - assignedPop;

        if (diff > 0) {
            // 人口增长：新人加入失业?
            popStructure.unemployed = (popStructure.unemployed || 0) + diff;
        } else if (diff < 0) {
            // 人口减少：仅从失业者中扣除，不自动从各职业扣除（防止人口被吸走?
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
                    // [FIX] 自营粮食/布料生产者部分豁免：
                    // 构建"受保护角色"集合——产出关键资源（food/cloth）的自营建筑的业主角色
                    const CRITICAL_SURVIVAL_RESOURCES = ['food', 'cloth'];
                    const protectedRoles = new Set();
                    BUILDINGS.forEach(building => {
                        const count = buildings[building.id] || 0;
                        if (count <= 0 || !building.owner || !building.output) return;
                        // 自营建筑（owner 也在 jobs 中）
                        if (!building.jobs || !building.jobs[building.owner]) return;
                        const producesEssential = Object.keys(building.output).some(
                            res => CRITICAL_SURVIVAL_RESOURCES.includes(res)
                        );
                        if (producesEssential) {
                            protectedRoles.add(building.owner);
                        }
                    });

                    const baseReduction = reductionNeeded;
                    // 第一轮：按比例裁减，受保护角色减半
                    ROLE_PRIORITY.forEach((role, index) => {
                        if (reductionNeeded <= 0) return;
                        const current = popStructure[role] || 0;
                        if (current <= 0) return;
                        const proportion = current / initialTotal;
                        let remove = Math.floor(proportion * baseReduction);
                        if (remove <= 0 && reductionNeeded > 0) remove = 1;
                        // 受保护角色裁员量减半（50% 豁免）
                        if (protectedRoles.has(role)) {
                            remove = Math.max(1, Math.floor(remove * 0.5));
                        }
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
    // 注意：official 阶层不参与自由流动，人数由雇佣的官员数决?
    ROLE_PRIORITY.forEach(role => {
        if (role === 'official') return; // 官员不参与普通裁员逻辑

        const current = popStructure[role] || 0;
        const slots = Math.max(0, jobsAvailable[role] || 0);
        if (current > slots) {
            const layoffs = current - slots;
            const roleWealth = wealth[role] || 0;
            const perCapWealth = current > 0 ? roleWealth / current : 0;

            // 裁员：人口移至失业，并携带财?
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
    // 官员人数 = min(建筑提供的岗? 雇佣的官员数)
    const officialJobs = jobsAvailable.official || 0;
    const hiredOfficialCount = Array.isArray(officials) ? officials.length : 0;
    const actualOfficialCount = hiredOfficialCount; // Allow all hired officials to be counted, even if exceeding jobs
    popStructure.official = actualOfficialCount;
    // 官员财富由每位官员独立持有，不计?wealth.official（清零以避免重复?
    wealth.official = 0;

    let taxModifier = 1.0;

    // 执政联盟合法性计算（初步，待影响力计算后会精确计算）
    // 此处使用上一tick的数据估算，避免循环依赖
    let coalitionLegitimacy = 0;
    // 使用上一tick的合法性计算税收修正（避免循环依赖?
    let legitimacyTaxModifier = getLegitimacyTaxModifier(previousLegitimacy);

    // 税收征收效率：基础效率 = taxModifier × legitimacyTaxModifier（范围 [0.3, 1.0]）
    // taxBonus/ideoTaxModifier 用于恢复效率损耗（如官员加成减少腐败），而非凭空增加税收
    // 公式：effectiveTaxModifier = base + (1 - base) × bonusRecovery，结果永远 ≤ 1.0
    const baseTaxEfficiency = taxModifier * legitimacyTaxModifier; // [0.3, 1.0]
    const bonusRecovery = Math.max(0, Math.min(1, (bonuses.taxBonus || 0) + (bonuses.ideoTaxModifier || 0)));
    const effectiveTaxModifier = Math.min(1.0,
        baseTaxEfficiency + (1 - baseTaxEfficiency) * bonusRecovery
    );

    // [FIX] 提前定义空岗位收入预估函数，用于 fillVacancies 时的智能工资判断
    // 逻辑?simulation 尾部?estimateVacantRoleIncome 类似，但只能使用上一 tick 的数?(market.wages)
    const estimatePotentialIncomeForVacancy = (role) => {
        const VACANT_BONUS = 1.2;

        // [FIX] 计算税收效率，用于补贴计?
        // 注意：此?efficiency 尚未计算，使?currentStability 估算
        const estimatedStabilityFactor = Math.min(1.5, Math.max(0.5, 1 + (currentStability - 50) / 100));
        const estimatedEfficiency = estimatedStabilityFactor;
        const rawEfficiency = estimatedEfficiency * (1 + (bonuses.taxEfficiencyBonus || 0) - (bonuses.corruption || 0));
        const effectiveEfficiency = Math.max(0, Math.min(1, rawEfficiency));

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
                // 业主预估：产?- 成本 - 雇员工资 - ?
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
                    // 使用上一 tick 的工资作为参?
                    const avgPaidWage = market?.wages?.[jobRole] ?? getExpectedWage(jobRole);
                    wageCost += avgPaidWage * slots;
                });

                const ownerWage = previousWages[role];
                const ownerHeadRate = getHeadTaxRate(role);
                let headTaxCost;
                if (ownerHeadRate > 0) {
                    const ownerIncomeBase = (Number.isFinite(ownerWage) && ownerWage > 0)
                        ? ownerWage * (TAX_BASE_RATES?.HEAD_TAX_INCOME_RATIO || 1.0) : 0;
                    headTaxCost = ownerIncomeBase * ownerHeadRate * effectiveTaxModifier;
                } else if (ownerHeadRate < 0) {
                    headTaxCost = ownerHeadRate * effectiveTaxModifier;
                } else {
                    headTaxCost = 0;
                }
                const businessTaxRate = getBusinessTaxRateFromModule(building.id, policies?.businessTaxRates || {});
                const businessTaxCost = businessTaxRate < 0
                    ? businessTaxRate
                    : Math.max(0, outputValue) * businessTaxRate;
                const effectiveBusinessTaxCost = businessTaxCost < 0
                    ? businessTaxCost * effectiveEfficiency
                    : businessTaxCost;

                const netProfit = outputValue - inputCost - wageCost - headTaxCost - effectiveBusinessTaxCost;
                const profitPerOwner = roleSlots > 0 ? netProfit / roleSlots : 0;

                ownerIncome += profitPerOwner * roleSlots * count;
                ownerSlots += roleSlots * count;
            } else {
                // 雇员预估：使用上一 tick 市场工资，如果为 0 则尝试从 building 属性推导
                // [FIX] 冷启动修复：当历史工资极低时，基于建筑利润反推合理工资预期
                // 计算建筑的潜在利润来推测雇员应得的合理工资预期
                const avgPaidWage = market?.wages?.[role] ?? getExpectedWage(role);

                // 计算建筑利润以推断合理的雇员工资（解决新行业冷启动问题）
                let estimatedWage = avgPaidWage;
                const baseExpected = getExpectedWage(role);

                // 【需求 2.1 / 2.5】业务税补贴 → 雇员吸引力传导
                // 当所属建筑 businessTaxRate < 0（享受业务税补贴）时，
                // 将到账补贴金额按"利润分润 40%"加入雇员合理工资预估，
                // 与 taxes.js / 业主分支口径一致（不放大、不绕过 effectiveTaxModifier）。
                const buildingBusinessTaxRate = getBusinessTaxRateFromModule(building.id, policies?.businessTaxRates || {});
                let businessTaxSubsidyAmount = 0;
                if (Number.isFinite(buildingBusinessTaxRate) && buildingBusinessTaxRate < 0) {
                    businessTaxSubsidyAmount = Math.abs(buildingBusinessTaxRate) * effectiveEfficiency;
                }

                // 触发条件：(a) 历史工资明显偏低（冷启动） OR (b) 该建筑享受业务税补贴
                const shouldEstimateFromProfit = (avgPaidWage < baseExpected * 0.5) || businessTaxSubsidyAmount > 0;
                if (shouldEstimateFromProfit) {
                    let buildingOutputValue = 0;
                    if (config.output) {
                        Object.entries(config.output).forEach(([resource, amount]) => {
                            if (!RESOURCES[resource]) return;
                            const price = priceMap[resource] || getBasePrice(resource);
                            buildingOutputValue += amount * price;
                        });
                    }
                    let buildingInputCost = 0;
                    if (config.input) {
                        Object.entries(config.input).forEach(([resource, amount]) => {
                            const price = priceMap[resource] || getBasePrice(resource);
                            buildingInputCost += amount * price;
                        });
                    }
                    // 把业务税补贴金额并入建筑利润口径，使补贴像额外利润一样
                    // 通过"利润分润 0.4"路径抬升雇员的合理工资预期
                    const buildingProfit = buildingOutputValue - buildingInputCost + businessTaxSubsidyAmount;

                    // 如果建筑有利润（含补贴），将 40% 分配给所有雇员作为合理工资预期
                    if (buildingProfit > 0) {
                        const totalEmployeeSlots = Object.entries(jobs)
                            .filter(([r]) => r !== building.owner)
                            .reduce((sum, [, s]) => sum + (s || 0), 0);
                        if (totalEmployeeSlots > 0) {
                            const profitSharePerSlot = (buildingProfit * 0.4) / totalEmployeeSlots;
                            estimatedWage = Math.max(avgPaidWage, profitSharePerSlot, baseExpected);
                        }
                    }
                }

                employeeWage += estimatedWage * roleSlots * count;
                employeeSlots += roleSlots * count;
            }
        });

        const totalSlots = ownerSlots + employeeSlots;
        if (totalSlots <= 0) return getExpectedWage(role);

        // 如果是纯雇员岗位且历史工资极低，尝试根据行业利润反推?
        // 目前暂不搞太复杂，先仅对"有产出但没工?的情况做兜底
        // 但对?worker 这种纯雇员，如果 market.wages ?0，这里算出来还是 0
        // 需要一个机制让"空的高利润工?广播高工?
        // ?building production loop 中我们有 wagePressure，但这里还是 start of tick

        // 改进：如果是雇员，且计算出的 employeeWage 很低，但所在的工厂很赚?..
        // 这太复杂了。目前先复用原有逻辑，依?VACANT_BONUS 提升吸引?
        const totalIncome = ownerIncome + employeeWage;
        const averageIncome = totalIncome / totalSlots;
        const baseEstimate = Math.max(getExpectedWage(role), averageIncome * VACANT_BONUS);

        // 【需求 1.4 / 2.3】人头税补贴预估注入：
        // 当该角色 headRate < 0（享受人头税补贴）时，将人均到账补贴金额追加进入预估收入，
        // 使从未有人涉足的岗位（pop === 0 路径主要消费者）也能因补贴变得有吸引力。
        // 与 taxes.js collectHeadTax 的负 headRate 分支口径一致：due = count * headRate * effectiveTaxModifier，
        // 因此人均补贴 = |headRate| * effectiveTaxModifier。
        const roleHeadRate = getHeadTaxRate(role);
        let headSubsidyPerCapita = 0;
        if (Number.isFinite(roleHeadRate) && roleHeadRate < 0) {
            headSubsidyPerCapita = Math.abs(roleHeadRate) * effectiveTaxModifier;
        }

        return baseEstimate + headSubsidyPerCapita;
    };

    // [FIX] 智能工资获取：当岗位人数少时，用预估潜力代替历史工资吸引人
    // 生存资源严重短缺时，该资源生产者也使用实时预估（即使人口已多）
    const criticalProducerRoles = new Set();
    for (const resKey of CRITICAL_RESOURCES) {
        const stock = res[resKey] || 0;
        if (stock < population * 0.5) {
            const producer = RESOURCES[resKey]?.defaultOwner;
            if (producer) criticalProducerRoles.add(producer);
        }
    }

    const getSmartExpectedWage = (role) => {
        const currentPop = popStructure[role] || 0;
        // 完全空缺（人口为0）时始终使用潜力预估，确保新建建筑岗位能吸引失业者
        if (currentPop === 0) {
            const potential = estimatePotentialIncomeForVacancy(role);
            const standard = getExpectedWage(role);
            // 取两者较大值，且至少返回一个正值保底
            return Math.max(potential, standard, 0.01);
        }
        if (currentPop <= LOW_POP_THRESHOLD || criticalProducerRoles.has(role)) {
            const potential = estimatePotentialIncomeForVacancy(role);
            const standard = getExpectedWage(role);
            return Math.max(potential, standard);
        }
        return getExpectedWage(role);
    };

    // 自动填补（招工）：使?job.js 中的 fillVacancies 函数，支持阶层流?
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
    // 这里 fillVacancies 返回的 { popStructure, wealth }，我们将其解构回来确保引用正确
    // (虽然 simulation.js 的 popStructure 和 wealth 是局部变量，可以直接修改)
    // 保持代码清晰性
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
    // 允许负的 needsReduction (即增加需?，下限设?-2 (需求翻3?，上?0.95
    const effectiveNeedsReduction = Math.max(-2, Math.min(0.95, needsReduction || 0));
    const needsRequirementMultiplier = 1 - effectiveNeedsReduction;

    // classApproval 初始化（与 headTax 无关，保持在 preProduction 阶段）
    Object.keys(STRATA).forEach(key => {
        if (key === 'official') return;
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
        // 使用有效建筑数（扣除战争损毁后）用于产出计算
        const count = effectiveBuilds[b.id] || 0;
        if (count === 0) return;

        // --- 计算升级加成后的基础数?---
        const { fullLevelCounts: levelCounts, level0Count, hasUpgrades } = getBuildingLevelDistribution(
            tick,
            b.id,
            buildingUpgrades,
            count
        );
        // [PERF] 复用模块级对象，避免每栋建筑每tick分配新对象
        _clearObj(_reusableEffectiveOps.input);
        _clearObj(_reusableEffectiveOps.output);
        _clearObj(_reusableEffectiveOps.jobs);
        const effectiveOps = _reusableEffectiveOps;

        // === 构建 owner 分组映射 ===
        // 每个 owner 可能拥有不同等级的建筑，记录 { ownerKey: { levels: { lvl: count }, totalCount: N } }
        // [PERF] 复用模块级对象
        _clearObj(_reusableOwnerLevelGroups);
        const ownerLevelGroups = _reusableOwnerLevelGroups;
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

        // 初始化所有涉及的 owner 的财?
        Object.keys(ownerLevelGroups).forEach(ownerKey => {
            if (wealth[ownerKey] === undefined) {
                wealth[ownerKey] = STRATA[ownerKey]?.startingWealth || 0;
            }
        });

        // 获取主要 owner（用于向后兼容现有逻辑中的部分判断?
        const primaryOwnerKey = b.owner || 'state';

        let multiplier = 1.0;

        if (!hasUpgrades && level0Count === count) {
            // 无升级快速路?
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
        // 收集所有加成百分比，最后统一计算 multiplier = 1 + 所有加成之?
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

        // 2. 全局生产/工业 modifier（来?buff/debuff?
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

        // 2.5 战时产出加成（仅在战争中生效?
        if (isPlayerAtWar && bonuses.wartimeProduction) {
            bonusSum += bonuses.wartimeProduction;
        }

        // 2.6 战争经济：军工繁荣加成（军事?20%，采矿类+10%?
        if (isPlayerAtWar) {
            if (b.cat === 'military' && warMilitaryBoost > 0) {
                bonusSum += warMilitaryBoost;
            }
            // 采矿类建筑（gather中产出iron/copper/coal/stone的建筑）
            if (b.cat === 'gather' && warMiningBoost > 0) {
                const miningOutputs = ['iron', 'copper', 'coal', 'stone'];
                const isMiningBuilding = b.output && Object.keys(b.output).some(k => miningOutputs.includes(k));
                if (isMiningBuilding) {
                    bonusSum += warMiningBoost;
                }
            }
        }

        // 3. 类别加成（categoryBonuses 现在直接存储加成百分比，?0.25 = +25%?
        const categoryBonus = categoryBonuses[b.cat];
        if (categoryBonus && categoryBonus !== 0) {
            bonusSum += categoryBonus;
        }

        // 4. 事件加成
        const buildingSpecificMod = eventBuildingProductionModifiers[b.id] || 0;
        const buildingCategoryMod = eventBuildingProductionModifiers[b.cat] || 0;
        const buildingAllMod = eventBuildingProductionModifiers['all'] || 0;
        bonusSum += buildingSpecificMod + buildingCategoryMod + buildingAllMod;

        // 5. 建筑特定科技加成（buildingBonuses 现在直接存储加成百分比，?0.25 = +25%?
        const buildingBonus = buildingBonuses[b.id];
        if (buildingBonus && buildingBonus !== 0) {
            bonusSum += buildingBonus;
        }

        // 6. V2: 理念阶层产出加成（stratum_output_mod）
        // 按建筑 owner 阶层匹配，提升该阶层拥有建筑的产出
        if (bonuses.ideoStratumOutputMod) {
            const ownerMod = bonuses.ideoStratumOutputMod[primaryOwnerKey] || 0;
            const globalMod = bonuses.ideoStratumOutputMod._global || 0;
            if (ownerMod + globalMod !== 0) bonusSum += ownerMod + globalMod;
        }

        // 应用加成：基础乘数 × (1 + 总加?
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
                marginDetail: null,
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

            // [CRITICAL FIX] 使用瓶颈法则计算到岗?
            // 生产受限于最低的非业主角色填充率（工人是生产的瓶颈）
            // 业主可以管理但不能替代工人生?
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
                    // V2: 理念工资修正（wages_mod，按阶层 scope）
                    const ideoWageMod = (bonuses.ideoWagesMod?.[role] || 0) + (bonuses.ideoWagesMod?._global || 0);
                    const finalWage = ideoWageMod !== 0 ? Math.max(livingFloor, adjustedWage * (1 + ideoWageMod)) : adjustedWage;
                    roleExpectedWages[role] = finalWage;
                    expectedWageBillBase += roleFilled * finalWage;
                    wagePlans.push({
                        role,
                        ownerKey: b.owner || 'state',
                        roleSlots: roleRequired,
                        filled: roleFilled,
                        baseWage: finalWage,
                    });
                }
            }

            // [CRITICAL FIX] 到岗率计算使用瓶颈法则：
            // - 如果有非业主角色（工人），使用最低工人填充率作为生产上限
            // - 如果只有业主角色（如农场只有peasant），使用平均填充?
            if (hasNonOwnerRole) {
                // 有工人角色时，生产受最低工人填充率限制
                staffingRatio = minNonOwnerFillRate === Infinity ? 0 : minNonOwnerFillRate;
            } else if (totalSlots > 0) {
                // 只有业主角色时（自营建筑），使用普通平?
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

        // [OWNER-CAP] 业主填坑上限：owner 数量不足时，等比压缩有效建筑数
        // 核心语义：每 X 个 owner 岗位对应 1 栋建筑，到岗 owner 不足则多余建筑停工
        // 国有建筑（state）豁免此约束
        let ownerFillCapMultiplier = 1;
        if (Object.keys(ownerLevelGroups).length > 0) {
            let minOwnerFillRate = Infinity;
            let hasPrivateOwner = false;
            for (const oKey of Object.keys(ownerLevelGroups)) {
                if (oKey === 'state') continue; // 国有建筑不受 owner 填坑约束
                hasPrivateOwner = true;
                const totalOwnerSlotsForKey = jobsAvailable[oKey] || 0; // 该 owner 角色的全局总岗位需求
                const ownerPopForKey = popStructure[oKey] || 0; // 该 owner 角色的实际人口
                const ownerFillRate = totalOwnerSlotsForKey > 0
                    ? Math.min(1, ownerPopForKey / totalOwnerSlotsForKey)
                    : (ownerPopForKey > 0 ? 1 : 0); // 无岗位需求但有人口视为满员
                minOwnerFillRate = Math.min(minOwnerFillRate, ownerFillRate);
            }
            if (hasPrivateOwner && minOwnerFillRate < Infinity) {
                ownerFillCapMultiplier = minOwnerFillRate;
            }
        }

        // Capture multiplier BEFORE staffing application for potential calculation
        const potentialMultiplierBeforeStaffing = multiplier;

        multiplier *= staffingRatio;
        // [OWNER-CAP] 应用业主填坑上限（在 staffingRatio 之后叠加）
        multiplier *= ownerFillCapMultiplier;

        if (forcedLabor && (b.jobs?.serf || b.jobs?.miner)) {
            multiplier *= 1.2;
        }

        const baseMultiplier = multiplier;
        // simBaseMultiplier: What production WOULD be if fully staffed (for stats/estimation)
        const simBaseMultiplier = baseMultiplier > 0 ? baseMultiplier : potentialMultiplierBeforeStaffing;

        let resourceLimit = 1;
        let resourceLimitingKey = null; // 记录导致 resourceLimit 下降的具体资源
        let inputCostPerMultiplier = 0;
        let isInLowEfficiencyMode = false;

        // === 应用生产成本修正（官员效?+ 政治立场效果?===
        // 只对?input 且有 output 的建筑生效（加工类建筑）
        const hasInput = Object.keys(effectiveOps.input).length > 0;
        const hasOutput = Object.keys(effectiveOps.output).some(k => k !== 'maxPop' && k !== 'militaryCapacity');
        if (hasInput && hasOutput) {
            // 合并官员效果和政治立场效?
            const officialInputCostMod = bonuses.officialProductionInputCost?.[b.id] || 0;
            const stanceInputCostMod = bonuses.stanceProductionInputCost?.[b.id] || 0;
            // V2: 理念建筑消耗修正（按建筑分类 scope）
            const ideoInputCostMod = (bonuses.ideoBuildingInputMod?.[b.cat] || 0) + (bonuses.ideoBuildingInputMod?._global || 0);
            const totalInputCostMod = officialInputCostMod + stanceInputCostMod + ideoInputCostMod;

            // 应用修正：正值增加消耗，负值减少消?
            if (totalInputCostMod !== 0) {
                const inputModMultiplier = 1 + totalInputCostMod;
                // 确保修正后的消耗不低于原始?20%
                const safeMultiplier = Math.max(0.2, inputModMultiplier);
                for (const [resKey, amount] of Object.entries(effectiveOps.input)) {
                    effectiveOps.input[resKey] = amount * safeMultiplier;
                }
            }

            // 资源浪费：对投入资源增加额外消?
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
                    resourceLimitingKey = resKey;
                } else {
                    const ratio = available / requiredAtBase;
                    if (ratio < resourceLimit) {
                        resourceLimit = ratio;
                        resourceLimitingKey = resKey;
                    }
                }
                if (isTradableResource(resKey)) {
                    const price = getPrice(resKey);
                    const taxRate = getResourceTaxRate(resKey); // Allow negative
                    inputCostPerMultiplier += perMultiplierAmount * price * (1 + taxRate);
                }
            }
        }

        // 防死锁机制：采集类建筑在缺少输入原料时进入低效模?
        let targetMultiplier = baseMultiplier * Math.max(0, Math.min(1, resourceLimit)) * frontlineProductionFactor;
        // Potential target multiplier (if staffed)
        let simTargetMultiplier = simBaseMultiplier * Math.max(0, Math.min(1, resourceLimit)) * frontlineProductionFactor;

        if (b.cat === 'gather' && resourceLimit === 0 && Object.keys(effectiveOps.input).length > 0) {
            // 进入低效模式?0%效率，不消耗原?
            targetMultiplier = baseMultiplier * 0.2;
            simTargetMultiplier = simBaseMultiplier * 0.2;
            isInLowEfficiencyMode = true;
            inputCostPerMultiplier = 0; // 低效模式下不消耗原料，因此成本为0

            // 添加日志提示（每个建筑类型只提示一次，避免刷屏）
            const inputNames = Object.keys(effectiveOps.input).map(k => RESOURCES[k]?.name || k).join(', ');
            if (tick % 30 === 0) { // 每30个tick提示一次
                recordAggregatedLog(`⚠️ ${b.name} 缺少 ${inputNames}，工人正在徒手作业（效率20%）`);
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
                // 之前的逻辑错误地认为生产者获得补贴，或承担税?
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

        // 营业税（按实际营收比例征收）
        const isHousingBuilding = b.cat === 'civic' && !b.owner && b.output?.maxPop > 0;
        const isMilitaryBuilding = b.cat === 'military';
        const businessTaxMultiplier = (isHousingBuilding || isMilitaryBuilding) ? 0 : getBusinessTaxRate(b.id);
        let estimatedBusinessTax;
        if (businessTaxMultiplier >= 0) {
            estimatedBusinessTax = Math.max(0, estimatedRevenue) * businessTaxMultiplier;
        } else {
            estimatedBusinessTax = businessTaxMultiplier * count;
        }

        const totalOperatingCostPerMultiplier = inputCostPerMultiplier + wageCostPerMultiplier;
        // Actual multiplier tracks real production (0 if empty)
        let actualMultiplier = targetMultiplier;
        // Sim multiplier tracks potential production (full capacity)
        let simActualMultiplier = simTargetMultiplier;

        let debugMarginRatio = null;
        let debugData = null;
        let _localAffordableMultiplier = undefined;

        // BUG FIX: 实际可支付的工资不能超过 (收入 - 原料成本)
        // 如果市场工资过高，建筑只会支付它能支付的部分，而不是削减产?
        // 这避免了工资通胀导致的产量崩?
        const actualPayableWageCost = Math.min(estimatedWageCost, valueAvailableForLabor);
        // 计算实际每单位乘数的工资成本（用于affordableMultiplier计算?
        const actualWageCostPerMultiplier = targetMultiplier > 0 ? actualPayableWageCost / targetMultiplier : 0;
        // 实际运营成本 = 原料成本 + 实际可支付工资成?
        const actualOperatingCostPerMultiplier = inputCostPerMultiplier + actualWageCostPerMultiplier;

        if (producesTradableOutput) {

            // [FIX] 使用边际成本分析而非总成本分?
            // 工资是固定成本（已经承诺支付），不应影响产量决策
            // 只有可变成本（原?税费）应该影响产量决?
            // 
            // 经济学原理：
            // - 如果边际收益（产?- 原料 - 税费? 0，应该生?
            // - 即使总成本（含工资）> 总收入，只要边际收益 > 0，生产可以减少亏?
            // - 只有当边际收?< 0 时，才应该停?

            // 可变成本 = 原料成本（营业税是利润分配，不影响生产决策）
            const variableCost = estimatedInputCost;
            // 补贴视为保底收入：政府给钱让你生产，不受市场价格影响
            const subsidyIncome = estimatedBusinessTax < 0 ? Math.abs(estimatedBusinessTax) : 0;
            // 有效收益 = 产出市场价值 + 补贴收入 - 可变成本
            const marginalRevenue = estimatedRevenue + subsidyIncome - variableCost;

            // 总成本（用于调试和UI显示）
            const estimatedCost = estimatedInputCost + actualPayableWageCost + estimatedBusinessTax;

            if (estimatedRevenue <= 0 && subsidyIncome <= 0) {
                // 产出没有价值且无补贴，停产
                actualMultiplier = 0;
                debugMarginRatio = 0;
            } else if (marginalRevenue < 0) {
                // 有效收益为负（即使算上补贴仍亏损），停产
                actualMultiplier = 0;
                debugMarginRatio = 0;
            } else if (marginalRevenue < actualPayableWageCost * 0.5) {
                // 有效收益太低，无法覆盖一半的工资成本，按比例减产
                const marginRatio = Math.max(0, Math.min(1, marginalRevenue / actualPayableWageCost));
                debugMarginRatio = marginRatio;
                actualMultiplier = targetMultiplier * marginRatio;
                simActualMultiplier = simTargetMultiplier * marginRatio;
            } else {
                // 有效收益为正且足够，满负荷生产
                debugMarginRatio = estimatedCost > 0 ? estimatedRevenue / estimatedCost : null;
            }
            if (_simDebugEnabled) {
                debugData = {
                    baseMultiplier,
                    resourceLimit,
                    targetMultiplier,
                    estimatedRevenue,
                    estimatedInputCost,
                    estimatedWageCost,
                    actualPayableWageCost,
                    actualWageCostPerMultiplier,
                    actualOperatingCostPerMultiplier,
                    estimatedBusinessTax,
                    estimatedCost,
                    marginRatio: debugMarginRatio,
                    actualMultiplierAfterMargin: actualMultiplier,
                    outputValuePerMultiplier,
                    inputCostPerMultiplier,
                    wageCostPerMultiplier,
                    count,
                    expectedWageBillBase,
                    baseWageCostPerMultiplier,
                    wagePressure,
                    baseWageCost,
                    wageCoverage,
                    valueAvailableForLabor,
                    wagePlans,
                };
            }

            if (debugMarginRatio !== null && debugMarginRatio < 1) {
                buildingFinancialData[b.id].marginDetail = {
                    estimatedRevenue,
                    estimatedInputCost,
                    estimatedWageCost: actualPayableWageCost,
                    estimatedBusinessTax,
                    estimatedCost,
                    marginalRevenue,
                    projectedLossPerBuilding: count > 0 ? (estimatedRevenue - estimatedCost) / count : 0,
                };
            }
        }
        if (actualOperatingCostPerMultiplier > 0) {
            // 检查所?owner 的财富是否足够支付运营成?
            // BUG FIX: 使用实际可支付的运营成本，而不是基于市场工资的成本
            let minAffordableMultiplier = Infinity;
            const ownerDetails = debugData ? [] : null;
            Object.entries(ownerLevelGroups).forEach(([oKey, group]) => {
                const ownerProportion = group.totalCount / count;
                const ownerOperatingCost = actualOperatingCostPerMultiplier * ownerProportion;
                const ownerCash = wealth[oKey] || 0;
                const ownerAffordable = ownerOperatingCost > 0 ? ownerCash / ownerOperatingCost : Infinity;
                minAffordableMultiplier = Math.min(minAffordableMultiplier, ownerAffordable);
                if (ownerDetails) ownerDetails.push({ owner: oKey, proportion: ownerProportion, operatingCost: ownerOperatingCost, cash: ownerCash, affordable: ownerAffordable });
            });
            const affordableMultiplier = minAffordableMultiplier === Infinity ? targetMultiplier : minAffordableMultiplier;
            const simAffordableMultiplier = minAffordableMultiplier === Infinity ? simTargetMultiplier : minAffordableMultiplier;

            actualMultiplier = Math.min(actualMultiplier, Math.max(0, affordableMultiplier));
            simActualMultiplier = Math.min(simActualMultiplier, Math.max(0, simAffordableMultiplier));
            _localAffordableMultiplier = affordableMultiplier;
            if (debugData) {
                debugData.totalOperatingCostPerMultiplier = totalOperatingCostPerMultiplier;
                debugData.minAffordableMultiplier = minAffordableMultiplier;
                debugData.affordableMultiplier = affordableMultiplier;
                debugData.actualMultiplierAfterAffordable = actualMultiplier;
                debugData.ownerDetails = ownerDetails;
            }
        }
        if (debugData && buildingDebugData) {
            buildingDebugData[b.id] = debugData;
        }

        if (!Number.isFinite(actualMultiplier) || actualMultiplier < 0) {
            actualMultiplier = 0;
        }

        const zeroApprovalFactor = 0.3;
        let approvalMultiplier = 1;
        // 检查所?owner 的满意度
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
            const shortageResName = resourceLimitingKey
                ? (RESOURCES[resourceLimitingKey]?.name || resourceLimitingKey)
                : (effectiveOps.input?.electricity ? '电力' : '原料');
            const shortageLabel = shortageResName + '不足';
            reductionReasons.push({ type: 'resource', label: shortageLabel, factor: resourceLimit });
        }
        if (debugMarginRatio !== null && debugMarginRatio < 1) {
            reductionReasons.push({ type: 'margin', label: '利润不足', factor: debugMarginRatio });
        }
        if (_localAffordableMultiplier !== undefined && _localAffordableMultiplier < targetMultiplier) {
            reductionReasons.push({ type: 'cashflow', label: '现金流不足', factor: _localAffordableMultiplier / targetMultiplier });
        }
        if (approvalMultiplier < 1) {
            reductionReasons.push({ type: 'approval', label: '满意度不足', factor: approvalMultiplier });
        }
        buildingFinancialData[b.id].reductionReasons = reductionReasons;

        let plannedWageBill = 0;

        // 低效模式下不消耗输入原料（徒手采集?
        if (Object.keys(effectiveOps.input).length > 0 && !isInLowEfficiencyMode) {
            // === 按等级精确计算每个等级的资源需?===
            // 构建 levelInputNeeds: { lvl: { resKey: amount } }
            const levelInputNeeds = {};
            Object.entries(levelCounts).forEach(([lvlStr, lvlCount]) => {
                if (lvlCount <= 0) return;
                const lvl = parseInt(lvlStr);
                const config = getBuildingEffectiveConfig(b, lvl);
                if (!config.input || Object.keys(config.input).length === 0) return;
                levelInputNeeds[lvl] = {};
                Object.entries(config.input).forEach(([resKey, perBuildingAmount]) => {
                    // 该等级的总需?= 单建筑需?× 建筑数量 × 实际效率
                    levelInputNeeds[lvl][resKey] = perBuildingAmount * lvlCount * actualMultiplier;
                });
            });

            // 遍历每个资源，按等级比例分配实际消费?
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

                    // === 按等级精确分配成?===
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

        // === 按等级分别计算工资压力因?===
        // 每个等级可能有不同的产出价值，因此 wagePressure 应该不同
        const levelWagePressures = {};
        Object.entries(levelCounts).forEach(([lvlStr, lvlCount]) => {
            const lvl = parseInt(lvlStr);
            const config = getBuildingEffectiveConfig(b, lvl);

            // 计算该等级的产出价?
            let levelOutputValue = 0;
            if (config.output) {
                Object.entries(config.output).forEach(([resKey, amount]) => {
                    if (resKey === 'maxPop') return;
                    if (!isTradableResource(resKey)) return;
                    const perBuildingAmount = amount;
                    const grossValue = perBuildingAmount * getPrice(resKey);
                    // 修正：生产者只获得商品的基础市场价?
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

            // 计算该等级的工资成本（使用基础工资估算?
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

        // 计算整体加权平均?wagePressure（用于向后兼容）
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
        const buildingWageLivingCosts = buildLivingCostMap(livingCostBreakdown, buildingWageConfig);
        const getBuildingLivingCostFloor = (role) => {
            const base = buildingWageLivingCosts?.[role];
            if (!Number.isFinite(base) || base <= 0) {
                return BASE_WAGE_REFERENCE * 0.8;
            }
            return Math.max(BASE_WAGE_REFERENCE * 0.8, base * 1.1);
        };
        const ownerIncomeFloorMultiplier = Number.isFinite(buildingWageConfig.ownerIncomeFloorMultiplier)
            ? Math.max(0, buildingWageConfig.ownerIncomeFloorMultiplier)
            : 1.15;
        const ownerIncomeFloorPerCapitaOverride = Number.isFinite(buildingWageConfig.ownerIncomeFloorPerCapita)
            ? Math.max(0, buildingWageConfig.ownerIncomeFloorPerCapita)
            : null;
        const getOwnerIncomeFloorPerCapita = (ownerKey) => {
            if (ownerIncomeFloorPerCapitaOverride !== null) {
                return ownerIncomeFloorPerCapitaOverride;
            }
            return getBuildingLivingCostFloor(ownerKey) * ownerIncomeFloorMultiplier;
        };
        const ownerSlotsByKey = {};
        Object.entries(levelCounts).forEach(([lvlStr, lvlCount]) => {
            if (lvlCount <= 0) return;
            const lvl = parseInt(lvlStr);
            const config = getBuildingEffectiveConfig(b, lvl);
            const ownerKey = config.owner || 'state';
            const ownerSlots = config.jobs?.[ownerKey] || 0;
            ownerSlotsByKey[ownerKey] = (ownerSlotsByKey[ownerKey] || 0) + ownerSlots * lvlCount;
        });

        const preparedWagePlans = wagePlans.map(plan => {
            // ownerKey is required for per-building wage distribution payment.
            // Prefer plan.ownerKey if already provided; fallback to building's default owner.
            const planOwnerKey = plan.ownerKey || b.owner || 'state';

            // 根据角色在各等级的分布，计算加权平均的工资压力因?
            let planWagePressure = avgWagePressure;

            // 如果有多个等级，按比例计算该角色的平均工资压?
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
                const roleLivingCost = buildingWageLivingCosts?.[plan.role] || getBuildingLivingCostFloor(plan.role);
                // Wage = living cost × multiplier (e.g., 1.5 = subsistence + 50% buffer)
                // This is a FIXED wage based on actual needs, not market dynamics
                expectedSlotWage = roleLivingCost * subsistenceMultiplier;
            }
            // 双底线之雇员底线：每个岗位必须至少覆盖该建筑的生计下限
            expectedSlotWage = Math.max(expectedSlotWage, getBuildingLivingCostFloor(plan.role));

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

        // [BUGFIX] 业主工资责任按 ownership 类型分摊，避免 1 个本国阶层业主为外资/官员私产/国有建筑的雇员买单
        // ownerPaidRatio 保留为按"虚拟 owner 通道"区分的比例对象，仅供 UI/调试参考；
        // 实际工资发放使用 building-level 整体支付比例 buildingWagePaidRatio。
        const ownerPaidRatio = {}; // { ownerKey | _official | _state | _foreign: paid / bill }
        let buildingWagePaidRatio = 1;

        // Keep a copy for UI debug/inspection
        buildingFinancialData[b.id].wagePaidRatioByOwner = ownerPaidRatio;

        if (plannedWageBill > 0) {
            // 计算 ownership 占比（无 ownership 数据时回退到原行为：全部由 b.owner 承担；'state'/无 owner 由国库承担）
            const ownership = buildingOwnershipMap[b.id] || null;
            const stratumOwnerKey = b.owner || null;
            const totalOwnedCount = ownership ? Math.max(1, ownership.totalCount) : count;
            let stratumShare;
            let officialShare;
            let foreignShare;
            let stateShare;
            if (ownership) {
                stratumShare = ownership.stratumCount / totalOwnedCount;
                officialShare = ownership.officialCount / totalOwnedCount;
                foreignShare = ownership.foreignCount / totalOwnedCount;
                stateShare = ownership.stateCount / totalOwnedCount;
            } else {
                stratumShare = stratumOwnerKey && stratumOwnerKey !== 'state' ? 1 : 0;
                officialShare = 0;
                foreignShare = 0;
                stateShare = 1 - stratumShare;
            }

            let totalActuallyPaid = 0;

            // 1) 阶层业主部分：从 wealth[ownerKey] 扣除（保留业主底线检查）
            if (stratumOwnerKey && stratumOwnerKey !== 'state' && stratumShare > 0) {
                const stratumBill = plannedWageBill * stratumShare;
                if (stratumBill > 0) {
                    const oKey = stratumOwnerKey;
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
                    // 双底线之业主底线：至少保留业主人均收入底线对应的总财富空间
                    // [OWNER-CAP] 使用实际到岗的 owner 数量而非总岗位需求
                    const ownerSlotsRequired = ownerSlotsByKey[oKey] || 1;
                    const ownerPopFilled = popStructure[oKey] || 0;
                    const ownerSlots = Math.max(1, Math.min(ownerSlotsRequired, ownerPopFilled));
                    const ownerIncomeFloorPerCapita = getOwnerIncomeFloorPerCapita(oKey);
                    const ownerIncomeReserve = ownerIncomeFloorPerCapita * ownerSlots;
                    reservedWealth = Math.max(reservedWealth, ownerIncomeReserve);

                    const disposableWealth = Math.max(0, available - reservedWealth);
                    const paid = Math.min(disposableWealth, stratumBill);

                    if (paid > 0) {
                        ledger.transfer(oKey, 'void', paid, TRANSACTION_CATEGORIES.EXPENSE.WAGES_PAID, TRANSACTION_CATEGORIES.EXPENSE.WAGES_PAID, { buildingId: b.id });
                        roleExpense[oKey] = (roleExpense[oKey] || 0) + paid;
                    }
                    ownerPaidRatio[oKey] = stratumBill > 0 ? paid / stratumBill : 0;
                    totalActuallyPaid += paid;
                }
            }

            // 2) 官员私产部分：按 officialOwners 详情从对应 official.wealth 扣除
            // 注意：不走 ledger.transfer('official',...)，避免与 4815 行 classFinancialData.official.expense.wages 双重计账（该处已按比例分摊）
            if (officialShare > 0 && ownership && ownership.officialCount > 0) {
                const officialBill = plannedWageBill * officialShare;
                let officialPaid = 0;
                const officialOwners = ownership.officialOwners || {};
                const officialCountTotal = Math.max(1, ownership.officialCount);
                Object.entries(officialOwners).forEach(([officialId, ownedCount]) => {
                    if (!ownedCount || ownedCount <= 0) return;
                    const officialBillShare = officialBill * (ownedCount / officialCountTotal);
                    if (officialBillShare <= 0) return;
                    const off = (officials || []).find(o => (o?.id || o?.name) === officialId);
                    if (!off) return;
                    const availableWealth = Math.max(0, off.wealth || 0);
                    const paid = Math.min(availableWealth, officialBillShare);
                    if (paid > 0) {
                        off.wealth = Math.max(0, availableWealth - paid);
                        officialPaid += paid;
                    }
                });
                ownerPaidRatio['_official'] = officialBill > 0 ? officialPaid / officialBill : 0;
                totalActuallyPaid += officialPaid;
            }

            // 3) 国有/代经营部分：从国库 silver 扣除
            if (stateShare > 0) {
                const stateBill = plannedWageBill * stateShare;
                if (stateBill > 0) {
                    const treasury = res.silver || 0;
                    const paid = Math.min(treasury, stateBill);
                    if (paid > 0) {
                        ledger.transfer('state', 'void', paid, TRANSACTION_CATEGORIES.EXPENSE.WAGES_PAID, TRANSACTION_CATEGORIES.EXPENSE.WAGES_PAID, { buildingId: b.id });
                    }
                    ownerPaidRatio['_state'] = stateBill > 0 ? paid / stateBill : 0;
                    totalActuallyPaid += paid;
                }
            }

            // 4) 外资部分：外资侧 processForeignInvestments 已在 wageCost 中扣过外资利润
            // 这里不再让本国任何账户出钱；视为外资从海外汇入支付给本国工人，全额视作"已支付"
            if (foreignShare > 0) {
                const foreignBill = plannedWageBill * foreignShare;
                if (foreignBill > 0) {
                    ownerPaidRatio['_foreign'] = 1;
                    totalActuallyPaid += foreignBill;
                }
            }

            buildingWagePaidRatio = plannedWageBill > 0
                ? Math.max(0, Math.min(1, totalActuallyPaid / plannedWageBill))
                : 1;
        }

        // Pay wages using building-level paid ratio (unified across all roles within the same building).
        // Also update wage stats by the ACTUAL average wage paid for this role.
        preparedWagePlans.forEach(plan => {
            const ratio = buildingWagePaidRatio;
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
                roleTaxableIncome[plan.role] = (roleTaxableIncome[plan.role] || 0) + payout; // 劳动工资应税
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
            // === 按等级精确计算产出收入分?===
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

                // 为可交易资源添加产出浮动?0%-120%?
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
                    // === 按等级精确分配产出收?===
                    Object.entries(levelOutputAmounts).forEach(([lvlStr, resOutputs]) => {
                        const lvl = parseInt(lvlStr);
                        const levelBaseOutput = resOutputs[resKey] || 0;
                        if (levelBaseOutput <= 0) return;

                        // 该等级实际产?= 基础产出 × 浮动因子 × 各种加成
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

                            // 计算该等?即该owner)应得的份?
                            const baseTotal = totalAmount * actualMultiplier;
                            const proportion = baseTotal > 0 ? levelBaseOutput / baseTotal : 0;
                            const levelAmount = amount * proportion;

                            if (levelAmount <= 0) return;

                            const config = getBuildingEffectiveConfig(b, lvl);
                            const ownerKey = config.owner || 'state';

                            if (ownerKey === 'state') {
                                applyResourceChange(resKey, levelAmount, 'building_production_direct');
                                stateBuildingSilverOutput += levelAmount;
                            } else {
                                ledger.transfer('void', ownerKey, levelAmount, 'building_production_direct', 'building_production_direct', { buildingId: b.id });
                            }
                        });
                    } else {
                        applyResourceChange(resKey, amount, 'building_production_direct');
                    }
                }
            }
        }

        if (businessTaxMultiplier !== 0 && count > 0) {
            let totalBusinessTax;
            if (businessTaxMultiplier > 0) {
                const actualOutputValue = outputValuePerMultiplier * actualMultiplier;
                totalBusinessTax = Math.max(0, actualOutputValue) * businessTaxMultiplier;
            } else {
                totalBusinessTax = businessTaxMultiplier * count;
            }

            if (totalBusinessTax > 0) {
                // 正值：?owner 比例收税
                Object.entries(ownerLevelGroups).forEach(([oKey, group]) => {
                    const proportion = group.totalCount / count;
                    const ownerTax = totalBusinessTax * proportion;
                    const ownerWealth = wealth[oKey] || 0;
                    if (ownerWealth >= ownerTax) {
                        ledger.transfer(oKey, 'state', ownerTax, TRANSACTION_CATEGORIES.EXPENSE.BUSINESS_TAX, TRANSACTION_CATEGORIES.EXPENSE.BUSINESS_TAX, { buildingId: b.id });
                        roleBusinessTaxPaid[oKey] = (roleBusinessTaxPaid[oKey] || 0) + ownerTax;
                        roleExpense[oKey] = (roleExpense[oKey] || 0) + ownerTax;
                        buildingFinancialData[b.id].businessTaxPaid += ownerTax;
                    } else if (tick % 30 === 0 && ownerWealth < ownerTax * 0.5) {
                        recordAggregatedLog(`⚠️ ${STRATA[oKey]?.name || oKey} 无力支付 ${b.name} 的营业税，政府放弃征收。`);
                    }
                });
                // taxBreakdown ?Ledger 自动更新
            } else if (totalBusinessTax < 0) {
                // [FIX] 负值：?owner 比例发放补贴
                // 补贴也应该受税收效率影响（腐败官员会贪污补贴?
                // 注意：此?efficiency 尚未计算，使?currentStability 估算
                // 实际到账金额 = 补贴金额 × 效率
                const subsidyAmount = Math.abs(totalBusinessTax);
                const treasury = res.silver || 0;

                // 计算实际发放金额（考虑税收效率?
                // 使用与税收相同的效率计算逻辑
                const estimatedStabilityFactor = Math.min(1.5, Math.max(0.5, 1 + (currentStability - 50) / 100));
                const estimatedEfficiency = estimatedStabilityFactor;
                const rawEfficiency = estimatedEfficiency * (1 + (bonuses.taxEfficiencyBonus || 0) - (bonuses.corruption || 0));
                const effectiveEfficiency = Math.max(0, Math.min(1, rawEfficiency));
                const actualSubsidyAmount = subsidyAmount * effectiveEfficiency;

                if (treasury >= subsidyAmount) {
                    // 从国库扣除全额补?
                    Object.entries(ownerLevelGroups).forEach(([oKey, group]) => {
                        const proportion = group.totalCount / count;
                        const ownerSubsidyFull = subsidyAmount * proportion;
                        const ownerSubsidyActual = actualSubsidyAmount * proportion;

                        ledger.transfer('state', oKey, ownerSubsidyActual, TRANSACTION_CATEGORIES.INCOME.SUBSIDY, TRANSACTION_CATEGORIES.INCOME.SUBSIDY);
                        roleWagePayout[oKey] = (roleWagePayout[oKey] || 0) + ownerSubsidyActual;
                        buildingFinancialData[b.id].businessTaxPaid -= ownerSubsidyActual;
                    });

                    // NOTE: taxBreakdown.subsidy is automatically updated by ledger.transfer()
                    // via _updateSystemStats (amount = ownerSubsidyActual per owner).
                    // Do NOT manually add here — it would cause double-counting.

                    if (effectiveEfficiency < 1 && tick % 30 === 0) {
                        const lossPercent = ((1 - effectiveEfficiency) * 100).toFixed(1);
                        recordAggregatedLog(`💸 ${b.name} 补贴因腐败损失${lossPercent}%`);
                    }
                } else {
                    if (tick % 30 === 0) {
                        recordAggregatedLog(`⚠️ 国库空虚，无法为 ${b.name} 支付营业补贴！`);
                    }
                }
            }
        }

        // NOTE: 工资支付已在 produceBuilding ?preparedWagePlans.forEach 中处?
        // 这里只需要统计总岗位数，不能重复支付工资（之前?BUG?
        if (b.jobs) {
            Object.entries(b.jobs).forEach(([role, perBuilding]) => {
                const roleSlots = perBuilding * count;
                if (roleSlots <= 0) return;
                // 只统计岗位数，不再重复支付工?
                // roleWageStats[role].totalSlots 已在 produceBuilding 中更?
            });
        }
    });
    perfEnd('passiveGains');
    perfEnd('productionLoop');
    _silverCheckpoint('productionLoop');

    // ========== 军人岗位填充数据补全 ==========
    // 军人(soldier)岗位不来自建筑，而是来自军队系统(army + militaryCorps + militaryQueue)，
    // 因此 buildingJobFill 中不会有 soldier 数据。这里使用虚拟键 '_military' 补充，
    // 使 PopulationDetailModal 的岗位就业总览能正确聚合军人在岗数。
    const soldierAvailable = jobsAvailable.soldier || 0;
    if (soldierAvailable > 0) {
        const soldierFilled = Math.min(popStructure.soldier || 0, soldierAvailable);
        buildingJobFill['_military'] = { soldier: soldierFilled };
    }

    // ========== 人头税收取（移到 productionLoop 之后，保证基于本 tick 实际收入） ==========
    // [FIX] 保存税前存款快照，用于后续 TaxShock 计算
    const preTaxWealth = {};
    Object.keys(STRATA).forEach(key => {
        preTaxWealth[key] = wealth[key] || 0;
    });

    perfStart('headTax');
    // [FIX] 商人贸易收入在人头税之后才结算（trading.js），导致贸易收入未被征税。
    // 使用上一 tick 的贸易收入作为本 tick 的征税基数（类似军人使用 previousWages 的方案）。
    const previousMerchantTradeRevenue = merchantState?.tradeRevenueThisTick || 0;
    if (previousMerchantTradeRevenue > 0) {
        roleTaxableIncome.merchant = (roleTaxableIncome.merchant || 0) + previousMerchantTradeRevenue;
    }
    Object.keys(STRATA).forEach(key => {
        if (key === 'official') return;
        const count = popStructure[key] || 0;
        if (count === 0) return;
        const def = STRATA[key];
        if (wealth[key] === undefined) {
            wealth[key] = def.startingWealth || 0;
        }
        const headRate = getHeadTaxRate(key);
        // [FIX] 使用本 tick 应税收入（roleTaxableIncome）计算课税基数。
        // roleTaxableIncome 仅包含工资 + 业主收入，不含任何补贴类收入。
        // 补贴（资源补贴、营业税补贴、消费补贴、人头税补贴）全部免税。
        let actualPerCapitaTaxableIncome = count > 0 ? (roleTaxableIncome[key] || 0) / count : 0;
        // [FIX] Save taxable income to classFinancialData so UI can display the actual tax base
        if (classFinancialData[key]) {
            classFinancialData[key].income.taxableIncome = roleTaxableIncome[key] || 0;
        }
        // 军人收入（军饷）在人头税之后才发放，此时 roleTaxableIncome.soldier 为 0；
        // 用上一 tick 的工资信号（对军人来说就是人均军饷）作为课税基数
        if (actualPerCapitaTaxableIncome <= 0 && key === 'soldier') {
            const prevSoldierWage = previousWages[key];
            if (Number.isFinite(prevSoldierWage) && prevSoldierWage > 0) {
                actualPerCapitaTaxableIncome = prevSoldierWage;
            }
        }
        // 失业者没有工作收入，用全社会加权平均工资作为人头税课税基数
        if (actualPerCapitaTaxableIncome <= 0 && key === 'unemployed') {
            if (Number.isFinite(defaultWageEstimate) && defaultWageEstimate > 0) {
                actualPerCapitaTaxableIncome = defaultWageEstimate;
            }
        }
        const taxRatio = TAX_BASE_RATES?.HEAD_TAX_INCOME_RATIO || 1.0;
        let plannedPerCapitaTax;
        if (headRate > 0) {
            const incomeBase = (Number.isFinite(actualPerCapitaTaxableIncome) && actualPerCapitaTaxableIncome > 0)
                ? actualPerCapitaTaxableIncome * taxRatio : 0;
            plannedPerCapitaTax = incomeBase * headRate * effectiveTaxModifier;
        } else if (headRate < 0) {
            plannedPerCapitaTax = headRate * effectiveTaxModifier;
        } else {
            plannedPerCapitaTax = 0;
        }
        const available = Math.max(0, wealth[key] || 0);
        const maxPerCapitaTax = available / Math.max(1, count);
        const effectivePerCapitaTax = plannedPerCapitaTax >= 0
            ? Math.min(plannedPerCapitaTax, maxPerCapitaTax)
            : plannedPerCapitaTax;
        const due = count * effectivePerCapitaTax;

        if (due !== 0) {
            if (due > 0) {
                const paid = Math.min(available, due);
                ledger.transfer(key, 'state', paid, TRANSACTION_CATEGORIES.EXPENSE.HEAD_TAX, TRANSACTION_CATEGORIES.EXPENSE.HEAD_TAX);
                roleHeadTaxPaid[key] = (roleHeadTaxPaid[key] || 0) + paid;
                roleExpense[key] = (roleExpense[key] || 0) + paid;
                roleLivingExpense[key] = (roleLivingExpense[key] || 0) + paid;
            } else {
                const subsidyNeeded = -due;
                const treasury = res.silver || 0;
                if (treasury >= subsidyNeeded) {
                    ledger.transfer('state', key, subsidyNeeded, TRANSACTION_CATEGORIES.INCOME.SUBSIDY, TRANSACTION_CATEGORIES.INCOME.SUBSIDY);
                    roleWagePayout[key] = (roleWagePayout[key] || 0) + subsidyNeeded;
                    roleLaborIncome[key] = (roleLaborIncome[key] || 0) + subsidyNeeded;
                    if (classFinancialData[key]) {
                        classFinancialData[key].income.headTaxSubsidy = (classFinancialData[key].income.headTaxSubsidy || 0) + subsidyNeeded;
                    }
                }
            }
        }
    });
    perfEnd('headTax');
    _silverCheckpoint('headTax');

    // === 新军费计算系?===
    // [FIX] 合并散兵(army)和军?militaryCorps)内的所有单位，统一计算军饷
    const allMilitaryUnits = { ...(army || {}) };
    if (Array.isArray(militaryCorps)) {
        for (const corps of militaryCorps) {
            if (corps?.isAI) continue; // 跳过AI军团
            for (const [unitId, count] of Object.entries(corps?.units || {})) {
                if (count > 0) {
                    allMilitaryUnits[unitId] = (allMilitaryUnits[unitId] || 0) + count;
                }
            }
        }
    }
    const hasArmyUnits = Object.values(allMilitaryUnits).some(count => count > 0);
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

    let militaryDebug = _simDebugEnabled ? {
        totalArmyCost: 0,
        availableSilver: res.silver,
        applied: false,
        reason: null,
        logSizeBefore: silverChangeLog.length
    } : null;

    if (hasArmyUnits || hasArmyQueue) {
        // 1. 获取军队资源维护需?
        const armyMaintenanceMultiplier = getArmyMaintenanceMultiplier(difficulty);
        // [FIX] 使用合并后的 allMilitaryUnits 计算维护费（包含军团内的单位?
        const baseArmyMaintenance = calculateArmyMaintenance(allMilitaryUnits);
        // Apply difficulty multiplier
        Object.keys(baseArmyMaintenance).forEach(key => {
            baseArmyMaintenance[key] = Math.ceil((baseArmyMaintenance[key] || 0) * armyMaintenanceMultiplier);
        });

        // Apply wartime multiplier: 3x army maintenance during war
        const armyMaintenance = {};
        Object.entries(baseArmyMaintenance).forEach(([resource, amount]) => {
            armyMaintenance[resource] = isPlayerAtWar ? amount * WAR_MILITARY_MULTIPLIER : amount;
        });

        // V2: 理念维护费修正（maintenance_cost_mod，按兵种分类或全局）
        if (bonuses.ideoMaintenanceCostMod && Object.keys(bonuses.ideoMaintenanceCostMod).length > 0) {
            const globalMaintMod = bonuses.ideoMaintenanceCostMod._global || 0;
            // 按兵种分类计算加权修正
            let totalUnits = 0;
            let weightedMod = 0;
            Object.entries(allMilitaryUnits).forEach(([unitId, count]) => {
                if (count <= 0) return;
                const unit = UNIT_TYPES?.[unitId];
                if (!unit) return;
                const catMod = bonuses.ideoMaintenanceCostMod[unit.category] || 0;
                const unitMod = Math.max(-0.5, globalMaintMod + catMod); // cap at -50%
                weightedMod += unitMod * count;
                totalUnits += count;
            });
            if (totalUnits > 0) {
                const avgMod = weightedMod / totalUnits;
                const maintMultiplier = Math.max(0.5, 1 + avgMod);
                Object.keys(armyMaintenance).forEach(key => {
                    armyMaintenance[key] = Math.ceil(armyMaintenance[key] * maintMultiplier);
                });
            }
        }

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

            // 从市场购买：消耗库存资?
            const available = res[resource] || 0;
            const consumed = Math.min(available, needed);

            if (consumed > 0) {
                res[resource] = available - consumed;
                rates[resource] = (rates[resource] || 0) - consumed;
                armyResourceConsumption[resource] = consumed;

                // 增加市场需求（影响价格?
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
                recordAggregatedLog(`⚠️ 军队维护资源不足：缺少${RESOURCES[resource]?.name || resource} ${shortage.toFixed(1)}/日`);
            }
        });

        perfStart('armyMaintenance');
        // 3. 计算时代加成和规模惩?
        // [FIX] 使用合并后的 allMilitaryUnits 计算军队人口（含军团内单位）
        const armyPopulation = calculateArmyPopulation(allMilitaryUnits);
        const scalePenalty = calculateArmyScalePenalty(armyPopulation, population);

        // 4. 总军?= 资源成本 × 时代加成 × 规模惩罚 × 军饷倍率
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

        if (_simDebugEnabled) {
            militaryDebug = {
                totalArmyCost,
                availableSilver: res.silver,
                applied: false,
                reason: null,
                logSizeBefore: silverChangeLog.length
            };
        }

        if (totalArmyCost > 0) {
            // [DEBUG] Military Log Trace
            // console.log('[Simulation] Applying military cost:', totalArmyCost, 'Reason:', 'expense_army_maintenance');
            const available = res.silver || 0;
            if (available >= totalArmyCost) {
                // [FIX] Use Ledger for correct wealth transfer (State -> Soldier)
                ledger.transfer('state', 'soldier', totalArmyCost, TRANSACTION_CATEGORIES.EXPENSE.MAINTENANCE, TRANSACTION_CATEGORIES.INCOME.MILITARY_PAY);

                if (militaryDebug) {
                    militaryDebug.applied = true;
                    militaryDebug.reason = 'expense_army_maintenance';
                }

                rates.silver = (rates.silver || 0) - totalArmyCost;
                roleWagePayout.soldier = (roleWagePayout.soldier || 0) + totalArmyCost;
                roleLaborIncome.soldier = (roleLaborIncome.soldier || 0) + totalArmyCost; // Army pay is labor income
                roleTaxableIncome.soldier = (roleTaxableIncome.soldier || 0) + totalArmyCost; // 军饷应税
                // [FIX] 同步?classFinancialData 以保持概览和财务面板数据一?
                if (classFinancialData.soldier) {
                    classFinancialData.soldier.income.militaryPay = (classFinancialData.soldier.income.militaryPay || 0) + totalArmyCost;
                }

                if (militaryDebug) {
                    const logLast = silverChangeLog.toArray().pop();
                    militaryDebug.logEntryFound = logLast && logLast.reason === TRANSACTION_CATEGORIES.EXPENSE.MAINTENANCE;
                    militaryDebug.logSizeAfter = silverChangeLog.length;
                }

                // [FIX Bug5] 标记军饷支付状?
                armyExpenseResult.isUnderPaid = false;
                armyExpenseResult.payRatio = 1;
            } else if (totalArmyCost > 0) {
                // 部分支付
                const partialPay = available * 0.9; // ?0%?
                if (partialPay > 0) {
                    // [FIX] Use Ledger for partial payment too
                    ledger.transfer('state', 'soldier', partialPay, TRANSACTION_CATEGORIES.EXPENSE.MAINTENANCE, TRANSACTION_CATEGORIES.INCOME.MILITARY_PAY);

                    rates.silver = (rates.silver || 0) - partialPay;
                    roleWagePayout.soldier = (roleWagePayout.soldier || 0) + partialPay;
                    roleTaxableIncome.soldier = (roleTaxableIncome.soldier || 0) + partialPay; // 军饷部分支付应税
                    // [FIX] 同步?classFinancialData 以保持概览和财务面板数据一?
                    if (classFinancialData.soldier) {
                        classFinancialData.soldier.income.militaryPay = (classFinancialData.soldier.income.militaryPay || 0) + partialPay;
                    }
                }
                // [FIX Bug5] 标记欠饷状态及支付比例
                armyExpenseResult.isUnderPaid = true;
                armyExpenseResult.payRatio = totalArmyCost > 0 ? partialPay / totalArmyCost : 0;
                logs.push(`⚠️ 军饷不足！应付${totalArmyCost.toFixed(0)}银币，仅能支付${partialPay.toFixed(0)}银币，军心不稳。`);
            }
        }
        perfEnd('armyMaintenance');
        _silverCheckpoint('armyMaintenance');
    }

    // console.log('[TICK] Production loop completed.'); // Commented for performance

    // Add all tracked income (civilian + military) to the wealth of each class
    // applyRoleIncomeToWealth(); // Removed to prevent double counting (called again at end of tick)

    // console.log('[TICK] Starting needs calculation...'); // Commented for performance
    perfStart('needsConsumption');
    perfStart('socialEconomy');
    const needsReport = {};
    const classShortages = {};
    // 收集各阶层的财富乘数（用于UI显示"谁吃到了buff"?
    const stratumWealthMultipliers = {};
    // [FIX] 添加缺失?stratumConsumption 初始化，用于追踪各阶层消?
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
        const shortages = []; // 改为对象数组，记录短缺原?

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
            if (!isResourceDemandActive(resKey, epoch, techsUnlocked, availableResources)) {
                // 只有已具备稳定供给能力的资源才会进入需求
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

            // 新增：计算官员平均贪婪度（仅在计算官员阶层需求时生效?
            let officialGreedModifier = 1.0;
            if (key === 'official' && officials && officials.length > 0) {
                const totalGreed = officials.reduce((sum, off) => sum + (off.greed || 1.0), 0);
                officialGreedModifier = totalGreed / officials.length;
            }

            // 应用需求弹性调?
            if (isTradableResource(resKey)) {
                const resourceMarketConfig = resourceInfo?.marketConfig || {};
                const defaultMarketInfluence = ECONOMIC_INFLUENCE?.market || {};
                const demandElasticity = resourceMarketConfig.demandElasticity !== undefined
                    ? resourceMarketConfig.demandElasticity
                    : (defaultMarketInfluence.demandElasticity || 0.5);

                // 1. 财富影响：阶层财富相对于起始财富的变?
                const startingWealth = def.startingWealth || 1;
                const currentWealth = (wealth[key] || 0) / Math.max(1, count);

                // New Hybrid Wealth for Demand: Max(Real Wealth, Projected Monthly Income)
                const currentIncome = (roleWagePayout[key] || 0) / Math.max(1, count);
                const projectedIncomeWealth = Math.max(0, currentIncome) * 30;
                const effectiveWealth = Math.max(currentWealth, projectedIncomeWealth);

                const wealthRatio = effectiveWealth / startingWealth;
                // 2024-12更新：使用统一的calculateWealthMultiplier函数
                // 该函数现在支持高财富比率补偿低收?
                // incomeRatio在这里使用wealthRatio近似（因为高财富意味着历史上收入高?
                let wealthElasticity = def.wealthElasticity || 1.0;

                // 应用官员贪婪度修正：贪婪度直接放大财富弹性，意味着越有钱越想通过消费展示
                if (key === 'official') {
                    wealthElasticity *= officialGreedModifier;
                }

                const maxMultiplier = Math.max(1, (def.maxConsumptionMultiplier || 6) + getMaxConsumptionMultiplierBonus(difficulty));
                const wealthMultiplier = calculateWealthMultiplier(wealthRatio, wealthRatio, wealthElasticity, maxMultiplier);
                // 记录财富乘数（取最后一次计算的值，用于UI显示?
                if (!stratumWealthMultipliers[key] || Math.abs(wealthMultiplier - 1) > Math.abs(stratumWealthMultipliers[key] - 1)) {
                    stratumWealthMultipliers[key] = wealthMultiplier;
                }

                // 2. 价格影响：当前价格相对于基础价格的变?
                const currentPrice = getPrice(resKey);
                const basePrice = resourceInfo.basePrice || 1;
                const priceRatio = currentPrice / basePrice;
                // 价格变化对需求的影响：价格上涨→需求下降，价格下跌→需求上?
                // 使用需求弹性：价格变化1%，需求反向变化elasticity%
                const priceMultiplier = Math.pow(priceRatio, -demandElasticity);

                // 3. 每日随机浮动?0%-120%?
                const dailyVariation = 0.8 + Math.random() * 0.4;

                // 综合调整需?
                requirement *= wealthMultiplier * priceMultiplier * dailyVariation;

                // 确保需求不会变成负数或过大
                requirement = Math.max(0, requirement);
                requirement = Math.min(requirement, perCapita * count * needsRequirementMultiplier * 8); // 最?倍（配合更低的财富乘数上限）
            }
            const available = res[resKey] || 0;
            let satisfied = 0;

            if (isTradableResource(resKey)) {
                const marketPrice = getPrice(resKey);

                // [NEW] 价格管制检查：只有左派主导且启用时才生?
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

                // 先不统计需求，等实际消费后再统?
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
                    const isBasic = !!(def.needs && def.needs.hasOwnProperty(resKey));
                    shortages.push({ resource: resKey, reason, isBasic });
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
                    const isBasic = !!(def.needs && def.needs.hasOwnProperty(resKey));
                    shortages.push({ resource: resKey, reason: 'outOfStock', isBasic });
                }
            }
        }

        needsReport[key] = {
            satisfactionRatio: tracked > 0 ? satisfactionSum / tracked : 1,
            totalTrackedNeeds: tracked,
        };
        classShortages[key] = shortages;
    });

    // 计算劳动效率，特别关注食物和布料的基础需?
    let workforceNeedWeighted = 0;
    let workforceTotal = 0;
    let basicNeedsDeficit = 0; // 基础需求缺失的严重程度

    Object.keys(STRATA).forEach(key => {
        const count = popStructure[key] || 0;
        if (count <= 0) return;
        workforceTotal += count;
        const needLevel = needsReport[key]?.satisfactionRatio ?? 1;
        workforceNeedWeighted += needLevel * count;

        // 检查食物和布料的基础需求满足情?
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
        // 基础需求缺失导致额外的效率惩罚：最多额外降?0%效率
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
        // logs.push('劳动力因需求未满足而效率下降');
    }
    perfEnd('needsConsumption');
    _silverCheckpoint('needsConsumption');

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

    // [PERF] 内阁机制属于deferred级，按配置频率执行
    let _freeMarketDebug = null;
    // 代经营制下，阶层业主扩张的建筑需要分配给代经营制官员代管
    let pendingStateManagedBuildings = {};
    const shouldUpdateCabinet = shouldRunThisTick(tick, 'cabinet');
    if (shouldUpdateCabinet) {
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
    if (_simDebugEnabled) {
        _freeMarketDebug = {
            cabinetStatusReceived: {
                hasCabinetStatus: !!cabinetStatus,
                hasDominance: !!cabinetStatus?.dominance,
                dominanceFaction: cabinetStatus?.dominance?.faction,
                synergy: cabinetStatus?.synergy,
                level: cabinetStatus?.level,
            },
            expansionSettings: {
                hasSettings: !!expansionSettings,
                settingsKeys: expansionSettings ? Object.keys(expansionSettings) : [],
                allowedCount: expansionSettings
                    ? Object.values(expansionSettings).filter(s => s?.allowed).length
                    : 0,
            },
            conditionCheck: {
                isDominanceRight: cabinetStatus?.dominance?.faction === 'right',
                hasExpansionSettings: !!expansionSettings,
                willProcess: cabinetStatus?.dominance?.faction === 'right' && !!expansionSettings,
            },
            epochParam: epoch,
        };
    }

    // [NEW DEBUG] 详细输出传入的参?
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
        // 构?market 对象，包?prices ?wages 用于利润计算
        const marketForExpansion = {
            prices: priceMap,
            wages: market?.wages || {}
        };

        // We pass BUILDINGS, wealth, settings, counts, market with wages, and tax policies
        // Calculate tax efficiency for subsidy estimation (same formula as subsidy payout)
        const _stabFactor = Math.min(1.5, Math.max(0.5, 1 + (currentStability - 50) / 100));
        const _rawEff = _stabFactor * (1 + (bonuses.taxEfficiencyBonus || 0) - (bonuses.corruption || 0));
        const _taxEfficiency = Math.max(0, Math.min(1, _rawEff));

        const { expansions, wealthDeductions } = processOwnerExpansions(
            BUILDINGS,
            wealth,
            expansionSettings,
            newBuildingsCount,
            marketForExpansion,
            taxPolicies,  // [NEW] 传递税收政策用于营业税计算
            buildingStaffingRatios,
            { taxEfficiency: _taxEfficiency }
        );

        // Apply expansions
        if (expansions.length > 0) {
            // logs.push(`Free Market: Expanding ${expansions.length} buildings.`);
            expansions.forEach(exp => {
                const id = exp.buildingId;
                newBuildingsCount[id] = (newBuildingsCount[id] || 0) + 1;
                // logs.push(`- ${exp.owner} built ${id} for ${exp.cost}`);
            });

            // 代经营制下，将阶层业主扩张的建筑记录到 pendingStateManagedBuildings，等待分配给代经营制官员
            const hasStateManagedOfficials = (officials || []).some(o => (o.propertyPolicy || 'private') === 'state_managed');
            if (hasStateManagedOfficials) {
                expansions.forEach(exp => {
                    pendingStateManagedBuildings[exp.buildingId] = (pendingStateManagedBuildings[exp.buildingId] || 0) + 1;
                });
            }

            // Apply wealth deductions
            Object.entries(wealthDeductions).forEach(([stratum, amount]) => {
                if (wealth[stratum]) {
                    ledger.transfer(stratum, 'void', amount, TRANSACTION_CATEGORIES.EXPENSE.BUILDING_COST, TRANSACTION_CATEGORIES.EXPENSE.BUILDING_COST);
                }
            });
            // Update the main `builds` object for the rest of the tick
            Object.assign(builds, newBuildingsCount);
            _buildingsModified = true;
            console.warn('[SIM-BUILD] Free Market expanded:', expansions.map(e => e.buildingId));
        }
    }
    perfEnd('cabinetMechanics');
    } // end shouldUpdateCabinet

    // ====================================================================================================
    // 6. Return Simulation Result
    // ====================================================================================================
    // Move official processing here so their wealth is aggregated into `wealth` BEFORE
    // calculateLivingStandards runs. This ensures StrataPanel shows correct data.
    // [PERF] 官员系统属于deferred级，按配置频率执行；跳过时保留上次计算的官员财富
    // 变量声明提到守卫外部，确保后续代码引用安全
    let totalOfficialWealth = 0;
    let totalOfficialExpense = 0;
    let totalOfficialIncome = 0; // Track income for UI
    let totalOfficialLaborIncome = 0; // Track labor income (salary + subsidy)
    const pendingOfficialUpgrades = [];
    // 默认值：跳过时使用原始officials列表
    let updatedOfficials = Array.isArray(officials) ? [...officials] : [];

    const shouldUpdateOfficials = shouldRunThisTick(tick, 'officialSim');
    if (shouldUpdateOfficials) {
    perfStart('officialsSim');
    const officialMarketSnapshot = {
        prices: priceMap,
        wages: market?.wages || {},
    };

    const officialList = Array.isArray(officials) ? officials : [];
    const officialCount = officialList.length;
    // [OPTIMIZATION REMOVED] 移除批处理机制，所有官员每个Tick都进行完整计?
    // 原因?
    // 1. 建筑生产、工资发放、盈利都是每个Tick更新?
    // 2. 官员的收入（薪水、产业收益）和支出（消费、税收）应该实时计算
    // 3. 投资决策已有内置冷却时间（INVESTMENT_COOLDOWN=90, UPGRADE_COOLDOWN=60），不会造成性能问题
    updatedOfficials = officialCount === 0 ? [] : officialList.map((official, index) => {
        if (!official) return official;
        const normalizedOfficial = migrateOfficialForInvestment(official, tick);

        // 初始?wealth（向后兼容：旧存档可能没?wealth?
        // [FIX] 添加安全检查：财富上限1兆（1e12），防止极大数值导致系统崩?
        const MAX_WEALTH = 1e12; // 最大财富：1?
        let rawWealth = typeof normalizedOfficial.wealth === 'number' ? normalizedOfficial.wealth : 400;
        // 检查是否为有效数值，无效则重置为400
        if (!Number.isFinite(rawWealth) || rawWealth < 0) {
            rawWealth = 400;
        }
        let currentWealth = Math.min(rawWealth, MAX_WEALTH);

        // [DEBUG] 追踪官员财富变化
        const debugInitialWealth = currentWealth;

        // 初始化支出相关变量（需要在使用前声明）
        const officialNeeds = STRATA.official?.needs || { food: 1.2, cloth: 0.2 };
        const officialLuxuryNeeds = STRATA.official?.luxuryNeeds || {};
        let dailyExpense = 0;
        let luxuryExpense = 0;
        let essentialExpense = 0;
        let headTaxPaid = 0;
        let officialThisTickIncome = 0;
        let investmentCost = 0;
        let upgradeCost = 0;
        let managementFeeIncome = 0; // 代经营管理费收入

        // 产业政策薪资倍率（逐官员设置，高薪养廉模式下薪资 x1.6）
        const officialPolicy = normalizedOfficial.propertyPolicy || 'private';
        const policyConfig = PROPERTY_POLICY_CONFIG[officialPolicy] || PROPERTY_POLICY_CONFIG.private;
        const policySalaryMultiplier = policyConfig.salaryMultiplier || 1.0;

        // 收入：如果足额支付薪水，获得薪水
        // 负薪酬：官员需要向国库缴纳费用
        if (officialsPaid && typeof normalizedOfficial.salary === 'number') {
            const effectiveSalary = Math.round(normalizedOfficial.salary * policySalaryMultiplier);
            if (effectiveSalary > 0) {
                currentWealth += effectiveSalary;
                officialThisTickIncome += effectiveSalary;
                totalOfficialIncome += effectiveSalary;
                totalOfficialLaborIncome += effectiveSalary;
                // console.log(`[OFFICIAL DEBUG] ${normalizedOfficial.name}: Salary paid! +${normalizedOfficial.salary}, wealth: ${debugInitialWealth} -> ${currentWealth}`);
                // 记录俸禄到财务数?
                if (classFinancialData.official) {
                    classFinancialData.official.income.salary = (classFinancialData.official.income.salary || 0) + effectiveSalary;
                }
            } else if (normalizedOfficial.salary < 0) {
                // 负薪酬：官员向国库缴纳费用（最多扣到官员财富为0?
                const requiredPayment = Math.abs(normalizedOfficial.salary);
                const actualPayment = Math.min(requiredPayment, currentWealth);
                currentWealth = Math.max(0, currentWealth - actualPayment);

                // 记录负薪酬收入到国库（通过ledger系统?
                if (actualPayment > 0) {
                    ledger.transfer('official', 'state', actualPayment, 'NEGATIVE_SALARY', 'NEGATIVE_SALARY');
                    // 记录到官员支?
                    headTaxPaid += actualPayment; // 暂时归入headTaxPaid统计（或可以新增字段?
                }

                // console.log(`[OFFICIAL DEBUG] ${normalizedOfficial.name}: Negative salary! Required: ${requiredPayment}, Paid: ${actualPayment}, wealth: ${debugInitialWealth} -> ${currentWealth}`);
            }
        } else {
            // console.log(`[OFFICIAL DEBUG] ${normalizedOfficial.name}: NO SALARY! officialsPaid=${officialsPaid}, salary=${normalizedOfficial.salary}, wealth=${currentWealth}`);
        }

        // 支出：官员独立购买商品，更新市场供需与税?
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
            if (!isResourceDemandActive(resource, epoch, techsUnlocked, availableResources)) return;

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

                // 使用 Ledger 记录支出 (更新 classFinancialData ?aggregate wealth)
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

        // 基于财富水平的奢侈需?
        // [FIX] 限制wealthRatio上限防止数值溢出（极大财富值会导致后续计算爆炸?
        const rawWealthRatio = currentWealth / 400; // 相对于初始财富的比例
        const wealthRatio = Math.min(rawWealthRatio, 1e9); // 上限10亿?
        if (wealthRatio >= 1.0 && officialLuxuryNeeds) {
            const wealthBase = Math.max(1, Math.min(currentWealth / 400, 1e9));
            // [FIX] 限制消费乘数上限?00倍，防止极大财富导致的消费爆?
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
        // [FIX] 税基 = 本 tick 薪俸 + 上一 tick 产业收入（与商人贸易收入同理，产业收入在人头税之后才结算）
        const headRate = getHeadTaxRate('official');
        const taxRatioOff = TAX_BASE_RATES?.HEAD_TAX_INCOME_RATIO || 1.0;
        const previousPropertyIncome = normalizedOfficial.lastDayPropertyIncome || 0;
        const officialTotalTaxableIncome = officialThisTickIncome + (previousPropertyIncome > 0 ? previousPropertyIncome : 0);
        let plannedPerCapitaTax;
        if (headRate > 0) {
            const officialIncomeBase = (Number.isFinite(officialTotalTaxableIncome) && officialTotalTaxableIncome > 0)
                ? officialTotalTaxableIncome * taxRatioOff : 0;
            plannedPerCapitaTax = officialIncomeBase * headRate * effectiveTaxModifier;
        } else if (headRate < 0) {
            plannedPerCapitaTax = headRate * effectiveTaxModifier;
        } else {
            plannedPerCapitaTax = 0;
        }
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
                    totalOfficialLaborIncome += subsidyNeeded;
                    if (classFinancialData.official) {
                        classFinancialData.official.income.headTaxSubsidy = (classFinancialData.official.income.headTaxSubsidy || 0) + subsidyNeeded;
                    }
                }
            }
        }

        // [FIX] 记录官员应税收入到 classFinancialData，供 UI 显示正确的税基
        if (classFinancialData.official) {
            classFinancialData.official.income.taxableIncome = (classFinancialData.official.income.taxableIncome || 0) + officialTotalTaxableIncome;
        }

        // [BUG FIX] 移除重复扣支出的代码
        // dailyExpense 已在 consumeOfficialResource 中实时从 currentWealth 扣除（第2948行）
        // 这里不应该再扣一次，否则会导致官员财富被双重扣减，存款无法积?

        // [DEBUG] 追踪财富变化 - 人头税后
        const debugAfterConsumption = currentWealth;
        const debugPlannedHeadTax = plannedPerCapitaTax;

        // 官员产业收益结算（根据该官员的产业政策模式分流）
        const isPrivatePolicy = officialPolicy === 'private';
        const isHighSalaryPolicy = officialPolicy === 'high_salary';
        const isStateManagedPolicy = officialPolicy === 'state_managed';

        // 官员产业收益结算（独立核算）
        let totalPropertyIncome = 0;
        let totalOfficialProductionCosts = 0; // 官员建筑的生产成?
        let totalOfficialWages = 0; // 官员建筑的工资支?
        let totalOfficialBusinessTax = 0; // 官员建筑的营业税
        let totalOfficialOwnerRevenue = 0; // 官员建筑的业主收?
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

        // 产业数据统一用 summary 结构
        let propertySummary = normalizedOfficial._propertySummary;
        if (!propertySummary) {
            // 存档兼容 fallback（旧存档无 _propertySummary 时创建空 summary）
            propertySummary = { byBuilding: {}, byBuildingLevel: {}, totalCount: 0 };
        }
        let managedSummary = normalizedOfficial._managedSummary;
        if (!managedSummary) {
            managedSummary = { byBuilding: {}, totalCount: 0 };
        }
        const incomeSourceSummary = isStateManagedPolicy ? managedSummary : propertySummary;

        Object.entries(incomeSourceSummary.byBuilding || {}).forEach(([buildingId, count]) => {
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
            
            // [FIX] 记录官员建筑的成本和收入到财务统?
            const finance = buildingFinancialData?.[buildingId];
            if (finance) {
                const totalCount = builds?.[buildingId] || 0;
                if (totalCount > 0) {
                    // 按比例分摊：官员拥有的建筑数?/ 总建筑数?
                    const ownerShare = count / totalCount;
                    totalOfficialOwnerRevenue += (finance.ownerRevenue || 0) * ownerShare;
                    totalOfficialProductionCosts += (finance.productionCosts || 0) * ownerShare;
                    totalOfficialBusinessTax += (finance.businessTaxPaid || 0) * ownerShare;
                    const totalWagesPaid = Object.values(finance.wagesByRole || {})
                        .reduce((sum, val) => sum + (Number.isFinite(val) ? val : 0), 0);
                    totalOfficialWages += totalWagesPaid * ownerShare;
                }
            }
        });
        if (totalPropertyIncome !== 0) {
            if (isStateManagedPolicy && totalPropertyIncome > 0) {
                // 代经营制：利润按比例分配给国库和官员管理费
                const profitSplit = calculateStateManagedProfitSplit(totalPropertyIncome, normalizedOfficial);
                const treasuryIncome = profitSplit.toTreasury || 0;
                managementFeeIncome = profitSplit.toOfficial;
                if (treasuryIncome > 0) {
                    // 国企利润国库份额：真实入账并进入财政明细
                    ledger.transfer('void', 'state', treasuryIncome, TRANSACTION_CATEGORIES.INCOME.OWNER_REVENUE, 'state_enterprise_profit');
                }
                currentWealth = Math.max(0, currentWealth + managementFeeIncome);
                totalOfficialIncome += managementFeeIncome;
                if (managementFeeIncome > 0) {
                    ledger.transfer('void', 'official', managementFeeIncome, TRANSACTION_CATEGORIES.INCOME.OWNER_REVENUE, 'MANAGEMENT_FEE');
                }
                // 腐败损耗不入任何人口袋
            } else {
                // 私产制或高薪养廉（高薪制不应有产业，但兼容遗留数据）
                currentWealth = Math.max(0, currentWealth + totalPropertyIncome);
                totalOfficialIncome += totalPropertyIncome;
                if (totalPropertyIncome > 0) {
                    ledger.transfer('void', 'official', totalPropertyIncome, TRANSACTION_CATEGORIES.INCOME.OWNER_REVENUE, TRANSACTION_CATEGORIES.INCOME.OWNER_REVENUE);
                }
            }
        }
        
        // [FIX] 记录官员的产业成本和收入到classFinancialData
        if (classFinancialData.official) {
            classFinancialData.official.income.ownerRevenue = (classFinancialData.official.income.ownerRevenue || 0) + totalOfficialOwnerRevenue;
            classFinancialData.official.expense.productionCosts = (classFinancialData.official.expense.productionCosts || 0) + totalOfficialProductionCosts;
            classFinancialData.official.expense.wages = (classFinancialData.official.expense.wages || 0) + totalOfficialWages;
            classFinancialData.official.expense.businessTax = (classFinancialData.official.expense.businessTax || 0) + totalOfficialBusinessTax;
        }

        // [DEBUG] 追踪财富变化 - 产业收益?
        const debugAfterProperty = currentWealth;

        // 计算财务满意?
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
            // 财务状况不佳时，取两者中更差?
            const finalSatisfactionIndex = Math.max(
                satisfactionOrder.indexOf(financialSatisfaction),
                satisfactionOrder.indexOf(salarySatisfaction)
            );
            combinedSatisfaction = satisfactionOrder[finalSatisfactionIndex] || financialSatisfaction;
        }

        // 产业投资决策（根据产业政策模式分流）
        let investmentDecision = null;
        if (isHighSalaryPolicy) {
            // 高薪养廉：完全禁止投资
            investmentDecision = null;
        } else if (isStateManagedPolicy) {
            // 代经营制：国库出资，官员选择经营目标
            // 预算为国库可分配金额的一部分（简化处理：使用当前资源中的白银）
            const treasuryBudget = (res.silver || 0) * 0.02; // 每次最多用国库2%
            investmentDecision = processStateManagedInvestment(
                { ...normalizedOfficial, wealth: currentWealth },
                tick,
                officialMarketSnapshot,
                taxPolicies,
                cabinetStatus,
                builds,
                difficulty,
                epoch,
                techsUnlocked,
                treasuryBudget
            );
        } else {
            // 私产制：官员用个人财富投资
            investmentDecision = processOfficialInvestment(
                { ...normalizedOfficial, wealth: currentWealth },
                tick,
                officialMarketSnapshot,
                taxPolicies,
                cabinetStatus,
                builds,
                difficulty,
                epoch,
                techsUnlocked,
                buildingStaffingRatios
            );
        }

        let nextPropertySummary = propertySummary;
        let nextManagedSummary = managedSummary;
        let _summaryCopied = false;
        let _managedCopied = false;
        const investmentProfile = { ...normalizedOfficial.investmentProfile };

        const MAX_INVEST_SPEND_RATIO = 0.25;
        const investBudget = isStateManagedPolicy
            ? (res.silver || 0) * 0.02  // 代经营制：使用国库预算
            : currentWealth * MAX_INVEST_SPEND_RATIO; // 私产制：使用个人财富
        if (investmentDecision && investmentDecision.cost <= investBudget) {
            if (isStateManagedPolicy) {
                // 代经营制：从国库扣费，建筑记录到 managedBuildings
                applySilverChange(-investmentDecision.cost, 'state_managed_investment');
                investmentCost = investmentDecision.cost;
            } else {
                // 私产制：从个人财富扣费
                if (currentWealth < investmentDecision.cost) {
                    // 财富不足，跳过
                } else {
                    currentWealth = Math.max(0, currentWealth - investmentDecision.cost);
                    investmentCost = investmentDecision.cost;
                }
            }
            if (investmentCost > 0) {
            const bid = investmentDecision.buildingId;
            if (isStateManagedPolicy) {
                if (!_managedCopied) {
                    nextManagedSummary = { byBuilding: { ...managedSummary.byBuilding }, totalCount: managedSummary.totalCount };
                    _managedCopied = true;
                }
                nextManagedSummary.byBuilding[bid] = (nextManagedSummary.byBuilding[bid] || 0) + 1;
                nextManagedSummary.totalCount += 1;
            } else {
                if (!_summaryCopied) {
                    nextPropertySummary = {
                        byBuilding: { ...propertySummary.byBuilding },
                        byBuildingLevel: { ...propertySummary.byBuildingLevel },
                        totalCount: propertySummary.totalCount,
                    };
                    _summaryCopied = true;
                }
                nextPropertySummary.byBuilding[bid] = (nextPropertySummary.byBuilding[bid] || 0) + 1;
                nextPropertySummary.byBuildingLevel[bid] = { ...(nextPropertySummary.byBuildingLevel[bid] || {}) };
                nextPropertySummary.byBuildingLevel[bid][0] = (nextPropertySummary.byBuildingLevel[bid][0] || 0) + 1;
                nextPropertySummary.totalCount += 1;
            }
            investmentProfile.lastInvestmentDay = tick;
            builds[investmentDecision.buildingId] = (builds[investmentDecision.buildingId] || 0) + 1;
            _buildingsModified = true;
            console.warn('[SIM-BUILD] Official investment:', investmentDecision.buildingId, 'by', normalizedOfficial.name, 'policy:', officialPolicy);
            } // end if (investmentCost > 0)
        }

        // 代经营制下，将 pendingStateManagedBuildings 中的建筑分配给第一个代经营制官员代管
        if (isStateManagedPolicy && Object.keys(pendingStateManagedBuildings).length > 0) {
            const firstStateManagedIndex = officialList.findIndex(o => (o.propertyPolicy || 'private') === 'state_managed');
            if (firstStateManagedIndex === index) {
                if (!_managedCopied) {
                    nextManagedSummary = { byBuilding: { ...managedSummary.byBuilding }, totalCount: managedSummary.totalCount };
                    _managedCopied = true;
                }
                Object.entries(pendingStateManagedBuildings).forEach(([buildingId, count]) => {
                    nextManagedSummary.byBuilding[buildingId] = (nextManagedSummary.byBuilding[buildingId] || 0) + count;
                    nextManagedSummary.totalCount += count;
                });
            }
        }

        // 产业升级决策（高薪养廉模式下跳过）— 传入 summary 而非数组
        const upgradeDecision = isHighSalaryPolicy ? null : processOfficialBuildingUpgrade(
            { ...normalizedOfficial, wealth: currentWealth, _propertySummary: nextPropertySummary, investmentProfile },
            tick,
            officialMarketSnapshot,
            taxPolicies,
            cabinetStatus,
            builds,
            buildingUpgrades,
            difficulty,
            epoch,
            techsUnlocked
        );

        const MAX_UPGRADE_SPEND_RATIO = 0.2;
        const upgradeBudget = currentWealth * MAX_UPGRADE_SPEND_RATIO;
        if (upgradeDecision && upgradeDecision.cost <= upgradeBudget && currentWealth >= upgradeDecision.cost) {
            currentWealth = Math.max(0, currentWealth - upgradeDecision.cost);
            upgradeCost = upgradeDecision.cost;
            investmentProfile.lastUpgradeDay = tick;
            pendingOfficialUpgrades.push({
                buildingId: upgradeDecision.buildingId,
                fromLevel: upgradeDecision.fromLevel,
                toLevel: upgradeDecision.toLevel,
                officialName: normalizedOfficial.name,
                cost: upgradeDecision.cost,
            });
            if (!_summaryCopied) {
                nextPropertySummary = {
                    byBuilding: { ...propertySummary.byBuilding },
                    byBuildingLevel: { ...propertySummary.byBuildingLevel },
                    totalCount: propertySummary.totalCount,
                };
                _summaryCopied = true;
            }
            nextPropertySummary.byBuildingLevel[upgradeDecision.buildingId] = { ...(nextPropertySummary.byBuildingLevel[upgradeDecision.buildingId] || {}) };
            const levelMap = nextPropertySummary.byBuildingLevel[upgradeDecision.buildingId];
            const fromLevel = upgradeDecision.fromLevel;
            levelMap[fromLevel] = Math.max(0, (levelMap[fromLevel] || 0) - 1);
            if (levelMap[fromLevel] <= 0) delete levelMap[fromLevel];
            levelMap[upgradeDecision.toLevel] = (levelMap[upgradeDecision.toLevel] || 0) + 1;
        }

        // [DEBUG] 追踪财富变化 - 投资/升级?
        const debugAfterInvestment = currentWealth;
        const debugInvestmentCost = investmentDecision?.cost || 0;
        const debugUpgradeCost = upgradeDecision?.cost || 0;

        totalOfficialWealth += currentWealth;
        totalOfficialExpense += dailyExpense;

        // ========== 忠诚度更?==========
        let newLoyalty = normalizedOfficial.loyalty ?? 75; // 默认值兼容旧存档
        let newLowLoyaltyDays = normalizedOfficial.lowLoyaltyDays ?? 0;

        // 政治诉求满足程度
        // 注意：politicalStance 可能是字符串（stanceId）或对象，需要兼容两种情?
        const stanceId = typeof normalizedOfficial.politicalStance === 'string'
            ? normalizedOfficial.politicalStance
            : normalizedOfficial.politicalStance?.stanceId;
        // conditionParams 存储在单独字?stanceConditionParams ?
        const conditionParams = normalizedOfficial.stanceConditionParams || [];

        // 计算总影响力（从classInfluence对象累加?
        const computedTotalInfluence = Object.values(classInfluence || {}).reduce((sum, v) => sum + (v || 0), 0);

        // [FIX] 构建 classIncome 时，由于 roleWagePayout.official 在循环结束后才设置，
        // 这里需要为官员阶层使用当前官员的薪资作为预估收?
        const estimatedClassIncome = {
            ...roleWagePayout,
            // 官员收入使用当前官员的薪资（如果有支付的话）加上产业收入预估
            official: officialsPaid ? (normalizedOfficial.salary || 0) + (normalizedOfficial.lastDayPropertyIncome || 0) : 0
        };

        const stanceGameState = {
            classApproval: classApproval,
            classInfluence: classInfluence,
            classIncome: estimatedClassIncome,  // [FIX] 使用包含官员收入预估的数?
            classLivingStandard: currentClassLivingStandard || {},
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

        // 应用忠诚度变?
        const { DAILY_CHANGES, COUP_THRESHOLD, MAX, MIN } = LOYALTY_CONFIG;

        // 记录各个因素的贡献?
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
        const stabilityValue = (currentStability ?? 50) / 100; // currentStability为0-100，转为0-1
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
            // [FIX] 确保返回的财富值在安全范围?
            wealth: Math.min(MAX_WEALTH, Number.isFinite(currentWealth) ? Math.max(0, currentWealth) : 400),
            lastDayExpense: dailyExpense,
            lastDayHeadTaxPaid: headTaxPaid,
            financialSatisfaction: combinedSatisfaction,
            _propertySummary: nextPropertySummary,
            _managedSummary: nextManagedSummary,
            investmentProfile,
            lastDayPropertyIncome: isStateManagedPolicy ? managementFeeIncome : totalPropertyIncome,
            lastDayManagementFee: managementFeeIncome,
            lastDayExpenseBreakdown: expenseBreakdown,
            lastDayLuxuryExpense: luxuryExpense,
            lastDayEssentialExpense: essentialExpense,
            lastDayInvestmentCost: investmentCost,
            lastDayUpgradeCost: upgradeCost,
            lastDayNetChange: currentWealth - debugInitialWealth,
            lastDayCorruptionIncome: 0,
            // _propertySummary 已在上方设置，此处删除旧的独立字段
            // 忠诚度系?
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
    _silverCheckpoint('officialsSim');
    } else {
    // [FIX] When officialSim is skipped, restore wealth.official from individual officials
    // wealth.official was cleared to 0 at init; without this, classWealth.official stays 0 in UI
    totalOfficialWealth = updatedOfficials.reduce((sum, o) => sum + (Number.isFinite(o?.wealth) ? o.wealth : 0), 0);
    wealth.official = totalOfficialWealth;
    } // end shouldUpdateOfficials

    perfStart('livingStandards');
    const livingStandardsResult = calculateLivingStandards({
        popStructure: { ...popStructure, official: 0 }, // Exclude official to prevent double count/deduction
        wealth,
        classIncome: roleWagePayout,
        classExpense: roleExpense, // 新增：支出数?
        classShortages,
        epoch,
        techsUnlocked,
        priceMap: getPrice, // 传递价格获取函?
        livingStandardStreaks,
        needsRequirementMultiplier,
        availableResources,
    });


    // Manually inject official stats (derived from independent simulation)
    const updatedOfficialCount = updatedOfficials.length;
    if (updatedOfficialCount > 0) {
        const avgWealth = totalOfficialWealth / updatedOfficialCount;
        const officialDef = STRATA.official || {};
        const officialThresholds = calculatePriceAwareLivingStandardThresholds({
            baseNeeds: officialDef.needs || {},
            luxuryNeeds: officialDef.luxuryNeeds || {},
            priceMap: getPrice,
            epoch,
            techsUnlocked,
            needsRequirementMultiplier,
            availableResources,
        });

        const pLevel = getPriceAwareLivingStandardLevel(avgWealth, officialThresholds.thresholds, '贫困');
        const approvalCapMap = {
            '贫困': 45,
            '温饱': 60,
            '小康': 75,
            '富裕': 85,
            '奢华': 95,
        };
        const scoreMap = {
            '贫困': 25,
            '温饱': 45,
            '小康': 60,
            '富裕': 75,
            '奢华': 90,
        };
        const referenceThreshold = officialThresholds.referenceThreshold || officialDef.startingWealth || 400;
        const wealthRatio = referenceThreshold > 0 ? avgWealth / referenceThreshold : 0;
        const styleMap = {
            '奢华': { icon: 'Crown', color: 'text-purple-400' },
            '富裕': { icon: 'Gem', color: 'text-blue-400' },
            '小康': { icon: 'Home', color: 'text-green-400' },
            '温饱': { icon: 'UtensilsCrossed', color: 'text-yellow-400' },
            '贫困': { icon: 'AlertTriangle', color: 'text-orange-400' },
            '赤贫': { icon: 'Skull', color: 'text-red-500' }
        };
        const style = styleMap[pLevel] || styleMap['贫困'];

        livingStandardsResult.classLivingStandard.official = {
            level: pLevel,
            satisfaction: 1.0,
            satisfactionRate: 1.0,
            approvalCap: approvalCapMap[pLevel] || 45,
            needsMet: 1.0,
            wealthRatio: wealthRatio,
            wealthPerCapita: avgWealth,
            wealthReference: referenceThreshold,
            wealthMultiplier: Math.min(6, 1 + Math.log(Math.max(1, wealthRatio)) * 0.5),

            icon: style.icon,
            color: style.color,
            bgColor: style.color.replace('text-', 'bg-').replace('-400', '-900/20'),
            borderColor: style.color.replace('text-', 'border-').replace('-400', '-500/30'),
            score: scoreMap[pLevel] || 25,
            basketDailyCosts: officialThresholds.dailyCosts,
            basketThresholds: officialThresholds.thresholds,
            basketBufferDays: officialThresholds.bufferDays,
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

    // [NEW] 累积税收冲击值：用于防止"快速抬税后降税"的漏?
    // 当税率降低后，累积冲击会缓慢衰减，而非立即消失
    perfStart('approvalCalc');
    const updatedTaxShock = {};

    Object.keys(STRATA).forEach(key => {
        const count = popStructure[key] || 0;
        if (count === 0) return;
        const satisfactionInfo = needsReport[key];
        const satisfaction = satisfactionInfo?.satisfactionRatio ?? 1;

        // 获取生活水平对满意度的上限影?
        const livingStandard = classLivingStandard[key];
        let livingStandardApprovalCap = livingStandard?.approvalCap ?? 100;

        // 执政联盟阶层的approvalCap惩罚（期望提高）
        const isCoalition = isCoalitionMember(key, rulingCoalition);
        let coalitionCapPenalty = 0;
        if (isCoalition) {
            const livingLevel = livingStandard?.level || '温饱';
            coalitionCapPenalty = getCoalitionApprovalCapPenalty(livingLevel, true);
            livingStandardApprovalCap = Math.max(0, livingStandardApprovalCap - coalitionCapPenalty);
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
        const headTaxPerCapitaBurden = Math.max(0, (roleHeadTaxPaid[key] || 0) / Math.max(1, count));
        // [NEW] Include business tax (owners) and tariff (merchants) in tax burden
        const businessTaxPerCapitaBurden = Math.max(0, (roleBusinessTaxPaid[key] || 0) / Math.max(1, count));
        // Tariff is paid exclusively by merchants; distribute total tariff across merchant population
        const tariffPerCapitaBurden = key === 'merchant'
            ? Math.max(0, (taxBreakdown.tariff || 0) / Math.max(1, count))
            : 0;
        const taxPerCapita = headTaxPerCapitaBurden + businessTaxPerCapitaBurden + tariffPerCapitaBurden;
        const incomePerCapita = (roleWagePayout[key] || 0) / Math.max(1, count);
        const wealthPerCapita = (wealth[key] || 0) / Math.max(1, count);

        const taxBurdenFromIncome = incomePerCapita > 0.001 && taxPerCapita > incomePerCapita * 0.5;
        const canAffordFromWealth = wealthPerCapita > taxPerCapita * 100;

        if (taxBurdenFromIncome && !canAffordFromWealth) {
            targetApproval = Math.min(targetApproval, 40); // Tax burden cap
        } else if (headRate < 0.6 && businessTaxPerCapitaBurden < 0.01 && tariffPerCapitaBurden < 0.01) {
            targetApproval += 5; // Tax relief bonus (only if ALL tax types are low)
        }

        // 税收冲击：当综合税负占存款比例过高时，产生反感
        // [FIX] 使用税前存款计算税收冲击，避免"榨干后无惩罚"的漏洞
        // [ENHANCED] 纳入产业税（业主）和关税（商人），不再只看人头税
        const headTaxPaidPerCapita = (roleHeadTaxPaid[key] || 0) / Math.max(1, count);
        const totalTaxPaidPerCapita = headTaxPaidPerCapita + businessTaxPerCapitaBurden + tariffPerCapitaBurden;
        // 税前人均存款用于TaxShock计算
        const preTaxWealthPerCapita = (preTaxWealth[key] || 0) / Math.max(1, count);
        // 综合税收占存款的比例（每天总税负 / 税前人均存款）
        const taxToWealthRatio = preTaxWealthPerCapita > 0.01 ? totalTaxPaidPerCapita / preTaxWealthPerCapita : 0;
        // 当税收超过存款的5%时开始产生冲击，超过20%时达到最大惩?
        // [ENHANCED] 最大惩罚从25提升?0，更严厉惩罚压榨行为
        // 5%以下无惩罚，5%-20%线性增长到25?0%-100%继续增长?0
        const taxShockThreshold = 0.05; // 5%阈?
        const taxShockMaxRatio = 0.20;  // 20%达到中等惩罚
        const taxShockExtremeRatio = 1.0; // 100%达到最大惩?
        let instantTaxShock = 0;
        if (taxToWealthRatio > taxShockThreshold && totalTaxPaidPerCapita > 0) {
            if (taxToWealthRatio <= taxShockMaxRatio) {
                // 5%-20%: 0-25分线性增?
                instantTaxShock = ((taxToWealthRatio - taxShockThreshold) / (taxShockMaxRatio - taxShockThreshold)) * 25;
            } else {
                // 20%-100%: 25-50分线性增?
                instantTaxShock = 25 + Math.min(25, ((taxToWealthRatio - taxShockMaxRatio) / (taxShockExtremeRatio - taxShockMaxRatio)) * 25);
            }
        }

        // [NEW] 累积税收冲击机制：防?快速抬税后降税"的漏?
        // 原理：民众对被剥削的记忆不会因税率降低而立即消?
        // - 当前冲击会累加到历史累积?
        // - 历史累积值每tick衰减一定比例（模拟愤怒逐渐平息?
        // - 最终惩罚取当前冲击和累积冲击的较大?
        const prevAccumulatedShock = previousTaxShock[key] || 0;
        const taxShockDecayRate = 0.03; // 每tick衰减3%（约需23天衰?0%?
        const taxShockAccumulationRate = 0.5; // 当前冲击?0%会累加到历史?

        // 累积公式：旧累积 * (1 - 衰减? + 新冲?* 累积?
        const newAccumulatedShock = Math.max(0,
            prevAccumulatedShock * (1 - taxShockDecayRate) + instantTaxShock * taxShockAccumulationRate
        );
        updatedTaxShock[key] = newAccumulatedShock;

        // 最终惩罚：取即时冲击和累积冲击的较大?
        // 这确保了?
        // 1. 高税期间：即时冲击占主导
        // 2. 降税后：累积冲击继续生效，逐渐衰减
        const taxShockPenalty = Math.max(instantTaxShock, newAccumulatedShock);

        // Resource Shortage Logic - 区分基础需求和奢侈需求短?
        const shortages = classShortages[key] || [];
        const basicShortages = shortages.filter(s => s.isBasic);
        const luxuryShortages = shortages.filter(s => !s.isBasic);
        const totalNeeds = satisfactionInfo?.totalTrackedNeeds ?? 0;

        // 基础需求短?- 严重惩罚
        if (basicShortages.length > 0 && totalNeeds > 0) {
            if (basicShortages.length >= Object.keys(STRATA[key]?.needs || {}).length) {
                // 所有基础需求都短缺 ?上限0
                targetApproval = Math.min(targetApproval, 0);
            } else {
                // 部分基础需求短缺 上限30
                targetApproval = Math.min(targetApproval, 30);
            }
        }

        // 奢侈需求短缺 - 较轻惩罚，与缺少数量相关
        // 每缺一种奢侈品，惩罚3，最多惩罚15
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
            stanceTargetBonus: 0,
            ideologyTargetBonus: 0,
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
            isCoalition: isCoalition,
            coalitionCapPenalty: coalitionCapPenalty,
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

        const stanceApprovalBonus = bonuses.stanceApprovalEffects?.[key] || 0;
        if (stanceApprovalBonus) {
            targetApproval += stanceApprovalBonus;
            approvalBreakdown[key].stanceTargetBonus = stanceApprovalBonus;
        }

        const ideologyApprovalBonus = bonuses.approvalEffects?.[key] || 0;
        if (ideologyApprovalBonus) {
            targetApproval += ideologyApprovalBonus;
            approvalBreakdown[key].ideologyTargetBonus = ideologyApprovalBonus;
        }

        const officialBonus = activeOfficialEffects?.approval?.[key] || 0;
        if (officialBonus) {
            targetApproval += officialBonus;
            approvalBreakdown[key].officialTargetBonus = officialBonus;
        }

        // [FIX] 非法政府惩罚：使用上一tick的合法性来影响目标满意?
        // 而不是在惯性计算之后直接扣除当前好感度（这会导致无限下降的BUG?
        const prevLegitimacyModifier = getLegitimacyApprovalModifier(previousLegitimacy);
        if (prevLegitimacyModifier < 0) {
            targetApproval += prevLegitimacyModifier;  // 应用到目标，通过惯性缓慢影?
            approvalBreakdown[key].legitimacyPenalty = prevLegitimacyModifier;
        }

        // Effective cap (negative official bonus reduces cap)
        let effectiveApprovalCap = livingStandardApprovalCap;
        if (stanceApprovalBonus < 0) {
            effectiveApprovalCap = Math.max(0, effectiveApprovalCap + stanceApprovalBonus);
        }
        if (ideologyApprovalBonus < 0) {
            effectiveApprovalCap = Math.max(0, effectiveApprovalCap + ideologyApprovalBonus);
        }
        if (officialBonus < 0) {
            effectiveApprovalCap = Math.max(0, effectiveApprovalCap + officialBonus);
        }
        approvalBreakdown[key].effectiveApprovalCap = effectiveApprovalCap;

        const persistedApproval = previousApproval?.[key] ?? classApproval[key] ?? 50;
        let currentApproval = persistedApproval;
        approvalBreakdown[key].currentApprovalStart = currentApproval;
        approvalBreakdown[key].adjustmentSpeed = 0.02;

        // Tax shock (applies to current approval, and may apply an extra cap)
        if (taxShockPenalty > 1) {
            currentApproval = Math.max(0, currentApproval - taxShockPenalty);
            approvalBreakdown[key].taxShockPenalty = -taxShockPenalty;

            // [ENHANCED] 冲击越大上限越低，最低可?（极端压榨将引发彻底反感?
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

    if (updatedOfficials.length > 0) {
        const averageOfficialLoyalty = updatedOfficials.reduce((sum, official) => {
            return sum + Math.max(0, Math.min(100, official?.loyalty ?? 75));
        }, 0) / updatedOfficials.length;
        const officialApproval = Math.max(0, Math.min(100, averageOfficialLoyalty));
        classApproval.official = officialApproval;
        if (approvalBreakdown.official) {
            approvalBreakdown.official.currentApprovalStart = previousApproval?.official ?? officialApproval;
            approvalBreakdown.official.targetApprovalPreShockCap = officialApproval;
            approvalBreakdown.official.targetApprovalFinal = officialApproval;
            approvalBreakdown.official.inertiaDelta = officialApproval - approvalBreakdown.official.currentApprovalStart;
            approvalBreakdown.official.effectiveApprovalCap = 100;
            approvalBreakdown.official.capApplied = null;
            approvalBreakdown.official.approvalAfterCap = officialApproval;
            approvalBreakdown.official.approvalFinal = officialApproval;
        }
    }

    if ((popStructure.unemployed || 0) === 0 && previousApproval.unemployed !== undefined) {
        classApproval.unemployed = Math.min(100, previousApproval.unemployed + 5);
    }
    perfEnd('socialEconomy');
    perfEnd('approvalCalc');
    _silverCheckpoint('socialEconomy+approvalCalc');


    let nextPopulation = population;
    let raidPopulationLoss = 0;

    // 富裕性挥霍 / Wealth Decay 机制已废弃：
    // 历史上此处会按生活水平对高净值阶层施加 0.1%~0.5% 的每日财富蒸发，
    // 对应 UI 中的“富裕性挥霍”。该设计已被取消，阶层财富只通过消费、税收、
    // 投资等真实资金流动变化，不再凭空销毁。

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

    // 执政联盟合法性精确计算（影响力已计算完成?
    const coalitionInfluenceShare = calculateCoalitionInfluenceShare(rulingCoalition, classInfluence, totalInfluence);
    coalitionLegitimacy = calculateLegitimacy(coalitionInfluenceShare);
    if (bonuses.legitimacyBonus) {
        coalitionLegitimacy = Math.max(0, Math.min(100, coalitionLegitimacy * (1 + bonuses.legitimacyBonus)));
    }
    legitimacyTaxModifier = getLegitimacyTaxModifier(coalitionLegitimacy);
    const legitimacyApprovalModifier = getLegitimacyApprovalModifier(coalitionLegitimacy);
    perfEnd('influenceCalc');

    // [FIX BUG] 非法政府满意度惩罚的应用方式已改变：
    // 之前?BUG: 每个 tick 都直接从当前好感度扣?-15，导致无限下?
    // 修复: 惩罚已在上方惯性计算循环中应用?targetApproval，这里不再重复应?
    // 保留此处代码注释以说明设计意?
    // NOTE: legitimacyApprovalModifier 现在应该?approvalBreakdown 中体现（需要在上方循环添加?

    // [PERF] 人口外流属于deferred级，按配置频率执行
    // extraStabilityPenalty 在守卫外声明，确保 stabilityCalc 可安全引用
    let extraStabilityPenalty = 0;
    if (bonuses.factionConflict) {
        extraStabilityPenalty += bonuses.factionConflict;
    }
    const shouldUpdateExodus = shouldRunThisTick(tick, 'exodus');
    if (shouldUpdateExodus) {
    perfStart('exodusAndPenalties');
    let exodusPopulationLoss = 0;
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

                // [FIX] 同步更新popStructure，确保人口真正从该阶层移?
                // 这样房屋/岗位才能空出来被新人填补
                popStructure[key] = Math.max(0, count - leaving);
            }
            exodusPopulationLoss += leaving;

            // 生成详细的短缺原因日?
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
            }).join(', ');

            const shortageMsg = shortageDetails ? `，短缺资源：${shortageDetails}` : '';
            logs.push(`${className} 阶层对政局失望，${leaving} 人离开了国家，带走${(leaving * (wealth[key] || 0) / Math.max(1, count)).toFixed(1)} 银币${shortageMsg}。`);
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
            }).join(', ');

            const shortageMsg = shortageDetails ? `（短缺：${shortageDetails}）` : '';
            logs.push(`${className} 阶层的愤怒正在削弱社会稳定${shortageMsg}。`);
        }
    });
    perfEnd('exodusAndPenalties');
    } // end shouldUpdateExodus

    perfStart('buffsDebuffs');
    const newActiveBuffs = [];
    const newActiveDebuffs = [];

    // 保留外部注入的限时 buff（如理念事件），并在每日结算后递减持续时间
    (productionBuffs || []).forEach((buff) => {
        if (!buff || !Number.isFinite(buff.duration)) return;
        const nextDuration = Math.floor(buff.duration) - 1;
        if (nextDuration > 0) {
            newActiveBuffs.push({
                ...buff,
                duration: nextDuration,
            });
        }
    });

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
        stabilityBonus: bonuses.stabilityBonus || 0,
        stabilityFlat: bonuses.stabilityFlat || 0
    });
    perfEnd('buffsDebuffs');
    perfEnd('stabilityCalc');

    // [PERF] Tick预算保护：critical级分段全部完成，检查已用时间
    // 如果超过预算上限，后续deferred/batch级操作将被自动跳过
    checkTickBudget();

    const visibleEpoch = epoch;
    // 记录本回合来自战争赔款（含分期）的财政收?
    let warIndemnityIncome = 0;
    const playerPopulationBaseline = Math.max(5, population || 5);
    const playerWealthBaseline = calculatePlayerComparableWealth(res, classWealth);

    // Track global peace request cooldown - find the most recent peace request across all nations
    // This prevents multiple AI nations from spamming peace requests simultaneously
    let lastGlobalPeaceRequest = -Infinity;
    const shouldUpdatePrices = shouldRunThisTick(tick, 'priceUpdate');
    const shouldUpdateTrade = shouldRunThisTick(tick, 'tradeUpdate');
    const shouldUpdateDiplomacy = shouldRunThisTick(tick, 'diplomacyUpdate');
    const shouldUpdateAI = shouldRunThisTick(tick, 'aiDecision');
    const shouldUpdateMerchantTrade = shouldRunThisTick(tick, 'merchantTrade');
    // [PERF] deferred级频率守卫
    const shouldUpdateRebellion = shouldRunThisTick(tick, 'rebellion');
    const shouldUpdatePriceConvergence = shouldRunThisTick(tick, 'priceConvergence');
    (nations || []).forEach(n => {
        if (n.lastPeaceRequestDay && n.lastPeaceRequestDay > lastGlobalPeaceRequest) {
            lastGlobalPeaceRequest = n.lastPeaceRequestDay;
        }
    });

    let updatedOrganizations = diplomacyOrganizations?.organizations ? [...diplomacyOrganizations.organizations] : [];
    const diplomacyState = {
        ...(diplomacyOrganizations || {}),
        organizations: updatedOrganizations,
    };
    let organizationUpdatesOccurred = false;

    perfStart('aiNationUpdate');
    // [PERF] 动态分片：当AI国家>10时自动增大分片数，确保每tick只处理约4个AI国家的完整逻辑
    const aliveNationCount = (nations || []).filter(n => !n.isAnnexed && (n.population || 0) > 0 && n.id !== 'player').length;
    const aiSliceCount = aliveNationCount > 10
        ? Math.max(4, Math.ceil(aliveNationCount / 4))
        : Math.max(1, RATE_LIMIT_CONFIG.aiNationUpdateSlices || 1);
    const aiTargets = getSlice(nations || [], aiSliceCount);
    const aiTargetIds = new Set(aiTargets.map(n => n?.id));

    // [DEBUG] Log input nations array
    // (nations || []).forEach(n => {
    //     console.log(`[Input Nations] ${n.name}: pop=${n.population}, wealth=${n.wealth}, ownBasePop=${n.economyTraits?.ownBasePopulation}, vassalOf=${n.vassalOf}`);
    // });

    let updatedNations = (nations || []).map(nation => {
        const shouldProcessAIForNation = nation.id === 'player' || aiTargetIds.has(nation.id);

        // [PERF] 对未出现或已灭亡的国家跳过浅拷贝，直接返回原引用
        const hasAppeared = visibleEpoch >= (nation.appearEpoch ?? 0);
        if (!hasAppeared) {
            // 未出现国家不参与模拟，直接返回（保留原引用）
            return nation;
        }
        // 已出现但未被玩家发现的国家：仅执行最小化后台增长
        if (isAppearedButUndiscovered(nation, visibleEpoch) && !nation.isRebelNation) {
            const undiscNext = { ...nation };
            // 最小化后台人口增长
            if (undiscNext.population > 0) {
                undiscNext.population = Math.floor(undiscNext.population * (1 + 0.0005));
            }
            // 最小化后台财富增长
            if (undiscNext.wealth > 0) {
                undiscNext.wealth = Math.floor(undiscNext.wealth * (1 + 0.0003));
            }
            return undiscNext;
        }
        const isDestroyedNation = nation.isAnnexed || (nation.population || 0) <= 0;
        if (isDestroyedNation) {
            // [PERF] Defeated nations: return minimal stub to save memory.
            // Only keep essential identification fields and clear war state.
            return {
                id: nation.id,
                name: nation.name,
                isDefeated: true,
                isAnnexed: nation.isAnnexed || false,
                discovered: nation.discovered ?? false,
                population: 0,
                wealth: 0,
                relation: nation.relation || 0,
                vassalOf: nation.vassalOf || null,
                isRebelNation: nation.isRebelNation || false,
                appearEpoch: nation.appearEpoch,
                expireEpoch: nation.expireEpoch,
                isAtWar: false,
                foreignWars: {},
                installmentPayment: null,
            };
        }

        // 以下为正常国家，需要浅拷贝
        const next = { ...nation };

        // [UI COMPATIBILITY] Derive alliedWithPlayer from organization membership
        next.alliedWithPlayer = updatedOrganizations.some(org =>
            org.type === 'military_alliance' &&
            org.members.includes(nation.id) &&
            org.members.includes('player')
        );

        // 过期国家（已出现但已过期）：仅清理战争状态
        const isExpiredNation = nation.expireEpoch != null && visibleEpoch > nation.expireEpoch;
        if (isExpiredNation && next.isAtWar) {
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

        if (!isExpiredNation) {
            processNationTreaties({ nation: next, tick, resources: res, logs, onTreasuryChange: trackSilverChange, playerWealth: res.silver || 0 });
        }

        if (next.isRebelNation) {
            // REFACTORED: Using module function for rebel economy initialization
            initializeRebelEconomy(next);

            // REFACTORED: Using module function for rebel war actions
            // 如果该叛军与玩家之间已有活跃战线，则由战线系统处理掠夺，跳过旧突袭逻辑
            if (next.isAtWar) {
                const rebelFronts = (activeFronts || []).filter(f =>
                    f?.status === 'active' && (f.attackerId === next.id || f.defenderId === next.id)
                );
                if (rebelFronts.length > 0) {
                    // 将战线战争分数同步到 nation.warScore
                    const totalFrontWarScore = rebelFronts.reduce((sum, f) => sum + getEffectiveFrontWarScore(f), 0);
                    next.warScore = totalFrontWarScore;
                } else {
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
            next.budget = Math.max(50, baseWealthInit * calculateAITreasuryTargetRatio({
                wealth: baseWealthInit,
                population: basePopInit,
                epoch: next.epoch || visibleEpoch || 0,
                isAtWar: false,
                aggression: next.aggression || 0.3,
                capacityUsage: 0.55,
                developmentRate: next.economyTraits?.developmentRate || 1.0,
            }));
            next.economyTraits = {
                ...(next.economyTraits || {}),
                ownBasePopulation: basePopInit,
                ownBaseWealth: baseWealthInit,
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

        // 为和平期/未参战的国家补建一次常规建筑画像，避免外交面板只能看到外资建筑?
        if (!isExpiredNation && !next.isRebelNation && (!next.virtualBuildings || Object.keys(next.virtualBuildings).length === 0)) {
            generateAIBuildingProfile(next, next.epoch || visibleEpoch || epoch || 0, {
                overseasInvestments: updatedOverseasInvestments,
            });
        }

        if (!isExpiredNation && !next.isRebelNation) {
            // --- 计算AI国家的战线入侵深度，供经济增长系统使用 ---
            let maxHomelandPressure = 0;
            if (next.isAtWar && activeFronts) {
                activeFronts.forEach(f => {
                    if (f?.status !== 'active') return;
                    const isAttacker = f.attackerId === next.id;
                    const isDefender = f.defenderId === next.id;
                    if (!isAttacker && !isDefender) return;
                    const linePos = Number(f.linePosition || 50);
                    // AI作为攻击方: linePosition<50表示被入侵; AI作为防御方: linePosition>50表示被入侵
                    const pressure = isAttacker
                        ? Math.max(0, (50 - linePos) / 45)
                        : Math.max(0, (linePos - 50) / 45);
                    if (pressure > maxHomelandPressure) maxHomelandPressure = pressure;
                });
            }
            next._warHomelandPressure = maxHomelandPressure;

            const migratedNation = migrateNationEconomy(next);
            const updatedNation = AIEconomyService.update({
                nation: migratedNation,
                tick,
                epoch: migratedNation.epoch || 0,
                difficulty,
                playerPopulation: playerPopulationBaseline,
                playerWealth: playerWealthBaseline,
                playerPerCapitaWealth: playerPopulationBaseline > 0
                    ? playerWealthBaseline / playerPopulationBaseline
                    : 0,
                gameSpeed,
                allowHeavyUpdate: shouldProcessAIForNation,
            });
            Object.assign(next, updatedNation);
            // [FIX] Re-write _warHomelandPressure after Object.assign overwrites it
            // AIEconomyService.update returns state.toLegacyFormat() which doesn't include _warHomelandPressure
            next._warHomelandPressure = maxHomelandPressure;
        }

        if (!shouldProcessAIForNation) {
            // 即使不在当前分片，战线被推到极端位置（85%+）时也必须强制求和
            if (next.isAtWar && !isExpiredNation && shouldUpdateAI) {
                const emergencyFronts = (activeFronts || []).filter(f =>
                    f?.status === 'active' && (f.attackerId === next.id || f.defenderId === next.id)
                );
                if (emergencyFronts.length > 0) {
                    const avgPos = emergencyFronts.reduce((sum, f) => {
                        const s = f.attackerId === next.id ? 'attacker' : 'defender';
                        return sum + (s === 'attacker' ? Number(f.linePosition || 50) : 100 - Number(f.linePosition || 50));
                    }, 0) / emergencyFronts.length;
                    if (avgPos <= 15) {
                        checkAIPeaceRequest({ nation: next, tick, lastGlobalPeaceRequest, logs, activeFronts });
                    }
                }
            }
            return next;
        }

        if (!isExpiredNation && !next.isRebelNation) {
            // AI building peacetime recovery (every 30 days, only for nations with virtualBuildings)
            processAIBuildingRecovery(next, next.epoch || epoch, tick);

            // Check for epoch progression
            const prevEpoch = next.epoch;
            checkAIEpochProgression(next, logs, tick);

            // AI 升时代后标记，用于后续触发发现机制
            if (next.epoch !== prevEpoch) {
                next._epochJustUpgraded = next.epoch;
            }

            // 时代升级后重新规划建筑配比
            if (next._needsBuildingReplan) {
                generateAIBuildingProfile(next, next.epoch || visibleEpoch || epoch || 0, {
                    overseasInvestments: updatedOverseasInvestments,
                });
                delete next._needsBuildingReplan;
            }
        }
        if (next.isAtWar && !isExpiredNation) {
            next.warDuration = (next.warDuration || 0) + 1;
            // 累计与该国战争期间的军费支出（用于战争赔款计算）
            // 注意：如果同时与多个国家交战，军费按国家数量分摊
            const warringNationsCount = (nations || []).filter(n => n.isAtWar).length || 1;
            const dailyExpenseShare = (armyExpenseResult?.dailyExpense || 0) / warringNationsCount;
            next.warTotalExpense = (next.warTotalExpense || 0) + dailyExpenseShare;

            if (visibleEpoch >= 1 && shouldUpdateAI) {
                // 如果该国与玩家之间已有活跃战线，则由战线系统处理，跳过旧突袭逻辑
                const nationFronts = (activeFronts || []).filter(f =>
                    f?.status === 'active' && (f.attackerId === next.id || f.defenderId === next.id)
                );
                if (nationFronts.length > 0) {
                    // 将战线战争分数同步到 nation.warScore（取所有战线的加权和）
                    // 战线 warScore 正?玩家优势，与 nation.warScore 方向一?
                    const totalFrontWarScore = nationFronts.reduce((sum, f) => sum + getEffectiveFrontWarScore(f), 0);
                    next.warScore = totalFrontWarScore;
                } else {
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
            }
            // REFACTORED: Using module function for AI peace request check
            // Pass global cooldown to prevent multiple nations from requesting peace simultaneously
            if (shouldUpdateAI) {
                const peaceRequested = checkAIPeaceRequest({ nation: next, tick, lastGlobalPeaceRequest, logs, activeFronts });
                if (peaceRequested) {
                    lastGlobalPeaceRequest = tick; // Update global cooldown for subsequent nations
                }

                // REFACTORED: Using module function for AI surrender demand check
                // 传入玩家财富，使赔款计算与玩家主动求和时一?
                checkAISurrenderDemand({ nation: next, tick, population, playerWealth: playerWealthBaseline, logs, activeFronts });

                // Check if AI should offer unconditional peace when player is in desperate situation
                checkMercyPeace({ nation: next, tick, population, playerWealth: playerWealthBaseline, resources: res, logs, activeFronts });
            }
        } else if (next.warDuration) {
            next.warDuration = 0;
            next.warTotalExpense = 0; // 清除战争军费记录
        }
        const relation = next.relation ?? 50;

        // REFACTORED: Using module function for relation decay
        if (shouldUpdateDiplomacy && !isExpiredNation) {
            processNationRelationDecay(next, difficulty);
        }

        const relationMultipliers = getRelationChangeMultipliers(difficulty);

        if (!isExpiredNation && bonuses.diplomaticIncident && !next.isRebelNation && !next.isAtWar) {
            // On hard: worsening is easier
            const dailyPenalty = (bonuses.diplomaticIncident / 30) * relationMultipliers.bad;
            next.relation = Math.min(100, Math.max(0, (next.relation ?? 50) - dailyPenalty));
        }

        // 应用官员和政治立场的外交加成到玩家与AI的关?
        if (!isExpiredNation && bonuses.diplomaticBonus && !next.isRebelNation && !next.isAtWar) {
            // On hard: improving is harder
            const dailyBonus = (bonuses.diplomaticBonus / 30) * relationMultipliers.good;
            next.relation = Math.min(100, Math.max(0, (next.relation ?? 50) + dailyBonus));
        }

        // REFACTORED: Using module function for AI alliance breaking check
        if (shouldUpdateDiplomacy && !isExpiredNation) {
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
        if (shouldUpdateAI && !isExpiredNation) {
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
        if (!isExpiredNation) {
            warIndemnityIncome += processInstallmentPayment({
                nation: next,
                resources: res,
                logs,
                onTreasuryChange: trackSilverChange,
            });
        }

        // REFACTORED: Using module function for post-war recovery
        if (!isExpiredNation) {
            processPostWarRecovery(next);
        }

        return next;
    });
    perfEnd('aiNationUpdate');
    _silverCheckpoint('aiNationUpdate');

    // AI 升时代后触发发现机制：为升时代的 AI 国家发现部分同时代国家
    updatedNations.forEach(nation => {
        if (nation._epochJustUpgraded != null) {
            discoverNationsOnEpochChange({
                nations: updatedNations,
                newEpoch: nation._epochJustUpgraded,
                logs,
                discoverer: nation.id,
            });
            delete nation._epochJustUpgraded;
        }
    });

    // REFACTORED: Using module function for foreign relations initialization
    updatedNations = initializeForeignRelations(updatedNations);

    // 渐进式国家发现：逐步发现机制（tick 驱动）
    if (tick % DISCOVERY_CONFIG.GRADUAL_DISCOVERY_TICK_INTERVAL === 0) {
        processGradualDiscovery({
            nations: updatedNations,
            tick,
            epoch: visibleEpoch,
            navigatorPop: population?.navigator || 0,
            logs,
        });
        // AI 国家间逐步发现
        updatedNations.forEach(nation => {
            if (nation.id === 'player' || nation.isAnnexed || nation.isRebelNation) return;
            if (visibleEpoch < (nation.appearEpoch ?? 0)) return;
            processAINationDiscovery({
                nation,
                allNations: updatedNations,
                tick,
                epoch: visibleEpoch,
            });
        });
    }

    // REFACTORED: Using module function for monthly relation decay
    const isMonthTick = tick % 30 === 0;
    if (isMonthTick && shouldUpdateDiplomacy) {
        perfStart('monthlyRelationDecay');
        // [FIX Bug10] 传入组织信息，确保组织盟友也享受关系衰减保护
        updatedNations = processMonthlyRelationDecay(updatedNations, difficulty, { organizations: updatedOrganizations });
        perfEnd('monthlyRelationDecay');
    }

    // ========================================================================
    // [PERFORMANCE OPTIMIZATION] Periodic cleanup of destroyed nations
    // Remove annexed nations with zero population every 100 days to reduce memory usage
    // ========================================================================
    const isCleanupTick = tick % 100 === 0;
    let cleanedNationIds = null;
    if (isCleanupTick) {
        const beforeCount = updatedNations.length;
        const removedIds = new Set();
        updatedNations = updatedNations.filter(n => {
            if (n.id === 'player') return true;
            if ((n.isAnnexed && (n.population || 0) <= 0) || (n.isDefeated && n.isAnnexed)) {
                removedIds.add(n.id);
                return false;
            }
            return true;
        });
        if (removedIds.size > 0) {
            // 清理存活国家的 foreignRelations 中对已删国家的残留引用
            updatedNations = updatedNations.map(n => {
                if (!n.foreignRelations) return n;
                const cleanedRelations = {};
                let changed = false;
                for (const [key, val] of Object.entries(n.foreignRelations)) {
                    if (removedIds.has(key)) { changed = true; continue; }
                    cleanedRelations[key] = val;
                }
                return changed ? { ...n, foreignRelations: cleanedRelations } : n;
            });
            // 清理 overseasInvestments 中指向被删国家的投资
            if (Array.isArray(updatedOverseasInvestments)) {
                updatedOverseasInvestments = updatedOverseasInvestments.filter(inv =>
                    !removedIds.has(inv.targetNationId) && !removedIds.has(inv.ownerNationId)
                );
            }
            cleanedNationIds = [...removedIds];
            logs.push(`♻️ 系统清理：移除了 ${removedIds.size} 个已消失的国家及其关联数据。`);
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

        // 扣除组织成员?
        if (organizationUpdateResult.fees.player > 0) {
            const feeToDeduct = Math.min(res.silver || 0, organizationUpdateResult.fees.player);
            if (feeToDeduct > 0) {
                applySilverChange(-feeToDeduct, 'organization_membership_fee');
            }
        }

        // 更新AI国家的费?
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
    if (shouldUpdateRebellion) {
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
                        logs.push(`🏴 ${event.nationName} 的叛军取得胜利，政权更迭！${event.newGovernment || '新政权'}！`);
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
        hasIndependenceSupport: false,  // TODO: 可以检查是否有支持独立的势?
    };

    const vassalSliceCount = Math.max(1, RATE_LIMIT_CONFIG.vassalUpdateSlices || 1);
    const vassalNations = updatedNations.filter(n => n.vassalOf === 'player');
    const vassalTargets = getSlice(vassalNations, vassalSliceCount);
    const vassalTargetIds = vassalTargets.map(v => v.id);

    // Now update economy data with the grown population/wealth values
    // [FIX] Only process vassals in vassalTargetIds to match the growth logic
    // [FIX] DO NOT call initializeNationEconomyData as it creates a new object and loses growth values
    updatedNations = updatedNations.map(nation => {
        if (nation.vassalOf !== 'player' || !vassalTargetIds.includes(nation.id)) return nation;

        // [DEBUG] Log input values before updateNationEconomyData
        // console.log(`[Before EconomyData] ${nation.name}: pop=${nation.population}, wealth=${nation.wealth}`);

        // [FIX] Directly call updateNationEconomyData without initialization to preserve growth values
        const result = updateNationEconomyData(nation, vassalMarketPrices, satisfactionContext);

        // // [DEBUG] Log population after updateNationEconomyData
        // if (tick % 10 === 0 && nation.name) {
        //     console.log(`[After EconomyData] ${nation.name}: pop ${nation.population}->${result.population}`);
        // }

        return result;
    });

    if (tick % 10 === 0 && isDebugEnabled('vassal')) {
        vassalTargetIds.forEach(vassalId => {
            const vassal = updatedNations.find(n => n.id === vassalId);
            if (vassal) {
                debugLog('vassal', `[Before Process] ${vassal.name}: pop=${vassal.population}, wealth=${vassal.wealth}`);
            }
        });
    }

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

    if (tick % 10 === 0 && isDebugEnabled('vassal')) {
        vassalTargetIds.forEach(vassalId => {
            const before = updatedNations.find(n => n.id === vassalId);
            const after = vassalResult.nations.find(n => n.id === vassalId);
            if (before && after && (before.wealth !== after.wealth || before.population !== after.population)) {
                debugLog('vassal', `[Vassal After Process] ${after.name}: pop ${before.population}->${after.population}, wealth ${before.wealth}->${after.wealth}`);
            }
        });
    }

    updatedNations = vassalResult.nations;

    if (tick % 10 === 0 && isDebugEnabled('vassal')) {
        vassalTargetIds.forEach(vassalId => {
            const vassal = updatedNations.find(n => n.id === vassalId);
            if (vassal) {
                debugLog('vassal', `[Vassal Final State] ${vassal.name}: pop=${vassal.population}, wealth=${vassal.wealth}`);
            }
        });
    }

    if (vassalResult.tributeIncome > 0) {
        applySilverChange(vassalResult.tributeIncome, 'vassal_tribute_income');
    }

    // [FIX] 朝贡全量结算：对未被本轮分片选中的附庸，单独计算并结算朝贡
    // 分片更新只处理部分附庸的经济/独立性，但朝贡是每日财政收入，必须全量结算
    const unprocessedVassals = vassalNations.filter(v => !vassalTargetIds.includes(v.id));
    if (unprocessedVassals.length > 0) {
        let extraTributeIncome = 0;
        unprocessedVassals.forEach(vassal => {
            const tribute = calculateEnhancedTribute(vassal);
            if (tribute.silver > 0) {
                extraTributeIncome += tribute.silver;
            }
        });
        if (extraTributeIncome > 0) {
            applySilverChange(extraTributeIncome, 'vassal_tribute_income');
        }
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

    // ========================================================================
    // PRICE CONVERGENCE DAILY UPDATE (Phase 4.2 Integration)
    // Process market price convergence for free trade agreement nations
    // ========================================================================
    let priceConvergenceResult = null;
    if (shouldUpdatePriceConvergence && market?.prices) {
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

    // [FIX] Filter visible nations AFTER all nation object replacements
    // This ensures visibleNations holds references to the current updatedNations objects,
    // so modifications in processAIPlayerInteraction will be persisted correctly
    const visibleNations = updatedNations.filter(n =>
        isNationVisible(n, epoch)
        && !n.isRebelNation
    );
    // [PERF] 动态分片：外交AI根据国家数量动态调整
    const diplomacySliceCount = aliveNationCount > 10
        ? Math.max(4, Math.ceil(aliveNationCount / 4))
        : Math.max(1, RATE_LIMIT_CONFIG.diplomacyUpdateSlices || 1);
    const diplomacyTargets = getSlice(visibleNations, diplomacySliceCount);

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
        processAIPlayerTrade(diplomacyTargets, tick, res, market, logs, policies, diplomacyOrganizations, trackSilverChange, demandBreakdown, supplyBreakdown);
    }


    // REFACTORED: Using module function for AI-Player interaction
    // Pass allVisibleNations for global gift cooldown calculation (fixes spam gifts bug)
    if (shouldUpdateDiplomacy) {
        processAIPlayerInteraction(diplomacyTargets, tick, epoch, logs, visibleNations, diplomacyState);
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
                    const maxMembers = getOrganizationMaxMembers(org.type, visibleEpoch);
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
                        // Check if the leaving member is the founder
                        const isFounder = org.founderId === req.nationId;
                        const config = ORGANIZATION_TYPE_CONFIGS[org.type];
                        const willDisband = isFounder && (config?.founderLeaveDisbands !== false);

                        if (willDisband) {
                            // Founder leaving - mark organization for removal
                            updatedOrganizations[orgIndex] = {
                                ...org,
                                members: org.members.filter(m => m !== req.nationId),
                                isActive: false,
                                disbandReason: 'founder_left',
                            };
                            logs.push(`🏛️ "${org.name}" 因创始国退出而解散。`);
                        } else {
                            // Regular member leaving
                            updatedOrganizations[orgIndex] = {
                                ...org,
                                members: org.members.filter(m => m !== req.nationId),
                            };
                        }
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
                    logs.push(`🏛️ "${org.name}" 清理了${removedCount} 个已消失的成员国。`);
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

            // Check if organization is marked as inactive (e.g., founder left)
            if (org.isActive === false && !keepSoloPlayerOrg) {
                const reason = org.disbandReason || '未知原因';
                // Only log if not already logged
                if (reason !== 'founder_left') {
                    logs.push(`🏛️ "${org.name}" 因${reason}而解散。`);
                }
                organizationUpdatesOccurred = true;
                return;
            }

            // Check other disband conditions
            if (shouldDisbandOrganization(org, validNationIds) && !keepSoloPlayerOrg) {
                // Determine disband reason for better logging
                const config = ORGANIZATION_TYPE_CONFIGS[org.type];
                const founderExists = org.founderId ? validNationIds.has(org.founderId) : true;
                const memberCount = org.members?.length || 0;

                let reason = '未知原因';
                if (!founderExists) {
                    reason = '创始国已消亡';
                } else if (memberCount < (config?.minMembers || 2)) {
                    reason = '成员不足';
                }

                logs.push(`🏛️ "${org.name}" 因${reason}而解散。`);
                organizationUpdatesOccurred = true;
                return;
            }
            filteredOrgs.push(org);
        });
        updatedOrganizations = filteredOrgs;

        // [NEW] Clean up treaties with annexed/destroyed nations
        // This prevents treaties from persisting with non-existent nations
        updatedNations = updatedNations.map(nation => {
            if (!nation.treaties || nation.treaties.length === 0) return nation;

            const originalTreatyCount = nation.treaties.length;
            const cleanedTreaties = nation.treaties.filter(treaty => {
                // Keep treaty only if both parties exist
                if (treaty.direction === 'player_to_ai') {
                    // Treaty with player, keep it if nation exists
                    return validNationIds.has(nation.id);
                } else if (treaty.direction === 'ai_to_player') {
                    // Treaty from nation to player, always keep (player always valid)
                    return true;
                } else {
                    // Treaty between two nations, check if both exist
                    // For now, we assume if nation still exists, treaty is valid
                    return true;
                }
            });

            if (cleanedTreaties.length < originalTreatyCount) {
                const removedCount = originalTreatyCount - cleanedTreaties.length;
                logs.push(`📜 ${nation.name} 因条约对方消亡，清理了${removedCount} 个条约。`);
            }

            return {
                ...nation,
                treaties: cleanedTreaties,
            };
        });
    }


    // REFACTORED: Using module functions for AI-AI war system
    if (shouldUpdateAI) {
        processCollectiveAttackWarmonger(diplomacyTargets, tick, logs, { organizations: updatedOrganizations });
        processAIWarPreparations(diplomacyTargets, tick, logs, updatedNations);
        processAIAIWarDeclaration(
            diplomacyTargets,
            updatedNations,
            tick,
            logs,
            { organizations: updatedOrganizations },
            vassalDiplomacyRequests,
        );
    }
    // [FIX] AI-AI 战争推进独立于 shouldUpdateAI，直接用 tick 模运算控制频率。
    // 绕过 tick 预算保护（budgetExceeded），因为战争推进是关键游戏机制，
    // 不能因为性能优化而被跳过（否则战线永远不动、分数永远为0）。
    const AI_WAR_PROGRESSION_FREQ = 7;
    if (tick % AI_WAR_PROGRESSION_FREQ === 0) {
        console.warn(`[SIM-DEBUG] tick=${tick}, calling processAIAIWarProgression, diplomacyTargets.length=${diplomacyTargets?.length}, updatedNations.length=${updatedNations?.length}, militaryCorps.length=${militaryCorps?.length}`);
        processAIAIWarProgression(diplomacyTargets, updatedNations, tick, logs, vassalDiplomacyRequests, epoch, militaryCorps, generals);
        const annexedCapitalMigration = migrateAnnexedNationCapital({
            nations: updatedNations,
            overseasInvestments: updatedOverseasInvestments,
            foreignInvestments: updatedForeignInvestments,
            tick,
            logs,
        });
        updatedOverseasInvestments = annexedCapitalMigration.overseasInvestments;
        updatedForeignInvestments = annexedCapitalMigration.foreignInvestments;
    }
    perfEnd('diplomacyAI');
    _silverCheckpoint('diplomacyAI');

    // Population fertility calculations (uses constants from ./utils/constants)
    // Famine-fertility penalty: reduce birth rate when food satisfaction is low
    let famineFertilityPenalty = 1;
    {
        let totalWeightedSat = 0;
        let totalPeopleForSat = 0;
        Object.keys(STRATA).forEach(key => {
            if (key === 'official') return;
            const cnt = popStructure[key] || 0;
            if (cnt <= 0) return;
            const sat = needsReport[key]?.satisfactionRatio ?? 1;
            totalWeightedSat += sat * cnt;
            totalPeopleForSat += cnt;
        });
        const globalFoodSat = totalPeopleForSat > 0 ? totalWeightedSat / totalPeopleForSat : 1;
        if (globalFoodSat < 0.7) {
            famineFertilityPenalty = Math.max(0.1, globalFoodSat / 0.7);
        }
    }

    let fertilityBirths = 0;
    let birthAccumulator = Math.max(0, previousBirthAccumulator || 0);
    let remainingCapacity = Math.max(0, totalMaxPop - nextPopulation);
    if (remainingCapacity > 0) {
        const popGrowthMultiplier = getPopulationGrowthMultiplier(difficulty);
        // if (Math.random() < 0.01) console.log(`[DEBUG] PopGrowth: diff=${difficulty}, mult=${popGrowthMultiplier}`);
        const baselineContribution = Math.max(0, population || 0) * FERTILITY_BASELINE_RATE * popGrowthMultiplier * famineFertilityPenalty;
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
            const birthRate = FERTILITY_BASE_RATE * approvalFactor * wealthFactor * (1 + (bonuses.populationGrowthBonus || 0)) * famineFertilityPenalty;
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
                // 如果没有失业者，随机从一个有人的阶层?
                const rolesWithPop = ROLE_PRIORITY.filter(r => (popStructure[r] || 0) > 0);
                if (rolesWithPop.length > 0) {
                    const randomRole = rolesWithPop[Math.floor(Math.random() * rolesWithPop.length)];
                    popStructure[randomRole] = Math.max(0, (popStructure[randomRole] || 0) - 1);
                }
            }
            logs.push("Population reduced by famine.");
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

        // 检查食物和布料需求是否满?
        const shortages = classShortages[key] || [];
        const lackingFood = shortages.some(s => (typeof s === 'string' ? s : s.resource) === 'food');
        const lackingCloth = shortages.some(s => (typeof s === 'string' ? s : s.resource) === 'cloth');

        // 检查历史记录，判断是否长期缺乏
        const needsHistory = (classNeedsHistory || {})[key];
        if (needsHistory && needsHistory.length >= 5) {
            // 检查最?个tick的需求满足情?
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

                    const reason = lackingFood && lackingCloth ? '粮食和布料' : (lackingFood ? '粮食' : '布料');
                    recordAggregatedLog(`${className} 因长期缺少${reason}导致${deaths}人死亡。`);
                }
            }
        }
    });

    // Global starvation death cap: max 3% of total population per tick
    const maxStarvationPerTick = Math.max(1, Math.floor(nextPopulation * 0.03));
    if (starvationDeaths > maxStarvationPerTick) {
        const excess = starvationDeaths - maxStarvationPerTick;
        starvationDeaths = maxStarvationPerTick;
        // Redistribute saved lives back to popStructure proportionally
        let savedToDistribute = excess;
        const strataKeys = Object.keys(STRATA).filter(k => k !== 'official' && (popStructure[k] || 0) > 0);
        if (strataKeys.length > 0) {
            const perStratum = Math.floor(savedToDistribute / strataKeys.length);
            strataKeys.forEach(key => {
                popStructure[key] = (popStructure[key] || 0) + perStratum;
                savedToDistribute -= perStratum;
            });
            if (savedToDistribute > 0) {
                popStructure[strataKeys[0]] = (popStructure[strataKeys[0]] || 0) + savedToDistribute;
            }
        }
    }

    // [FIX] 计算nextPopulation时，直接使用popStructure的总和
    // 因为exodus和starvation已经在popStructure中正确扣减了
    // 只有raidPopulationLoss需要单独处理（如果有的话）
    const popStructureTotal = ROLE_PRIORITY.reduce((sum, role) => sum + (popStructure[role] || 0), 0)
        + (popStructure.unemployed || 0);

    // raidPopulationLoss 如果存在，且未在popStructure中扣减，则单独处?
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

    // 最终人?= popStructure的总和
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
        // 战争税收debuff已在税收征收环节按百分比扣减（方案A），此处不再直接扣减银币

        // 战争经济：贸易中断惩罚（减少所有供给的一部分，模拟贸易路线中断）
        if (warTradeDisruption > 0) {
            Object.keys(supply || {}).forEach(resourceKey => {
                supply[resourceKey] = Math.max(0, (supply[resourceKey] || 0) * (1 - warTradeDisruption));
            });
        }

        // calculateMinProfitMargin is imported from ./utils/helpers

        // 获取全局默认的市场参数（作为 fallback?
        const defaultMarketInfluence = ECONOMIC_INFLUENCE?.market || {};
        const defaultSupplyDemandWeight = Math.max(0, defaultMarketInfluence.supplyDemandWeight ?? 1);
        const defaultVirtualDemandPerPop = Math.max(0, defaultMarketInfluence.virtualDemandPerPop || 0);
        // 应用难度乘数到库存目标天数（低难?更多缓冲=更稳定经济，高难?更少缓冲=更波动经济）
        const inventoryMultiplier = getInventoryTargetDaysMultiplier(difficulty);
        const defaultInventoryTargetDays = Math.max(0.1, (defaultMarketInfluence.inventoryTargetDays ?? 1.5) * inventoryMultiplier);
        const defaultInventoryPriceImpact = Math.max(0, defaultMarketInfluence.inventoryPriceImpact ?? 0.25);

        // 新的市场价格算法：每个建筑有自己的出售价格，市场价是加权平均
        Object.keys(RESOURCES).forEach(resource => {
            if (!isTradableResource(resource)) return;

            const resourceDef = RESOURCES[resource];
            const resourceMarketConfig = resourceDef?.marketConfig || {};

            // 获取资源的经济参?
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

            // volatile 资源（如电力）：库存上限 + 供需流量定价信号
            const isVolatile = resourceDef?.storageMode === 'volatile';
            let volatileFlowMultiplier = 1.0;

            if (isVolatile) {
                const maxInventoryDays = Math.max(0, resourceDef.maxInventoryDays ?? 0);
                const minOperationalBuffer = Math.max(0, resourceDef.minOperationalBuffer ?? 0);
                const allowedStock = Math.max(minOperationalBuffer, adjustedDemand * maxInventoryDays);
                const currentStock = res[resource] || 0;
                const overflow = Math.max(0, currentStock - allowedStock);

                if (overflow > 0) {
                    res[resource] = currentStock - overflow;
                    rates[resource] = (rates[resource] || 0) - overflow;
                    resourceLossBreakdown[resource] = (resourceLossBreakdown[resource] || 0) + overflow;
                }

                // 电力等 volatile 资源使用供需流量比直接定价（类似现实电力现货市场）
                // 库存信号对不可存储资源无意义，用当期供给/需求比代替
                const flowRatio = adjustedDemand > 0 ? sup / adjustedDemand : (sup > 0 ? 5.0 : 1.0);
                const clampedFlow = Math.max(0.2, Math.min(5.0, flowRatio));
                volatileFlowMultiplier = 1.0 / clampedFlow;
            }



            // 计算当前库存可以支撑多少?
            const dailyDemand = adjustedDemand;
            const inventoryStock = res[resource] || 0;
            // 当库存为0时，无论需求如何都应该触发短缺价格（返回极低天数）
            // 当库?0但需?0时，库存充足，返回目标天?
            const inventoryDays = inventoryStock <= 0
                ? 0.01  // 库存?时，视为极度短缺，触发最大涨?
                : (dailyDemand > 0 ? inventoryStock / dailyDemand : inventoryTargetDays);

            // DEBUG: 价格计算调试日志（每5个tick输出一次，避免刷屏?
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


            // 收集所有生产该资源的建筑及其出售价?
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

                // 按等级分组计?
                Object.entries(levelCounts).forEach(([levelStr, count]) => {
                    const level = parseInt(levelStr);
                    const config = getBuildingEffectiveConfig(building, level);

                    const outputAmount = config.output?.[resource];
                    if (!outputAmount || outputAmount <= 0) return;

                    // 使用基础建筑?marketConfig（升级配置可以覆盖，否则沿用基础?
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

                    // 计算原材料成本（含税? 使用升级后的 input
                    let inputCost = 0;
                    if (config.input) {
                        Object.entries(config.input).forEach(([inputKey, amount]) => {
                            if (!amount || amount <= 0) return;
                            const inputPrice = priceMap[inputKey] || getBasePrice(inputKey);
                            const inputTaxRate = getResourceTaxRate(inputKey);

                            // 原材料成?= 价格 × 数量 × (1 + 税率)
                            // 如果税率为负（补贴），则成本降低
                            const baseCost = amount * inputPrice;
                            const taxCost = baseCost * inputTaxRate;
                            inputCost += baseCost + taxCost;
                        });
                    }

                    // 计算工资成本 - 使用升级后的 jobs，但 owner 从基础建筑获取
                    // [FIX] 自营建筑：只跳过业主自身工资，其他雇员工资仍计入成本
                    let laborCost = 0;
                    const ownerKey = building.owner;
                    const effectiveJobs = config.jobs || {};
                    if (Object.keys(effectiveJobs).length > 0) {
                        Object.entries(effectiveJobs).forEach(([role, slots]) => {
                            if (!slots || slots <= 0) return;
                            // 跳过业主岗位的工资（业主收入来自利润而非工资）
                            if (ownerKey && role === ownerKey) return;
                            const wage = updatedWages[role] || getExpectedWage(role);
                            laborCost += slots * wage;
                        });
                    }

                    // 计算营业税成本（正值=按营收比例，负值=每栋固定补贴直存）
                    const businessTaxMultiplier = getBusinessTaxRateFromModule(building.id, policies?.businessTaxRates || {});
                    const estimatedRevenue = outputAmount * (priceMap[resource] || getBasePrice(resource));
                    const rawBusinessTaxCost = businessTaxMultiplier < 0
                        ? businessTaxMultiplier
                        : Math.max(0, estimatedRevenue) * businessTaxMultiplier;

                    // 计算业主生活需求成本 - 使用升级后的 jobs 中的 owner 数量
                    let ownerLivingCost = 0;
                    if (ownerKey) {
                        const ownerLivingCostBase = resourceSpecificWageLivingCosts[ownerKey] || 0;
                        ownerLivingCost = ownerLivingCostBase * (effectiveJobs[ownerKey] || 0);
                    }

                    // 限制营业税对成本价的贡献不超过非税成本的 30%，打断价格-税收正反馈螺旋
                    const nonTaxCost = inputCost + laborCost + ownerLivingCost;
                    const cappedBusinessTaxCost = Math.min(rawBusinessTaxCost, nonTaxCost * 0.3);

                    // 成本价 = (原材料成本含税 + 工资成本 + 营业税成本(capped) + 业主生活需求成本) / 产出数量
                    const totalCost = nonTaxCost + cappedBusinessTaxCost;
                    // 负营业税（补贴）可能使 totalCost 为负，成本价保底为0，避免扰乱价格模型
                    const costPrice = Math.max(0, totalCost / outputAmount);

                    // === 三层价格模型 ===
                    // 1. 计算供需调整系数（基于库存天数）
                    const inventoryRatio = inventoryDays / inventoryTargetDays;
                    let priceMultiplier = 1.0;

                    // [FIX-A] 危机段去除写死的 5x 上限，改用 maxPrice 推导出的 maxMultiplier，
                    // 这样必需品库存归零时价格能真正向 maxPrice 靠拢（粮食 maxPrice=150 → 150x basePrice）。
                    const _basePriceForMul = getBasePrice(resource);
                    const maxMultiplier = (resourceDef?.maxPrice != null && _basePriceForMul > 0)
                        ? resourceDef.maxPrice / _basePriceForMul
                        : 50.0;

                    if (inventoryRatio < 0.1) {
                        // [FIX-D] essential 资源（粮食/布料）库存归零时必须能逼近 maxPrice，
                        // 避免出现"奢侈品比生存品还贵"的反常现象。
                        // 采用指数曲线让 ratio→0 时 priceMultiplier→maxMultiplier。
                        const isEssential = !!resourceDef?.tags?.includes('essential');
                        if (isEssential) {
                            // ratio=0.1 → 3x；ratio=0 → maxMultiplier；中间用凸曲线
                            const shortageDepth = Math.max(0, 1 - inventoryRatio / 0.1); // 0..1
                            const crisisCurve = Math.pow(shortageDepth, 1.5); // 越缺越快涨
                            priceMultiplier = 3.0 + (maxMultiplier - 3.0) * crisisCurve;
                        } else {
                            // 非 essential：保留原温和曲线，避免奢侈品/工业品价格异常飙升
                            priceMultiplier = 3.0 + (0.1 - inventoryRatio) * 200.0;
                        }
                        priceMultiplier = Math.min(maxMultiplier, priceMultiplier);
                    } else if (inventoryRatio < 0.5) {
                        // Low inventory: moderate increase
                        priceMultiplier = 1.0 + (0.5 - inventoryRatio) * 5.0;
                    } else if (inventoryRatio < 1.0) {
                        // Slightly low: gentle increase 1.0-1.5x
                        priceMultiplier = 1.0 + (1.0 - inventoryRatio) * 0.5;
                    } else if (inventoryRatio > 3.0) {
                        // Severe oversupply: deeper discount
                        priceMultiplier = 0.65 - (inventoryRatio - 3.0) * 0.1;
                        priceMultiplier = Math.max(0.2, priceMultiplier);
                    } else if (inventoryRatio > 2.0) {
                        // Oversupply: moderate discount
                        priceMultiplier = 0.85 - (inventoryRatio - 2.0) * 0.2;
                    } else if (inventoryRatio > 1.0) {
                        // Slightly high: gentle decrease 0.85-1.0x
                        priceMultiplier = 1.0 - (inventoryRatio - 1.0) * 0.15;
                    }

                    // [FIX-C] 应用 supplyDemandWeight；必需品在极度短缺时逐步解除价格压制，
                    // 避免 supplyDemandWeight<1 把"价格信号"削平到无人察觉
                    let effectiveWeight = supplyDemandWeight;
                    if (resourceDef?.tags?.includes('essential') && inventoryRatio < 0.3 && supplyDemandWeight < 1.0) {
                        const crisisLift = 1.0 - inventoryRatio / 0.3;
                        effectiveWeight = supplyDemandWeight + (1.0 - supplyDemandWeight) * crisisLift;
                    }
                    priceMultiplier = 1.0 + (priceMultiplier - 1.0) * effectiveWeight;

                    // 时代过渡缓冲：当前时代刚解锁的资源，库存积累期内限制价格上涨
                    const resUnlockEpoch = resourceDef?.unlockEpoch || 0;
                    if (resUnlockEpoch === epoch && resUnlockEpoch > 0 && inventoryRatio < 0.8) {
                        const rampUp = Math.max(0, inventoryRatio / 0.8);
                        const maxAllowed = 2.0 + (10.0 - 2.0) * rampUp;
                        priceMultiplier = Math.min(priceMultiplier, maxAllowed);
                    }

                    // volatile 资源（电力等）：用供需流量比定价，替代库存信号
                    // 库存被人为压低的 volatile 资源，inventoryRatio 会误判为"短缺"
                    if (isVolatile) {
                        priceMultiplier = volatileFlowMultiplier;
                    }

                    // 2. 获取基础价格（市场认可的合理价格）
                    const basePrice = getBasePrice(resource);

                    // 3. 计算市场价格（基于basePrice和供需关系）
                    let marketBasedPrice = basePrice * priceMultiplier;

                    // 4. 最终价格 = max(市场价格, 成本底线)
                    // [FIX] 成本底线随库存充裕度动态缩放：供过于求时企业会亏本甩卖
                    // 避免成本通胀时 costFloor 完全压制供需信号导致"库存巨大但涨价"
                    let costFloorRatio = 0.5;
                    if (isVolatile && volatileFlowMultiplier < 1.0) {
                        costFloorRatio = 0.1;
                    } else if (inventoryRatio > 1.0) {
                        // 库存超过目标时，逐步降低成本底线：
                        // ratio=1 → 0.5, ratio=2 → 0.25, ratio=3 → 0.1, ratio≥5 → 0.05
                        costFloorRatio = Math.max(0.05, 0.5 / Math.pow(inventoryRatio, 1.2));
                    }
                    const costFloor = costPrice * costFloorRatio;
                    let sellingPrice = Math.max(marketBasedPrice, costFloor);

                    // 不超过物价限?
                    const minPrice = resourceDef.minPrice ?? PRICE_FLOOR;
                    const maxPrice = resourceDef.maxPrice;
                    sellingPrice = Math.max(sellingPrice, minPrice);
                    if (maxPrice !== undefined) {
                        sellingPrice = Math.min(sellingPrice, maxPrice);
                    }

                    // 记录该建筑等级的出售价格和产?
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

                // [FIX-A] 与建筑分支保持一致：去除 5x 写死上限，改用 maxMultiplier
                const maxMultiplier = (resourceDef?.maxPrice != null && basePrice > 0)
                    ? resourceDef.maxPrice / basePrice
                    : 50.0;

                if (inventoryRatio < 0.1) {
                    // [FIX-D] essential 资源（粮食/布料）在 fallback 分支同样要能逼近 maxMultiplier，
                    // 否则"国内无人种地"时价格会被旧的线性公式（≤23x）卡死，价格信号失效
                    const isEssentialFallback = !!resourceDef?.tags?.includes('essential');
                    if (isEssentialFallback) {
                        const shortageDepth = Math.max(0, 1 - inventoryRatio / 0.1);
                        const crisisCurve = Math.pow(shortageDepth, 1.5);
                        priceMultiplier = 3.0 + (maxMultiplier - 3.0) * crisisCurve;
                    } else {
                        priceMultiplier = 3.0 + (0.1 - inventoryRatio) * 200.0;
                    }
                    priceMultiplier = Math.min(maxMultiplier, priceMultiplier);
                } else if (inventoryRatio < 0.5) {
                    priceMultiplier = 1.0 + (0.5 - inventoryRatio) * 5.0;
                } else if (inventoryRatio < 1.0) {
                    priceMultiplier = 1.0 + (1.0 - inventoryRatio) * 0.5;
                } else if (inventoryRatio > 3.0) {
                    priceMultiplier = 0.65 - (inventoryRatio - 3.0) * 0.1;
                    priceMultiplier = Math.max(0.2, priceMultiplier);
                } else if (inventoryRatio > 2.0) {
                    priceMultiplier = 0.85 - (inventoryRatio - 2.0) * 0.2;
                } else if (inventoryRatio > 1.0) {
                    priceMultiplier = 1.0 - (inventoryRatio - 1.0) * 0.15;
                }

                // [FIX-C] 应用 supplyDemandWeight + essential 危机解除压制（与建筑分支一致）
                let effectiveWeight = supplyDemandWeight;
                if (resourceDef?.tags?.includes('essential') && inventoryRatio < 0.3 && supplyDemandWeight < 1.0) {
                    const crisisLift = 1.0 - inventoryRatio / 0.3;
                    effectiveWeight = supplyDemandWeight + (1.0 - supplyDemandWeight) * crisisLift;
                }
                priceMultiplier = 1.0 + (priceMultiplier - 1.0) * effectiveWeight;

                if (isVolatile) {
                    priceMultiplier = volatileFlowMultiplier;
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


            // 战争物价上涨：计算与玩家直接交战的敌对国家数?
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
            foreignWarCount = Math.floor(foreignWarCount / 2); // 每场战争被计算两次，需要除?

            // 战争物价系数：每场与玩家的战争增?.5%物价，每场AI间战争增?%物价
            const warPriceMultiplier = 1 + (warCount * 0.025) + (foreignWarCount * 0.01);

            // 【修复】将战争乘数应用到目标价格（marketPrice），而非平滑后的价格
            // 这样平滑处理会正确地向战争调整后的目标价格移动，避免价格卡在上限
            const warAdjustedMarketPrice = marketPrice * warPriceMultiplier;

            // V2: 理念价格修正
            let ideoAdjustedMarketPrice = warAdjustedMarketPrice;
            // price_volatility_mod: 衰减价格波动（将价格拉向basePrice）
            const volatilityMod = bonuses.ideoPriceVolatilityMod || 0;
            if (volatilityMod !== 0) {
                const baseP = getBasePrice(resource);
                // 负值=减少波动（价格更稳定），正值=增加波动
                const damping = Math.max(0, Math.min(1, -volatilityMod));
                ideoAdjustedMarketPrice = ideoAdjustedMarketPrice * (1 - damping) + baseP * damping;
            }
            // resource_price_mod: 按资源 scope 修正（负值=降价）
            const resPriceMod = (bonuses.ideoResourcePriceMod?.[resource] || 0) + (bonuses.ideoResourcePriceMod?._global || 0);
            if (resPriceMod !== 0) {
                ideoAdjustedMarketPrice *= Math.max(0.5, 1 + resPriceMod);
            }

            // 平滑处理：向战争调整后的目标价格平滑移动
            // [FIX] 动态平滑系数：供需差距大时加快响应，避免价格反应迟钝
            const prevPrice = priceMap[resource] || ideoAdjustedMarketPrice;
            const priceGapRatio = prevPrice > 0 ? Math.abs(ideoAdjustedMarketPrice - prevPrice) / prevPrice : 0;
            // [FIX] Reduced smoothing speed to dampen price oscillations.
            // Base smoothing 0.05 (was 0.1); max 0.2 (was 0.4).
            // This means prices take ~10-20 ticks to converge instead of ~3-5.
            let dynamicSmoothing = Math.min(0.2, 0.05 + priceGapRatio * 0.15);
            // [FIX-B] 危机模式：库存极低（<0.1 ratio）的必需品需要快速跳涨，
            // 否则即便目标价已上调，平滑后价格仍要十几个 tick 才到位，价格信号失灵
            const _crisisInvRatio = inventoryDays / inventoryTargetDays;
            if (_crisisInvRatio < 0.1 && resourceDef?.tags?.includes('essential')) {
                const urgency = 1.0 - Math.max(0, _crisisInvRatio) / 0.1; // 0~1
                dynamicSmoothing = Math.max(dynamicSmoothing, 0.3 + 0.4 * urgency); // 0.3~0.7
            }
            const smoothed = prevPrice + (ideoAdjustedMarketPrice - prevPrice) * dynamicSmoothing;

            // 应用价格限制
            const minPrice = resourceDef.minPrice ?? PRICE_FLOOR;
            const maxPrice = resourceDef.maxPrice;
            let finalPrice = smoothed;
            finalPrice = Math.max(finalPrice, minPrice);
            if (maxPrice !== undefined) {
                finalPrice = Math.min(finalPrice, maxPrice);
            }

            // 内部价格保留完整精度，避免微小变化在写入历史前就被截断成台阶线。
            updatedPrices[resource] = finalPrice;
        });
        perfEnd('marketUpdate');
    }
    perfEnd('marketEconomy');
    _silverCheckpoint('marketEconomy');

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
    // [FIX] 记录贸易前的应税收入，用于计算本 tick 贸易收入增量
    const merchantTaxableIncomeBeforeTrade = roleTaxableIncome.merchant || 0;
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
        roleTaxableIncome, // [FIX] 传入应税收入追踪
        pendingTrades: merchantState.pendingTrades || [],
        lastTradeTime: merchantState.lastTradeTime || 0,
        gameSpeed,
        classFinancialData, // Pass detailed financial tracking
        logs,
        potentialResources: availableResources, // Restrict trade to already available resources

        // Trade 2.0: player merchant assignments (backward compatible)
        merchantAssignments: merchantState.merchantAssignments || merchantState.assignments || null,

        // Trade 2.0: per-resource preference multipliers (1 = neutral)
        merchantTradePreferences: merchantState.merchantTradePreferences || null,

        // Control whether to log merchant trade initiation messages
        shouldLogMerchantTrades: eventEffectSettings?.logVisibility?.showMerchantTradeLogs ?? false,
        // Throttle new trades to reduce workload
        allowNewTrades: shouldUpdateMerchantTrade,
        // [NEW] Control official logs
        shouldLogOfficialEvents: false,

        // Treasury change callback for resource tracking
        onTreasuryChange: applySilverChange,

        // NEW: Pass breakdown objects for tracking imports/exports in UI
        supplyBreakdown,
        demandBreakdown,
    });
    const merchantLockedCapital = Math.max(0, updatedMerchantState.lockedCapital ?? sumLockedCapital(updatedMerchantState.pendingTrades));
    updatedMerchantState.lockedCapital = merchantLockedCapital;
    // [FIX] 记录本 tick 商人贸易收入，供下一 tick 人头税征收使用
    updatedMerchantState.tradeRevenueThisTick = Math.max(0, (roleTaxableIncome.merchant || 0) - merchantTaxableIncomeBeforeTrade);
    // [FIX] 同步更新 UI 显示的应税收入：
    // 人头税时刻（L3504）写入的 taxableIncome = 建筑产出 + 上一tick贸易收入(previousMerchantTradeRevenue)
    // 但 UI 同时显示本 tick 的 tradeImportRevenue（通过 Ledger 写入），两者时间基准不同会导致用户困惑。
    // 修正：将 taxableIncome 中的"上一tick贸易收入"替换为"本tick贸易收入"，使 UI 显示一致。
    if (classFinancialData.merchant) {
        const previousTradeInTaxable = previousMerchantTradeRevenue; // 人头税时已加入的上一tick贸易收入
        const currentTradeRevenue = updatedMerchantState.tradeRevenueThisTick; // 本tick实际贸易收入
        classFinancialData.merchant.income.taxableIncome =
            (classFinancialData.merchant.income.taxableIncome || 0) - previousTradeInTaxable + currentTradeRevenue;
    }
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

            // 按伙伴国家分?
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
            if (p.exports.length > 0) items.push('??' + p.exports.join(', '));
            if (p.imports.length > 0) items.push('??' + p.imports.join(', '));
            if (items.length > 0) {
                partnerParts.push(p.name + '(' + items.join(', ') + ')');
            }
        });

        if (partnerParts.length > 0 && updatedMerchantState.shouldLogMerchantTrades) {
            const profitText = totalProfit >= 0 ? `盈利${totalProfit.toFixed(1)}` : `亏损${Math.abs(totalProfit).toFixed(1)}`;
            logs.push('??????: ' + partnerParts.join(', ') + '?' + profitText + '??');
        }


        // 应用官员贸易加成到商人财?
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

    // 增强转职（Migration）逻辑：基于市场价格和潜在收益的职业流?
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
     * 为空岗位预估收入（区分业主和雇员?
     * 解决恶性循环：无人工作 ?收入? ?更无人愿意去
     * @param {string} role - 角色key
     * @returns {number} 预估的人均收?
     */
    const estimateVacantRoleIncome = (role) => {
        if (vacantRoleIncomeCache.has(role)) {
            return vacantRoleIncomeCache.get(role);
        }
        // 空岗位吸引力加成系数
        const VACANT_BONUS = 1.2;

        // [FIX] 计算税收效率，用于补贴计?
        const rawEfficiency = efficiency * (1 + (bonuses.taxEfficiencyBonus || 0) - (bonuses.corruption || 0));
        const effectiveEfficiency = Math.max(0, Math.min(1, rawEfficiency));

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
                // 计算建筑产出价?
                let outputValue = 0;
                if (config.output) {
                    Object.entries(config.output).forEach(([resource, amount]) => {
                        if (!amount || amount <= 0) return;
                        if (!RESOURCES[resource]) return; // 跳过 maxPop, militaryCapacity ?
                        const price = priceMap[resource] || getBasePrice(resource);
                        outputValue += amount * price;
                    });
                }

                // 计算原材料成?
                let inputCost = 0;
                if (config.input) {
                    Object.entries(config.input).forEach(([resource, amount]) => {
                        if (!amount || amount <= 0) return;
                        const price = priceMap[resource] || getBasePrice(resource);
                        inputCost += amount * price;
                    });
                }

                // 计算雇员工资支出（除业主外的其他岗位?
                // 使用“实际发出的平均工资”（market.wages / updatedWages），而不是理论预期工?
                let wageCost = 0;
                Object.entries(jobs).forEach(([jobRole, slots]) => {
                    if (jobRole === role || !slots || slots <= 0) return;
                    const avgPaidWage = updatedWages?.[jobRole] ?? market?.wages?.[jobRole] ?? getExpectedWage(jobRole);
                    wageCost += avgPaidWage * slots;
                });

                // 计算税费成本（人头税按收入比例 + 营业税按利润比例）
                const roleWageEst = updatedWages?.[role] ?? market?.wages?.[role];
                const priceEstHeadRate = getHeadTaxRate(role);
                let headTaxCost;
                if (priceEstHeadRate > 0) {
                    const roleIncomeBase = (Number.isFinite(roleWageEst) && roleWageEst > 0)
                        ? roleWageEst * (TAX_BASE_RATES?.HEAD_TAX_INCOME_RATIO || 1.0) : 0;
                    headTaxCost = roleIncomeBase * priceEstHeadRate * effectiveTaxModifier;
                } else if (priceEstHeadRate < 0) {
                    headTaxCost = priceEstHeadRate * effectiveTaxModifier;
                } else {
                    headTaxCost = 0;
                }
                const businessTaxRate = getBusinessTaxRateFromModule(building.id, policies?.businessTaxRates || {});
                const businessTaxCost = businessTaxRate < 0
                    ? businessTaxRate
                    : Math.max(0, outputValue) * businessTaxRate;
                const effectiveBusinessTaxCost = businessTaxCost < 0
                    ? businessTaxCost * effectiveEfficiency
                    : businessTaxCost;

                const netProfit = outputValue - inputCost - wageCost - headTaxCost - effectiveBusinessTaxCost;
                const profitPerOwner = roleSlots > 0 ? netProfit / roleSlots : 0;

                ownerIncome += profitPerOwner * roleSlots * count;
                ownerSlots += roleSlots * count;

            } else {
                // ===== 雇员工资预估 =====
                // Use the actual average wage that this role is currently being paid,
                // otherwise vacancy signals can be wildly optimistic/pessimistic.
                const avgPaidWage = updatedWages?.[role] ?? market?.wages?.[role] ?? getExpectedWage(role);

                // [FIX] 冷启动修复：当历史工资极低时，基于建筑利润反推合理工资
                let estimatedWage = avgPaidWage;
                const baseExpected = getExpectedWage(role);
                
                if (avgPaidWage < baseExpected * 0.5) {
                    let bOutputValue = 0;
                    if (config.output) {
                        Object.entries(config.output).forEach(([resource, amount]) => {
                            if (!amount || amount <= 0 || !RESOURCES[resource]) return;
                            const price = priceMap[resource] || getBasePrice(resource);
                            bOutputValue += amount * price;
                        });
                    }
                    let bInputCost = 0;
                    if (config.input) {
                        Object.entries(config.input).forEach(([resource, amount]) => {
                            if (!amount || amount <= 0) return;
                            const price = priceMap[resource] || getBasePrice(resource);
                            bInputCost += amount * price;
                        });
                    }
                    const bProfit = bOutputValue - bInputCost;
                    if (bProfit > 0) {
                        const totalEmpSlots = Object.entries(jobs)
                            .filter(([r]) => r !== building.owner)
                            .reduce((sum, [, s]) => sum + (s || 0), 0);
                        if (totalEmpSlots > 0) {
                            const profitShare = (bProfit * 0.4) / totalEmpSlots;
                            estimatedWage = Math.max(avgPaidWage, profitShare, baseExpected);
                        }
                    }
                }

                // 计算税后工资（按收入比例）
                const wageForTax = estimatedWage > 0 ? estimatedWage : (previousWages[role] || 0);
                const empHeadRate = getHeadTaxRate(role);
                let taxCost;
                if (empHeadRate > 0) {
                    const headIncBase = (Number.isFinite(wageForTax) && wageForTax > 0)
                        ? wageForTax * (TAX_BASE_RATES?.HEAD_TAX_INCOME_RATIO || 1.0) : 0;
                    taxCost = headIncBase * empHeadRate * effectiveTaxModifier;
                } else if (empHeadRate < 0) {
                    taxCost = empHeadRate * effectiveTaxModifier;
                } else {
                    taxCost = 0;
                }
                const netWage = estimatedWage - taxCost;

                employeeWage += netWage * roleSlots * count;
                employeeSlots += roleSlots * count;
            }
        });

        // 计算加权平均收入
        const totalSlots = ownerSlots + employeeSlots;
        if (totalSlots <= 0) {
            // 没有建筑提供这个岗位：也使用“岗位发出工资的平均数”作为信?
            const avgPaidWage = updatedWages?.[role] ?? market?.wages?.[role] ?? getExpectedWage(role);
            const fallback = avgPaidWage * VACANT_BONUS;
            vacantRoleIncomeCache.set(role, fallback);
            return fallback;
        }

        const totalIncome = ownerIncome + employeeWage;
        const averageIncome = totalIncome / totalSlots;

        // 应用吸引力加?
        const result = Math.max(0, averageIncome * VACANT_BONUS);
        vacantRoleIncomeCache.set(role, result);
        return result;
    };

    // 【需求 2.1 / 卡点 A 修复】业务税补贴 → owner 阶层 subsidyPerCapita 信号
    // 背景：业务税补贴（businessTaxRate < 0）的实际银币流口径是
    //   subsidyAmount = |rate| × count（每 tick 固定，与 outputValue 无关）
    //   actualSubsidyAmount = subsidyAmount × effectiveEfficiency
    //   ledger.transfer('state', owner, ...)  + roleWagePayout[owner] += actualSubsidyAmount
    // 因此该补贴已隐式进入 owner 阶层的 netIncomePerCapita（potentialIncome 主项）。
    // 但下方 subsidyPerCapita 字段过去仅反映人头税补贴，导致 jobs.js 的
    //   - SUBSIDY_HIGH_ATTRACTIVENESS_RATIO 判定
    //   - SUBSIDY_PULL_MULTIPLIER 加速
    //   - SAME_TIER_MIGRATION_RESISTANCE 削减
    // 全部认为"无补贴"而失效。此处显式把业务税补贴均摊到该 owner 阶层全体 pop 上，
    // 与"实际银币也是注入整池 roleWagePayout[owner]"的口径完全一致——只是把已隐式存在
    // 于 incomeSignal 中的补贴金额"显式标注"到 subsidyPerCapita，不重复加到 potentialIncome。
    const businessSubsidyPerCapitaByOwner = {};
    {
        // 与 simulation.js:3621-3625 业务税补贴分发段使用同一口径计算 effectiveEfficiency
        const rawEfficiency = efficiency * (1 + (bonuses.taxEfficiencyBonus || 0) - (bonuses.corruption || 0));
        const outerEffectiveEfficiency = Math.max(0, Math.min(1, rawEfficiency));
        BUILDINGS.forEach(building => {
            const count = builds[building.id] || 0;
            if (count <= 0) return;
            const ownerKey = building.owner;
            if (!ownerKey) return;
            const businessTaxRate = getBusinessTaxRateFromModule(building.id, policies?.businessTaxRates || {});
            if (!Number.isFinite(businessTaxRate) || businessTaxRate >= 0) return;
            // 与银币流口径一致：subsidyAmount = |rate| × count；actualSubsidy = × efficiency
            const actualSubsidy = Math.abs(businessTaxRate) * count * outerEffectiveEfficiency;
            businessSubsidyPerCapitaByOwner[ownerKey] = (businessSubsidyPerCapitaByOwner[ownerKey] || 0) + actualSubsidy;
        });
    }

    // 【修复 A：在岗 pop 分母】聚合本 tick 各角色"实际在岗"人数，
    // 用作 netIncomePerCapita 的分母，避免高粮价/补贴等业主收入被全阶层 pop 稀释。
    // 复用生产循环中已写入的 buildingFinancialData[*].filledByRole（simulation.js:2666）。
    // 场景：farm jobs={peasant:3} 且 owner=peasant → 业主收入入 roleWagePayout[peasant]，
    //   但失业 peasant 与在岗 peasant 同属一个阶层池子，按总 pop 均摊会让"有效收入信号"
    //   显著低于在岗者实际所得，导致迁移决策低估 peasant 吸引力。
    const employedPopByRole = {};
    Object.values(buildingFinancialData || {}).forEach((finance) => {
        if (!finance) return;
        Object.entries(finance.filledByRole || {}).forEach(([role, filled]) => {
            const v = Number(filled) || 0;
            if (v > 0) {
                employedPopByRole[role] = (employedPopByRole[role] || 0) + v;
            }
        });
    });

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
        // 【修复 A】使用"在岗 pop"作分母；当无人在岗时回退到总 pop，最低 1 防除零。
        // 商人例外：merchant 没有 jobs 配置，filledByRole 不会统计到，仍走总 pop。
        const employedPop = role === 'merchant'
            ? pop
            : Math.max(0, Math.floor(employedPopByRole[role] || 0));
        // 【修复 D / 自耕农信号】岗位完全空置（如 农田 0/42）时，
        //   employedPop=0 → 旧逻辑回退到总 pop，业务税补贴会被全阶层失业/其它岗位人口稀释，
        //   导致 peasant.netIncomePerCapita 看起来"补贴 ÷ 100 人 = 4 银/人"而非真实"补贴 ÷ 42 个潜在岗位"。
        //   这会让 peasant.potentialIncome 远低于工匠，工匠转 peasant 永远过不了 1.3× 阻力门槛。
        // 三级回退分母：在岗人 → 岗位数（潜在容量）→ 总 pop（最后兜底，防除零）。
        // 商人继续走总 pop（merchant 无 jobs 配置）。
        let incomeDivisor;
        if (employedPop > 0) {
            incomeDivisor = employedPop;
        } else if (role !== 'merchant') {
            const slots = Math.max(0, Math.floor(jobsAvailable[role] || 0));
            incomeDivisor = slots > 0 ? slots : Math.max(1, pop);
        } else {
            incomeDivisor = Math.max(1, pop);
        }
        const netIncomePerCapita = netIncome / incomeDivisor;
        const roleWage = updatedWages[role] || getExpectedWage(role);
        const roleWageForTax = updatedWages[role] || getExpectedWage(role);
        const sumHeadRate = getHeadTaxRate(role);
        let taxCostPerCapita;
        if (sumHeadRate > 0) {
            const headIncomeBase = (Number.isFinite(roleWageForTax) && roleWageForTax > 0)
                        ? roleWageForTax * (TAX_BASE_RATES?.HEAD_TAX_INCOME_RATIO || 1.0) : 0;
            taxCostPerCapita = headIncomeBase * sumHeadRate * effectiveTaxModifier;
        } else if (sumHeadRate < 0) {
            taxCostPerCapita = sumHeadRate * effectiveTaxModifier;
        } else {
            taxCostPerCapita = 0;
        }
        const disposableWage = roleWage - taxCostPerCapita;
        const lastTickIncome = getLastTickNetIncomePerCapita(role);
        const effectivePerCapDelta = role === 'merchant' ? netIncomePerCapita : perCapWealthDelta;
        const historicalIncomePerCapita = lastTickIncome !== null ? lastTickIncome : effectivePerCapDelta;
        const fallbackIncome = netIncomePerCapita !== 0 ? netIncomePerCapita : disposableWage;

        // 【空岗位预估收入】当该行业无人工作时，使用基于建筑产出的预估收入
        // 解决恶性循环：无人工作 → 收入零 → 更无人愿意去
        let incomeSignal;
        if (pop === 0) {
            // 无人工作时，使用预估收入（区分业主和雇员）
            incomeSignal = estimateVacantRoleIncome(role);
        } else if (role === 'merchant') {
            // 商人特例：优先使用当前运营收入（Net Income），忽略因进货导致的财富（Wealth）波动
            incomeSignal = fallbackIncome;
        } else {
            // [FIX] 非商人角色：优先使用 netIncomePerCapita（真正的收支净额）
            // 旧逻辑使用 historicalIncomePerCapita（即财富变化差值），但财富变化会受到
            // 人口迁入带入财富、产出暂存等非收支因素的干扰，导致亏损行业看起来赚钱。
            // netIncomePerCapita = (roleWagePayout - roleExpense) / pop，
            // 其中 roleExpense 已包含人头税、营业税、生产成本、工资支付等全部支出。
            if (netIncomePerCapita !== 0) {
                incomeSignal = netIncomePerCapita;
            } else if (historicalIncomePerCapita !== 0) {
                incomeSignal = historicalIncomePerCapita;
            } else {
                incomeSignal = fallbackIncome;
            }
        }
        const stabilityBonus = perCap > 0 ? perCap * 0.002 : 0;

        // 【需求 1.1 / 1.6】补贴信号量级修复：
        // 当角色享受补贴（sumHeadRate < 0）时，将人均到账补贴金额（已按 effectiveTaxModifier 折扣）
        // 以 1.0 倍直接并入 incomeSignal 主项，使补贴像工资一样对迁移决策产生有效拉力。
        // 对账依据：taxCostPerCapita = sumHeadRate * effectiveTaxModifier（sumHeadRate < 0 分支），
        // 与 taxes.js collectHeadTax 中 due = count * headRate * effectiveTaxModifier 的人均口径一致。
        // 当 sumHeadRate >= 0（征税或零）时，不进入此分支，避免信号残留（需求 1.5）。
        let subsidySignalBonus = 0;
        if (sumHeadRate < 0 && pop > 0 && Number.isFinite(taxCostPerCapita)) {
            // taxCostPerCapita 为负值（人均补贴到账金额），取绝对值即正向拉力金额
            subsidySignalBonus = Math.abs(taxCostPerCapita);
        }
        // 保留 SUBSIDY_INCOME_SIGNAL_BONUS 常量的引用语义：用于潜在的征税侧信号缓和（向后兼容）
        // 当前主项采用 1.0× 并入，常量本身在 constants.js 仍以 0.5 为默认值。
        void SUBSIDY_INCOME_SIGNAL_BONUS;

        // 以上一tick的人均净收入为主导，辅以小幅稳定度奖励和补贴信号主项并入
        const potentialIncome = incomeSignal + stabilityBonus + subsidySignalBonus;

        return {
            role,
            pop,
            perCap,
            perCapDelta: effectivePerCapDelta,
            potentialIncome,
            vacancy: roleVacancies[role] || 0,
            // 【需求 3.1 / 1.3 / 卡点 A 修复】补贴信号字段：
            // 用于 handleJobMigration 识别"补贴显著候选"并启用补贴拉力加速 / 阻力削减。
            // 与 taxes.js / 业务税补贴实际到账口径一致：
            //   - 人头税补贴：sumHeadRate < 0 → |sumHeadRate| × effectiveTaxModifier（人均）
            //   - 业务税补贴：Σ |buildingRate| × buildingCount × effectiveEfficiency / divisor
            // 注意：业务税补贴的实际银币已通过 roleWagePayout 进入 netIncomePerCapita，
            // 因此 potentialIncome 主项不再重复加它；此处仅作为"政策可见性"信号上报，
            // 让迁移决策器能识别补贴候选并启用拉力 / 阻力削减分支。
            // 【修复 D】分母与 incomeDivisor 同源，避免 0/42 时补贴被失业总池稀释成 0。
            subsidyPerCapita: subsidySignalBonus
                + ((businessSubsidyPerCapitaByOwner[role] || 0) / incomeDivisor),
        };
    });

    // 过滤?'official' 阶层，防止其参与自动转职（官员只能通过任命产生?
    const migrationRoles = activeRoleMetrics.filter(r => r.role !== 'official');

    const totalMigratablePop = migrationRoles.reduce((sum, r) => r.pop > 0 ? sum + r.pop : sum, 0);
    const averagePotentialIncome = totalMigratablePop > 0
        ? migrationRoles.reduce((sum, r) => sum + (r.potentialIncome * r.pop), 0) / totalMigratablePop
        : 0;

    // 计算平均人均财富，用于判断富裕阶层的转职阈?
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

    // 使用handleJobMigration处理阶层迁移（包含tier阻力系数和冷却机制）
    const migrationResult = handleJobMigration({
        popStructure,
        wealth,
        roleMetrics: migrationRoles,
        hasBuildingVacancyForRole,
        reserveBuildingVacancyForRole,
        logs,
        migrationCooldowns,
        supplyDemandRatio,
    });
    // 更新迁移后的状?
    Object.assign(popStructure, migrationResult.popStructure);
    Object.assign(wealth, migrationResult.wealth);
    const updatedMigrationCooldowns = migrationResult.migrationCooldowns;

    // 商人交易已在转职逻辑前执行，这里只需应用收入到财?
    applyRoleIncomeToWealth();

    // Sync classWealthResult and totalWealth to include income for all classes
    Object.keys(STRATA).forEach(key => {
        classWealthResult[key] = Math.max(0, wealth[key] || 0);
    });
    totalWealth = Object.values(classWealthResult).reduce((sum, val) => sum + val, 0);

    // [FIX] 同步更新 classLivingStandard 中的 wealthPerCapita
    // 因为 calculateLivingStandards ?wealth 完全更新前调用，导致 wealthPerCapita 可能滞后
    // 注意：跳过官员阶层，因为官员财富使用独立管理机制（在?3306-3320 行已正确设置?
    Object.keys(STRATA).forEach(key => {
        // 跳过官员阶层，官员的 wealthPerCapita 在官员模拟循环后已正确设?
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
    let nextLastMinisterExpansionDay = normalizeMinisterExpansionCooldowns(lastMinisterExpansionDay);
    const shouldAttemptMinisterExpansion = ECONOMIC_MINISTER_ROLES.some(
        (role) => ministerAssignments?.[role] && ministerAutoExpansion?.[role] === true
    );

    const ministerExpansionCfg = MINISTER_EXPANSION_CONFIG;
    if (shouldAttemptMinisterExpansion && (tick - (nextLastMinisterExpansionDay.global || 0) >= ministerExpansionCfg.globalCooldownDays)) {
        const difficultyLevel = difficulty || 'normal';
        const growthFactor = getBuildingCostGrowthFactor(difficultyLevel);
        const baseMultiplier = getBuildingCostBaseMultiplier(difficultyLevel);
        const buildingCostMod = bonuses.buildingCostMod || 0;
        const marketForMinister = {
            prices: priceMap,
            wages: market?.wages || {},
        };
        const treasurySilver = res.silver || 0;
        const budgetByRatio = treasurySilver * Math.max(0, ministerExpansionCfg.budgetRatio || 0);
        const budgetByCap = Number.isFinite(ministerExpansionCfg.maxSilverPerTrigger)
            ? ministerExpansionCfg.maxSilverPerTrigger
            : treasurySilver;
        let remainingBudget = Math.max(0, Math.min(treasurySilver, budgetByRatio, budgetByCap));
        let builtCount = 0;
        const builtByRole = {};

        const findBestCandidate = () => {
            let bestCandidate = null;
            ECONOMIC_MINISTER_ROLES.forEach((role) => {
                const officialId = ministerAssignments?.[role];
                const official = officialId ? ministerRoster.get(officialId) : null;
                if (!official) return;

                const autoExpansionEnabled = ministerAutoExpansion?.[role] === true;
                if (!autoExpansionEnabled) return;
                const roleBuiltInThisTrigger = (builtByRole[role] || 0) > 0;
                if (!roleBuiltInThisTrigger && tick - (nextLastMinisterExpansionDay[role] || 0) < ministerExpansionCfg.ministerCooldownDays) return;

                BUILDINGS.forEach((building) => {
                    if (!isBuildingUnlockedForMinister(building, epoch, techsUnlocked)) return;
                    if (!isBuildingInMinisterScope(building, role)) return;

                    const staffingRatioRaw = buildingStaffingRatios?.[building.id];
                    const staffingRatio = Number.isFinite(staffingRatioRaw) ? staffingRatioRaw : 1;
                    if (staffingRatio < ministerExpansionCfg.minStaffingRatio) return;

                    const shortageScore = scoreBuildingShortage(building, supplyDemandRatio);
                    if (shortageScore <= 0) return;

                    const currentCount = builds[building.id] || 0;
                    const rawCost = calculateBuildingCost(building.baseCost, currentCount, growthFactor, baseMultiplier);
                    const adjustedCost = applyBuildingCostModifier(rawCost, buildingCostMod, building.baseCost);
                    const silverCost = calculateSilverCost(adjustedCost, { prices: priceMap });
                    if (!Number.isFinite(silverCost) || silverCost <= 0) return;
                    if (silverCost > remainingBudget) return;
                    if ((res.silver || 0) < silverCost) return;

                    // 缺口驱动：shortageScore > 0 已由上方守护，此处直接计算 ROI 用于候选排序
                    const profitResult = calculateBuildingProfit(building, marketForMinister, taxPolicies);
                    const profit = profitResult?.profit ?? 0;
                    const operatingCost = (profitResult?.inputValue ?? 0) + (profitResult?.wageCost ?? 0) + (profitResult?.businessTax ?? 0);
                    const roi = operatingCost > 0 ? profit / operatingCost : 0;

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
            return bestCandidate;
        };

        while (builtCount < ministerExpansionCfg.maxBuildsPerTrigger && remainingBudget > 0) {
            const bestCandidate = findBestCandidate();
            if (!bestCandidate) break;

            applyResourceChange('silver', -bestCandidate.silverCost, 'minister_expansion');
            builds[bestCandidate.building.id] = (builds[bestCandidate.building.id] || 0) + 1;
            _buildingsModified = true;
            console.warn('[SIM-BUILD] Minister expansion:', bestCandidate.building.id, 'role:', bestCandidate.role);
            builtCount += 1;
            builtByRole[bestCandidate.role] = (builtByRole[bestCandidate.role] || 0) + 1;
            remainingBudget = Math.max(0, remainingBudget - bestCandidate.silverCost);
            nextLastMinisterExpansionDay = {
                ...nextLastMinisterExpansionDay,
                global: tick,
                [bestCandidate.role]: tick,
            };
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
    const OWNER_UPGRADE_CHANCE_PER_TICK = 0.15; // 15% chance per tick per eligible building type
    const OWNER_MAX_UPGRADES_PER_TICK = 3; // Allow up to 3 upgrades per building type per tick

    // 全局资源预算追踪：防止多个建筑同时升级时透支市场库存
    // 每次升级前检查剩余可用量，升级后立即扣减预算
    const upgradeResourceBudget = {};
    Object.keys(res).forEach(k => { upgradeResourceBudget[k] = res[k] || 0; });

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

        // [FIX] Use getBuildingLevelDistribution to get normalized level counts
        // This handles the case where upgrade data exceeds actual building count
        const { fullLevelCounts, level0Count: normalizedLevel0Count } = getBuildingLevelDistribution(
            tick, buildingId, updatedBuildingUpgrades, count
        );

        // Find the lowest level building that can be upgraded
        // Start from level 0 and go up
        let upgradesThisTick = 0;
        for (let fromLevel = 0; fromLevel < maxLevel; fromLevel++) {
            const atThisLevel = fullLevelCounts[fromLevel] || 0;
            if (atThisLevel <= 0) continue;

            // 检查目标等级的输入资源是否已解锁
            const { unlocked: inputsUnlocked } = areUpgradeInputsUnlocked(
                buildingId, fromLevel + 1, epoch, techsUnlocked
            );
            if (!inputsUnlocked) continue;

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

            // [FIX] 检查全局资源预算（防止多建筑同时升级透支市场库存）
            // 使用 upgradeResourceBudget 而非 res，确保跨建筑的累计消耗不超过实际库存
            const hasResources = Object.entries(baseCost).every(([resource, amount]) => {
                if (resource === 'silver') return true;
                return (upgradeResourceBudget[resource] || 0) >= amount;
            });

            if (!hasResources) {
                continue; // Not enough resources in market (accounting for other pending upgrades)
            }

            // Check if owner can afford (has enough wealth)
            if (ownerWealth < totalSilverCost) {
                continue; // Owner doesn't have enough wealth
            }

            // === Execute the upgrade ===

            // 1. Deduct resources from market AND from budget tracker
            Object.entries(baseCost).forEach(([resource, amount]) => {
                if (resource !== 'silver') {
                    applyResourceChange(resource, -amount, 'building_construction_cost');
                    // 同步扣减预算，防止后续建筑重复使用同一库存
                    upgradeResourceBudget[resource] = Math.max(0, (upgradeResourceBudget[resource] || 0) - amount);
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
            // logs.push(`⚠️ ${ownerName}自发投资了自己的产业 ${b.name} 到${upgradeName}（花费${Math.ceil(totalSilverCost)} 银币）`);

            // Only upgrade up to OWNER_MAX_UPGRADES_PER_TICK buildings per type per tick
            upgradesThisTick++;
            if (upgradesThisTick >= OWNER_MAX_UPGRADES_PER_TICK) break;
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

            // logs.push(`⚠️ 官员${officialName}升级了${buildingId}（花费${Math.ceil(cost)} 银）`);
        });
    }

    // Update classWealthResult after owner upgrades
    Object.keys(STRATA).forEach(key => {
        classWealthResult[key] = Math.max(0, wealth[key] || 0);
    });
    totalWealth = Object.values(classWealthResult).reduce((sum, val) => sum + val, 0);

    // 税收效率：在“入库口径”为实际支付的前提下，税收效率应在征收环节就影响“实际入库”?
    // 目前 Ledger ?taxBreakdown.xxx 代表真实转入国库的税额（实际支付），因此这里不再二次扣除“效率损失”?
    // 依然保留税收效率用于 UI 展示与后续系统（如需要可在征收处注入效率）?
    const rawTaxEfficiency = efficiency * (1 + (bonuses.taxEfficiencyBonus || 0) - (bonuses.corruption || 0));
    const effectiveTaxEfficiency = Math.max(0, Math.min(1, rawTaxEfficiency));

    // ============================================================================
    // 税收汇总与腐败处理（方案B?
    // ============================================================================
    // 【税收流程说明?
    // 1. 征收阶段（第1760-1830行，?760-2810行）?
    //    - 阶层支付全额税款（已应用 effectiveTaxModifier，包含所有税收加成）
    //    - 税款通过 ledger.transfer() 转入国库
    //    - taxBreakdown 记录实际入库金额
    //
    // 2. 腐败处理阶段（本段代码）?
    //    - 计算腐败损失 = 税基 × (理论效率 - 实际效率)
    //    - 从国库扣除腐败损失，分配给贪污官?
    //    - 国库最终收?= 阶层支付 - 腐败损失
    //
    // 3. 结果?
    //    - 阶层：支?100% 税款（按 effectiveTaxModifier 计算?
    //    - 国库：收?效率% 的税款（扣除腐败后）
    //    - 官员：获?(1-效率)% 的贪污收?
    // ============================================================================

    // 由于 taxBreakdown 现在?实际入库"，collectedXxx 直接等于 taxBreakdown.xxx?
    let collectedHeadTax = taxBreakdown.headTax;
    let collectedIndustryTax = taxBreakdown.industryTax;
    let collectedBusinessTax = taxBreakdown.businessTax;
    let collectedTariff = (taxBreakdown.tariff || 0); // 关税收入

    // 方案A：战争税收效率惩??按百分比扣减所有税收，在征收环节就体现
    const warTaxFactor = Math.max(0, 1 - frontlineTaxEfficiencyPenalty);
    if (frontlineTaxEfficiencyPenalty > 0.001) {
        const preLossTotal = collectedHeadTax + collectedIndustryTax + collectedBusinessTax + collectedTariff;
        collectedHeadTax *= warTaxFactor;
        collectedIndustryTax *= warTaxFactor;
        collectedBusinessTax *= warTaxFactor;
        collectedTariff *= warTaxFactor;
        const postLossTotal = collectedHeadTax + collectedIndustryTax + collectedBusinessTax + collectedTariff;
        const taxEfficiencyLoss = preLossTotal - postLossTotal;
        if (taxEfficiencyLoss > 0) {
            applySilverChange(-taxEfficiencyLoss, 'tax_efficiency_loss');
        }
    }

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

    // 腐败分配逻辑：将部分税收收入视为被贪污挪走（真实从国库扣除），并按权重分配给官员财富?
    // 腐败损失 = 税基 × (理论效率 - 实际效率)
    // 例如：税?000，理论效?00%，实际效?0% ?腐败损失 = 1000 × (1.0 - 0.7) = 300
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
            // Corruption: money is taken from the treasury and ends up in officials' wealth.
            // [FIX] 仅通过 ledger.transfer 执行一次扣除+记账。
            // ledger._deduct 减少国库，ledger._add 增加 wealth.official，
            // _recordExpense 写入 silverChangeLog。无需额外调用 applySilverChange。
            // 注意：individual official.wealth 已在上面循环中逐个增加了 share，
            // 所以这里 ledger._add 对 wealth.official 的增加恰好覆盖了聚合变化。
            totalOfficialIncome += distributed;

            // Execute the single state->official transfer (debit state + credit official + log)
            ledger.transfer(
                'state',
                'official',
                distributed,
                TRANSACTION_CATEGORIES.INCOME.CORRUPTION,
                TRANSACTION_CATEGORIES.INCOME.CORRUPTION
            );

            // Sync tracking vars after ledger has updated wealth.official
            totalOfficialWealth = wealth.official;
            classWealthResult.official = Math.max(0, wealth.official);
            totalWealth = Object.values(classWealthResult).reduce((sum, val) => sum + val, 0);
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

    // [DEBUG] 税收汇总调?- 增强?
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

    // 将税收与战争赔款一并视为财政收?
    const baseFiscalIncome = totalCollectedTax + warIndemnityIncome;

    // 税收处理
    // 注意：Ledger 已将税收 (taxBreakdown.xxx) 添加到国库并记录日志
    // 税收效率损失已通过腐败分配给官员（?6082-6105 行）
    // 这里只需要处理收入倍率加成（如?incomePercentMultiplier > 1?

    // [FIX] 方案B：税收效率只影响国库收入，不凭空增加银币
    // 阶层已支付全额税款（在征收环节），国库收到的是扣除腐败后的金?
    // incomePercentMultiplier 不应该凭空增加银币，而应该在征收时就体现?effectiveTaxModifier ?

    // 计算最终税额（用于 rates 显示?
    // 注意：这里不再乘?incomePercentMultiplier，因为：
    // 1. 阶层已经按照 effectiveTaxModifier（包含所有加成）支付了税?
    // 2. 国库收到的是扣除腐败后的金额（已经通过 corruptionLoss 处理?
    // 3. 不应该凭空增加银?
    const finalHeadTax = collectedHeadTax;
    const finalIndustryTax = collectedIndustryTax;
    const finalBusinessTax = collectedBusinessTax;
    const finalTariff = collectedTariff;

    // 更新 rates（用?UI 显示?
    rates.silver = (rates.silver || 0) + finalHeadTax + finalIndustryTax + finalBusinessTax + finalTariff;

    // 5. 战争赔款加成部分
    // NOTE: processInstallmentPayment() already recorded the base amount with 'installment_payment_income'
    // [FIX] 方案B：战争赔款也不应该凭空增加银?
    // processInstallmentPayment() 已经记录了基础金额
    // 不应该再通过 incomePercentMultiplier 凭空增加

    // Update rates for display (base amount was already added in processInstallmentPayment)
    if (warIndemnityIncome > 0) {
        rates.silver = (rates.silver || 0) + warIndemnityIncome;
    }

    // 6. 政令收入
    if (decreeSilverIncome > 0) {
        applySilverChange(decreeSilverIncome, 'income_policy');
        rates.silver = (rates.silver || 0) + decreeSilverIncome;
    }

    // 7. 政令支出 (此前未扣除，现修?
    if (decreeSilverExpense > 0) {
        const expense = Math.min(res.silver || 0, decreeSilverExpense);
        if (expense > 0) {
            applySilverChange(-expense, 'expense_policy');
            rates.silver = (rates.silver || 0) - expense;
        }
    }

    taxBreakdown.policyIncome = decreeSilverIncome;
    taxBreakdown.policyExpense = decreeSilverExpense;

    // 8. Virtual tax income from ideologies (phantom silver, not taken from any stratum)
    const virtualTaxRate = Math.min(bonuses.virtualTaxIncome || 0, 0.5);
    let virtualTaxIncome = 0;
    if (virtualTaxRate > 0 && totalCollectedTax > 0) {
        virtualTaxIncome = totalCollectedTax * virtualTaxRate;
        // Cap based on current tax revenue, NOT treasury balance (prevents exponential growth)
        const virtualTaxCap = Math.max(10000, totalCollectedTax * 0.5);
        virtualTaxIncome = Math.min(virtualTaxIncome, virtualTaxCap);
        applySilverChange(virtualTaxIncome, 'income_ideology_virtual_tax');
        rates.silver = (rates.silver || 0) + virtualTaxIncome;
    }
    taxBreakdown.virtualTaxIncome = virtualTaxIncome;

    // [FIX] totalFiscalIncome 不应该乘?incomePercentMultiplier
    // 因为税收和战争赔款都已经是实际入库金?
    const totalFiscalIncome = totalCollectedTax + warIndemnityIncome;

    const priceControlIncome = taxBreakdown.priceControlIncome || 0;
    const priceControlExpense = taxBreakdown.priceControlExpense || 0;

    // Price control income is added to silver here (expense was deducted in real-time)
    if (priceControlIncome !== 0) {
        applySilverChange(priceControlIncome, 'income_price_control');
        rates.silver = (rates.silver || 0) + priceControlIncome;
    }

    const netTax = totalCollectedTax
        - taxBreakdown.subsidy
        - tariffSubsidy // 关税补贴支出
        + warIndemnityIncome
        + decreeSilverIncome
        - decreeSilverExpense
        + priceControlIncome
        - priceControlExpense;
    const taxes = {
        total: netTax,
        efficiency,
        breakdown: {
            headTax: collectedHeadTax,
            industryTax: collectedIndustryTax,
            businessTax: collectedBusinessTax,
            tariff: collectedTariff, // 新增：关税收?
            tariffSubsidy, // 新增：关税补贴支?
            subsidy: taxBreakdown.subsidy,
            warIndemnity: warIndemnityIncome,
            policyIncome: decreeSilverIncome,
            policyExpense: decreeSilverExpense,
            priceControlIncome: priceControlIncome,
            priceControlExpense: priceControlExpense,
            tradeRouteTax: 0,
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

    _silverCheckpoint('fiscal+corruption');

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
    // [PERF] 切片轮转：每tick结算一个切片，切片数作为倍率补偿轮转间隔
    if (foreignInvestments.length > 0) {
        perfStart('foreignInvestments');
        // 切片化：将外资企业列表分成 fiSliceCount 个切片，每tick只处理一个
        const fiSlicedInvestments = getSlice(updatedForeignInvestments, fiSliceCount);
        // 实际切片数：当投资数 <= 切片数时退化为全量（ticksElapsed=1）
        const fiEffectiveSlices = (foreignInvestments.length <= fiSliceCount) ? 1 : fiSliceCount;

        const fiResult = processForeignInvestments({
            foreignInvestments: fiSlicedInvestments,
            nations: updatedNations, // Use updated nations
            organizations: diplomacyOrganizations?.organizations || [],
            playerMarket: { prices: updatedPrices },
            playerResources: res,
            foreignInvestmentPolicy,
            foreignInvestmentPolicyOverrides,
            taxPolicies: policies,
            daysElapsed: tick,
            jobFill: buildingJobFill,
            buildings: builds,
            ticksElapsed: fiEffectiveSlices, // 切片化：用切片数替代原频率值作为倍率
        });

        // 合并更新：切片结果只包含本切片的投资，需与未处理的投资合并
        if (fiEffectiveSlices <= 1) {
            // 全量模式：直接使用返回结果
            updatedForeignInvestments = fiResult.updatedInvestments;
        } else {
            // 切片模式：将切片结果合并回完整列表
            const updatedMap = new Map(fiResult.updatedInvestments.map(inv => [inv.id, inv]));
            updatedForeignInvestments = updatedForeignInvestments.map(inv => updatedMap.get(inv.id) || inv);
        }

        if (fiResult.taxRevenue > 0) {
            applySilverChange(fiResult.taxRevenue, 'foreign_investment_tax');
            taxBreakdown.foreignInvestmentTax = (taxBreakdown.foreignInvestmentTax || 0) + fiResult.taxRevenue;
        }
        if (fiResult.tariffRevenue > 0) {
            applySilverChange(fiResult.tariffRevenue, 'foreign_investment_tariff');
            taxBreakdown.tariff = (taxBreakdown.tariff || 0) + fiResult.tariffRevenue;
        }
        if (fiResult.tariffSubsidy > 0) {
            applySilverChange(-fiResult.tariffSubsidy, 'foreign_investment_tariff_subsidy');
            taxBreakdown.tariffSubsidy = (taxBreakdown.tariffSubsidy || 0) + fiResult.tariffSubsidy;
        }

        // Apply market changes (from foreign operation)
        // 注意：marketChanges 的 delta 未乘 ticksElapsed（仅乘了 count），切片化后行为不变
        if (fiResult.marketChanges) {
            Object.entries(fiResult.marketChanges).forEach(([key, delta]) => {
                // [FIX] Silver produced by foreign investors belongs to them (profit), not the state treasury.
                if (key === 'silver') return;

                // [FIX] Use applyResourceChange to ensure tracking
                applyResourceChange(key, delta, 'autonomous_investment_return');
            });
        }

        // 处理税率政策对外交关系的影响
        if (fiResult.relationChanges && fiResult.relationChanges.length > 0) {
            const policyLabel = {
                preferential: '优惠税率', normal: '正常税率',
                increased_tax: '加税', heavy_tax: '重税'
            }[fiResult.currentPolicy] || fiResult.currentPolicy;

            fiResult.relationChanges.forEach(({ nationId, change }) => {
                const nation = updatedNations.find(n => n.id === nationId);
                if (nation) {
                    const oldRelation = nation.relation ?? 50;
                    nation.relation = Math.min(100, Math.max(0, oldRelation + change));
                    // 每月生成一次外交日志
                    if (tick % 30 === 0 && Math.abs(change * 30) >= 1) {
                    if (change < 0) {
                            logs.push(`⚠️ ${nation.name}对我国的外资${policyLabel}政策表示不满（关系${(change * 30).toFixed(0)}/月）`);
                        } else if (change > 0) {
                            logs.push(`✅ ${nation.name}对我国的外资${policyLabel}政策表示赞赏（关系+${(change * 30).toFixed(0)}/月）`);
                        }
                    }
                }
            });
        }

        perfEnd('foreignInvestments');
    }

    // Foreign Upgrades - 保持低频独立执行，不随利润结算切片化
    if (foreignInvestments.length > 0 && shouldUpgradeForeignInvestment) {
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
            upgradeResult.upgrades.forEach(u => {
                const nation = updatedNations.find(n => n.id === u.ownerNationId);
                if (nation) {
                    nation.wealth = Math.max(0, (nation.wealth || 0) - u.cost);
                }
            });
        }
        perfEnd('foreignUpgrades');
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

    // Calculate diplomatic reputation with policy effects
    // Reputation changes based on: natural recovery + vassal policies + treaties
    let updatedDiplomaticReputation = diplomaticReputation;

    // Get player's vassals
    const playerVassals = updatedNations.filter(n => n.vassalOf === 'player' && n.vassalPolicy);

    // Calculate vassal policy reputation change (applied daily but scaled down)
    if (playerVassals.length > 0) {
        const vassalEffect = calculateVassalPolicyReputationChange(playerVassals);
        // Apply 1/30th of monthly effect daily
        const dailyVassalEffect = vassalEffect.change / 30;
        updatedDiplomaticReputation += dailyVassalEffect;
    }

    // Get active peaceful treaties for reputation bonus
    const peacefulTreatyCount = updatedNations.reduce((count, nation) => {
        if (!nation.treaties || !Array.isArray(nation.treaties)) return count;
        const peacefulTreaties = nation.treaties.filter(t =>
            (t.type === 'peace' || t.type === 'non_aggression' || t.type === 'mutual_defense') &&
            (!Number.isFinite(t.endDay) || tick < t.endDay)
        );
        return count + peacefulTreaties.length;
    }, 0);

    // Apply treaty reputation bonus (scaled daily)
    if (peacefulTreatyCount > 0) {
        const monthlyTreatyBonus = Math.min(peacefulTreatyCount * 0.1, 0.5);
        updatedDiplomaticReputation += monthlyTreatyBonus / 30;
    }

    // V2: 理念外交影响力修正（diplomatic_influence）
    if (bonuses.ideoDiplomaticInfluence) {
        // 正值=声望向上偏移，负值=向下偏移（每日微量）
        updatedDiplomaticReputation += bonuses.ideoDiplomaticInfluence / 30;
    }

    // Apply natural recovery (towards 50)
    updatedDiplomaticReputation = calculateNaturalRecovery(updatedDiplomaticReputation);

    // Clamp to valid range
    updatedDiplomaticReputation = Math.max(0, Math.min(100, updatedDiplomaticReputation));

    // ============ Ideology Event Bus: C~G class batch emits ============
    // Emit economy/population/stability/time events based on current tick state.
    // Uses a single block at tick end to avoid scattering emits throughout the 8000+ line file.
    {
        const _t = tick;
        const _livingLevelOrder = ['赤贫', '贫困', '温饱', '小康', '富裕', '奢华'];
        const _getLivingLevelRank = (level) => {
            const index = _livingLevelOrder.indexOf(level);
            return index >= 0 ? index : -1;
        };
        // G. Time / Cycle
        if (_t > 0 && _t % 360 === 0) {
            ideologyEventBus.emit(IDEOLOGY_EVENTS.ON_YEAR_END, { year: Math.floor(_t / 360) }, _t);
        }
        if (_t > 0 && _t % 90 === 0) {
            ideologyEventBus.emit(IDEOLOGY_EVENTS.ON_SEASON_CHANGE, { season: Math.floor((_t % 360) / 90) }, _t);
        }

        // C. Economy / Trade
        const _completedTrades = updatedMerchantState?.completedTrades || [];
        if (_completedTrades.length > 0) {
            const _totalProfit = _completedTrades.reduce((s, t) => s + (t.profit || 0), 0);
            ideologyEventBus.emit(IDEOLOGY_EVENTS.ON_TRADE_COMPLETE, {
                tradeCount: _completedTrades.length, totalProfit: _totalProfit
            }, _t);
        }
        // Tax collection (emit once per 30 days to avoid spam)
        if (_t > 0 && _t % 30 === 0 && taxes) {
            const _totalTax = Object.values(taxes).reduce((s, v) => s + (v || 0), 0);
            if (_totalTax > 0) {
                ideologyEventBus.emit(IDEOLOGY_EVENTS.ON_TAX_COLLECT, { totalTax: _totalTax, taxes }, _t);
            }
            const _totalSubsidy = Math.max(0, taxes?.breakdown?.subsidy || 0);
            if (_totalSubsidy > 0) {
                ideologyEventBus.emit(IDEOLOGY_EVENTS.ON_SUBSIDY_PAID, { totalSubsidy: _totalSubsidy }, _t);
            }
        }
        // Treasury milestones (every 5000 silver threshold)
        const _prevSilver = resources?.silver || 0;
        const _curSilver = res?.silver || 0;
        const _treasuryMilestoneStep = scaleLegacyMilestoneThreshold({
            threshold: 5000,
            type: 'treasury',
            context: buildIdeologyScalingContext({
                epoch,
                ideologyMetrics,
                population: nextPopulation || population || 0,
                totalBuildings: Object.values(buildings || {}).reduce((sum, count) => sum + (count || 0), 0),
                militarySize: Object.values(army || {}).reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0),
                vassalCount: (nations || []).filter(n => n.vassalOf === 'player' || n.isAnnexed).length,
            }),
        });
        const _prevMilestone = Math.floor(_prevSilver / _treasuryMilestoneStep);
        const _curMilestone = Math.floor(_curSilver / _treasuryMilestoneStep);
        if (_curMilestone > _prevMilestone && _curSilver > 0) {
            ideologyEventBus.emit(IDEOLOGY_EVENTS.ON_TREASURY_MILESTONE, {
                treasury: _curSilver, milestone: _curMilestone * _treasuryMilestoneStep
            }, _t);
        }

        // D. Population / Society
        // Population milestones (every 100 pop)
        const _populationMilestoneStep = scaleLegacyMilestoneThreshold({
            threshold: 100,
            type: 'population',
            context: buildIdeologyScalingContext({
                epoch,
                ideologyMetrics,
                population: nextPopulation || population || 0,
                totalBuildings: Object.values(buildings || {}).reduce((sum, count) => sum + (count || 0), 0),
                militarySize: Object.values(army || {}).reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0),
                vassalCount: (nations || []).filter(n => n.vassalOf === 'player' || n.isAnnexed).length,
            }),
        });
        const _prevPopMilestone = Math.floor((population || 0) / _populationMilestoneStep);
        const _curPopMilestone = Math.floor((nextPopulation || 0) / _populationMilestoneStep);
        if (_curPopMilestone > _prevPopMilestone && nextPopulation > 0) {
            ideologyEventBus.emit(IDEOLOGY_EVENTS.ON_POP_MILESTONE, {
                population: nextPopulation, milestone: _curPopMilestone * _populationMilestoneStep
            }, _t);
        }
        if (starvationDeaths > 0) {
            ideologyEventBus.emit(IDEOLOGY_EVENTS.ON_STARVATION, {
                deaths: starvationDeaths,
                severity: starvationDeaths >= Math.max(10, Math.floor((nextPopulation || 0) * 0.02)) ? 'severe' : 'minor',
            }, _t);
        }
        const _previousLivingStandards = currentClassLivingStandard || {};
        const _allLivingStrata = new Set([
            ...Object.keys(_previousLivingStandards),
            ...Object.keys(classLivingStandard || {}),
        ]);
        _allLivingStrata.forEach((stratumKey) => {
            const fromLevel = _previousLivingStandards?.[stratumKey]?.level;
            const toLevel = classLivingStandard?.[stratumKey]?.level;
            if (!fromLevel || !toLevel || fromLevel === toLevel) return;
            ideologyEventBus.emit(IDEOLOGY_EVENTS.ON_LIVING_STANDARD_CHANGE, {
                stratumKey,
                fromLevel,
                toLevel,
                direction: _getLivingLevelRank(toLevel) >= _getLivingLevelRank(fromLevel) ? 'up' : 'down',
            }, _t);
        });
        Object.entries(classApproval || {}).forEach(([stratumKey, approval]) => {
            const previousValue = previousApproval?.[stratumKey] ?? 100;
            if (previousValue >= 40 && approval < 40) {
                ideologyEventBus.emit(IDEOLOGY_EVENTS.ON_CLASS_APPROVAL_LOW, {
                    stratumKey,
                    approval,
                    previousApproval: previousValue,
                }, _t);
            }
        });

        // E. Stability / Politics
        // Stability crisis (dropped below 25) or high stability (above 75)
        if (stabilityValue <= 25 && currentStability > 25) {
            ideologyEventBus.emit(IDEOLOGY_EVENTS.ON_STABILITY_CRISIS, { stability: stabilityValue }, _t);
        }
        if (stabilityValue >= 75 && currentStability < 75) {
            ideologyEventBus.emit(IDEOLOGY_EVENTS.ON_STABILITY_HIGH, { stability: stabilityValue }, _t);
        }
        const _previousLegitimacy = previousLegitimacy ?? coalitionLegitimacy ?? 50;
        const _currentLegitimacy = coalitionLegitimacy ?? _previousLegitimacy;
        if (Math.abs(_currentLegitimacy - _previousLegitimacy) >= 5) {
            ideologyEventBus.emit(IDEOLOGY_EVENTS.ON_LEGITIMACY_CHANGE, {
                legitimacy: _currentLegitimacy,
                previousLegitimacy: _previousLegitimacy,
                delta: _currentLegitimacy - _previousLegitimacy,
            }, _t);
        }

        // F. Diplomacy / International
        const _previousNationMap = new Map((nations || []).map(nation => [nation.id, nation]));
        const _previousVassals = new Set(
            (nations || [])
                .filter(nation => nation?.id && nation.vassalOf === 'player')
                .map(nation => nation.id)
        );
        (updatedNations || []).forEach((nation) => {
            if (!nation?.id || nation.id === 'player') return;
            const previousNation = _previousNationMap.get(nation.id);
            if (previousNation) {
                const relationDelta = (nation.relation || 0) - (previousNation.relation || 0);
                if (relationDelta >= 10) {
                    ideologyEventBus.emit(IDEOLOGY_EVENTS.ON_RELATION_IMPROVE, {
                        nationId: nation.id,
                        relation: nation.relation || 0,
                        delta: relationDelta,
                    }, _t);
                } else if (relationDelta <= -10) {
                    ideologyEventBus.emit(IDEOLOGY_EVENTS.ON_RELATION_HOSTILE, {
                        nationId: nation.id,
                        relation: nation.relation || 0,
                        delta: relationDelta,
                    }, _t);
                }
            }
            if (!_previousVassals.has(nation.id) && nation.vassalOf === 'player') {
                ideologyEventBus.emit(IDEOLOGY_EVENTS.ON_VASSAL_GAIN, {
                    nationId: nation.id,
                    relation: nation.relation || 0,
                }, _t);
            }
        });
    }

    const perfTotalMs = perfTime() - perfStartAll;
    // [OPTIMIZATION REMOVED] 移除游标递增逻辑，不再需要批处理
    perfMarkEnd('simulateTick');

    // [PERF] 记录tick完成时间，更新帧率统计
    recordTickComplete();

    // [DEV] 开发环境下每100tick输出性能分段执行/跳过摘要
    if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
        logTickSegments(tick, {
            officialsSim: typeof shouldUpdateOfficials !== 'undefined' ? shouldUpdateOfficials : true,
            cabinetMechanics: typeof shouldUpdateCabinet !== 'undefined' ? shouldUpdateCabinet : true,
            exodusAndPenalties: typeof shouldUpdateExodus !== 'undefined' ? shouldUpdateExodus : true,
            rebellionDaily: shouldUpdateRebellion,
            priceConvergence: shouldUpdatePriceConvergence,
            overseasInvestments: true, // 切片化后每tick都执行利润结算
            foreignInvestments: true, // 切片化后每tick都执行利润结算
            overseasInvestmentUpgrades: shouldUpgradeOverseasInvestment,
            foreignInvestmentUpgrades: shouldUpgradeForeignInvestment,
            aiNationUpdate: shouldUpdateAI,
            diplomacyAI: shouldUpdateDiplomacy,
        });
    }

    // 将建筑级实际发薪回写为全局工资镜像，兼容价格/招工/投资等依赖
    const mirroredWages = { ...updatedWages };
    const totalPaidByRole = {};
    const totalFilledByRole = {};
    Object.values(buildingFinancialData || {}).forEach((finance) => {
        if (!finance) return;
        Object.entries(finance.wagesByRole || {}).forEach(([role, paid]) => {
            if (!Number.isFinite(paid) || paid <= 0) return;
            totalPaidByRole[role] = (totalPaidByRole[role] || 0) + paid;
        });
        Object.entries(finance.filledByRole || {}).forEach(([role, filled]) => {
            if (!Number.isFinite(filled) || filled <= 0) return;
            totalFilledByRole[role] = (totalFilledByRole[role] || 0) + filled;
        });
    });
    Object.entries(totalFilledByRole).forEach(([role, totalFilled]) => {
        const totalPaid = totalPaidByRole[role] || 0;
        if (totalFilled <= 0) return;
        const avgPaid = totalPaid / totalFilled;
        if (Number.isFinite(avgPaid)) {
            mirroredWages[role] = parseFloat(avgPaid.toFixed(2));
        }
    });

    // [DIAGNOSTIC] Simulation internal audit check
    const simEndingSilver = res.silver || 0;
    const simActualDelta = simEndingSilver - startingSilver;
    const auditLogArr = silverChangeLog.toArray();
    const simAuditSum = auditLogArr.reduce((s, e) => s + Number(e?.amount || 0), 0);
    const simInternalGap = simActualDelta - simAuditSum;
    if (Math.abs(simInternalGap) > 0.1 && _simDebugEnabled) {
        debugLog('simulation', '🔴 [SIM内部审计] 差异:', simInternalGap.toFixed(2),
            '| 实际Δ:', simActualDelta.toFixed(2),
            '| 审计Σ:', simAuditSum.toFixed(2),
            '| 起始:', startingSilver.toFixed(2),
            '| 结束:', simEndingSilver.toFixed(2));
        debugLog('simulation', '🔴 [SIM内部审计] 各通道明细:', auditLogArr.map(e => `${e.reason}: ${Number(e.amount).toFixed(2)}`));
    }

    // [PERF] Pre-compute merged production input cost to avoid IIFE closure in return object
    const _mergedProductionInputCost = {};
    const _officialPIC = bonuses.officialProductionInputCost || {};
    const _stancePIC = bonuses.stanceProductionInputCost || {};
    const _picKeys = Object.keys(_officialPIC);
    for (let i = 0; i < _picKeys.length; i++) {
        _mergedProductionInputCost[_picKeys[i]] = (_officialPIC[_picKeys[i]] || 0) + (_stancePIC[_picKeys[i]] || 0);
    }
    const _stanceKeys = Object.keys(_stancePIC);
    for (let i = 0; i < _stanceKeys.length; i++) {
        if (!(_stanceKeys[i] in _mergedProductionInputCost)) {
            _mergedProductionInputCost[_stanceKeys[i]] = _stancePIC[_stanceKeys[i]] || 0;
        }
    }

    // [PERF] Pre-compute merged modifiers to avoid spread operators in return object
    // resourceDemand: merge decreeResourceDemandMod + eventResourceDemandModifiers
    const _mergedResourceDemand = {};
    for (const k in decreeResourceDemandMod) {
        if (Object.prototype.hasOwnProperty.call(decreeResourceDemandMod, k)) {
            _mergedResourceDemand[k] = decreeResourceDemandMod[k];
        }
    }
    for (const k in eventResourceDemandModifiers) {
        if (Object.prototype.hasOwnProperty.call(eventResourceDemandModifiers, k)) {
            _mergedResourceDemand[k] = (_mergedResourceDemand[k] || 0) + eventResourceDemandModifiers[k];
        }
    }

    // stratumDemand: merge decreeStratumDemandMod + eventStratumDemandModifiers
    const _mergedStratumDemand = {};
    for (const k in decreeStratumDemandMod) {
        if (Object.prototype.hasOwnProperty.call(decreeStratumDemandMod, k)) {
            _mergedStratumDemand[k] = decreeStratumDemandMod[k];
        }
    }
    for (const k in eventStratumDemandModifiers) {
        if (Object.prototype.hasOwnProperty.call(eventStratumDemandModifiers, k)) {
            _mergedStratumDemand[k] = (_mergedStratumDemand[k] || 0) + eventStratumDemandModifiers[k];
        }
    }

    // buildingProduction: merge buildingBonuses + eventBuildingProductionModifiers
    const _mergedBuildingProduction = {};
    for (const k in buildingBonuses) {
        if (Object.prototype.hasOwnProperty.call(buildingBonuses, k)) {
            _mergedBuildingProduction[k] = buildingBonuses[k];
        }
    }
    for (const k in eventBuildingProductionModifiers) {
        if (Object.prototype.hasOwnProperty.call(eventBuildingProductionModifiers, k)) {
            _mergedBuildingProduction[k] = (_mergedBuildingProduction[k] || 0) + (eventBuildingProductionModifiers[k] || 0);
        }
    }

    // diplomacyOrganizations: pre-merge to avoid spread in return
    const _mergedDiplomacyOrgs = diplomacyState
        ? { ...diplomacyState, organizations: updatedOrganizations }
        : { organizations: updatedOrganizations };

    return {
        officialsSimCursor: 0, // 保留字段以兼容旧存档，但不再使用
        _perf: {
            totalMs: perfTotalMs,
            sections: perfSections,
        },
        tradeOpportunities,
        overseasInvestments: updatedOverseasInvestments,
        foreignInvestments: updatedForeignInvestments,
        resources: res,
        rates,
        popStructure,
        maxPop: totalMaxPop,
        militaryCapacity, // 新增：军事容?
        population: nextPopulation,
        birthAccumulator,
        classApproval,
        approvalBreakdown: _shouldComputeFinancialDetail ? approvalBreakdown : null,
        classInfluence,
        classWealth: classWealthResult,
        classLivingStandard, // 各阶层生活水平数?
        totalInfluence,
        totalWealth,
        activeBuffs: newActiveBuffs,
        activeDebuffs: newActiveDebuffs,
        stability: stabilityValue,
        legitimacy: coalitionLegitimacy, // 执政联盟合法?
        legitimacyTaxModifier, // 税收修正系数
        effectiveTaxModifier, // 最终税收修正（含合法性、政策和额外加成）
        logs,
        vassalDiplomacyRequests,
        market: {
            prices: updatedPrices,
            demand,
            supply,
            wages: mirroredWages,
            needsShortages: classShortages,
            stratumConsumption, // NEW: Return actual consumption breakdown
            supplyBreakdown: { ...supplyBreakdown },    // [PERF] 浅拷贝复用对象
            demandBreakdown,    // NEW: Return demand breakdown
            resourceLossBreakdown: { ...resourceLossBreakdown }, // [PERF] 浅拷贝复用对象
        },
        classIncome: roleWagePayout,
        classExpense: { ...roleExpense }, // [PERF] 浅拷贝复用对象
        jobFill: buildingJobFill,
        jobsAvailable,
        buildingJobsRequired, // 每个建筑的实际岗位需求（考虑外资/官员减少业主岗位?
        taxes,
        classFinancialData: _shouldComputeFinancialDetail ? classFinancialData : null,
        buildingFinancialData: _shouldComputeFinancialDetail ? buildingFinancialData : null,
        buildingDebugData,  // DEBUG: Building production debug data
        dailyMilitaryExpense: armyExpenseResult,
        dailyInvestment: ledger.dailyInvestment || 0,
        dailyOwnerRevenue: ledger.dailyOwnerRevenue || 0,
        stateBuildingSilverOutput,
        needsShortages: classShortages,
        needsReport,
        starvationDeaths,
        livingStandardStreaks: updatedLivingStandardStreaks,
        nations: updatedNations,
        merchantState: updatedMerchantState,
        buildingUpgrades: updatedBuildingUpgrades, // Owner auto-upgrade results
        migrationCooldowns: updatedMigrationCooldowns, // 阶层迁移冷却状?
        migrationCooldowns: updatedMigrationCooldowns, // 阶层迁移冷却状?
        diplomacyOrganizations: _mergedDiplomacyOrgs,
        taxShock: updatedTaxShock, // [NEW] 各阶层累积税收冲击?
        // 加成修饰符数据，供UI显示"谁吃到了buff"
        modifiers: {
            // 需求修饰符（已预计算，避免 spread + Object.fromEntries 链式调用）
            resourceDemand: _mergedResourceDemand,
            stratumDemand: _mergedStratumDemand,
            // 供给修饰?
            resourceSupply: decreeResourceSupplyMod,
            // 建筑产出修饰?（已预计算）
            buildingProduction: _mergedBuildingProduction,
            categoryProduction: categoryBonuses,
            // 来源分解（用于显示哪些是政令/事件加成）
            sources: _shouldComputeFinancialDetail ? {
                decreeResourceDemand: decreeResourceDemandMod,
                decreeStratumDemand: decreeStratumDemandMod,
                decreeResourceSupply: decreeResourceSupplyMod,
                eventResourceDemand: eventResourceDemandModifiers,
                eventStratumDemand: eventStratumDemandModifiers,
                eventBuildingProduction: eventBuildingProductionModifiers,
                techBuildingBonus: buildingBonuses,
                techCategoryBonus: categoryBonuses,
                // 理念专属加成（从总加成中分离，供UI独立显示）
                ideologyCategoryBonus: _ideologyCategoryBonus,
                ideologyProductionBonus: _ideologyProductionBonus,
                ideologyIndustryBonus: _ideologyIndustryBonus,
                // 全局生产加成（来自政令和节日）
                productionBonus: productionBonus,
                industryBonus: industryBonus,
                // 军事加成
                militaryBonus: bonuses.militaryBonus,
                // 阶层财富增长对需求的影响（财富越高需求越高）
                // 阶层财富增长对需求的影响（财富越高需求越高）
                stratumWealthMultiplier: stratumWealthMultipliers,
                // 建筑原料消耗修正（官员效果 + 政治立场效果，累加合并）
                productionInputCost: _mergedProductionInputCost,
                // 战争经济：建筑战损统计和前线产出惩罚
                warDamagedBuildings: warDamagedBuildings || {},
                frontlineProductionPenalty: frontlineProductionPenalty || 0,
            } : null,
            // 官员效果修饰符（供外部使用）
            // V2: 理念 ruleMods 数据（供 hooks 层消费）
            ideologyRuleMods: {
                buildingCostMod: bonuses.ideoBuildingCostMod || {},
                recruitCostMod: bonuses.ideoRecruitCostMod || {},
                techCostMod: bonuses.ideoTechCostMod || 0,
                taxModifier: bonuses.ideoTaxModifier || 0,
                cooldownMod: bonuses.ideoCooldownMod || 0,
                officialBonus: bonuses.ideoOfficialBonusMod || 0,
                unitAttackMod: bonuses.ideoUnitAttackMod || {},
                unitDefenseMod: bonuses.ideoUnitDefenseMod || {},
            },
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
        // Ideology engine results
        activeRuleMods: ideologyRuleMods,
        mechanicEffects: ideologySynergyResult?.mechanicEffects || {},
        army, // 确保返回army状态，以便保存战斗损失
        militaryCorps, // [NEW] 军团状?
        generals, // [NEW] 将领状?
        activeFronts, // [NEW] 活跃战线
        _cleanedNationIds: cleanedNationIds,
        activeBattles, // [NEW] 进行中的战斗
        officials: updatedOfficials, // 更新后的官员列表（含财务数据?
        // 计算有效官员容量（基于时代、政体、科技和理念）
        effectiveOfficialCapacity: calculateOfficialCapacity(epoch, currentPolityEffects || {}, techsUnlocked, bonuses.ideoOfficialCapacityBonus || 0),
        buildings: _buildingsModified ? builds : null, // [FIX] Only return when actually modified to prevent unnecessary state updates
        lastMinisterExpansionDay: nextLastMinisterExpansionDay,
        diplomaticReputation: updatedDiplomaticReputation, // [NEW] Return updated diplomatic reputation
        // [PERF] Only serialize full audit log in debug mode; otherwise return aggregated totals only.
        // The full toArray() creates dozens of objects per tick that are immediately structured-cloned.
        _auditLog: _simDebugEnabled ? silverChangeLog.toArray() : auditLogArr,
        _auditStartingSilver: startingSilver,
        _auditEndingSilver: res.silver || 0,
        _auditSilverAtSpread: _simDebugEnabled ? _resSilverAtSpread : undefined,
        _debug: _simDebugEnabled ? {
            freeMarket: _freeMarketDebug,
            classWealthChangeLog,
            startingSilver,
            endingSilver: res.silver || 0,
            militaryDebugInfo: militaryDebug,
        } : null,
    };
};




