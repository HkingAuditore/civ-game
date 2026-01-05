/**
 * Merchant Trading System
 * Handles merchant trade simulation including import/export logic
 */

import { STRATA, RESOURCES } from '../../config';
import { calculateForeignPrice, calculateTradeStatus } from '../../utils/foreignTrade';
import { isTradableResource } from '../utils/helpers';
import { debugLog } from '../../utils/debugFlags';

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
    idleTradeEfficiency: 0.15, // fallback when no assignments exist (keeps old saves alive)
    maxPartnersPerTick: 4,
    maxResourcesScoredPerPartner: 10,
    shortageWeight: 2.2,
    surplusWeight: 1.3,
};

// --- Trade 2.0 helpers -------------------------------------------------

const clamp01 = (v) => Math.max(0, Math.min(1, v));

const safeNumber = (v, fallback = 0) => (Number.isFinite(v) ? v : fallback);

const pickTopN = (items = [], n = 10) => {
    if (!Array.isArray(items) || items.length === 0) return [];
    const sorted = [...items].sort((a, b) => (b?.score || 0) - (a?.score || 0));
    return sorted.slice(0, Math.max(0, n));
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

const normalizeMerchantAssignments = ({ merchantAssignments, nations }) => {
    if (!merchantAssignments || typeof merchantAssignments !== 'object') return null;
    const normalized = {};
    Object.entries(merchantAssignments).forEach(([nationId, value]) => {
        const count = Math.max(0, Math.floor(Number(value) || 0));
        if (count <= 0) return;
        const exists = Array.isArray(nations) ? nations.some(n => n?.id === nationId) : true;
        if (!exists) return;
        normalized[nationId] = count;
    });
    return Object.keys(normalized).length > 0 ? normalized : null;
};

const buildDefaultAssignments = ({ nations, maxPartners }) => {
    const visible = Array.isArray(nations) ? nations.filter(n => n && !n.isRebelNation) : [];
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

const scoreImportCandidate = ({ resourceKey, partner, tick, getLocalPrice, res, demand, tradeConfig, merchantTradePreferences }) => {
    const localPrice = getLocalPrice(resourceKey);
    const foreignPrice = getForeignUnitPrice({ resourceKey, partner, tick });
    if (localPrice == null || foreignPrice == null) return null;

    // Import if foreign is cheaper.
    const priceAdv = (localPrice - foreignPrice) / Math.max(0.0001, localPrice);
    if (priceAdv <= 0) return null;

    const shortage = computeResourceShortageFactor({ resourceKey, res, demand, marketPrice: localPrice });

    // Partner availability: use tradeStatus to avoid buying from a partner that is short.
    const status = calculateTradeStatus(resourceKey, partner, tick);
    const partnerSurplus = status?.surplusAmount ? Math.min(1, status.surplusAmount / Math.max(50, status.target || 1)) : 0;

    const baseScore =
        tradeConfig.shortageWeight * shortage +
        1.0 * priceAdv +
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

const scoreExportCandidate = ({ resourceKey, partner, tick, getLocalPrice, res, supply, tradeConfig, merchantTradePreferences }) => {
    const localPrice = getLocalPrice(resourceKey);
    const foreignPrice = getForeignUnitPrice({ resourceKey, partner, tick });
    if (localPrice == null || foreignPrice == null) return null;

    // Export if partner pays more.
    const priceAdv = (foreignPrice - localPrice) / Math.max(0.0001, localPrice);
    if (priceAdv <= 0) return null;

    const availableStock = safeNumber(res?.[resourceKey], 0);
    if (availableStock <= 0) return null;

    const surplus = computeResourceSurplusFactor({ resourceKey, res, supply, marketPrice: localPrice });

    // Partner shortage: prefer exporting to partners that are short.
    const status = calculateTradeStatus(resourceKey, partner, tick);
    const partnerShortage = status?.shortageAmount ? Math.min(1, status.shortageAmount / Math.max(50, status.target || 1)) : 0;

    const baseScore =
        tradeConfig.surplusWeight * surplus +
        1.0 * priceAdv +
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
 * Simulate merchant trading for one tick
 * @param {Object} params - Trading parameters
 * @returns {Object} Updated merchant state
 */
export const simulateMerchantTrade = ({
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
}) => {
    const merchantCount = popStructure?.merchant || 0;
    if (merchantCount <= 0) {
        return { pendingTrades, lastTradeTime, lockedCapital: 0, capitalInvestedThisTick: 0, completedTrades: [] };
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

    // Get merchant trade configuration
    const tradeConfig = STRATA.merchant?.tradeConfig || DEFAULT_TRADE_CONFIG;

    // Process pending trades (point-to-point: apply on completion)
    const updatedPendingTrades = [];
    pendingTrades.forEach(trade => {
        trade.daysRemaining -= 1;

        if (trade.daysRemaining <= 0) {
            roleWagePayout.merchant = (roleWagePayout.merchant || 0) + trade.revenue;

            if (trade.type === 'import') {
                res[trade.resource] = (res[trade.resource] || 0) + trade.amount;
                supply[trade.resource] = (supply[trade.resource] || 0) + trade.amount;

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

    // Check trade cooldown
    const ticksSinceLastTrade = tick - lastTradeTime;
    const canTradeNow = ticksSinceLastTrade >= tradeConfig.tradeCooldown;
    if (!canTradeNow) {
        return { pendingTrades: updatedPendingTrades, lastTradeTime, lockedCapital: 0, capitalInvestedThisTick: 0, completedTrades };
    }

    const tradableKeys = Object.keys(RESOURCES)
        .filter(key => isTradableResource(key))
        .filter(key => !potentialResources || potentialResources.has(key));

    // --- Trade 2.0: determine which partners are actively assigned this tick
    const normalizedAssignments = normalizeMerchantAssignments({ merchantAssignments, nations });
    const hasAssignments = tradeConfig.enableMerchantAssignments && !!normalizedAssignments;

    const assignments = hasAssignments
        ? normalizedAssignments
        : buildDefaultAssignments({ nations, maxPartners: tradeConfig.maxPartnersPerTick });

    // Convert assignments to concrete partner list, and cap partners per tick for performance.
    const partnerList = Object.entries(assignments)
        .map(([nationId, count]) => ({ nationId, count }))
        .filter(e => e.count > 0)
        .slice(0, Math.max(1, tradeConfig.maxPartnersPerTick));

    // If using fallback (no explicit assignments), reduce efficiency.
    const assignmentEfficiency = hasAssignments ? 1 : tradeConfig.idleTradeEfficiency;

    // Build a pool of "merchant batches" based on assigned counts.
    // Keep existing batching behavior for high merchant counts.
    const simCount = merchantCount > 100 ? 100 : merchantCount;
    const globalBatchMultiplier = merchantCount > 100 ? merchantCount / 100 : 1;

    // Distribute simulated batches across assigned partners proportionally.
    const totalAssigned = partnerList.reduce((sum, p) => sum + p.count, 0) || 1;

    const partnerBatches = partnerList.map(p => {
        const ratio = p.count / totalAssigned;
        const batches = Math.max(1, Math.round(simCount * ratio));
        return { ...p, batches };
    });

    // Iterate partners and execute best-scored trades.
    for (let pIndex = 0; pIndex < partnerBatches.length; pIndex++) {
        const partnerBatch = partnerBatches[pIndex];
        const partner = Array.isArray(nations) ? nations.find(n => n?.id === partnerBatch.nationId) : null;
        if (!partner) continue;
        if (isTradeBlockedWithPartner({ partner })) continue;

        // Candidate scoring (cap resources scanned for perf)
        const candidates = [];

        // Heuristic prefilter: compute local shortage/surplus lists to avoid scoring everything.
        const localShortageList = [];
        const localSurplusList = [];
        tradableKeys.forEach(resourceKey => {
            const localPrice = getLocalPrice(resourceKey);
            if (localPrice == null) return;
            const shortage = computeResourceShortageFactor({ resourceKey, res, demand, marketPrice: localPrice });
            const surplus = computeResourceSurplusFactor({ resourceKey, res, supply, marketPrice: localPrice });
            if (shortage > 0.01) localShortageList.push({ resourceKey, score: shortage });
            if (surplus > 0.01) localSurplusList.push({ resourceKey, score: surplus });
        });

        const shortageTop = pickTopN(localShortageList, tradeConfig.maxResourcesScoredPerPartner);
        const surplusTop = pickTopN(localSurplusList, tradeConfig.maxResourcesScoredPerPartner);

        shortageTop.forEach(({ resourceKey }) => {
            const c = scoreImportCandidate({
                resourceKey,
                partner,
                tick,
                getLocalPrice,
                res,
                demand,
                tradeConfig,
                merchantTradePreferences,
            });
            if (c) candidates.push(c);
        });

        surplusTop.forEach(({ resourceKey }) => {
            const c = scoreExportCandidate({
                resourceKey,
                partner,
                tick,
                getLocalPrice,
                res,
                supply,
                tradeConfig,
                merchantTradePreferences,
            });
            if (c) candidates.push(c);
        });

        if (candidates.length === 0) continue;
        candidates.sort((a, b) => b.score - a.score);

        const maxNewTradesForPartner = Math.min(12, partnerBatch.batches);

        for (let i = 0; i < maxNewTradesForPartner; i++) {
            const currentTotalWealth = wealth.merchant || 0;
            if (currentTotalWealth <= tradeConfig.minWealthForTrade) break;

            // Pick best remaining candidate; allow repeated same candidate but re-check feasibility.
            const candidate = candidates[i % candidates.length];
            if (!candidate) break;

            // Allocate wealth proportional to this partner's assignment.
            const wealthForThisBatch = (currentTotalWealth / (simCount + 1)) * assignmentEfficiency;

            if (candidate.type === 'export') {
                const result = executeExportTradeV2({
                    partner,
                    partnerId: partner.id,
                    resourceKey: candidate.resourceKey,
                    wealthForThisBatch,
                    batchMultiplier: globalBatchMultiplier,
                    wealth,
                    res,
                    supply,
                    taxBreakdown,
                    tradeConfig,
                    getLocalPrice,
                    foreignUnitPrice: candidate.foreignPrice,
                    getResourceTaxRate: getExportTaxRate,
                    roleWagePayout,
                    classFinancialData,
                    taxPolicies,
                    tick,
                    logs,
                });

                if (result.success) {
                    capitalInvestedThisTick += result.outlay;
                    updatedPendingTrades.push(result.trade);
                    lastTradeTime = tick;
                }
            } else {
                const result = executeImportTradeV2({
                    partner,
                    partnerId: partner.id,
                    resourceKey: candidate.resourceKey,
                    wealthForThisBatch,
                    batchMultiplier: globalBatchMultiplier,
                    wealth,
                    res,
                    taxBreakdown,
                    tradeConfig,
                    getLocalPrice,
                    foreignUnitPrice: candidate.foreignPrice,
                    getResourceTaxRate: getImportTaxRate,
                    roleExpense,
                    classFinancialData,
                    taxPolicies,
                    tick,
                    logs,
                });

                if (result.success) {
                    capitalInvestedThisTick += result.cost;
                    updatedPendingTrades.push(result.trade);
                    lastTradeTime = tick;
                }
            }
        }
    }

    const lockedCapital = updatedPendingTrades.reduce((sum, trade) => sum + Math.max(0, trade?.capitalLocked || 0), 0);

    return {
        pendingTrades: updatedPendingTrades,
        lastTradeTime,
        lockedCapital,
        capitalInvestedThisTick,
        completedTrades
    };
};

// --- V2 execution functions (point-to-point) ----------------------------

const executeExportTradeV2 = ({
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
    getLocalPrice,
    foreignUnitPrice,
    getResourceTaxRate,
    classFinancialData,
    taxPolicies,
    logs,
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

    const profit = revenue - outlay;
    const profitMargin = outlay > 0 ? profit / outlay : (profit > 0 ? Infinity : -Infinity);

    if (profitMargin < tradeConfig.minProfitMargin) {
        return { success: false };
    }

    const totalAmount = amount * batchMultiplier;
    const totalOutlay = outlay * batchMultiplier;
    const totalAppliedTax = appliedTax * batchMultiplier;

    if ((wealth.merchant || 0) < totalOutlay) return { success: false };
    if ((res[resourceKey] || 0) < totalAmount) return { success: false };

    wealth.merchant -= totalOutlay;

    const baseRate = taxPolicies?.resourceTaxRates?.[resourceKey] || 0;
    const tariffRate = taxPolicies?.exportTariffMultipliers?.[resourceKey] ?? taxPolicies?.resourceTariffMultipliers?.[resourceKey] ?? 0;
    const baseTaxPaid = cost * baseRate * batchMultiplier;
    const tariffPaid = cost * tariffRate * batchMultiplier;

    if (tariffPaid > 0) {
        taxBreakdown.tariff = (taxBreakdown.tariff || 0) + tariffPaid;
    } else if (tariffPaid < 0) {
        taxBreakdown.tariffSubsidy = (taxBreakdown.tariffSubsidy || 0) + Math.abs(tariffPaid);
    }

    if (totalAppliedTax < 0) {
        const subsidy = Math.abs(totalAppliedTax);
        res.silver -= subsidy;
        taxBreakdown.subsidy += subsidy;
    } else {
        if (baseTaxPaid > 0) {
            taxBreakdown.industryTax += baseTaxPaid;
        }
    }

    if (classFinancialData && classFinancialData.merchant) {
        const totalTaxPaid = cost * taxRate * batchMultiplier;
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
            partnerId,
            resource: resourceKey,
            amount: totalAmount,
            revenue: revenue * batchMultiplier,
            profit: profit * batchMultiplier,
            daysRemaining: tradeConfig.tradeDuration,
            capitalLocked: totalOutlay
        }
    };
};

const executeImportTradeV2 = ({
    partner,
    partnerId,
    resourceKey,
    wealthForThisBatch,
    batchMultiplier,
    wealth,
    res,
    taxBreakdown,
    tradeConfig,
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

    const taxRate = getResourceTaxRate(resourceKey);
    const totalPerUnitCost = foreignPrice;
    const affordableAmount = totalPerUnitCost > 0 ? wealthForThisBatch / totalPerUnitCost : 0;
    const amount = Math.min(tradeConfig.maxPurchaseAmount, affordableAmount, partnerOffer);

    if (amount <= 0.1) return { success: false };

    const cost = foreignPrice * amount;
    const grossRevenue = localPrice * amount;
    const tax = grossRevenue * taxRate;

    let netRevenue = grossRevenue;
    let appliedTax = 0;

    if (tax < 0) {
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

    const profit = netRevenue - cost;
    const profitMargin = cost > 0 ? profit / cost : (profit > 0 ? Infinity : -Infinity);

    if (profitMargin < tradeConfig.minProfitMargin) {
        return { success: false };
    }

    const totalAmount = amount * batchMultiplier;
    const totalCost = cost * batchMultiplier;
    const totalNetRevenue = netRevenue * batchMultiplier;
    const totalAppliedTax = appliedTax * batchMultiplier;

    if ((wealth.merchant || 0) < totalCost) return { success: false };

    wealth.merchant -= totalCost;
    roleExpense.merchant = (roleExpense.merchant || 0) + totalCost;

    const baseRate = taxPolicies?.resourceTaxRates?.[resourceKey] || 0;
    const tariffRate = taxPolicies?.importTariffMultipliers?.[resourceKey] ?? taxPolicies?.resourceTariffMultipliers?.[resourceKey] ?? 0;
    const baseTaxPaid = grossRevenue * baseRate * batchMultiplier;
    const tariffPaid = grossRevenue * tariffRate * batchMultiplier;

    if (tariffPaid > 0) {
        taxBreakdown.tariff = (taxBreakdown.tariff || 0) + tariffPaid;
    } else if (tariffPaid < 0) {
        taxBreakdown.tariffSubsidy = (taxBreakdown.tariffSubsidy || 0) + Math.abs(tariffPaid);
    }

    if (totalAppliedTax < 0) {
        const subsidy = Math.abs(totalAppliedTax);
        res.silver -= subsidy;
        taxBreakdown.subsidy += subsidy;
    } else {
        if (baseTaxPaid > 0) {
            taxBreakdown.industryTax += baseTaxPaid;
        }
    }

    if (classFinancialData && classFinancialData.merchant) {
        const totalTaxPaid = grossRevenue * taxRate * batchMultiplier;
        if (Math.abs(tariffPaid) > 0.001) {
            classFinancialData.merchant.expense.tariffs = (classFinancialData.merchant.expense.tariffs || 0) + tariffPaid;
            const remainingTax = totalTaxPaid - tariffPaid;
            if (remainingTax > 0) classFinancialData.merchant.expense.transactionTax = (classFinancialData.merchant.expense.transactionTax || 0) + remainingTax;
        } else {
            if (totalTaxPaid > 0) classFinancialData.merchant.expense.transactionTax = (classFinancialData.merchant.expense.transactionTax || 0) + totalTaxPaid;
        }

        const p = totalNetRevenue - totalCost;
        if (p > 0) {
            classFinancialData.merchant.income.ownerRevenue = (classFinancialData.merchant.income.ownerRevenue || 0) + p;
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
            partnerId,
            resource: resourceKey,
            amount: totalAmount,
            revenue: totalNetRevenue,
            profit: totalNetRevenue - totalCost,
            daysRemaining: tradeConfig.tradeDuration,
            capitalLocked: totalCost
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

    const profit = revenue - outlay;
    const profitMargin = outlay > 0 ? profit / outlay : (profit > 0 ? Infinity : -Infinity);

    if (profitMargin >= tradeConfig.minProfitMargin) {
        const totalAmount = amount * batchMultiplier;
        const totalOutlay = outlay * batchMultiplier;
        const totalAppliedTax = appliedTax * batchMultiplier;

        if ((wealth.merchant || 0) >= totalOutlay && (res[resourceKey] || 0) >= totalAmount) {
            wealth.merchant -= totalOutlay;

            // Separate tariff from base transaction tax for taxBreakdown
            const baseRate = taxPolicies?.resourceTaxRates?.[resourceKey] || 0;
            const tariffRate = taxPolicies?.exportTariffMultipliers?.[resourceKey] ?? taxPolicies?.resourceTariffMultipliers?.[resourceKey] ?? 0;
            // Tariff rate is now used directly as percentage (1 = 100% tariff)
            const baseTaxPaid = cost * baseRate * batchMultiplier;
            const tariffPaid = cost * tariffRate * batchMultiplier;
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
                taxBreakdown.tariffSubsidy = (taxBreakdown.tariffSubsidy || 0) + Math.abs(tariffPaid);
            }

            // 记录基础交易税和补贴
            if (totalAppliedTax < 0) {
                // 总税为负 = 补贴大于税收，从国库支付补贴
                const subsidy = Math.abs(totalAppliedTax);
                res.silver -= subsidy;
                taxBreakdown.subsidy += subsidy;
            } else {
                // 总税为正，记录基础交易税到industryTax
                if (baseTaxPaid > 0) {
                    taxBreakdown.industryTax += baseTaxPaid;
                }
            }

            // [Detailed Financials]
            if (classFinancialData && classFinancialData.merchant) {
                const totalTaxPaid = cost * taxRate * batchMultiplier;

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
            const baseRate = taxPolicies?.resourceTaxRates?.[resourceKey] || 0;
            const tariffRate = taxPolicies?.importTariffMultipliers?.[resourceKey] ?? taxPolicies?.resourceTariffMultipliers?.[resourceKey] ?? 0;
            // Tariff rate is now used directly as percentage (1 = 100% tariff)
            const baseTaxPaid = grossRevenue * baseRate * batchMultiplier;
            const tariffPaid = grossRevenue * tariffRate * batchMultiplier;

            // 记录关税（无论总税收正负，关税都要独立记录）
            if (tariffPaid > 0) {
                taxBreakdown.tariff = (taxBreakdown.tariff || 0) + tariffPaid;
            } else if (tariffPaid < 0) {
                // Negative tariff = import subsidy, record separately
                taxBreakdown.tariffSubsidy = (taxBreakdown.tariffSubsidy || 0) + Math.abs(tariffPaid);
            }

            // 记录基础交易税和补贴
            if (totalAppliedTax < 0) {
                // 总税为负 = 补贴大于税收，从国库支付补贴
                const subsidy = Math.abs(totalAppliedTax);
                res.silver -= subsidy;
                taxBreakdown.subsidy += subsidy;
            } else {
                // 总税为正，记录基础交易税到industryTax
                if (baseTaxPaid > 0) {
                    taxBreakdown.industryTax += baseTaxPaid;
                }
            }

            // [Detailed Financials]
            if (classFinancialData && classFinancialData.merchant) {
                const totalTaxPaid = grossRevenue * taxRate * batchMultiplier;

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
