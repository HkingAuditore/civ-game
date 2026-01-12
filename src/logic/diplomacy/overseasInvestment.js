/**
 * Overseas Investment Module
 * Handles logic for overseas buildings, investment strategies, and profit calculation.
 */

import { BUILDINGS } from '../../config/buildings.js';

// Investment strategies constants
export const INVESTMENT_STRATEGIES = {
    PROFIT_MAX: 'Profit Max',
    RESOURCE_EXTRACTION: 'Resource Extraction',
    MARKET_DUMPING: 'Market Dumping',
};

/**
 * Compare labor cost between home and overseas nation.
 * @param {Object} homeWages - Current wages in home nation.
 * @param {Object} overseasNation - The overseas nation object.
 * @param {string} stratum - The stratum (role) to compare.
 * @returns {number} Ratio of overseas wage to home wage (e.g. 0.8 means overseas is 20% cheaper).
 */
export const compareLaborCost = (homeWages, overseasNation, stratum) => {
    const homeWage = homeWages[stratum] || 1;
    // Assuming overseasNation has a wage structure or simplified labor cost factor
    // If overseasNation has detailed wages:
    if (overseasNation.wages && overseasNation.wages[stratum]) {
        return overseasNation.wages[stratum] / homeWage;
    }

    // Fallback if overseas nation uses a simplified labor cost model (e.g. economyTraits or modifier)
    // Using a simple heuristic based on relative wealth or explicit labor cost modifier
    const overseasLaborModifier = overseasNation.laborCostModifier ||
        (overseasNation.wealth && overseasNation.population ? (overseasNation.wealth / overseasNation.population) / 100 : 1);

    return overseasLaborModifier;
};

/**
 * Calculate profit for an overseas building based on selected strategy.
 * Automatically determines the best flow (local/home) based on strategy.
 *
 * @param {Object} params - Parameters
 * @param {Object} params.building - The overseas building object (from gameState.overseasBuildings).
 * @param {Object} params.homeNation - The home nation (player or owner).
 * @param {Object} params.hostNation - The nation where the building is located.
 * @param {string} params.strategy - One of INVESTMENT_STRATEGIES.
 * @returns {Object} Result containing profit, flow details, and efficiency.
 */
export const calculateOverseasProfit = ({
    building,
    homeNation,
    hostNation,
    strategy = INVESTMENT_STRATEGIES.PROFIT_MAX
}) => {
    const buildingConfig = BUILDINGS.find(b => b.id === building.buildingId);
    if (!buildingConfig) {
        return { profit: 0, flow: { input: 'local', output: 'local' } };
    }

    // Helper to get price (mocking market price lookup if not available directly)
    const getPrice = (nation, resource) => {
        if (nation.prices && nation.prices[resource]) return nation.prices[resource];
        // Fallback to base price or inventory heuristic
        return 10; // Default placeholder, ideally should import getBasePrice
    };

    const getWage = (nation, role) => {
        if (nation.wages && nation.wages[role]) return nation.wages[role];
        return 5; // Default placeholder
    };

    // Calculate costs/values for different flows
    // Input: Local vs Home (with transport cost)
    // Output: Local vs Home (with transport cost)

    const transportCostFactor = 1.2; // 20% transport cost

    let inputCostLocal = 0;
    let inputCostHome = 0;

    if (buildingConfig.input) {
        Object.entries(buildingConfig.input).forEach(([res, amount]) => {
            const priceLocal = getPrice(hostNation, res);
            const priceHome = getPrice(homeNation, res);
            inputCostLocal += priceLocal * amount;
            inputCostHome += priceHome * amount * transportCostFactor;
        });
    }

    let outputValueLocal = 0;
    let outputValueHome = 0;

    if (buildingConfig.output) {
        Object.entries(buildingConfig.output).forEach(([res, amount]) => {
            const priceLocal = getPrice(hostNation, res);
            const priceHome = getPrice(homeNation, res);
            outputValueLocal += priceLocal * amount;
            // When selling back home, we pay transport cost, effectively reducing revenue
            outputValueHome += (priceHome * amount) / transportCostFactor;
        });
    }

    let laborCost = 0;
    if (buildingConfig.jobs) {
        Object.entries(buildingConfig.jobs).forEach(([role, count]) => {
            laborCost += getWage(hostNation, role) * count;
        });
    }

    // Determine flow based on strategy
    let inputSource = 'local';
    let outputDest = 'local';

    if (strategy === INVESTMENT_STRATEGIES.PROFIT_MAX) {
        // Choose cheapest input and highest output
        inputSource = inputCostLocal < inputCostHome ? 'local' : 'home';
        outputDest = outputValueLocal > outputValueHome ? 'local' : 'home';
    } else if (strategy === INVESTMENT_STRATEGIES.RESOURCE_EXTRACTION) {
        // Prioritize getting resources home.
        // Input usually local (extraction), Output must be home.
        inputSource = 'local'; // Extraction usually implies local resources
        outputDest = 'home';
    } else if (strategy === INVESTMENT_STRATEGIES.MARKET_DUMPING) {
        // Prioritize selling to local market, potentially using home inputs (dumping excess).
        // Or just prioritize output to local.
        outputDest = 'local';
        // Input choice could still be optimized for profit or forced from home if "dumping inputs"
        // But usually "Market Dumping" means selling products there.
        // Let's assume we want to maximize sales there, so we minimize input costs to be competitive,
        // or if it's about dumping HOME raw materials, inputSource would be home.
        // Let's stick to the prompt's likely intent: dumping products INTO the foreign market.
        // So we produce efficiently.
        inputSource = inputCostLocal < inputCostHome ? 'local' : 'home';
    }

    // Calculate final profit
    const finalInputCost = inputSource === 'local' ? inputCostLocal : inputCostHome;
    const finalOutputValue = outputDest === 'local' ? outputValueLocal : outputValueHome;

    const profit = finalOutputValue - finalInputCost - laborCost;

    return {
        profit,
        flow: {
            input: inputSource,
            output: outputDest
        },
        details: {
            revenue: finalOutputValue,
            costs: {
                input: finalInputCost,
                labor: laborCost
            }
        }
    };
};
