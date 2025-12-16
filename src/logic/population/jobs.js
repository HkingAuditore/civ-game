/**
 * Job Management Module
 * Handles job allocation, vacancy management, and job migration
 */

import { STRATA } from '../../config';
import { ROLE_PRIORITY, JOB_MIGRATION_RATIO } from '../utils/constants';

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
 * Fill job vacancies from unemployed population
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

    // Rank vacancies by net income
    const vacancyRanking = ROLE_PRIORITY.map((role, index) => {
        const slots = Math.max(0, jobsAvailable[role] || 0);
        const current = popStructure[role] || 0;
        const vacancy = Math.max(0, slots - current);
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

    // Fill vacancies
    vacancyRanking.forEach(entry => {
        const availableUnemployed = popStructure.unemployed || 0;
        if (availableUnemployed <= 0) return;

        const hiring = Math.min(entry.vacancy, availableUnemployed);
        if (hiring <= 0) return;

        // Transfer population from unemployed with wealth
        const unemployedWealth = wealth.unemployed || 0;
        const perCapWealth = availableUnemployed > 0 ? unemployedWealth / availableUnemployed : 0;

        popStructure[entry.role] = (popStructure[entry.role] || 0) + hiring;
        popStructure.unemployed = Math.max(0, availableUnemployed - hiring);

        if (perCapWealth > 0) {
            const transfer = perCapWealth * hiring;
            wealth.unemployed = Math.max(0, unemployedWealth - transfer);
            wealth[entry.role] = (wealth[entry.role] || 0) + transfer;
        }
    });

    return { popStructure, wealth };
};

/**
 * Handle job migration between roles
 * @param {Object} params - Migration parameters
 * @returns {Object} Updated population structure and wealth
 */
export const handleJobMigration = ({
    popStructure,
    wealth,
    roleMetrics,
    hasBuildingVacancyForRole,
    reserveBuildingVacancyForRole,
    logs
}) => {
    if (JOB_MIGRATION_RATIO <= 0) return { popStructure, wealth };

    // Calculate average potential income
    const activeRoleMetrics = roleMetrics.filter(r => r.pop > 0 && r.role !== 'soldier');
    if (activeRoleMetrics.length === 0) return { popStructure, wealth };

    const totalPotentialIncome = activeRoleMetrics.reduce(
        (sum, r) => sum + r.potentialIncome * r.pop, 0
    );
    const totalPop = activeRoleMetrics.reduce((sum, r) => sum + r.pop, 0);
    const averagePotentialIncome = totalPop > 0 ? totalPotentialIncome / totalPop : 0;

    // Find source candidate (struggling role)
    const sourceCandidate = activeRoleMetrics
        .filter(r => {
            if (r.pop <= 0 || r.role === 'soldier') return false;
            const percentageThreshold = r.perCap * 0.05;
            const adjustedDeltaThreshold = -Math.max(0.5, Math.min(50, percentageThreshold));
            return r.potentialIncome < averagePotentialIncome * 0.7 || 
                   r.perCapDelta < adjustedDeltaThreshold;
        })
        .reduce((lowest, current) => {
            if (!lowest) return current;
            if (current.potentialIncome < lowest.potentialIncome) return current;
            if (current.potentialIncome === lowest.potentialIncome && 
                current.perCapDelta < lowest.perCapDelta) return current;
            return lowest;
        }, null);

    if (!sourceCandidate) return { popStructure, wealth };

    // Find target candidate (better opportunity)
    const targetCandidate = activeRoleMetrics
        .filter(r => {
            if (r.role === sourceCandidate.role || r.vacancy <= 0) return false;
            if (r.role === 'soldier') {
                return r.potentialIncome > sourceCandidate.potentialIncome * 1.3;
            }
            return hasBuildingVacancyForRole(r.role) &&
                r.potentialIncome > sourceCandidate.potentialIncome * 1.3;
        })
        .reduce((best, current) => {
            if (!best) return current;
            if (current.potentialIncome > best.potentialIncome) return current;
            return best;
        }, null);

    if (!targetCandidate) return { popStructure, wealth };

    // Execute migration
    let migrants = Math.floor(sourceCandidate.pop * JOB_MIGRATION_RATIO);
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
            const sourceWealth = wealth[sourceCandidate.role] || 0;
            const perCapWealth = sourceCandidate.pop > 0 ? sourceWealth / sourceCandidate.pop : 0;
            const migratingWealth = perCapWealth * migrants;

            if (migratingWealth > 0) {
                wealth[sourceCandidate.role] = Math.max(0, sourceWealth - migratingWealth);
                wealth[targetCandidate.role] = (wealth[targetCandidate.role] || 0) + migratingWealth;
            }

            // Transfer population
            popStructure[sourceCandidate.role] = Math.max(0, sourceCandidate.pop - migrants);
            popStructure[targetCandidate.role] = (popStructure[targetCandidate.role] || 0) + migrants;
        }
    }

    return { popStructure, wealth };
};
