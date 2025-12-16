/**
 * Population Growth Module
 * Handles population growth, death, and exodus
 */

import { STRATA, RESOURCES } from '../../config';
import {
    FERTILITY_BASE_RATE,
    FERTILITY_BASELINE_RATE,
    LOW_POP_THRESHOLD,
    LOW_POP_GUARANTEE,
    WEALTH_BASELINE
} from '../utils/constants';

/**
 * Initialize wealth for all strata
 * Ensures each stratum has a starting wealth value
 * @param {Object} currentWealth - Current wealth distribution
 * @returns {Object} Initialized wealth object
 */
export const initializeWealth = (currentWealth = {}) => {
    const wealth = { ...currentWealth };
    Object.keys(STRATA).forEach((key) => {
        if (wealth[key] === undefined) {
            wealth[key] = STRATA[key]?.startingWealth || 0;
        }
    });
    return wealth;
};

/**
 * Calculate population growth from fertility
 * @param {Object} params - Growth parameters
 * @returns {Object} Growth results
 */
export const calculateFertilityGrowth = ({
    population,
    totalMaxPop,
    popStructure,
    classApproval,
    classWealthResult,
    previousBirthAccumulator = 0
}) => {
    let fertilityBirths = 0;
    let birthAccumulator = Math.max(0, previousBirthAccumulator || 0);
    let remainingCapacity = Math.max(0, totalMaxPop - population);

    // Baseline contribution
    if (remainingCapacity > 0) {
        const baselineContribution = Math.max(0, population || 0) * FERTILITY_BASELINE_RATE;
        birthAccumulator += baselineContribution;

        // Low population guarantee
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

    // Stratum-specific growth based on approval and wealth
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

    return {
        fertilityBirths,
        birthAccumulator
    };
};

/**
 * Calculate starvation deaths from resource shortages
 * @param {Object} params - Death parameters
 * @returns {Object} Death results
 */
export const calculateStarvationDeaths = ({
    popStructure,
    classShortages,
    classNeedsHistory,
    logs
}) => {
    let starvationDeaths = 0;
    const updatedPopStructure = { ...popStructure };

    Object.keys(STRATA).forEach(key => {
        const count = updatedPopStructure[key] || 0;
        if (count === 0) return;

        const def = STRATA[key];
        if (!def || !def.needs) return;

        // Check for food and cloth shortages
        const shortages = classShortages[key] || [];
        const lackingFood = shortages.some(s => 
            (typeof s === 'string' ? s : s.resource) === 'food'
        );
        const lackingCloth = shortages.some(s => 
            (typeof s === 'string' ? s : s.resource) === 'cloth'
        );

        // Check historical satisfaction
        const needsHistory = (classNeedsHistory || {})[key];
        if (needsHistory && needsHistory.length >= 5) {
            const recentHistory = needsHistory.slice(-5);
            const avgSatisfaction = recentHistory.reduce((a, b) => a + b, 0) / recentHistory.length;

            // Death if lacking basic needs and low satisfaction
            if ((lackingFood || lackingCloth) && avgSatisfaction < 0.6) {
                const className = def.name || key;

                // Death rate based on satisfaction
                const deathRate = Math.max(0, (0.6 - avgSatisfaction) / 0.6 * 0.05);
                const deaths = Math.max(1, Math.floor(count * deathRate));

                if (deaths > 0) {
                    updatedPopStructure[key] = Math.max(0, count - deaths);
                    starvationDeaths += deaths;

                    const reason = lackingFood && lackingCloth 
                        ? 'food and cloth' 
                        : (lackingFood ? 'food' : 'cloth');
                    logs.push(`${className} class: ${deaths} died due to prolonged lack of ${reason}!`);
                }
            }
        }
    });

    return {
        starvationDeaths,
        popStructure: updatedPopStructure
    };
};

/**
 * Calculate exodus from low approval
 * @param {Object} params - Exodus parameters
 * @returns {Object} Exodus results
 */
export const calculateExodus = ({
    popStructure,
    wealth,
    classApproval,
    classInfluence,
    totalInfluence,
    classShortages,
    logs
}) => {
    let exodusPopulationLoss = 0;
    let extraStabilityPenalty = 0;
    const updatedWealth = { ...wealth };
    const updatedPopStructure = { ...popStructure };

    Object.keys(STRATA).forEach(key => {
        const count = updatedPopStructure[key] || 0;
        if (count === 0) return;

        const approval = classApproval[key] || 50;
        if (approval >= 25) return;

        const influenceShare = totalInfluence > 0 
            ? (classInfluence[key] || 0) / totalInfluence 
            : 0;
        const className = STRATA[key]?.name || key;

        if (approval < 20 && influenceShare < 0.07) {
            // Low influence, low approval - people leave
            const leavingRate = Math.max(0.03, (20 - approval) / 200);
            const leaving = Math.min(count, Math.max(1, Math.floor(count * leavingRate)));

            if (leaving > 0) {
                const currentWealth = updatedWealth[key] || 0;
                const perCapWealth = count > 0 ? currentWealth / count : 0;
                const fleeingCapital = perCapWealth * leaving;

                // Capital flight
                if (fleeingCapital > 0) {
                    updatedWealth[key] = Math.max(0, currentWealth - fleeingCapital);
                }

                updatedPopStructure[key] = Math.max(0, count - leaving);
                exodusPopulationLoss += leaving;

                // Generate shortage details
                const shortageDetails = formatShortageDetails(classShortages[key] || []);
                const shortageMsg = shortageDetails ? `, shortages: ${shortageDetails}` : '';
                
                logs.push(
                    `${className} class dissatisfied with politics, ${leaving} people left, ` +
                    `taking ${(leaving * perCapWealth).toFixed(1)} silver${shortageMsg}.`
                );
            }
        } else if (influenceShare >= 0.12) {
            // High influence, low approval - stability penalty
            const penalty = Math.min(0.2, 0.05 + influenceShare * 0.15);
            extraStabilityPenalty += penalty;

            const shortageDetails = formatShortageDetails(classShortages[key] || []);
            const shortageMsg = shortageDetails ? ` (shortages: ${shortageDetails})` : '';
            logs.push(`${className} class anger is undermining social stability${shortageMsg}.`);
        }
    });

    return {
        exodusPopulationLoss,
        extraStabilityPenalty,
        wealth: updatedWealth,
        popStructure: updatedPopStructure
    };
};

/**
 * Format shortage details for logging
 * @private
 */
const formatShortageDetails = (shortages) => {
    if (!shortages || shortages.length === 0) return '';

    return shortages.map(shortage => {
        const resKey = typeof shortage === 'string' ? shortage : shortage.resource;
        const reason = typeof shortage === 'string' ? 'outOfStock' : shortage.reason;
        const resName = RESOURCES[resKey]?.name || resKey;

        if (reason === 'unaffordable') {
            return `${resName}(unaffordable)`;
        } else if (reason === 'outOfStock') {
            return `${resName}(out of stock)`;
        } else if (reason === 'both') {
            return `${resName}(out of stock & unaffordable)`;
        }
        return resName;
    }).join(', ');
};
