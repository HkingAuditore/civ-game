/**
 * Tax Calculation Module
 * Handles tax collection, tax breakdown, and tax efficiency calculations
 */

import { STRATA } from '../../config';

/**
 * Initialize tax breakdown structure
 * @returns {Object} Empty tax breakdown
 */
export const initializeTaxBreakdown = () => ({
    headTax: 0,
    industryTax: 0,
    businessTax: 0,
    tariff: 0,
    tariffSubsidy: 0, // 关税补贴（负关税产生的支出）
    subsidy: 0,
    policyIncome: 0,
    policyExpense: 0,
    priceControlIncome: 0,   // 价格管制收入（买家溢价 + 卖家超额利润税）
    priceControlExpense: 0,  // 价格管制支出（买家补贴 + 卖家保底补贴）
});

/**
 * Get head tax rate for a stratum
 * @param {string} key - Stratum key
 * @param {Object} headTaxRates - Tax rates configuration
 * @returns {number} Head tax rate
 */
export const getHeadTaxRate = (key, headTaxRates = {}) => {
    const rate = headTaxRates[key];
    if (typeof rate === 'number') {
        return rate;
    }
    return 1;
};

/**
 * Get resource tax rate
 * @param {string} resource - Resource key
 * @param {Object} resourceTaxRates - Tax rates configuration
 * @returns {number} Resource tax rate (can be negative for subsidies)
 */
export const getResourceTaxRate = (resource, resourceTaxRates = {}) => {
    const rate = resourceTaxRates[resource];
    if (typeof rate === 'number') return rate;
    return 0;
};

/**
 * Get business tax rate for a building
 * @param {string} buildingId - Building ID
 * @param {Object} businessTaxRates - Tax rates configuration
 * @returns {number} Business tax rate (can be negative for subsidies)
 */
export const getBusinessTaxRate = (buildingId, businessTaxRates = {}) => {
    const rate = businessTaxRates[buildingId];
    if (typeof rate === 'number') return rate;
    return 1; // 默认税率系数为1，与UI显示一致
};

/**
 * Collect head tax from all strata
 * @param {Object} params - Collection parameters
 * @returns {Object} Updated wealth and tax breakdown
 */
export const collectHeadTax = ({
    popStructure,
    wealth,
    resources,
    headTaxRates,
    effectiveTaxModifier,
    taxBreakdown,
    roleExpense,
    roleHeadTaxPaid,
    roleWagePayout,
    logs
}) => {
    const updatedWealth = { ...wealth };
    const updatedTaxBreakdown = { ...taxBreakdown };
    const res = { ...resources };

    Object.keys(STRATA).forEach(key => {
        const count = popStructure[key] || 0;
        if (count === 0) return;

        const def = STRATA[key];
        if (updatedWealth[key] === undefined) {
            updatedWealth[key] = def.startingWealth || 0;
        }

        const headRate = getHeadTaxRate(key, headTaxRates);
        const headBase = def?.headTaxBase ?? 0.01;
        const plannedPerCapitaTax = headBase * headRate * effectiveTaxModifier;
        const available = Math.max(0, updatedWealth[key] || 0);
        const maxPerCapitaTax = available / Math.max(1, count);
        const effectivePerCapitaTax = plannedPerCapitaTax >= 0
            ? Math.min(plannedPerCapitaTax, maxPerCapitaTax)
            : plannedPerCapitaTax;
        const due = count * effectivePerCapitaTax;

        if (due !== 0) {
            if (due > 0) {
                // Positive tax - collect from stratum
                const paid = Math.min(available, due);
                updatedWealth[key] = available - paid;
                updatedTaxBreakdown.headTax += paid;
                roleHeadTaxPaid[key] = (roleHeadTaxPaid[key] || 0) + paid;
                roleExpense[key] = (roleExpense[key] || 0) + paid;
            } else {
                // Negative tax (subsidy) - pay to stratum from treasury
                const subsidyNeeded = -due;
                const treasury = res.silver || 0;
                if (treasury >= subsidyNeeded) {
                    res.silver = treasury - subsidyNeeded;
                    updatedWealth[key] = available + subsidyNeeded;
                    updatedTaxBreakdown.subsidy += subsidyNeeded;
                    roleWagePayout[key] = (roleWagePayout[key] || 0) + subsidyNeeded;
                }
            }
        }
    });

    return {
        wealth: updatedWealth,
        taxBreakdown: updatedTaxBreakdown,
        resources: res
    };
};

/**
 * Calculate final tax collection with efficiency
 * @param {Object} taxBreakdown - Tax breakdown
 * @param {number} efficiency - Tax collection efficiency (0-1)
 * @param {number} warIndemnityIncome - War indemnity income
 * @returns {Object} Final tax calculation
 */
export const calculateFinalTaxes = (
    taxBreakdown,
    efficiency,
    warIndemnityIncome = 0
) => {
    const clampedEfficiency = Math.max(0, Math.min(1, efficiency));
    const collectedHeadTax = taxBreakdown.headTax * clampedEfficiency;
    const collectedIndustryTax = taxBreakdown.industryTax * clampedEfficiency;
    const collectedBusinessTax = taxBreakdown.businessTax * clampedEfficiency;
    const collectedTariff = (taxBreakdown.tariff || 0) * clampedEfficiency;
    const tariffSubsidy = taxBreakdown.tariffSubsidy || 0; // 关税补贴支出
    const priceControlIncome = taxBreakdown.priceControlIncome || 0;   // 价格管制收入
    const priceControlExpense = taxBreakdown.priceControlExpense || 0; // 价格管制支出
    const totalCollectedTax = collectedHeadTax + collectedIndustryTax + collectedBusinessTax + collectedTariff;

    const netTax = totalCollectedTax
        - taxBreakdown.subsidy
        - tariffSubsidy // 扣除关税补贴支出
        + warIndemnityIncome
        + taxBreakdown.policyIncome
        - taxBreakdown.policyExpense
        + priceControlIncome    // 加上价格管制收入
        - priceControlExpense;  // 减去价格管制支出

    return {
        total: netTax,
        efficiency: clampedEfficiency,
        breakdown: {
            headTax: collectedHeadTax,
            industryTax: collectedIndustryTax,
            businessTax: collectedBusinessTax,
            tariff: collectedTariff,
            tariffSubsidy, // 返回关税补贴金额
            subsidy: taxBreakdown.subsidy,
            warIndemnity: warIndemnityIncome,
            policyIncome: taxBreakdown.policyIncome,
            policyExpense: taxBreakdown.policyExpense,
            priceControlIncome,   // 价格管制收入
            priceControlExpense,  // 价格管制支出
        },
    };
};
