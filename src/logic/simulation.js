import { BUILDINGS, STRATA, EPOCHS, RESOURCES, TECHS, ECONOMIC_INFLUENCE } from '../config';
import { calculateArmyPopulation, calculateArmyFoodNeed, calculateArmyCapacityNeed } from '../config';
import { getBuildingEffectiveConfig } from '../config/buildingUpgrades';
import { isResourceUnlocked } from '../utils/resources';
import { calculateForeignPrice } from '../utils/foreignTrade';
import { simulateBattle, UNIT_TYPES } from '../config/militaryUnits';
import { getEnemyUnitsForEpoch } from '../config/militaryActions';
import { calculateLivingStandardData, getSimpleLivingStandard } from '../utils/livingStandard';
import { calculateLivingStandards } from './population/needs';
import { calculateAIGiftAmount, calculateAIPeaceTribute, calculateAISurrenderDemand } from '../utils/diplomaticUtils';

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
    calculateTotalMaxPop,
} from './buildings';

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
}) => {
    // console.log('[TICK START]', tick); // Commented for performance
    const res = { ...resources };
    const priceMap = { ...(market?.prices || {}) };
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
        return 0;
    };
    // REFACTORED: Use imported function from ./economy/taxes
    const taxBreakdown = initializeTaxBreakdown();

    // REFACTORED: Use imported function from ./buildings/effects
    const bonuses = initializeBonuses();
    // Destructure for backward compatibility with existing code
    const {
        buildingBonuses,
        categoryBonuses,
        passiveGains,
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
    applyDecreeEffects(decrees, bonuses);

    // Apply festival effects using module function
    applyFestivalEffects(activeFestivalEffects, bonuses);

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

    const sellProduction = (resource, amount, ownerKey) => {
        // 特殊处理银币产出：直接作为所有者收入，不进入国库，不交税
        if (resource === 'silver' && amount > 0) {
            roleWagePayout[ownerKey] = (roleWagePayout[ownerKey] || 0) + amount;
            return;
        }
        if (amount <= 0) return;
        res[resource] = (res[resource] || 0) + amount;
        if (isTradableResource(resource)) {
            supply[resource] = (supply[resource] || 0) + amount;
            const price = getPrice(resource);
            const grossIncome = price * amount;
            const taxRate = getResourceTaxRate(resource);
            const taxAmount = grossIncome * taxRate;
            let netIncome = grossIncome;

            if (taxAmount > 0) {
                // 这是一个消费税，不由生产者承担。
                // netIncome = grossIncome - taxAmount;
                // taxBreakdown.industryTax += taxAmount;
            } else if (taxAmount < 0) {
                // 负税率（补贴）：从国库支付补贴
                const subsidyAmount = Math.abs(taxAmount);
                if ((res.silver || 0) >= subsidyAmount) {
                    res.silver -= subsidyAmount;
                    netIncome = grossIncome + subsidyAmount;
                    taxBreakdown.subsidy += subsidyAmount;
                } else {
                    // 国库不足，无法支付补贴
                    if (tick % 30 === 0) {
                        logs.push(`⚠️ 国库空虚，无法为 ${RESOURCES[resource]?.name || resource} 销售支付补贴！`);
                    }
                }
            }

            // 记录owner的净销售收入（在tick结束时统一结算到wealth）
            roleWagePayout[ownerKey] = (roleWagePayout[ownerKey] || 0) + netIncome;
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
                wealth[role] = (wealth[role] || 0) + netPayout;
            }
            directIncomeApplied[role] = payout;
        });
    };

    // console.log('[TICK] Processing buildings...'); // Commented for performance
    BUILDINGS.forEach(b => {
        const count = builds[b.id] || 0;
        if (count > 0) {
            const upgradeLevels = buildingUpgrades[b.id] || {};

            // 遍历每个建筑实例，累加其效果
            for (let i = 0; i < count; i++) {
                const level = upgradeLevels[i] || 0;
                const config = getBuildingEffectiveConfig(b, level);

                // Apply building-specific and category bonuses
                let buildingBonus = buildingBonuses[b.id] || 1;
                const catBonus = categoryBonuses[b.cat] || 1;
                buildingBonus *= catBonus;

                // maxPop
                if (config.output?.maxPop) {
                    totalMaxPop += (config.output.maxPop * buildingBonus);
                }

                // militaryCapacity
                if (config.output?.militaryCapacity) {
                    militaryCapacity += (config.output.militaryCapacity * buildingBonus);
                }

                // jobs - 使用升级后的配置
                if (config.jobs) {
                    for (let role in config.jobs) {
                        jobsAvailable[role] = (jobsAvailable[role] || 0) + config.jobs[role];
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
            }
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
        // 首次运行：按优先级初始填充（已注释，防止强制重新分配）

        let remainingPop = population;
        ROLE_PRIORITY.forEach(role => {
            const slots = Math.max(0, jobsAvailable[role] || 0);
            const filled = Math.min(remainingPop, slots);
            popStructure[role] = filled;
            remainingPop -= filled;
        });
        popStructure.unemployed = Math.max(0, remainingPop);


        // 改为直接设置默认人口结构
        ROLE_PRIORITY.forEach(role => {
            popStructure[role] = 0;
        });
        popStructure.unemployed = population;
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
    ROLE_PRIORITY.forEach(role => {
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

    let taxModifier = 1.0;

    const effectiveTaxModifier = Math.max(0, taxModifier);

    // 自动填补（招工）：失业者优先进入净收入更高的岗位
    const estimateRoleNetIncome = (role) => {
        const wage = getExpectedWage(role);
        const headBase = STRATA[role]?.headTaxBase ?? 0.01;
        const taxCost = headBase * getHeadTaxRate(role) * effectiveTaxModifier;
        return wage - Math.max(0, taxCost);
    };

    // console.log('[vacancy debug] diff =', diff, ', unemployed =', popStructure.unemployed || 0); // Commented for performance
    const vacancyRanking = ROLE_PRIORITY.map((role, index) => {
        const slots = Math.max(0, jobsAvailable[role] || 0);
        const current = popStructure[role] || 0;
        const vacancy = Math.max(0, slots - current);
        if (role === 'soldier') {
            // console.log('[SOLDIER VACANCY] slots:', slots, 'current:', current, 'vacancy:', vacancy); // Commented for performance
        }
        if (vacancy <= 0) return null;
        return {
            role,
            vacancy,
            netIncome: estimateRoleNetIncome(role),
            priorityIndex: index,
        };
    })
        .filter(Boolean)
        .sort((a, b) => {
            if (b.netIncome !== a.netIncome) return b.netIncome - a.netIncome;
            return a.priorityIndex - b.priorityIndex;
        });

    // console.log('[VACANCY RANKING]', vacancyRanking.map(v => `${v.role}:${v.vacancy}`).join(', ')); // Commented for performance

    vacancyRanking.forEach(entry => {
        const availableUnemployed = popStructure.unemployed || 0;
        if (availableUnemployed <= 0) return;

        const hiring = Math.min(entry.vacancy, availableUnemployed);
        if (hiring <= 0) return;

        // 招工：失业者填补岗位，并携带财富
        const unemployedWealth = wealth.unemployed || 0;
        const perCapWealth = availableUnemployed > 0 ? unemployedWealth / availableUnemployed : 0;

        popStructure[entry.role] = (popStructure[entry.role] || 0) + hiring;
        popStructure.unemployed = Math.max(0, availableUnemployed - hiring);

        if (entry.role === 'soldier') {
            // console.log('[SOLDIER HIRING] hired:', hiring, 'new soldier count:', popStructure[entry.role]); // Commented for performance
        }

        if (perCapWealth > 0) {
            const transfer = perCapWealth * hiring;
            wealth.unemployed = Math.max(0, unemployedWealth - transfer);
            wealth[entry.role] = (wealth[entry.role] || 0) + transfer;
        }
    });

    const classApproval = {};
    const classInfluence = {};
    const classWealthResult = {};
    const logs = [];
    const buildingJobFill = {};

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

    const zeroApprovalClasses = {};
    // 允许负的 needsReduction (即增加需求)，下限设为 -2 (需求翻3倍)，上限 0.95
    const effectiveNeedsReduction = Math.max(-2, Math.min(0.95, needsReduction || 0));
    const needsRequirementMultiplier = 1 - effectiveNeedsReduction;

    Object.keys(STRATA).forEach(key => {
        const count = popStructure[key] || 0;
        if (count === 0) return;
        const def = STRATA[key];
        if (wealth[key] === undefined) {
            wealth[key] = def.startingWealth || 0;
        }
        const headRate = getHeadTaxRate(key);
        const headBase = STRATA[key]?.headTaxBase ?? 0.01;
        const due = count * headBase * headRate * effectiveTaxModifier;
        if (due !== 0) {
            const available = wealth[key] || 0;
            if (due > 0) {
                const paid = Math.min(available, due);
                wealth[key] = available - paid;
                taxBreakdown.headTax += paid;
                // 记录人头税支出
                roleHeadTaxPaid[key] = (roleHeadTaxPaid[key] || 0) + paid;
                roleExpense[key] = (roleExpense[key] || 0) + paid;
            } else {
                const subsidyNeeded = -due;
                const treasury = res.silver || 0;
                if (treasury >= subsidyNeeded) {
                    res.silver = treasury - subsidyNeeded;
                    wealth[key] = available + subsidyNeeded;
                    taxBreakdown.subsidy += subsidyNeeded;
                    // 记录政府补助收入
                    roleWagePayout[key] = (roleWagePayout[key] || 0) + subsidyNeeded;
                }
            }
        }
        classApproval[key] = previousApproval[key] ?? 50;
        if ((classApproval[key] || 0) <= 0) {
            zeroApprovalClasses[key] = true;
        }
    });

    const forcedLabor = decrees.some(d => d.id === 'forced_labor' && d.active);

    // console.log('[TICK] Starting production loop...'); // Commented for performance
    BUILDINGS.forEach(b => {
        const count = builds[b.id] || 0;
        if (count === 0) return;

        const ownerKey = b.owner || 'state';
        if (wealth[ownerKey] === undefined) {
            wealth[ownerKey] = STRATA[ownerKey]?.startingWealth || 0;
        }

        let multiplier = 1.0;

        // --- 计算升级加成后的基础数值 ---
        const upgradeLevels = buildingUpgrades[b.id] || {};
        const effectiveOps = { input: {}, output: {}, jobs: {} };
        const levelCounts = {};
        let hasUpgrades = false;

        // 统计各等级建筑数量
        for (let i = 0; i < count; i++) {
            const lvl = upgradeLevels[i] || 0;
            if (lvl > 0) hasUpgrades = true;
            levelCounts[lvl] = (levelCounts[lvl] || 0) + 1;
        }

        if (!hasUpgrades && levelCounts[0] === count) {
            // 无升级快速路径
            if (b.input) for (const [k, v] of Object.entries(b.input)) effectiveOps.input[k] = v * count;
            if (b.output) for (const [k, v] of Object.entries(b.output)) effectiveOps.output[k] = v * count;
            if (b.jobs) for (const [k, v] of Object.entries(b.jobs)) effectiveOps.jobs[k] = v * count;
        } else {
            // 聚合计算
            for (const [lvlStr, lvlCount] of Object.entries(levelCounts)) {
                const lvl = parseInt(lvlStr);
                const config = getBuildingEffectiveConfig(b, lvl);
                if (config.input) for (const [k, v] of Object.entries(config.input)) effectiveOps.input[k] = (effectiveOps.input[k] || 0) + v * lvlCount;
                if (config.output) for (const [k, v] of Object.entries(config.output)) effectiveOps.output[k] = (effectiveOps.output[k] || 0) + v * lvlCount;
                if (config.jobs) for (const [k, v] of Object.entries(config.jobs)) effectiveOps.jobs[k] = (effectiveOps.jobs[k] || 0) + v * lvlCount;
            }
        }
        // -----------------------------
        const currentEpoch = EPOCHS[epoch];

        if (currentEpoch && currentEpoch.bonuses) {
            if (b.cat === 'gather' && currentEpoch.bonuses.gatherBonus) {
                multiplier *= (1 + currentEpoch.bonuses.gatherBonus);
            }
            if (b.cat === 'industry' && currentEpoch.bonuses.industryBonus) {
                multiplier *= (1 + currentEpoch.bonuses.industryBonus);
            }
        }

        // Apply global production/industry modifiers
        let productionModifier = 1.0;
        let industryModifier = 1.0;
        productionBuffs.forEach(buff => {
            if (buff.production) productionModifier += buff.production;
            if (buff.industryBonus) industryModifier += buff.industryBonus;
        });
        productionDebuffs.forEach(debuff => {
            if (debuff.production) productionModifier += debuff.production;
            if (debuff.industryBonus) industryModifier += debuff.industryBonus;
        });
        productionModifier *= (1 + productionBonus);
        industryModifier *= (1 + industryBonus);

        if (b.cat === 'gather' || b.cat === 'civic') {
            multiplier *= productionModifier;
        }
        if (b.cat === 'industry') {
            multiplier *= industryModifier;
        }

        if (techsUnlocked.includes('wheel') && b.cat === 'gather') {
            multiplier *= 1.2;
        }
        if (techsUnlocked.includes('pottery') && b.id === 'farm') {
            multiplier *= 1.1;
        }
        if (techsUnlocked.includes('basic_irrigation') && b.id === 'farm') {
            multiplier *= 1.15;
        }
        const categoryBonus = categoryBonuses[b.cat];
        if (categoryBonus && categoryBonus !== 1) {
            multiplier *= categoryBonus;
        }

        // Apply event building production modifiers
        // Check for specific building modifier first, then category modifier
        const buildingSpecificMod = eventBuildingProductionModifiers[b.id] || 0;
        const buildingCategoryMod = eventBuildingProductionModifiers[b.cat] || 0;
        // Also check for 'all' modifier that affects all buildings
        const buildingAllMod = eventBuildingProductionModifiers['all'] || 0;
        const totalEventMod = buildingSpecificMod + buildingCategoryMod + buildingAllMod;
        if (totalEventMod !== 0) {
            multiplier *= (1 + totalEventMod);
        }
        const buildingBonus = buildingBonuses[b.id];
        if (buildingBonus && buildingBonus !== 1) {
            multiplier *= buildingBonus;
        }

        let staffingRatio = 1.0;
        let totalSlots = 0;
        let filledSlots = 0;
        const roleExpectedWages = {};
        let expectedWageBillBase = 0;
        const wagePlans = [];
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
                if (role !== ownerKey && roleFilled > 0) {
                    const cached = roleExpectedWages[role] ?? getExpectedWage(role);
                    const livingFloor = getLivingCostFloor(role);
                    const adjustedWage = Math.max(cached, livingFloor);
                    roleExpectedWages[role] = adjustedWage;
                    expectedWageBillBase += roleFilled * adjustedWage;
                    wagePlans.push({
                        role,
                        roleSlots: roleRequired,
                        filled: roleFilled,
                        baseWage: adjustedWage,
                    });
                }
            }
            if (totalSlots > 0) staffingRatio = filledSlots / totalSlots;
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
                const taxRate = getResourceTaxRate(resKey);
                // 计算税后净收入：正税率减少收入，负税率（补贴）增加收入
                const netValue = grossValue * (1 - taxRate);
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
        const businessTaxPerBuilding = getBusinessTaxRate(b.id);
        const estimatedBusinessTax = businessTaxPerBuilding * count * targetMultiplier;

        const totalOperatingCostPerMultiplier = inputCostPerMultiplier + wageCostPerMultiplier;
        let actualMultiplier = targetMultiplier;
        if (producesTradableOutput) {
            // 将营业税计入总成本（只考虑正税，补贴不计入成本）
            const estimatedCost = estimatedInputCost + estimatedWageCost + Math.max(0, estimatedBusinessTax);
            if (estimatedCost > 0 && estimatedRevenue <= 0) {
                actualMultiplier = 0;
            } else if (estimatedCost > 0 && estimatedRevenue < estimatedCost * 0.98) {
                const marginRatio = Math.max(0, Math.min(1, estimatedRevenue / estimatedCost));
                actualMultiplier = targetMultiplier * marginRatio;
            }
        }
        if (totalOperatingCostPerMultiplier > 0) {
            const ownerCash = wealth[ownerKey] || 0;
            const affordableMultiplier = ownerCash / totalOperatingCostPerMultiplier;
            actualMultiplier = Math.min(actualMultiplier, Math.max(0, affordableMultiplier));
        }

        if (!Number.isFinite(actualMultiplier) || actualMultiplier < 0) {
            actualMultiplier = 0;
        }

        const zeroApprovalFactor = 0.3;
        let approvalMultiplier = 1;
        if (zeroApprovalClasses[ownerKey]) {
            approvalMultiplier = Math.min(approvalMultiplier, zeroApprovalFactor);
        }
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
            for (const [resKey, totalAmount] of Object.entries(effectiveOps.input)) {
                // Skip input requirement if resource is not unlocked yet
                if (!isResourceUnlocked(resKey, epoch, techsUnlocked)) {
                    continue;
                }

                const amountNeeded = totalAmount * actualMultiplier;
                if (!amountNeeded || amountNeeded <= 0) continue;
                const available = res[resKey] || 0;
                const consumed = Math.min(amountNeeded, available);
                if (isTradableResource(resKey)) {
                    // 先不统计需求，等实际消费后再统计
                    const price = getPrice(resKey);
                    const taxRate = getResourceTaxRate(resKey);
                    const baseCost = consumed * price;
                    const taxPaid = baseCost * taxRate;
                    let totalCost = baseCost;

                    if (taxPaid < 0) {
                        const subsidyAmount = Math.abs(taxPaid);
                        if ((res.silver || 0) >= subsidyAmount) {
                            res.silver -= subsidyAmount;
                            taxBreakdown.subsidy += subsidyAmount;
                            totalCost -= subsidyAmount;
                            // Record resource purchase subsidy as income for building owner
                            roleWagePayout[ownerKey] = (roleWagePayout[ownerKey] || 0) + subsidyAmount;
                        } else {
                            if (tick % 20 === 0) {
                                logs.push(`国库空虚，无法为 ${b.name} 支付 ${RESOURCES[resKey]?.name || resKey} 交易补贴！`);
                            }
                        }
                    } else if (taxPaid > 0) {
                        taxBreakdown.industryTax += taxPaid;
                        totalCost += taxPaid;
                    }

                    wealth[ownerKey] = Math.max(0, (wealth[ownerKey] || 0) - totalCost);
                    roleExpense[ownerKey] = (roleExpense[ownerKey] || 0) + totalCost;

                    // 统计实际消费的需求量，而不是原始需求量
                    demand[resKey] = (demand[resKey] || 0) + consumed;
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
                    const taxRate = getResourceTaxRate(resKey);
                    levelOutputValue += grossValue * (1 - taxRate);
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
            if (config.jobs) {
                Object.entries(config.jobs).forEach(([role, slots]) => {
                    if (role === ownerKey) return;
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

        const preparedWagePlans = wagePlans.map(plan => {
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

            const expectedSlotWage = plan.baseWage * utilization * planWagePressure;
            const due = expectedSlotWage * plan.filled;
            plannedWageBill += due;
            return {
                ...plan,
                expectedSlotWage,
                wagePressure: planWagePressure, // 保存用于调试
            };
        });

        let wageRatio = 0;
        if (plannedWageBill > 0) {
            const available = wealth[ownerKey] || 0;
            const paid = Math.min(available, plannedWageBill);
            wealth[ownerKey] = available - paid;
            // 记录owner支付工资的支出
            roleExpense[ownerKey] = (roleExpense[ownerKey] || 0) + paid;
            wageRatio = paid / plannedWageBill;
        }

        preparedWagePlans.forEach(plan => {
            const actualSlotWage = plan.expectedSlotWage * wageRatio;
            roleWageStats[plan.role].weightedWage += actualSlotWage * plan.roleSlots;
            if (plan.filled > 0 && actualSlotWage > 0) {
                const payout = actualSlotWage * plan.filled;
                roleWagePayout[plan.role] = (roleWagePayout[plan.role] || 0) + payout;
            }
        });

        if (Object.keys(effectiveOps.output).length > 0) {
            for (const [resKey, totalAmount] of Object.entries(effectiveOps.output)) {
                let amount = totalAmount * actualMultiplier;
                if (!amount || amount <= 0) continue;

                // 为可交易资源添加产出浮动（80%-120%）
                if (isTradableResource(resKey) && resKey !== 'silver') {
                    const resourceDef = RESOURCES[resKey];
                    const resourceMarketConfig = resourceDef?.marketConfig || {};
                    const defaultMarketInfluence = ECONOMIC_INFLUENCE?.market || {};
                    const outputVariation = resourceMarketConfig.outputVariation !== undefined
                        ? resourceMarketConfig.outputVariation
                        : (defaultMarketInfluence.outputVariation || 0.2);

                    // 产出浮动：(1 - variation) 到 (1 + variation)
                    const variationFactor = 1 + (Math.random() * 2 - 1) * outputVariation;
                    amount *= variationFactor;

                    // 应用政令供应修饰符
                    const supplyMod = decreeResourceSupplyMod[resKey] || 0;
                    if (supplyMod !== 0) {
                        amount *= (1 + supplyMod);
                    }
                }

                // Skip maxPop - it's calculated separately in the building count loop above
                // and should not be affected by economic factors (actualMultiplier)
                if (resKey === 'maxPop') continue;
                if (isTradableResource(resKey)) {
                    sellProduction(resKey, amount, ownerKey);
                    rates[resKey] = (rates[resKey] || 0) + amount;
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
                // 正值：收税
                const ownerWealth = wealth[ownerKey] || 0;
                if (ownerWealth >= totalBusinessTax) {
                    // 业主有足够财产支付营业税
                    wealth[ownerKey] = ownerWealth - totalBusinessTax;
                    // 营业税单独统计，不计入生活支出
                    roleBusinessTaxPaid[ownerKey] = (roleBusinessTaxPaid[ownerKey] || 0) + totalBusinessTax;
                    roleExpense[ownerKey] = (roleExpense[ownerKey] || 0) + totalBusinessTax;
                    taxBreakdown.businessTax += totalBusinessTax;
                } else {
                    // 业主财产不足，放弃收税
                    if (tick % 30 === 0 && ownerWealth < totalBusinessTax * 0.5) {
                        logs.push(`⚠️ ${STRATA[ownerKey]?.name || ownerKey} 无力支付 ${b.name} 的营业税，政府放弃征收。`);
                    }
                }
            } else if (totalBusinessTax < 0) {
                // 负值：补贴
                const subsidyAmount = Math.abs(totalBusinessTax);
                const treasury = res.silver || 0;
                if (treasury >= subsidyAmount) {
                    res.silver = treasury - subsidyAmount;
                    wealth[ownerKey] = (wealth[ownerKey] || 0) + subsidyAmount;
                    roleWagePayout[ownerKey] = (roleWagePayout[ownerKey] || 0) + subsidyAmount;
                    taxBreakdown.subsidy += subsidyAmount;
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
                                    remainingAmount = Math.max(0, remainingAmount - importAmount);

                                    const profit = importCost - exportValue;
                                    if (profit > 0) {
                                        directIncomeApplied[marketOwnerKey] = (directIncomeApplied[marketOwnerKey] || 0) + profit;
                                        roleWagePayout[marketOwnerKey] = (roleWagePayout[marketOwnerKey] || 0) + profit;
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

        if (b.jobs) {
            Object.entries(b.jobs).forEach(([role, perBuilding]) => {
                const roleSlots = perBuilding * count;
                if (roleSlots <= 0) return;
                roleWageStats[role].totalSlots += roleSlots;
                if (role !== ownerKey) {
                    // 修复：使用预期工资而非硬编码的 0
                    const expectedWage = getExpectedWage(role);
                    const actualWagePerSlot = expectedWage;
                    roleWageStats[role].weightedWage += actualWagePerSlot * roleSlots;
                    const filled = buildingJobFill[b.id]?.[role] || 0;
                    if (filled > 0 && actualWagePerSlot > 0) {
                        const payout = actualWagePerSlot * filled;
                        roleWagePayout[role] += payout;
                    }
                }
            });
        }
    });

    const wageMultiplier = Math.max(0, militaryWageRatio ?? 0);
    const foodPrice = getPrice('food');
    const baseArmyWage = armyFoodNeed * foodPrice * wageMultiplier;

    if (baseArmyWage > 0) {
        const wageDue = baseArmyWage;
        const available = res.silver || 0;
        if (available >= wageDue) {
            res.silver = available - wageDue;
            rates.silver = (rates.silver || 0) - wageDue;
            roleWagePayout.soldier = (roleWagePayout.soldier || 0) + wageDue;
        } else if (wageDue > 0) {
            logs.push('银币不足，军饷被拖欠，军心不稳。');
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

        // Merge base needs with unlocked luxury needs based on wealth ratio
        const effectiveNeeds = { ...def.needs };
        if (def.luxuryNeeds) {
            // Sort thresholds to apply in order
            const thresholds = Object.keys(def.luxuryNeeds).map(Number).sort((a, b) => a - b);
            for (const threshold of thresholds) {
                if (wealthRatioForLuxury >= threshold) {
                    const luxuryNeedsAtThreshold = def.luxuryNeeds[threshold];
                    for (const [resKey, amount] of Object.entries(luxuryNeedsAtThreshold)) {
                        // Add to existing need or create new
                        effectiveNeeds[resKey] = (effectiveNeeds[resKey] || 0) + amount;
                    }
                }
            }
        }

        for (const [resKey, perCapita] of Object.entries(effectiveNeeds)) {
            if (def.defaultResource && def.defaultResource === resKey) {
                continue;
            }
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
                continue;
            }

            // 基础需求量
            let requirement = perCapita * count * needsRequirementMultiplier;
            if (requirement <= 0) continue;

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
                // 使用平方根曲线：财富增加时需求增长，但边际递减，比之前更克制
                // wealthRatio=1 → multiplier=1, wealthRatio=4 → multiplier≈2.6, wealthRatio=9 → multiplier≈4.3
                // 公式: multiplier = sqrt(wealthRatio) * (1 + ln(max(wealthRatio, 1)) * 0.2)
                // 限制范围：最低0.3倍（财富极低时），最高5倍（避免财富过高导致需求爆炸）
                let rawWealthMultiplier;
                if (wealthRatio <= 0) {
                    rawWealthMultiplier = 0.3;
                } else if (wealthRatio < 1) {
                    // 财富低于基准时，线性下降
                    rawWealthMultiplier = 0.3 + wealthRatio * 0.7;
                } else {
                    // 财富高于基准时，使用平方根+对数曲线，增长更平缓
                    rawWealthMultiplier = Math.sqrt(wealthRatio) * (1 + Math.log(wealthRatio) * 0.25);
                }
                const wealthMultiplier = Math.max(0.3, Math.min(6.0, rawWealthMultiplier));
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
                requirement = Math.min(requirement, perCapita * count * needsRequirementMultiplier * 12); // 最多12倍（配合财富乘数上限10倍+其他加成）
            }
            const available = res[resKey] || 0;
            let satisfied = 0;

            if (isTradableResource(resKey)) {
                const price = getPrice(resKey);
                const priceWithTax = price * (1 + getResourceTaxRate(resKey));
                const affordable = priceWithTax > 0 ? Math.min(requirement, (wealth[key] || 0) / priceWithTax) : requirement;
                const amount = Math.min(requirement, available, affordable);
                // 先不统计需求，等实际消费后再统计
                if (amount > 0) {
                    res[resKey] = available - amount;
                    rates[resKey] = (rates[resKey] || 0) - amount;
                    const taxRate = getResourceTaxRate(resKey);
                    const baseCost = amount * price;
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

    let decreeApprovalModifiers = {};

    decrees.forEach(d => {
        if (d.active) {
            // 通用阶级满意度修正
            if (d.modifiers && d.modifiers.approval) {
                Object.entries(d.modifiers.approval).forEach(([strata, value]) => {
                    decreeApprovalModifiers[strata] = (decreeApprovalModifiers[strata] || 0) + value;
                });
            }

            if (d.id === 'forced_labor') {
                // 强制劳役的特殊逻辑保留，作为额外惩罚，或者可以在配置中完全替代
                // 这里保留是为了兼容旧配置，但建议在配置中定义 approval 修正
                if (popStructure.serf > 0) classApproval.serf = Math.max(0, (classApproval.serf || 50) - 5); // 减弱硬编码惩罚
            }
            if (d.id === 'tithe') {
                if (popStructure.cleric > 0) classApproval.cleric = Math.max(0, (classApproval.cleric || 50) - 2); // 减弱硬编码惩罚
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
        }
    });

    // REFACTORED: Use shared calculateLivingStandards function from needs.js
    // incorporating new Hybrid SOL Logic (Income + Wealth)
    const livingStandardsResult = calculateLivingStandards({
        popStructure,
        wealth,
        classIncome: roleWagePayout,
        classShortages,
        epoch,
        techsUnlocked,
        livingStandardStreaks
    });
    const classLivingStandard = livingStandardsResult.classLivingStandard;
    const updatedLivingStandardStreaks = livingStandardsResult.livingStandardStreaks;

    Object.keys(STRATA).forEach(key => {
        const count = popStructure[key] || 0;
        if (count === 0) return;
        const satisfactionInfo = needsReport[key];
        const satisfaction = satisfactionInfo?.satisfactionRatio ?? 1;

        // 获取生活水平对满意度的上限影响
        const livingStandard = classLivingStandard[key];
        const livingStandardApprovalCap = livingStandard?.approvalCap ?? 100;

        let targetApproval = 70; // Base approval

        // Tax Burden Logic
        const headRate = getHeadTaxRate(key);
        const headBase = STRATA[key]?.headTaxBase ?? 0.01;
        const taxPerCapita = Math.max(0, headBase * headRate * effectiveTaxModifier);
        const incomePerCapita = (roleWagePayout[key] || 0) / Math.max(1, count);
        if (incomePerCapita > 0.001 && taxPerCapita > incomePerCapita * 0.5) {
            targetApproval = Math.min(targetApproval, 40); // Tax burden cap
        } else if (headRate < 0.6) {
            targetApproval += 5; // Tax relief bonus
        }

        // Resource Shortage Logic
        const totalNeeds = satisfactionInfo?.totalTrackedNeeds ?? 0;
        const unmetNeeds = (classShortages[key] || []).length;
        if (unmetNeeds > 0 && totalNeeds > 0) {
            if (unmetNeeds >= totalNeeds) {
                targetApproval = Math.min(targetApproval, 0); // All needs unmet, drops to 0
            } else {
                targetApproval = Math.min(targetApproval, 30); // Partial shortage, capped at 30
            }
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
        if (satisfaction > 1.5) {
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

        const currentApproval = classApproval[key] || 50;
        const adjustmentSpeed = 0.02; // How slowly approval changes per tick
        let newApproval = currentApproval + (targetApproval - currentApproval) * adjustmentSpeed;

        // 应用生活水平对满意度的上限限制
        // 生活水平越低，满意度上限越低
        newApproval = Math.min(newApproval, livingStandardApprovalCap);

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
    Object.keys(STRATA).forEach(key => {
        const currentWealth = wealth[key] || 0;
        if (currentWealth > 0) {
            const decay = Math.ceil(currentWealth * 0.005); // 0.5% daily decay
            wealth[key] = Math.max(0, currentWealth - decay);
            // Record decay as expense so UI balances
            roleExpense[key] = (roleExpense[key] || 0) + decay;
        }
    });

    Object.keys(STRATA).forEach(key => {
        classWealthResult[key] = Math.max(0, wealth[key] || 0);
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

    let totalInfluence = Object.values(classInfluence).reduce((sum, val) => sum + val, 0);
    let exodusPopulationLoss = 0;
    let extraStabilityPenalty = 0;
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
                if (fleeingCapital > 0) {
                    wealth[key] = Math.max(0, currentWealth - fleeingCapital);
                }
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

            // 为稳定性惩罚也添加短缺详情
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

    // Calculate weighted average of class approval based on influence share
    let weightedApprovalSum = 0;
    let totalWeight = 0;

    Object.keys(STRATA).forEach(key => {
        const count = popStructure[key] || 0;
        if (count === 0) return;
        const approval = classApproval[key] || 50;
        const influence = classInfluence[key] || 0;
        const influenceShare = totalInfluence > 0 ? influence / totalInfluence : 0;

        weightedApprovalSum += approval * influenceShare;
        totalWeight += influenceShare;
    });

    // Base stability from weighted average of class approval
    let baseStability = totalWeight > 0 ? weightedApprovalSum : 50;
    if (eventStabilityModifier) {
        baseStability += eventStabilityModifier;
    }

    // Add buff/debuff modifiers
    let stabilityModifier = 0;
    newActiveBuffs.forEach(buff => {
        if (buff.stability) stabilityModifier += buff.stability;
    });
    newActiveDebuffs.forEach(debuff => {
        if (debuff.stability) stabilityModifier += debuff.stability;
    });
    stabilityModifier -= extraStabilityPenalty;

    // Final stability value: base + modifiers, clamped to 0-100 (this is the TARGET)
    const targetStability = Math.max(0, Math.min(100, baseStability + stabilityModifier));

    // NEW: Inertia-based stability calculation
    // Stability drifts towards target at STABILITY_INERTIA (5%) per tick, making crises feel weightier
    // REFACTORED: Using STABILITY_INERTIA imported from ./utils/constants
    const stabilityValue = Math.max(0, Math.min(100,
        currentStability + (targetStability - currentStability) * STABILITY_INERTIA
    ));

    const stabilityFactor = Math.min(1.5, Math.max(0.5, 1 + (stabilityValue - 50) / 100));
    const efficiency = stabilityFactor;

    const visibleEpoch = epoch;
    // 记录本回合来自战争赔款（含分期）的财政收入
    let warIndemnityIncome = 0;
    const playerPopulationBaseline = Math.max(5, population || 5);
    const playerWealthBaseline = Math.max(100, (res.silver ?? resources?.silver ?? 0));

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
            if (visibleEpoch >= 1) {
                // REFACTORED: Using module function for AI military action
                const militaryResult = processAIMilitaryAction({
                    nation: next,
                    tick,
                    epoch,
                    resources: res,
                    army,
                    logs,
                });
                raidPopulationLoss += militaryResult.raidPopulationLoss;
            }
            // REFACTORED: Using module function for AI peace request check
            checkAIPeaceRequest({ nation: next, tick, logs });

            // REFACTORED: Using module function for AI surrender demand check
            checkAISurrenderDemand({ nation: next, tick, population, logs });
        } else if (next.warDuration) {
            next.warDuration = 0;
        }
        const relation = next.relation ?? 50;

        // REFACTORED: Using module function for relation decay
        processNationRelationDecay(next);

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

    // REFACTORED: Using module function for ally cold events
    processAllyColdEvents(updatedNations, tick, logs);


    // Filter visible nations for diplomacy processing
    const visibleNations = updatedNations.filter(n =>
        epoch >= (n.appearEpoch ?? 0) && (n.expireEpoch == null || epoch <= n.expireEpoch) && !n.isRebelNation
    );

    // REFACTORED: Using module function for AI gift diplomacy
    processAIGiftDiplomacy(visibleNations, logs);


    // REFACTORED: Using module function for AI-AI trade
    processAITrade(visibleNations, logs);


    // REFACTORED: Using module function for AI-Player trade
    processAIPlayerTrade(visibleNations, tick, res, market, logs, taxPolicies);


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
        const baselineContribution = Math.max(0, population || 0) * FERTILITY_BASELINE_RATE;
        birthAccumulator += baselineContribution;
        if (population < LOW_POP_THRESHOLD) {
            const missingRatio = Math.max(0, (LOW_POP_THRESHOLD - population) / LOW_POP_THRESHOLD);
            birthAccumulator += LOW_POP_GUARANTEE * missingRatio;
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
            const birthRate = FERTILITY_BASE_RATE * approvalFactor * wealthFactor;
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
            logs.push("饥荒导致人口减少！");
        }
    }

    // 基础需求（食物/布料）长期未满足导致死亡
    let starvationDeaths = 0;
    Object.keys(STRATA).forEach(key => {
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

            // 如果缺乏食物或布料，且最近5个tick平均满足率低于60%
            if ((lackingFood || lackingCloth) && avgSatisfaction < 0.6) {
                const className = def.name || key;

                // 死亡率取决于满足率：满足率越低，死亡率越高
                // 满足率60%时死亡率0%，满足率0%时死亡率最高5%
                const deathRate = Math.max(0, (0.6 - avgSatisfaction) / 0.6 * 0.05);
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

    const totalForcedLoss = raidPopulationLoss + exodusPopulationLoss + starvationDeaths;
    if (totalForcedLoss > 0) {
        nextPopulation = Math.max(0, nextPopulation - totalForcedLoss);
    }
    nextPopulation = Math.max(0, Math.floor(nextPopulation));

    Object.keys(res).forEach(k => {
        if (res[k] < 0) res[k] = 0;
    });

    const collectedHeadTax = taxBreakdown.headTax * efficiency;
    const collectedIndustryTax = taxBreakdown.industryTax * efficiency;
    const collectedBusinessTax = taxBreakdown.businessTax * efficiency;
    const totalCollectedTax = collectedHeadTax + collectedIndustryTax + collectedBusinessTax;

    // 将税收与战争赔款一并视为财政收入
    const baseFiscalIncome = totalCollectedTax + warIndemnityIncome;
    // NEW: Apply income percentage bonus (from tech/decree effects)
    const incomePercentMultiplier = Math.max(0, 1 + incomePercentBonus);
    const totalFiscalIncome = baseFiscalIncome * incomePercentMultiplier;

    res.silver = (res.silver || 0) + totalFiscalIncome;
    rates.silver = (rates.silver || 0) + totalFiscalIncome;


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
    const defaultInventoryTargetDays = Math.max(0.1, defaultMarketInfluence.inventoryTargetDays ?? 1.5);
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
        const inventoryTargetDays = resourceMarketConfig.inventoryTargetDays !== undefined
            ? Math.max(0.1, resourceMarketConfig.inventoryTargetDays)
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
        const inventoryDays = dailyDemand > 0 ? inventoryStock / dailyDemand : inventoryTargetDays;

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
            const upgradeLevels = buildingUpgrades[building.id] || {};
            const levelCounts = {};
            for (let i = 0; i < buildingCount; i++) {
                const level = upgradeLevels[i] || 0;
                levelCounts[level] = (levelCounts[level] || 0) + 1;
            }

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
                const businessTaxMultiplier = taxPolicies?.businessTaxRates?.[building.id] ?? 1;
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
                    priceMultiplier = 1.0 - (inventoryRatio - 2.0) * 0.3; // 最低0.1倍
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
                priceMultiplier = 1.0 - (inventoryRatio - 2.0) * 0.3; // 最低0.1倍
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
        logs,
    });
    const merchantLockedCapital = Math.max(0, updatedMerchantState.lockedCapital ?? sumLockedCapital(updatedMerchantState.pendingTrades));
    updatedMerchantState.lockedCapital = merchantLockedCapital;
    const merchantCapitalInvested = updatedMerchantState.capitalInvestedThisTick || 0;
    if ('capitalInvestedThisTick' in updatedMerchantState) {
        delete updatedMerchantState.capitalInvestedThisTick;
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
        // 商人特例：优先使用当前运营收入（Net Income），忽略因进货导致的财富（Wealth）波动
        const incomeSignal = (role === 'merchant' || historicalIncomePerCapita !== 0)
            ? (role === 'merchant' ? fallbackIncome : historicalIncomePerCapita)
            : fallbackIncome;
        const stabilityBonus = perCap > 0 ? perCap * 0.002 : 0;

        // 以上一tick的人均净收入为主导，辅以小幅稳定性奖励，避免理论工资误导
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

    const totalMigratablePop = activeRoleMetrics.reduce((sum, r) => r.pop > 0 ? sum + r.pop : sum, 0);
    const averagePotentialIncome = totalMigratablePop > 0
        ? activeRoleMetrics.reduce((sum, r) => sum + (r.potentialIncome * r.pop), 0) / totalMigratablePop
        : 0;

    // 计算平均人均财富，用于判断富裕阶层的转职阈值
    const averagePerCapWealth = totalMigratablePop > 0
        ? activeRoleMetrics.reduce((sum, r) => sum + (r.perCap * r.pop), 0) / totalMigratablePop
        : 0;

    // 寻找收入低于平均水平的源职业（排除军人，军人不能转职到其他岗位）
    // 改进：对于富裕阶层（如商人），使用基于人均财富百分比的阈值
    // 商人进货一次可能花几百块，但只要这只占财富的一小部分，就不应触发转职
    const sourceCandidate = activeRoleMetrics
        .filter(r => {
            if (r.pop <= 0 || r.role === 'soldier') return false;

            // 改用基于人均财富百分比的阈值
            // 当单tick亏损超过人均财富的5%时，才认为是"严重亏损"需要考虑转职
            // 例如：商人人均财富500银币，则亏损阈值为 -500 * 0.05 = -25
            // 同时设置一个最小阈值（-0.5）和最大阈值（-50），防止极端情况
            const percentageThreshold = r.perCap * 0.05; // 5% of per capita wealth
            const adjustedDeltaThreshold = -Math.max(0.5, Math.min(50, percentageThreshold));

            // 收入过低 或 亏损超过调整后的阈值（人均财富的5%）
            return r.potentialIncome < averagePotentialIncome * 0.7 || r.perCapDelta < adjustedDeltaThreshold;
        })
        .reduce((lowest, current) => {
            if (!lowest) return current;
            if (current.potentialIncome < lowest.potentialIncome) return current;
            if (current.potentialIncome === lowest.potentialIncome && current.perCapDelta < lowest.perCapDelta) return current;
            return lowest;
        }, null);

    // 寻找收入显著更高的目标职业（必须有空缺，且必须是不同职业）
    // 军人岗位特殊处理：允许平民转职成军人（当军饷高且有岗位空缺时），但军人不需要检查建筑空缺
    let targetCandidate = null;
    if (sourceCandidate) {
        targetCandidate = activeRoleMetrics
            .filter(r => {
                // 基本条件：不同职业且有空缺
                if (r.role === sourceCandidate.role || r.vacancy <= 0) return false;
                // 军人岗位特殊处理：不需要建筑空缺，但需要有岗位空缺（来自训练队列）
                if (r.role === 'soldier') {
                    // 军人岗位空缺来自训练队列的等待人员
                    return r.potentialIncome > sourceCandidate.potentialIncome * 1.3;
                }
                // 其他职业需要有建筑空缺
                return hasBuildingVacancyForRole(r.role) &&
                    r.potentialIncome > sourceCandidate.potentialIncome * 1.3;
            })
            .reduce((best, current) => {
                if (!best) return current;
                if (current.potentialIncome > best.potentialIncome) return current;
                if (current.potentialIncome === best.potentialIncome && current.perCapDelta > best.perCapDelta) return best;
                return best;
            }, null);
    }

    // 执行转职并转移财富
    if (sourceCandidate && targetCandidate) {
        // 如果迁移比例为0，直接返回，不执行任何迁移
        if (JOB_MIGRATION_RATIO <= 0) {
            // do nothing
        } else {
            let placementInfo = null;
            let migrants = Math.floor(sourceCandidate.pop * JOB_MIGRATION_RATIO);
            // 只有当迁移比例大于0时才允许强制迁移
            if (migrants <= 0 && sourceCandidate.pop > 0 && JOB_MIGRATION_RATIO > 0) migrants = 1;
            migrants = Math.min(migrants, targetCandidate.vacancy);

            if (migrants > 0) {
                // 军人岗位特殊处理：不需要预留建筑空缺
                if (targetCandidate.role === 'soldier') {
                    // 直接使用空缺数，placementInfo 留空
                    placementInfo = { buildingId: null, buildingName: '军营', count: migrants };
                } else {
                    const placement = reserveBuildingVacancyForRole(targetCandidate.role, migrants);
                    if (!placement || placement.count <= 0) {
                        migrants = 0;
                    } else {
                        migrants = placement.count;
                        placementInfo = placement;
                    }
                }
            }

            if (migrants > 0) {
                // 关键：执行财富转移
                const sourceWealth = wealth[sourceCandidate.role] || 0;
                const perCapWealth = sourceCandidate.pop > 0 ? sourceWealth / sourceCandidate.pop : 0;
                const migratingWealth = perCapWealth * migrants;

                if (migratingWealth > 0) {
                    wealth[sourceCandidate.role] = Math.max(0, sourceWealth - migratingWealth);
                    wealth[targetCandidate.role] = (wealth[targetCandidate.role] || 0) + migratingWealth;
                }

                // 执行人口转移
                popStructure[sourceCandidate.role] = Math.max(0, sourceCandidate.pop - migrants);
                popStructure[targetCandidate.role] = (popStructure[targetCandidate.role] || 0) + migrants;

                const sourceName = STRATA[sourceCandidate.role]?.name || sourceCandidate.role; const targetName = STRATA[targetCandidate.role]?.name || targetCandidate.role;
                const incomeGain = ((targetCandidate.potentialIncome - sourceCandidate.potentialIncome) / Math.max(0.01, sourceCandidate.potentialIncome) * 100).toFixed(0);
                const placementNote = placementInfo?.buildingName ? `（目标建筑：${placementInfo.buildingName}）` : '';
                // 转职到军人时显示特殊日志
                // if (targetCandidate.role === 'soldier') {
                //     logs.push(`⚔️ ${migrants} 名 ${sourceName} 响应高薪号召入伍，加入军队训练`);
                // }
                //   logs.push(`💼 ${migrants} 名 ${sourceName} 转职为 ${targetName}${placementNote}（预期收益提升 ${incomeGain}%）`);
            }
        }
    }

    // 商人交易已在转职逻辑前执行，这里只需应用收入到财富
    applyRoleIncomeToWealth();

    // Sync classWealthResult and totalWealth to include income for all classes
    Object.keys(STRATA).forEach(key => {
        classWealthResult[key] = Math.max(0, wealth[key] || 0);
    });
    totalWealth = Object.values(classWealthResult).reduce((sum, val) => sum + val, 0);

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

    taxBreakdown.policyIncome = decreeSilverIncome;
    taxBreakdown.policyExpense = decreeSilverExpense;

    const netTax = totalCollectedTax
        - taxBreakdown.subsidy
        + warIndemnityIncome
        + decreeSilverIncome
        - decreeSilverExpense;
    const taxes = {
        total: netTax,
        efficiency,
        breakdown: {
            headTax: collectedHeadTax,
            industryTax: collectedIndustryTax,
            businessTax: collectedBusinessTax,
            subsidy: taxBreakdown.subsidy,
            warIndemnity: warIndemnityIncome,
            policyIncome: decreeSilverIncome,
            policyExpense: decreeSilverExpense,
        },
    };

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
        logs,
        market: {
            prices: updatedPrices,
            demand,
            supply,
            wages: updatedWages,
            needsShortages: classShortages,
        },
        classIncome: roleWagePayout,
        classExpense: roleExpense,
        jobFill: buildingJobFill,
        jobsAvailable,
        taxes,
        needsShortages: classShortages,
        needsReport,
        livingStandardStreaks: updatedLivingStandardStreaks,
        nations: updatedNations,
        merchantState: updatedMerchantState,
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
                // 阶层财富增长对需求的影响（财富越高需求越高）
                stratumWealthMultiplier: stratumWealthMultipliers,
            },
        },
    };
};
