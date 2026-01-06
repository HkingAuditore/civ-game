/**
 * Job Management Module
 * Handles job allocation, vacancy management, and job migration
 */

import { STRATA } from '../../config';
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
    // Survival migration constants
    CRITICAL_SHORTAGE_THRESHOLD,
    CRITICAL_RESOURCES,
    SHORTAGE_MIGRATION_BONUS,
    EMERGENCY_MIGRATION_RATIO,
    // Lucky promotion
    LUCKY_PROMOTION_CHANCE,
} from '../utils/constants';

// [FIX] Import safeWealth for wealth overflow protection
import { safeWealth } from '../utils/helpers';

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
 * @returns {Object} Updated population structure
 */
export const allocatePopulation = ({
    population,
    previousPopStructure,
    jobsAvailable,
    wealth
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
    wealth
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
    effectiveTaxModifier
}) => {
    // Estimate net income for each role
    const estimateRoleNetIncome = (role) => {
        const wage = getExpectedWage(role);
        const headBase = STRATA[role]?.headTaxBase ?? 0.01;
        const taxCost = headBase * getHeadTaxRate(role) * effectiveTaxModifier;
        return wage - Math.max(0, taxCost);
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
            if (b.netIncome !== a.netIncome) return b.netIncome - a.netIncome;
            return a.priorityIndex - b.priorityIndex;
        });

    // Fill vacancies with tier-based constraints
    vacancyRanking.forEach(entry => {
        const perRoleFillCap = Math.max(
            1,
            Math.floor(entry.vacancy * VACANCY_FILL_RATIO_PER_TICK)
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
                    const luckyCount = Math.floor(expectedLucky) + (Math.random() < (expectedLucky % 1) ? 1 : 0);

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
    // New: resource shortage data for survival migration
    supplyDemandRatio = {},   // { resource: supply/demand ratio }
    roleProducesResource = {} // { role: [resources it produces] }
}) => {
    if (JOB_MIGRATION_RATIO <= 0) return { popStructure, wealth, migrationCooldowns };

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

    // ============== SURVIVAL MIGRATION: Resource Shortage Emergency ==============
    // When critical resources are severely short, trigger emergency migration
    // This bypasses normal income comparison logic to ensure survival
    const criticallyShortResources = CRITICAL_RESOURCES.filter(res => {
        const ratio = supplyDemandRatio[res];
        // If ratio exists and is below threshold, resource is critically short
        return ratio !== undefined && ratio < CRITICAL_SHORTAGE_THRESHOLD;
    });

    // Find roles that produce critically short resources
    const rolesProducingShortResources = new Set();
    if (criticallyShortResources.length > 0) {
        Object.entries(roleProducesResource).forEach(([role, resources]) => {
            if (resources && Array.isArray(resources)) {
                const producesShort = resources.some(r => criticallyShortResources.includes(r));
                if (producesShort) {
                    rolesProducingShortResources.add(role);
                }
            }
        });
    }

    const hasResourceCrisis = criticallyShortResources.length > 0 && rolesProducingShortResources.size > 0;

    // Helper: Check if a role produces critically short resources
    const roleProducesShortResource = (role) => rolesProducingShortResources.has(role);

    // Identify "vulnerable" resources - those not yet critical but low enough that we shouldn't steal workers from them
    // This prevents ping-pong effects (e.g. stealing Peasants to fix Cloth, causing Food shortage, then stealing Workers to fix Food)
    const EARLY_WARNING_THRESHOLD = 0.8;
    const vulnerableResources = CRITICAL_RESOURCES.filter(res => {
        const ratio = supplyDemandRatio[res];
        return ratio !== undefined && ratio < EARLY_WARNING_THRESHOLD;
    });

    const rolesProducingVulnerableResources = new Set();
    if (vulnerableResources.length > 0) {
        Object.entries(roleProducesResource).forEach(([role, resources]) => {
            if (resources && Array.isArray(resources)) {
                const producesVulnerable = resources.some(r => vulnerableResources.includes(r));
                if (producesVulnerable) {
                    rolesProducingVulnerableResources.add(role);
                }
            }
        });
    }

    const roleProducesVulnerableResource = (role) => rolesProducingVulnerableResources.has(role);

    // ============== EMERGENCY MIGRATION (Survival Instinct) ==============
    // When resources are critically short, attempt emergency migration FIRST
    // This allows migration even when normal conditions aren't met
    // [MOD] Temporarily disabled as requested by user to prevent ping-pong effect
    if (false && hasResourceCrisis) {
        // Find the best emergency source: any role with population that's NOT producing short resources
        // Priority: unemployed > non-essential roles > roles with surplus
        const emergencySource = activeRoleMetrics
            .filter(r => {
                if (r.pop <= 0 || r.role === 'soldier') return false;
                // Don't migrate FROM roles that produce short resources (we need them!)
                if (roleProducesShortResource(r.role)) return false;
                
                // [FIX] Also don't migrate from roles producing "vulnerable" resources (safety buffer)
                // Unless the target crisis is MUCH worse? For simplicity, just protect them.
                if (roleProducesVulnerableResource(r.role)) return false;
                
                // Skip roles on cooldown
                if (updatedCooldowns[r.role] && updatedCooldowns[r.role] > 0) return false;
                return true;
            })
            .reduce((best, curr) => {
                if (!best) return curr;
                // Prioritize unemployed
                if (curr.role === 'unemployed') return curr;
                if (best.role === 'unemployed') return best;
                // Otherwise, choose role with lower income (less productive)
                if (curr.potentialIncome < best.potentialIncome) return curr;
                return best;
            }, null);

        if (emergencySource) {
            // Find the best emergency target: role that produces short resources with vacancy
            const emergencyTarget = activeRoleMetrics
                .filter(r => {
                    if (r.role === emergencySource.role || r.vacancy <= 0) return false;
                    // Must produce short resources
                    if (!roleProducesShortResource(r.role)) return false;
                    // Must have building vacancy (except for special roles)
                    if (r.role !== 'soldier' && !hasBuildingVacancyForRole(r.role)) return false;
                    return true;
                })
                .reduce((best, curr) => {
                    if (!best) return curr;
                    // Prefer roles with more vacancy
                    if (curr.vacancy > best.vacancy) return curr;
                    return best;
                }, null);

            if (emergencyTarget) {
                // Execute emergency migration with higher ratio
                const emergencyMigrationRatio = EMERGENCY_MIGRATION_RATIO;
                let migrants = Math.floor(emergencySource.pop * emergencyMigrationRatio);
                if (migrants <= 0 && emergencySource.pop > 0) migrants = 1;
                migrants = Math.min(migrants, emergencyTarget.vacancy);

                if (migrants > 0) {
                    let placementInfo = null;
                    if (emergencyTarget.role === 'soldier') {
                        placementInfo = { buildingId: null, buildingName: 'Barracks', count: migrants };
                    } else {
                        const placement = reserveBuildingVacancyForRole(emergencyTarget.role, migrants);
                        if (!placement || placement.count <= 0) {
                            migrants = 0;
                        } else {
                            migrants = placement.count;
                            placementInfo = placement;
                        }
                    }

                    if (migrants > 0) {
                        // Transfer wealth
                        const sourceWealth = wealth[emergencySource.role] || 0;
                        const sourcePerCapWealth = emergencySource.pop > 0 ? sourceWealth / emergencySource.pop : 0;
                        const migratingWealth = sourcePerCapWealth * migrants;

                        if (migratingWealth > 0) {
                            wealth[emergencySource.role] = Math.max(0, sourceWealth - migratingWealth);
                            // [FIX] Apply safe wealth limit
                            wealth[emergencyTarget.role] = safeWealth((wealth[emergencyTarget.role] || 0) + migratingWealth);
                        }

                        // Transfer population
                        popStructure[emergencySource.role] = Math.max(0, emergencySource.pop - migrants);
                        popStructure[emergencyTarget.role] = (popStructure[emergencyTarget.role] || 0) + migrants;

                        // Set cooldown for both roles
                        updatedCooldowns[emergencySource.role] = MIGRATION_COOLDOWN_TICKS;
                        updatedCooldowns[emergencyTarget.role] = MIGRATION_COOLDOWN_TICKS;

                        // Log the emergency migration
                        const shortResourceNames = criticallyShortResources.join('、');
                        const sourceStratumName = STRATA[emergencySource.role]?.name || emergencySource.role;
                        const targetStratumName = STRATA[emergencyTarget.role]?.name || emergencyTarget.role;
                        logs.push(`⚠️ ${shortResourceNames}严重短缺！${migrants}名${sourceStratumName}紧急转职为${targetStratumName}以增加产量。`);

                        // Return after emergency migration (one migration per tick)
                        return { popStructure, wealth, migrationCooldowns: updatedCooldowns };
                    }
                }
            }
        }
    }

    // ============== NORMAL MIGRATION LOGIC (Enhanced with shortage awareness) ==============
    // Calculate max potential income among roles with vacancies (Pull factor)
    const maxPotentialIncome = activeRoleMetrics
        .filter(r => hasBuildingVacancyForRole(r.role))
        .reduce((max, r) => Math.max(max, r.potentialIncome), 0);

    // Find source candidate (struggling role) - exclude roles on cooldown
    const sourceCandidate = activeRoleMetrics
        .filter(r => {
            if (r.pop <= 0 || r.role === 'soldier') return false;
            // Check cooldown - role cannot be source if on cooldown
            if (updatedCooldowns[r.role] && updatedCooldowns[r.role] > 0) return false;

            const percentageThreshold = r.perCap * 0.05;
            const adjustedDeltaThreshold = -Math.max(0.5, Math.min(50, percentageThreshold));
            
            // Criteria for seeking new job:
            // 1. "Push": Income is below 70% of population average
            // 2. "Push": Income is declining significantly
            // 3. "Pull": [NEW] Income is below 60% of the BEST available opportunity (e.g. profitable factories)
            return r.potentialIncome < averagePotentialIncome * 0.7 ||
                r.perCapDelta < adjustedDeltaThreshold ||
                (maxPotentialIncome > 0 && r.potentialIncome < maxPotentialIncome * 0.6);
        })
        .reduce((lowest, current) => {
            if (!lowest) return current;
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
    const getTierResistanceMultiplier = (targetRole) => {
        const targetTier = STRATUM_TIERS[targetRole] ?? 0;
        const tierDiff = targetTier - sourceTier;

        if (tierDiff > 0) {
            // Upward migration - easier (bonus)
            return UPGRADE_MIGRATION_BONUS;
        } else if (tierDiff === 0) {
            // Same tier migration - harder (resistance)
            return SAME_TIER_MIGRATION_RESISTANCE;
        } else {
            // Downward migration - much harder
            // Apply additional penalty for each tier below
            const tiersBelowCount = Math.abs(tierDiff);
            return DOWNGRADE_MIGRATION_RESISTANCE * Math.pow(MULTI_TIER_DOWNGRADE_PENALTY, tiersBelowCount - 1);
        }
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

        return attractiveness;
    };

    // Find target candidate (better opportunity) with tier preference and resistance
    const targetCandidate = activeRoleMetrics
        .filter(r => {
            if (r.role === sourceCandidate.role || r.vacancy <= 0) return false;

            // Get the resistance multiplier for this migration direction
            const resistanceMultiplier = getTierResistanceMultiplier(r.role);
            // Base threshold is 1.3x income difference, modified by resistance
            const effectiveThreshold = 1.3 * resistanceMultiplier;

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
            // Compare using effective attractiveness
            const currentAttractiveness = calculateEffectiveAttractiveness(current.role, current.potentialIncome);
            const bestAttractiveness = calculateEffectiveAttractiveness(best.role, best.potentialIncome);
            if (currentAttractiveness > bestAttractiveness) return current;
            return best;
        }, null);

    if (!targetCandidate) return { popStructure, wealth, migrationCooldowns: updatedCooldowns };

    // Execute migration with low population guarantee
    // When source role has low population, use higher migration ratio to ensure quick reallocation
    const effectiveMigrationRatio = sourceCandidate.pop < LOW_POP_THRESHOLD
        ? JOB_MIGRATION_LOW_POP_GUARANTEE
        : JOB_MIGRATION_RATIO;
    let migrants = Math.floor(sourceCandidate.pop * effectiveMigrationRatio);
    if (migrants <= 0 && sourceCandidate.pop > 0) migrants = 1;
    migrants = Math.min(migrants, targetCandidate.vacancy);

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
            }

            // Transfer population
            popStructure[sourceCandidate.role] = Math.max(0, sourceCandidate.pop - migrants);
            popStructure[targetCandidate.role] = (popStructure[targetCandidate.role] || 0) + migrants;

            // Set cooldown for BOTH source and target roles to prevent:
            // 1. Source role from migrating again too soon
            // 2. Target role from reverse-migrating back (prevents A→B then B→A oscillation)
            updatedCooldowns[sourceCandidate.role] = MIGRATION_COOLDOWN_TICKS;
            updatedCooldowns[targetCandidate.role] = MIGRATION_COOLDOWN_TICKS;
        }
    }

    return { popStructure, wealth, migrationCooldowns: updatedCooldowns };
};
