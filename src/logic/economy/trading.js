/**
 * Merchant Trading System
 * Handles merchant trade simulation including import/export logic
 */

import { STRATA, RESOURCES } from '../../config';
import { calculateForeignPrice } from '../../utils/foreignTrade';
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
    enableDebugLog: false
};

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

    classFinancialData, // NEW: detailed tracking
    logs,
    potentialResources,
}) => {
    const merchantCount = popStructure?.merchant || 0;
    if (merchantCount <= 0) {
        return { pendingTrades, lastTradeTime, lockedCapital: 0, capitalInvestedThisTick: 0, completedTrades: [] };
    }
    let capitalInvestedThisTick = 0;
    const completedTrades = []; // Track completed trades for logging

    const resourceTaxRates = taxPolicies?.resourceTaxRates || {};
    const importTariffMultipliers = taxPolicies?.importTariffMultipliers || taxPolicies?.resourceTariffMultipliers || {};
    const exportTariffMultipliers = taxPolicies?.exportTariffMultipliers || taxPolicies?.resourceTariffMultipliers || {};
    // 获取有效税率：基础交易税率 + 关税率（关税现在独立于交易税）
    // 交易税率：0.1 = 10%交易税
    // 关税倍率：1 = 100%关税（0无关税，<0补贴）- 现在直接作为百分比使用
    const getImportTaxRate = (resource) => {
        const baseTaxRate = resourceTaxRates[resource] || 0;
        const tariffRate = importTariffMultipliers[resource] ?? 0; // 关税率直接作为百分比
        return baseTaxRate + tariffRate; // 加法叠加，而非乘法
    };
    const getExportTaxRate = (resource) => {
        const baseTaxRate = resourceTaxRates[resource] || 0;
        const tariffRate = exportTariffMultipliers[resource] ?? 0; // 关税率直接作为百分比
        return baseTaxRate + tariffRate; // 加法叠加，而非乘法
    };

    // Get foreign trading partners
    const foreignPartners = Array.isArray(nations)
        ? nations.filter(n => n && (n.inventory || n.economyTraits))
        : [];
    const foreignPriceCache = {};
    const applyForeignInventoryDeltaAll = (resourceKey, delta) => {
        if (foreignPartners.length === 0 || !Number.isFinite(delta) || delta === 0) return;
        const perPartner = delta / foreignPartners.length;
        foreignPartners.forEach(partner => {
            if (!partner) return;
            if (!partner.inventory) {
                partner.inventory = {};
            }
            const currentStock = partner.inventory[resourceKey] || 0;
            partner.inventory[resourceKey] = Math.max(0, currentStock + perPartner);
        });
    };

    const getForeignPrice = (resourceKey) => {
        if (foreignPriceCache[resourceKey] !== undefined) {
            return foreignPriceCache[resourceKey];
        }
        if (foreignPartners.length === 0) {
            foreignPriceCache[resourceKey] = null;
            return null;
        }
        let total = 0;
        let count = 0;
        foreignPartners.forEach(nation => {
            const price = calculateForeignPrice(resourceKey, nation, tick);
            if (Number.isFinite(price) && price > 0) {
                total += price;
                count += 1;
            }
        });
        const averaged = count > 0 ? total / count : null;
        foreignPriceCache[resourceKey] = averaged;
        return averaged;
    };

    // Get merchant trade configuration
    const tradeConfig = STRATA.merchant?.tradeConfig || DEFAULT_TRADE_CONFIG;

    // Process pending trades
    const updatedPendingTrades = [];
    pendingTrades.forEach(trade => {
        trade.daysRemaining -= 1;

        if (trade.daysRemaining <= 0) {
            // Trade complete - receive revenue
            roleWagePayout.merchant = (roleWagePayout.merchant || 0) + trade.revenue;

            if (trade.type === 'import') {
                // Import goods arrived
                res[trade.resource] = (res[trade.resource] || 0) + trade.amount;
                supply[trade.resource] = (supply[trade.resource] || 0) + trade.amount;
            } else if (trade.type === 'export') {
                applyForeignInventoryDeltaAll(trade.resource, trade.amount);
            }

            // Track completed trade for logging
            completedTrades.push({
                type: trade.type,
                resource: trade.resource,
                amount: trade.amount,
                revenue: trade.revenue,
                profit: trade.profit
            });

            if (tradeConfig.enableDebugLog) {
                debugLog('trade', `[Merchant Debug] ✅ Trade complete:`, {
                    type: trade.type === 'export' ? 'Export' : 'Import',
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
        if (tradeConfig.enableDebugLog) {
            debugLog('trade', `[Merchant Debug] ⏳ Trade cooldown: ${(tradeConfig.tradeCooldown - ticksSinceLastTrade).toFixed(1)} days remaining`);
        }
        return { pendingTrades: updatedPendingTrades, lastTradeTime, lockedCapital: 0, capitalInvestedThisTick: 0, completedTrades };
    }

    const tradableKeys = Object.keys(RESOURCES)
        .filter(key => isTradableResource(key))
        .filter(key => !potentialResources || potentialResources.has(key)); // [FIX] Filter by producible resources

    // Identify tradable resources based on price difference
    const exportableResources = [];
    const importableResources = [];

    tradableKeys.forEach(key => {
        const localPrice = getLocalPrice(key);
        const foreignPrice = getForeignPrice(key);
        const availableStock = res[key] || 0;

        if (foreignPrice === null || localPrice === null) return;

        const priceDiff = foreignPrice - localPrice;
        const profitMargin = Math.abs(priceDiff) / localPrice;

        const isExportable = foreignPrice > localPrice &&
            profitMargin >= tradeConfig.minProfitMargin &&
            availableStock > 0;

        const isImportable = foreignPrice < localPrice &&
            profitMargin >= tradeConfig.minProfitMargin;

        if (isExportable) exportableResources.push(key);
        if (isImportable) importableResources.push(key);
    });

    const simCount = merchantCount > 100 ? 100 : merchantCount;
    const batchMultiplier = merchantCount > 100 ? merchantCount / 100 : 1;
    const maxNewTrades = Math.min(simCount, 50);

    for (let i = 0; i < maxNewTrades; i++) {
        const currentTotalWealth = wealth.merchant || 0;
        if (currentTotalWealth <= tradeConfig.minWealthForTrade) break;

        const decision = Math.random();
        const wealthForThisBatch = currentTotalWealth / (simCount - i);

        if (decision < tradeConfig.exportProbability && exportableResources.length > 0) {
            // Export trade
            const result = executeExportTrade({
                exportableResources,
                wealthForThisBatch,
                batchMultiplier,
                wealth,
                res,
                supply,
                taxBreakdown,
                getResourceTaxRate: getExportTaxRate,
                tradeConfig,
                getLocalPrice,
                getForeignPrice,
                roleWagePayout,
                applyForeignInventoryDeltaAll,
                classFinancialData,
                taxPolicies,
                tick,
                logs
            });

            if (result.success) {
                capitalInvestedThisTick += result.outlay;
                updatedPendingTrades.push(result.trade);
                lastTradeTime = tick;
            }
        } else if (importableResources.length > 0) {
            // Import trade
            const result = executeImportTrade({
                importableResources,
                wealthForThisBatch,
                batchMultiplier,
                wealth,
                res,
                taxBreakdown,
                getResourceTaxRate: getImportTaxRate,
                tradeConfig,
                getLocalPrice,
                getForeignPrice,
                roleExpense,
                applyForeignInventoryDeltaAll,
                classFinancialData,
                taxPolicies,
                tick,
                logs
            });

            if (result.success) {
                capitalInvestedThisTick += result.cost;
                updatedPendingTrades.push(result.trade);
                lastTradeTime = tick;
            }
        }
    }

    const lockedCapital = updatedPendingTrades.reduce((sum, trade) => {
        return sum + Math.max(0, trade.capitalLocked || 0);
    }, 0);

    return {
        pendingTrades: updatedPendingTrades,
        lastTradeTime,
        lockedCapital,
        capitalInvestedThisTick,
        completedTrades
    };
};

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
