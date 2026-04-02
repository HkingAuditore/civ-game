// V3 货币量追踪模块
// Track total money supply M(t) = Σ wealth[stratum] + res.silver (treasury)
// Verify monetary conservation equation each tick

import { STRATA } from '../../config/strata';

/**
 * Default monetary stats for new games or missing save data
 */
export const DEFAULT_MONETARY_STATS = {
    totalMoney: 0,
    moneySupplyChange: 0,
    mintOutput: 0,
    tradeBalance: 0,
    capitalFlight: 0,
    previousTotalMoney: 0,
};

/**
 * Calculate total money supply: M(t) = Σ wealth[stratum] + res.silver
 * @param {Object} wealth - Class wealth object { peasant: N, merchant: N, ... }
 * @param {number} treasurySilver - State treasury silver (res.silver)
 * @returns {number} Total money supply
 */
export function calculateTotalMoney(wealth, treasurySilver) {
    let total = treasurySilver || 0;
    const strataKeys = Object.keys(STRATA);
    for (let i = 0; i < strataKeys.length; i++) {
        const key = strataKeys[i];
        const w = wealth[key];
        if (Number.isFinite(w) && w > 0) {
            total += w;
        }
    }
    return total;
}

/**
 * Calculate monetary stats for the current tick
 * @param {Object} params
 * @param {Object} params.wealth - Current class wealth
 * @param {number} params.treasurySilver - Current treasury silver
 * @param {Object} params.previousMonetaryStats - Previous tick's monetary stats
 * @param {number} params.mintOutput - Silver produced by mints this tick
 * @param {number} params.tradeBalance - Net trade balance (exports - imports) this tick
 * @returns {Object} Updated monetary stats
 */
export function calculateMonetaryStats({ wealth, treasurySilver, previousMonetaryStats, mintOutput = 0, tradeBalance = 0 }) {
    const prev = previousMonetaryStats || DEFAULT_MONETARY_STATS;
    const totalMoney = calculateTotalMoney(wealth, treasurySilver);
    const moneySupplyChange = totalMoney - (prev.totalMoney || 0);

    return {
        totalMoney,
        moneySupplyChange,
        mintOutput,
        tradeBalance,
        capitalFlight: 0, // Will be populated when capital flight tracking is added
        previousTotalMoney: prev.totalMoney || 0,
    };
}

/**
 * Verify monetary conservation equation (dev mode only)
 * M(t) should equal M(t-1) + mintOutput + tradeBalance - capitalFlight
 * @param {Object} stats - Current monetary stats
 * @returns {{ balanced: boolean, discrepancy: number }}
 */
export function verifyMonetaryConservation(stats) {
    const expected = stats.previousTotalMoney + stats.mintOutput + stats.tradeBalance - stats.capitalFlight;
    const actual = stats.totalMoney;
    const discrepancy = Math.abs(actual - expected);
    const balanced = discrepancy < 0.01;

    if (!balanced && typeof console !== 'undefined') {
        console.warn(
            `[V3 Monetary] Conservation violation: expected=${expected.toFixed(2)}, actual=${actual.toFixed(2)}, discrepancy=${discrepancy.toFixed(2)}`
        );
    }

    return { balanced, discrepancy };
}
