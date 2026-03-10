/**
 * AI Economy Service
 * Unified AI economy update service
 */

import { AIEconomyState } from '../models/AIEconomyState.js';
import { ResourceManager } from '../calculators/ResourceManager.js';
import { getConfig, getPerCapitaWealthCap, getTargetPerCapitaWealth } from '../config/aiEconomyConfig.js';
import { calculateAINationCapacity } from '../../population/logisticGrowth.js';
import { calculateAITreasuryTargetRatio } from '../economyUtils.js';
import { calculateAIVirtualEconomy, calculateAIVirtualLabor, ensureForeignEconomyState, BUILDING_BASE_COST_INDEX } from '../foreignEconomy.js';
import { AIDevelopmentService } from './AIDevelopmentService.js';
import { debugLog } from '../../../utils/debugFlags.js';
import { RESOURCES } from '../../../config/index.js';

const safeNumber = (value, fallback = 0) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
};

const clamp = (value, min = 0, max = Infinity) => Math.min(max, Math.max(min, value));

const getNationResourcePrice = (nation = {}, resourceKey) => {
    return safeNumber(
        nation.nationPrices?.[resourceKey] ?? nation.market?.prices?.[resourceKey],
        RESOURCES[resourceKey]?.basePrice || 1
    );
};

const calculateInventoryAssetValue = (nation = {}, inventory = {}, epoch = 0) => {
    const resourceBias = nation.economyTraits?.resourceBias || {};
    const baseInventoryTarget = getConfig('resources.baseInventoryTarget', 500);

    return Object.entries(inventory || {}).reduce((sum, [resourceKey, rawAmount]) => {
        const resourceConfig = RESOURCES[resourceKey];
        if (!resourceConfig || resourceConfig.type === 'virtual' || resourceConfig.type === 'currency') {
            return sum;
        }

        const amount = Math.max(0, safeNumber(rawAmount, 0));
        if (amount <= 0) return sum;

        const unitPrice = getNationResourcePrice(nation, resourceKey);
        const bias = Math.max(0.35, safeNumber(resourceBias[resourceKey], 1));
        const targetInventory = Math.max(60, baseInventoryTarget * Math.pow(bias, 1.2) * (1 + epoch * 0.18));
        const stockPressure = amount / Math.max(1, targetInventory);
        const liquidityDiscount = clamp(1 - Math.max(0, stockPressure - 1.25) * 0.14, 0.42, 1);

        return sum + amount * unitPrice * liquidityDiscount;
    }, 0);
};

const calculateCapitalAssetValue = (nation = {}, virtualBuildings = {}, economyState = {}) => {
    const staffingFactors = economyState.staffingFactorByCategory || {};
    const inputFactors = economyState.inputFactorByCategory || {};

    return Object.entries(virtualBuildings || {}).reduce((sum, [buildingId, rawCount]) => {
        const count = Math.max(0, safeNumber(rawCount, 0));
        if (count <= 0) return sum;

        const baseCost = BUILDING_BASE_COST_INDEX[buildingId] || {};
        const baseValue = Object.entries(baseCost).reduce((costSum, [resourceKey, amount]) => {
            return costSum + safeNumber(amount, 0) * getNationResourcePrice(nation, resourceKey);
        }, 0);
        const fallbackValue = baseValue > 0 ? baseValue : 30;
        const maintenanceCost = safeNumber(economyState.maintenanceCost, 0);
        const capitalPerBuilding = fallbackValue * 0.68;
        const broadEfficiency = clamp(
            (
                Object.values(staffingFactors).reduce((acc, value) => acc + safeNumber(value, 1), 0)
                + Object.values(inputFactors).reduce((acc, value) => acc + safeNumber(value, 1), 0)
            ) / 8,
            0.55,
            1
        );
        const maintenanceWear = maintenanceCost > 0 ? clamp(1 - maintenanceCost / Math.max(500, fallbackValue * count * 4), 0.72, 1) : 1;

        return sum + capitalPerBuilding * count * broadEfficiency * maintenanceWear;
    }, 0);
};

export class AIEconomyService {
    /**
     * Update AI nation economy (main entry point)
     */
    static update({
        nation,
        tick,
        epoch,
        difficulty,
        playerPopulation,
        gameSpeed = 1.0,
        allowHeavyUpdate = true,
    }) {
        // Convert to new data model
        const state = AIEconomyState.fromLegacyFormat(nation);
        
        // Validate data
        const validation = state.validate();
        if (!validation.isValid) {
            console.error(`[AI Economy] Invalid state for ${nation.name}:`, validation.errors);
            return nation;
        }

        const capacityInfo = this._normalizeLegacyOutliers(state, nation, {
            epoch,
            difficulty,
            playerPopulation,
        });
        
        const virtualState = ensureForeignEconomyState(nation);
        const beforePop = state.population;
        const beforeWealth = state.wealth;
        const lastGrowthTick = state.lastGrowthTick;
        const ticksSinceLastUpdate = Math.max(1, tick - (state.lastGrowthTick || 0));
        const shouldGrow = this._shouldUpdateGrowth(state, tick);
        const developmentResult = shouldGrow
            ? AIDevelopmentService.update({
                nation,
                state,
                tick,
                epoch,
                ticksSinceUpdate: ticksSinceLastUpdate,
                allowHeavyUpdate,
                cachedVirtualLabor: virtualState.virtualLabor,
                cachedVirtualEconomy: virtualState.virtualEconomy,
            })
            : null;

        if (developmentResult) {
            state.population = developmentResult.population;
            state.wealth = developmentResult.wealth;
            state.basePopulation = Math.max(20, Math.round(state.basePopulation * 0.965 + developmentResult.population * 0.035));
            state.baseWealth = Math.max(120, Math.round(state.baseWealth * 0.955 + developmentResult.wealth * 0.045));
            state.growthRemainders = developmentResult.growthRemainders || state.growthRemainders;
            state.lastGrowthTick = tick;
            state.lastUpdateTick = tick;

            if (nation.vassalOf === 'player') {
                debugLog('trade', `[AIDevelopment] ${nation.name}: pop ${beforePop}->${state.population}, wealth ${beforeWealth}->${state.wealth}, delta=${developmentResult.wealthDelta}`);
            }
        } else if (nation.vassalOf === 'player' && tick % 100 === 0) {
            debugLog('trade', `[AIDevelopment Idle] ${nation.name}: ticks since last ${tick - lastGrowthTick}, interval ${getConfig('growth.updateInterval', 10)}`);
        }

        this._updateResources(state, {
            tick,
            gameSpeed,
            aggression: nation.aggression,
            nation,
            resourceBalance: developmentResult?.aiDevelopment?.resourceBalance,
        });
        
        const treasuryTargetRatio = calculateAITreasuryTargetRatio({
            wealth: state.wealth,
            population: state.population,
            epoch,
            isAtWar: state.isAtWar,
            aggression: nation.aggression,
            capacityUsage: capacityInfo.carryingCapacity > 0 ? state.population / capacityInfo.carryingCapacity : 0.6,
            developmentRate: state.developmentRate,
        });

        // Update budget
        state.budget = ResourceManager.updateBudget({
            currentBudget: state.budget,
            wealth: state.wealth,
            gameSpeed,
            targetRatio: treasuryTargetRatio,
        });

        const laborDirty = (allowHeavyUpdate && tick % 30 === 0)
            || virtualState.economyDirtyFlags.buildingsDirty
            || virtualState.economyDirtyFlags.laborDirty
            || !nation.virtualLabor;
        const economyDirty = (allowHeavyUpdate && tick % 60 === 0)
            || laborDirty
            || virtualState.economyDirtyFlags.resourcesDirty
            || virtualState.economyDirtyFlags.warDirty
            || virtualState.economyDirtyFlags.investmentDirty
            || !nation.virtualEconomy;

        const virtualLabor = developmentResult?.virtualLabor || (laborDirty
            ? calculateAIVirtualLabor({
                ...nation,
                population: state.population,
            }, {
                tick,
                epoch,
                population: state.population,
                virtualBuildings: nation.virtualBuildings,
            })
            : virtualState.virtualLabor);

        const virtualEconomy = developmentResult?.virtualEconomy || (economyDirty
            ? calculateAIVirtualEconomy({
                ...nation,
                population: state.population,
                wealth: state.wealth,
                budget: state.budget,
                inventory: state.inventory,
            }, {
                tick,
                virtualBuildings: nation.virtualBuildings,
                foreignBuildings: nation.virtualBuildingsForeign,
                baselineBuildings: nation.virtualBuildingsBaseline,
                virtualLabor,
            })
            : virtualState.virtualEconomy);
        const aiDevelopment = developmentResult?.aiDevelopment || {
            ...virtualState.aiDevelopment,
            population: state.population,
            laborPool: safeNumber(virtualLabor.laborForce, 0),
            employment: safeNumber(virtualLabor.employment, 0),
            unemployment: safeNumber(virtualLabor.unemployment, 0),
            jobsByRole: virtualLabor.jobsByRole || {},
            jobsByCategory: {},
            capacityByCategory: {},
            resourceBalance: {
                supplyByResource: virtualEconomy.buildingSupplyByResource || {},
                demandByResource: virtualEconomy.buildingDemandByResource || {},
                netByResource: {},
                foodBalance: 0,
                rawMaterialPressure: 0,
                processingPressure: 0,
            },
            wealthGeneration: {
                grossOutput: safeNumber(virtualEconomy.effectiveOutput, 0),
                localValueAdded: safeNumber(virtualEconomy.localValueAdded, 0),
                maintenanceCost: safeNumber(virtualEconomy.maintenanceCost, 0),
                tradeIncome: 0,
                warLoss: 0,
                netWealthChange: 0,
            },
            investmentPressure: 0,
            urbanProxy: 0.25,
            warRecovery: 1,
            carryingCapacity: capacityInfo.carryingCapacity,
            foodSecurity: 1,
            populationPressure: state.population / Math.max(1, capacityInfo.carryingCapacity),
            employmentRate: safeNumber(virtualLabor.employmentRate, 0),
            lastUpdateTick: tick,
        };

        const economyMetrics = this._buildEconomyMetrics(state, nation, {
            epoch,
            difficulty,
            playerPopulation,
            capacityInfo,
            virtualLabor,
            virtualEconomy,
            aiDevelopment,
        });

        const refreshedDirtyFlags = {
            buildingsDirty: allowHeavyUpdate ? false : virtualState.economyDirtyFlags.buildingsDirty,
            laborDirty: allowHeavyUpdate ? false : virtualState.economyDirtyFlags.laborDirty,
            resourcesDirty: allowHeavyUpdate ? false : virtualState.economyDirtyFlags.resourcesDirty,
            warDirty: allowHeavyUpdate ? false : virtualState.economyDirtyFlags.warDirty,
            investmentDirty: allowHeavyUpdate ? false : virtualState.economyDirtyFlags.investmentDirty,
        };
        
        // Convert back to legacy format
        return {
            ...nation,
            ...state.toLegacyFormat(),
            gdp: economyMetrics.annualOutput,
            aiDevelopment,
            virtualLabor,
            virtualEconomy,
            economyDirtyFlags: refreshedDirtyFlags,
            aiEconomyMetrics: economyMetrics,
        };
    }
    
    /**
     * Check if growth should be updated
     */
    static _shouldUpdateGrowth(state, tick) {
        const updateInterval = getConfig('growth.updateInterval', 10);
        const ticksSinceLastGrowth = tick - state.lastGrowthTick;
        return ticksSinceLastGrowth >= updateInterval;
    }
    
    /**
     * Update growth
     */
    static _updateResources(state, { tick, gameSpeed, aggression, nation = null, resourceBalance = null }) {
        state.inventory = ResourceManager.updateInventory({
            inventory: state.inventory,
            resourceBias: state.resourceBias,
            resourceBalance,
            epoch: state.epoch,
            wealth: state.wealth,
            isAtWar: state.isAtWar,
            tick,
            gameSpeed,
            aggression,
            nation,
        });
    }

    static _normalizeLegacyOutliers(state, nation, { epoch, difficulty, playerPopulation }) {
        const capacityInfo = calculateAINationCapacity({
            nation: {
                ...nation,
                population: state.population,
                wealth: state.wealth,
                budget: state.budget,
                inventory: state.inventory,
                economyTraits: {
                    ...(nation.economyTraits || {}),
                    ownBasePopulation: state.basePopulation,
                    developmentRate: state.developmentRate,
                },
            },
            epoch,
            difficulty,
            playerPopulation,
        });

        const hardPopulationCap = Math.max(60, Math.round(capacityInfo.carryingCapacity * 1.15));
        if (state.population > hardPopulationCap) {
            state.population = hardPopulationCap;
        }

        state.basePopulation = Math.min(
            Math.max(20, state.basePopulation || state.population),
            Math.max(state.population, hardPopulationCap)
        );

        const perCapitaCap = getPerCapitaWealthCap(epoch);
        const hardWealthCap = Math.max(200, Math.round(state.population * perCapitaCap));
        if (state.wealth > hardWealthCap) {
            state.wealth = hardWealthCap;
        }

        const targetPerCapita = getTargetPerCapitaWealth(epoch);
        const softBaseWealthCap = Math.max(
            state.wealth,
            Math.round(state.population * targetPerCapita * 1.5)
        );
        state.baseWealth = Math.min(
            Math.max(120, state.baseWealth || state.wealth),
            softBaseWealthCap
        );

        const treasuryTargetRatio = calculateAITreasuryTargetRatio({
            wealth: state.wealth,
            population: state.population,
            epoch,
            isAtWar: state.isAtWar,
            aggression: nation.aggression,
            capacityUsage: capacityInfo.carryingCapacity > 0 ? state.population / capacityInfo.carryingCapacity : 0.6,
            developmentRate: state.developmentRate,
        });
        const maxBudget = Math.max(50, Math.round(state.wealth * Math.min(0.5, treasuryTargetRatio + 0.08)));
        state.budget = Math.min(
            Math.max(0, Number.isFinite(state.budget) ? state.budget : Math.round(state.wealth * treasuryTargetRatio)),
            maxBudget
        );

        return capacityInfo;
    }

    static _buildEconomyMetrics(state, nation, { epoch, difficulty, playerPopulation, capacityInfo = null, virtualLabor = null, virtualEconomy = null, aiDevelopment = null }) {
        const resolvedCapacity = capacityInfo || calculateAINationCapacity({
            nation: {
                ...nation,
                population: state.population,
                wealth: state.wealth,
                budget: state.budget,
                inventory: state.inventory,
                economyTraits: {
                    ...(nation.economyTraits || {}),
                    ownBasePopulation: state.basePopulation,
                    developmentRate: state.developmentRate,
                },
            },
            epoch,
            difficulty,
            playerPopulation,
        });

        const carryingCapacity = Math.max(1, resolvedCapacity.carryingCapacity || state.population);
        const capacityUsage = state.population / carryingCapacity;
        const targetPerCapita = getTargetPerCapitaWealth(epoch);
        const positiveResources = Object.values(state.inventory || {}).filter(v => Number(v) > 0).length;
        const productivityFactor = Math.min(1.6, Math.max(0.65, 0.75 + (state.developmentRate - 1) * 0.2 + positiveResources * 0.01));
        const laborState = virtualLabor || nation.virtualLabor || {};
        const economyState = virtualEconomy || nation.virtualEconomy || {};
        const employedShare = Math.max(
            0.18,
            Math.min(
                0.92,
                state.population > 0
                    ? safeNumber(laborState.employment, 0) / Math.max(1, state.population)
                    : 0.18
            )
        );
        const averageStaffing = Object.values(economyState.staffingFactorByCategory || {}).reduce((sum, value) => sum + safeNumber(value, 1), 0) / 4;
        const averageInput = Object.values(economyState.inputFactorByCategory || {}).reduce((sum, value) => sum + safeNumber(value, 1), 0) / 4;
        const averageWar = Object.values(economyState.warFactorByCategory || {}).reduce((sum, value) => sum + safeNumber(value, 1), 0) / 4;
        const structuralFactor = Math.max(0.35, Math.min(1.15, averageStaffing * averageInput * averageWar));
        const developmentState = aiDevelopment || nation.aiDevelopment || {};
        const economyDerivedOutput = safeNumber(economyState.effectiveOutput, 0) * 6.5
            + safeNumber(economyState.localValueAdded, 0) * 2.2
            + safeNumber(developmentState.wealthGeneration?.tradeIncome, 0) * 8;
        const annualOutput = Math.max(
            1,
            Math.round(
                economyDerivedOutput > 0
                    ? economyDerivedOutput * structuralFactor
                    : state.population * targetPerCapita * employedShare * productivityFactor * structuralFactor * 1.1
            )
        );
        const treasury = Math.max(0, Math.round(Math.max(state.budget || 0, safeNumber(economyState.treasuryIncome, 0))));
        const householdWealth = Math.max(0, Math.round(state.wealth - treasury));
        const treasuryRatio = treasury / Math.max(1, state.wealth);
        const inventoryAssetValue = Math.round(calculateInventoryAssetValue(nation, state.inventory || nation.inventory || {}, epoch));
        const capitalAssetValue = Math.round(calculateCapitalAssetValue(nation, nation.virtualBuildings || {}, economyState));
        const liquidWealth = Math.round(state.wealth);
        const wealthStock = liquidWealth + inventoryAssetValue + capitalAssetValue;
        const nationalNetWorth = wealthStock + treasury;
        const wealthDeltaBreakdown = developmentState.wealthDeltaBreakdown || {};

        return {
            carryingCapacity,
            capacityUsage,
            annualOutput,
            treasury,
            treasuryRatio,
            householdWealth,
            liquidWealth,
            inventoryAssetValue,
            capitalAssetValue,
            wealthStock,
            nationalNetWorth,
            wealthPerCapita: wealthStock / Math.max(1, state.population),
            outputPerCapita: annualOutput / Math.max(1, state.population),
            employmentRate: safeNumber(laborState.employmentRate, employedShare),
            laborForce: Math.round(safeNumber(laborState.laborForce, state.population * 0.5)),
            unemployment: Math.round(safeNumber(laborState.unemployment, Math.max(0, state.population - safeNumber(laborState.employment, 0)))),
            jobsByClass: laborState.jobsByClass || {},
            jobsByRole: laborState.jobsByRole || developmentState.jobsByRole || {},
            workforceByClass: laborState.workforceByClass || {},
            wagePressure: safeNumber(laborState.wagePressure, 1),
            staffingFactorByCategory: economyState.staffingFactorByCategory || {},
            inputFactorByCategory: economyState.inputFactorByCategory || {},
            warFactorByCategory: economyState.warFactorByCategory || {},
            localValueAdded: safeNumber(economyState.localValueAdded, annualOutput * 0.55),
            profitOutflow: safeNumber(economyState.profitOutflow, 0),
            maintenanceCost: safeNumber(economyState.maintenanceCost, 0),
            carryingPressure: safeNumber(developmentState.populationPressure, capacityUsage),
            foodSecurity: safeNumber(developmentState.foodSecurity, 1),
            urbanProxy: safeNumber(developmentState.urbanProxy, 0.25),
            warRecovery: safeNumber(developmentState.warRecovery, 1),
            capacityByCategory: developmentState.capacityByCategory || {},
            wealthDeltaBreakdown,
        };
    }
}
