// 游戏循环钩子
// 处理游戏的核心循环逻辑，包括资源生产、人口增长等

import { useEffect, useRef } from 'react';
import { simulateTick } from '../logic/simulation';
import { calculateArmyMaintenance, calculateArmyPopulation, UNIT_TYPES, STRATA, RESOURCES } from '../config';
import { getRandomFestivalEffects } from '../config/festivalEffects';
import { initCheatCodes } from './cheatCodes';
import { getCalendarInfo } from '../utils/calendar';
import { calculateForeignPrice, calculateTradeStatus } from '../utils/foreignTrade';
import {
    createEnemyPeaceRequestEvent,
    createWarDeclarationEvent,
    createGiftEvent,
    createAIRequestEvent,
    createAllianceRequestEvent,
    createAllyColdEvent,
    createAIDemandSurrenderEvent,
    createAllyAttackedEvent,
    createRebelDemandSurrenderEvent,
    REBEL_DEMAND_SURRENDER_TYPE,
} from '../config/events';
// 新版组织度系统
import {
    updateAllOrganizationStates,
    checkOrganizationEvents,
    ORGANIZATION_STAGE,
    MIN_REBELLION_INFLUENCE,
    checkCoalitionRebellion,
    COALITION_REBELLION_CONFIG,
} from '../logic/organizationSystem';
import { calculateAllPenalties } from '../logic/organizationPenalties';
// 联合叛乱系统
import {
    createCoalitionRebelNation,
    createCoalitionRebellionEvent,
    calculateCoalitionPopLoss,
} from '../config/events';
import { evaluatePromiseTasks } from '../logic/promiseTasks';
// 叛乱事件（保留事件创建函数）
import {
    hasAvailableMilitary,
    isMilitaryRebelling,
    REBELLION_PHASE,
    createBrewingEvent,
    createPlottingEvent,
    createActiveRebellionEvent,
    createRebelNation,
    createRebellionEndEvent,
} from '../logic/rebellionSystem';

const calculateRebelPopulation = (stratumPop = 0) => {
    if (!Number.isFinite(stratumPop) || stratumPop <= 0) return 0;
    return Math.min(stratumPop, Math.max(1, Math.floor(stratumPop * 0.8)));
};

/**
 * 处理贸易路线的自动执行
 * @param {Object} current - 当前游戏状态
 * @param {Object} result - simulateTick的结果
 * @param {Function} addLog - 添加日志函数
 * @param {Function} setResources - 设置资源函数
 * @param {Function} setNations - 设置国家函数
 * @param {Function} setTradeRoutes - 设置贸易路线函数
 */
const processTradeRoutes = (current, result, addLog, setResources, setNations, setTradeRoutes) => {
    const { tradeRoutes, nations, resources, daysElapsed, market, popStructure, taxPolicies } = current;
    const routes = tradeRoutes.routes || [];

    // 贸易路线配置
    const TRADE_SPEED = 0.05; // 每天传输盈余/缺口的5%
    const MIN_TRADE_AMOUNT = 0.1; // 最小贸易量

    // 获取在岗商人数量，决定有多少条贸易路线有效
    const merchantCount = popStructure?.merchant || 0;

    const routesToRemove = [];
    const tradeLog = [];
    let totalTradeTax = 0; // 玩家获得的贸易税

    // 只处理前 merchantCount 条贸易路线（有多少个商人在岗就让多少条贸易路线有用）
    routes.forEach((route, index) => {
        const { nationId, resource, type } = route;
        const nation = nations.find(n => n.id === nationId);

        if (!nation) {
            routesToRemove.push(route);
            return;
        }

        // 如果超过商人数量，则跳过该贸易路线
        if (index >= merchantCount) {
            return;
        }

        // 检查是否处于战争，如果是则暂停贸易路线
        if (nation.isAtWar) {
            return; // 不移除路线，只是暂停
        }

        // 获取贸易状态
        const tradeStatus = calculateTradeStatus(resource, nation, daysElapsed);
        const localPrice = market?.prices?.[resource] ?? (RESOURCES[resource]?.basePrice || 1);
        const foreignPrice = calculateForeignPrice(resource, nation, daysElapsed);

        if (type === 'export') {
            // 出口：商人在国内以国内价购买，在国外以国外价卖出
            // 玩家只赚取商人在国内购买时的交易税
            if (!tradeStatus.isShortage || tradeStatus.shortageAmount <= 0) {
                return; // 对方没有缺口，暂停贸易但保留路线
            }

            // 计算我方盈余
            const myInventory = resources[resource] || 0;
            const myTarget = 500; // 简化：使用固定目标库存
            const mySurplus = Math.max(0, myInventory - myTarget);

            if (mySurplus <= MIN_TRADE_AMOUNT) {
                return; // 我方没有盈余，暂停贸易但保留路线
            }

            // 计算本次出口量：取我方盈余和对方缺口的较小值，再乘以速度
            const exportAmount = Math.min(mySurplus, tradeStatus.shortageAmount) * TRADE_SPEED;

            if (exportAmount < MIN_TRADE_AMOUNT) {
                return;
            }

            // 商人在国内购买资源
            const domesticPurchaseCost = localPrice * exportAmount;  // 商人在国内的购买成本
            const taxRate = taxPolicies?.resourceTaxRates?.[resource] || 0; // 获取该资源的交易税率
            // 出口使用出口关税倍率
            const tariffMultiplier = Math.max(0, taxPolicies?.exportTariffMultipliers?.[resource] ?? taxPolicies?.resourceTariffMultipliers?.[resource] ?? 1);
            const effectiveTaxRate = taxRate * tariffMultiplier;
            const tradeTax = domesticPurchaseCost * effectiveTaxRate; // 玩家获得的交易税

            // 商人在国外销售
            const foreignSaleRevenue = foreignPrice * exportAmount;  // 商人在国外的销售收入
            const merchantProfit = foreignSaleRevenue - domesticPurchaseCost - tradeTax; // 商人获得的利润（含关税成本）

            if (merchantProfit <= 0) {
                return;
            }

            // 更新玩家资源：扣除出口的资源，获得交易税
            setResources(prev => ({
                ...prev,
                silver: (prev.silver || 0) + tradeTax,
                [resource]: Math.max(0, (prev[resource] || 0) - exportAmount),
            }));
            totalTradeTax += tradeTax;

            // 更新外国：支付给商人，获得资源
            setNations(prev => prev.map(n =>
                n.id === nationId
                    ? {
                        ...n,
                        budget: Math.max(0, (n.budget || 0) - foreignSaleRevenue),
                        inventory: {
                            ...n.inventory,
                            [resource]: ((n.inventory || {})[resource] || 0) + exportAmount,
                        },
                        relation: Math.min(100, (n.relation || 0) + 0.2), // 贸易改善关系 (Base 0.05 -> 0.2)
                    }
                    : n
            ));

            //   if (exportAmount >= 1) {
            //     tradeLog.push(`🚢 出口 ${ exportAmount.toFixed(1) } ${ RESOURCES[resource]?.name || resource } 至 ${ nation.name }：商人国内购 ${ domesticPurchaseCost.toFixed(1) } 银币（税 ${ tradeTax.toFixed(1) }），国外售 ${ foreignSaleRevenue.toFixed(1) } 银币，商人赚 ${ merchantProfit.toFixed(1) } 银币。`);
            //   }

        } else if (type === 'import') {
            // 进口：商人在国外以国外价购买，在国内以国内价卖出
            // 玩家只赚取商人在国内销售时的交易税
            if (!tradeStatus.isSurplus || tradeStatus.surplusAmount <= 0) {
                return; // 对方没有盈余，暂停贸易但保留路线
            }

            // 计算本次进口量：对方盈余的一定比例
            const importAmount = tradeStatus.surplusAmount * TRADE_SPEED;

            if (importAmount < MIN_TRADE_AMOUNT) {
                return;
            }

            // 商人在国外购买资源
            const foreignPurchaseCost = foreignPrice * importAmount;  // 商人在国外的购买成本

            // 商人在国内销售
            const domesticSaleRevenue = localPrice * importAmount;  // 商人在国内的销售收入
            const taxRate = taxPolicies?.resourceTaxRates?.[resource] || 0; // 获取该资源的交易税率
            // 进口使用进口关税倍率
            const tariffMultiplier = Math.max(0, taxPolicies?.importTariffMultipliers?.[resource] ?? taxPolicies?.resourceTariffMultipliers?.[resource] ?? 1);
            const effectiveTaxRate = taxRate * tariffMultiplier;
            const tradeTax = domesticSaleRevenue * effectiveTaxRate; // 玩家获得的交易税
            const merchantProfit = domesticSaleRevenue - foreignPurchaseCost - tradeTax; // 商人获得的利润（含关税成本）

            if (merchantProfit <= 0) {
                return;
            }

            // 商人需要有足够资金从国外购买（这里简化处理，假设商人总有足够资金）
            // 实际上商人的资金来自于之前的交易利润，这里不做详细模拟

            // 更新玩家资源：增加进口的资源，获得交易税
            setResources(prev => ({
                ...prev,
                silver: (prev.silver || 0) + tradeTax,
                [resource]: (prev[resource] || 0) + importAmount,
            }));
            totalTradeTax += tradeTax;

            // 更新外国：收到商人支付，失去资源
            setNations(prev => prev.map(n =>
                n.id === nationId
                    ? {
                        ...n,
                        budget: (n.budget || 0) + foreignPurchaseCost,
                        inventory: {
                            ...n.inventory,
                            [resource]: Math.max(0, ((n.inventory || {})[resource] || 0) - importAmount),
                        },
                        relation: Math.min(100, (n.relation || 0) + 0.2), // 贸易改善关系 (Base 0.05 -> 0.2)
                    }
                    : n
            ));

            if (importAmount >= 1) {
                tradeLog.push(`🚢 进口 ${importAmount.toFixed(1)} ${RESOURCES[resource]?.name || resource} 从 ${nation.name}：商人国外购 ${foreignPurchaseCost.toFixed(1)} 银币，国内售 ${domesticSaleRevenue.toFixed(1)} 银币（税 ${tradeTax.toFixed(1)}），商人赚 ${merchantProfit.toFixed(1)} 银币。`);
            }
        }
    });

    // 移除无效的贸易路线
    if (routesToRemove.length > 0) {
        setTradeRoutes(prev => ({
            ...prev,
            routes: prev.routes.filter(route =>
                !routesToRemove.some(r =>
                    r.nationId === route.nationId &&
                    r.resource === route.resource &&
                    r.type === route.type
                )
            )
        }));
    }

    // 添加日志
    tradeLog.forEach(log => addLog(log));
    return { tradeTax: totalTradeTax };
};

const getUnitPopulationCost = (unitId) => {
    const unit = UNIT_TYPES[unitId];
    return unit?.populationCost || 1;
};

const formatUnitSummary = (unitMap = {}) => {
    return Object.entries(unitMap)
        .map(([unitId, count]) => {
            const unitName = UNIT_TYPES[unitId]?.name || unitId;
            return `${unitName} x${count}`;
        })
        .join('、');
};

/**
 * 根据可用士兵数量同步现役部队与训练队列
 */
const syncArmyWithSoldierPopulation = (armyState = {}, queueState = [], availableSoldiers = 0) => {
    const safeArmy = armyState || {};
    const safeQueue = Array.isArray(queueState) ? queueState : [];
    const available = Number.isFinite(availableSoldiers) ? Math.max(0, availableSoldiers) : 0;

    let queueClone = null;
    const ensureQueueClone = () => {
        if (!queueClone) {
            queueClone = safeQueue.map(item => (item ? { ...item } : item));
        }
        return queueClone;
    };

    const trainingEntries = [];
    let trainingPopulation = 0;
    safeQueue.forEach((item, index) => {
        if (!item || item.status !== 'training') return;
        const popCost = getUnitPopulationCost(item.unitId);
        trainingPopulation += popCost;
        trainingEntries.push({
            index,
            unitId: item.unitId,
            popCost,
            remainingTime: item.remainingTime || 0,
        });
    });

    let cancelledTraining = null;
    // Add tolerance for population allocation lag
    // The population allocation system may not immediately allocate enough soldiers
    // when training starts or when soldiers are injured/killed in combat
    // A base tolerance of 3 helps prevent unnecessary training interruptions
    const trainingTolerance = 3;
    const effectiveAvailableForTraining = available + trainingTolerance;

    // console.log('[TRAINING SYNC] trainingPop:', trainingPopulation, 'available:', available,
    //     'tolerance:', trainingTolerance, 'effectiveAvailable:', effectiveAvailableForTraining); // Commented for performance

    if (trainingPopulation > effectiveAvailableForTraining) {
        let manpowerToFree = trainingPopulation - effectiveAvailableForTraining;
        // console.log('[TRAINING SYNC] INTERRUPTING! manpowerToFree:', manpowerToFree); // Commented for performance
        const sortedTraining = trainingEntries.sort(
            (a, b) => (b.remainingTime || 0) - (a.remainingTime || 0)
        );

        sortedTraining.forEach(entry => {
            if (manpowerToFree <= 0) return;
            manpowerToFree -= entry.popCost;
            trainingPopulation -= entry.popCost;
            const clone = ensureQueueClone();
            const original = clone[entry.index] || {};
            clone[entry.index] = {
                ...original,
                status: 'waiting',
                remainingTime: original.totalTime ?? original.remainingTime ?? 0,
            };
            if (!cancelledTraining) cancelledTraining = {};
            cancelledTraining[entry.unitId] = (cancelledTraining[entry.unitId] || 0) + 1;
        });
    }

    const availableForArmy = Math.max(0, available - trainingPopulation);
    const currentArmyPopulation = calculateArmyPopulation(safeArmy);
    let updatedArmy = null;
    let removedUnits = null;

    // Calculate tolerance to account for timing issues when units graduate from training
    // This prevents units from being immediately disbanded after completing training
    // because the population allocation system hasn't had time to catch up yet
    // 
    // The tolerance needs to account for:
    // 1. Units about to complete training (remainingTime <= 1)
    // 2. Units that have already graduated but population allocation hasn't caught up
    // 3. Multiple units graduating in the same tick
    //
    // We use a combination of:
    // - Base tolerance of 3 (to handle most edge cases)
    // - Plus any units about to graduate
    let toleranceForNewGraduates = 3; // Base tolerance for population allocation lag
    safeQueue.forEach(item => {
        if (item && item.status === 'training' && item.remainingTime <= 1) {
            const popCost = getUnitPopulationCost(item.unitId);
            toleranceForNewGraduates += popCost;
        }
    });

    const effectiveAvailableForArmy = availableForArmy + toleranceForNewGraduates;

    // Debug logging for army population sync
    // console.log('[ARMY SYNC] available:', available, 'trainingPop:', trainingPopulation,
    //     'availableForArmy:', availableForArmy, 'tolerance:', toleranceForNewGraduates,
    //     'effectiveAvailable:', effectiveAvailableForArmy, 'currentArmyPop:', currentArmyPopulation); // Commented for performance

    if (currentArmyPopulation > effectiveAvailableForArmy) {
        let manpowerToRemove = currentArmyPopulation - effectiveAvailableForArmy;
        // console.log('[ARMY SYNC] DISBANDING! manpowerToRemove:', manpowerToRemove); // Commented for performance
        updatedArmy = { ...safeArmy };
        removedUnits = {};

        const armyEntries = Object.entries(updatedArmy)
            .filter(([, count]) => count > 0)
            .map(([unitId, count]) => ({
                unitId,
                count,
                popCost: getUnitPopulationCost(unitId),
                epoch: UNIT_TYPES[unitId]?.epoch ?? 0,
            }))
            .sort((a, b) => {
                if (a.popCost === b.popCost) {
                    return a.epoch - b.epoch;
                }
                return b.popCost - a.popCost;
            });

        for (const entry of armyEntries) {
            if (manpowerToRemove <= 0) break;
            const { unitId, popCost } = entry;
            const removable = Math.min(entry.count, Math.ceil(manpowerToRemove / popCost));
            if (removable <= 0) continue;
            updatedArmy[unitId] -= removable;
            manpowerToRemove -= removable * popCost;
            if (updatedArmy[unitId] <= 0) {
                delete updatedArmy[unitId];
            }
            removedUnits[unitId] = (removedUnits[unitId] || 0) + removable;
        }

        if (Object.keys(removedUnits).length === 0) {
            removedUnits = null;
            updatedArmy = null;
        }
    }

    return {
        updatedArmy,
        updatedQueue: queueClone,
        removedUnits,
        cancelledTraining,
    };
};

const processTimedEventEffects = (effectState = {}, settings = {}) => {
    const approvalEffects = Array.isArray(effectState.approval) ? effectState.approval : [];
    const stabilityEffects = Array.isArray(effectState.stability) ? effectState.stability : [];
    const resourceDemandEffects = Array.isArray(effectState.resourceDemand) ? effectState.resourceDemand : [];
    const stratumDemandEffects = Array.isArray(effectState.stratumDemand) ? effectState.stratumDemand : [];
    const buildingProductionEffects = Array.isArray(effectState.buildingProduction) ? effectState.buildingProduction : [];

    const approvalModifiers = {};
    let stabilityModifier = 0;
    const resourceDemandModifiers = {};   // { resourceKey: totalModifier }
    const stratumDemandModifiers = {};    // { stratumKey: totalModifier }
    const buildingProductionModifiers = {}; // { buildingIdOrCat: totalModifier }

    const nextApprovalEffects = [];
    const nextStabilityEffects = [];
    const nextResourceDemandEffects = [];
    const nextStratumDemandEffects = [];
    const nextBuildingProductionEffects = [];

    const clampDecay = (value, fallback) => {
        if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
        return Math.min(0.95, Math.max(0, value));
    };

    const approvalDurationDefault = Math.max(1, settings?.approval?.duration || 30);
    const approvalDecayDefault = clampDecay(settings?.approval?.decayRate ?? 0.04, 0.04);
    const stabilityDurationDefault = Math.max(1, settings?.stability?.duration || 30);
    const stabilityDecayDefault = clampDecay(settings?.stability?.decayRate ?? 0.04, 0.04);
    const resourceDemandDurationDefault = Math.max(1, settings?.resourceDemand?.duration || 60);
    const resourceDemandDecayDefault = clampDecay(settings?.resourceDemand?.decayRate ?? 0.02, 0.02);
    const stratumDemandDurationDefault = Math.max(1, settings?.stratumDemand?.duration || 60);
    const stratumDemandDecayDefault = clampDecay(settings?.stratumDemand?.decayRate ?? 0.02, 0.02);
    const buildingProductionDurationDefault = Math.max(1, settings?.buildingProduction?.duration || 45);
    const buildingProductionDecayDefault = clampDecay(settings?.buildingProduction?.decayRate ?? 0.025, 0.025);

    // Process approval effects
    approvalEffects.forEach(effect => {
        const currentValue = typeof effect.currentValue === 'number' ? effect.currentValue : 0;
        const remainingDays = effect.remainingDays ?? approvalDurationDefault;
        if (remainingDays <= 0 || Math.abs(currentValue) < 0.001) {
            return;
        }
        const stratum = effect.stratum;
        if (!stratum) {
            return;
        }
        approvalModifiers[stratum] = (approvalModifiers[stratum] || 0) + currentValue;
        const decayRate = clampDecay(effect.decayRate, approvalDecayDefault);
        const nextValue = currentValue * (1 - decayRate);
        const nextRemaining = remainingDays - 1;
        if (nextRemaining > 0 && Math.abs(nextValue) >= 0.001) {
            nextApprovalEffects.push({
                ...effect,
                currentValue: nextValue,
                remainingDays: nextRemaining,
            });
        }
    });

    // Process stability effects
    stabilityEffects.forEach(effect => {
        const currentValue = typeof effect.currentValue === 'number' ? effect.currentValue : 0;
        const remainingDays = effect.remainingDays ?? stabilityDurationDefault;
        if (remainingDays <= 0 || Math.abs(currentValue) < 0.001) {
            return;
        }
        stabilityModifier += currentValue;
        const decayRate = clampDecay(effect.decayRate, stabilityDecayDefault);
        const nextValue = currentValue * (1 - decayRate);
        const nextRemaining = remainingDays - 1;
        if (nextRemaining > 0 && Math.abs(nextValue) >= 0.001) {
            nextStabilityEffects.push({
                ...effect,
                currentValue: nextValue,
                remainingDays: nextRemaining,
            });
        }
    });

    // Process resource demand effects
    resourceDemandEffects.forEach(effect => {
        const currentValue = typeof effect.currentValue === 'number' ? effect.currentValue : 0;
        const remainingDays = effect.remainingDays ?? resourceDemandDurationDefault;
        if (remainingDays <= 0 || Math.abs(currentValue) < 0.001) {
            return;
        }
        const target = effect.target;
        if (!target) return;
        resourceDemandModifiers[target] = (resourceDemandModifiers[target] || 0) + currentValue;
        const decayRate = clampDecay(effect.decayRate, resourceDemandDecayDefault);
        const nextValue = currentValue * (1 - decayRate);
        const nextRemaining = remainingDays - 1;
        if (nextRemaining > 0 && Math.abs(nextValue) >= 0.001) {
            nextResourceDemandEffects.push({
                ...effect,
                currentValue: nextValue,
                remainingDays: nextRemaining,
            });
        }
    });

    // Process stratum demand effects
    stratumDemandEffects.forEach(effect => {
        const currentValue = typeof effect.currentValue === 'number' ? effect.currentValue : 0;
        const remainingDays = effect.remainingDays ?? stratumDemandDurationDefault;
        if (remainingDays <= 0 || Math.abs(currentValue) < 0.001) {
            return;
        }
        const target = effect.target;
        if (!target) return;
        stratumDemandModifiers[target] = (stratumDemandModifiers[target] || 0) + currentValue;
        const decayRate = clampDecay(effect.decayRate, stratumDemandDecayDefault);
        const nextValue = currentValue * (1 - decayRate);
        const nextRemaining = remainingDays - 1;
        if (nextRemaining > 0 && Math.abs(nextValue) >= 0.001) {
            nextStratumDemandEffects.push({
                ...effect,
                currentValue: nextValue,
                remainingDays: nextRemaining,
            });
        }
    });

    // Process building production effects
    buildingProductionEffects.forEach(effect => {
        const currentValue = typeof effect.currentValue === 'number' ? effect.currentValue : 0;
        const remainingDays = effect.remainingDays ?? buildingProductionDurationDefault;
        if (remainingDays <= 0 || Math.abs(currentValue) < 0.001) {
            return;
        }
        const target = effect.target;
        if (!target) return;
        buildingProductionModifiers[target] = (buildingProductionModifiers[target] || 0) + currentValue;
        const decayRate = clampDecay(effect.decayRate, buildingProductionDecayDefault);
        const nextValue = currentValue * (1 - decayRate);
        const nextRemaining = remainingDays - 1;
        if (nextRemaining > 0 && Math.abs(nextValue) >= 0.001) {
            nextBuildingProductionEffects.push({
                ...effect,
                currentValue: nextValue,
                remainingDays: nextRemaining,
            });
        }
    });

    return {
        approvalModifiers,
        stabilityModifier,
        resourceDemandModifiers,
        stratumDemandModifiers,
        buildingProductionModifiers,
        nextEffects: {
            approval: nextApprovalEffects,
            stability: nextStabilityEffects,
            resourceDemand: nextResourceDemandEffects,
            stratumDemand: nextStratumDemandEffects,
            buildingProduction: nextBuildingProductionEffects,
        },
    };
};

/**
 * 游戏循环钩子
 * 处理游戏的核心循环逻辑
 * @param {Object} gameState - 游戏状态对象
 * @param {Function} addLog - 添加日志函数
 * @param {Object} actions - 游戏操作函数集
 */
export const useGameLoop = (gameState, addLog, actions) => {
    const {
        resources,
        setResources,
        market,
        setMarket,
        buildings,
        population,
        popStructure,
        setPopulation,
        birthAccumulator,
        setBirthAccumulator,
        epoch,
        techsUnlocked,
        decrees,
        gameSpeed,
        isPaused,
        setIsPaused,
        nations,
        setNations,
        setPopStructure,
        setMaxPop,
        maxPopBonus,
        setRates,
        setTaxes,
        setClassApproval,
        classApproval,
        setClassInfluence,
        setClassWealth,
        setClassWealthDelta,
        setClassIncome,
        setClassExpense,
        classWealthHistory,
        setClassWealthHistory,
        classNeedsHistory,
        setClassNeedsHistory,
        setTotalInfluence,
        setTotalWealth,
        setActiveBuffs,
        setActiveDebuffs,
        stability,
        setStability,
        setLogs,
        taxPolicies,
        classWealth,
        setClassShortages,
        setClassLivingStandard,
        livingStandardStreaks,
        setLivingStandardStreaks,
        activeBuffs,
        activeDebuffs,
        army,
        setArmy,
        militaryQueue,
        setMilitaryQueue,
        jobFill,
        setJobFill,
        jobsAvailable,
        setJobsAvailable,
        setDaysElapsed,
        daysElapsed,
        militaryWageRatio,
        classInfluenceShift,
        setClassInfluenceShift,
        setFestivalModal,
        activeFestivalEffects,
        setActiveFestivalEffects,
        lastFestivalYear,
        setLastFestivalYear,
        setHistory,
        autoSaveInterval,
        isAutoSaveEnabled,
        lastAutoSaveTime,
        saveGame,
        merchantState,
        setMerchantState,
        tradeRoutes,
        setTradeRoutes,
        tradeStats,
        setTradeStats,
        actionCooldowns,
        setActionCooldowns,
        actionUsage,
        setActionUsage,
        promiseTasks,
        setPromiseTasks,
        activeEventEffects,
        setActiveEventEffects,
        eventEffectSettings,
        rebellionStates,
        setRebellionStates,
        classInfluence,
        totalInfluence,
        buildingUpgrades,
        autoRecruitEnabled,
        targetArmyComposition,
    } = gameState;

    // 使用ref保存最新状态，避免闭包问题
    const stateRef = useRef({
        resources,
        market,
        buildings,
        buildingUpgrades,
        autoRecruitEnabled,
        targetArmyComposition,
        population,
        popStructure,
        birthAccumulator,
        maxPopBonus,
        epoch,
        techsUnlocked,
        decrees,
        gameSpeed,
        nations,
        classWealth,
        army,
        militaryQueue,
        jobFill,
        jobsAvailable,
        activeBuffs,
        activeDebuffs,
        taxPolicies,
        classWealthHistory,
        classNeedsHistory,
        militaryWageRatio,
        classApproval,
        daysElapsed,
        activeFestivalEffects,
        lastFestivalYear,
        isPaused,
        autoSaveInterval,
        isAutoSaveEnabled,
        lastAutoSaveTime,
        merchantState,
        tradeRoutes,
        actions,
        tradeStats,
        actionCooldowns,
        actionUsage,
        promiseTasks,
        activeEventEffects,
        eventEffectSettings,
        rebellionStates,
        classInfluence,
        totalInfluence,
        birthAccumulator,
        stability,
    });

    const saveGameRef = useRef(gameState.saveGame);
    const autoRecruitCooldownRef = useRef({});
    const AUTO_RECRUIT_BATCH_LIMIT = 3;
    const AUTO_RECRUIT_FAIL_COOLDOWN = 5000;

    useEffect(() => {
        saveGameRef.current = gameState.saveGame;
    }, [gameState.saveGame]);

    useEffect(() => {
        if (!autoRecruitEnabled) {
            autoRecruitCooldownRef.current = {};
        }
    }, [autoRecruitEnabled]);

    useEffect(() => {
        stateRef.current = {
            resources,
            market,
            buildings,
            buildingUpgrades,
            autoRecruitEnabled,
            targetArmyComposition,
            population,
            epoch,
            popStructure,
            maxPopBonus,
            techsUnlocked,
            decrees,
            gameSpeed,
            nations,
            classWealth,
            livingStandardStreaks,
            army,
            militaryQueue,
            jobFill,
            activeBuffs,
            activeDebuffs,
            taxPolicies,
            classWealthHistory,
            classNeedsHistory,
            militaryWageRatio,
            classApproval,
            daysElapsed,
            activeFestivalEffects,
            lastFestivalYear,
            isPaused,
            autoSaveInterval,
            isAutoSaveEnabled,
            lastAutoSaveTime,
            merchantState,
            tradeRoutes,
            actions,
            tradeStats,
            actionCooldowns,
            actionUsage,
            promiseTasks,
            activeEventEffects,
            eventEffectSettings,
            rebellionStates,
            classInfluence,
            totalInfluence,
            birthAccumulator,
            stability,
        };
    }, [resources, market, buildings, buildingUpgrades, population, popStructure, maxPopBonus, epoch, techsUnlocked, decrees, gameSpeed, nations, classWealth, livingStandardStreaks, army, militaryQueue, jobFill, jobsAvailable, activeBuffs, activeDebuffs, taxPolicies, classWealthHistory, classNeedsHistory, militaryWageRatio, classApproval, daysElapsed, activeFestivalEffects, lastFestivalYear, isPaused, autoSaveInterval, isAutoSaveEnabled, lastAutoSaveTime, merchantState, tradeRoutes, tradeStats, actions, actionCooldowns, actionUsage, promiseTasks, activeEventEffects, eventEffectSettings, rebellionStates, classInfluence, totalInfluence, birthAccumulator, stability]);

    useEffect(() => {
        if (!autoRecruitEnabled) return;
        if (!actions?.recruitUnit) return;
        if (isPaused) return;
        const targets = targetArmyComposition || {};
        const normalizedTargets = Object.entries(targets).reduce((acc, [unitId, value]) => {
            const numeric = Math.max(0, Math.floor(Number(value) || 0));
            if (numeric > 0) {
                acc[unitId] = numeric;
            }
            return acc;
        }, {});
        if (Object.keys(normalizedTargets).length === 0) return;

        const queueCounts = (militaryQueue || []).reduce((acc, item) => {
            if (!item?.unitId) return acc;
            acc[item.unitId] = (acc[item.unitId] || 0) + 1;
            return acc;
        }, {});

        const shortages = Object.entries(normalizedTargets).reduce((list, [unitId, target]) => {
            const unit = UNIT_TYPES[unitId];
            if (!unit) return list;
            if (unit.epoch > epoch) return list;
            const currentCount = (army?.[unitId] || 0) + (queueCounts[unitId] || 0);
            const missing = target - currentCount;
            if (missing > 0) {
                list.push({ unitId, missing });
            }
            return list;
        }, []);

        if (shortages.length === 0) return;

        const now = Date.now();
        const recruitedSummary = {};
        let issued = 0;

        for (const { unitId, missing } of shortages) {
            if (issued >= AUTO_RECRUIT_BATCH_LIMIT) break;
            const cooldownUntil = autoRecruitCooldownRef.current[unitId] || 0;
            if (cooldownUntil > now) continue;

            for (let i = 0; i < missing && issued < AUTO_RECRUIT_BATCH_LIMIT; i++) {
                const success = actions.recruitUnit(unitId, { silent: true, auto: true });
                if (!success) {
                    autoRecruitCooldownRef.current[unitId] = Date.now() + AUTO_RECRUIT_FAIL_COOLDOWN;
                    break;
                }
                recruitedSummary[unitId] = (recruitedSummary[unitId] || 0) + 1;
                issued += 1;
            }
        }

        if (issued > 0) {
            const summary = Object.entries(recruitedSummary)
                .map(([unitId, count]) => `${UNIT_TYPES[unitId]?.name || unitId} ×${count}`)
                .join('、');
            addLog(`自动补兵：已补充 ${summary} 至训练队列。`);
        }
    }, [autoRecruitEnabled, targetArmyComposition, army, militaryQueue, isPaused, actions, epoch, addLog]);


    // 监听国家列表变化，自动清理无效的贸易路线（修复暂停状态下无法清理的问题）
    useEffect(() => {
        if (!tradeRoutes?.routes?.length) return;
        if (!nations) return;

        const validNationIds = new Set(nations.map(n => n.id));
        const validRoutes = tradeRoutes.routes.filter(r => validNationIds.has(r.nationId));

        if (validRoutes.length !== tradeRoutes.routes.length) {
            setTradeRoutes(prev => ({
                ...prev,
                routes: validRoutes
            }));
        }
    }, [nations, tradeRoutes, setTradeRoutes]);

    // 游戏核心循环
    useEffect(() => {
        // 初始化作弊码系统
        if (process.env.NODE_ENV !== 'production') {
            initCheatCodes(gameState, addLog);
        }

        // 暂停时不设置游戏循环定时器，但自动保存定时器需要单独处理
        if (isPaused) {
            // 设置独立的自动保存定时器
            const autoSaveTimer = setInterval(() => {
                const current = stateRef.current;
                if (current.isAutoSaveEnabled) {
                    const intervalSeconds = Math.max(5, current.autoSaveInterval || 60);
                    const elapsed = Date.now() - (current.lastAutoSaveTime || 0);
                    if (elapsed >= intervalSeconds * 1000 && saveGameRef.current) {
                        saveGameRef.current({ source: 'auto' });
                        stateRef.current.lastAutoSaveTime = Date.now();
                    }
                }
            }, 1000);

            return () => clearInterval(autoSaveTimer);
        }

        // 计算 Tick 间隔：基于游戏速度动态调整
        // 1倍速 = 1000ms，2倍速 = 500ms，5倍速 = 200ms
        const tickInterval = 1000 / Math.max(1, gameSpeed);

        const timer = setInterval(() => {
            const current = stateRef.current;

            // 自动存档检测：即使暂停也照常运行，避免长时间停留丢进度
            if (current.isAutoSaveEnabled) {
                const intervalSeconds = Math.max(5, current.autoSaveInterval || 60);
                const elapsed = Date.now() - (current.lastAutoSaveTime || 0);
                if (elapsed >= intervalSeconds * 1000 && saveGameRef.current) {
                    saveGameRef.current({ source: 'auto' });
                    stateRef.current.lastAutoSaveTime = Date.now();
                }
            }

            // 检查是否需要触发年度庆典
            // 修复：检测年份变化而非特定日期，避免加速模式下跳过触发点
            const currentCalendar = getCalendarInfo(current.daysElapsed || 0);
            // 注意：这里使用 1 而非 current.gameSpeed，因为现在每次 Tick 只推进 1 天
            const nextCalendar = getCalendarInfo((current.daysElapsed || 0) + 1);

            // 如果当前年份大于上次庆典年份，且即将跨越或已经跨越新年
            if (currentCalendar.year > (current.lastFestivalYear || 0)) {
                // 新的一年开始，触发庆典
                const festivalOptions = getRandomFestivalEffects(current.epoch);
                if (festivalOptions.length > 0) {
                    setFestivalModal({
                        options: festivalOptions,
                        year: currentCalendar.year
                    });
                    setLastFestivalYear(currentCalendar.year);
                    setIsPaused(true);
                }
            }

            // 执行游戏模拟
            // 【关键】强制将 gameSpeed 设为 1，确保单次 Tick 只计算 1 个单位时间的产出
            // 原因：我们已经通过调整 setInterval 的频率来实现加速（时间流）
            // 如果这里不归一化，simulateTick 内部会再次乘以 gameSpeed，导致倍率叠加
            // 例如：5倍速时，频率已经是 5 倍（200ms/次），如果再传 gameSpeed=5，
            // 实际速度会变成 25 倍（5×5），这是错误的
            const {
                approvalModifiers,
                stabilityModifier,
                resourceDemandModifiers,
                stratumDemandModifiers,
                buildingProductionModifiers,
                nextEffects
            } = processTimedEventEffects(
                current.activeEventEffects,
                current.eventEffectSettings,
            );
            const result = simulateTick({
                ...current,
                tick: current.daysElapsed || 0,
                gameSpeed: 1, // 强制归一化为 1，防止倍率叠加
                activeFestivalEffects: current.activeFestivalEffects || [],
                eventApprovalModifiers: approvalModifiers,
                eventStabilityModifier: stabilityModifier,
                currentStability: current.stability ?? 50, // 传递当前稳定度，用于惯性计算
                // Economic modifiers from events
                eventResourceDemandModifiers: resourceDemandModifiers,
                eventStratumDemandModifiers: stratumDemandModifiers,
                eventBuildingProductionModifiers: buildingProductionModifiers,
            });

            const soldierPopulationAfterEvents = Number.isFinite(result.popStructure?.soldier)
                ? result.popStructure.soldier
                : null;
            let armyStateForQueue = current.army || {};
            let queueOverrideForManpower = null;

            if (soldierPopulationAfterEvents !== null) {
                const manpowerSync = syncArmyWithSoldierPopulation(
                    armyStateForQueue,
                    current.militaryQueue || [],
                    soldierPopulationAfterEvents
                );

                if (manpowerSync.updatedArmy) {
                    armyStateForQueue = manpowerSync.updatedArmy;
                    setArmy(manpowerSync.updatedArmy);
                }

                if (manpowerSync.updatedQueue) {
                    queueOverrideForManpower = manpowerSync.updatedQueue;
                }

                if (manpowerSync.removedUnits) {
                    const summary = formatUnitSummary(manpowerSync.removedUnits);
                    if (summary) {
                        addLog(`⚠️ 军人阶级人口骤减，以下部队被迫解散：${summary}`);
                    }
                }

                if (manpowerSync.cancelledTraining) {
                    const summary = formatUnitSummary(manpowerSync.cancelledTraining);
                    if (summary) {
                        addLog(`⚠️ 士兵伤亡导致训练中断，以下单位重新排入招募：${summary}`);
                    }
                }
            }

            const hadActiveEffects =
                (current.activeEventEffects?.approval?.length || 0) > 0 ||
                (current.activeEventEffects?.stability?.length || 0) > 0 ||
                (current.activeEventEffects?.resourceDemand?.length || 0) > 0 ||
                (current.activeEventEffects?.stratumDemand?.length || 0) > 0 ||
                (current.activeEventEffects?.buildingProduction?.length || 0) > 0;

            const maintenance = calculateArmyMaintenance(army);
            const adjustedResources = { ...result.resources };
            Object.entries(maintenance).forEach(([resource, cost]) => {
                // 每次 Tick 计算 1 天的维护费用（不再乘以 gameSpeed）
                const amount = cost;
                if (amount <= 0) return;
                adjustedResources[resource] = Math.max(0, (adjustedResources[resource] || 0) - amount);
            });
            
            // 处理强制补贴效果（每日从国库支付给指定阶层）
            const forcedSubsidies = Array.isArray(current.activeEventEffects?.forcedSubsidy) 
                ? current.activeEventEffects.forcedSubsidy 
                : [];
            
            // 计算补贴对各阶层财富的增加量（稍后合并到 adjustedClassWealth）
            const subsidyWealthDelta = {};
            if (forcedSubsidies.length > 0) {
                forcedSubsidies.forEach(subsidy => {
                    if (subsidy.remainingDays > 0) {
                        const dailyAmount = subsidy.dailyAmount || 0;
                        const stratumKey = subsidy.stratumKey;
                        
                        // 从国库扣除
                        const treasuryBefore = adjustedResources.silver || 0;
                        const actualPayment = Math.min(dailyAmount, treasuryBefore);
                        adjustedResources.silver = treasuryBefore - actualPayment;
                        
                        // 记录阶层财富增加量
                        if (stratumKey && actualPayment > 0) {
                            subsidyWealthDelta[stratumKey] = (subsidyWealthDelta[stratumKey] || 0) + actualPayment;
                        }
                    }
                });
                // forcedSubsidy 的天数递减和过期清理在下面统一处理
            }
            
            setResources(adjustedResources);

            // 处理强制补贴效果的每日更新
            // 注意：这里只处理 forcedSubsidy 的递减和过期，不处理其他效果的更新
            // 其他效果（approval, stability等）由 simulation.js 中的 applyActiveEventEffects 处理
            if (forcedSubsidies.length > 0) {
                setActiveEventEffects(prev => {
                    // 只更新 forcedSubsidy，保留其他所有效果不变
                    const updatedSubsidies = forcedSubsidies
                        .map(s => ({ ...s, remainingDays: s.remainingDays - 1 }))
                        .filter(s => s.remainingDays > 0);
                    
                    console.log('[GAME LOOP] Updating subsidies:', forcedSubsidies.length, '->', updatedSubsidies.length);
                    
                    return {
                        ...prev,
                        forcedSubsidy: updatedSubsidies
                    };
                });
            }

            // 创建阶层财富对象，合并补贴转账
            const adjustedClassWealth = { ...result.classWealth };
            // 将补贴增量添加到阶层财富
            Object.entries(subsidyWealthDelta).forEach(([key, delta]) => {
                adjustedClassWealth[key] = (adjustedClassWealth[key] || 0) + delta;
            });
            const adjustedTotalWealth = Object.values(adjustedClassWealth).reduce((sum, val) => sum + val, 0);

            // --- 市场数据历史记录更新 ---
            const previousPriceHistory = current.market?.priceHistory || {};
            const priceHistory = { ...previousPriceHistory };

            const previousSupplyHistory = current.market?.supplyHistory || {};
            const supplyHistory = { ...previousSupplyHistory };

            const previousDemandHistory = current.market?.demandHistory || {};
            const demandHistory = { ...previousDemandHistory };

            const MAX_MARKET_HISTORY_POINTS = 60;

            Object.keys(result.market?.prices || {}).forEach(resource => {
                const price = result.market?.prices?.[resource];

                if (!priceHistory[resource]) priceHistory[resource] = [];
                priceHistory[resource] = [...priceHistory[resource], price];
                if (priceHistory[resource].length > MAX_MARKET_HISTORY_POINTS) {
                    priceHistory[resource].shift();
                }

                if (!supplyHistory[resource]) supplyHistory[resource] = [];
                supplyHistory[resource] = [
                    ...supplyHistory[resource],
                    result.market?.supply?.[resource] || 0,
                ];
                if (supplyHistory[resource].length > MAX_MARKET_HISTORY_POINTS) {
                    supplyHistory[resource].shift();
                }

                if (!demandHistory[resource]) demandHistory[resource] = [];
                demandHistory[resource] = [
                    ...demandHistory[resource],
                    result.market?.demand?.[resource] || 0,
                ];
                if (demandHistory[resource].length > MAX_MARKET_HISTORY_POINTS) {
                    demandHistory[resource].shift();
                }
            });

            const previousWealthHistory = current.classWealthHistory || {};
            const wealthHistory = { ...previousWealthHistory };
            const MAX_WEALTH_POINTS = 120;
            Object.entries(result.classWealth || {}).forEach(([key, value]) => {
                const series = wealthHistory[key] ? [...wealthHistory[key]] : [];
                series.push(value);
                if (series.length > MAX_WEALTH_POINTS) {
                    series.shift();
                }
                wealthHistory[key] = series;
            });

            const previousNeedsHistory = current.classNeedsHistory || {};
            const needsHistory = { ...previousNeedsHistory };
            const MAX_NEEDS_POINTS = 120;
            Object.entries(result.needsReport || {}).forEach(([key, report]) => {
                const series = needsHistory[key] ? [...needsHistory[key]] : [];
                series.push(report.satisfactionRatio);
                if (series.length > MAX_NEEDS_POINTS) {
                    series.shift();
                }
                needsHistory[key] = series;
            });

            const adjustedMarket = {
                ...(result.market || {}),
                priceHistory,
                supplyHistory,
                demandHistory,
                // 加成修饰符数据，供UI显示"谁吃到了buff"
                modifiers: result.modifiers || {},
            };

            const MAX_HISTORY_POINTS = 90;
            setHistory(prevHistory => {
                const appendValue = (series = [], value) => {
                    const nextSeries = [...series, value];
                    if (nextSeries.length > MAX_HISTORY_POINTS) {
                        nextSeries.shift();
                    }
                    return nextSeries;
                };

                const safeHistory = prevHistory || {};
                const nextHistory = {
                    ...safeHistory,
                    treasury: appendValue(safeHistory.treasury, result.resources?.silver || 0),
                    tax: appendValue(safeHistory.tax, result.taxes?.total || 0),
                    population: appendValue(safeHistory.population, result.population || 0),
                };

                const previousClassHistory = safeHistory.class || {};
                const classHistory = { ...previousClassHistory };
                Object.keys(STRATA).forEach(key => {
                    const entry = previousClassHistory[key] || { pop: [], income: [], expense: [] };
                    classHistory[key] = {
                        pop: appendValue(entry.pop, result.popStructure?.[key] || 0),
                        income: appendValue(entry.income, result.classIncome?.[key] || 0),
                        expense: appendValue(entry.expense, result.classExpense?.[key] || 0),
                    };
                });
                nextHistory.class = classHistory;
                return nextHistory;
            });

            // 更新所有状态
            setPopStructure(result.popStructure);
            setMaxPop(result.maxPop);
            setRates(result.rates);      // 由于现在每次 Tick 都是 1 天的产出，rates 已经是每天的速率，无需再除以 gameSpeed
            setRates(result.rates || {});
            setClassApproval(result.classApproval);
            const adjustedInfluence = { ...(result.classInfluence || {}) };
            Object.entries(classInfluenceShift || {}).forEach(([key, delta]) => {
                if (!delta) return;
                adjustedInfluence[key] = (adjustedInfluence[key] || 0) + delta;
            });
            setClassInfluence(adjustedInfluence);
            const wealthDelta = {};
            Object.keys(adjustedClassWealth).forEach(key => {
                const prevWealth = current.classWealth?.[key] || 0;
                wealthDelta[key] = adjustedClassWealth[key] - prevWealth;
            });
            setClassWealth(adjustedClassWealth);
            setClassWealthDelta(wealthDelta);
            setClassIncome(result.classIncome || {});
            setClassExpense(result.classExpense || {});
            setClassWealthHistory(wealthHistory);
            setClassNeedsHistory(needsHistory);
            setTotalInfluence(result.totalInfluence);
            setTotalWealth(adjustedTotalWealth);
            setActiveBuffs(result.activeBuffs);
            setActiveDebuffs(result.activeDebuffs);
            setStability(result.stability);
            setTaxes(result.taxes || {
                total: 0,
                breakdown: { headTax: 0, industryTax: 0, subsidy: 0, policyIncome: 0, policyExpense: 0 },
                efficiency: 1,
            });
            setMarket(adjustedMarket);
            setClassShortages(result.needsShortages || {});
            setClassLivingStandard(result.classLivingStandard || {});
            setLivingStandardStreaks(result.livingStandardStreaks || current.livingStandardStreaks || {});
            setMerchantState(prev => {
                const nextState = result.merchantState || current.merchantState || { pendingTrades: [], lastTradeTime: 0 };
                if (prev === nextState) {
                    return prev;
                }
                return nextState;
            });
            if (result.nations) {
                setNations(result.nations);
            }
            if (result.jobFill) {
                setJobFill(result.jobFill);
            }
            if (result.jobsAvailable) {
                setJobsAvailable(result.jobsAvailable);
            }
            // 每次 Tick 推进 1 天（而非 gameSpeed 天）
            // 加速效果通过增加 Tick 频率实现，而非增加每次推进的天数
            setDaysElapsed(prev => prev + 1);

            // ========== 组织度系统更新 ==========
            // 使用新的组织度机制替代旧的RNG叛乱系统
            const currentOrganizationStates = current.rebellionStates || {};
            const updatedOrganizationStates = updateAllOrganizationStates(
                currentOrganizationStates,
                result.classApproval || {},
                result.classInfluence || {},
                result.totalInfluence || 0,
                result.stability || 50,
                current.daysElapsed || 0,
                current.promiseTasks || [],
                result.needsShortages || {},
                {
                    classIncome: result.classIncome || {},
                    classExpense: result.classExpense || current.classExpense || {},
                    popStructure: result.popStructure || current.popStructure || {},
                    taxPolicies: current.taxPolicies || {},
                    market: result.market || current.market || {},
                    classLivingStandard: result.classLivingStandard || {},
                    livingStandardStreaks: result.livingStandardStreaks || current.livingStandardStreaks || {},
                    epoch: current.epoch || 0,
                }
            );

            // 检查是否有阶层跨越组织度阈值需要触发事件
            const organizationEvents = checkOrganizationEvents(
                currentOrganizationStates,
                updatedOrganizationStates
            );
            const currentEpoch = current.epoch || 0;

            // 处理组织度事件
            if (organizationEvents.length > 0 && current.actions?.triggerDiplomaticEvent) {
                for (const orgEvent of organizationEvents) {
                    const stratumKey = orgEvent.stratumKey;
                    const epochBlocksRebellion = stratumKey === 'unemployed' && currentEpoch <= 0;
                    const hasMilitary = hasAvailableMilitary(current.army, current.popStructure, stratumKey);
                    const militaryIsRebelling = isMilitaryRebelling(updatedOrganizationStates);

                    // 构建叛乱状态对象供事件使用
                    const rebellionStateForEvent = {
                        ...updatedOrganizationStates[stratumKey],
                        dissatisfactionDays: Math.floor(updatedOrganizationStates[stratumKey]?.organization || 0),
                        influenceShare: (result.classInfluence?.[stratumKey] || 0) / (result.totalInfluence || 1),
                    };
                    const influenceShare = rebellionStateForEvent.influenceShare || 0;
                    if (influenceShare < 0.01 && orgEvent.type !== 'uprising') {
                        continue;
                    }

                    let event = null;
                    const rebellionCallback = (action, stratum, extraData) => {
                        console.log('[ORGANIZATION] Action:', action, 'Stratum:', stratum, 'Data:', extraData);
                        if (current.actions?.handleRebellionAction) {
                            current.actions.handleRebellionAction(action, stratum, extraData);
                        }
                    };

                    const stratumPopulation = current.popStructure?.[stratumKey] || 0;
                    const marketPrices = current.market?.prices || {};

                    // 根据事件类型处理
                    switch (orgEvent.type) {
                        case 'brewing':
                            // 创建事件弹窗提醒玩家（选项不直接影响组织度）
                            event = createBrewingEvent(
                                stratumKey,
                                rebellionStateForEvent,
                                hasMilitary,
                                militaryIsRebelling,
                                current.resources?.silver || 0, // 传入当前银币
                                rebellionCallback,
                                stratumPopulation,
                                marketPrices
                            );
                            addLog(`⚠️ ${STRATA[stratumKey]?.name || stratumKey}阶层组织度达到30%，出现不满情绪！`);
                            break;

                        case 'plotting':
                            // 创建事件弹窗提醒玩家（选项不直接影响组织度）
                            event = createPlottingEvent(
                                stratumKey,
                                rebellionStateForEvent,
                                hasMilitary,
                                militaryIsRebelling,
                                current.resources?.silver || 0, // 传入当前银币
                                rebellionCallback,
                                stratumPopulation,
                                marketPrices
                            );
                            addLog(`🔥 ${STRATA[stratumKey]?.name || stratumKey}阶层组织度达到70%，正在密谋叛乱！`);
                            break;

                        case 'uprising': {
                            // 检查影响力占比是否足够发动叛乱
                            const stratumInfluence = rebellionStateForEvent.influenceShare;
                            if (epochBlocksRebellion) {
                                addLog(`⚠️ ${STRATA[stratumKey]?.name || stratumKey}阶层尚未具备发动叛乱的组织能力。`);
                                setRebellionStates(prev => ({
                                    ...prev,
                                    [stratumKey]: {
                                        ...prev[stratumKey],
                                        organization: 25,
                                        stage: ORGANIZATION_STAGE.GRUMBLING,
                                    }
                                }));
                                break;
                            }
                            if (stratumInfluence < MIN_REBELLION_INFLUENCE) {
                                addLog(`⚠️ ${STRATA[stratumKey]?.name || stratumKey}阶层组织度达到100%，但社会影响力不足（${Math.round(stratumInfluence * 100)}%），无法发动叛乱！`);
                                setRebellionStates(prev => ({
                                    ...prev,
                                    [stratumKey]: {
                                        ...prev[stratumKey],
                                        organization: 99,
                                    }
                                }));
                                break;
                            }

                            // ========== 联合叛乱检测 ==========
                            const coalitionResult = checkCoalitionRebellion(
                                stratumKey,
                                updatedOrganizationStates,
                                result.classInfluence || {},
                                result.totalInfluence || 0,
                                current.popStructure || {}
                            );

                            if (coalitionResult.isCoalition) {
                                // 联合叛乱：多个阶层一起发动
                                const coalitionStrata = coalitionResult.coalitionStrata;
                                const { details, totalLoss } = calculateCoalitionPopLoss(coalitionStrata, current.popStructure);

                                // 检查是否已存在联合叛军政府或参与阶层的叛军
                                const existingCoalitionRebel = (current.nations || []).find(
                                    n => n.isRebelNation && n.isAtWar && n.isCoalitionRebellion
                                );
                                const existingStrataRebel = (current.nations || []).find(
                                    n => n.isRebelNation && n.isAtWar && coalitionStrata.includes(n.rebellionStratum)
                                );
                                const existingRebel = existingCoalitionRebel || existingStrataRebel;

                                if (existingRebel) {
                                    // 合并到已存在的叛军政府
                                    setNations(prev => prev.map(n => {
                                        if (n.id === existingRebel.id) {
                                            const newPop = (n.population || 0) + totalLoss;
                                            const addedWealth = details.reduce((sum, d) => sum + Math.floor((current.classWealth?.[d.stratumKey] || 0) * 0.3), 0);
                                            return {
                                                ...n,
                                                population: newPop,
                                                wealth: (n.wealth || 0) + addedWealth,
                                                economyTraits: {
                                                    ...n.economyTraits,
                                                    basePopulation: newPop,
                                                    baseWealth: (n.economyTraits?.baseWealth || n.wealth || 0) + addedWealth,
                                                },
                                            };
                                        }
                                        return n;
                                    }));
                                    // 扣除人口
                                    setPopStructure(prev => {
                                        const updated = { ...prev };
                                        details.forEach(({ stratumKey: sKey, loss }) => {
                                            updated[sKey] = Math.max(0, (prev[sKey] || 0) - loss);
                                        });
                                        return updated;
                                    });
                                    setPopulation(prev => Math.max(0, prev - totalLoss));

                                    addLog(`🔥 更多人（${totalLoss}人）加入了${existingRebel.name}！`);
                                } else {
                                    // 创建新的联合叛乱政府
                                    const rebelNation = createCoalitionRebelNation(
                                        coalitionStrata,
                                        current.popStructure,
                                        current.classWealth || {},
                                        result.classInfluence || {},
                                        result.totalInfluence || 0,
                                        COALITION_REBELLION_CONFIG.COALITION_BONUS
                                    );
                                    // 标记为联合叛乱
                                    rebelNation.isCoalitionRebellion = true;
                                    // 设置战争开始时间
                                    rebelNation.warStartDay = current.daysElapsed || 0;

                                    // 将联合叛乱政府添加到国家列表
                                    setNations(prev => [...prev, rebelNation]);

                                    // 从玩家处扣除所有参与阶层的人口
                                    setPopStructure(prev => {
                                        const updated = { ...prev };
                                        details.forEach(({ stratumKey: sKey, loss }) => {
                                            updated[sKey] = Math.max(0, (prev[sKey] || 0) - loss);
                                        });
                                        return updated;
                                    });
                                    setPopulation(prev => Math.max(0, prev - totalLoss));

                                    event = createCoalitionRebellionEvent(
                                        coalitionStrata,
                                        rebelNation,
                                        hasMilitary,
                                        militaryIsRebelling,
                                        details,
                                        rebellionCallback
                                    );
                                    const coalitionNames = coalitionStrata.map(k => STRATA[k]?.name || k).join('、');
                                    addLog(`🔥🔥🔥 ${coalitionNames}等多个阶层联合发动叛乱！`);
                                }

                                // 降低参与阶层的组织度到50%
                                setRebellionStates(prev => {
                                    const updated = { ...prev };
                                    coalitionStrata.forEach(sKey => {
                                        updated[sKey] = {
                                            ...prev[sKey],
                                            organization: 50,
                                            stage: ORGANIZATION_STAGE.MOBILIZING,
                                        };
                                    });
                                    return updated;
                                });
                            } else {
                                // 单阶层叛乱
                                const stratumPop = current.popStructure?.[stratumKey] || 0;
                                const stratumWealth = current.classWealth?.[stratumKey] || 0;
                                const rebelPopLoss = calculateRebelPopulation(stratumPop);

                                // 检查是否已存在该阶层的叛军政府
                                const existingRebelNation = (current.nations || []).find(
                                    n => n.isRebelNation && n.rebellionStratum === stratumKey && n.isAtWar
                                );

                                if (existingRebelNation) {
                                    // 合并到已存在的叛军政府
                                    setNations(prev => prev.map(n => {
                                        if (n.id === existingRebelNation.id) {
                                            const newPop = (n.population || 0) + rebelPopLoss;
                                            const newWealth = (n.wealth || 0) + Math.floor(stratumWealth * 0.3);
                                            return {
                                                ...n,
                                                population: newPop,
                                                wealth: newWealth,
                                                economyTraits: {
                                                    ...n.economyTraits,
                                                    basePopulation: newPop,
                                                    baseWealth: newWealth,
                                                },
                                            };
                                        }
                                        return n;
                                    }));
                                    setPopStructure(prev => ({
                                        ...prev,
                                        [stratumKey]: Math.max(0, (prev[stratumKey] || 0) - rebelPopLoss),
                                    }));
                                    setPopulation(prev => Math.max(0, prev - rebelPopLoss));

                                    addLog(`🔥 更多${STRATA[stratumKey]?.name || stratumKey}（${rebelPopLoss}人）加入了${existingRebelNation.name}！`);
                                    // 不触发事件弹窗，只是静默合并
                                } else {
                                    // 创建新的叛军政府
                                    // 准备资源掠夺数据
                                    const resourceLoot = {
                                        resources: current.resources || {},
                                        marketPrices: current.market?.prices || {},
                                    };
                                    const rebelResult = createRebelNation(
                                        stratumKey,
                                        stratumPop,
                                        stratumWealth,
                                        stratumInfluence,
                                        rebelPopLoss,
                                        resourceLoot
                                    );
                                    const rebelNation = rebelResult.nation;

                                    // 扣除被掠夺的资源
                                    if (rebelResult.lootedResources && Object.keys(rebelResult.lootedResources).length > 0) {
                                        setResources(prev => {
                                            const updated = { ...prev };
                                            Object.entries(rebelResult.lootedResources).forEach(([resKey, amount]) => {
                                                updated[resKey] = Math.max(0, (updated[resKey] || 0) - amount);
                                            });
                                            return updated;
                                        });
                                        const lootSummary = Object.entries(rebelResult.lootedResources)
                                            .map(([k, v]) => `${RESOURCES[k]?.name || k}: ${v}`)
                                            .join('、');
                                        addLog(`⚠️ 叛军掠夺了物资：${lootSummary}（总价值约${Math.floor(rebelResult.lootedValue)}银币）`);
                                    }

                                    // 设置战争开始时间
                                    rebelNation.warStartDay = current.daysElapsed || 0;

                                    setNations(prev => [...prev, rebelNation]);
                                    setPopStructure(prev => ({
                                        ...prev,
                                        [stratumKey]: Math.max(0, (prev[stratumKey] || 0) - rebelPopLoss),
                                    }));
                                    setPopulation(prev => Math.max(0, prev - rebelPopLoss));

                                    event = createActiveRebellionEvent(
                                        stratumKey,
                                        rebellionStateForEvent,
                                        hasMilitary,
                                        militaryIsRebelling,
                                        rebelNation,
                                        rebellionCallback
                                    );
                                    addLog(`🔥🔥🔥 ${STRATA[stratumKey]?.name || stratumKey}阶层组织度达到100%，发动叛乱！`);
                                }

                                // 降低组织度到50%（保持不满但不会立即再次触发叛乱）
                                setRebellionStates(prev => ({
                                    ...prev,
                                    [stratumKey]: {
                                        ...prev[stratumKey],
                                        organization: 50,
                                        stage: ORGANIZATION_STAGE.MOBILIZING,
                                    },
                                }));
                            }
                            break;
                        }
                    }

                    if (event) {
                        current.actions.triggerDiplomaticEvent(event);
                    }
                }
            }

            // 更新组织度状态（使用相同的状态名以兼容存档）
            setRebellionStates(updatedOrganizationStates);

            // ========== 起义后议和检查 ==========
            // 如果叛乱国家对应阶层的组织度下降到不满（<30%）级别，叛军会崩溃消失
            const rebelNations = (current.nations || []).filter(n => n.isRebelNation && n.isAtWar);
            for (const rebelNation of rebelNations) {
                const stratumKey = rebelNation.rebellionStratum;
                if (!stratumKey) continue;

                // 叛军需要至少持续60天战争才会考虑崩溃
                const warDuration = rebelNation.warDuration || 0;
                if (warDuration < 60) continue;

                // 如果叛军已经不在战争中（可能已经通过投降等方式结束），跳过
                if (!rebelNation.isAtWar) continue;

                const orgState = updatedOrganizationStates[stratumKey];
                const organization = orgState?.organization ?? 50; // 默认50%，避免误判
                const rebelWarScore = rebelNation.warScore || 0;

                // 组织度下降到 30% 以下，叛乱军崩溃
                // 但如果叛军战争分数大幅领先（warScore < -30），说明叛军占优，不应该瓦解
                // warScore 负值 = 叛军优势，正值 = 玩家优势
                if (organization < 30 && rebelWarScore >= -20) {
                    const stratumName = STRATA[stratumKey]?.name || stratumKey;
                    addLog(`🕊️ ${rebelNation.name}内部分裂，组织度降至${Math.round(organization)}%，叛乱崩溃！`);

                    // 返还部分人口给玩家
                    const returnedPop = Math.floor((rebelNation.population || 0) * 0.5);
                    if (returnedPop > 0) {
                        setPopStructure(prev => ({
                            ...prev,
                            [stratumKey]: (prev[stratumKey] || 0) + returnedPop,
                        }));
                        setPopulation(prev => prev + returnedPop);
                        addLog(`🏠 ${returnedPop}名${stratumName}从叛军中回归。`);
                    }

                    // 触发叛乱平定事件弹窗
                    const collapseCallback = (action, nation) => {
                        console.log('[REBELLION END]', action, nation?.name);
                    };
                    const collapseEvent = createRebellionEndEvent(rebelNation, true, current.resources?.silver || 0, collapseCallback);
                    if (collapseEvent && current.actions?.triggerDiplomaticEvent) {
                        current.actions.triggerDiplomaticEvent(collapseEvent);
                    }

                    // 更新叛乱国家状态：结束战争
                    setNations(prevNations => prevNations.map(n => {
                        if (n.id === rebelNation.id) {
                            return {
                                ...n,
                                isAtWar: false,
                                warScore: 0,
                                warDuration: 0,
                            };
                        }
                        return n;
                    }));

                    // 将叛乱国家从列表中移除（延迟执行以确保事件显示）
                    setTimeout(() => {
                        setNations(prevNations => prevNations.filter(n => n.id !== rebelNation.id));
                    }, 500);

                    // 重置该阶层的组织度
                    setRebellionStates(prev => ({
                        ...prev,
                        [stratumKey]: {
                            ...prev[stratumKey],
                            organization: Math.max(0, organization - 30), // 额外降低30%
                        }
                    }));
                }
            }

            // 策略行动冷却 - 每日递减
            if (actionCooldowns && Object.keys(actionCooldowns).length > 0) {
                setActionCooldowns(prev => {
                    if (!prev) return prev;
                    let changed = false;
                    const next = {};
                    Object.entries(prev).forEach(([key, value]) => {
                        if (value > 1) {
                            next[key] = value - 1;
                            changed = true;
                        } else if (value > 1e-6) {
                            changed = true;
                        }
                    });
                    return changed ? next : prev;
                });
            }

            // 评估承诺任务
            if (promiseTasks && promiseTasks.length > 0) {
                const today = (current.daysElapsed || 0) + 1;
                const evaluation = evaluatePromiseTasks(promiseTasks, {
                    currentDay: today,
                    classApproval: result.classApproval || {},
                    market: result.market || current.market || {},
                    nations: result.nations || current.nations || [],
                    taxPolicies: current.taxPolicies || {},
                    classWealth: result.classWealth || current.classWealth || {},
                    needsReport: result.needsReport || {},
                    tradeRoutes: current.tradeRoutes || {},
                    classIncome: result.classIncome || {},
                    popStructure: result.popStructure || current.popStructure || {},
                });

                // 处理完成的任务
                if (evaluation.completed.length > 0) {
                    evaluation.completed.forEach(task => {
                        const config = task.type === 'approval' ? null : null; // 可扩展
                        addLog(`🤝 ${task.stratumName} 的承诺已兑现：${task.description || '任务完成'}`);
                    });
                }

                // 处理进入保持阶段的任务（两阶段机制）
                if (evaluation.updated && evaluation.updated.length > 0) {
                    evaluation.updated.forEach(task => {
                        addLog(`✓ ${task.stratumName} 的承诺目标已达成，现在需要保持 ${task.maintainDuration} 天`);
                    });
                }

                // 处理失败的任务
                if (evaluation.failed.length > 0) {
                    evaluation.failed.forEach(task => {
                        const stratumKey = task.stratumKey;
                        const failReason = task.failReason === 'maintain_broken'
                            ? '未能保持承诺'
                            : '未能按时完成';
                        addLog(`⚠️ 你违背了对${task.stratumName}的承诺（${failReason}），组织度暴涨！`);

                        // 计算惩罚后的组织度
                        const prevState = current.rebellionStates?.[stratumKey] || {};
                        const penalty = task.failurePenalty || { organization: 50 };
                        let newOrganization = prevState.organization || 0;

                        if (penalty.forcedUprising) {
                            newOrganization = 100;
                        } else if (typeof penalty.organization === 'number') {
                            newOrganization = Math.min(100, Math.max(0, newOrganization + penalty.organization));
                        }

                        const stratumInfluence = (result.classInfluence?.[stratumKey] || 0) / (result.totalInfluence || 1);
                        const epochBlocksRebellion = stratumKey === 'unemployed' && (current.epoch || 0) <= 0;
                        const reachedThreshold = newOrganization >= 100;
                        const canTriggerUprising = reachedThreshold && stratumInfluence >= MIN_REBELLION_INFLUENCE && !epochBlocksRebellion;

                        if (reachedThreshold && !canTriggerUprising) {
                            newOrganization = 99;
                            const extraReason = epochBlocksRebellion
                                ? '当前时代他们尚缺乏发动叛乱的组织力'
                                : `社会影响力不足（${Math.round(stratumInfluence * 100)}%）`;
                            addLog(`⚠️ ${STRATA[stratumKey]?.name || stratumKey}阶层因承诺违背组织度达到100%，但${extraReason}，无法发动叛乱！`);
                        }

                        // 更新组织度状态
                        setRebellionStates(prev => ({
                            ...prev,
                            [stratumKey]: {
                                ...prev[stratumKey],
                                organization: newOrganization,
                            },
                        }));

                        // 如果组织度达到100%，触发起义事件
                        if (canTriggerUprising && current.actions?.triggerDiplomaticEvent) {
                            const hasMilitary = hasAvailableMilitary(current.army, current.popStructure, stratumKey);
                            const militaryIsRebelling = isMilitaryRebelling(current.rebellionStates || {});

                            const rebellionStateForEvent = {
                                organization: newOrganization,
                                dissatisfactionDays: Math.floor(newOrganization),
                                influenceShare: stratumInfluence,
                            };

                            // 创建叛乱政府
                            const stratumPop = current.popStructure?.[stratumKey] || 0;
                            const stratumWealth = current.classWealth?.[stratumKey] || 0;
                            const rebelPopLoss = calculateRebelPopulation(stratumPop);

                            // 准备资源掠夺数据
                            const resourceLoot = {
                                resources: current.resources || {},
                                marketPrices: current.market?.prices || {},
                            };
                            const rebelResult = createRebelNation(
                                stratumKey,
                                stratumPop,
                                stratumWealth,
                                stratumInfluence,
                                rebelPopLoss,
                                resourceLoot
                            );
                            const rebelNation = rebelResult.nation;

                            // 扣除被掠夺的资源
                            if (rebelResult.lootedResources && Object.keys(rebelResult.lootedResources).length > 0) {
                                setResources(prev => {
                                    const updated = { ...prev };
                                    Object.entries(rebelResult.lootedResources).forEach(([resKey, amount]) => {
                                        updated[resKey] = Math.max(0, (updated[resKey] || 0) - amount);
                                    });
                                    return updated;
                                });
                                const lootSummary = Object.entries(rebelResult.lootedResources)
                                    .map(([k, v]) => `${RESOURCES[k]?.name || k}: ${v}`)
                                    .join('、');
                                addLog(`⚠️ 叛军掠夺了物资：${lootSummary}（总价值约${Math.floor(rebelResult.lootedValue)}银币）`);
                            }

                            // 设置战争开始时间
                            rebelNation.warStartDay = current.daysElapsed || 0;

                            setNations(prev => [...prev, rebelNation]);
                            setPopStructure(prev => ({
                                ...prev,
                                [stratumKey]: Math.max(0, (prev[stratumKey] || 0) - rebelPopLoss),
                            }));
                            setPopulation(prev => Math.max(0, prev - rebelPopLoss));

                            const rebellionCallback = (action, stratum, extraData) => {
                                if (current.actions?.handleRebellionAction) {
                                    current.actions.handleRebellionAction(action, stratum, extraData);
                                }
                            };

                            const event = createActiveRebellionEvent(
                                stratumKey,
                                rebellionStateForEvent,
                                hasMilitary,
                                militaryIsRebelling,
                                rebelNation,
                                rebellionCallback
                            );

                            addLog(`🔥🔥🔥 ${STRATA[stratumKey]?.name || stratumKey}因承诺违背，组织度达到100%，发动叛乱！`);
                            current.actions.triggerDiplomaticEvent(event);
                            setIsPaused(true);
                        }
                    });
                }

                // 更新任务列表（包括进入保持阶段的任务）
                const newRemaining = [...evaluation.remaining];
                if (evaluation.updated) {
                    // updated 任务已经在 remaining 中了，这里只是确认
                }
                setPromiseTasks(newRemaining);
            }

            // 处理贸易路线并记录贸易税收入
            let tradeTax = 0;
            if (current.tradeRoutes && current.tradeRoutes.routes && current.tradeRoutes.routes.length > 0) {
                const summary = processTradeRoutes(current, result, addLog, setResources, setNations, setTradeRoutes);
                if (summary) {
                    tradeTax = summary.tradeTax || 0;
                }
            }
            setTradeStats({ tradeTax });

            // 处理玩家的分期支付
            if (gameState.playerInstallmentPayment && gameState.playerInstallmentPayment.remainingDays > 0) {
                const payment = gameState.playerInstallmentPayment;
                const paymentAmount = payment.amount;

                if ((current.resources.silver || 0) >= paymentAmount) {
                    setResources(prev => ({
                        ...prev,
                        silver: (prev.silver || 0) - paymentAmount
                    }));

                    gameState.setPlayerInstallmentPayment(prev => ({
                        ...prev,
                        paidAmount: prev.paidAmount + paymentAmount,
                        remainingDays: prev.remainingDays - 1
                    }));

                    if (payment.remainingDays === 1) {
                        addLog(`💰 你完成了所有分期赔款支付（共${payment.totalAmount} 银币）。`);
                        gameState.setPlayerInstallmentPayment(null);
                    }
                } else {
                    // 银币不足，违约
                    addLog(`⚠️ 银币不足，无法支付分期赔款！和平协议被破坏。`);
                    setNations(prev => prev.map(n =>
                        n.id === payment.nationId
                            ? {
                                ...n,
                                isAtWar: true,
                                warStartDay: current.daysElapsed || 0,
                                warDuration: 0,
                                relation: Math.max(0, (n.relation || 0) - 50),
                                peaceTreatyUntil: undefined,
                                lootReserve: (n.wealth || 500) * 1.5, // 初始化掠夺储备
                                lastMilitaryActionDay: undefined, // 重置军事行动冷却
                            }
                            : n
                    ));
                    gameState.setPlayerInstallmentPayment(null);
                }
            }

            // 更新庆典效果，移除过期的短期效果
            if (activeFestivalEffects.length > 0) {
                const updatedEffects = activeFestivalEffects.filter(effect => {
                    if (effect.type === 'permanent') return true;
                    const elapsedSinceActivation = (current.daysElapsed || 0) - (effect.activatedAt || 0);
                    return elapsedSinceActivation < (effect.duration || 360);
                });
                if (updatedEffects.length !== activeFestivalEffects.length) {
                    setActiveFestivalEffects(updatedEffects);
                }
            }

            setClassInfluenceShift(prev => {
                if (!prev || Object.keys(prev).length === 0) return prev || {};
                const next = {};
                Object.entries(prev).forEach(([key, value]) => {
                    const decayed = value * 0.9;
                    if (Math.abs(decayed) >= 0.1) {
                        next[key] = decayed;
                    }
                });
                return Object.keys(next).length > 0 ? next : {};
            });

            // 更新人口（如果有变化）
            if (result.population !== current.population) {
                setPopulation(result.population);
            }
            if (typeof result.birthAccumulator === 'number') {
                setBirthAccumulator(result.birthAccumulator);
            }

            // 添加新日志
            if (result.logs.length) {
                // 去重：追踪已处理的突袭事件
                const processedRaidNations = new Set();

                // Filter and transform technical logs to human-readable format
                const processedLogs = result.logs.map(log => {
                    if (typeof log !== 'string') return log;

                    // Transform RAID_EVENT logs to human-readable format (now supports multiple action types)
                    if (log.includes('❗RAID_EVENT❗')) {
                        try {
                            const jsonStr = log.replace('❗RAID_EVENT❗', '');
                            const raidData = JSON.parse(jsonStr);

                            // 去重：如果这个国家已经有军事行动记录，跳过
                            if (processedRaidNations.has(raidData.nationName)) {
                                return null; // 返回null，稍后过滤掉
                            }
                            processedRaidNations.add(raidData.nationName);

                            // 获取行动名称，默认为"突袭"
                            const actionName = raidData.actionName || '突袭';

                            if (raidData.victory) {
                                return `⚔️ 成功击退了 ${raidData.nationName} 的${actionName}！`;
                            } else {
                                const losses = [];
                                if (raidData.foodLoss > 0) losses.push(`粮食 -${raidData.foodLoss}`);
                                if (raidData.silverLoss > 0) losses.push(`银币 -${raidData.silverLoss}`);
                                if (raidData.woodLoss > 0) losses.push(`木材 -${raidData.woodLoss}`);
                                if (raidData.popLoss > 0) losses.push(`人口 -${raidData.popLoss}`);
                                const lossText = losses.length > 0 ? `（${losses.join('，')}）` : '';
                                return `🔥 遭到 ${raidData.nationName} 的${actionName}！${lossText}`;
                            }
                        } catch (e) {
                            return `⚔️ 发生了一场敌方军事行动！`;
                        }
                    }

                    // Transform WAR_DECLARATION_EVENT logs to human-readable format
                    if (log.includes('WAR_DECLARATION_EVENT:')) {
                        try {
                            const jsonStr = log.replace('WAR_DECLARATION_EVENT:', '');
                            const warData = JSON.parse(jsonStr);
                            return `⚔️ ${warData.nationName} 对你宣战！`;
                        } catch (e) {
                            return `⚔️ 有国家对你宣战！`;
                        }
                    }

                    if (log.includes('AI_GIFT_EVENT:')) {
                        return '💝 收到一份来自外国的外交礼物通知';
                    }
                    if (log.includes('AI_REQUEST_EVENT:')) {
                        return '🗣️ 收到一份来自外国的外交请求';
                    }
                    // 过滤掉 AI_TRADE_EVENT 的原始 JSON，后续会通过 addLog 添加格式化日志
                    if (log.includes('AI_TRADE_EVENT:')) {
                        return null;
                    }

                    return log;
                });

                setLogs(prev => [...processedLogs.filter(log => log !== null), ...prev].slice(0, 128));

                // 检测外交事件并触发事件系统
                const currentActions = current.actions;
                console.log('[EVENT DEBUG] actions:', !!currentActions, 'triggerDiplomaticEvent:', !!currentActions?.triggerDiplomaticEvent);
                if (currentActions && currentActions.triggerDiplomaticEvent) {
                    console.log('[EVENT DEBUG] Checking logs:', result.logs);
                    console.log('[EVENT DEBUG] Total logs count:', result.logs.length);

                    // 先解析突袭事件日志，触发战斗结果弹窗
                    const raidLogEntry = Array.isArray(result.logs)
                        ? result.logs.find((log) => typeof log === 'string' && log.includes('RAID_EVENT'))
                        : null;
                    if (raidLogEntry && currentActions.addBattleNotification) {
                        try {
                            const jsonStart = raidLogEntry.indexOf('{');
                            if (jsonStart !== -1) {
                                const raidJson = raidLogEntry.slice(jsonStart);
                                const raidData = JSON.parse(raidJson);

                                // 获取行动名称，默认为"突袭"
                                const actionName = raidData.actionName || '突袭';

                                let description = `${raidData.nationName} 发动了${actionName}！\n\n`;
                                if (raidData.victory) {
                                    description += `你的军队成功击退了${actionName}！\n\n`;
                                    description += '战斗力对比：\n';
                                    description += `我方：${raidData.ourPower || 0} \n`;
                                    description += `敌方：${raidData.enemyPower || 0} \n`;
                                    if (raidData.battleReport && raidData.battleReport.length > 0) {
                                        description += '\n' + raidData.battleReport.join('\n');
                                    }
                                } else {
                                    if (!raidData.ourPower) {
                                        description += `你没有军队防御，${actionName}成功！\n\n`;
                                    } else {
                                        description += `你的军队未能阻止${actionName}！\n\n`;
                                        description += '战斗力对比：\n';
                                        description += `我方：${raidData.ourPower || 0} \n`;
                                        description += `敌方：${raidData.enemyPower || 0} \n`;
                                        if (raidData.battleReport && raidData.battleReport.length > 0) {
                                            description += '\n' + raidData.battleReport.join('\n');
                                        }
                                    }
                                    description += `\n${actionName}损失：\n`;
                                    if (raidData.foodLoss > 0) description += `粮食：${raidData.foodLoss} \n`;
                                    if (raidData.silverLoss > 0) description += `银币：${raidData.silverLoss} \n`;
                                    if (raidData.woodLoss > 0) description += `木材：${raidData.woodLoss} \n`;
                                    if (raidData.popLoss > 0) description += `人口：${raidData.popLoss} \n`;
                                }

                                const battleResult = {
                                    victory: !!raidData.victory,
                                    missionName: `${raidData.nationName} 的${actionName}`,
                                    missionDesc: raidData.victory
                                        ? `你成功击退了敌方的${actionName}！`
                                        : `敌方对你发动了${actionName}！`,
                                    nationName: raidData.nationName,
                                    ourPower: raidData.ourPower || 0,
                                    enemyPower: raidData.enemyPower || 0,
                                    powerRatio:
                                        (raidData.enemyPower || 0) > 0
                                            ? (raidData.ourPower || 0) / raidData.enemyPower
                                            : 0,
                                    score: 0,
                                    losses: raidData.defenderLosses || {},
                                    attackerLosses: raidData.attackerLosses || {},
                                    enemyLosses: raidData.attackerLosses || {},
                                    defenderLosses: raidData.defenderLosses || {},
                                    resourcesGained: {},
                                    description,
                                    foodLoss: raidData.foodLoss || 0,
                                    silverLoss: raidData.silverLoss || 0,
                                    popLoss: raidData.popLoss || 0,
                                    isRaid: true,
                                };

                                console.log('[EVENT DEBUG] Raid battle result created (pre-loop):', battleResult);
                                // 使用非阻断式通知，不打断玩家操作
                                currentActions.addBattleNotification(battleResult);
                            }
                        } catch (e) {
                            console.error('[EVENT DEBUG] Failed to parse raid event log:', e);
                        }
                    }

                    result.logs.forEach((log, index) => {
                        console.log(`[EVENT DEBUG] Log ${index}: `, log);
                        console.log(`[EVENT DEBUG] Log ${index} includes RAID_EVENT: `, log.includes('❗RAID_EVENT❗'));

                        // 检测宣战事件（使用新的 WAR_DECLARATION_EVENT 标记）
                        if (log.includes('WAR_DECLARATION_EVENT:')) {
                            console.log('[EVENT DEBUG] War declaration detected:', log);
                            try {
                                const jsonStr = log.replace('WAR_DECLARATION_EVENT:', '');
                                const warData = JSON.parse(jsonStr);
                                const aggressorId = warData.nationId;
                                const aggressorName = warData.nationName;

                                // 触发玩家的宣战弹窗
                                const aggressor = result.nations?.find(n => n.id === aggressorId);
                                if (aggressor) {
                                    const event = createWarDeclarationEvent(aggressor, () => {
                                        console.log('[EVENT DEBUG] War declaration acknowledged');
                                    });
                                    currentActions.triggerDiplomaticEvent(event);
                                }

                                // === 战争同盟连锁反应逻辑 ===
                                // 既然 simulation.js 仅仅触发了事件，我们需要在这里处理复杂的同盟逻辑
                                // 我们需要同时更新 state 中的 nations (result.nations 是本Tick的结果，我们需要更新它)

                                setNations(prevNations => {
                                    const nextNations = [...prevNations];
                                    const aggressorIdx = nextNations.findIndex(n => n.id === aggressorId);
                                    if (aggressorIdx === -1) return nextNations;

                                    // 1. 识别各方盟友
                                    // 侵略者的盟友: 与侵略者关系 >= 80
                                    const aggressorAllies = nextNations.filter(n => {
                                        if (n.id === aggressorId) return false;
                                        const r = nextNations[aggressorIdx].foreignRelations?.[n.id] ?? 50;
                                        return r >= 80 && !n.isAtWar;
                                    });

                                    // 玩家(目标)的正式盟友: alliedWithPlayer === true
                                    const playerAllies = nextNations.filter(n => {
                                        if (n.id === aggressorId) return false;
                                        return n.alliedWithPlayer === true && !n.isAtWar;
                                    });

                                    // ========== 战争上限检查 ==========
                                    const MAX_CONCURRENT_WARS = 3;
                                    // 计算当前与玩家交战的AI国家数量（不包括叛军）
                                    let currentWarsWithPlayer = nextNations.filter(n =>
                                        n.isAtWar === true && !n.isRebelNation
                                    ).length;

                                    // 2. 处理侵略者的盟友加入战争
                                    aggressorAllies.forEach(ally => {
                                        // 检查中立原则：如果该盟友同时也与玩家正式结盟，则保持中立
                                        if (ally.alliedWithPlayer === true) {
                                            addLog(`⚖️ ${ally.name} 既是你的盟友又是 ${aggressorName} 的盟友，决定保持中立。`);
                                            return;
                                        }

                                        // 检查战争上限：如果已达上限，盟友保持中立
                                        if (currentWarsWithPlayer >= MAX_CONCURRENT_WARS) {
                                            addLog(`⚖️ ${ally.name} 虽是 ${aggressorName} 的盟友，但考虑到局势复杂，决定暂时观望。`);
                                            return;
                                        }

                                        // 否则，加入侵略者一方，对玩家宣战
                                        const allyIdx = nextNations.findIndex(n => n.id === ally.id);
                                        if (allyIdx !== -1) {
                                            nextNations[allyIdx] = {
                                                ...nextNations[allyIdx],
                                                isAtWar: true,
                                                warStartDay: daysElapsed,
                                                warDuration: 0,
                                                relation: 0 // 与玩家关系破裂
                                            };
                                            currentWarsWithPlayer++; // 更新计数
                                            addLog(`⚔️ ${ally.name} 作为 ${aggressorName} 的盟友，对你宣战！`);
                                        }
                                    });

                                    // 3. 处理玩家的盟友加入战争
                                    playerAllies.forEach(ally => {
                                        // 检查中立原则：如果该盟友同时也与侵略者正式结盟，则保持中立
                                        const aggressorNation = nextNations[aggressorIdx];
                                        const isAlsoAggressorAlly = (aggressorNation.allies || []).includes(ally.id) ||
                                            (ally.allies || []).includes(aggressorId);
                                        if (isAlsoAggressorAlly) {
                                            // 日志已在上一步处理（双向的，只需触发一次提示即可，或者重复提示也没关系）
                                            // addLog(`⚖️ 你的盟友 ${ally.name} 与 ${aggressorName} 关系密切，决定保持中立。`); 
                                            // 上面的逻辑已经涵盖了这种情况（因为是遍历两组盟友，同一个国家可能出现在两组中）
                                            // 但为了清晰，这里只提示一次 "保持中立" 比较好。
                                            // 实际上 ally 在这里肯定出现在 playerAllies 列表中。
                                            // 如果它也在 aggressorAllies 列表中，它会在上面的循环被处理吗？
                                            // 上面的循环遍历 aggressorAllies，如果它与玩家关系好，会中立。
                                            // 这里的循环遍历 playerAllies，如果它与侵略者关系好，也会中立。
                                            // 结果是一致的：只要既是A盟友又是C盟友，就不参战。
                                            return;
                                        }

                                        // 否则，该盟友对侵略者及其盟友宣战 (设置 foreignWars)
                                        const allyIdx = nextNations.findIndex(n => n.id === ally.id);
                                        if (allyIdx !== -1) {
                                            const updatedAlly = { ...nextNations[allyIdx] };
                                            if (!updatedAlly.foreignWars) updatedAlly.foreignWars = {};

                                            // 对侵略者宣战
                                            updatedAlly.foreignWars[aggressorId] = {
                                                isAtWar: true,
                                                warStartDay: daysElapsed,
                                                warScore: 0
                                            };

                                            // 同时也需要更新侵略者的 foreignWars 状态，标记它与该盟友开战了
                                            // 注意：aggressorIdx 的引用如果不更新，可能导致状态不一致
                                            // 我们直接修改 nextNations 数组中的对象
                                            if (!nextNations[aggressorIdx].foreignWars) nextNations[aggressorIdx].foreignWars = {};
                                            nextNations[aggressorIdx].foreignWars[ally.id] = {
                                                isAtWar: true,
                                                warStartDay: daysElapsed,
                                                warScore: 0
                                            };

                                            nextNations[allyIdx] = updatedAlly;
                                            addLog(`🛡️ 你的盟友 ${ally.name} 响应号召，对 ${aggressorName} 宣战！`);
                                        }
                                    });

                                    return nextNations;
                                });

                            } catch (e) {
                                console.error('[EVENT DEBUG] Failed to parse war declaration event:', e);
                            }
                        }
                        // 兼容旧的宣战检测逻辑
                        else if (log.includes('对你发动了战争') && !log.includes('WAR_DECLARATION_EVENT')) {
                            const match = log.match(/⚠️ (.+) 对你发动了战争/);
                            if (match) {
                                const nationName = match[1];
                                const nation = result.nations?.find(n => n.name === nationName);
                                if (nation) {
                                    const event = createWarDeclarationEvent(nation, () => {
                                        // 宣战事件只需要确认，不需要额外操作
                                    });
                                    currentActions.triggerDiplomaticEvent(event);
                                }
                            }
                        }

                        // 检测和平请求事件
                        if (log.includes('请求和平')) {
                            console.log('[EVENT DEBUG] Peace request detected in log:', log);
                            const match = log.match(/🤝 (.+) 请求和平，愿意支付 (\d+) 银币作为赔款/);
                            console.log('[EVENT DEBUG] Regex match result:', match);
                            if (match) {
                                const nationName = match[1];
                                const tribute = parseInt(match[2], 10);
                                console.log('[EVENT DEBUG] Looking for nation:', nationName);
                                console.log('[EVENT DEBUG] result.nations:', result.nations?.map(n => ({ name: n.name, isPeaceRequesting: n.isPeaceRequesting })));
                                const nation = result.nations?.find(n => n.name === nationName);
                                console.log('[EVENT DEBUG] Found nation:', nation?.name, 'isPeaceRequesting:', nation?.isPeaceRequesting);
                                if (nation && nation.isPeaceRequesting) {
                                    console.log('[EVENT DEBUG] Creating peace request event...');
                                    console.log('[EVENT DEBUG] Parameters:', {
                                        nation: nation.name,
                                        nationId: nation.id,
                                        tribute,
                                        warScore: nation.warScore || 0,
                                        population: nation.population
                                    });
                                    try {
                                        const event = createEnemyPeaceRequestEvent(
                                            nation,
                                            tribute,
                                            nation.warScore || 0,
                                            (accepted, proposalType, amount) => {
                                                // 处理和平请求的回调
                                                if (accepted) {
                                                    currentActions.handleEnemyPeaceAccept(nation.id, proposalType, amount || tribute);
                                                } else {
                                                    currentActions.handleEnemyPeaceReject(nation.id);
                                                }
                                            }
                                        );
                                        console.log('[EVENT DEBUG] Event created:', event);
                                        console.log('[EVENT DEBUG] Calling triggerDiplomaticEvent...');
                                        currentActions.triggerDiplomaticEvent(event);
                                        console.log('[EVENT DEBUG] triggerDiplomaticEvent called');
                                    } catch (error) {
                                        console.error('[EVENT DEBUG] Error creating or triggering event:', error);
                                    }
                                    // 清除和平请求标志，避免重复触发
                                    setNations(prev => prev.map(n =>
                                        n.id === nation.id ? { ...n, isPeaceRequesting: false } : n
                                    ));
                                }
                            }
                        }

                        // 检测叛军投降事件
                        if (log.includes('请求投降')) {
                            const surrenderMatch = log.match(/🏳️ (.+) (?:已陷入绝境|已经崩溃)，(?:请求|恳求)投降/);
                            if (surrenderMatch) {
                                const nationName = surrenderMatch[1];
                                const nation = result.nations?.find(n => n.name === nationName && n.isRebelNation);
                                if (nation && nation.isPeaceRequesting) {
                                    console.log('[EVENT DEBUG] Rebel surrender detected:', nationName);
                                    // 创建叛军投降事件（直接使用叛乱结束事件）
                                    // 注意：回调只处理效果，不再调用 handleRebellionWarEnd 避免重复
                                    const surrenderEvent = createRebellionEndEvent(
                                        nation,
                                        true, // 玩家胜利
                                        current.resources?.silver || 0,
                                        (action) => {
                                            // 效果由事件本身的 effects 处理，这里只做日志
                                            console.log('[REBELLION SURRENDER]', action, nation?.name);
                                        }
                                    );
                                    currentActions.triggerDiplomaticEvent(surrenderEvent);

                                    // 直接处理叛军移除和状态重置（不再通过 handleRebellionWarEnd）
                                    const stratumKey = nation.rebellionStratum;
                                    if (stratumKey) {
                                        // 恢复部分人口
                                        const recoveredPop = Math.floor((nation.population || 0) * 0.5);
                                        if (recoveredPop > 0) {
                                            setPopStructure(prev => ({
                                                ...prev,
                                                [stratumKey]: (prev[stratumKey] || 0) + recoveredPop,
                                            }));
                                        }
                                        // 重置组织度
                                        setRebellionStates(prev => ({
                                            ...prev,
                                            [stratumKey]: {
                                                ...prev?.[stratumKey],
                                                organization: 15,
                                                dissatisfactionDays: 0,
                                                organizationPaused: 0,
                                            },
                                        }));
                                    }
                                    // 移除叛军
                                    setNations(prev => prev.filter(n => n.id !== nation.id));
                                }
                            }
                        }

                        // 检测叛军勒索/最后通牒事件
                        if (log.includes('REBEL_DEMAND_SURRENDER:')) {
                            try {
                                const jsonStr = log.replace('REBEL_DEMAND_SURRENDER:', '');
                                const data = JSON.parse(jsonStr);
                                const nation = result.nations?.find(n => n.id === data.nationId);
                                
                                if (nation) {
                                    const event = createRebelDemandSurrenderEvent(nation, data, (action, nationObj, eventData) => {
                                        console.log('[REBEL ULTIMATUM] Callback triggered:', action, eventData.demandType);
                                        if (action === 'accept') {
                                            // 1. 根据类型扣除资源
                                            if (eventData.demandType === 'massacre') {
                                                // 屠杀：扣除人口和人口上限
                                                const popLoss = eventData.demandAmount || 0;
                                                setPopulation(prev => Math.max(10, prev - popLoss));
                                                setMaxPop(prev => Math.max(20, prev - popLoss));
                                                addLog(`💀 叛军进行了大屠杀，你失去了 ${popLoss} 人口和人口上限！`);
                                                
                                                // 对应阶层人口也需减少
                                                const massacreStratumKey = nationObj.rebellionStratum;
                                                if (massacreStratumKey) {
                                                    setPopStructure(prev => ({
                                                        ...prev,
                                                        [massacreStratumKey]: Math.max(0, (prev[massacreStratumKey] || 0) - popLoss)
                                                    }));
                                                }
                                            } else if (eventData.demandType === 'reform') {
                                                // 改革妥协：一次性从国库扣除银币，转入该阶层的财富
                                                const reformAmount = eventData.demandAmount || 0;
                                                const coalitionStrata = eventData.coalitionStrata || [eventData.reformStratum || nationObj.rebellionStratum];
                                                console.log('[REBEL REFORM] Amount:', reformAmount, 'Coalition:', coalitionStrata);
                                                
                                                // 扣除银币
                                                setResources(prev => ({
                                                    ...prev,
                                                    silver: Math.max(0, (prev.silver || 0) - reformAmount)
                                                }));
                                                
                                                // 按人口比例分配给各阶层
                                                const popShare = {};
                                                let totalPop = 0;
                                                coalitionStrata.forEach(sKey => {
                                                    const pop = current.popStructure?.[sKey] || 0;
                                                    popShare[sKey] = pop;
                                                    totalPop += pop;
                                                });
                                                
                                                // 如果总人口为0，平均分配
                                                if (totalPop === 0) {
                                                    coalitionStrata.forEach(sKey => {
                                                        popShare[sKey] = 1;
                                                    });
                                                    totalPop = coalitionStrata.length;
                                                }
                                                
                                                // 将钱按比例转入各阶层财富
                                                const distributions = [];
                                                setClassWealth(prev => {
                                                    const newWealth = { ...prev };
                                                    coalitionStrata.forEach(sKey => {
                                                        const share = popShare[sKey] / totalPop;
                                                        const amount = Math.floor(reformAmount * share);
                                                        newWealth[sKey] = (newWealth[sKey] || 0) + amount;
                                                        distributions.push(`${STRATA[sKey]?.name || sKey}(${amount})`);
                                                    });
                                                    console.log('[REBEL REFORM] Distributed:', distributions.join(', '));
                                                    return newWealth;
                                                });
                                                
                                                const distribDesc = coalitionStrata.length > 1 
                                                    ? `（按比例分配给：${distributions.join('、')}）` 
                                                    : '';
                                                addLog(`💸 你接受了叛军的改革要求，支付了 ${reformAmount} 银币${distribDesc}。`);
                                            } else if (eventData.demandType === 'subsidy') {
                                                // 强制补贴：设置为期一年的每日补贴效果，按比例分配给所有联盟阶层
                                                const subsidyDaily = eventData.subsidyDailyAmount || Math.ceil((eventData.demandAmount || 0) / 365);
                                                const subsidyTotal = eventData.demandAmount || 0;
                                                const coalitionStrata = eventData.coalitionStrata || [eventData.subsidyStratum || nationObj.rebellionStratum];
                                                console.log('[REBEL SUBSIDY] Daily:', subsidyDaily, 'Total:', subsidyTotal, 'Coalition:', coalitionStrata);
                                                
                                                // 按人口比例计算每个阶层的份额
                                                const popShare = {};
                                                let totalPop = 0;
                                                coalitionStrata.forEach(sKey => {
                                                    const pop = current.popStructure?.[sKey] || 0;
                                                    popShare[sKey] = pop;
                                                    totalPop += pop;
                                                });
                                                
                                                // 如果总人口为0，平均分配
                                                if (totalPop === 0) {
                                                    coalitionStrata.forEach(sKey => {
                                                        popShare[sKey] = 1;
                                                    });
                                                    totalPop = coalitionStrata.length;
                                                }
                                                
                                                // 为每个阶层添加补贴效果
                                                const subsidyDescParts = [];
                                                setActiveEventEffects(prev => {
                                                    console.log('[REBEL SUBSIDY] Previous state:', prev);
                                                    
                                                    const newSubsidies = coalitionStrata.map(sKey => {
                                                        const share = popShare[sKey] / totalPop;
                                                        const dailyAmount = Math.floor(subsidyDaily * share);
                                                        const stratumName = STRATA[sKey]?.name || sKey;
                                                        subsidyDescParts.push(`${stratumName}(${dailyAmount}/天)`);
                                                        
                                                        return {
                                                            id: `rebel_subsidy_${nationObj.id}_${sKey}_${Date.now()}`,
                                                            type: 'rebel_forced_subsidy',
                                                            name: `对${stratumName}的强制补贴`,
                                                            description: `每日支付 ${dailyAmount} 银币给${stratumName}`,
                                                            stratumKey: sKey,
                                                            dailyAmount: dailyAmount,
                                                            remainingDays: 365,
                                                            createdAt: current.daysElapsed,
                                                        };
                                                    });
                                                    
                                                    const newEffects = {
                                                        ...prev,
                                                        forcedSubsidy: [
                                                            ...(prev?.forcedSubsidy || []),
                                                            ...newSubsidies
                                                        ]
                                                    };
                                                    console.log('[REBEL SUBSIDY] Added', newSubsidies.length, 'subsidies');
                                                    return newEffects;
                                                });
                                                
                                                const distribDesc = coalitionStrata.length > 1 
                                                    ? `（按比例分配给：${subsidyDescParts.join('、')}）` 
                                                    : `给${STRATA[coalitionStrata[0]]?.name || '起义阶层'}`;
                                                addLog(`📜 你接受了叛军的强制补贴要求，将在未来一年内每日支付 ${subsidyDaily} 银币${distribDesc}（共 ${subsidyTotal} 银币）。`);
                                            }

                                            // 2. 立即结束战争，移除叛军国家并重置状态
                                            // 使用 handleRebellionWarEnd 函数（与玩家主动求和使用相同的函数）
                                            // 这个函数会正确删除叛军、重置状态并触发"屈辱的和平"事件
                                            if (actions?.handleRebellionWarEnd) {
                                                console.log('[REBEL] Calling handleRebellionWarEnd for defeat...');
                                                actions.handleRebellionWarEnd(nationObj.id, false); // false = 玩家失败
                                            } else {
                                                console.error('[REBEL] handleRebellionWarEnd not available!');
                                                // 备用方案：手动清理
                                                const rebellionStratumKey = nationObj.rebellionStratum;
                                                setNations(prev => prev.filter(n => n.id !== nationObj.id));
                                                if (rebellionStratumKey) {
                                                    setRebellionStates(prev => ({
                                                        ...prev,
                                                        [rebellionStratumKey]: {
                                                            ...prev[rebellionStratumKey],
                                                            organization: 20,
                                                            dissatisfactionDays: 0,
                                                        }
                                                    }));
                                                }
                                                setStability(prev => Math.max(0, (prev || 50) - 20));
                                            }
                                        } else {
                                            addLog(`⚔️ 你拒绝了叛军的(${eventData.demandType})要求，战争继续！`);
                                        }
                                    });
                                    currentActions.triggerDiplomaticEvent(event);
                                }
                            } catch (e) {
                                console.error('[EVENT DEBUG] Failed to parse rebel demand:', e);
                            }
                        }

                        // 检测自动补兵损失事件
                        if (log.includes('AUTO_REPLENISH_LOSSES:') && autoRecruitEnabled) {
                            try {
                                const jsonStr = log.replace('AUTO_REPLENISH_LOSSES:', '');
                                const losses = JSON.parse(jsonStr);
                                
                                // 将损失的士兵加入训练队列
                                const replenishItems = [];
                                Object.entries(losses).forEach(([unitId, lossCount]) => {
                                    if (lossCount > 0) {
                                        const unit = UNIT_TYPES[unitId];
                                        if (unit && unit.epoch <= epoch) {
                                            const trainTime = unit.trainDays || 1;
                                            for (let i = 0; i < lossCount; i++) {
                                                replenishItems.push({
                                                    unitId,
                                                    status: 'waiting',
                                                    totalTime: trainTime,
                                                    remainingTime: trainTime,
                                                    isAutoReplenish: true,
                                                });
                                            }
                                        }
                                    }
                                });
                                
                                if (replenishItems.length > 0) {
                                    setMilitaryQueue(prev => [...prev, ...replenishItems]);
                                    const summary = Object.entries(losses)
                                        .filter(([_, count]) => count > 0)
                                        .map(([unitId, count]) => `${UNIT_TYPES[unitId]?.name || unitId} ×${count}`)
                                        .join('、');
                                    addLog(`🔄 自动补兵：${summary} 已加入训练队列。`);
                                }
                            } catch (e) {
                                console.error('[AUTO_REPLENISH] Failed to parse losses:', e);
                            }
                        }

                        // 检测 AI 送礼事件
                        if (log.includes('AI_GIFT_EVENT:')) {
                            try {
                                const jsonStr = log.replace('AI_GIFT_EVENT:', '');
                                const eventData = JSON.parse(jsonStr);
                                const nation = result.nations?.find(n => n.id === eventData.nationId);
                                if (nation && currentActions && currentActions.triggerDiplomaticEvent) {
                                    const event = createGiftEvent(nation, eventData.amount, () => {
                                        // 接受礼物的回调
                                        setResources(prev => ({ ...prev, silver: (prev.silver || 0) + eventData.amount }));
                                        setNations(prev => prev.map(n => n.id === nation.id ? { ...n, relation: Math.min(100, (n.relation || 0) + 15) } : n));
                                        addLog(`💰 你接受了 ${nation.name} 的礼物，获得 ${eventData.amount} 银币。`);
                                    });
                                    currentActions.triggerDiplomaticEvent(event);
                                    console.log('[EVENT DEBUG] AI Gift event triggered:', nation.name, eventData.amount);
                                }
                            } catch (e) {
                                console.error('[EVENT DEBUG] Failed to parse AI gift event:', e);
                            }
                        }

                        // 检测 AI 索要事件
                        if (log.includes('AI_REQUEST_EVENT:')) {
                            try {
                                const jsonStr = log.replace('AI_REQUEST_EVENT:', '');
                                const eventData = JSON.parse(jsonStr);
                                const nation = result.nations?.find(n => n.id === eventData.nationId);
                                if (nation && currentActions && currentActions.triggerDiplomaticEvent) {
                                    const event = createAIRequestEvent(nation, eventData.resourceKey, eventData.resourceName, eventData.amount, (accepted) => {
                                        if (accepted) {
                                            const currentSilver = current.resources?.silver || 0;
                                            if (currentSilver < eventData.amount) {
                                                addLog(`❌ 银币不足，无法满足 ${nation.name} 的请求！`);
                                                return;
                                            }
                                            setResources(prev => ({ ...prev, silver: (prev.silver || 0) - eventData.amount }));
                                            setNations(prev => prev.map(n => n.id === nation.id ? { ...n, relation: Math.min(100, (n.relation || 0) + 10) } : n));
                                            addLog(`🤝 你满足了 ${nation.name} 的请求，关系提升了。`);
                                        } else {
                                            setNations(prev => prev.map(n => n.id === nation.id ? { ...n, relation: Math.max(0, (n.relation || 0) - 15) } : n));
                                            addLog(`❌ 你拒绝了 ${nation.name} 的请求，关系恶化了。`);
                                        }
                                    });
                                    currentActions.triggerDiplomaticEvent(event);
                                    console.log('[EVENT DEBUG] AI Request event triggered:', nation.name, eventData.amount);
                                }
                            } catch (e) {
                                console.error('[EVENT DEBUG] Failed to parse AI request event:', e);
                            }
                        }

                        // 检测 AI 联盟请求事件
                        if (log.includes('AI_ALLIANCE_REQUEST:')) {
                            try {
                                const jsonStr = log.replace('AI_ALLIANCE_REQUEST:', '');
                                const eventData = JSON.parse(jsonStr);
                                const nation = result.nations?.find(n => n.id === eventData.nationId);
                                if (nation && currentActions && currentActions.triggerDiplomaticEvent) {
                                    const event = createAllianceRequestEvent(nation, (accepted) => {
                                        if (accepted) {
                                            setNations(prev => prev.map(n =>
                                                n.id === nation.id
                                                    ? { ...n, alliedWithPlayer: true, relation: Math.min(100, (n.relation || 0) + 20) }
                                                    : n
                                            ));
                                            addLog(`🤝 你接受了 ${nation.name} 的结盟请求！你们正式成为盟友！`);
                                        } else {
                                            setNations(prev => prev.map(n =>
                                                n.id === nation.id
                                                    ? { ...n, relation: Math.max(0, (n.relation || 0) - 10) }
                                                    : n
                                            ));
                                            addLog(`你婉言谢绝了 ${nation.name} 的结盟请求，关系略有下降。`);
                                        }
                                    });
                                    currentActions.triggerDiplomaticEvent(event);
                                    console.log('[EVENT DEBUG] AI Alliance Request event triggered:', nation.name);
                                }
                            } catch (e) {
                                console.error('[EVENT DEBUG] Failed to parse AI alliance request event:', e);
                            }
                        }

                        // 检测盟友冷淡事件
                        if (log.includes('ALLY_COLD_EVENT:')) {
                            try {
                                const jsonStr = log.replace('ALLY_COLD_EVENT:', '');
                                const eventData = JSON.parse(jsonStr);
                                const nation = result.nations?.find(n => n.id === eventData.nationId);
                                if (nation && currentActions && currentActions.triggerDiplomaticEvent) {
                                    const event = createAllyColdEvent(nation, eventData.relation, (action, giftCost) => {
                                        if (action === 'gift') {
                                            // 检查银币是否足够
                                            const currentSilver = current.resources?.silver || 0;
                                            if (currentSilver < giftCost) {
                                                addLog(`❌ 银币不足，无法向 ${nation.name} 赠送礼物！`);
                                                return;
                                            }
                                            setResources(prev => ({ ...prev, silver: (prev.silver || 0) - giftCost }));
                                            setNations(prev => prev.map(n =>
                                                n.id === nation.id
                                                    ? { ...n, relation: Math.min(100, (n.relation || 0) + 15) }
                                                    : n
                                            ));
                                            addLog(`💝 你向盟友 ${nation.name} 赠送了礼物，关系改善了（+15）。`);
                                        } else {
                                            // 不管：关系继续下降，增加解盟风险
                                            setNations(prev => prev.map(n =>
                                                n.id === nation.id
                                                    ? { ...n, relation: Math.max(0, (n.relation || 0) - 5), allianceStrain: ((n.allianceStrain || 0) + 1) }
                                                    : n
                                            ));
                                            addLog(`😐 你忽视了盟友 ${nation.name} 的关系问题，同盟关系出现裂痕。`);
                                        }
                                    });
                                    currentActions.triggerDiplomaticEvent(event);
                                    console.log('[EVENT DEBUG] Ally Cold event triggered:', nation.name);
                                }
                            } catch (e) {
                                console.error('[EVENT DEBUG] Failed to parse Ally Cold event:', e);
                            }
                        }

                        // 检测AI贸易事件（资源变化已在simulation中处理，这里只需记录和显示）
                        if (log.includes('AI_TRADE_EVENT:')) {
                            try {
                                const jsonStr = log.replace('AI_TRADE_EVENT:', '');
                                const eventData = JSON.parse(jsonStr);
                                const resourceName = RESOURCES[eventData.resourceKey]?.name || eventData.resourceKey;

                                // 将关税计入tradeStats，显示在财政面板中
                                if (eventData.tariff > 0) {
                                    setTradeStats(prev => ({ ...prev, tradeTax: (prev.tradeTax || 0) + eventData.tariff }));
                                }

                                // 生成详细的贸易日志（玩家政府只收关税）
                                if (eventData.tradeType === 'export') {
                                    // 玩家出口：资源减少，只收关税
                                    if (eventData.tariff > 0) {
                                        addLog(`📦 ${eventData.nationName} 从你的市场购买了 ${eventData.quantity} ${resourceName}，你收取 ${eventData.tariff} 关税。`);
                                    } else {
                                        addLog(`📦 ${eventData.nationName} 从你的市场购买了 ${eventData.quantity} ${resourceName}（开放市场，无关税）。`);
                                    }
                                } else if (eventData.tradeType === 'import') {
                                    // 玩家进口：资源增加，只收关税
                                    if (eventData.tariff > 0) {
                                        addLog(`📦 ${eventData.nationName} 向你的市场出售了 ${eventData.quantity} ${resourceName}，你收取 ${eventData.tariff} 关税。`);
                                    } else {
                                        addLog(`📦 ${eventData.nationName} 向你的市场出售了 ${eventData.quantity} ${resourceName}（开放市场，无关税）。`);
                                    }
                                } else {
                                    // 旧版兼容
                                    if (eventData.tariff > 0) {
                                        addLog(`📦 ${eventData.nationName} 与你进行了贸易，你收取 ${eventData.tariff} 关税。`);
                                    }
                                }
                            } catch (e) {
                                console.error('[EVENT DEBUG] Failed to parse AI Trade event:', e);
                            }
                        }

                        // 检测AI要求投降事件
                        if (log.includes('AI_DEMAND_SURRENDER:')) {
                            try {
                                const jsonStr = log.replace('AI_DEMAND_SURRENDER:', '');
                                const eventData = JSON.parse(jsonStr);
                                const nation = result.nations?.find(n => n.id === eventData.nationId);
                                if (nation && currentActions && currentActions.triggerDiplomaticEvent) {
                                    const event = createAIDemandSurrenderEvent(
                                        nation,
                                        eventData.warScore,
                                        { type: eventData.demandType, amount: eventData.demandAmount },
                                        (accepted) => {
                                            if (accepted) {
                                                // 玩家接受投降条件
                                                if (eventData.demandType === 'tribute') {
                                                    // 验证玩家是否有足够银币
                                                    const currentSilver = current.resources?.silver || 0;
                                                    if (currentSilver < eventData.demandAmount) {
                                                        addLog(`❌ 银币不足（需要 ${eventData.demandAmount}，当前 ${Math.floor(currentSilver)}），无法接受投降条件！`);
                                                        return;
                                                    }
                                                    setResources(prev => ({ ...prev, silver: Math.max(0, (prev.silver || 0) - eventData.demandAmount) }));
                                                    addLog(`💰 你向 ${nation.name} 支付了 ${eventData.demandAmount} 银币赔款。`);
                                                } else if (eventData.demandType === 'territory') {
                                                    // 验证玩家是否有足够人口
                                                    const currentPop = current.population || 0;
                                                    if (currentPop < eventData.demandAmount + 10) {  // 保留最低 10 人口
                                                        addLog(`❌ 人口不足（需要 ${eventData.demandAmount}，当前 ${Math.floor(currentPop)}），无法接受投降条件！`);
                                                        return;
                                                    }
                                                    setPopulation(prev => Math.max(10, prev - eventData.demandAmount));
                                                    setMaxPop(prev => Math.max(10, prev - eventData.demandAmount));
                                                    addLog(`🏴 你向 ${nation.name} 割让了 ${eventData.demandAmount} 人口的领土。`);
                                                } else if (eventData.demandType === 'open_market') {
                                                    // 设置开放市场状态（玩家开放市场给AI）
                                                    addLog(`📖 你同意向 ${nation.name} 开放市场 ${Math.round(eventData.demandAmount / 365)} 年。`);
                                                }
                                                // 结束战争
                                                setNations(prev => prev.map(n => n.id === nation.id ? { ...n, isAtWar: false, warScore: 0, warDuration: 0, peaceTreatyUntil: current.daysElapsed + 365 } : n));
                                            } else {
                                                addLog(`⚔️ 你拒绝了 ${nation.name} 的投降要求，战争继续！`);
                                            }
                                        }
                                    );
                                    currentActions.triggerDiplomaticEvent(event);
                                    console.log('[EVENT DEBUG] AI Demand Surrender event triggered:', nation.name);
                                }
                            } catch (e) {
                                console.error('[EVENT DEBUG] Failed to parse AI Demand Surrender event:', e);
                            }
                        }

                        // 检测AI解除联盟事件
                        if (log.includes('AI_BREAK_ALLIANCE:')) {
                            try {
                                const jsonStr = log.replace('AI_BREAK_ALLIANCE:', '');
                                const eventData = JSON.parse(jsonStr);
                                const reasonText = eventData.reason === 'relation_low'
                                    ? '由于双方关系恶化'
                                    : '由于你多次忽视盟友问题';
                                addLog(`💔 ${reasonText}，${eventData.nationName} 决定解除与你的同盟关系！`);
                            } catch (e) {
                                console.error('[EVENT DEBUG] Failed to parse AI Break Alliance event:', e);
                            }
                        }

                        // 检测盟友被攻击事件
                        if (log.includes('ALLY_ATTACKED_EVENT:')) {
                            try {
                                const jsonStr = log.replace('ALLY_ATTACKED_EVENT:', '');
                                const eventData = JSON.parse(jsonStr);
                                const ally = result.nations?.find(n => n.id === eventData.allyId);
                                const attacker = result.nations?.find(n => n.id === eventData.attackerId);
                                if (ally && attacker && currentActions && currentActions.triggerDiplomaticEvent) {
                                    const event = createAllyAttackedEvent(
                                        ally,
                                        attacker,
                                        (helped) => {
                                            if (helped) {
                                                // 玩家选择援助盟友，对攻击者宣战
                                                setNations(prev => prev.map(n => {
                                                    if (n.id === attacker.id) {
                                                        return {
                                                            ...n,
                                                            isAtWar: true,
                                                            warStartDay: current.daysElapsed,
                                                            warDuration: 0,
                                                            relation: Math.max(0, (n.relation || 50) - 40),
                                                            lootReserve: (n.wealth || 500) * 1.5, // 初始化掠夺储备
                                                            lastMilitaryActionDay: undefined, // 重置军事行动冷却
                                                        };
                                                    }
                                                    return n;
                                                }));
                                                addLog(`⚔️ 你决定援助盟友 ${ally.name}，对 ${attacker.name} 宣战！`);
                                            } else {
                                                // 玩家拒绝援助：关系大幅下降、联盟终止、背叛者声誉
                                                setNations(prev => prev.map(n => {
                                                    if (n.id === ally.id) {
                                                        return {
                                                            ...n,
                                                            relation: Math.max(0, (n.relation || 50) - 30),
                                                            alliedWithPlayer: false
                                                        };
                                                    }
                                                    // 其他国家也对玩家印象变差
                                                    return {
                                                        ...n,
                                                        relation: Math.max(0, (n.relation || 50) - 5)
                                                    };
                                                }));
                                                addLog(`💔 你拒绝援助盟友 ${ally.name}，${ally.name} 解除与你的联盟！你获得了“背叛者”的声誉。`);
                                            }
                                        }
                                    );
                                    currentActions.triggerDiplomaticEvent(event);
                                    console.log('[EVENT DEBUG] Ally Attacked event triggered:', ally.name);
                                }
                            } catch (e) {
                                console.error('[EVENT DEBUG] Failed to parse Ally Attacked event:', e);
                            }
                        }



                    });
                }
            }

            // 处理训练队列
            setMilitaryQueue(prev => {
                const baseQueue = queueOverrideForManpower || prev;
                const currentSoldierPop = (soldierPopulationAfterEvents ?? result.popStructure?.soldier) || 0;
                const currentArmyCount = Object.values(armyStateForQueue || {}).reduce((sum, count) => sum + count, 0);

                // 计算有多少岗位可以用于新训练
                // 只计算已有军队和正在训练的，waiting状态的就是等待转为training的
                const waitingCount = baseQueue.filter(item => item.status === 'waiting').length;
                const trainingCount = baseQueue.filter(item => item.status === 'training').length;
                const occupiedJobs = currentArmyCount + trainingCount;
                const availableJobsForNewTraining = Math.max(0, currentSoldierPop - occupiedJobs);

                // console.log('[TRAINING QUEUE] currentSoldierPop:', currentSoldierPop, 'currentArmyCount:', currentArmyCount, 'waitingCount:', waitingCount, 'trainingCount:', trainingCount, 'occupiedJobs:', occupiedJobs, 'availableJobsForNewTraining:', availableJobsForNewTraining); // Commented for performance

                // 将等待中的项转为训练中（如果有可用岗位）
                let jobsToFill = availableJobsForNewTraining;
                const updated = baseQueue.map(item => {
                    if (item.status === 'waiting' && jobsToFill > 0) {
                        jobsToFill--;
                        addLog(`✓ ${UNIT_TYPES[item.unitId].name} 开始训练，需要 ${item.totalTime} 秒`);
                        return {
                            ...item,
                            status: 'training',
                            remainingTime: item.totalTime
                        };
                    }
                    // 只对训练中的项进行倒计时
                    if (item.status === 'training') {
                        return {
                            ...item,
                            remainingTime: item.remainingTime - 1
                        };
                    }
                    return item;
                });

                // 找出已完成的训练
                const completed = updated.filter(item => item.status === 'training' && item.remainingTime <= 0);
                if (completed.length > 0) {
                    // 将完成的单位加入军队
                    setArmy(prevArmy => {
                        const newArmy = { ...prevArmy };
                        completed.forEach(item => {
                            newArmy[item.unitId] = (newArmy[item.unitId] || 0) + 1;
                        });
                        return newArmy;
                    });

                    // 添加完成日志
                    completed.forEach(item => {
                        addLog(`✓ ${UNIT_TYPES[item.unitId].name} 训练完成！`);
                    });
                }

                // 返回未完成的训练（排除已完成的）
                return updated.filter(item => !(item.status === 'training' && item.remainingTime <= 0));
            });
        }, tickInterval); // 根据游戏速度动态调整执行频率

        return () => clearInterval(timer);
    }, [gameSpeed, isPaused, army, activeFestivalEffects, setFestivalModal, setActiveFestivalEffects, setLastFestivalYear, lastFestivalYear, setIsPaused]); // 依赖游戏速度、暂停状态、军队状态和庆典相关状态
};
