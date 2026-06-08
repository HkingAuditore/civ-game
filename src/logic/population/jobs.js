/**
 * Job Management Module
 * Handles job allocation, vacancy management, and job migration
 */

import { STRATA, TAX_BASE_RATES } from '../../config';
import {
    ROLE_PRIORITY,
    JOB_MIGRATION_RATIO,
    JOB_MIGRATION_LOW_POP_GUARANTEE,
    LOW_POP_THRESHOLD,
    STRATUM_TIERS,
    TIER_PROMOTION_WEALTH_RATIO,
    ROLE_PROMOTION_WEALTH_RATIO_OVERRIDE,
    TIER_SEEK_WEALTH_THRESHOLD,
    TIER_UPGRADE_ATTRACTIVENESS_BONUS,
    // New migration resistance constants
    SAME_TIER_MIGRATION_RESISTANCE,
    DOWNGRADE_MIGRATION_RESISTANCE,
    MULTI_TIER_DOWNGRADE_PENALTY,
    UPGRADE_MIGRATION_BONUS,
    MIGRATION_COOLDOWN_TICKS,
    VACANCY_FILL_RATIO_PER_TICK,
    VACANCY_FILL_RATIO_TIER01,
    TIER01_MIN_NET_INCOME_FLOOR,
    // Lucky promotion
    LUCKY_PROMOTION_CHANCE,
    // 高收入空缺业主岗位晋升助推（C 方案）
    LUCRATIVE_PROMOTION_BOOTSTRAP_RATIO,
    UNDERFILLED_TARGET_MIGRATION_RATIO,
    // Survival migration
    CRITICAL_SHORTAGE_THRESHOLD,
    CRITICAL_RESOURCES,
    SHORTAGE_MIGRATION_BONUS,
    EMERGENCY_MIGRATION_RATIO,
    // 【需求 3.1 / 3.3】补贴拉力与同 tier 阻力削减
    SUBSIDY_PULL_MULTIPLIER,
    SUBSIDY_RESISTANCE_REDUCTION_THRESHOLD,
    SUBSIDY_HIGH_ATTRACTIVENESS_RATIO,
    // 生存危机迁移强化（方案 A）
    CRISIS_SUBSIDY_SIGNAL_MULTIPLIER,
    CRITICAL_SHORTAGE_ATTRACTIVENESS_MULTIPLIER,
    CRISIS_DOWNGRADE_RESISTANCE_CAP,
    // 关键生产者保留锁
    SUBSIDY_DEPENDENCY_LOCK_RATIO,
    CRITICAL_PRODUCER_RETENTION_FILL_RATE,
} from '../utils/constants';

import { RESOURCES } from '../../config';

// [FIX] Import safeWealth for wealth overflow protection
import { safeWealth } from '../utils/helpers';

// === Wealth change tracking helper ===
// Helper function to track wealth changes for traceability
// Returns the change log entry
const trackWealthTransfer = (wealthChangeLog, fromStratum, toStratum, amount, reason) => {
    if (amount <= 0) return;
    if (!wealthChangeLog) return;
    
    if (!wealthChangeLog[fromStratum]) {
        wealthChangeLog[fromStratum] = [];
    }
    if (!wealthChangeLog[toStratum]) {
        wealthChangeLog[toStratum] = [];
    }
    
    wealthChangeLog[fromStratum].push({ amount: -amount, reason: `${reason}_out` });
    wealthChangeLog[toStratum].push({ amount: amount, reason: `${reason}_in` });
};

// Helper: apply wealth change with tracking
const applyWealthChange = (wealth, wealthChangeLog, stratum, amount, reason) => {
    if (amount === 0) return;
    wealth[stratum] = Math.max(0, (wealth[stratum] || 0) + amount);
    
    if (wealthChangeLog) {
        if (!wealthChangeLog[stratum]) {
            wealthChangeLog[stratum] = [];
        }
        wealthChangeLog[stratum].push({ amount, reason });
    }
};

/**
 * Initialize job availability tracking
 * @returns {Object} Jobs available by role
 */
export const initializeJobsAvailable = () => {
    const jobsAvailable = {};
    ROLE_PRIORITY.forEach(role => jobsAvailable[role] = 0);
    return jobsAvailable;
};

/**
 * Initialize wage statistics tracking
 * @returns {Object} Wage stats and payouts by role
 */
export const initializeWageTracking = () => {
    const roleWageStats = {};
    const roleWagePayout = {};
    ROLE_PRIORITY.forEach(role => {
        roleWageStats[role] = { totalSlots: 0, weightedWage: 0 };
        roleWagePayout[role] = 0;
    });
    return { roleWageStats, roleWagePayout };
};

/**
 * Initialize expense tracking
 * @returns {Object} Expense and tax tracking objects
 */
export const initializeExpenseTracking = () => {
    const roleExpense = {};
    const roleHeadTaxPaid = {};
    const roleBusinessTaxPaid = {};

    Object.keys(STRATA).forEach(key => {
        roleExpense[key] = 0;
        roleHeadTaxPaid[key] = 0;
        roleBusinessTaxPaid[key] = 0;
    });

    return { roleExpense, roleHeadTaxPaid, roleBusinessTaxPaid };
};

/**
 * Allocate population to jobs based on previous structure
 * @param {Object} params - Allocation parameters
 * @param {Set} [params.protectedRoles] - Optional: roles that produce essential resources (food/cloth), get 50% layoff reduction
 * @returns {Object} Updated population structure
 */
export const allocatePopulation = ({
    population,
    previousPopStructure,
    jobsAvailable,
    wealth,
    protectedRoles = null
}) => {
    const hasPreviousPopStructure = previousPopStructure &&
        Object.keys(previousPopStructure).length > 0;
    const popStructure = {};

    if (!hasPreviousPopStructure) {
        // First run - initialize with unemployed
        ROLE_PRIORITY.forEach(role => {
            popStructure[role] = 0;
        });
        popStructure.unemployed = population;
    } else {
        // Inherit previous state
        ROLE_PRIORITY.forEach(role => {
            const prevCount = (previousPopStructure[role] || 0);
            popStructure[role] = Math.max(0, prevCount);
        });
        popStructure.unemployed = Math.max(0, (previousPopStructure.unemployed || 0));

        // Handle population changes
        const assignedPop = ROLE_PRIORITY.reduce(
            (sum, role) => sum + (popStructure[role] || 0), 0
        ) + (popStructure.unemployed || 0);
        const diff = population - assignedPop;

        if (diff > 0) {
            // Population growth - add to unemployed
            popStructure.unemployed = (popStructure.unemployed || 0) + diff;
        } else if (diff < 0) {
            // Population decline - reduce from unemployed first
            let reductionNeeded = -diff;
            const unemployedReduction = Math.min(popStructure.unemployed || 0, reductionNeeded);
            if (unemployedReduction > 0) {
                popStructure.unemployed -= unemployedReduction;
                reductionNeeded -= unemployedReduction;
            }

            // If still need reduction, proportionally from all roles
            // [FIX] 受保护角色（自营粮食/布料生产者）裁员比例减半
            if (reductionNeeded > 0) {
                const initialTotal = ROLE_PRIORITY.reduce(
                    (sum, role) => sum + (popStructure[role] || 0), 0
                );
                if (initialTotal > 0) {
                    const baseReduction = reductionNeeded;
                    ROLE_PRIORITY.forEach((role, index) => {
                        if (reductionNeeded <= 0) return;
                        const current = popStructure[role] || 0;
                        if (current <= 0) return;
                        const proportion = current / initialTotal;
                        let remove = Math.floor(proportion * baseReduction);
                        if (remove <= 0 && reductionNeeded > 0) remove = 1;
                        // 受保护角色裁员量减半（50% 豁免）
                        if (protectedRoles && protectedRoles.has(role)) {
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
                    });
                }
            }
        }
    }

    popStructure.unemployed = Math.max(0, popStructure.unemployed || 0);
    return popStructure;
};

/**
 * Handle layoffs when job slots decrease
 * @param {Object} params - Layoff parameters
 * @returns {Object} Updated population structure and wealth
 */
export const handleLayoffs = ({
    popStructure,
    jobsAvailable,
    wealth,
    wealthChangeLog = null  // Optional: for tracking changes
}) => {
    ROLE_PRIORITY.forEach(role => {
        const current = popStructure[role] || 0;
        const slots = Math.max(0, jobsAvailable[role] || 0);
        if (current > slots) {
            const layoffs = current - slots;
            const roleWealth = wealth[role] || 0;
            const perCapWealth = current > 0 ? roleWealth / current : 0;

            // Transfer population to unemployed with wealth
            popStructure[role] = slots;
            popStructure.unemployed = (popStructure.unemployed || 0) + layoffs;

            if (perCapWealth > 0) {
                const transfer = perCapWealth * layoffs;
                wealth[role] = Math.max(0, roleWealth - transfer);
                wealth.unemployed = (wealth.unemployed || 0) + transfer;
                trackWealthTransfer(wealthChangeLog, role, 'unemployed', transfer, 'layoff_wealth_transfer');
            }
        }
    });

    return { popStructure, wealth };
};

/**
 * Fill job vacancies with social mobility constraints
 * - Tier 0/1 jobs: Can be filled directly by unemployed
 * - Tier 2/3 jobs: Require candidates from lower tier with sufficient wealth
 * @param {Object} params - Hiring parameters
 * @returns {Object} Updated population structure and wealth
 */
export const fillVacancies = ({
    popStructure,
    jobsAvailable,
    wealth,
    getExpectedWage,
    getHeadTaxRate,
    effectiveTaxModifier,
    wealthChangeLog = null,  // Optional: for tracking changes
    // [饥荒锁] 饥荒时传入"受保护的粮食/布料生产者"集合（如 peasant）。
    //   这些角色禁止作为晋升来源被抽去高 tier 岗位（工匠等），
    //   否则刚被征召/招募来种田的人会立刻被高收入空缺岗（工匠空缺数千）晋升抽走，净增为 0。
    lockedSourceRoles = null
}) => {
    const lockedSources = lockedSourceRoles instanceof Set ? lockedSourceRoles : new Set();
    // Estimate net income for each role
    const estimateRoleNetIncome = (role) => {
        const wage = getExpectedWage(role);
        const headRate = getHeadTaxRate(role);
        let taxCost = 0;
        if (headRate > 0) {
            const incomeBase = (Number.isFinite(wage) && wage > 0)
            ? wage * (TAX_BASE_RATES?.HEAD_TAX_INCOME_RATIO || 1.0) : 0;
            taxCost = incomeBase * headRate * effectiveTaxModifier;
        } else if (headRate < 0) {
            taxCost = headRate * effectiveTaxModifier;
        }
        const netIncome = wage - taxCost;
        // Tier 0/1 岗位净收入保底：防止因工资预估不准导致排序过低
        const tier = STRATUM_TIERS[role] ?? 0;
        if (tier <= 1 && netIncome <= 0) {
            return TIER01_MIN_NET_INCOME_FLOOR;
        }
        return netIncome;
    };

    // Get the wealth requirement to enter a target role
    const getWealthRequirement = (targetRole) => {
        const targetTier = STRATUM_TIERS[targetRole] ?? 0;
        const roleRatio = ROLE_PROMOTION_WEALTH_RATIO_OVERRIDE[targetRole];
        const wealthRatio = Number.isFinite(roleRatio)
            ? roleRatio
            : (TIER_PROMOTION_WEALTH_RATIO[targetTier] ?? 0);
        const targetStartingWealth = STRATA[targetRole]?.startingWealth ?? 100;
        return targetStartingWealth * wealthRatio;
    };

    // Check if a source role can provide candidates for target role
    const canProvideCandidate = (sourceRole, targetRole) => {
        const sourceTier = STRATUM_TIERS[sourceRole] ?? 0;
        const targetTier = STRATUM_TIERS[targetRole] ?? 0;

        // For Tier 0/1 jobs, anyone can fill
        if (targetTier <= 2) return true;

        // For Tier 2+ jobs:
        // - Can be filled by same tier (re-employment after layoff)
        // - Can be filled by ANY lower tier with sufficient wealth (Direct Promotion)
        // - Can be filled by lower tier via Lucky Lottery (Lucky Promotion)
        if (sourceTier <= targetTier) return true;

        return false;
    };

    // Rank vacancies by net income
    const vacancyRanking = ROLE_PRIORITY.map((role, index) => {
        const slots = Math.max(0, jobsAvailable[role] || 0);
        const current = popStructure[role] || 0;
        const vacancy = Math.max(0, slots - current);
        if (vacancy <= 0) return null;
        if (role === 'official') return null; // Officials are managed separately
        return {
            role,
            vacancy,
            netIncome: estimateRoleNetIncome(role),
            priorityIndex: index,
            tier: STRATUM_TIERS[role] ?? 0,
            wealthRequired: getWealthRequirement(role)
        };
    })
        .filter(Boolean)
        .sort((a, b) => {
            // Tier 0/1 岗位优先填补，确保基础生产岗位不会被高级岗位抢占失业者
            const aTierGroup = a.tier <= 1 ? 0 : 1;
            const bTierGroup = b.tier <= 1 ? 0 : 1;
            if (aTierGroup !== bTierGroup) return aTierGroup - bTierGroup;
            // 同组内按净收入降序排列
            if (b.netIncome !== a.netIncome) return b.netIncome - a.netIncome;
            return a.priorityIndex - b.priorityIndex;
        });

    // Fill vacancies with tier-based constraints
    vacancyRanking.forEach(entry => {
        // Tier 0/1 使用更高的填补速率，确保 2 tick 内填满空缺
        // [加速] 严重空缺(在岗<50%编制)且有利可图的 Tier2/3 业主岗，也使用高填补速率，
        //   避免"高利润空岗以 25%/tick 慢慢填"——这是地主等业主岗填得太慢的主因之一。
        const entrySlots = jobsAvailable[entry.role] || 0;
        const entrySeverelyUnderstaffed = entrySlots > 0 && entry.vacancy >= entrySlots * 0.5;
        const fillRatio = (entry.tier <= 1 || (entrySeverelyUnderstaffed && entry.netIncome > 0))
            ? VACANCY_FILL_RATIO_TIER01
            : VACANCY_FILL_RATIO_PER_TICK;
        const perRoleFillCap = Math.max(
            1,
            Math.floor(entry.vacancy * fillRatio)
        );
        let remainingVacancy = Math.min(entry.vacancy, perRoleFillCap);

        // For Tier 0/1 jobs: direct hire from unemployed
        if (entry.tier <= 1) {
            const availableUnemployed = popStructure.unemployed || 0;
            if (availableUnemployed <= 0 || remainingVacancy <= 0) return;

            const hiring = Math.min(remainingVacancy, availableUnemployed);
            if (hiring <= 0) return;

            const unemployedWealth = wealth.unemployed || 0;
            const perCapWealth = availableUnemployed > 0 ? unemployedWealth / availableUnemployed : 0;

            popStructure[entry.role] = (popStructure[entry.role] || 0) + hiring;
            popStructure.unemployed = Math.max(0, availableUnemployed - hiring);

            if (perCapWealth > 0) {
                const transfer = perCapWealth * hiring;
                wealth.unemployed = Math.max(0, unemployedWealth - transfer);
                // [FIX] Apply safe wealth limit
                wealth[entry.role] = safeWealth((wealth[entry.role] || 0) + transfer);
                trackWealthTransfer(wealthChangeLog, 'unemployed', entry.role, transfer, 'job_hire_tier01');
            }
        } else {
            // For Tier 2/3 jobs: hire from eligible lower tiers with wealth requirement
            // First, try to hire from same-tier unemployed (re-employment)
            // Then, try to hire from tier-1 roles with sufficient wealth

            const candidateRoles = Object.keys(STRATUM_TIERS)
                .filter(role => {
                    if (!canProvideCandidate(role, entry.role)) return false;
                    if (role === entry.role) return false; // Don't hire from same role
                    if (role === 'soldier') return false; // Soldier cannot migrate to other jobs
                    if (role === 'official') return false; // Official is managed separately
                    // [饥荒锁] 饥荒时不允许从粮食/布料生产者（peasant 等）晋升抽人到更高 tier 岗位，
                    //   保住种田的人，打破"刚种田就被工匠岗抽走"的泄漏。
                    if (lockedSources.has(role)) return false;
                    const pop = popStructure[role] || 0;
                    if (pop <= 0) return false;

                    // CRITICAL FIX: For same-tier roles, only allow hiring from:
                    // 1. unemployed pool (always allowed)
                    // 2. roles that have surplus population (pop > jobsAvailable)
                    // This prevents oscillation where worker↔artisan steal each other's workers
                    const sourceTier = STRATUM_TIERS[role] ?? 0;
                    const targetTier = entry.tier;
                    if (sourceTier === targetTier && role !== 'unemployed') {
                        const sourceSlots = jobsAvailable[role] || 0;
                        // Only hire from this role if it has MORE people than job slots
                        if (pop <= sourceSlots) return false;
                    }

                    return true;
                })
                .sort((a, b) => {
                    // Prioritize unemployed (same tier re-employment), then lower tier
                    const tierA = STRATUM_TIERS[a] ?? 0;
                    const tierB = STRATUM_TIERS[b] ?? 0;
                    if (a === 'unemployed') return -1;
                    if (b === 'unemployed') return 1;
                    return tierB - tierA; // Higher tier first (closer to target)
                });

            for (const sourceRole of candidateRoles) {
                if (remainingVacancy <= 0) break;

                const sourcePop = popStructure[sourceRole] || 0;
                if (sourcePop <= 0) continue;

                const sourceWealth = wealth[sourceRole] || 0;
                const perCapWealth = sourcePop > 0 ? sourceWealth / sourcePop : 0;

                // Check wealth requirement (except for same-tier re-employment)
                const sourceTier = STRATUM_TIERS[sourceRole] ?? 0;
                let isLuckyUpdate = false;
                let wealthShortage = 0;
                let eligibleCount = 0;

                if (sourceTier < entry.tier && perCapWealth < entry.wealthRequired) {
                    // Not wealthy enough - try "Lucky Promotion" lottery
                    // Chance is small (e.g. 0.01%)
                    const expectedLucky = sourcePop * LUCKY_PROMOTION_CHANCE;
                    // Probabilistic rounding
                    let luckyCount = Math.floor(expectedLucky) + (Math.random() < (expectedLucky % 1) ? 1 : 0);

                    // [C方案] 高收入空缺业主岗位晋升助推：打破"无业主→停工→无收入→无人晋升"死循环。
                    //   当目标岗位本身有利可图（netIncome>0，如赚钱的矿井/庄园业主岗）时，放行一股引导晋升流，
                    //   让贫穷阶层也能晋升进入，无需先攒够全部门槛财富（差额由系统补足，见下方 extraWealth）。
                    //   分两档，避免旧实现 sourcePop×财富比×0.05 被 floor 取整成 0 而完全失效：
                    //   - 严重空缺(填充率<50%)：以"空缺量"为基准给强引导流，确保高收入空岗能被真正填上；
                    //   - 轻度空缺：温和按"财富接近度"引导，避免对接近满员的岗位过度放水。
                    if (entry.netIncome > 0 && entry.wealthRequired > 0) {
                        const targetSlots = jobsAvailable[entry.role] || 0;
                        const understaffRatio = targetSlots > 0 ? entry.vacancy / targetSlots : 0;
                        let bootstrapCount;
                        if (understaffRatio >= 0.5) {
                            // 实际填补速率仍受 perRoleFillCap(25%/tick) 与 remainingVacancy 约束
                            bootstrapCount = Math.min(sourcePop, Math.max(1, Math.ceil(entry.vacancy * LUCRATIVE_PROMOTION_BOOTSTRAP_RATIO)));
                        } else if (perCapWealth > 0) {
                            const wealthFraction = Math.min(1, perCapWealth / entry.wealthRequired);
                            bootstrapCount = Math.floor(sourcePop * wealthFraction * LUCRATIVE_PROMOTION_BOOTSTRAP_RATIO);
                        } else {
                            bootstrapCount = 0;
                        }
                        if (bootstrapCount > luckyCount) luckyCount = bootstrapCount;
                    }

                    if (luckyCount > 0) {
                        eligibleCount = luckyCount;
                        isLuckyUpdate = true;
                        wealthShortage = entry.wealthRequired - perCapWealth;
                    } else {
                        continue; // Not wealthy enough and didn't win lottery
                    }
                } else {
                    // Standard Logic:
                    // Check how many can be promoted
                    if (sourceTier === entry.tier || entry.wealthRequired <= 0) {
                        // Same tier or no requirement: all eligible
                        eligibleCount = sourcePop;
                    } else {
                        // Lower tier: need to meet wealth requirement
                        // All are equally wealthy (average), so either all qualify or none
                        eligibleCount = perCapWealth >= entry.wealthRequired ? sourcePop : 0;
                    }
                }

                const hiring = Math.min(remainingVacancy, eligibleCount);
                if (hiring <= 0) continue;

                // Transfer population and wealth
                popStructure[entry.role] = (popStructure[entry.role] || 0) + hiring;
                popStructure[sourceRole] = Math.max(0, sourcePop - hiring);

                if (perCapWealth > 0 || isLuckyUpdate) {
                    const transfer = perCapWealth * hiring;
                    wealth[sourceRole] = Math.max(0, sourceWealth - transfer);

                    // If lucky, inject extra wealth to meet requirements (system bonus)
                    const extraWealth = isLuckyUpdate ? (wealthShortage * hiring) : 0;

                    // [FIX] Apply safe wealth limit
                    wealth[entry.role] = safeWealth((wealth[entry.role] || 0) + transfer + extraWealth);
                    
                    // Track the wealth transfer
                    const reason = isLuckyUpdate ? 'job_hire_lucky_promotion' : 'job_hire_tier23';
                    trackWealthTransfer(wealthChangeLog, sourceRole, entry.role, transfer, reason);
                    if (extraWealth > 0) {
                        applyWealthChange(wealth, wealthChangeLog, entry.role, extraWealth, 'job_hire_lucky_bonus');
                    }

                    if (isLuckyUpdate && extraWealth > 0) {
                        // Optional: Log large luck events? (Might spam if frequent, but chance is low)
                        // console.log(`Creating ${hiring} lucky ${entry.role} from ${sourceRole} with subsidy ${extraWealth}`);
                    }
                }

                remainingVacancy -= hiring;
            }
        }
    });

    return { popStructure, wealth };
};

/**
 * Handle job migration between roles with social mobility preferences
 * - Wealthy populations are more inclined to seek higher-tier positions
 * - Higher tier jobs get attractiveness bonus when wealth threshold is met
 * - Tier-based resistance: same-tier and downward migrations are harder
 * - Cooldown mechanism: roles that recently had migration cannot migrate again
 * @param {Object} params - Migration parameters
 * @returns {Object} Updated population structure, wealth, and cooldown state
 */
export const handleJobMigration = ({
    popStructure,
    wealth,
    roleMetrics,
    hasBuildingVacancyForRole,
    reserveBuildingVacancyForRole,
    logs,
    migrationCooldowns = {},  // Track cooldowns for each role
    wealthChangeLog = null,   // Optional: for tracking wealth changes
    supplyDemandRatio = {},   // Supply/demand ratio per resource for survival migration
}) => {
    if (JOB_MIGRATION_RATIO <= 0) return { popStructure, wealth, migrationCooldowns };

    // ============== 生存转职检测 ==============
    // 当生存物资（food/cloth）严重供不应求时，查找生产该资源的角色作为紧急转职目标
    const criticalShortageRoles = new Set();
    let hasCriticalShortage = false;
    for (const res of CRITICAL_RESOURCES) {
        const ratio = supplyDemandRatio[res];
        if (ratio !== undefined && ratio < CRITICAL_SHORTAGE_THRESHOLD) {
            hasCriticalShortage = true;
            const producer = RESOURCES[res]?.defaultOwner;
            if (producer) criticalShortageRoles.add(producer);
        }
    }

    // ============== 关键生产者集合 ==============
    // 包含所有 CRITICAL_RESOURCES 的默认生产者（如 peasant 之于 food）。
    // 不论是否触发"危机阈值"，只要这些角色岗位仍未填满，禁止其作为迁出源。
    // 这避免了"自耕农攒够钱→升 tier 跑路→农田再次空缺"的循环。
    const criticalProducerRoles = new Set();
    for (const res of CRITICAL_RESOURCES) {
        const producer = RESOURCES[res]?.defaultOwner;
        if (producer) criticalProducerRoles.add(producer);
    }

    // ============== 方案 A：危机时补贴信号放大（仅信号层，不动税收结算）==============
    // 当生存危机 + 目标角色是紧缺生产者 + 享受补贴 三者同时成立时，
    // 对该角色的 potentialIncome 做就地补丁，让它在迁移决策中显得更有吸引力。
    // 不修改 wealth/银币流，仅影响候选筛选与阻力比较。
    if (hasCriticalShortage && CRISIS_SUBSIDY_SIGNAL_MULTIPLIER > 1) {
        roleMetrics.forEach(r => {
            if (!criticalShortageRoles.has(r.role)) return;
            const sub = Math.max(0, r.subsidyPerCapita || 0);
            if (sub <= 0) return;
            // 增量 = 补贴金额 × (放大倍率 - 1)，叠加到原 potentialIncome
            const boost = sub * (CRISIS_SUBSIDY_SIGNAL_MULTIPLIER - 1);
            if (Number.isFinite(boost) && boost > 0) {
                r.potentialIncome = (r.potentialIncome || 0) + boost;
            }
        });
    }

    // Decrease all cooldowns by 1 each tick
    const updatedCooldowns = {};
    Object.entries(migrationCooldowns).forEach(([role, cooldown]) => {
        if (cooldown > 1) {
            updatedCooldowns[role] = cooldown - 1;
        }
        // If cooldown reaches 0 or 1, remove it from tracking
    });

    // Calculate average potential income
    // 官员和士兵不参与普通阶层流动
    const activeRoleMetrics = roleMetrics.filter(r => r.role !== 'soldier' && r.role !== 'official');
    if (activeRoleMetrics.length === 0) return { popStructure, wealth, migrationCooldowns: updatedCooldowns };

    const totalPotentialIncome = activeRoleMetrics.reduce(
        (sum, r) => sum + r.potentialIncome * r.pop, 0
    );
    const totalPop = activeRoleMetrics.reduce((sum, r) => sum + r.pop, 0);
    const averagePotentialIncome = totalPop > 0 ? totalPotentialIncome / totalPop : 0;

    // ============== NORMAL MIGRATION LOGIC ==============
    // Calculate max potential income among roles with vacancies (Pull factor)
    const maxPotentialIncome = activeRoleMetrics
        .filter(r => hasBuildingVacancyForRole(r.role))
        .reduce((max, r) => Math.max(max, r.potentialIncome), 0);

    // Find source candidate (struggling role) - exclude roles on cooldown (unless survival crisis)
    const sourceCandidate = activeRoleMetrics
        .filter(r => {
            if (r.pop <= 0 || r.role === 'soldier') return false;
            // 生存危机时跳过冷却限制，允许紧急转职
            if (!hasCriticalShortage) {
                if (updatedCooldowns[r.role] && updatedCooldowns[r.role] > 0) return false;
            }

            // ============== 关键生产者保留锁（三层保护，单向阻止迁出）==============
            // 经济原理：peasant 等关键资源生产者享受补贴的目的是"留人种田"，
            // 不应让攒下的补贴反成为升 tier 的燃料。一旦自家岗位仍未填满，
            // 该角色不允许作为 sourceCandidate（仅阻止迁出，不影响外部迁入）。
            if (criticalProducerRoles.has(r.role)) {
                // 锁 1：危机锁——出现 food/cloth 危机且本角色是当前紧缺生产者，绝不迁出
                if (hasCriticalShortage && criticalShortageRoles.has(r.role)) {
                    return false;
                }
                // 锁 2：岗位空缺锁——自家岗位仍有空缺则不迁出
                //   r.vacancy 为该角色当前岗位缺口（来自 simulation 构造的 roleVacancies）
                //   或 hasBuildingVacancyForRole(r.role) 报告至少一个建筑还能容纳
                const hasOwnVacancy = (r.vacancy || 0) > 0 || hasBuildingVacancyForRole(r.role);
                // 计算自家在岗率：pop / (pop + vacancy)，留 5% 容差避免边界震荡
                const totalSlots = (r.pop || 0) + Math.max(0, r.vacancy || 0);
                const fillRate = totalSlots > 0 ? (r.pop || 0) / totalSlots : 1;
                if (hasOwnVacancy && fillRate < CRITICAL_PRODUCER_RETENTION_FILL_RATE) {
                    return false;
                }
                // 锁 3：补贴依赖锁——补贴占收入比超过阈值且仍有空缺，视为政策维持中
                const incomeRef = Math.max(1e-6, r.potentialIncome || 0);
                const subsidyRatio = (r.subsidyPerCapita || 0) / incomeRef;
                if (subsidyRatio >= SUBSIDY_DEPENDENCY_LOCK_RATIO && hasOwnVacancy) {
                    return false;
                }
            }

            const percentageThreshold = r.perCap * 0.05;
            const adjustedDeltaThreshold = -Math.max(0.5, Math.min(50, percentageThreshold));
            
            // 【障碍 1 修复】生存危机时：非紧缺生产者（如工匠）即使收入正常，
            // 也允许成为迁出源——避免"宁愿饿死也不去种田"。
            // 排除条件：
            //   - 自身是紧缺生产者（不能让 peasant 转走）
            //   - pop 太少（不值得拆）
            if (hasCriticalShortage && !criticalShortageRoles.has(r.role) && r.pop > 0) {
                return true;
            }

            // Criteria for seeking new job:
            // 1. "Push": Income is below 70% of population average
            // 2. "Push": Income is declining significantly
            // 3. "Pull": [NEW] Income is below 85% of the BEST available opportunity (e.g. profitable factories)
            //   修复 B：将 max 比例从 0.6 放宽到 0.85。原 0.6 过严——当 peasant 因高粮价/补贴
            //   把 maxPotentialIncome 拉爆时，artisan 等"普通收入"角色仍难以进入候选源池，
            //   导致补贴政策的拉力无人响应。0.85 让"明显落后于最佳机会"的角色都能成为 source，
            //   且仍保留 15% 的容差避免微小差距引发不必要迁移。
            return r.potentialIncome < averagePotentialIncome * 0.7 ||
                r.perCapDelta < adjustedDeltaThreshold ||
                (maxPotentialIncome > 0 && r.potentialIncome < maxPotentialIncome * 0.85);
        })
        .reduce((lowest, current) => {
            if (!lowest) return current;
            // 【障碍 1 修复】危机时优先选 pop 最大的"非紧缺生产者"作为迁出源，
            // 这样工匠/工人/书吏等有大量富余人口的角色优先被疏散去种田。
            if (hasCriticalShortage) {
                const lowestIsCritical = criticalShortageRoles.has(lowest.role);
                const currentIsCritical = criticalShortageRoles.has(current.role);
                // 紧缺生产者绝不作为源（被前置过滤已剔除，但二次保险）
                if (currentIsCritical) return lowest;
                if (lowestIsCritical) return current;
                // 都是非紧缺生产者：优先选 pop 大的（有富余劳力可疏散）
                if (current.pop !== lowest.pop) {
                    return current.pop > lowest.pop ? current : lowest;
                }
                // pop 相同时选 tier 高的（更有"可降级空间"）
                const lowestTier = STRATUM_TIERS[lowest.role] ?? 0;
                const currentTier = STRATUM_TIERS[current.role] ?? 0;
                if (currentTier !== lowestTier) {
                    return currentTier > lowestTier ? current : lowest;
                }
            }
            // Prioritize the one with the biggest gap to the max potential
            // (or originally: lowest potential income)
            if (current.potentialIncome < lowest.potentialIncome) return current;
            if (current.potentialIncome === lowest.potentialIncome &&
                current.perCapDelta < lowest.perCapDelta) return current;
            return lowest;
        }, null);

    if (!sourceCandidate) return { popStructure, wealth, migrationCooldowns: updatedCooldowns };

    // Calculate source role's wealth status for tier-seeking behavior
    const sourceTier = STRATUM_TIERS[sourceCandidate.role] ?? 0;
    const sourceStartingWealth = STRATA[sourceCandidate.role]?.startingWealth ?? 100;
    const sourceWealth = wealth[sourceCandidate.role] || 0;
    const sourcePerCapWealth = sourceCandidate.pop > 0 ? sourceWealth / sourceCandidate.pop : 0;
    const isWealthyEnoughToSeekTier = sourcePerCapWealth >= sourceStartingWealth * TIER_SEEK_WEALTH_THRESHOLD;

    /**
     * Calculate the tier-based resistance multiplier for migration
     * - Upward: easier (lower multiplier)
     * - Same tier: harder (higher multiplier)  
     * - Downward: much harder (highest multiplier)
     */
    const getTierResistanceMultiplier = (targetRole, targetSubsidyPerCapita = 0) => {
        const targetTier = STRATUM_TIERS[targetRole] ?? 0;
        const tierDiff = targetTier - sourceTier;

        let resistance;
        if (tierDiff > 0) {
            resistance = UPGRADE_MIGRATION_BONUS;
        } else if (tierDiff === 0) {
            resistance = SAME_TIER_MIGRATION_RESISTANCE;
            // 【需求 3.3】同 tier 场景下，若补贴金额足够显著，
            // 按补贴强度线性削减同 tier 阻力，下限 1.0（等同升 tier 严格度）。
            // 仅对本次迁移生效，不修改常量。
            const sourceIncomeRef = Math.max(1e-6, sourceCandidate?.potentialIncome || 0);
            const subsidyStrengthRatio = (targetSubsidyPerCapita || 0) / sourceIncomeRef;
            if (subsidyStrengthRatio >= SUBSIDY_RESISTANCE_REDUCTION_THRESHOLD) {
                const t = Math.max(0, Math.min(1,
                    (subsidyStrengthRatio - SUBSIDY_RESISTANCE_REDUCTION_THRESHOLD) / 0.7
                ));
                resistance = SAME_TIER_MIGRATION_RESISTANCE * (1 - t) + 1.0 * t;
            }
        } else {
            const tiersBelowCount = Math.abs(tierDiff);
            resistance = DOWNGRADE_MIGRATION_RESISTANCE * Math.pow(MULTI_TIER_DOWNGRADE_PENALTY, tiersBelowCount - 1);
        }

        // 生存危机时，转向紧缺资源生产者的阻力大幅降低
        if (hasCriticalShortage && criticalShortageRoles.has(targetRole)) {
            resistance *= SHORTAGE_MIGRATION_BONUS;
            // 【障碍 2 修复】危机时：降级到紧缺生产角色的阻力直接 clamp 至上限，
            // 避免“工匠→peasant”需要 2.6× 收入才能迁移的门槛。
            // 不需要别的条件——只要是“转向紧缺生产角色”，什么方向的迁移都应该被鼓励。
            if (tierDiff < 0 && resistance > CRISIS_DOWNGRADE_RESISTANCE_CAP) {
                resistance = CRISIS_DOWNGRADE_RESISTANCE_CAP;
            }
        }

        return resistance;
    };

    // Calculate effective attractiveness for a target role
    // Includes tier upgrade bonus when wealth threshold is met
    const calculateEffectiveAttractiveness = (targetRole, basePotentialIncome) => {
        const targetTier = STRATUM_TIERS[targetRole] ?? 0;
        const tierDiff = targetTier - sourceTier;

        // Base attractiveness is the potential income
        let attractiveness = basePotentialIncome;

        // Add tier upgrade bonus if wealthy enough and target is higher tier
        if (isWealthyEnoughToSeekTier && tierDiff > 0) {
            // Each tier increase adds TIER_UPGRADE_ATTRACTIVENESS_BONUS (20%) to attractiveness
            const tierBonus = attractiveness * TIER_UPGRADE_ATTRACTIVENESS_BONUS * tierDiff;
            attractiveness += tierBonus;
        }

        // 【障碍 3 修复】生存危机时，紧缺资源生产角色的吸引力额外 ×1.5，
        // 使其在 targetCandidate 筛选中能压倒其他高收入但非紧缺的选项。
        if (hasCriticalShortage && criticalShortageRoles.has(targetRole)) {
            attractiveness *= CRITICAL_SHORTAGE_ATTRACTIVENESS_MULTIPLIER;
        }

        return attractiveness;
    };

    // Find target candidate (better opportunity) with tier preference and resistance
    const targetCandidate = activeRoleMetrics
        .filter(r => {
            if (r.role === sourceCandidate.role || r.vacancy <= 0) return false;

            // Get the resistance multiplier for this migration direction
            // 【需求 3.3】传入补贴金额以启动同 tier 阻力削减
            const resistanceMultiplier = getTierResistanceMultiplier(r.role, r.subsidyPerCapita || 0);
            // Base threshold is 1.3x income difference, modified by resistance
            let effectiveThreshold = 1.3 * resistanceMultiplier;
            // [饥荒优先] 危机时，进入紧缺资源生产者（如 peasant 之于 food）的门槛大幅下调，
            //   让收入更高的服务业人口（cleric/merchant 等）也能被拉去种田，
            //   打破"宁可饿死也不种田 → 无人产粮 → 饥荒持续 → 人口崩溃"的死亡螺旋。
            if (hasCriticalShortage && criticalShortageRoles.has(r.role)) {
                effectiveThreshold = Math.min(effectiveThreshold, 0.4);
            }
            // [取消自耕农门槛] 自耕农（peasant）是最基础的粮食生产者，作为最底层的"兜底"职业，
            //   不应有收入对比门槛——只要农田有空位、有正收益，任何人都能去种田。
            if (r.role === 'peasant') {
                effectiveThreshold = 0;
            }

            if (r.role === 'soldier') {
                return r.potentialIncome > sourceCandidate.potentialIncome * effectiveThreshold;
            }

            // Calculate effective attractiveness including tier bonus
            const effectiveAttractiveness = calculateEffectiveAttractiveness(r.role, r.potentialIncome);
            return hasBuildingVacancyForRole(r.role) &&
                effectiveAttractiveness > sourceCandidate.potentialIncome * effectiveThreshold;
        })
        .reduce((best, current) => {
            if (!best) return current;
            // [饥荒优先] 危机时：紧缺资源生产者（如 peasant）优先于任何非紧缺角色，
            //   不论后者收入多高（如 landowner 矿井 5400）。确保饥荒时先把劳力导向粮食生产，
            //   而不是继续涌向更赚钱但不产粮的岗位。
            if (hasCriticalShortage) {
                const curCrit = criticalShortageRoles.has(current.role);
                const bestCrit = criticalShortageRoles.has(best.role);
                if (curCrit !== bestCrit) return curCrit ? current : best;
            }
            // Compare using effective attractiveness
            const currentAttractiveness = calculateEffectiveAttractiveness(current.role, current.potentialIncome);
            const bestAttractiveness = calculateEffectiveAttractiveness(best.role, best.potentialIncome);
            if (currentAttractiveness > bestAttractiveness) return current;
            // 【需求 1.3 / 8】tie-break：当有效吸引力接近（±5%）时，优先选补贴金额更高者
            // 避免多阶层同时享受补贴时“只有一个生效”。
            const denom = Math.max(1e-6, Math.abs(bestAttractiveness));
            const closeRatio = Math.abs(currentAttractiveness - bestAttractiveness) / denom;
            if (closeRatio <= 0.05) {
                const currSub = current.subsidyPerCapita || 0;
                const bestSub = best.subsidyPerCapita || 0;
                if (currSub > bestSub) return current;
            }
            return best;
        }, null);

    if (!targetCandidate) return { popStructure, wealth, migrationCooldowns: updatedCooldowns };

    // 【需求 3.1 / 4.5】补贴驱动识别：
    // 目标享受补贴 AND potentialIncome 明显高于平均值（× SUBSIDY_HIGH_ATTRACTIVENESS_RATIO）
    // 才启动拉力加速与单向冷却，避免微小补贴也触发加速。
    const targetSubsidyPerCapita = Math.max(0, targetCandidate.subsidyPerCapita || 0);
    const isSubsidyDriven = targetSubsidyPerCapita > 0
        && Number.isFinite(averagePotentialIncome)
        && targetCandidate.potentialIncome >= averagePotentialIncome * SUBSIDY_HIGH_ATTRACTIVENESS_RATIO;

    // Execute migration with low population guarantee
    // 生存危机 + 目标是紧缺资源生产者时使用紧急迁移速率
    const isSurvivalMigration = hasCriticalShortage && criticalShortageRoles.has(targetCandidate.role);
    // [加速] 目标岗位严重空缺（空缺 ≥ 在岗）：用高迁移速率快速填补，受目标空缺与来源人口约束。
    //   解决"自耕农/业主岗有人却填得极慢"——普通 1.2%/tick 单对迁移太慢。
    const targetSeverelyUnderfilled = targetCandidate.vacancy >= Math.max(1, targetCandidate.pop || 0);
    let effectiveMigrationRatio;
    if (sourceCandidate.pop < LOW_POP_THRESHOLD) {
        effectiveMigrationRatio = JOB_MIGRATION_LOW_POP_GUARANTEE;
    } else if (isSurvivalMigration) {
        effectiveMigrationRatio = Math.max(EMERGENCY_MIGRATION_RATIO, UNDERFILLED_TARGET_MIGRATION_RATIO);
    } else if (targetSeverelyUnderfilled) {
        effectiveMigrationRatio = UNDERFILLED_TARGET_MIGRATION_RATIO;
    } else if (isSubsidyDriven) {
        // 【需求 3.1】补贴拉力加速：有限提高迁移比例（介于普通与紧急之间）
        effectiveMigrationRatio = JOB_MIGRATION_RATIO * SUBSIDY_PULL_MULTIPLIER;
    } else {
        effectiveMigrationRatio = JOB_MIGRATION_RATIO;
    }
    let migrants = Math.floor(sourceCandidate.pop * effectiveMigrationRatio);
    if (migrants <= 0 && sourceCandidate.pop > 0) migrants = 1;
    migrants = Math.min(migrants, targetCandidate.vacancy);
    // Hard floor: when source has population and target has vacancy, migrate at least 1.
    if (migrants <= 0 && sourceCandidate.pop > 0 && targetCandidate.vacancy > 0) {
        migrants = 1;
    }

    if (migrants > 0) {
        let placementInfo = null;

        if (targetCandidate.role === 'soldier') {
            placementInfo = { buildingId: null, buildingName: 'Barracks', count: migrants };
        } else {
            const placement = reserveBuildingVacancyForRole(targetCandidate.role, migrants);
            if (!placement || placement.count <= 0) {
                migrants = 0;
            } else {
                migrants = placement.count;
                placementInfo = placement;
            }
        }

        if (migrants > 0) {
            // Transfer wealth
            const migratingWealth = sourcePerCapWealth * migrants;

            if (migratingWealth > 0) {
                wealth[sourceCandidate.role] = Math.max(0, sourceWealth - migratingWealth);
                // [FIX] Apply safe wealth limit
                wealth[targetCandidate.role] = safeWealth((wealth[targetCandidate.role] || 0) + migratingWealth);
                trackWealthTransfer(wealthChangeLog, sourceCandidate.role, targetCandidate.role, migratingWealth, 'job_migration');
            }

            // Transfer population
            popStructure[sourceCandidate.role] = Math.max(0, sourceCandidate.pop - migrants);
            popStructure[targetCandidate.role] = (popStructure[targetCandidate.role] || 0) + migrants;

            // Set cooldown for BOTH source and target roles to prevent:
            // 1. Source role from migrating again too soon
            // 2. Target role from reverse-migrating back (prevents A→B then B→A oscillation)
            // 【需求 3.2】补贴拉力驱动场景下，仅对源角色设冷却，
            // 目标角色不进入冷却，以免下一 tick 仍有空缺却被自身冷却屏蔽。
            updatedCooldowns[sourceCandidate.role] = MIGRATION_COOLDOWN_TICKS;
            if (!isSubsidyDriven) {
                updatedCooldowns[targetCandidate.role] = MIGRATION_COOLDOWN_TICKS;
            }
        }
    }

    return { popStructure, wealth, migrationCooldowns: updatedCooldowns };
};
