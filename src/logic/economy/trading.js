/**
 * Merchant Trading System
 * Handles merchant trade simulation including import/export logic
 */

import { STRATA, RESOURCES } from '../../config';
import { calculateForeignPrice, calculateTradeStatus, calculateMaxTradeRoutes } from '../../utils/foreignTrade';
import { isTradableResource } from '../utils/helpers';
import { debugLog } from '../../utils/debugFlags';
import { getTreatyEffects } from '../diplomacy/treatyEffects';
import { TRANSACTION_CATEGORIES } from './ledger';

/**
 * Helper: Apply treasury (silver) change and optionally invoke callback for tracking
 */
const applyTreasuryChange = (resources, delta, reason, onTreasuryChange) => {
    if (!resources || !Number.isFinite(delta) || delta === 0) return 0;
    const before = Number(resources.silver || 0);
    const after = Math.max(0, before + delta);
    const actual = after - before;
    resources.silver = after;
    if (typeof onTreasuryChange === 'function' && actual !== 0) {
        onTreasuryChange(actual, reason);
    }
    return actual;
};

/**
 * Default merchant trade configuration
 */
export const DEFAULT_TRADE_CONFIG = {
    minProfitMargin: 0.10,
    maxPurchaseAmount: 20,
    exportProbability: 0.5,
    maxInventoryRatio: 0.3,
    minWealthForTrade: 10,
    tradeDuration: 3,
    tradeCooldown: 0,
    enableDebugLog: false,

    // Trade 2.0 knobs
    enableMerchantAssignments: true,
    idleTradeEfficiency: 1.0, // fallback when no assignments exist (keeps old saves alive)
    maxPartnersPerTick: 20,
    maxResourcesScoredPerPartner: 10,
    shortageWeight: 2.2,
    surplusWeight: 1.3,
    
    // Trade 3.0: Opportunity-first approach (select trades first, then assign merchants)
    maxTradeOpportunitiesPerPartner: 3, // [DEPRECATED] No longer used - kept for compatibility
    maxGlobalTradeOpportunities: 15, // [NEW] Top N most profitable trade opportunities globally (across all nations)
    merchantBatchesPerCycle: 3, // Split merchants into N batches (N = tradeDuration for even distribution)
};

// --- Trade 2.0 helpers -------------------------------------------------

const clamp01 = (v) => Math.max(0, Math.min(1, v));

const safeNumber = (v, fallback = 0) => (Number.isFinite(v) ? v : fallback);

const pickTopN = (items = [], n = 10) => {
    if (!Array.isArray(items) || items.length === 0) return [];
    const sorted = [...items].sort((a, b) => (b?.score || 0) - (a?.score || 0));
    return sorted.slice(0, Math.max(0, n));
};

/**
 * Merge a new trade into existing pending trades if possible
 * Merges trades with same: partnerId, resource, type, daysRemaining
 * @returns {boolean} true if merged, false if should add as new trade
 */
const tryMergeTrade = (pendingTrades, newTrade) => {
    if (!newTrade || !Array.isArray(pendingTrades)) return false;
    
    // Find existing trade that matches all merge criteria
    const existingTrade = pendingTrades.find(t => 
        t.partnerId === newTrade.partnerId &&
        t.resource === newTrade.resource &&
        t.type === newTrade.type &&
        t.daysRemaining === newTrade.daysRemaining
    );
    
    if (existingTrade) {
        // Merge the trades by accumulating values
        existingTrade.amount += newTrade.amount;
        existingTrade.revenue += newTrade.revenue;
        existingTrade.profit += newTrade.profit;
        existingTrade.capitalLocked += newTrade.capitalLocked;
        
        // Track merge count for debugging/display purposes (matches frontend field name)
        existingTrade.count = (existingTrade.count || 1) + 1;
        
        return true; // Successfully merged
    }
    
    return false; // No matching trade found, should add as new
};

const getNationRelationToPlayer = (nation) => {
    // Player-to-AI relation is stored on AI nation as `relation`
    return safeNumber(nation?.relation, 50);
};

const isTradeBlockedWithPartner = ({ partner }) => {
    // Minimal v1 rules:
    // - If the partner is at war with player, block.
    // Future: embargo treaties, closed market, etc.
    return partner?.isAtWar === true;
};

const normalizeMerchantAssignments = ({ merchantAssignments, nations, merchantCount = 0, tick = 0 }) => {
    if (!merchantAssignments || typeof merchantAssignments !== 'object') return null;
    const normalized = {};
    Object.entries(merchantAssignments).forEach(([nationId, value]) => {
        let count = Math.max(0, Math.floor(Number(value) || 0));
        if (count <= 0) return;

        const nation = Array.isArray(nations) ? nations.find(n => n?.id === nationId) : null;
        if (!nation) return;

        // [FIX] Filter out destroyed/annexed nations - merchants should be recalled automatically
        if (nation.isAnnexed || (nation.population || 0) <= 0) return;
        
        // [FIX] Filter out undiscovered nations - cannot trade with nations we haven't discovered
        if (nation.relation === null || nation.relation === undefined) return;

        // Backend Validation: Enforce Limit
        // This ensures that even if UI controls are bypassed, the logic enforces the cap.
        const relation = getNationRelationToPlayer(nation);
        const isAllied = nation.alliedWithPlayer === true;

        const treatyEffects = getTreatyEffects(nation, tick);
        const isWarForcedOpenMarket = Boolean(nation.openMarketUntil && tick < nation.openMarketUntil);
        const isTreatyOpenMarket = treatyEffects.bypassRelationCap || treatyEffects.extraMerchantSlots === Infinity;
        const isOpenMarket = isWarForcedOpenMarket || isTreatyOpenMarket;

        if (!isOpenMarket) {
            const baseMax = calculateMaxTradeRoutes(relation, isAllied, merchantCount);
            const percentBonus = Math.floor(baseMax * (treatyEffects.extraMerchantSlotsPercent || 0));
            const fixedBonus = treatyEffects.extraMerchantSlots === Infinity ? 999 : (treatyEffects.extraMerchantSlots || 0);
            const cap = baseMax + percentBonus + fixedBonus;

            // Clamp the count
            if (count > cap) {
                count = cap;
            }
        }

        if (count > 0) {
            normalized[nationId] = count;
        }
    });
    return Object.keys(normalized).length > 0 ? normalized : null;
};

const buildDefaultAssignments = ({ nations, maxPartners }) => {
    // [FIX] Filter out destroyed/annexed nations, rebels, and undiscovered nations
    const visible = Array.isArray(nations) 
        ? nations.filter(n => {
            if (!n || n.isRebelNation || n.isAnnexed || (n.population || 0) <= 0) return false;
            // Only trade with discovered nations (relation is not null/undefined)
            if (n.relation === null || n.relation === undefined) return false;
            return true;
        }) 
        : [];
    const sorted = visible
        .map(n => ({ nationId: n.id, relation: getNationRelationToPlayer(n) }))
        .sort((a, b) => b.relation - a.relation)
        .slice(0, Math.max(1, maxPartners));

    const next = {};
    sorted.forEach(entry => {
        next[entry.nationId] = 1;
    });
    return next;
};

/**
 * Build profit-based assignments for idle merchants
 * Finds the most profitable trade opportunities across all nations
 */
const buildProfitBasedAssignments = ({ 
    nations, 
    maxPartners, 
    res, 
    supply, 
    demand, 
    market, 
    tick, 
    tradeConfig,
    getImportTaxRate,
    taxPolicies
}) => {
    // Filter visible and tradable nations
    const visible = Array.isArray(nations) 
        ? nations.filter(n => {
            if (!n || n.isRebelNation || n.isAnnexed || (n.population || 0) <= 0) return false;
            // Only trade with discovered nations
            if (n.relation === null || n.relation === undefined) return false;
            return true;
        }) 
        : [];

    if (visible.length === 0) return {};

    // Helper to get local price
    const getLocalPrice = (resourceKey) => {
        return market?.prices?.[resourceKey] ?? (RESOURCES[resourceKey]?.basePrice || 1);
    };

    // Score each nation by their best trade opportunity
    const nationScores = visible.map(nation => {
        let bestScore = 0;
        let bestOpportunities = [];

        // Check all tradable resources
        Object.keys(RESOURCES).forEach(resourceKey => {
            if (!isTradableResource(resourceKey)) return;

            // Score import opportunity
            const importScore = scoreImportCandidate({
                resourceKey,
                partner: nation,
                tick,
                getLocalPrice,
                res,
                demand,
                tradeConfig,
                merchantTradePreferences: null,
                getImportTaxRate,
                tradeEfficiencyMultiplier: 1,
                taxPolicies
            });

            if (importScore && importScore.score > 0) {
                bestOpportunities.push({ ...importScore, nation: nation.id });
                bestScore = Math.max(bestScore, importScore.score);
            }

            // Score export opportunity
            const exportScore = scoreExportCandidate({
                resourceKey,
                partner: nation,
                tick,
                getLocalPrice,
                res,
                supply,
                tradeConfig,
                merchantTradePreferences: null,
                tradeEfficiencyMultiplier: 1,
                taxPolicies
            });

            if (exportScore && exportScore.score > 0) {
                bestOpportunities.push({ ...exportScore, nation: nation.id });
                bestScore = Math.max(bestScore, exportScore.score);
            }
        });

        return {
            nationId: nation.id,
            score: bestScore,
            opportunities: bestOpportunities
        };
    });

    // Sort by best trade opportunity score
    const sorted = nationScores
        .filter(n => n.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, Math.max(1, maxPartners));

    const next = {};
    sorted.forEach(entry => {
        next[entry.nationId] = 1;
    });

    return next;
};

const computeResourceShortageFactor = ({ resourceKey, res, demand = {}, marketPrice = 1 }) => {
    const stock = safeNumber(res?.[resourceKey], 0);
    const dailyDemand = Math.max(0, safeNumber(demand?.[resourceKey], 0));
    // If demand is unknown / 0, treat as low urgency.
    if (dailyDemand <= 0) return 0;

    // Convert to “days of inventory”. If stock=0 => 0 days.
    const days = stock <= 0 ? 0 : stock / dailyDemand;

    // Goal is not to exactly match simulation.js inventoryTargetDays;
    // we only need a monotonic urgency signal.
    const targetDays = 8;
    const ratio = days / targetDays;
    // shortageFactor: 1 when days=0, 0 when days>=target
    const shortageFactor = clamp01(1 - ratio);

    // Slightly prioritize high-price goods when short (strategic / expensive bottlenecks)
    const priceFactor = Math.min(1.5, Math.max(0.7, safeNumber(marketPrice, 1) / 3));

    return shortageFactor * priceFactor;
};

const computeResourceSurplusFactor = ({ resourceKey, res, supply = {}, marketPrice = 1 }) => {
    const stock = safeNumber(res?.[resourceKey], 0);
    const dailySupply = Math.max(0, safeNumber(supply?.[resourceKey], 0));
    if (dailySupply <= 0) return 0;
    const days = stock <= 0 ? 0 : stock / dailySupply;

    const targetDays = 12;
    const ratio = days / targetDays;
    // surplusFactor: 0 when <=target, grows when >> target
    const surplusFactor = clamp01((ratio - 1) / 2);

    // Encourage export more when local price is depressed
    const priceFactor = Math.min(1.6, Math.max(0.6, 2.2 / Math.max(0.5, safeNumber(marketPrice, 1))));

    return surplusFactor * priceFactor;
};

const getForeignUnitPrice = ({ resourceKey, partner, tick }) => {
    const p = calculateForeignPrice(resourceKey, partner, tick);
    return Number.isFinite(p) && p > 0 ? p : null;
};

const normalizePreferenceMultiplier = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return 1;
    // Avoid extreme values that can break scoring.
    return Math.max(0.1, Math.min(5, n));
};

const scoreImportCandidate = ({ resourceKey, partner, tick, getLocalPrice, res, demand, tradeConfig, merchantTradePreferences, getImportTaxRate, tradeEfficiencyMultiplier = 1, taxPolicies }) => {
    const localPrice = getLocalPrice(resourceKey);
    const foreignPrice = getForeignUnitPrice({ resourceKey, partner, tick });
    if (localPrice == null || foreignPrice == null) return null;

    // [FIX] Calculate effective cost correctly:
    // - Tariff applies to foreign price (import cost)
    // - Trade tax does NOT apply to import cost (it's for local production)
    // Only use tariff rate, not the combined tax+tariff rate
    const tariffRate = taxPolicies?.importTariffMultipliers?.[resourceKey] ?? taxPolicies?.resourceTariffMultipliers?.[resourceKey] ?? 0;
    const importCost = foreignPrice * (1 + tariffRate);
    
    // Gross revenue from selling locally
    const grossRevenue = localPrice;
    
    // Net profit per unit (simplified - ignores trade tax which is negligible for scoring)
    const profitMargin = ((grossRevenue - importCost) / Math.max(0.1, importCost)) * tradeEfficiencyMultiplier;

    // If trade loses money (margin <= 0), we usually shouldn't do it unless desperate for shortage?
    // But merchants are profit driven.
    if (profitMargin <= -0.1) return null; // Allow slight loss if desperate? No, merchants shouldn't lose money.

    const shortage = computeResourceShortageFactor({ resourceKey, res, demand, marketPrice: localPrice });

    // Partner availability: use tradeStatus to avoid buying from a partner that is short.
    const status = calculateTradeStatus(resourceKey, partner, tick);
    const partnerSurplus = status?.surplusAmount ? Math.min(1, status.surplusAmount / Math.max(50, status.target || 1)) : 0;

    // Combined Score:
    // Profit is weighted heavily now to allow Arbitrage.
    // Shortage is still important.
    const baseScore =
        tradeConfig.shortageWeight * shortage +
        2.0 * Math.max(0, profitMargin) + // Profit weight increased
        0.6 * partnerSurplus;

    const prefMultiplier = normalizePreferenceMultiplier(merchantTradePreferences?.import?.[resourceKey] ?? 1);

    const score = baseScore * prefMultiplier;

    return {
        type: 'import',
        resourceKey,
        localPrice,
        foreignPrice,
        score,
        partnerSurplus,
        shortage,
        prefMultiplier,
    };
};

const scoreExportCandidate = ({ resourceKey, partner, tick, getLocalPrice, res, supply, tradeConfig, merchantTradePreferences, tradeEfficiencyMultiplier = 1, taxPolicies }) => {
    const localPrice = getLocalPrice(resourceKey);
    const foreignPrice = getForeignUnitPrice({ resourceKey, partner, tick });
    if (localPrice == null || foreignPrice == null) return null;

    const availableStock = safeNumber(res?.[resourceKey], 0);
    if (availableStock <= 0) return null;

    // [FIX] Calculate export profitability correctly:
    // - Export tax/tariff applies to local price (cost to acquire goods)
    // - Revenue is foreign price
    const exportTaxRate = taxPolicies?.resourceTaxRates?.[resourceKey] || 0;
    const exportTariffRate = taxPolicies?.exportTariffMultipliers?.[resourceKey] ?? taxPolicies?.resourceTariffMultipliers?.[resourceKey] ?? 0;
    const totalExportTax = exportTaxRate + exportTariffRate;
    
    const exportCost = localPrice * (1 + totalExportTax);
    const profitMargin = ((foreignPrice - exportCost) / Math.max(0.0001, exportCost)) * tradeEfficiencyMultiplier;
    
    // Only export if profitable after taxes
    if (profitMargin <= -0.1) return null;

    const surplus = computeResourceSurplusFactor({ resourceKey, res, supply, marketPrice: localPrice });

    // Partner shortage: prefer exporting to partners that are short.
    const status = calculateTradeStatus(resourceKey, partner, tick);
    const partnerShortage = status?.shortageAmount ? Math.min(1, status.shortageAmount / Math.max(50, status.target || 1)) : 0;

    const baseScore =
        tradeConfig.surplusWeight * surplus +
        2.0 * Math.max(0, profitMargin) + // Weight profit heavily
        0.6 * partnerShortage;

    const prefMultiplier = normalizePreferenceMultiplier(merchantTradePreferences?.export?.[resourceKey] ?? 1);

    const score = baseScore * prefMultiplier;

    return {
        type: 'export',
        resourceKey,
        localPrice,
        foreignPrice,
        score,
        partnerShortage,
        surplus,
        prefMultiplier,
    };
};

// --- Trade 2.0 end helpers ---------------------------------------------

/**
 * Analyze global trade opportunities for UI display
 * Scans all visible nations and returns top export/import opportunities
 */
export const analyzeTradeOpportunities = ({
    nations,
    res,
    supply,
    demand,
    market,
    tick,
    taxPolicies,
    tradeConfig = DEFAULT_TRADE_CONFIG,
    merchantTradePreferences = null
}) => {
    const opportunities = { exports: [], imports: [] };
    const getLocalPrice = (k) => market?.prices?.[k];

    // Tax rate helpers (simplified for analysis)
    const resourceTaxRates = taxPolicies?.resourceTaxRates || {};
    const importTariffMultipliers = taxPolicies?.importTariffMultipliers || taxPolicies?.resourceTariffMultipliers || {};
    const getImportTaxRate = (resource) => {
        const baseTaxRate = resourceTaxRates[resource] || 0;
        const tariffRate = importTariffMultipliers[resource] ?? 0;
        return baseTaxRate + tariffRate;
    };

    const tradableKeys = Object.keys(RESOURCES).filter(key => isTradableResource(key));
    const allExports = [];
    const allImports = [];

    // Scan all visible nations
    (nations || []).forEach(partner => {
        if (!partner || partner.isAtWar) return;

        tradableKeys.forEach(resourceKey => {
            // Export check
            const exp = scoreExportCandidate({
                resourceKey,
                partner,
                tick,
                getLocalPrice,
                res,
                supply,
                tradeConfig,
                merchantTradePreferences,
                taxPolicies,
            });
            if (exp && exp.score > 0) allExports.push(exp);

            // Import check
            const imp = scoreImportCandidate({
                resourceKey,
                partner,
                tick,
                getLocalPrice,
                res,
                demand,
                tradeConfig,
                merchantTradePreferences,
                getImportTaxRate,
                taxPolicies,
            });
            if (imp && imp.score > 0) allImports.push(imp);
        });
    });

    // Return top 10 of each
    opportunities.exports = pickTopN(allExports, 10);
    opportunities.imports = pickTopN(allImports, 10);

    return opportunities;
};

/**
 * Simulate merchant trading for one tick
 * @param {Object} params - Trading parameters
 * @returns {Object} Updated merchant state
 */
export const simulateMerchantTrade = ({
    ledger, // [REFACTORED]
    res,
    wealth,
    popStructure,
    supply,
    demand,
    nations,
    tick,
    taxPolicies,
    taxBreakdown,
    getLocalPrice,
    roleExpense,
    roleWagePayout,
    pendingTrades = [],
    lastTradeTime = 0,
    gameSpeed = 1,

    classFinancialData,
    logs,
    potentialResources,

    // Trade 2.0: allow caller to provide player-level assignment state
    merchantAssignments = null,

    // Trade 2.0: player preference multipliers per resource (1 = neutral)
    merchantTradePreferences = null,

    // Control whether to log merchant trade initiation messages
    shouldLogMerchantTrades = true,

    // Allow creating new trades this tick (pending trades always progress)
    allowNewTrades = true,

    // Treasury change callback for resource tracking
    onTreasuryChange = null,

    // NEW: Supply/demand breakdown tracking for UI
    supplyBreakdown = null,
    demandBreakdown = null,

    // Market data for price information
    market = null,
    
    // Trade 2.0 Rotation: Track which partners/trades were processed last tick
    tradeRotationState = null, // { partnerIndex: 0, tradeIndex: 0, partnerList: [] }
}) => {
    const merchantCount = popStructure?.merchant || 0;
    if (merchantCount <= 0) {
        return { 
            pendingTrades, 
            lastTradeTime, 
            lockedCapital: 0, 
            capitalInvestedThisTick: 0, 
            completedTrades: [],
            tradeRotationState: tradeRotationState || { partnerIndex: 0, tradeIndex: 0, partnerList: [] }
        };
    }
    let capitalInvestedThisTick = 0;
    const completedTrades = [];

    const resourceTaxRates = taxPolicies?.resourceTaxRates || {};
    const importTariffMultipliers = taxPolicies?.importTariffMultipliers || taxPolicies?.resourceTariffMultipliers || {};
    const exportTariffMultipliers = taxPolicies?.exportTariffMultipliers || taxPolicies?.resourceTariffMultipliers || {};

    const getImportTaxRate = (resource) => {
        const baseTaxRate = resourceTaxRates[resource] || 0;
        const tariffRate = importTariffMultipliers[resource] ?? 0;
        return baseTaxRate + tariffRate;
    };
    const getExportTaxRate = (resource) => {
        const baseTaxRate = resourceTaxRates[resource] || 0;
        const tariffRate = exportTariffMultipliers[resource] ?? 0;
        return baseTaxRate + tariffRate;
    };


    // Get merchant trade configuration - MERGE default with STRATA overrides
    const tradeConfig = { ...DEFAULT_TRADE_CONFIG, ...(STRATA.merchant?.tradeConfig || {}) };

    // Process pending trades (point-to-point: apply on completion)
    // [FIX] Filter out trades with undiscovered nations (旧存档清理)
    const updatedPendingTrades = [];
    pendingTrades.forEach(trade => {
        // Skip trades with undiscovered nations
        if (trade.partnerId) {
            const partner = Array.isArray(nations) ? nations.find(n => n?.id === trade.partnerId) : null;
            if (!partner || partner.relation === null || partner.relation === undefined) {
                // Skip this trade - nation is not discovered
                if (tradeConfig.enableDebugLog) {
                    debugLog('trade', `[贸易清理] 跳过未发现国家的贸易: ${trade.partnerId}`, trade);
                }
                return; // Skip this trade
            }
        }
        
        trade.daysRemaining -= 1;

        if (trade.daysRemaining <= 0) {
            // [REFACTORED] Use Ledger for revenue (Income)
            if (ledger) {
                ledger.transfer('void', 'merchant', trade.revenue, TRANSACTION_CATEGORIES.INCOME.OWNER_REVENUE, TRANSACTION_CATEGORIES.INCOME.OWNER_REVENUE);
            }
            // Keep roleWagePayout for other stats
            roleWagePayout.merchant = (roleWagePayout.merchant || 0) + trade.revenue;

            if (trade.type === 'import') {
                res[trade.resource] = (res[trade.resource] || 0) + trade.amount;
                supply[trade.resource] = (supply[trade.resource] || 0) + trade.amount;

                // NEW: Track import to supplyBreakdown for UI display
                if (supplyBreakdown) {
                    if (!supplyBreakdown[trade.resource]) {
                        supplyBreakdown[trade.resource] = { buildings: {}, imports: 0 };
                    }
                    supplyBreakdown[trade.resource].imports = (supplyBreakdown[trade.resource].imports || 0) + trade.amount;
                }

                // Point-to-point: decrement partner inventory when import completes.
                if (trade.partnerId && Array.isArray(nations)) {
                    const partner = nations.find(n => n?.id === trade.partnerId);
                    if (partner) {
                        if (!partner.inventory) partner.inventory = {};
                        const cur = partner.inventory[trade.resource] || 0;
                        partner.inventory[trade.resource] = Math.max(0, cur - trade.amount);
                    }
                }
            } else if (trade.type === 'export') {
                // Point-to-point: increment partner inventory when export completes.
                if (trade.partnerId && Array.isArray(nations)) {
                    const partner = nations.find(n => n?.id === trade.partnerId);
                    if (partner) {
                        if (!partner.inventory) partner.inventory = {};
                        const cur = partner.inventory[trade.resource] || 0;
                        partner.inventory[trade.resource] = Math.max(0, cur + trade.amount);
                    }
                }
            }

            completedTrades.push({
                type: trade.type,
                resource: trade.resource,
                amount: trade.amount,
                revenue: trade.revenue,
                profit: trade.profit,
                partnerId: trade.partnerId,
            });

            if (tradeConfig.enableDebugLog) {
                debugLog('trade', `[Merchant Debug] ✅ Trade complete:`, {
                    type: trade.type === 'export' ? 'Export' : 'Import',
                    partnerId: trade.partnerId,
                    resource: trade.resource,
                    amount: trade.amount,
                    revenue: trade.revenue,
                    profit: trade.profit
                });
            }
        } else {
            updatedPendingTrades.push(trade);
        }
    });

    // If we are throttling new trades, skip expensive opportunity search
    if (!allowNewTrades) {
        const lockedCapital = updatedPendingTrades.reduce((sum, trade) => sum + Math.max(0, trade?.capitalLocked || 0), 0);
        return {
            pendingTrades: updatedPendingTrades,
            lastTradeTime,
            lockedCapital,
            capitalInvestedThisTick: 0,
            completedTrades,
            tradeRotationState: tradeRotationState || { partnerIndex: 0, tradeIndex: 0, partnerList: [] }
        };
    }

    // Check trade cooldown
    const ticksSinceLastTrade = tick - lastTradeTime;
    const canTradeNow = ticksSinceLastTrade >= tradeConfig.tradeCooldown;
    if (!canTradeNow) {
        return { 
            pendingTrades: updatedPendingTrades, 
            lastTradeTime, 
            lockedCapital: 0, 
            capitalInvestedThisTick: 0, 
            completedTrades,
            tradeRotationState: tradeRotationState || { partnerIndex: 0, tradeIndex: 0, partnerList: [] }
        };
    }

    const tradableKeys = Object.keys(RESOURCES)
        .filter(key => isTradableResource(key))
        .filter(key => !potentialResources || potentialResources.has(key));

    // --- Trade 2.0: determine which partners are actively assigned this tick
    const normalizedAssignments = normalizeMerchantAssignments({ merchantAssignments, nations, merchantCount, tick });
    const hasExplicitAssignments = tradeConfig.enableMerchantAssignments && !!normalizedAssignments;

    // Calculate how many merchants are explicitly assigned
    const explicitlyAssignedCount = hasExplicitAssignments
        ? Object.values(normalizedAssignments).reduce((sum, count) => sum + count, 0)
        : 0;

    // Calculate idle merchants (not explicitly assigned)
    const idleMerchantCount = Math.max(0, merchantCount - explicitlyAssignedCount);

    // Build assignments: combine explicit assignments with auto-assignments for idle merchants
    let assignments = hasExplicitAssignments ? { ...normalizedAssignments } : {};

    // If there are idle merchants, auto-assign them to best partners based on profit
    if (idleMerchantCount > 0) {
        const autoAssignments = buildProfitBasedAssignments({ 
            nations, 
            maxPartners: tradeConfig.maxPartnersPerTick,
            res,
            supply,
            demand,
            market,
            tick,
            tradeConfig,
            getImportTaxRate,
            taxPolicies
        });
        
        // Distribute idle merchants among auto-assigned partners
        const autoPartners = Object.keys(autoAssignments);
        if (autoPartners.length > 0) {
            const merchantsPerPartner = Math.floor(idleMerchantCount / autoPartners.length);
            const remainder = idleMerchantCount % autoPartners.length;
            
            autoPartners.forEach((nationId, index) => {
                const count = merchantsPerPartner + (index < remainder ? 1 : 0);
                if (count > 0) {
                    // Add to existing assignment or create new one
                    assignments[nationId] = (assignments[nationId] || 0) + count;
                }
            });
        }
    }

    // If no assignments at all, use profit-based default
    if (Object.keys(assignments).length === 0) {
        assignments = buildProfitBasedAssignments({ 
            nations, 
            maxPartners: tradeConfig.maxPartnersPerTick,
            res,
            supply,
            demand,
            market,
            tick,
            tradeConfig,
            getImportTaxRate,
            taxPolicies
        });
    }

    // Convert assignments to concrete partner list, and cap partners per tick for performance.
    // [FIX] Ensure all partners are evaluated over time by rotating through them
    const allPartnerList = Object.entries(assignments)
        .map(([nationId, count]) => ({ nationId, count }))
        .filter(e => e.count > 0);
    
    // Build a pool of "merchant batches" based on assigned counts.
    // Each merchant can handle one trade route, so batches = merchant count.
    const totalAssigned = allPartnerList.reduce((sum, p) => sum + p.count, 0) || 1;

    const partnerBatches = allPartnerList.map(p => {
        // Each partner gets trade routes proportional to assigned merchants
        const batches = Math.max(1, p.count);
        // Track whether this partner has explicitly assigned merchants or auto-assigned idle merchants
        const explicitCount = hasExplicitAssignments ? (normalizedAssignments[p.nationId] || 0) : 0;
        const idleCount = p.count - explicitCount;
        return { 
            ...p, 
            batches,
            explicitCount,  // Merchants explicitly assigned by player
            idleCount       // Idle merchants auto-assigned
        };
    });

    // [ROTATION] Initialize or restore rotation state
    let rotationState = tradeRotationState || { partnerIndex: 0, tradeIndex: 0, partnerList: [] };
    
    // If partner list changed (new assignments), reset rotation
    const currentPartnerIds = partnerBatches.map(p => p.nationId).sort().join(',');
    const savedPartnerIds = (rotationState.partnerList || []).sort().join(',');
    if (currentPartnerIds !== savedPartnerIds) {
        rotationState = { 
            partnerIndex: 0, 
            tradeIndex: 0, 
            partnerList: partnerBatches.map(p => p.nationId) 
        };
    }

    // [DEBUG] Log merchant assignment details
    if (tradeConfig.enableDebugLog) {
        debugLog('trade', `[商人派驻] 总商人数: ${merchantCount}, 派驻商人: ${explicitlyAssignedCount}, 闲置商人: ${idleMerchantCount}`, {
            partnerBatches: partnerBatches.map(pb => ({
                nationId: pb.nationId,
                totalMerchants: pb.count,
                explicitMerchants: pb.explicitCount,
                idleMerchants: pb.idleCount,
                batches: pb.batches
            })),
            rotationState
        });
    }

    // [ROTATION] Limit new trades per tick to spread load across multiple ticks
    const maxNewTradesThisTick = tradeConfig.maxNewTradesPerTick || 10;
    let tradesCreatedThisTick = 0;

    // ============================================================
    // TRADE 3.0: Opportunity-First Approach
    // 1. Collect all profitable trade opportunities (no merchant iteration)
    // 2. Distribute merchants across opportunities in batches
    // 3. Create trades for current batch only
    // ============================================================
    
    // STEP 1: Collect all trade opportunities from all partners
    const allTradeOpportunities = [];
    
    for (const partnerBatch of partnerBatches) {
        const partner = Array.isArray(nations) ? nations.find(n => n?.id === partnerBatch.nationId) : null;
        
        
        // Skip invalid/blocked partners
        if (!partner || 
            partner.relation === null || 
            partner.relation === undefined ||
            partner.isAnnexed || 
            (partner.population || 0) <= 0 ||
            isTradeBlockedWithPartner({ partner })) {
            continue;
        }

        // 获取与该贸易伙伴的条约效果，应用关税减免
        const treatyEffects = getTreatyEffects(partner, tick);
        const treatyTariffMult = treatyEffects.tariffMultiplier; // 0~1, 低于1表示减免

        const tradeEfficiencyMultiplier = 1 + Math.max(0, treatyEffects.tradeEfficiencyBonus || 0);

        // 创建基于条约的关税率计算函数
        const getPartnerImportTaxRate = (resource) => {
            const baseRate = getImportTaxRate(resource);
            // 条约减免只作用于关税部分，不影响基础交易税
            const tariffPart = (importTariffMultipliers[resource] ?? 0);
            const discountedTariff = tariffPart * treatyTariffMult;
            return (resourceTaxRates[resource] || 0) + discountedTariff;
        };
        const getPartnerExportTaxRate = (resource) => {
            const baseRate = getExportTaxRate(resource);
            const tariffPart = (exportTariffMultipliers[resource] ?? 0);
            const discountedTariff = tariffPart * treatyTariffMult;
            return (resourceTaxRates[resource] || 0) + discountedTariff;
        };

        // Candidate scoring (cap resources scanned for perf)
        const candidates = [];

        // Heuristic prefilter: compute local shortage/surplus lists to avoid scoring everything.
        const localShortageList = [];
        const localSurplusList = [];

        tradableKeys.forEach(resourceKey => {
            const localPrice = getLocalPrice(resourceKey);
            if (localPrice == null) return;

            // 1. Supply/Demand Signals
            const shortage = computeResourceShortageFactor({ resourceKey, res, demand, marketPrice: localPrice });
            const surplus = computeResourceSurplusFactor({ resourceKey, res, supply, marketPrice: localPrice });

            // 2. Price/Profit Signals (Arbitrage)
            // We must check if trade is profitable AFTER tariffs/subsidies to catch subsidy-driven opportunities.
            const foreignPrice = getForeignUnitPrice({ resourceKey, partner, tick });
            let importProfitScore = 0;
            let exportProfitScore = 0;

            if (foreignPrice != null) {
                // [FIX] Import Profitability: LocalPrice - (ForeignPrice * (1 + ImportTariff))
                // Only tariff applies to foreign price, not trade tax
                const importTariffRate = importTariffMultipliers[resourceKey] ?? 0;
                const importCost = foreignPrice * (1 + importTariffRate);
                if (localPrice > importCost) {
                    // Normalize score: % profit margin
                    importProfitScore = (localPrice - importCost) / Math.max(0.1, importCost);
                }

                // [FIX] Export Profitability: ForeignPrice - (LocalPrice * (1 + ExportTax + ExportTariff))
                // Both tax and tariff apply to local price
                const exportTaxRate = resourceTaxRates[resourceKey] || 0;
                const exportTariffRate = exportTariffMultipliers[resourceKey] ?? 0;
                const exportCost = localPrice * (1 + exportTaxRate + exportTariffRate);
                if (foreignPrice > exportCost) {
                    exportProfitScore = (foreignPrice - exportCost) / Math.max(0.1, exportCost);
                }
            }

            // Push to candidate list if EITHER shortage exists OR profit is attractive
            // This ensures we import even if inventory is full, if the price (after subsidy) is good enough.
            if (shortage > 0.01 || importProfitScore > 0.05) {
                // Combined score for sorting pre-filter
                localShortageList.push({ resourceKey, score: Math.max(shortage, importProfitScore) });
            }

            if (surplus > 0.01 || exportProfitScore > 0.05) {
                localSurplusList.push({ resourceKey, score: Math.max(surplus, exportProfitScore) });
            }
        });

        let shortageTop = pickTopN(localShortageList, tradeConfig.maxResourcesScoredPerPartner);
        let surplusTop = pickTopN(localSurplusList, tradeConfig.maxResourcesScoredPerPartner);

        // Fallback: if lists are empty (and no profit found?), fallback scan.
        // With the new profit logic, this is less likely to happen unless prices match perfectly.
        if (shortageTop.length === 0 && surplusTop.length === 0) {
            const fallbackScans = Math.max(6, tradeConfig.maxResourcesScoredPerPartner);
            const fallbackRanked = [];

            tradableKeys.forEach(resourceKey => {
                const localPrice = getLocalPrice(resourceKey);
                if (localPrice == null) return;
                const foreignPrice = getForeignUnitPrice({ resourceKey, partner, tick });
                if (foreignPrice == null) return;

                // Rank by absolute relative price spread so we at least consider the best arbitrage opportunities.
                const importSpread = (localPrice - foreignPrice) / Math.max(0.0001, localPrice);
                const exportSpread = (foreignPrice - localPrice) / Math.max(0.0001, localPrice);
                const bestSpread = Math.max(importSpread, exportSpread);
                if (bestSpread <= 0) return;

                fallbackRanked.push({ resourceKey, score: bestSpread });
            });

            const fallbackTop = pickTopN(fallbackRanked, fallbackScans);
            shortageTop = fallbackTop;
            surplusTop = fallbackTop;

            if (tradeConfig.enableDebugLog) {
                debugLog('trade', `[Merchant Debug] ⚠️ Trade 2.0 fallback prefilter active (no shortage/surplus signals).`, {
                    partnerId: partner?.id,
                    fallbackCandidates: fallbackTop.length,
                });
            }
        }

        shortageTop.forEach(({ resourceKey }) => {
            const c = scoreImportCandidate({
                tradeEfficiencyMultiplier,
                resourceKey,
                partner,
                tick,
                getLocalPrice,
                res,
                demand,
                tradeConfig,
                merchantTradePreferences,
                getImportTaxRate, // Passthrough tax function
                taxPolicies,
            });
            if (c) candidates.push(c);
        });

        surplusTop.forEach(({ resourceKey }) => {
            const c = scoreExportCandidate({
                tradeEfficiencyMultiplier,
                resourceKey,
                partner,
                tick,
                getLocalPrice,
                res,
                supply,
                tradeConfig,
                merchantTradePreferences,
                taxPolicies,
            });
            if (c) candidates.push(c);
        });

        if (candidates.length === 0) continue;
        
        // [NEW] Don't filter per-partner - collect ALL candidates for global ranking
        // Add all candidates to global opportunity pool with partner context
        candidates.forEach(candidate => {
            allTradeOpportunities.push({
                partner,
                partnerBatch,
                candidate,
                getPartnerImportTaxRate,
                getPartnerExportTaxRate,
                tradeEfficiencyMultiplier,
            });
        });
    }
    
    // Early exit if no opportunities found
    if (allTradeOpportunities.length === 0) {
        return {
            pendingTrades: updatedPendingTrades,
            lastTradeTime,
            lockedCapital: 0,
            capitalInvestedThisTick,
            completedTrades,
            tradeRotationState: rotationState,
        };
    }
    
    // [DEBUG] Log collected opportunities
    if (tradeConfig.enableDebugLog) {
        debugLog('trade', `[贸易机会] 收集到 ${allTradeOpportunities.length} 个贸易机会`, {
            opportunities: allTradeOpportunities.map(o => ({
                partner: o.partner.name,
                resource: o.candidate.resourceKey,
                type: o.candidate.type,
                score: o.candidate.score.toFixed(2),
            }))
        });
    }
    
    // ============================================================
    // [NEW] GLOBAL RANKING: Sort all opportunities by profitability
    // and select top Q most profitable trades across all nations
    // ============================================================
    allTradeOpportunities.sort((a, b) => b.candidate.score - a.candidate.score);
    
    // Limit to top Q most profitable opportunities globally
    const maxGlobalOpportunities = tradeConfig.maxGlobalTradeOpportunities || 15;
    const topGlobalOpportunities = allTradeOpportunities.slice(0, maxGlobalOpportunities);
    
    if (tradeConfig.enableDebugLog) {
        debugLog('trade', `[全局排序] 选择最赚钱的前 ${topGlobalOpportunities.length} 个贸易机会`, {
            top5: topGlobalOpportunities.slice(0, 5).map(o => ({
                partner: o.partner.name,
                resource: o.candidate.resourceKey,
                type: o.candidate.type,
                score: o.candidate.score.toFixed(2),
            }))
        });
    }
    
    // ============================================================
    // STEP 2: Rotate through opportunities to spread trades across ticks
    // ============================================================
    const tradeDuration = tradeConfig.tradeDuration || 3;
    
    // Calculate how many opportunities to process this tick
    // Goal: Process all opportunities over N ticks (N = tradeDuration)
    const opportunitiesPerTick = Math.ceil(topGlobalOpportunities.length / tradeDuration);
    const startIndex = (tick % tradeDuration) * opportunitiesPerTick;
    const endIndex = Math.min(startIndex + opportunitiesPerTick, topGlobalOpportunities.length);
    
    // Select opportunities for this tick
    const opportunitiesThisTick = topGlobalOpportunities.slice(startIndex, endIndex);
    
    if (opportunitiesThisTick.length === 0) {
        return {
            pendingTrades: updatedPendingTrades,
            lastTradeTime,
            lockedCapital: updatedPendingTrades.reduce((sum, t) => sum + (t.capitalLocked || 0), 0),
            capitalInvestedThisTick,
            completedTrades,
            tradeRotationState: rotationState,
        };
    }
    
    // Calculate total merchants to process this tick
    const totalMerchants = partnerBatches.reduce((sum, pb) => sum + pb.count, 0);
    
    // [DEBUG] Log batch processing
    if (tradeConfig.enableDebugLog) {
        debugLog('trade', `[商人轮询] Tick ${tick}, 处理机会 ${startIndex}-${endIndex}/${allTradeOpportunities.length}`, {
            tick,
            tradeDuration,
            opportunitiesThisTick: opportunitiesThisTick.length,
            totalOpportunities: allTradeOpportunities.length,
            totalMerchants
        });
    }
    
    // ============================================================
    // STEP 3: Assign merchants to opportunities based on profitability
    // More profitable trades get more merchants
    // ============================================================
    
    // Calculate total score of opportunities this tick
    const totalScore = opportunitiesThisTick.reduce((sum, o) => sum + o.candidate.score, 0);
    
    if (totalScore <= 0) {
        return {
            pendingTrades: updatedPendingTrades,
            lastTradeTime,
            lockedCapital: updatedPendingTrades.reduce((sum, t) => sum + (t.capitalLocked || 0), 0),
            capitalInvestedThisTick,
            completedTrades,
            tradeRotationState: rotationState,
        };
    }
    
    // Distribute merchants proportionally based on profitability score
    const merchantAllocations = opportunitiesThisTick.map(o => {
        const scoreRatio = o.candidate.score / totalScore;
        const allocation = Math.max(1, Math.round(totalMerchants * scoreRatio)); // At least 1 merchant per opportunity
        return { ...o, merchantCount: allocation };
    });
    
    // Normalize allocations to match total merchants exactly
    const allocatedTotal = merchantAllocations.reduce((sum, a) => sum + a.merchantCount, 0);
    const scaleFactor = totalMerchants / allocatedTotal;
    merchantAllocations.forEach(a => {
        a.merchantCount = Math.max(1, Math.round(a.merchantCount * scaleFactor));
    });
    
    // [DEBUG] Log merchant allocation
    if (tradeConfig.enableDebugLog) {
        debugLog('trade', `[商人分配] 按利润比例分配 ${totalMerchants} 个商人`, {
            allocations: merchantAllocations.map(a => ({
                partner: a.partner.name,
                resource: a.candidate.resourceKey,
                type: a.candidate.type,
                score: a.candidate.score.toFixed(2),
                merchants: a.merchantCount,
                percentage: ((a.merchantCount / totalMerchants) * 100).toFixed(1) + '%'
            }))
        });
    }
    
    let merchantsProcessed = 0;
    
    for (let i = 0; i < merchantAllocations.length; i++) {
        const allocation = merchantAllocations[i];
        const { partner, partnerBatch, candidate, getPartnerImportTaxRate, getPartnerExportTaxRate, tradeEfficiencyMultiplier, merchantCount } = allocation;
        
        
        if (merchantCount === 0) continue;
        
        const currentTotalWealth = wealth.merchant || 0;
        if (currentTotalWealth <= tradeConfig.minWealthForTrade) break;
        
        // Calculate efficiency based on merchant composition
        const explicitEfficiency = 1;
        const idleEfficiency = tradeConfig.idleTradeEfficiency;
        const totalMerchantsForPartner = partnerBatch.explicitCount + partnerBatch.idleCount;
        const averageEfficiency = totalMerchantsForPartner > 0
            ? (partnerBatch.explicitCount * explicitEfficiency + partnerBatch.idleCount * idleEfficiency) / totalMerchantsForPartner
            : idleEfficiency;
        
        // Allocate wealth proportional to merchants assigned to this opportunity
        const wealthShare = merchantCount / totalMerchants;
        const wealthForThisOpportunity = currentTotalWealth * wealthShare * averageEfficiency;

        if (candidate.type === 'export') {
            const result = executeExportTradeV2({
                tradeEfficiencyMultiplier,
                ledger,
                partner,
                partnerId: partner.id,
                resourceKey: candidate.resourceKey,
                wealthForThisBatch: wealthForThisOpportunity,
                batchMultiplier: merchantCount,
                wealth,
                res,
                supply,
                taxBreakdown,
                tradeConfig,
                getLocalPrice,
                foreignUnitPrice: candidate.foreignPrice,
                getResourceTaxRate: getExportTaxRate,
                roleWagePayout,
                roleExpense,
                classFinancialData,
                taxPolicies,
                tick,
                logs,
                demandBreakdown,
            });

            if (result.success) {
                capitalInvestedThisTick += result.outlay;
                
                const merged = tryMergeTrade(updatedPendingTrades, result.trade);
                if (!merged) {
                    updatedPendingTrades.push(result.trade);
                }
                
                lastTradeTime = tick;
                merchantsProcessed += merchantCount;
            }
        } else {
            const result = executeImportTradeV2({
                tradeEfficiencyMultiplier,
                ledger,
                partner,
                partnerId: partner.id,
                resourceKey: candidate.resourceKey,
                wealthForThisBatch: wealthForThisOpportunity,
                batchMultiplier: merchantCount,
                wealth,
                res,
                taxBreakdown,
                tradeConfig,
                getLocalPrice,
                foreignUnitPrice: candidate.foreignPrice,
                getResourceTaxRate: getImportTaxRate,
                roleWagePayout,
                roleExpense,
                classFinancialData,
                taxPolicies,
                logs,
            });

            if (result.success) {
                capitalInvestedThisTick += result.cost;
                
                const merged = tryMergeTrade(updatedPendingTrades, result.trade);
                if (!merged) {
                    updatedPendingTrades.push(result.trade);
                }
                
                lastTradeTime = tick;
                merchantsProcessed += merchantCount;
            }
        }
    }
    
    // [DEBUG] Log final statistics
    if (tradeConfig.enableDebugLog) {
        debugLog('trade', `[贸易统计] 本tick处理商人: ${merchantsProcessed}/${totalMerchants}, 创建贸易: ${updatedPendingTrades.length}笔`, {
            merchantsProcessed,
            totalMerchants,
            tradesCreated: updatedPendingTrades.length,
            opportunitiesProcessed: opportunitiesThisTick.length
        });
    }

    const lockedCapital = updatedPendingTrades.reduce((sum, trade) => sum + Math.max(0, trade?.capitalLocked || 0), 0);

    return {
        pendingTrades: updatedPendingTrades,
        lastTradeTime,
        lockedCapital,
        capitalInvestedThisTick,
        completedTrades,
        tradeRotationState: rotationState, // No longer needed but kept for compatibility
    };
};

// --- V2 execution functions (point-to-point) ----------------------------

const executeExportTradeV2 = ({
    ledger, // [REFACTORED]
    partner,
    partnerId,
    resourceKey,
    wealthForThisBatch,
    batchMultiplier,
    wealth,
    res,
    supply,
    taxBreakdown,
    tradeConfig,
    tradeEfficiencyMultiplier = 1,
    getLocalPrice,
    foreignUnitPrice,
    getResourceTaxRate,
    classFinancialData,
    taxPolicies,
    roleExpense,
    logs,
    demandBreakdown = null, // NEW: For tracking exports in UI
}) => {
    const localPrice = getLocalPrice(resourceKey);
    const foreignPrice = foreignUnitPrice;

    if (foreignPrice === null || localPrice === null || foreignPrice <= localPrice) {
        return { success: false };
    }

    const taxRate = getResourceTaxRate(resourceKey);
    const costWithTaxPerUnit = localPrice * (1 + taxRate);

    const affordableAmount = costWithTaxPerUnit > 0 ? wealthForThisBatch / costWithTaxPerUnit : 0;
    const availableStock = (res[resourceKey] || 0) / batchMultiplier;
    const maxInventory = availableStock * tradeConfig.maxInventoryRatio;

    // Partner capacity: don't flood more than their shortage+surplus buffer
    const status = calculateTradeStatus(resourceKey, partner, 0);
    const partnerAbsorb = Math.max(20, (status?.shortageAmount || 0) + (status?.target || 0) * 0.08);

    const amount = Math.min(
        tradeConfig.maxPurchaseAmount,
        affordableAmount,
        maxInventory,
        partnerAbsorb
    );

    if (amount <= 0.1) return { success: false };

    const cost = localPrice * amount;
    const tax = cost * taxRate;
    const revenue = foreignPrice * amount;

    let outlay = cost;
    let appliedTax = 0;

    if (tax < 0) {
        const subsidyAmount = Math.abs(tax);
        if ((res.silver || 0) >= subsidyAmount * batchMultiplier) {
            outlay -= subsidyAmount;
            appliedTax = -subsidyAmount;
        } else {
            logs.push(`Treasury empty, cannot pay export subsidy for ${RESOURCES[resourceKey]?.name || resourceKey}!`);
        }
    } else {
        outlay += tax;
        appliedTax = tax;
    }

    const baseRate = taxPolicies?.resourceTaxRates?.[resourceKey] || 0;
    const tariffRate = taxPolicies?.exportTariffMultipliers?.[resourceKey] ?? taxPolicies?.resourceTariffMultipliers?.[resourceKey] ?? 0;
    // const baseTaxPaid = cost * baseRate * batchMultiplier; // Removed duplicate declaration
    const tariffPerUnit = cost * tariffRate;
    let appliedTariff = 0;

    if (tariffPerUnit > 0) {
        outlay += tariffPerUnit;
        appliedTariff = tariffPerUnit;
    } else if (tariffPerUnit < 0) {
        const subsidy = Math.abs(tariffPerUnit) * batchMultiplier;
        if ((res.silver || 0) >= subsidy) {
            outlay -= Math.abs(tariffPerUnit);
            appliedTariff = tariffPerUnit;
        } else {
            logs.push(`Treasury empty, cannot pay export tariff subsidy for ${RESOURCES[resourceKey]?.name || resourceKey}!`);
        }
    }

    appliedTax += appliedTariff;

    const profit = revenue - outlay;
    const effectiveProfit = profit * tradeEfficiencyMultiplier;
    const profitMargin = outlay > 0 ? effectiveProfit / outlay : (effectiveProfit > 0 ? Infinity : -Infinity);

    if (profitMargin < tradeConfig.minProfitMargin) {
        return { success: false };
    }

    const totalAmount = amount * batchMultiplier;
    const totalOutlay = outlay * batchMultiplier;

    if ((wealth.merchant || 0) < totalOutlay) return { success: false };
    if ((res[resourceKey] || 0) < totalAmount) return { success: false };

    // [REFACTORED] Use Ledger for transactions
    // 1. Pay Base Cost (to Void/Market)
    const baseCost = cost * batchMultiplier;
    if (ledger) {
        ledger.transfer('merchant', 'void', baseCost, TRANSACTION_CATEGORIES.EXPENSE.TRADE_EXPORT, TRANSACTION_CATEGORIES.EXPENSE.TRADE_EXPORT);
    }
    roleExpense.merchant = (roleExpense.merchant || 0) + baseCost;

    // 2. Pay Base Tax (Resource Tax)
    const baseTaxPaid = cost * baseRate * batchMultiplier;
    if (baseTaxPaid > 0) {
        if (ledger) ledger.transfer('merchant', 'state', baseTaxPaid, TRANSACTION_CATEGORIES.EXPENSE.RESOURCE_TAX, TRANSACTION_CATEGORIES.EXPENSE.RESOURCE_TAX);
        roleExpense.merchant = (roleExpense.merchant || 0) + baseTaxPaid;
    } else if (baseTaxPaid < 0) {
        // Subsidy logic checks treasury
        const subsidy = Math.abs(baseTaxPaid);
        if ((res.silver || 0) >= subsidy) {
            if (ledger) ledger.transfer('state', 'merchant', subsidy, TRANSACTION_CATEGORIES.INCOME.SUBSIDY, TRANSACTION_CATEGORIES.INCOME.SUBSIDY);
        }
    }

    // 3. Pay Tariff
    const tariffPaid = appliedTariff * batchMultiplier;
    if (tariffPaid > 0) {
        if (ledger) ledger.transfer('merchant', 'state', tariffPaid, TRANSACTION_CATEGORIES.EXPENSE.TARIFF, TRANSACTION_CATEGORIES.EXPENSE.TARIFF);
        roleExpense.merchant = (roleExpense.merchant || 0) + tariffPaid;
    } else if (tariffPaid < 0) {
        const subsidy = Math.abs(tariffPaid);
        if ((res.silver || 0) >= subsidy) {
            if (ledger) ledger.transfer('state', 'merchant', subsidy, TRANSACTION_CATEGORIES.INCOME.SUBSIDY, TRANSACTION_CATEGORIES.INCOME.SUBSIDY);
            // Manual detail tracking for tariff subsidy
            taxBreakdown.tariffSubsidy = (taxBreakdown.tariffSubsidy || 0) + subsidy;
        }
    }

    // Profit recording handled in classFinancialData by Ledger automatically?
    // Wait, ledger records Income/Expense.
    // Export PROFIT is not an explicit transaction here.
    // Revenue is realized when trade completes (in simulateMerchantTrade main loop).
    // Here we only record Expenses (Outlay).
    // Ledger updates classFinancialData expenses.

    res[resourceKey] = Math.max(0, (res[resourceKey] || 0) - totalAmount);
    supply[resourceKey] = Math.max(0, (supply[resourceKey] || 0) - totalAmount);

    // NEW: Track export to demandBreakdown for UI display
    if (demandBreakdown) {
        if (!demandBreakdown[resourceKey]) {
            demandBreakdown[resourceKey] = { buildings: {}, pop: 0, exports: 0 };
        }
        demandBreakdown[resourceKey].exports = (demandBreakdown[resourceKey].exports || 0) + totalAmount;
    }

    return {
        success: true,
        outlay: totalOutlay,
        trade: {
            type: 'export',
            partnerId,
            resource: resourceKey,
            amount: totalAmount,
            revenue: revenue * batchMultiplier,
            profit: effectiveProfit * batchMultiplier,
            daysRemaining: tradeConfig.tradeDuration,
            capitalLocked: totalOutlay,
            count: 1 // Initialize count for merge tracking
        }
    };
};

const executeImportTradeV2 = ({
    ledger, // [REFACTORED]
    partner,
    partnerId,
    resourceKey,
    wealthForThisBatch,
    batchMultiplier,
    wealth,
    res,
    taxBreakdown,
    tradeConfig,
    tradeEfficiencyMultiplier = 1,
    getLocalPrice,
    foreignUnitPrice,
    getResourceTaxRate,
    roleExpense,
    classFinancialData,
    taxPolicies,
    logs,
}) => {
    const localPrice = getLocalPrice(resourceKey);
    const foreignPrice = foreignUnitPrice;

    if (foreignPrice === null || localPrice === null || foreignPrice >= localPrice) {
        return { success: false };
    }

    // Partner availability: don't buy more than their surplus buffer.
    const status = calculateTradeStatus(resourceKey, partner, 0);
    const partnerOffer = Math.max(10, (status?.surplusAmount || 0) + (status?.target || 0) * 0.05);

    // FIX: Import Tariffs should be calculated on the Import Value (Foreign Price), not Local Price.
    // FIX: Imports should NOT pay Industry Tax (which is for local production).

    // Retrieve separate rates
    const baseRate = taxPolicies?.resourceTaxRates?.[resourceKey] || 0;
    const tariffRate = taxPolicies?.importTariffMultipliers?.[resourceKey] ?? taxPolicies?.resourceTariffMultipliers?.[resourceKey] ?? 0;

    // Calculate costs
    const unitCost = foreignPrice;
    const affordableAmount = unitCost > 0 ? wealthForThisBatch / (unitCost * (1 + Math.max(0, tariffRate))) : 0;
    const amount = Math.min(tradeConfig.maxPurchaseAmount, affordableAmount, partnerOffer);

    if (amount <= 0.1) return { success: false };

    const importCost = foreignPrice * amount; // Cost paid to foreigner
    const tariff = importCost * tariffRate;   // Tariff paid to state

    // Total cost to merchant
    const totalCostToMerchant = importCost + tariff;

    // Gross revenue from selling in local market
    const grossRevenue = localPrice * amount;

    // Net profit
    const profit = grossRevenue - totalCostToMerchant;
    const effectiveProfit = profit * tradeEfficiencyMultiplier;
    const profitMargin = totalCostToMerchant > 0 ? effectiveProfit / totalCostToMerchant : (effectiveProfit > 0 ? Infinity : -Infinity);

    if (profitMargin < tradeConfig.minProfitMargin) {
        return { success: false };
    }

    const totalAmount = amount * batchMultiplier;
    const totalImportCost = importCost * batchMultiplier;
    const totalTariff = tariff * batchMultiplier;
    const totalCost = totalCostToMerchant * batchMultiplier;

    if ((wealth.merchant || 0) < totalCost) return { success: false };

    // [REFACTORED] Use Ledger
    // 1. Pay Foreigner (Import Cost)
    const importCostValue = totalImportCost;
    if (ledger) {
        ledger.transfer('merchant', 'void', importCostValue, TRANSACTION_CATEGORIES.EXPENSE.TRADE_IMPORT, TRANSACTION_CATEGORIES.EXPENSE.TRADE_IMPORT);
    }
    roleExpense.merchant = (roleExpense.merchant || 0) + importCostValue;

    // 2. Pay Tariff
    const tariffValue = totalTariff;
    if (tariffValue > 0) {
        if (ledger) ledger.transfer('merchant', 'state', tariffValue, TRANSACTION_CATEGORIES.EXPENSE.TARIFF, TRANSACTION_CATEGORIES.EXPENSE.TARIFF);
        roleExpense.merchant = (roleExpense.merchant || 0) + tariffValue;
    } else if (tariffValue < 0) {
        // Subsidy logic
        const subsidyRaw = Math.abs(tariffValue);
        // Check treasury
        if ((res.silver || 0) >= subsidyRaw) {
            if (ledger) ledger.transfer('state', 'merchant', subsidyRaw, TRANSACTION_CATEGORIES.INCOME.SUBSIDY, TRANSACTION_CATEGORIES.INCOME.SUBSIDY);
            taxBreakdown.tariffSubsidy = (taxBreakdown.tariffSubsidy || 0) + subsidyRaw;

            // Refund subsidy to merchant logic handled by ledger (transfer state->merchant)
            // But roleExpense logic in original was: expense += totalCost (includes negative tariff?), then expense -= subsidy.
            // Let's trace: totalCost = importCost + tariff.
            // If tariff is -100, totalCost = importCost - 100.
            // We deducted totalCost (small amount) initially?
            // Original code: `wealth.merchant -= totalCost`.
            // Then `wealth.merchant += subsidyRaw`.
            // Net change: wealth -= (importCost - subsidy) + subsidy = importCost.
            // Wait, if tariff is negative subsidy, cost is LOWER.
            // `totalCost` calculation at line 837: `importCost + tariff`. (tariff is negative).
            // So totalCost is already reduced.
            // BUT original code line 858: `wealth.merchant += subsidyRaw`.
            // This suggests double counting? Or correcting?
            // "Refund subsidy to merchant (reducing their effective cost)" comment.
            // If `totalCost` already included negative tariff, then wealth deduction was small.
            // Adding subsidy again makes wealth reduction even smaller (or positive gain?).
            // This looks like a bug in original code or I misunderstand `totalCost`.
            // `totalCost = importCost + tariff`.
            // If import=1000, tariff=-200. totalCost=800.
            // wealth -= 800.
            // wealth += 200.
            // Net wealth -= 600.
            // Effective subsidy = 400?
            // This implies the subsidy is applied TWICE.

            // Let's assume standard logic: Pay full import cost, Receive subsidy.
            // My Ledger implementation:
            // 1. Pay Import Cost (Full).
            // 2. Receive Subsidy.
            // Net: Wealth -= ImportCost. Wealth += Subsidy.
            // Net: Wealth -= (ImportCost - Subsidy).
            // This is correct.

            // My `importCostValue` is `totalImportCost` (line 835: `importCost * batchMultiplier`).
            // It does NOT include tariff.
            // So Ledger logic:
            // Transfer `importCost` to Void.
            // Transfer `subsidy` from State to Merchant.

            // This matches economic reality.

            // Note: `roleExpense` tracking should reflect Net Expense.
            roleExpense.merchant = (roleExpense.merchant || 0) - subsidyRaw;
        } else {
            logs.push(`Treasury empty, cannot pay import subsidy for ${RESOURCES[resourceKey]?.name || resourceKey}!`);
        }
    }
    return {
        success: true,
        cost: totalCost,
        trade: {
            type: 'import',
            partnerId,
            resource: resourceKey,
            amount: totalAmount,
            revenue: grossRevenue * batchMultiplier,
            profit: effectiveProfit * batchMultiplier,
            daysRemaining: tradeConfig.tradeDuration,
            capitalLocked: totalCost,
            count: 1 // Initialize count for merge tracking
        }
    };
};

// --- legacy executeExportTrade / executeImportTrade remain below for reference

/**
 * Execute an export trade
 * @private
 */
const executeExportTrade = ({
    exportableResources,
    wealthForThisBatch,
    batchMultiplier,
    wealth,
    res,
    supply,
    taxBreakdown,
    tradeConfig,
    getLocalPrice,
    getForeignPrice,
    getResourceTaxRate,
    roleWagePayout,
    applyForeignInventoryDeltaAll,
    classFinancialData,
    taxPolicies, // Added for detailed financial tracking
    tick,
    logs
}) => {
    const resourceKey = exportableResources[Math.floor(Math.random() * exportableResources.length)];
    const localPrice = getLocalPrice(resourceKey);
    const foreignPrice = getForeignPrice(resourceKey);

    if (foreignPrice === null || localPrice === null || foreignPrice <= localPrice) {
        return { success: false };
    }

    const taxRate = getResourceTaxRate(resourceKey);
    const costWithTaxPerUnit = localPrice * (1 + taxRate);

    const affordableAmount = costWithTaxPerUnit > 0 ? wealthForThisBatch / costWithTaxPerUnit : 3;
    const availableStock = (res[resourceKey] || 0) / batchMultiplier;
    const maxInventory = availableStock * tradeConfig.maxInventoryRatio;

    const amount = Math.min(
        tradeConfig.maxPurchaseAmount,
        affordableAmount,
        maxInventory
    );

    if (amount <= 0.1) return { success: false };

    const cost = localPrice * amount;
    const tax = cost * taxRate;
    const revenue = foreignPrice * amount;

    let outlay = cost;
    let appliedTax = 0;

    if (tax < 0) {
        // Subsidy
        const subsidyAmount = Math.abs(tax);
        if ((res.silver || 0) >= subsidyAmount * batchMultiplier) {
            outlay -= subsidyAmount;
            appliedTax = -subsidyAmount;
        } else {
            logs.push(`Treasury empty, cannot pay export subsidy for ${RESOURCES[resourceKey]?.name || resourceKey}!`);
        }
    } else {
        outlay += tax;
        appliedTax = tax;
    }

    const baseRate = taxPolicies?.resourceTaxRates?.[resourceKey] || 0;
    const tariffRate = taxPolicies?.exportTariffMultipliers?.[resourceKey] ?? taxPolicies?.resourceTariffMultipliers?.[resourceKey] ?? 0;
    const tariffPerUnit = cost * tariffRate;
    let appliedTariff = 0;

    if (tariffPerUnit > 0) {
        outlay += tariffPerUnit;
        appliedTariff = tariffPerUnit;
    } else if (tariffPerUnit < 0) {
        const subsidy = Math.abs(tariffPerUnit) * batchMultiplier;
        if ((res.silver || 0) >= subsidy) {
            outlay -= Math.abs(tariffPerUnit);
            appliedTariff = tariffPerUnit;
        } else {
            logs.push(`Treasury empty, cannot pay export tariff subsidy for ${RESOURCES[resourceKey]?.name || resourceKey}!`);
        }
    }

    appliedTax += appliedTariff;

    const profit = revenue - outlay;
    const profitMargin = outlay > 0 ? profit / outlay : (profit > 0 ? Infinity : -Infinity);

    if (profitMargin >= tradeConfig.minProfitMargin) {
        const totalAmount = amount * batchMultiplier;
        const totalOutlay = outlay * batchMultiplier;
        const totalAppliedTax = appliedTax * batchMultiplier;

        if ((wealth.merchant || 0) >= totalOutlay && (res[resourceKey] || 0) >= totalAmount) {
            wealth.merchant -= totalOutlay;

            // Separate tariff from base transaction tax for taxBreakdown
            // Tariff rate is now used directly as percentage (1 = 100% tariff)
            const baseTaxPaid = cost * baseRate * batchMultiplier;
            const tariffPaid = appliedTariff * batchMultiplier;
            // DEBUG: 调试关税
            console.log('[EXPORT TRADE DEBUG]', resourceKey, {
                tariffRate,
                tariffPaid,
                cost,
                batchMultiplier,
                'taxPolicies?.exportTariffMultipliers': taxPolicies?.exportTariffMultipliers,
            });

            // 记录关税（无论总税收正负，关税都要独立记录）
            if (tariffPaid > 0) {
                taxBreakdown.tariff = (taxBreakdown.tariff || 0) + tariffPaid;
            } else if (tariffPaid < 0) {
                // Negative tariff = export subsidy, record separately
                const subsidy = Math.abs(tariffPaid);
                if ((res.silver || 0) >= subsidy) {
                    applyTreasuryChange(res, -subsidy, 'expense_export_tariff_subsidy', onTreasuryChange);
                    taxBreakdown.tariffSubsidy = (taxBreakdown.tariffSubsidy || 0) + subsidy;
                }
            }

            // 记录基础交易税和补贴
            if (totalAppliedTax < 0) {
                // 总税为负 = 补贴大于税收，从国库支付补贴
                const subsidy = Math.abs(totalAppliedTax);
                applyTreasuryChange(res, -subsidy, 'expense_export_trade_subsidy', onTreasuryChange);
                taxBreakdown.subsidy += subsidy;
            } else {
                // 总税为正，记录基础交易税到industryTax
                if (baseTaxPaid > 0) {
                    taxBreakdown.industryTax += baseTaxPaid;
                }
            }

            // [Detailed Financials]
            if (classFinancialData && classFinancialData.merchant) {
                const totalTaxPaid = (cost * taxRate + appliedTariff) * batchMultiplier;

                if (Math.abs(tariffPaid) > 0.001) {
                    classFinancialData.merchant.expense.tariffs = (classFinancialData.merchant.expense.tariffs || 0) + tariffPaid;
                    const remainingTax = totalTaxPaid - tariffPaid;
                    if (remainingTax > 0) classFinancialData.merchant.expense.transactionTax = (classFinancialData.merchant.expense.transactionTax || 0) + remainingTax;
                } else {
                    if (totalTaxPaid > 0) classFinancialData.merchant.expense.transactionTax = (classFinancialData.merchant.expense.transactionTax || 0) + totalTaxPaid;
                }

                if (profit > 0) {
                    classFinancialData.merchant.income.ownerRevenue = (classFinancialData.merchant.income.ownerRevenue || 0) + profit * batchMultiplier;
                }

                const subsidy = totalAppliedTax < 0 ? Math.abs(totalAppliedTax) : 0;
                if (subsidy > 0) {
                    classFinancialData.merchant.income.subsidy = (classFinancialData.merchant.income.subsidy || 0) + subsidy;
                }
            }

            res[resourceKey] = Math.max(0, (res[resourceKey] || 0) - totalAmount);
            supply[resourceKey] = Math.max(0, (supply[resourceKey] || 0) - totalAmount);

            return {
                success: true,
                outlay: totalOutlay,
                trade: {
                    type: 'export',
                    resource: resourceKey,
                    amount: totalAmount,
                    revenue: revenue * batchMultiplier,
                    profit: profit * batchMultiplier,
                    daysRemaining: 3,
                    capitalLocked: totalOutlay
                }
            };
        }
    }

    return { success: false };
};

/**
 * Execute an import trade
 * @private
 */
const executeImportTrade = ({
    importableResources,
    wealthForThisBatch,
    batchMultiplier,
    wealth,
    res,
    taxBreakdown,
    tradeConfig,
    getLocalPrice,
    getForeignPrice,
    getResourceTaxRate,
    roleExpense,
    applyForeignInventoryDeltaAll,
    classFinancialData,
    taxPolicies,
    tick,
    logs
}) => {
    const resourceKey = importableResources[Math.floor(Math.random() * importableResources.length)];
    const localPrice = getLocalPrice(resourceKey);
    const foreignPrice = getForeignPrice(resourceKey);

    if (foreignPrice === null || localPrice === null || foreignPrice >= localPrice) {
        return { success: false };
    }

    const taxRate = getResourceTaxRate(resourceKey);
    const totalPerUnitCost = foreignPrice;
    const affordableAmount = totalPerUnitCost > 0 ? wealthForThisBatch / totalPerUnitCost : 3;
    const amount = Math.min(tradeConfig.maxPurchaseAmount, affordableAmount);

    if (amount <= 0.1) return { success: false };

    const cost = foreignPrice * amount;
    const grossRevenue = localPrice * amount;
    const tax = grossRevenue * taxRate;

    let netRevenue = grossRevenue;
    let appliedTax = 0;

    if (tax < 0) {
        // Subsidy
        const subsidyAmount = Math.abs(tax);
        if ((res.silver || 0) >= subsidyAmount * batchMultiplier) {
            netRevenue += subsidyAmount;
            appliedTax = -subsidyAmount;
        } else {
            logs.push(`Treasury empty, cannot pay import subsidy for ${RESOURCES[resourceKey]?.name || resourceKey}!`);
        }
    } else {
        netRevenue -= tax;
        appliedTax = tax;
    }

    const baseRate = taxPolicies?.resourceTaxRates?.[resourceKey] || 0;
    const tariffRate = taxPolicies?.importTariffMultipliers?.[resourceKey] ?? taxPolicies?.resourceTariffMultipliers?.[resourceKey] ?? 0;
    const tariffPerUnit = localPrice * tariffRate;
    let appliedTariff = 0;

    if (tariffPerUnit > 0) {
        netRevenue -= tariffPerUnit;
        appliedTariff = tariffPerUnit;
    } else if (tariffPerUnit < 0) {
        const subsidy = Math.abs(tariffPerUnit) * batchMultiplier;
        if ((res.silver || 0) >= subsidy) {
            netRevenue += Math.abs(tariffPerUnit);
            appliedTariff = tariffPerUnit;
        } else {
            logs.push(`Treasury empty, cannot pay import tariff subsidy for ${RESOURCES[resourceKey]?.name || resourceKey}!`);
        }
    }

    appliedTax += appliedTariff;

    const profit = netRevenue - cost;
    const profitMargin = cost > 0 ? profit / cost : (profit > 0 ? Infinity : -Infinity);

    if (profitMargin >= tradeConfig.minProfitMargin) {
        const totalAmount = amount * batchMultiplier;
        const totalCost = cost * batchMultiplier;
        const totalNetRevenue = netRevenue * batchMultiplier;
        const totalAppliedTax = appliedTax * batchMultiplier;

        if ((wealth.merchant || 0) >= totalCost) {
            wealth.merchant -= totalCost;
            roleExpense.merchant = (roleExpense.merchant || 0) + totalCost;
            applyForeignInventoryDeltaAll(resourceKey, -totalAmount);

            // Separate tariff from base transaction tax for taxBreakdown
            // Tariff rate is now used directly as percentage (1 = 100% tariff)
            const baseTaxPaid = grossRevenue * baseRate * batchMultiplier;
            const tariffPaid = appliedTariff * batchMultiplier;

            // 记录关税（无论总税收正负，关税都要独立记录）
            if (tariffPaid > 0) {
                taxBreakdown.tariff = (taxBreakdown.tariff || 0) + tariffPaid;
            } else if (tariffPaid < 0) {
                // Negative tariff = import subsidy, record separately
                const subsidy = Math.abs(tariffPaid);
                if ((res.silver || 0) >= subsidy) {
                    applyTreasuryChange(res, -subsidy, 'expense_import_tariff_subsidy', onTreasuryChange);
                    taxBreakdown.tariffSubsidy = (taxBreakdown.tariffSubsidy || 0) + subsidy;
                }
            }

            // 记录基础交易税和补贴
            if (totalAppliedTax < 0) {
                // 总税为负 = 补贴大于税收，从国库支付补贴
                const subsidy = Math.abs(totalAppliedTax);
                applyTreasuryChange(res, -subsidy, 'expense_import_trade_subsidy', onTreasuryChange);
                taxBreakdown.subsidy += subsidy;
            } else {
                // 总税为正，记录基础交易税到industryTax
                if (baseTaxPaid > 0) {
                    taxBreakdown.industryTax += baseTaxPaid;
                }
            }

            // [Detailed Financials]
            if (classFinancialData && classFinancialData.merchant) {
                const totalTaxPaid = (grossRevenue * taxRate + appliedTariff) * batchMultiplier;

                if (Math.abs(tariffPaid) > 0.001) {
                    classFinancialData.merchant.expense.tariffs = (classFinancialData.merchant.expense.tariffs || 0) + tariffPaid;
                    const remainingTax = totalTaxPaid - tariffPaid;
                    if (remainingTax > 0) classFinancialData.merchant.expense.transactionTax = (classFinancialData.merchant.expense.transactionTax || 0) + remainingTax;
                } else {
                    if (totalTaxPaid > 0) classFinancialData.merchant.expense.transactionTax = (classFinancialData.merchant.expense.transactionTax || 0) + totalTaxPaid;
                }

                const profit = totalNetRevenue - totalCost;
                if (profit > 0) {
                    classFinancialData.merchant.income.ownerRevenue = (classFinancialData.merchant.income.ownerRevenue || 0) + profit;
                }

                const subsidy = totalAppliedTax < 0 ? Math.abs(totalAppliedTax) : 0;
                if (subsidy > 0) {
                    classFinancialData.merchant.income.subsidy = (classFinancialData.merchant.income.subsidy || 0) + subsidy;
                }
            }

            return {
                success: true,
                cost: totalCost,
                trade: {
                    type: 'import',
                    resource: resourceKey,
                    amount: totalAmount,
                    revenue: totalNetRevenue,
                    profit: totalNetRevenue - totalCost,
                    daysRemaining: 3,
                    capitalLocked: totalCost
                }
            };
        }
    }

    return { success: false };
};
