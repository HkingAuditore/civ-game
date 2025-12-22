/**
 * Approval Calculation Module
 * Handles class approval/satisfaction calculations
 */

import { STRATA } from '../../config';

/**
 * Calculate class approval for all strata
 * @param {Object} params - Approval parameters
 * @returns {Object} Updated class approval
 */
export const calculateClassApproval = ({
    popStructure,
    population,
    classApproval: previousApproval,
    needsReport,
    classShortages,
    classLivingStandard,
    livingStandardStreaks,
    classWealthHistory,
    classNeedsHistory,
    taxPolicies,
    roleWagePayout,
    eventApprovalModifiers = {},
    decreeApprovalModifiers = {},
    effectiveTaxModifier = 1
}) => {
    const classApproval = {};
    const headTaxRates = taxPolicies?.headTaxRates || {};

    const getHeadTaxRate = (key) => {
        const rate = headTaxRates[key];
        return typeof rate === 'number' ? rate : 1;
    };

    Object.keys(STRATA).forEach(key => {
        const count = popStructure[key] || 0;
        if (count === 0) return;

        classApproval[key] = previousApproval[key] ?? 50;
        const satisfactionInfo = needsReport[key];
        const satisfaction = satisfactionInfo?.satisfactionRatio ?? 1;

        // Get living standard approval cap
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
                targetApproval = Math.min(targetApproval, 0);
            } else {
                targetApproval = Math.min(targetApproval, 30);
            }
        }

        // Living standard penalty
        const livingTracker = livingStandardStreaks[key] || {};
        if (livingTracker.level === '赤贫' || livingTracker.level === '贫困') {
            const penaltyBase = livingTracker.level === '赤贫' ? 2.5 : 1.5;
            const penalty = Math.min(30, Math.ceil((livingTracker.streak || 0) * penaltyBase));
            if (penalty > 0) {
                targetApproval -= penalty;
            }
        }

        // Sustained needs satisfaction bonus
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
        if (history && history.length >= 20) {
            const recentWealth = history.slice(-10).reduce((a, b) => a + b, 0) / 10;
            const pastWealth = history.slice(-20, -10).reduce((a, b) => a + b, 0) / 10;

            if (pastWealth > 1) {
                const trend = (recentWealth - pastWealth) / pastWealth;
                const trendBonus = Math.min(15, Math.abs(trend) * 50);

                if (trend > 0.05) {
                    targetApproval += trendBonus;
                } else if (trend < -0.05) {
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

        // Event modifiers (temporary, affects target approval)
        const eventBonus = eventApprovalModifiers?.[key] || 0;
        if (eventBonus) {
            targetApproval += eventBonus;
        }

        // Gradual adjustment with inertia (base approval without decree effects)
        const currentApproval = classApproval[key] || 50;
        const adjustmentSpeed = 0.02;
        let newApproval = currentApproval + (targetApproval - currentApproval) * adjustmentSpeed;

        // Apply living standard cap (before decree modifier)
        newApproval = Math.min(newApproval, livingStandardApprovalCap);

        // Decree modifiers - applied AFTER inertia calculation
        // This ensures decree effects are immediate and persistent, not subject to gradual decay
        const decreeModifier = decreeApprovalModifiers[key] || 0;
        if (decreeModifier) {
            // Direct absolute value adjustment to final approval
            // Positive modifier: add directly (capped at 100)
            // Negative modifier: subtract directly (floored at 0)
            newApproval += decreeModifier;
        }

        classApproval[key] = Math.max(0, Math.min(100, newApproval));
    });

    // Special handling for unemployed recovery
    if ((popStructure.unemployed || 0) === 0 && previousApproval.unemployed !== undefined) {
        classApproval.unemployed = Math.min(100, previousApproval.unemployed + 5);
    }

    return classApproval;
};

/**
 * Calculate decree approval modifiers
 * @param {Array} decrees - Active decrees
 * @returns {Object} Approval modifiers by stratum
 */
export const calculateDecreeApprovalModifiers = (decrees = []) => {
    const modifiers = {};

    decrees.forEach(d => {
        if (d.active && d.modifiers?.approval) {
            Object.entries(d.modifiers.approval).forEach(([strata, value]) => {
                modifiers[strata] = (modifiers[strata] || 0) + value;
            });
        }
    });

    return modifiers;
};
