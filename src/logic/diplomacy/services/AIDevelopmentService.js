import { RESOURCES } from '../../../config/index.js';
import { getConfig, getPerCapitaWealthCap } from '../config/aiEconomyConfig.js';
import { calculateDevelopmentCapacity } from '../calculators/DevelopmentCapacityCalculator.js';
import { calculateAIPopulationDynamics } from '../calculators/AIPopulationDynamics.js';
import {
    calculateAIDevelopmentSnapshot,
    calculateAIVirtualEconomy,
    calculateAIVirtualLabor,
} from '../foreignEconomy.js';

const safeNumber = (value, fallback = 0) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
};

const clamp = (value, min = 0, max = Infinity) => Math.min(max, Math.max(min, value));

const getResourcePrice = (resourceKey, nation = {}) => {
    return safeNumber(
        nation.nationPrices?.[resourceKey] ?? nation.market?.prices?.[resourceKey],
        RESOURCES[resourceKey]?.basePrice || 1
    );
};

const buildCachedCapacityState = (nation = {}) => {
    const development = nation.aiDevelopment || {};
    const jobsByRole = development.jobsByRole || {};
    const totalJobs = Object.values(jobsByRole).reduce((sum, amount) => sum + safeNumber(amount, 0), 0);
    const resourceSupply = development.resourceBalance?.supplyByResource || {};
    const resourceDemand = development.resourceBalance?.demandByResource || {};
    const capacityByCategory = development.capacityByCategory || {};

    return {
        jobsByRole,
        totalJobs,
        foodSupply: safeNumber(resourceSupply.food, 0),
        civicSupport: safeNumber(capacityByCategory.civic, 0),
        urbanProxy: safeNumber(development.urbanProxy, 0.25),
        resourceSupply,
        resourceDemand,
        capacityByCategory,
    };
};

const calculateAISavingsRate = ({ nation = {}, state = {}, epoch = 0, populationDynamics = {} }) => {
    const foodSecurity = safeNumber(populationDynamics.foodSecurity, 1);
    const employmentRate = safeNumber(populationDynamics.employmentRate, 0.5);
    const developmentRate = safeNumber(state.developmentRate ?? nation.economyTraits?.developmentRate, 1);
    const wealthPerCapita = safeNumber(state.wealth, 0) / Math.max(1, safeNumber(state.population, 1));
    const volatility = clamp(safeNumber(nation.marketVolatility ?? nation.foreignPower?.volatility, 0.3), 0.1, 0.9);

    let rate = 0.18;
    rate += Math.max(0, foodSecurity - 0.9) * 0.08;
    rate += Math.max(0, employmentRate - 0.55) * 0.18;
    rate += Math.max(0, developmentRate - 1) * 0.06;
    rate += epoch <= 1 ? 0.04 : 0;
    rate += wealthPerCapita < 16 ? 0.04 : 0;
    rate -= volatility * 0.08;

    if (nation.isAtWar) {
        rate -= 0.07;
    }

    return clamp(rate, 0.08, 0.42);
};

const calculateResourceSurplusMonetization = ({ nation = {}, state = {}, epoch = 0, tickScale = 1 }) => {
    const inventory = state.inventory || nation.inventory || {};
    const resourceBias = nation.economyTraits?.resourceBias || state.resourceBias || {};
    const baseInventoryTarget = getConfig('resources.baseInventoryTarget', 500);

    return Object.entries(inventory).reduce((sum, [resourceKey, amount]) => {
        const resourceConfig = RESOURCES[resourceKey];
        if (!resourceConfig || resourceConfig.type === 'virtual' || resourceConfig.type === 'currency') {
            return sum;
        }

        const quantity = Math.max(0, safeNumber(amount, 0));
        if (quantity <= 0) return sum;

        const bias = Math.max(0.35, safeNumber(resourceBias[resourceKey], 1));
        const epochFactor = 1 + epoch * 0.12;
        const targetInventory = Math.max(40, baseInventoryTarget * Math.pow(bias, 1.2) * epochFactor);
        const excess = Math.max(0, quantity - targetInventory * 1.1);
        if (excess <= 0) return sum;

        const unitPrice = getResourcePrice(resourceKey, nation);
        const stockPressure = quantity / Math.max(targetInventory, 1);
        const liquidityDiscount = clamp(0.6 - Math.max(0, stockPressure - 1.1) * 0.12, 0.2, 0.58);

        return sum + excess * unitPrice * 0.0032 * liquidityDiscount * tickScale;
    }, 0);
};

export class AIDevelopmentService {
    static update({
        nation,
        state,
        tick,
        epoch,
        ticksSinceUpdate = 10,
        allowHeavyUpdate = true,
        cachedVirtualLabor = null,
        cachedVirtualEconomy = null,
    }) {
        const hasCachedEconomy = Boolean(nation.aiDevelopment && cachedVirtualLabor && cachedVirtualEconomy);
        const shouldUseHeavyUpdate = allowHeavyUpdate || !hasCachedEconomy;
        const capacityState = shouldUseHeavyUpdate
            ? calculateDevelopmentCapacity({
                nation,
                virtualBuildings: nation.virtualBuildings,
                foreignBuildings: nation.virtualBuildingsForeign,
            })
            : buildCachedCapacityState(nation);

        const populationDynamics = calculateAIPopulationDynamics({
            nation,
            state,
            epoch,
            ticksSinceUpdate,
            capacityState,
        });

        const currentPopulation = Math.max(1, Math.round(safeNumber(state.population ?? nation.population, 1)));
        const currentRemainders = state.growthRemainders || { population: 0, wealth: 0 };
        const rawPopulationDelta = safeNumber(
            populationDynamics.rawPopulationDelta,
            populationDynamics.population - currentPopulation
        );
        const populationAccumulator = safeNumber(currentRemainders.population, 0) + rawPopulationDelta;
        let populationChange = populationAccumulator >= 0
            ? Math.floor(populationAccumulator)
            : Math.ceil(populationAccumulator);
        let nextPopulationRemainder = populationAccumulator - populationChange;

        if (populationChange === 0 && currentPopulation <= 24) {
            if (rawPopulationDelta > 0.02 && populationDynamics.foodSecurity >= 0.88 && populationDynamics.employmentRate >= 0.35) {
                populationChange = 1;
                nextPopulationRemainder = Math.max(0, populationAccumulator - 1);
            } else if (rawPopulationDelta < -0.02) {
                populationChange = -1;
                nextPopulationRemainder = Math.min(0, populationAccumulator + 1);
            }
        }
        if (populationChange === 0 && currentPopulation <= 5 && rawPopulationDelta > 0 && populationDynamics.foodSecurity >= 0.75 && !nation.isAtWar) {
            populationChange = 1;
            nextPopulationRemainder = Math.max(-0.25, populationAccumulator - 1);
        }

        const nextPopulation = Math.max(1, currentPopulation + populationChange);
        const virtualLabor = shouldUseHeavyUpdate
            ? calculateAIVirtualLabor({
                ...nation,
                population: nextPopulation,
            }, {
                tick,
                epoch,
                population: nextPopulation,
                virtualBuildings: nation.virtualBuildings,
            })
            : (cachedVirtualLabor || nation.virtualLabor || {
                laborForce: Math.max(1, Math.round(nextPopulation * 0.45)),
                employment: Math.max(1, Math.round(nextPopulation * 0.35)),
                unemployment: Math.max(0, Math.round(nextPopulation * 0.1)),
                employmentRate: 0.78,
                jobsByRole: nation.aiDevelopment?.jobsByRole || {},
            });

        const virtualEconomy = shouldUseHeavyUpdate
            ? calculateAIVirtualEconomy({
                ...nation,
                population: nextPopulation,
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
            : (cachedVirtualEconomy || nation.virtualEconomy || {
                effectiveOutput: 0,
                localValueAdded: 0,
                profitOutflow: 0,
                treasuryIncome: 0,
                maintenanceCost: 0,
            });

        const tradeIncome = safeNumber(capacityState.capacityByCategory?.civic, 0) * 0.12;
        const warLoss = nation.isAtWar
            ? safeNumber(virtualEconomy.maintenanceCost, 0) * 0.55 + nextPopulation * 0.006
            : 0;
        const tickScale = Math.min(2, Math.max(0.5, ticksSinceUpdate / 10));
        const savingsRate = calculateAISavingsRate({
            nation,
            state,
            epoch,
            populationDynamics,
        });
        const resourceSurplusMonetization = calculateResourceSurplusMonetization({
            nation,
            state,
            epoch,
            tickScale,
        });
        const localValueAdded = safeNumber(virtualEconomy.localValueAdded, 0);
        const maintenanceCost = safeNumber(virtualEconomy.maintenanceCost, 0);
        const profitOutflow = safeNumber(virtualEconomy.profitOutflow, 0);
        const maintenanceCostPenalty = maintenanceCost * (0.35 + clamp(safeNumber(nation.marketVolatility ?? nation.foreignPower?.volatility, 0.3), 0.1, 0.9) * 0.2);
        const grossSavingsFlow = localValueAdded * savingsRate
            + tradeIncome
            + resourceSurplusMonetization
            - maintenanceCostPenalty
            - warLoss
            - profitOutflow;
        const wealthMomentum = safeNumber(virtualEconomy.effectiveOutput, 0) * 0.014;
        const baseValueFlow = grossSavingsFlow + wealthMomentum;
        const rawWealthDelta = baseValueFlow * tickScale;
        const wealthAccumulator = safeNumber(currentRemainders.wealth, 0) + rawWealthDelta;
        let wealthDelta = wealthAccumulator >= 0
            ? Math.floor(wealthAccumulator)
            : Math.ceil(wealthAccumulator);
        let nextWealthRemainder = wealthAccumulator - wealthDelta;
        if (wealthDelta === 0 && rawWealthDelta > 0.08) {
            wealthDelta = 1;
            nextWealthRemainder = wealthAccumulator - 1;
        } else if (wealthDelta === 0 && rawWealthDelta < -0.12) {
            wealthDelta = -1;
            nextWealthRemainder = wealthAccumulator + 1;
        }
        if (wealthDelta === 0 && currentPopulation <= 40 && rawWealthDelta > 0 && localValueAdded > 0) {
            wealthDelta = 1;
            nextWealthRemainder = Math.max(-0.5, wealthAccumulator - 1);
        }
        const nextWealth = Math.max(
            100,
            Math.min(
                Math.round(nextPopulation * getPerCapitaWealthCap(epoch)),
                Math.round(state.wealth + wealthDelta)
            )
        );

        const aiDevelopment = calculateAIDevelopmentSnapshot({
            ...nation,
            population: nextPopulation,
            wealth: nextWealth,
            budget: state.budget,
            inventory: state.inventory,
        }, {
            tick,
            population: nextPopulation,
            carryingCapacity: populationDynamics.carryingCapacity,
            foodSecurity: populationDynamics.foodSecurity,
            warRecovery: populationDynamics.warRecovery,
            netWealthChange: wealthDelta,
            tradeIncome,
            warLoss,
            wealthDeltaBreakdown: {
                savingsRate: Number(savingsRate.toFixed(3)),
                grossSavingsFlow: Number(grossSavingsFlow.toFixed(2)),
                resourceSurplusMonetization: Number(resourceSurplusMonetization.toFixed(2)),
                maintenanceCostPenalty: Number(maintenanceCostPenalty.toFixed(2)),
                profitOutflow: Number(profitOutflow.toFixed(2)),
                wealthMomentum: Number(wealthMomentum.toFixed(2)),
            },
            virtualBuildings: nation.virtualBuildings,
            foreignBuildings: nation.virtualBuildingsForeign,
            virtualLabor,
            virtualEconomy,
        });

        aiDevelopment.wealthGeneration = {
            ...aiDevelopment.wealthGeneration,
            tradeIncome: Number(tradeIncome.toFixed(2)),
            warLoss: Number(warLoss.toFixed(2)),
            grossSavingsFlow: Number(grossSavingsFlow.toFixed(2)),
            resourceSurplusMonetization: Number(resourceSurplusMonetization.toFixed(2)),
            maintenanceCostPenalty: Number(maintenanceCostPenalty.toFixed(2)),
            savingsRate: Number(savingsRate.toFixed(3)),
            netWealthChange: wealthDelta,
        };
        aiDevelopment.wealthDeltaBreakdown = {
            grossSavingsFlow: Number(grossSavingsFlow.toFixed(2)),
            localValueAdded: Number(localValueAdded.toFixed(2)),
            tradeIncome: Number(tradeIncome.toFixed(2)),
            resourceSurplusMonetization: Number(resourceSurplusMonetization.toFixed(2)),
            maintenanceCostPenalty: Number(maintenanceCostPenalty.toFixed(2)),
            warLoss: Number(warLoss.toFixed(2)),
            profitOutflow: Number(profitOutflow.toFixed(2)),
            wealthMomentum: Number(wealthMomentum.toFixed(2)),
            savingsRate: Number(savingsRate.toFixed(3)),
        };
        aiDevelopment.population = nextPopulation;
        aiDevelopment.populationChange = populationChange;
        aiDevelopment.laborPool = safeNumber(virtualLabor.laborForce, populationDynamics.laborPool);
        aiDevelopment.employment = safeNumber(virtualLabor.employment, populationDynamics.employment);
        aiDevelopment.unemployment = safeNumber(virtualLabor.unemployment, populationDynamics.unemployment);
        aiDevelopment.unemploymentRate = Number(clamp(aiDevelopment.unemployment / Math.max(1, aiDevelopment.laborPool), 0, 1).toFixed(3));
        aiDevelopment.employmentRate = safeNumber(virtualLabor.employmentRate, populationDynamics.employmentRate);
        aiDevelopment.carryingCapacity = populationDynamics.carryingCapacity;
        aiDevelopment.foodSecurity = populationDynamics.foodSecurity;
        aiDevelopment.populationPressure = Number(clamp(nextPopulation / Math.max(1, populationDynamics.carryingCapacity), 0, 3).toFixed(3));
        aiDevelopment.urbanProxy = populationDynamics.urbanProxy;
        aiDevelopment.warRecovery = populationDynamics.warRecovery;
        aiDevelopment.growthRemainders = {
            population: Number(nextPopulationRemainder.toFixed(4)),
            wealth: Number(nextWealthRemainder.toFixed(4)),
        };

        return {
            population: nextPopulation,
            wealth: nextWealth,
            wealthDelta,
            growthRemainders: {
                population: Number(nextPopulationRemainder.toFixed(4)),
                wealth: Number(nextWealthRemainder.toFixed(4)),
            },
            tradeIncome,
            warLoss,
            capacityState,
            populationDynamics,
            virtualLabor,
            virtualEconomy,
            aiDevelopment,
            usedHeavyUpdate: shouldUseHeavyUpdate,
        };
    }
}
