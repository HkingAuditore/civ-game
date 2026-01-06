import { BUILDINGS, STRATA, EPOCHS, RESOURCES, TECHS, ECONOMIC_INFLUENCE, WEALTH_DECAY_RATE } from '../config';
import { calculateArmyPopulation, calculateArmyFoodNeed, calculateArmyCapacityNeed, calculateArmyMaintenance, calculateArmyScalePenalty } from '../config';
import { getBuildingEffectiveConfig, getUpgradeCost, getMaxUpgradeLevel, BUILDING_UPGRADES } from '../config/buildingUpgrades';
import { isResourceUnlocked } from '../utils/resources';
import { calculateForeignPrice } from '../utils/foreignTrade';
import { simulateBattle, UNIT_TYPES } from '../config/militaryUnits';
import { getEnemyUnitsForEpoch } from '../config/militaryActions';
import { calculateLivingStandardData, getSimpleLivingStandard, calculateWealthMultiplier, calculateLuxuryConsumptionMultiplier, calculateUnlockMultiplier } from '../utils/livingStandard';
import { calculateLivingStandards } from './population/needs';
import { applyBuyPriceControl, applySellPriceControl } from './officials/cabinetSynergy';
import { calculateAIGiftAmount, calculateAIPeaceTribute, calculateAISurrenderDemand } from '../utils/diplomaticUtils';
import { debugLog } from '../utils/debugFlags';
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
    processOwnerExpansions
} from './officials/cabinetSynergy'; // [FIX] Import directly from source
import {
    getInventoryTargetDaysMultiplier,
    getPopulationGrowthMultiplier,
    getArmyMaintenanceMultiplier
} from '../config/difficulty';
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
    checkAIBreakAlliance,
    processNationRelationDecay,
    // AI Economy functions
    updateAINationInventory,
    initializeAIDevelopmentBaseline,
    processAIIndependentGrowth,
    updateAIDevelopment,
    initializeRebelEconomy,
    processPostWarRecovery,
    processInstallmentPayment,
} from './diplomacy';

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
    tick = 0,
    techsUnlocked = [],
    activeFestivalEffects = [],
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
    buildingUpgrades = {}, // 建筑升级状态
    rulingCoalition = [], // 执政联盟成员阶层
    previousLegitimacy = 0, // 上一tick的合法性值，用于计算税收修正
    migrationCooldowns = {}, // 阶层迁移冷却状态

    difficulty, // 游戏难度设置
    officials = [], // 官员列表
    activeDecrees, // [NEW] Reform decrees
    officialsPaid = true, // 是否足额支付薪水
    quotaTargets = {}, // [NEW] Quota system targets for Left Dominance
    expansionSettings = {}, // [NEW] Expansion settings for Right Dominance
    cabinetStatus = {}, // [NEW] Cabinet status for synergy/dominance
    priceControls = null, // [NEW] 政府价格管制设置
    previousTaxShock = {}, // [NEW] 上一tick各阶层的累积税收冲击值，用于防止"快速抬税后降税"的漏洞
}) => {
    // console.log('[TICK START]', tick); // Commented for performance
    const res = { ...resources };
    const priceMap = { ...(market?.prices || {}) };
    // NEW: Track actual consumption by stratum for UI display
    const stratumConsumption = {};
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
                income: { wage: 0, ownerRevenue: 0, subsidy: 0 },
                expense: {
                    headTax: 0,
                    transactionTax: 0,
                    businessTax: 0,
                    tariffs: 0,
                    essentialNeeds: {},  // 基础需求消费 { resource: cost }
                    luxuryNeeds: {},     // 奢侈需求消费 { resource: cost }
                    decay: 0,
                    productionCosts: 0,
                    wages: 0  // 工资支出（业主支付给工人）
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
    const getHeadTaxRate = (key) => {
        const rate = headTaxRates[key];
        if (typeof rate === 'number') {
            return rate;
        }
        return 1;
    };
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

    // REFACTORED: Use imported function from ./buildings/effects
    const bonuses = initializeBonuses();

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

    // 应用官员效果（含薪水不足减益）
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

    // Apply festival effects using module function
    applyFestivalEffects(activeFestivalEffects, bonuses);

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
            if (classFinancialData[ownerKey]) {
                // Silver production is direct revenue
                classFinancialData[ownerKey].income.ownerRevenue = (classFinancialData[ownerKey].income.ownerRevenue || 0) + amount;
            }
            // Per-building realized owner revenue (if building context exists)
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
                    resources: res
                });
                if (pcResult.success) {
                    effectivePrice = pcResult.effectivePrice;
                }
            }

            const grossIncome = effectivePrice * amount;
            // Note: Tax is handled on consumption side generally for 'Resource Tax', 
            // but we might want to consider if 'Sales Tax' applies. 
            // Current login assumes getResourceTaxRate is consumption tax.

            let netIncome = grossIncome;

            // 记录owner的净销售收入（在tick结束时统一结算到wealth）
            roleWagePayout[ownerKey] = (roleWagePayout[ownerKey] || 0) + netIncome;

            // Per-building realized owner revenue (if building context exists)
            if (currentBuildingId && buildingFinancialData[currentBuildingId]) {
                buildingFinancialData[currentBuildingId].ownerRevenue += netIncome;
            }

            // NEW: Detailed tracking
            if (classFinancialData[ownerKey]) {
                // Track net income as owner revenue (profit from sales)
                classFinancialData[ownerKey].income.ownerRevenue = (classFinancialData[ownerKey].income.ownerRevenue || 0) + netIncome;
            }
        }
    };

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
        Object.entries(roleWagePayout).forEach(([role, payout]) => {
            if (payout <= 0) {
                directIncomeApplied[role] = payout;
                return;
            }
            const alreadyApplied = directIncomeApplied[role] || 0;
            const netPayout = payout - alreadyApplied;
            if (netPayout > 0) {
                // [FIX] Apply safe wealth limit to prevent overflow
                wealth[role] = safeWealth((wealth[role] || 0) + netPayout);
            }
            directIncomeApplied[role] = payout;
        });
    };

    // console.log('[TICK] Processing buildings...'); // Commented for performance
    BUILDINGS.forEach(b => {
        const count = builds[b.id] || 0;
        if (count > 0) {
            // buildingUpgrades[b.id] 格式为 { 等级: 数量 }，例如 { "1": 2, "2": 1 }
            // 表示 2个1级建筑，1个2级建筑
            const levelCounts = buildingUpgrades[b.id] || {};

            // 计算已升级的建筑数量
            let upgradedCount = 0;
            Object.entries(levelCounts).forEach(([lvlStr, lvlCount]) => {
                const lvl = parseInt(lvlStr);
                if (Number.isFinite(lvl) && lvl > 0 && lvlCount > 0) {
                    upgradedCount += lvlCount;
                }
            });

            // 0级（未升级）的数量 = 总数 - 已升级数量
            const level0Count = Math.max(0, count - upgradedCount);

            // 构建完整的等级分布，用于后续遍历
            const fullLevelCounts = { 0: level0Count };
            Object.entries(levelCounts).forEach(([lvlStr, lvlCount]) => {
                const lvl = parseInt(lvlStr);
                if (Number.isFinite(lvl) && lvl > 0 && lvlCount > 0) {
                    fullLevelCounts[lvl] = lvlCount;
                }
            });

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

    // Calculate potential resources: resources from buildings that are unlocked (can be built)
    const potentialResources = new Set();
    BUILDINGS.forEach(b => {
        // Check if building is unlocked: epoch requirement met AND tech requirement met (if any)
        const epochUnlocked = (b.epoch ?? 0) <= epoch;
        const techUnlocked = !b.requiresTech || techsUnlocked.includes(b.requiresTech);

        if (epochUnlocked && techUnlocked && b.output) {
            Object.entries(b.output).forEach(([resKey, amount]) => {
                if (!RESOURCES[resKey]) return;
                if ((amount || 0) > 0) {
                    potentialResources.add(resKey);
                }
            });
        }
    });

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

    // 职业持久化：基于上一帧状态进行增减，而非每帧重置
    // console.log('[TICK] Starting population allocation...'); // Commented for performance
    const hasPreviousPopStructure = previousPopStructure && Object.keys(previousPopStructure).length > 0;
    const popStructure = {};

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
                wealth[role] = Math.max(0, roleWealth - transfer);
                wealth.unemployed = (wealth.unemployed || 0) + transfer;
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

    // 自动填补（招工）：使用 job.js 中的 fillVacancies 函数，支持阶层流动
    const filledResult = fillVacancies({
        popStructure,
        jobsAvailable,
        wealth,
        getExpectedWage,
        getHeadTaxRate,
        effectiveTaxModifier
    });

    // 重新赋值更新后的人口结构和财富
    // 注意：fillVacancies 会直接修改传入的对象引用，但在 React/Redux 模式下通常建议返回新对象
    // 这里 fillVacancies 返回了 { popStructure, wealth }，我们将其解构回来确保引用正确
    // (虽然 simulation.js 中 popStructure 和 wealth 是局部变量，可以直接修改)
    // 保持代码清晰：
    // const { popStructure: updatedPop, wealth: updatedWealth } = filledResult;

    const classApproval = {};
    const classInfluence = {};
    const classWealthResult = {};
    const logs = [];
    const buildingJobFill = {};
    const buildingStaffingRatios = {};

    Object.entries(passiveGains).forEach(([resKey, amountPerDay]) => {
        if (!amountPerDay) return;
        const gain = amountPerDay;
        const current = res[resKey] || 0;
        if (gain >= 0) {
            res[resKey] = current + gain;
            rates[resKey] = (rates[resKey] || 0) + gain;
        } else {
            const needed = Math.abs(gain);
            const spent = Math.min(current, needed);
            if (spent > 0) {
                res[resKey] = current - spent;
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
            res[resKey] = current + gain;
            rates[resKey] = (rates[resKey] || 0) + gain;
        } else {
            const needed = Math.abs(gain);
            const spent = Math.min(current, needed);
            if (spent > 0) {
                res[resKey] = current - spent;
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
                res[resKey] = (res[resKey] || 0) + modification;
                rates[resKey] = currentRate + modification;
            } else {
                // Consumption resource: positive percent = less consumption (better)
                res[resKey] = (res[resKey] || 0) - modification;
                rates[resKey] = currentRate - modification;
            }
        } else {
            // If rate is 0, use a base value scaled by population for the modifier
            const baseValue = totalPopulation * 0.01; // 1% of population as base
            const modification = baseValue * percent;
            res[resKey] = (res[resKey] || 0) + modification;
            rates[resKey] = (rates[resKey] || 0) + modification;
        }
    });

    const zeroApprovalClasses = {};
    // 允许负的 needsReduction (即增加需求)，下限设为 -2 (需求翻3倍)，上限 0.95
    const effectiveNeedsReduction = Math.max(-2, Math.min(0.95, needsReduction || 0));
    const needsRequirementMultiplier = 1 - effectiveNeedsReduction;

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
        if (due !== 0) {
            if (due > 0) {
                const paid = Math.min(available, due);
                wealth[key] = available - paid;
                taxBreakdown.headTax += paid;
                // 记录人头税支出
                roleHeadTaxPaid[key] = (roleHeadTaxPaid[key] || 0) + paid;
                roleExpense[key] = (roleExpense[key] || 0) + paid;
                if (classFinancialData[key]) {
                    classFinancialData[key].expense.headTax = (classFinancialData[key].expense.headTax || 0) + paid;
                }
            } else {
                const subsidyNeeded = -due;
                const treasury = res.silver || 0;
                if (treasury >= subsidyNeeded) {
                    res.silver = treasury - subsidyNeeded;
                    // [FIX] Apply safe wealth limit to prevent overflow
                    wealth[key] = safeWealth(available + subsidyNeeded);
                    taxBreakdown.subsidy += subsidyNeeded;
                    // 记录政府补助收入
                    roleWagePayout[key] = (roleWagePayout[key] || 0) + subsidyNeeded;

                    if (classFinancialData[key]) {
                        classFinancialData[key].income.subsidy = (classFinancialData[key].income.subsidy || 0) + subsidyNeeded;
                    }
                }
            }
        }
        classApproval[key] = previousApproval[key] ?? 50;
        if ((classApproval[key] || 0) <= 0) {
            zeroApprovalClasses[key] = true;
        }
    });

    const forcedLabor = !!(activeDecrees && activeDecrees.forced_labor);

    // console.log('[TICK] Starting production loop...'); // Commented for performance
    BUILDINGS.forEach(b => {
        const count = builds[b.id] || 0;
        if (count === 0) return;

        // --- 计算升级加成后的基础数值 ---
        // buildingUpgrades[b.id] 格式为 { 等级: 数量 }，例如 { "1": 2, "2": 1 }
        const storedLevelCounts = buildingUpgrades[b.id] || {};
        const effectiveOps = { input: {}, output: {}, jobs: {} };

        // 计算已升级的建筑数量
        let upgradedCount = 0;
        let hasUpgrades = false;
        Object.entries(storedLevelCounts).forEach(([lvlStr, lvlCount]) => {
            const lvl = parseInt(lvlStr);
            if (Number.isFinite(lvl) && lvl > 0 && lvlCount > 0) {
                upgradedCount += lvlCount;
                hasUpgrades = true;
            }
        });

        // 0级（未升级）的数量 = 总数 - 已升级数量
        const level0Count = Math.max(0, count - upgradedCount);

        // 构建完整的等级分布
        const levelCounts = { 0: level0Count };
        Object.entries(storedLevelCounts).forEach(([lvlStr, lvlCount]) => {
            const lvl = parseInt(lvlStr);
            if (Number.isFinite(lvl) && lvl > 0 && lvlCount > 0) {
                levelCounts[lvl] = lvlCount;
            }
        });

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
        // Each wage plan may include ownerKey so we can apply per-owner distribution ratios
        // when actually paying wages.
        if (Object.keys(effectiveOps.jobs).length > 0) {
            buildingJobFill[b.id] = buildingJobFill[b.id] || {};
            for (let role in effectiveOps.jobs) {
                const roleRequired = effectiveOps.jobs[role];
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
                if (!Object.keys(ownerLevelGroups).includes(role) && roleFilled > 0) {
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
            if (totalSlots > 0) staffingRatio = filledSlots / totalSlots;
            if (totalSlots > 0) {
                buildingStaffingRatios[b.id] = staffingRatio;
            }
            if (totalSlots > 0 && filledSlots <= 0) {
                return;
            }
        }

        multiplier *= staffingRatio;

        if (forcedLabor && (b.jobs?.serf || b.jobs?.miner)) {
            multiplier *= 1.2;
        }

        const baseMultiplier = multiplier;
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
                const requiredAtBase = perMultiplierAmount * baseMultiplier;
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
        if (b.cat === 'gather' && resourceLimit === 0 && Object.keys(effectiveOps.input).length > 0) {
            // 进入低效模式：20%效率，不消耗原料
            targetMultiplier = baseMultiplier * 0.2;
            isInLowEfficiencyMode = true;
            inputCostPerMultiplier = 0; // 低效模式下不消耗原料，因此成本为0

            // 添加日志提示（每个建筑类型只提示一次，避免刷屏）
            const inputNames = Object.keys(effectiveOps.input).map(k => RESOURCES[k]?.name || k).join('、');
            if (tick % 30 === 0) { // 每30个tick提示一次
                logs.push(`⚠️ ${b.name} 缺少 ${inputNames}，工人正在徒手作业（效率20%）`);
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

        const baseWageCostPerMultiplier = baseMultiplier > 0 ? expectedWageBillBase / baseMultiplier : expectedWageBillBase;
        const estimatedRevenue = outputValuePerMultiplier * targetMultiplier;
        const estimatedInputCost = inputCostPerMultiplier * targetMultiplier;
        const baseWageCost = baseWageCostPerMultiplier * targetMultiplier;
        const valueAvailableForLabor = Math.max(0, estimatedRevenue - estimatedInputCost);
        const wageCoverage = baseWageCost > 0 ? valueAvailableForLabor / baseWageCost : 1;
        const wagePressure = (() => {
            if (!Number.isFinite(wageCoverage)) return 1;
            if (wageCoverage >= 1) {
                return Math.min(1.4, 1 + (wageCoverage - 1) * 0.35);
            }
            return Math.max(0.65, 1 - (1 - wageCoverage) * 0.5);
        })();
        const wageCostPerMultiplier = baseWageCostPerMultiplier * wagePressure;
        const estimatedWageCost = wageCostPerMultiplier * targetMultiplier;

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
        const estimatedBusinessTax = businessTaxPerBuilding * count * targetMultiplier;

        const totalOperatingCostPerMultiplier = inputCostPerMultiplier + wageCostPerMultiplier;
        let actualMultiplier = targetMultiplier;
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

            // 将营业税计入总成本（只考虑正税，补贴不计入成本）
            const estimatedCost = estimatedInputCost + actualPayableWageCost + Math.max(0, estimatedBusinessTax);
            if (estimatedCost > 0 && estimatedRevenue <= 0) {
                actualMultiplier = 0;
                debugMarginRatio = 0;
            } else if (estimatedCost > 0 && estimatedRevenue < estimatedCost * 0.98) {
                const marginRatio = Math.max(0, Math.min(1, estimatedRevenue / estimatedCost));
                debugMarginRatio = marginRatio;
                actualMultiplier = targetMultiplier * marginRatio;
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
            actualMultiplier = Math.min(actualMultiplier, Math.max(0, affordableMultiplier));
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
        if (Object.keys(effectiveOps.jobs).length > 0) {
            Object.keys(effectiveOps.jobs).forEach(role => {
                if (zeroApprovalClasses[role]) {
                    approvalMultiplier = Math.min(approvalMultiplier, zeroApprovalFactor);
                }
            });
        }
        actualMultiplier *= approvalMultiplier;

        const utilization = baseMultiplier > 0 ? Math.min(1, actualMultiplier / baseMultiplier) : 0;
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
                                res.silver -= subsidyAmount;
                                taxBreakdown.subsidy += subsidyAmount;
                                totalCost -= subsidyAmount;
                                roleWagePayout[ownerKey] = (roleWagePayout[ownerKey] || 0) + subsidyAmount;
                                if (classFinancialData[ownerKey]) {
                                    classFinancialData[ownerKey].income.subsidy = (classFinancialData[ownerKey].income.subsidy || 0) + subsidyAmount;
                                }
                            }
                        } else if (taxPaid > 0) {
                            taxBreakdown.industryTax += taxPaid;
                            totalCost += taxPaid;
                            if (classFinancialData[ownerKey]) {
                                classFinancialData[ownerKey].expense.transactionTax = (classFinancialData[ownerKey].expense.transactionTax || 0) + taxPaid;
                            }
                        }

                        wealth[ownerKey] = Math.max(0, (wealth[ownerKey] || 0) - totalCost);
                        roleExpense[ownerKey] = (roleExpense[ownerKey] || 0) + totalCost;

                        // Per-building realized production input costs
                        buildingFinancialData[b.id].productionCosts += totalCost;

                        if (classFinancialData[ownerKey]) {
                            classFinancialData[ownerKey].expense.productionCosts = (classFinancialData[ownerKey].expense.productionCosts || 0) + totalCost;
                        }
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

        if (Object.keys(effectiveOps.jobs).length > 0) {
            Object.entries(effectiveOps.jobs).forEach(([role, totalAmount]) => {
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
                levelWagePressure = Math.min(1.4, 1 + (coverage - 1) * 0.35);
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

                wealth[oKey] = available - paid;
                roleExpense[oKey] = (roleExpense[oKey] || 0) + paid;

                if (classFinancialData[oKey]) {
                    classFinancialData[oKey].expense.wages = (classFinancialData[oKey].expense.wages || 0) + paid;
                }

                ownerPaidRatio[oKey] = ownerBill > 0 ? paid / ownerBill : 0;
            });
        }

        // Pay wages following building-level "distribution" (owner-paid-ratio).
        // Also update wage stats by the ACTUAL average wage paid for this role.
        preparedWagePlans.forEach(plan => {
            const ratio = ownerPaidRatio[plan.ownerKey] ?? 0;
            const actualSlotWage = plan.expectedSlotWage * ratio;

            // Stats: use actualSlotWage (NOT theoretical expected wage)
            roleWageStats[plan.role].weightedWage += actualSlotWage * plan.roleSlots;

            if (plan.filled > 0 && actualSlotWage > 0) {
                const payout = actualSlotWage * plan.filled;

                // Per-building wage totals (for UI)
                buildingFinancialData[b.id].wagesByRole[plan.role] =
                    (buildingFinancialData[b.id].wagesByRole[plan.role] || 0) + payout;

                roleWagePayout[plan.role] = (roleWagePayout[plan.role] || 0) + payout;
                if (classFinancialData[plan.role]) {
                    classFinancialData[plan.role].income.wage = (classFinancialData[plan.role].income.wage || 0) + payout;
                }
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
                    res[resKey] = (res[resKey] || 0) + amount;
                }
            }
        }

        // 营业税收取：每次建筑产出时收取固定银币值
        // businessTaxPerBuilding 已在上面声明，直接使用
        if (businessTaxPerBuilding !== 0 && count > 0) {
            const totalBusinessTax = businessTaxPerBuilding * count * actualMultiplier;

            if (totalBusinessTax > 0) {
                // 正值：按 owner 比例收税
                let actualTaxCollected = 0;
                Object.entries(ownerLevelGroups).forEach(([oKey, group]) => {
                    const proportion = group.totalCount / count;
                    const ownerTax = totalBusinessTax * proportion;
                    const ownerWealth = wealth[oKey] || 0;
                    if (ownerWealth >= ownerTax) {
                        wealth[oKey] = ownerWealth - ownerTax;
                        roleBusinessTaxPaid[oKey] = (roleBusinessTaxPaid[oKey] || 0) + ownerTax;
                        roleExpense[oKey] = (roleExpense[oKey] || 0) + ownerTax;

                        // Per-building: accumulate business tax paid (only positive tax)
                        buildingFinancialData[b.id].businessTaxPaid += ownerTax;

                        actualTaxCollected += ownerTax;
                        if (classFinancialData[oKey]) {
                            classFinancialData[oKey].expense.businessTax = (classFinancialData[oKey].expense.businessTax || 0) + ownerTax;
                        }
                    } else if (tick % 30 === 0 && ownerWealth < ownerTax * 0.5) {
                        logs.push(`⚠️ ${STRATA[oKey]?.name || oKey} 无力支付 ${b.name} 的营业税，政府放弃征收。`);
                    }
                });
                taxBreakdown.businessTax += actualTaxCollected;
            } else if (totalBusinessTax < 0) {
                // 负值：按 owner 比例发放补贴
                const subsidyAmount = Math.abs(totalBusinessTax);
                const treasury = res.silver || 0;
                if (treasury >= subsidyAmount) {
                    res.silver = treasury - subsidyAmount;
                    taxBreakdown.subsidy += subsidyAmount;
                    Object.entries(ownerLevelGroups).forEach(([oKey, group]) => {
                        const proportion = group.totalCount / count;
                        const ownerSubsidy = subsidyAmount * proportion;
                        // [FIX] Apply safe wealth limit to prevent overflow
                        wealth[oKey] = safeWealth((wealth[oKey] || 0) + ownerSubsidy);
                        roleWagePayout[oKey] = (roleWagePayout[oKey] || 0) + ownerSubsidy;
                        if (classFinancialData[oKey]) {
                            classFinancialData[oKey].income.subsidy = (classFinancialData[oKey].income.subsidy || 0) + ownerSubsidy;
                        }
                    });
                } else {
                    if (tick % 30 === 0) {
                        logs.push(`⚠️ 国库空虚，无法为 ${b.name} 支付营业补贴！`);
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
                                    wealth[marketOwnerKey] = availableMerchantWealth;
                                    roleExpense[marketOwnerKey] = (roleExpense[marketOwnerKey] || 0) + exportValue;

                                    res[sourceResource] = Math.max(0, currentStock - exportAmount);
                                    supply[sourceResource] = (supply[sourceResource] || 0) + exportAmount;
                                    rates[sourceResource] = (rates[sourceResource] || 0) - exportAmount;
                                    surplus.stock = Math.max(0, surplus.stock - exportAmount);
                                    remainingValue = Math.max(0, remainingValue - exportValue);

                                    if (target.importPrice <= 0) continue;
                                    let importAmount = exportValue / target.importPrice;
                                    if (!Number.isFinite(importAmount) || importAmount <= 0) continue;
                                    importAmount = Math.min(importAmount, remainingAmount);
                                    if (importAmount <= 0) continue;

                                    const importCost = importAmount * target.importPrice;
                                    wealth[marketOwnerKey] += importCost;
                                    availableMerchantWealth += importCost;

                                    res[target.resource] = (res[target.resource] || 0) + importAmount;
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
                                        // logs.push(`🚢 市场：商人动用自有资金 ${exportValue.toFixed(1)} 银币购入 ${exportAmount.toFixed(1)} ${fromName}，换回 ${importAmount.toFixed(1)} ${toName}。`);
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

    // === 新军费计算系统 ===
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
            });
            effectivePrice = pcResult.effectivePrice;
        }
        totalResourceCost += needed * effectivePrice;

        // 如果资源不足，记录日志
        if (consumed < needed && tick % 30 === 0) {
            const shortage = needed - consumed;
            logs.push(`⚠️ 军队维护资源不足：缺少 ${RESOURCES[resource]?.name || resource} ${shortage.toFixed(1)}/日`);
        }
    });

    // 3. 计算时代加成和规模惩罚
    const epochMultiplier = 1 + epoch * 0.1;
    const armyPopulation = calculateArmyPopulation(army);
    const scalePenalty = calculateArmyScalePenalty(armyPopulation, population);
    const effectiveWageMultiplier = Math.max(0.5, militaryWageRatio ?? 1);

    // 4. 总军费 = 资源成本 × 时代加成 × 规模惩罚 × 军饷倍率
    const totalArmyCost = totalResourceCost * epochMultiplier * scalePenalty * effectiveWageMultiplier;

    // 记录军费数据（用于战争赔款计算）
    const armyExpenseResult = {
        dailyExpense: totalArmyCost,
        resourceCost: totalResourceCost,
        epochMultiplier,
        scalePenalty,
        wageMultiplier: effectiveWageMultiplier,
        resourceConsumption: armyResourceConsumption
    };

    if (totalArmyCost > 0) {
        const available = res.silver || 0;
        if (available >= totalArmyCost) {
            res.silver = available - totalArmyCost;
            rates.silver = (rates.silver || 0) - totalArmyCost;
            roleWagePayout.soldier = (roleWagePayout.soldier || 0) + totalArmyCost;
            // [FIX] 同步到 classFinancialData 以保持概览和财务面板数据一致
            if (classFinancialData.soldier) {
                classFinancialData.soldier.income.militaryPay = (classFinancialData.soldier.income.militaryPay || 0) + totalArmyCost;
            }
        } else if (totalArmyCost > 0) {
            // 部分支付
            const partialPay = available * 0.9; // 留10%底
            if (partialPay > 0) {
                res.silver = available - partialPay;
                rates.silver = (rates.silver || 0) - partialPay;
                roleWagePayout.soldier = (roleWagePayout.soldier || 0) + partialPay;
                // [FIX] 同步到 classFinancialData 以保持概览和财务面板数据一致
                if (classFinancialData.soldier) {
                    classFinancialData.soldier.income.militaryPay = (classFinancialData.soldier.income.militaryPay || 0) + partialPay;
                }
            }
            logs.push(`⚠️ 军饷不足！应付${totalArmyCost.toFixed(0)}银币，仅能支付${partialPay.toFixed(0)}银币，军心不稳。`);
        }
    }

    // console.log('[TICK] Production loop completed.'); // Commented for performance

    // Add all tracked income (civilian + military) to the wealth of each class
    // applyRoleIncomeToWealth(); // Removed to prevent double counting (called again at end of tick)

    // console.log('[TICK] Starting needs calculation...'); // Commented for performance
    const needsReport = {};
    const classShortages = {};
    // 收集各阶层的财富乘数（用于UI显示"谁吃到了buff"）
    const stratumWealthMultipliers = {};
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
        const maxConsumptionMultiplier = def.maxConsumptionMultiplier || 6;
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

            // 3. Wartime military class demand multiplier (3x for soldier and knight during war)
            if (isPlayerAtWar && (key === 'soldier' || key === 'knight')) {
                requirement *= WAR_MILITARY_MULTIPLIER;
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
                const wealthElasticity = def.wealthElasticity || 1.0;
                const maxMultiplier = def.maxConsumptionMultiplier || 6;
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
                            resources: res
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
                            res.silver -= subsidyAmount;
                            taxBreakdown.subsidy += subsidyAmount;
                            totalCost -= subsidyAmount;
                            // Record consumption subsidy as income
                            roleWagePayout[key] = (roleWagePayout[key] || 0) + subsidyAmount;
                            // [FIX] 同步到 classFinancialData 以保持概览和财务面板数据一致
                            if (classFinancialData[key]) {
                                classFinancialData[key].income.subsidy = (classFinancialData[key].income.subsidy || 0) + subsidyAmount;
                            }
                        } else {
                            if (tick % 20 === 0) {
                                logs.push(`国库空虚，无法为 ${STRATA[key]?.name || key} 支付 ${RESOURCES[resKey]?.name || resKey} 消费补贴！`);
                            }
                        }
                    } else if (taxPaid > 0) {
                        taxBreakdown.industryTax += taxPaid;
                        totalCost += taxPaid;
                    }

                    wealth[key] = Math.max(0, (wealth[key] || 0) - totalCost);
                    roleExpense[key] = (roleExpense[key] || 0) + totalCost;
                    satisfied = amount;

                    // 统计实际消费的需求量，而不是原始需求量
                    demand[resKey] = (demand[resKey] || 0) + amount;

                    // NEW: Track consumption by stratum
                    if (!stratumConsumption[key]) stratumConsumption[key] = {};
                    stratumConsumption[key][resKey] = (stratumConsumption[key][resKey] || 0) + amount;

                    if (classFinancialData[key]) {
                        // 分类记录：baseNeeds 中的资源是必需品，其他是奢侈品
                        // 存储 { cost, quantity, price } 以便 UI 显示详情
                        const needEntry = {
                            cost: totalCost,
                            quantity: amount,
                            price: finalEffectivePrice
                        };

                        if (def.needs && def.needs.hasOwnProperty(resKey)) {
                            // 必需品消费
                            classFinancialData[key].expense.essentialNeeds = classFinancialData[key].expense.essentialNeeds || {};
                            const existing = classFinancialData[key].expense.essentialNeeds[resKey];
                            if (existing && typeof existing === 'object') {
                                existing.cost += totalCost;
                                existing.quantity += amount;
                            } else {
                                classFinancialData[key].expense.essentialNeeds[resKey] = needEntry;
                            }
                        } else {
                            // 奢侈品消费
                            classFinancialData[key].expense.luxuryNeeds = classFinancialData[key].expense.luxuryNeeds || {};
                            const existing = classFinancialData[key].expense.luxuryNeeds[resKey];
                            if (existing && typeof existing === 'object') {
                                existing.cost += totalCost;
                                existing.quantity += amount;
                            } else {
                                classFinancialData[key].expense.luxuryNeeds[resKey] = needEntry;
                            }
                        }

                        // Also track transaction tax component for needs
                        // Note: taxBreakdown.industryTax is updated above for positive tax
                        // taxPaid was calculated above
                        if (taxPaid > 0) {
                            classFinancialData[key].expense.transactionTax = (classFinancialData[key].expense.transactionTax || 0) + taxPaid;
                        }
                    }
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
    if (activeDecrees?.forced_labor) {
        if (popStructure.serf > 0) classApproval.serf = Math.max(0, (classApproval.serf || 50) - 5);
    }

    if (activeDecrees?.tithe) {
        if (popStructure.cleric > 0) classApproval.cleric = Math.max(0, (classApproval.cleric || 50) - 2);
        const titheDue = (popStructure.cleric || 0) * 2 * effectiveTaxModifier;
        if (titheDue > 0) {
            const available = wealth.cleric || 0;
            const paid = Math.min(available, titheDue);
            wealth.cleric = Math.max(0, available - paid);
            taxBreakdown.headTax += paid;
            // 记录什一税支出
            roleExpense.cleric = (roleExpense.cleric || 0) + paid;
        }
    }

    // REFACTORED: Use shared calculateLivingStandards function from needs.js
    // incorporating new Income-Expense Balance Model

    // ====================================================================================================
    // 5. Advanced Cabinet Mechanics (Left/Right Dominance Active Effects)
    // ====================================================================================================

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
    console.log('[FREE MARKET SIMULATION DEBUG]', {
        dominanceCheck: {
            hasDominance: !!cabinetStatus?.dominance,
            faction: cabinetStatus?.dominance?.faction,
            isRightWing: cabinetStatus?.dominance?.faction === 'right',
        },
        expansionCheck: {
            hasSettings: !!expansionSettings,
            settingsCount: expansionSettings ? Object.keys(expansionSettings).length : 0,
            allowedBuildings: expansionSettings
                ? Object.entries(expansionSettings).filter(([k, v]) => v?.allowed).map(([k]) => k)
                : [],
        },
        willCallProcessExpansions:
            !!cabinetStatus?.dominance &&
            cabinetStatus.dominance.faction === 'right' &&
            !!expansionSettings,
    });

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
                    wealth[stratum] = Math.max(0, wealth[stratum] - amount);
                }
            });
            // Update the main `builds` object for the rest of the tick
            Object.assign(builds, newBuildingsCount);
        }
    }

    // ====================================================================================================
    // 6. Return Simulation Result
    // ====================================================================================================
    // Move official processing here so their wealth is aggregated into `wealth` BEFORE
    // calculateLivingStandards runs. This ensures StrataPanel shows correct data.

    let totalOfficialWealth = 0;
    let totalOfficialExpense = 0;
    let totalOfficialIncome = 0; // Track income for UI
    const pendingOfficialUpgrades = [];
    const officialMarketSnapshot = {
        prices: priceMap,
        wages: market?.wages || {},
    };

    const updatedOfficials = (officials || []).map(official => {
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
            console.log(`[OFFICIAL DEBUG] ${normalizedOfficial.name}: Salary paid! +${normalizedOfficial.salary}, wealth: ${debugInitialWealth} -> ${currentWealth}`);
            // 记录俸禄到财务数据
            if (classFinancialData.official) {
                classFinancialData.official.income.salary = (classFinancialData.official.income.salary || 0) + normalizedOfficial.salary;
            }
        } else {
            console.log(`[OFFICIAL DEBUG] ${normalizedOfficial.name}: NO SALARY! officialsPaid=${officialsPaid}, salary=${normalizedOfficial.salary}, wealth=${currentWealth}`);
        }

        // 支出：官员独立购买商品，更新市场供需与税收
        const officialNeeds = STRATA.official?.needs || { food: 1.2, cloth: 0.2 };
        const officialLuxuryNeeds = STRATA.official?.luxuryNeeds || {};
        let dailyExpense = 0;
        let luxuryExpense = 0;
        let essentialExpense = 0;
        const expenseBreakdown = {};

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
                const affordable = priceWithTax > 0
                    ? Math.min(requirement, currentWealth / priceWithTax)
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
                        res.silver -= subsidyAmount;
                        taxBreakdown.subsidy += subsidyAmount;
                        totalCost -= subsidyAmount;
                        totalOfficialIncome += subsidyAmount;
                        if (classFinancialData.official) {
                            classFinancialData.official.income.subsidy =
                                (classFinancialData.official.income.subsidy || 0) + subsidyAmount;
                        }
                    } else if (tick % 20 === 0) {
                        logs.push(`国库空虚，无法为 官员 支付 ${RESOURCES[resource]?.name || resource} 消费补贴！`);
                    }
                } else if (taxPaid > 0) {
                    taxBreakdown.industryTax += taxPaid;
                    totalCost += taxPaid;
                }

                currentWealth = Math.max(0, currentWealth - totalCost);
                dailyExpense += totalCost;
                if (isLuxury) {
                    luxuryExpense += totalCost;
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

                if (classFinancialData.official) {
                    const needEntry = { cost: totalCost, quantity: amount, price };
                    const bucket = isLuxury ? 'luxuryNeeds' : 'essentialNeeds';
                    classFinancialData.official.expense[bucket] = classFinancialData.official.expense[bucket] || {};
                    const existing = classFinancialData.official.expense[bucket][resource];
                    if (existing && typeof existing === 'object') {
                        existing.cost += totalCost;
                        existing.quantity += amount;
                    } else {
                        classFinancialData.official.expense[bucket][resource] = needEntry;
                    }
                    if (taxPaid > 0) {
                        classFinancialData.official.expense.transactionTax =
                            (classFinancialData.official.expense.transactionTax || 0) + taxPaid;
                    }
                }
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
        let debugHeadTaxPaid = 0;
        if (plannedPerCapitaTax !== 0) {
            if (plannedPerCapitaTax > 0) {
                const taxPaid = Math.min(currentWealth, plannedPerCapitaTax);
                debugHeadTaxPaid = taxPaid;
                currentWealth = Math.max(0, currentWealth - taxPaid);
                taxBreakdown.headTax += taxPaid;
                roleHeadTaxPaid.official = (roleHeadTaxPaid.official || 0) + taxPaid;
                roleExpense.official = (roleExpense.official || 0) + taxPaid;
                if (classFinancialData.official) {
                    classFinancialData.official.expense.headTax = (classFinancialData.official.expense.headTax || 0) + taxPaid;
                }
            } else {
                const subsidyNeeded = Math.abs(plannedPerCapitaTax);
                const treasury = res.silver || 0;
                if (treasury >= subsidyNeeded) {
                    res.silver = treasury - subsidyNeeded;
                    currentWealth += subsidyNeeded;
                    taxBreakdown.subsidy += subsidyNeeded;
                    totalOfficialIncome += subsidyNeeded;
                    if (classFinancialData.official) {
                        classFinancialData.official.income.subsidy = (classFinancialData.official.income.subsidy || 0) + subsidyNeeded;
                    }
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
        if (normalizedOfficial.ownedProperties?.length) {
            normalizedOfficial.ownedProperties.forEach(prop => {
                const actualProfit = calculateOfficialPropertyProfit(
                    prop,
                    officialMarketSnapshot,
                    taxPolicies,
                    buildingStaffingRatios,
                    builds
                );
                if (actualProfit > 0) {
                    totalPropertyIncome += actualProfit;
                } else if (actualProfit < 0) {
                    currentWealth = Math.max(0, currentWealth + actualProfit);
                }
            });
        }
        if (totalPropertyIncome > 0) {
            currentWealth += totalPropertyIncome;
            totalOfficialIncome += totalPropertyIncome;
            if (classFinancialData.official) {
                classFinancialData.official.income.ownerRevenue =
                    (classFinancialData.official.income.ownerRevenue || 0) + totalPropertyIncome;
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
        const investmentProfile = { ...normalizedOfficial.investmentProfile };

        if (investmentDecision && currentWealth >= investmentDecision.cost) {
            currentWealth = Math.max(0, currentWealth - investmentDecision.cost);
            const instanceId = `${investmentDecision.buildingId}_off_${normalizedOfficial.id}_${tick}_${Math.floor(Math.random() * 1000)}`;
            ownedProperties.push({
                buildingId: investmentDecision.buildingId,
                instanceId,
                purchaseDay: tick,
                purchaseCost: investmentDecision.cost,
                level: 0,
            });
            investmentProfile.lastInvestmentDay = tick;
            builds[investmentDecision.buildingId] = (builds[investmentDecision.buildingId] || 0) + 1;
            logs.push(`🧾 官员${normalizedOfficial.name}投资了 ${investmentDecision.buildingId}（花费 ${Math.ceil(investmentDecision.cost)} 银）`);
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

        if (upgradeDecision && currentWealth >= upgradeDecision.cost) {
            currentWealth = Math.max(0, currentWealth - upgradeDecision.cost);
            const targetProp = ownedProperties[upgradeDecision.propertyIndex];
            if (targetProp) {
                targetProp.level = upgradeDecision.toLevel;
                investmentProfile.lastUpgradeDay = tick;
                pendingOfficialUpgrades.push({
                    buildingId: upgradeDecision.buildingId,
                    fromLevel: upgradeDecision.fromLevel,
                    toLevel: upgradeDecision.toLevel,
                    officialName: normalizedOfficial.name,
                    cost: upgradeDecision.cost,
                });
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

        // 政治诉求
        newLoyalty += isStanceMet ? DAILY_CHANGES.stanceSatisfied : DAILY_CHANGES.stanceUnsatisfied;

        // 财务状况
        if (combinedSatisfaction === 'satisfied') newLoyalty += DAILY_CHANGES.financialSatisfied;
        else if (combinedSatisfaction === 'uncomfortable') newLoyalty += DAILY_CHANGES.financialUncomfortable;
        else if (combinedSatisfaction === 'struggling') newLoyalty += DAILY_CHANGES.financialStruggling;
        else if (combinedSatisfaction === 'desperate') newLoyalty += DAILY_CHANGES.financialDesperate;

        // 国家稳定度
        const stabilityValue = (currentStability ?? 50) / 100; // currentStability是0-100，转为0-1
        if (stabilityValue > 0.7) newLoyalty += DAILY_CHANGES.stabilityHigh;
        else if (stabilityValue < 0.3) newLoyalty += DAILY_CHANGES.stabilityLow;

        // 薪资发放
        newLoyalty += officialsPaid ? DAILY_CHANGES.salaryPaid : DAILY_CHANGES.salaryUnpaid;

        // 限制范围
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
            financialSatisfaction: combinedSatisfaction,
            ownedProperties,
            investmentProfile,
            lastDayPropertyIncome: totalPropertyIncome,
            lastDayExpenseBreakdown: expenseBreakdown,
            lastDayLuxuryExpense: luxuryExpense,
            lastDayEssentialExpense: essentialExpense,
            // 忠诚度系统
            loyalty: newLoyalty,
            lowLoyaltyDays: newLowLoyaltyDays,
            isStanceSatisfied: isStanceMet,
            // [DEBUG] 调试字段
            _debug: {
                initialWealth: debugInitialWealth,
                salaryPaid: officialsPaid,
                salaryAmount: normalizedOfficial.salary || 0,
                wealthAfterSalary: debugInitialWealth + (officialsPaid ? (normalizedOfficial.salary || 0) : 0),
                dailyExpense: dailyExpense,
                wealthAfterGoods: debugAfterGoodsConsumption,
                headTaxPlanned: debugPlannedHeadTax,
                headTaxPaid: debugHeadTaxPaid,
                wealthAfterTax: debugAfterConsumption,
                propertyIncome: totalPropertyIncome,
                wealthAfterProperty: debugAfterProperty,
                investmentCost: debugInvestmentCost,
                upgradeCost: debugUpgradeCost,
                wealthAfterInvestment: debugAfterInvestment,
                wealthFinal: currentWealth,
            },
        };
    });

    // Sync Aggregate Stats for UI correctness
    wealth.official = totalOfficialWealth;
    roleExpense.official = (roleExpense.official || 0) + totalOfficialExpense;


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
    const officialCount = updatedOfficials.length;
    if (officialCount > 0) {
        const avgWealth = totalOfficialWealth / officialCount;
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

    // [NEW] 累积税收冲击值：用于防止"快速抬税后降税"的漏洞
    // 当税率降低后，累积冲击会缓慢衰减，而非立即消失
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
        // 改为基于税收占存款的百分比来判断，而非简单的税率系数
        const headTaxPaidPerCapita = (roleHeadTaxPaid[key] || 0) / Math.max(1, count);
        // 税收占存款的比例（每天税收 / 人均存款）
        const taxToWealthRatio = wealthPerCapita > 0.01 ? headTaxPaidPerCapita / wealthPerCapita : 0;
        // 当税收超过存款的5%时开始产生冲击，超过20%时达到最大惩罚
        // 5%以下无惩罚，5%-20%线性增长，20%以上最大惩罚25
        const taxShockThreshold = 0.05; // 5%阈值
        const taxShockMaxRatio = 0.20;  // 20%达到最大惩罚
        const instantTaxShock = taxToWealthRatio > taxShockThreshold && headTaxPaidPerCapita > 0
            ? Math.min(25, ((taxToWealthRatio - taxShockThreshold) / (taxShockMaxRatio - taxShockThreshold)) * 25)
            : 0;

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
                const sustainedBonus = Math.min(15, consecutiveSatisfied * 0.6);
                targetApproval = Math.min(100, targetApproval + sustainedBonus);
            }
        }

        // Wealth Trend Logic
        const history = (classWealthHistory || {})[key];
        if (history && history.length >= 20) { // Check for 20 ticks of history
            const recentWealth = history.slice(-10).reduce((a, b) => a + b, 0) / 10;
            const pastWealth = history.slice(-20, -10).reduce((a, b) => a + b, 0) / 10;

            if (pastWealth > 1) { // Avoid division by zero or tiny numbers
                const trend = (recentWealth - pastWealth) / pastWealth;
                const trendBonus = Math.min(15, Math.abs(trend) * 50); // Scale bonus with trend, cap at 15

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

        // Gradual adjustment
        const eventBonus = eventApprovalModifiers?.[key] || 0;
        if (eventBonus) {
            targetApproval += eventBonus;
        }

        // 应用政令满意度修正
        const decreeBonus = decreeApprovalModifiers[key] || 0;
        if (decreeBonus) {
            targetApproval += decreeBonus;
        }

        // 官员满意度修正
        const officialBonus = activeOfficialEffects?.approval?.[key] || 0;

        // 正面官员效果加到目标值
        if (officialBonus > 0) {
            targetApproval += officialBonus;
        }

        // 计算有效满意度上限（负面官员效果直接降低上限）
        let effectiveApprovalCap = livingStandardApprovalCap;
        if (officialBonus < 0) {
            effectiveApprovalCap = Math.max(0, livingStandardApprovalCap + officialBonus);
        }

        let currentApproval = classApproval[key] || 50;
        const adjustmentSpeed = 0.02; // How slowly approval changes per tick

        // 税收冲击惩罚：只有当冲击值显著时才应用
        // 修复：之前只要 taxShockPenalty > 0 就硬性限制到35%，导致轻微历史冲击也会永久锁死满意度
        if (taxShockPenalty > 1) {
            // 冲击值直接扣减当前满意度
            currentApproval = Math.max(0, currentApproval - taxShockPenalty);

            // 只有当冲击显著（>5）时才限制满意度上限
            // 上限根据冲击程度动态计算：冲击5→上限60，冲击15→上限40，冲击25→上限25
            if (taxShockPenalty > 5) {
                const shockCap = Math.max(25, 70 - taxShockPenalty * 2);
                targetApproval = Math.min(targetApproval, shockCap);
            }
        }

        // 满意度向目标值移动
        let newApproval = currentApproval + (targetApproval - currentApproval) * adjustmentSpeed;

        // 应用有效满意度上限（包含官员惩罚）
        newApproval = Math.min(newApproval, effectiveApprovalCap);

        // DEBUG: 检查 miner 阶层的满意度计算
        if (key === 'miner' && tick % 30 === 0) {
            console.log(`[DEBUG miner] taxShock=${taxShockPenalty.toFixed(2)}, targetApproval=${targetApproval.toFixed(1)}, effectiveCap=${effectiveApprovalCap}, newApproval=${newApproval.toFixed(1)}, current=${currentApproval.toFixed(1)}`);
        }

        classApproval[key] = Math.max(0, Math.min(100, newApproval));
    });

    if ((popStructure.unemployed || 0) === 0 && previousApproval.unemployed !== undefined) {
        classApproval.unemployed = Math.min(100, previousApproval.unemployed + 5);
    }


    let nextPopulation = population;
    let raidPopulationLoss = 0;

    // Wealth Decay (Lifestyle Inflation)
    // Prevents infinite accumulation by "burning" a small percentage of wealth daily
    // representing maintenance, services, and non-goods consumption.
    // NEW: Decay is based on per-capita wealth percentage, not total wealth
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
                wealth[key] = Math.max(0, currentWealth - decay);
                // Record decay as expense so UI balances
                roleExpense[key] = (roleExpense[key] || 0) + decay;
                if (classFinancialData[key]) {
                    classFinancialData[key].expense.decay = (classFinancialData[key].expense.decay || 0) + decay;
                }
            }
        }
    });

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

    // 非法政府满意度惩罚（对所有阶层应用）
    if (legitimacyApprovalModifier < 0) {
        Object.keys(classApproval).forEach(key => {
            classApproval[key] = Math.max(0, Math.min(100,
                (classApproval[key] || 50) + legitimacyApprovalModifier
            ));
        });
    }

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
                    wealth[key] = Math.max(0, currentWealth - fleeingCapital);
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

    const visibleEpoch = epoch;
    // 记录本回合来自战争赔款（含分期）的财政收入
    let warIndemnityIncome = 0;
    const playerPopulationBaseline = Math.max(5, population || 5);
    const playerWealthBaseline = Math.max(100, (res.silver ?? resources?.silver ?? 0));

    // Track global peace request cooldown - find the most recent peace request across all nations
    // This prevents multiple AI nations from spamming peace requests simultaneously
    let lastGlobalPeaceRequest = -Infinity;
    (nations || []).forEach(n => {
        if (n.lastPeaceRequestDay && n.lastPeaceRequestDay > lastGlobalPeaceRequest) {
            lastGlobalPeaceRequest = n.lastPeaceRequestDay;
        }
    });

    let updatedNations = (nations || []).map(nation => {
        const next = { ...nation };
        const visible = visibleEpoch >= (nation.appearEpoch ?? 0) && (nation.expireEpoch == null || visibleEpoch <= nation.expireEpoch);
        if (!visible) {
            // 当国家因时代变化而不可见时，清除战争状态和相关数据
            if (next.isAtWar) {
                next.isAtWar = false;
                next.warDuration = 0;
                next.warScore = 0;
                next.warStartDay = undefined;
                logs.push(`🕊️ 随着时代变迁，与 ${next.name} 的战争已成为历史。`);
            }
            return next;
        }

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
            const randomVariance = 0.9 + Math.random() * 0.25;
            const popFactor = clamp(
                foreignPowerProfile.populationFactor * eraBonus * randomVariance,
                0.6,
                2.5
            );
            const wealthFactor = clamp(
                foreignPowerProfile.wealthFactor * eraBonus * randomVariance,
                0.5,
                3.5
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

        // REFACTORED: Using module function for foreign economy simulation
        updateAINationInventory({ nation: next, tick, gameSpeed });
        if (next.isAtWar) {
            next.warDuration = (next.warDuration || 0) + 1;
            // 累计与该国战争期间的军费支出（用于战争赔款计算）
            // 注意：如果同时与多个国家交战，军费按国家数量分摊
            const warringNationsCount = (nations || []).filter(n => n.isAtWar).length || 1;
            const dailyExpenseShare = (armyExpenseResult?.dailyExpense || 0) / warringNationsCount;
            next.warTotalExpense = (next.warTotalExpense || 0) + dailyExpenseShare;

            if (visibleEpoch >= 1) {
                // REFACTORED: Using module function for AI military action
                const militaryResult = processAIMilitaryAction({
                    nation: next,
                    tick,
                    epoch,
                    resources: res,
                    army,
                    logs,
                    difficultyLevel: difficulty,
                });
                raidPopulationLoss += militaryResult.raidPopulationLoss;
            }
            // REFACTORED: Using module function for AI peace request check
            // Pass global cooldown to prevent multiple nations from requesting peace simultaneously
            const peaceRequested = checkAIPeaceRequest({ nation: next, tick, lastGlobalPeaceRequest, logs });
            if (peaceRequested) {
                lastGlobalPeaceRequest = tick; // Update global cooldown for subsequent nations
            }

            // REFACTORED: Using module function for AI surrender demand check
            // 传入玩家财富，使赔款计算与玩家主动求和时一致
            checkAISurrenderDemand({ nation: next, tick, population, playerWealth: playerWealthBaseline, logs });

            // Check if AI should offer unconditional peace when player is in desperate situation
            checkMercyPeace({ nation: next, tick, population, playerWealth: playerWealthBaseline, resources: res, logs });
        } else if (next.warDuration) {
            next.warDuration = 0;
            next.warTotalExpense = 0; // 清除战争军费记录
        }
        const relation = next.relation ?? 50;

        // REFACTORED: Using module function for relation decay
        processNationRelationDecay(next);

        if (bonuses.diplomaticIncident && !next.isRebelNation && !next.isAtWar) {
            const dailyPenalty = bonuses.diplomaticIncident / 30;
            next.relation = Math.min(100, Math.max(0, (next.relation ?? 50) - dailyPenalty));
        }

        // 应用官员和政治立场的外交加成到玩家与AI的关系
        if (bonuses.diplomaticBonus && !next.isRebelNation && !next.isAtWar) {
            const dailyBonus = bonuses.diplomaticBonus / 30; // 分摊到每日
            next.relation = Math.min(100, Math.max(0, (next.relation ?? 50) + dailyBonus));
        }

        // REFACTORED: Using module function for AI alliance breaking check
        checkAIBreakAlliance(next, logs);

        const aggression = next.aggression ?? 0.2;
        const hostility = Math.max(0, (50 - relation) / 70);
        const unrest = stabilityValue < 35 ? 0.02 : 0;


        // REFACTORED: Using module function for war declaration check
        checkWarDeclaration({
            nation: next,
            nations,
            tick,
            epoch: visibleEpoch,
            resources: res,
            stabilityValue,
            logs,
            difficultyLevel: difficulty,
        });


        // REFACTORED: Using module function for installment payment
        warIndemnityIncome += processInstallmentPayment({
            nation: next,
            resources: res,
            logs,
        });

        // REFACTORED: Using module function for post-war recovery
        processPostWarRecovery(next);

        // REFACTORED: Using module functions for AI development system
        initializeAIDevelopmentBaseline({ nation: next, tick });
        processAIIndependentGrowth({ nation: next, tick });
        updateAIDevelopment({
            nation: next,
            epoch,
            playerPopulationBaseline,
            playerWealthBaseline,
            tick,
        });

        return next;
    });


    // REFACTORED: Using module function for foreign relations initialization
    updatedNations = initializeForeignRelations(updatedNations);


    // REFACTORED: Using module function for monthly relation decay
    const isMonthTick = tick % 30 === 0;
    if (isMonthTick) {
        updatedNations = processMonthlyRelationDecay(updatedNations, tick);
    }

    // Filter visible nations for diplomacy processing
    const visibleNations = updatedNations.filter(n =>
        epoch >= (n.appearEpoch ?? 0) && (n.expireEpoch == null || epoch <= n.expireEpoch) && !n.isRebelNation
    );

    // REFACTORED: Using module function for ally cold events
    // Note: Must use visibleNations to avoid triggering events for destroyed/expired nations
    processAllyColdEvents(visibleNations, tick, logs);

    // REFACTORED: Using module function for AI gift diplomacy
    processAIGiftDiplomacy(visibleNations, logs);


    // REFACTORED: Using module function for AI-AI trade
    processAITrade(visibleNations, logs);


    // REFACTORED: Using module function for AI-Player trade
    processAIPlayerTrade(visibleNations, tick, res, market, logs, policies);


    // REFACTORED: Using module function for AI-Player interaction
    processAIPlayerInteraction(visibleNations, tick, epoch, logs);


    // REFACTORED: Using module function for AI-AI alliance formation
    processAIAllianceFormation(visibleNations, tick, logs);


    // REFACTORED: Using module functions for AI-AI war system
    processCollectiveAttackWarmonger(visibleNations, tick, logs);
    processAIAIWarDeclaration(visibleNations, updatedNations, tick, logs);
    processAIAIWarProgression(visibleNations, updatedNations, tick, logs);

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
                    logs.push(`${className} 阶层因长期缺乏${reason}，${deaths} 人死亡！`);
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
    const updatedPrices = { ...priceMap };
    const updatedWages = {};
    const wageSmoothing = 0.35;

    Object.entries(roleWageStats).forEach(([role, data]) => {

        let currentSignal = 0;

        const pop = popStructure[role] || 0;



        if (pop > 0) {

            const income = roleWagePayout[role] || 0;

            const expense = roleExpense[role] || 0;
            // 人头税不计入生活支出，工资调整只考虑生活消费
            // const headTaxPaid = roleHeadTaxPaid[role] || 0;

            currentSignal = (income - expense) / pop;

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

            // 获取该建筑的升级等级分布
            // buildingUpgrades[building.id] 格式为 { 等级: 数量 }
            const storedLevelCounts = buildingUpgrades[building.id] || {};

            // 计算已升级的建筑数量
            let upgradedCount = 0;
            Object.entries(storedLevelCounts).forEach(([lvlStr, lvlCount]) => {
                const lvl = parseInt(lvlStr);
                if (Number.isFinite(lvl) && lvl > 0 && lvlCount > 0) {
                    upgradedCount += lvlCount;
                }
            });

            // 构建完整的等级分布（包括0级）
            const levelCounts = { 0: Math.max(0, buildingCount - upgradedCount) };
            Object.entries(storedLevelCounts).forEach(([lvlStr, lvlCount]) => {
                const lvl = parseInt(lvlStr);
                if (Number.isFinite(lvl) && lvl > 0 && lvlCount > 0) {
                    levelCounts[lvl] = lvlCount;
                }
            });

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

        if (partnerParts.length > 0) {
            const profitText = totalProfit >= 0 ? `盈利${totalProfit.toFixed(1)}` : `亏损${Math.abs(totalProfit).toFixed(1)}`;
            logs.push(`🛒 商人贸易完成: ${partnerParts.join('; ')}，${profitText}银币`);
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

    /**
     * 为空岗位预估收入（区分业主和雇员）
     * 解决恶性循环：无人工作 → 收入为0 → 更无人愿意去
     * @param {string} role - 角色key
     * @returns {number} 预估的人均收入
     */
    const estimateVacantRoleIncome = (role) => {
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
            return avgPaidWage * VACANT_BONUS;
        }

        const totalIncome = ownerIncome + employeeWage;
        const averageIncome = totalIncome / totalSlots;

        // 应用吸引力加成
        return Math.max(0, averageIncome * VACANT_BONUS);
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
                    res[resource] = Math.max(0, (res[resource] || 0) - amount);
                }
            });

            // 2. Deduct cost from owner's wealth
            wealth[ownerKey] = Math.max(0, ownerWealth - totalSilverCost);

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
            logs.push(`🏗️ ${ownerName}自发投资了自己的产业 ${b.name} → ${upgradeName}（花费 ${Math.ceil(totalSilverCost)} 银币）`);

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

            logs.push(`🏗️ 官员${officialName}升级了 ${buildingId}（花费 ${Math.ceil(cost)} 银）`);
        });
    }

    // Update classWealthResult after owner upgrades
    Object.keys(STRATA).forEach(key => {
        classWealthResult[key] = Math.max(0, wealth[key] || 0);
    });
    totalWealth = Object.values(classWealthResult).reduce((sum, val) => sum + val, 0);

    // 应用官员税收效率加成 (同时减去腐败损失)
    const rawTaxEfficiency = efficiency * (1 + (bonuses.taxEfficiencyBonus || 0) - (bonuses.corruption || 0));
    const effectiveTaxEfficiency = Math.max(0, Math.min(1, rawTaxEfficiency));
    const collectedHeadTax = taxBreakdown.headTax * effectiveTaxEfficiency;
    const collectedIndustryTax = taxBreakdown.industryTax * effectiveTaxEfficiency;
    const collectedBusinessTax = taxBreakdown.businessTax * effectiveTaxEfficiency;
    const collectedTariff = (taxBreakdown.tariff || 0) * effectiveTaxEfficiency; // 关税收入
    const taxBaseForCorruption = taxBreakdown.headTax + taxBreakdown.industryTax + taxBreakdown.businessTax + (taxBreakdown.tariff || 0);
    const efficiencyNoCorruption = Math.max(0, Math.min(1, efficiency * (1 + (bonuses.taxEfficiencyBonus || 0))));
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
            distributed += share;
        });
        if (distributed > 0) {
            totalOfficialWealth += distributed;
            wealth.official = totalOfficialWealth;
            classWealthResult.official = Math.max(0, wealth.official);
            totalWealth = Object.values(classWealthResult).reduce((sum, val) => sum + val, 0);
            totalOfficialIncome += distributed;
            if (classFinancialData.official) {
                classFinancialData.official.income.corruption =
                    (classFinancialData.official.income.corruption || 0) + distributed;
            }
        }
    }
    const tariffSubsidy = taxBreakdown.tariffSubsidy || 0; // 关税补贴支出
    const totalCollectedTax = collectedHeadTax + collectedIndustryTax + collectedBusinessTax + collectedTariff;

    // 将税收与战争赔款一并视为财政收入
    const baseFiscalIncome = totalCollectedTax + warIndemnityIncome;
    // NEW: Apply income percentage bonus (from tech/decree effects)
    const incomePercentMultiplier = Math.max(0, 1 + incomePercentBonus);
    const totalFiscalIncome = baseFiscalIncome * incomePercentMultiplier;

    res.silver = (res.silver || 0) + totalFiscalIncome;
    rates.silver = (rates.silver || 0) + totalFiscalIncome;

    taxBreakdown.policyIncome = decreeSilverIncome;
    taxBreakdown.policyExpense = decreeSilverExpense;

    const priceControlIncome = taxBreakdown.priceControlIncome || 0;
    const priceControlExpense = taxBreakdown.priceControlExpense || 0;

    // Price control income is added to silver here (expense was deducted in real-time)
    res.silver = (res.silver || 0) + priceControlIncome;
    rates.silver = (rates.silver || 0) + priceControlIncome;

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
            tariff: collectedTariff, // 新增：关税收入
            tariffSubsidy, // 新增：关税补贴支出
            subsidy: taxBreakdown.subsidy,
            warIndemnity: warIndemnityIncome,
            policyIncome: decreeSilverIncome,
            policyExpense: decreeSilverExpense,
            priceControlIncome: priceControlIncome,
            priceControlExpense: priceControlExpense,
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

    // console.log('[TICK END]', tick, 'militaryCapacity:', militaryCapacity); // Commented for performance
    return {
        resources: res,
        rates,
        popStructure,
        maxPop: totalMaxPop,
        militaryCapacity, // 新增：军事容量
        population: nextPopulation,
        birthAccumulator,
        classApproval,
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
        },
        army, // 确保返回army状态，以便保存战斗损失
        officials: updatedOfficials, // 更新后的官员列表（含财务数据）
        // 计算有效官员容量（基于时代、政体和科技）
        effectiveOfficialCapacity: calculateOfficialCapacity(epoch, currentPolityEffects || {}, techsUnlocked),
        buildings: builds, // [FIX] Return updated building counts (including Free Market expansions)
        // [DEBUG] 临时调试字段 - 追踪自由市场机制问题
        _debug: {
            freeMarket: _freeMarketDebug,
        },
    };
};
