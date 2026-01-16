
import { RESOURCES, ORGANIZATION_EFFECTS } from '../../config';
import { VASSAL_TYPE_CONFIGS, TRADE_POLICY_DEFINITIONS } from '../../config/diplomacy';
import { calculateForeignPrice, calculateTradeStatus } from '../../utils/foreignTrade';
import { getTreatyEffects } from '../diplomacy/treatyEffects';

/**
 * Process manual trade routes logic
 * Extracted from useGameLoop.js to run within simulation worker
 *
 * @param {Object} params
 * @param {Object} params.tradeRoutes - Trade routes state
 * @param {Array} params.nations - List of nations
 * @param {Object} params.resources - Player resources
 * @param {number} params.daysElapsed - Current game day
 * @param {Object} params.market - Market data (prices)
 * @param {Object} params.popStructure - Population structure (for merchant count)
 * @param {Object} params.taxPolicies - Tax policies
 * @param {Object} params.diplomacyOrganizations - International organizations
 * @returns {Object} - { tradeTax, resourceDelta, nationDelta, routesToRemove, tradeLog }
 */
export const processManualTradeRoutes = ({
    tradeRoutes,
    nations,
    resources,
    daysElapsed,
    market,
    popStructure,
    taxPolicies,
    diplomacyOrganizations
}) => {
    const routes = tradeRoutes?.routes || [];
    if (!routes.length) return null;

    const organizationList = diplomacyOrganizations?.organizations || [];
    const findSharedOrganization = (nationId) => organizationList.find(org =>
        Array.isArray(org?.members) && org.members.includes('player') && org.members.includes(nationId)
    );
    const getTariffDiscount = (nationId, nation) => {
        let discount = 0;

        // Organization Discount
        const org = findSharedOrganization(nationId);
        if (org) discount = Math.max(discount, ORGANIZATION_EFFECTS[org.type]?.tariffDiscount || 0);

        // Vassal Policy Discount
        if (nation && nation.vassalOf === 'player') {
            const policyId = nation.vassalPolicy?.tradePolicy;
            const policyDiscount = TRADE_POLICY_DEFINITIONS[policyId]?.tariffDiscount || 0;
            const typeDiscount = VASSAL_TYPE_CONFIGS[nation.vassalType]?.tariffDiscount || 0;
            discount = Math.max(discount, policyDiscount, typeDiscount);
        }

        return discount;
    };

    // Helper to get price modifier from vassal policy
    const getVassalPriceMultiplier = (nation, type) => {
        if (!nation || nation.vassalOf !== 'player') return 1.0;

        const policyId = nation.vassalPolicy?.tradePolicy;
        const mod = TRADE_POLICY_DEFINITIONS[policyId]?.playerPriceMod || 0;

        // Negative mod = Cheaper for player to buy (Import)
        // Positive mod = More expensive for player to sell (Export, assuming dumping forces high price)

        if (type === 'import') {
            return 1 + Math.min(0, mod);
        } else {
            return 1 + Math.max(0, mod);
        }
    };

    // Configuration
    const TRADE_SPEED = 0.05; // 5% of surplus/shortage per day
    const MIN_TRADE_AMOUNT = 0.1;

    // Merchant count limits active routes
    const merchantCount = popStructure?.merchant || 0;

    const routesToRemove = [];
    const tradeLog = [];
    let totalTradeTax = 0;
    const resourceDelta = {};
    const nationDelta = {};

    const addResourceDelta = (key, amount) => {
        if (!Number.isFinite(amount) || amount === 0) return;
        resourceDelta[key] = (resourceDelta[key] || 0) + amount;
    };

    const addNationDelta = (nationId, delta) => {
        if (!nationId || !delta) return;
        if (!nationDelta[nationId]) {
            nationDelta[nationId] = { budget: 0, relation: 0, inventory: {} };
        }
        if (Number.isFinite(delta.budget)) {
            nationDelta[nationId].budget += delta.budget;
        }
        if (Number.isFinite(delta.relation)) {
            nationDelta[nationId].relation += delta.relation;
        }
        if (delta.inventory) {
            Object.entries(delta.inventory).forEach(([resKey, amount]) => {
                if (!Number.isFinite(amount) || amount === 0) return;
                nationDelta[nationId].inventory[resKey] =
                    (nationDelta[nationId].inventory[resKey] || 0) + amount;
            });
        }
    };

    // Process routes
    routes.forEach((route, index) => {
        const { nationId, resource, type } = route;
        const nation = nations.find(n => n.id === nationId);

        if (!nation) {
            routesToRemove.push(route);
            return;
        }

        // Skip if exceeding merchant capacity
        if (index >= merchantCount) {
            return;
        }

        // Pause if at war
        if (nation.isAtWar) {
            return;
        }

        const tradeStatus = calculateTradeStatus(resource, nation, daysElapsed);
        const localPrice = market?.prices?.[resource] ?? (RESOURCES[resource]?.basePrice || 1);
        const foreignPrice = calculateForeignPrice(resource, nation, daysElapsed);

        const mode = route?.mode || 'normal';
        const isForceSell = mode === 'force_sell';
        const isForceBuy = mode === 'force_buy';
        
        // Check both war-forced open market AND treaty-based open market
        const isWarForcedOpenMarket = Boolean(nation?.openMarketUntil && daysElapsed < nation.openMarketUntil);
        const treatyEffects = getTreatyEffects(nation, daysElapsed);
        const isOpenMarketActive = isWarForcedOpenMarket || treatyEffects.allowForceTrade || treatyEffects.bypassRelationCap;

        if (type === 'export') {
            // Check partner shortage
            if (!isForceSell) {
                if (!tradeStatus.isShortage || tradeStatus.shortageAmount <= 0) {
                    return;
                }
            }

            // Calculate surplus
            const currentInventory = (resources[resource] || 0) + (resourceDelta[resource] || 0); // Include pending changes
            const myTarget = 500;
            const mySurplus = Math.max(0, currentInventory - myTarget);

            if (mySurplus <= MIN_TRADE_AMOUNT) {
                return;
            }

            const shortageCap = Math.max(0, tradeStatus.shortageAmount || 0);
            const exportCap = isForceSell ? mySurplus : Math.min(mySurplus, shortageCap);
            const exportAmount = exportCap * TRADE_SPEED;

            if (exportAmount < MIN_TRADE_AMOUNT) {
                return;
            }

            // Financials
            const domesticPurchaseCost = localPrice * exportAmount;
            const taxRate = taxPolicies?.resourceTaxRates?.[resource] || 0;
            const tariffRate = taxPolicies?.exportTariffMultipliers?.[resource] ?? taxPolicies?.resourceTariffMultipliers?.[resource] ?? 0;
            const tariffDiscount = getTariffDiscount(nationId, nation);
            const adjustedTariffRate = tariffRate * (1 - tariffDiscount);
            const effectiveTaxRate = taxRate + adjustedTariffRate;
            const tradeTax = domesticPurchaseCost * effectiveTaxRate;

            const dumpingDiscount = 0.6;
            let effectiveForeignPrice = isForceSell ? foreignPrice * dumpingDiscount : foreignPrice;

            // Apply Vassal Price Modifier (for Exports)
            effectiveForeignPrice *= getVassalPriceMultiplier(nation, 'export');

            const foreignSaleRevenue = effectiveForeignPrice * exportAmount;
            const merchantProfit = foreignSaleRevenue - domesticPurchaseCost - tradeTax;

            if (merchantProfit <= 0) {
                return;
            }

            // Apply changes
            addResourceDelta(resource, -exportAmount);
            totalTradeTax += tradeTax;

            addNationDelta(nationId, {
                budget: -foreignSaleRevenue,
                relation: isForceSell ? (isOpenMarketActive ? 0.2 : -0.6) : 0.2,
                inventory: { [resource]: exportAmount },
            });

        } else if (type === 'import') {
            // Check partner surplus
            if (!isForceBuy) {
                if (!tradeStatus.isSurplus || tradeStatus.surplusAmount <= 0) {
                    return;
                }
            }

            const normalImportCap = Math.max(0, tradeStatus.surplusAmount || 0);
            const forcedBaseline = Math.max(10, tradeStatus.target || 0);
            const importCap = isForceBuy ? forcedBaseline : normalImportCap;
            const importAmount = importCap * TRADE_SPEED;

            if (importAmount < MIN_TRADE_AMOUNT) {
                return;
            }

            // Financials
            const forcedPremium = 1.3;
            let effectiveForeignPrice = isForceBuy ? foreignPrice * forcedPremium : foreignPrice;

            // Apply Vassal Price Modifier (for Imports - Looting/Preferential)
            effectiveForeignPrice *= getVassalPriceMultiplier(nation, 'import');

            const foreignPurchaseCost = effectiveForeignPrice * importAmount;

            const domesticSaleRevenue = localPrice * importAmount;
            const taxRate = taxPolicies?.resourceTaxRates?.[resource] || 0;
            const tariffRate = taxPolicies?.importTariffMultipliers?.[resource] ?? taxPolicies?.resourceTariffMultipliers?.[resource] ?? 0;
            const tariffDiscount = getTariffDiscount(nationId, nation);
            const adjustedTariffRate = tariffRate * (1 - tariffDiscount);
            const effectiveTaxRate = taxRate + adjustedTariffRate;
            const tradeTax = domesticSaleRevenue * effectiveTaxRate;
            const merchantProfit = domesticSaleRevenue - foreignPurchaseCost - tradeTax;

            if (merchantProfit <= 0) {
                return;
            }

            // Apply changes
            addResourceDelta(resource, importAmount);
            totalTradeTax += tradeTax;

            addNationDelta(nationId, {
                budget: foreignPurchaseCost,
                relation: isForceBuy ? (isOpenMarketActive ? 0.2 : -0.6) : 0.2,
                inventory: { [resource]: -importAmount },
            });

            if (importAmount >= 1 && !isForceBuy) {
                tradeLog.push(`🚢 进口 ${importAmount.toFixed(1)} ${RESOURCES[resource]?.name || resource} 从 ${nation.name}：商人国外购 ${foreignPurchaseCost.toFixed(1)} 银币，国内售 ${domesticSaleRevenue.toFixed(1)} 银币（税 ${tradeTax.toFixed(1)}），商人赚 ${merchantProfit.toFixed(1)} 银币。`);
            }
        }
    });

    return { tradeTax: totalTradeTax, resourceDelta, nationDelta, routesToRemove, tradeLog };
};
