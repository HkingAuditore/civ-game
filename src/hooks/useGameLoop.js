// 游戏循环钩子
// 处理游戏的核心循环逻辑，包括资源生产、人口增长等

import { useEffect, useRef, useState } from 'react';
import { unstable_batchedUpdates } from 'react-dom';
import { useSimulationWorker } from './useSimulationWorker';
import {
    BUILDINGS,
    calculateArmyPopulation,
    UNIT_TYPES,
    STRATA,
    RESOURCES,
    LOG_STORAGE_LIMIT,
    HISTORY_STORAGE_LIMIT,
    ORGANIZATION_EFFECTS,
    OPEN_MARKET_TREATY_TYPES,
    PEACE_TREATY_TYPES
} from '../config';
import { getBuildingEffectiveConfig } from '../config/buildingUpgrades';
import { getRandomFestivalEffects } from '../config/festivalEffects';
import { initCheatCodes } from './cheatCodes';
import { getCalendarInfo } from '../utils/calendar';
import {
    createEnemyPeaceRequestEvent,
    createWarDeclarationEvent,
    createGiftEvent,
    createAIRequestEvent,
    createAllianceRequestEvent,
    createOrganizationInviteEvent,
    createTreatyProposalEvent,
    createTreatyBreachEvent,
    createAllyColdEvent,
    createAIDemandSurrenderEvent,
    createAllyAttackedEvent,
    createRebelDemandSurrenderEvent,
    createIndependenceWarEvent,
    createOverseasInvestmentOpportunityEvent,
    createNationalizationThreatEvent,
    createTradeDisputeEvent,
    createMilitaryAllianceInviteEvent,
    createBorderIncidentEvent,
    createVassalRequestEvent,
    REBEL_DEMAND_SURRENDER_TYPE,
} from '../config/events';
import { calculateTotalDailySalary, getCabinetStatus, calculateOfficialCapacity } from '../logic/officials/manager';
import { processDecreeExpiry, getAllTimedDecrees } from '../logic/officials/cabinetSynergy';
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
import { debugLog, debugError, isDebugEnabled } from '../utils/debugFlags';
// 叛乱事件（保留事件创建函数）
import {
    hasAvailableMilitary,
    isMilitaryRebelling,
    REBELLION_PHASE,
    createBrewingEvent,
    createPlottingEvent,
    createActiveRebellionEvent,
    createOfficialCoupEvent,
    createOfficialCoupNation,
    createRebelNation,
    createRebellionEndEvent,
} from '../logic/rebellionSystem';
import { getTreatyDailyMaintenance, INDEPENDENCE_CONFIG } from '../config/diplomacy';
import { processVassalUpdates } from '../logic/diplomacy/vassalSystem';
import { checkVassalRequests } from '../logic/diplomacy/aiDiplomacy';
import { LOYALTY_CONFIG } from '../config/officials';
import { updateAllOfficialsDaily } from '../logic/officials/progression';
// 经济指标系统
import {
    updatePriceHistory,
    calculateEquilibriumPrices,
    calculateAllIndicators,
    getBasePrices,
    ECONOMIC_INDICATOR_CONFIG,
} from '../logic/economy/economicIndicators';

const calculateRebelPopulation = (stratumPop = 0) => {
    if (!Number.isFinite(stratumPop) || stratumPop <= 0) return 0;
    return Math.min(stratumPop, Math.max(1, Math.floor(stratumPop * 0.8)));
};

const getUnitPopulationCost = (unitId) => {
    const unit = UNIT_TYPES[unitId];
    return unit?.populationCost || 1;
};

const getMilitaryCapacity = (buildingState = {}) => {
    let capacity = 0;
    Object.entries(buildingState || {}).forEach(([buildingId, count]) => {
        if (!count) return;
        const building = BUILDINGS.find(b => b.id === buildingId);
        if (building?.output?.militaryCapacity) {
            capacity += building.output.militaryCapacity * count;
        }
    });
    return capacity;
};

const getTotalArmyCount = (armyState = {}, queueState = []) => {
    const armyCount = Object.values(armyState || {}).reduce((sum, count) => sum + (count || 0), 0);
    const queueCount = Array.isArray(queueState) ? queueState.length : 0;
    return armyCount + queueCount;
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
 * [FIX] 移除 autoRecruitEnabled 参数 - 人口不足解散不再触发自动补兵
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
    // [FIX] 减小容差值，防止长期超员导致无限爆兵
    // 只保留1点容差用于处理毕业时的时序问题
    const trainingTolerance = 1;
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
    // [FIX] 移除 unitsToRequeue 逻辑 - 人口不足导致的解散不应触发自动补兵
    // 只有战斗损失(通过 AUTO_REPLENISH_LOSSES 日志)才应触发自动补兵

    // [FIX] 减小容差值，只为即将毕业的单位保留容差
    // 基础容差从3减到1，防止长期超员导致无限爆兵
    let toleranceForNewGraduates = 1; // Base tolerance for population allocation lag
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
        updatedArmy = { ...safeArmy };
        removedUnits = {};

        // [FIX] 移除自动重新排队逻辑 - 人口不足导致的解散是真正的解散
        // 不应该消耗资源重新招募，这样做会导致无限循环

        const armyEntries = Object.entries(updatedArmy)
            .filter(([, count]) => count > 0)
            .map(([unitId, count]) => ({
                unitId,
                count,
                popCost: getUnitPopulationCost(unitId),
                epoch: UNIT_TYPES[unitId]?.epoch ?? 0,
                trainingTime: UNIT_TYPES[unitId]?.trainingTime || 1, // [NEW] 记录训练时间用于重新排队
            }))
            .sort((a, b) => {
                // 优先解散人口消耗高的单位
                if (a.popCost === b.popCost) {
                    return a.epoch - b.epoch;
                }
                return b.popCost - a.popCost;
            });

        for (const entry of armyEntries) {
            if (manpowerToRemove <= 0) break;
            const { unitId, popCost, trainingTime } = entry;
            const removable = Math.min(entry.count, Math.ceil(manpowerToRemove / popCost));
            if (removable <= 0) continue;

            updatedArmy[unitId] -= removable;
            manpowerToRemove -= removable * popCost;

            if (updatedArmy[unitId] <= 0) {
                delete updatedArmy[unitId];
            }

            removedUnits[unitId] = (removedUnits[unitId] || 0) + removable;

            // [FIX] 已移除自动重新排队逻辑
            // 人口不足导致的解散不应触发自动补兵
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
        // [FIX] 已移除 unitsToRequeue - 人口不足解散不应触发自动补兵
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
        setBuildings,
        population,
        popStructure,
        setPopulation,
        birthAccumulator,
        setBirthAccumulator,
        epoch,
        techsUnlocked,
        activeDecrees, // [NEW] Active Reform Decrees
        setActiveDecrees, // [NEW] Setter for active decrees
        quotaTargets, // [NEW] Planned Economy Targets
        expansionSettings, // [NEW] Free Market Settings
        priceControls, // [NEW] 价格管制设置
        decrees,
        gameSpeed,
        isPaused,
        setIsPaused,
        nations,
        setNations,
        diplomaticReputation,
        setDiplomaticReputation,
        setPopStructure,
        setMaxPop,
        maxPopBonus,
        setRates,
        setTaxes,
        setClassApproval,
        classApproval,
        setApprovalBreakdown, // [NEW] 用于保存 simulation 返回的满意度分解数据
        setClassInfluence,
        setClassWealth,
        setClassWealthDelta,
        setClassIncome,
        setClassExpense,
        setClassFinancialData, // Detailed financial data setter
        setBuildingFinancialData, // Per-building realized financial data setter
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
        migrationCooldowns,
        setMigrationCooldowns,
        taxShock,
        setTaxShock,
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
        buildingJobsRequired,
        setBuildingJobsRequired,
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
        // 经济指标
        priceHistory,
        setPriceHistory,
        equilibriumPrices,
        setEquilibriumPrices,
        economicIndicators,
        setEconomicIndicators,
        autoSaveInterval,
        isAutoSaveEnabled,
        lastAutoSaveTime,
        saveGame,
        merchantState,
        setMerchantState,
        tradeRoutes,
        setTradeRoutes,
        diplomacyOrganizations,
        vassalDiplomacyQueue,
        setVassalDiplomacyQueue,
        vassalDiplomacyHistory,
        setVassalDiplomacyHistory,
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
        setBuildingUpgrades, // For owner auto-upgrade
        autoRecruitEnabled,
        targetArmyComposition,
        rulingCoalition, // 执政联盟成员
        legitimacy, // 当前合法性值
        setLegitimacy, // 合法性更新函数
        setModifiers, // Modifiers更新函数
        difficulty, // 游戏难度
        officials, // 官员系统
        setOfficials, // 官员状态更新函数
        officialsSimCursor,
        setOfficialsSimCursor,
        officialCapacity, // 官员容量
        setOfficialCapacity, // 官员容量更新函数
        ministerAssignments,
        ministerAutoExpansion,
        lastMinisterExpansionDay,
        setLastMinisterExpansionDay,
        setFiscalActual, // [NEW] realized fiscal numbers per tick
        setDailyMilitaryExpense, // [NEW] store simulation military expense for UI
        overseasInvestments, // 海外投资列表
        setOverseasInvestments, // 海外投资更新函数
        setDiplomacyOrganizations, // [FIX] Add missing setter
        foreignInvestments, // [NEW] 用于 simulation 计算
        setForeignInvestments, // [FIX] Destructure setter
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
        diplomacyOrganizations,
        vassalDiplomacyQueue,
        vassalDiplomacyHistory,
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
        rulingCoalition, // 执政联盟成员
        legitimacy, // 当前合法性值
        difficulty, // 游戏难度
        officials,
        officialCapacity, // [FIX] 添加官员容量，用于 getCabinetStatus 计算
        ministerAssignments,
        ministerAutoExpansion,
        lastMinisterExpansionDay,
        activeDecrees, // [NEW] Pass activeDecrees to simulation
        quotaTargets, // [NEW] Planned Economy targets
        expansionSettings, // [NEW] Free Market settings
        priceControls, // [NEW] 价格管制设置
    });

    const saveGameRef = useRef(gameState.saveGame);
    const autoReplenishTickRef = useRef({ day: null, key: '' });
    const capacityTrimLogRef = useRef({ day: null });
    const AUTO_RECRUIT_BATCH_LIMIT = 3;
    const AUTO_RECRUIT_FAIL_COOLDOWN = 5000;
    const perfLogRef = useRef({ lastLogDay: null, didLogOnce: false });
    const PERF_SLOW_THRESHOLD_MS = 50;
    const PERF_LOG_INTERVAL_DAYS = 10;
    const simInFlightRef = useRef(false);

    // [FIX] Overseas Investment Ref to track latest state updates
    const overseasInvestmentsRef = useRef(overseasInvestments);
    useEffect(() => {
        overseasInvestmentsRef.current = overseasInvestments;
    }, [overseasInvestments]);

    // [NEW] 海外投资分批处理状态追踪
    const outboundInvestmentBatchRef = useRef({ offset: 0, lastProcessDay: null });
    const inboundInvestmentBatchRef = useRef({ offset: 0, lastProcessDay: null }); // [NEW] 外国对我国投资

    // ========== 历史数据 Ref 管理 ==========
    // 使用 Ref 存储高频更新的历史数据，避免每帧触发 React 重渲染
    // 仅在节流间隔到达时同步到 State 供 UI 显示
    const classWealthHistoryRef = useRef(classWealthHistory || {});
    const classNeedsHistoryRef = useRef(classNeedsHistory || {});
    const marketHistoryRef = useRef({
        price: market?.priceHistory || {},
        supply: market?.supplyHistory || {},
        demand: market?.demandHistory || {},
    });

    // 初始化/同步 Ref
    useEffect(() => {
        if (classWealthHistory) classWealthHistoryRef.current = classWealthHistory;
    }, []); // 仅挂载时同步，后续由 loop 维护

    useEffect(() => {
        if (classNeedsHistory) classNeedsHistoryRef.current = classNeedsHistory;
    }, []);

    useEffect(() => {
        if (market?.priceHistory) {
            marketHistoryRef.current = {
                price: market.priceHistory || {},
                supply: market.supplyHistory || {},
                demand: market.demandHistory || {},
            };
        }
    }, []);

    // ========== 历史数据节流 ==========
    // 每 HISTORY_UPDATE_INTERVAL 个 tick 才更新一次历史数据 State
    const historyUpdateCounterRef = useRef(0);
    const HISTORY_UPDATE_INTERVAL = 5; // 每5个tick同步一次历史数据到UI（显著减少重渲染）

    const { runSimulation } = useSimulationWorker();

    useEffect(() => {
        saveGameRef.current = gameState.saveGame;
    }, [gameState.saveGame]);

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
            migrationCooldowns,
            taxShock,
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
            diplomacyOrganizations,
            vassalDiplomacyQueue,
            vassalDiplomacyHistory,
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
            rulingCoalition, // 执政联盟成员
            legitimacy, // 当前合法性值
            difficulty, // 游戏难度
            officials,
            officialsSimCursor,
            // [FIX] 添加内阁机制所需的状态
            activeDecrees, // 当前生效的改革法令
            expansionSettings, // 自由市场扩张设置
            quotaTargets, // 计划经济目标配额
            officialCapacity, // 官员容量
            ministerAssignments,
            ministerAutoExpansion,
            lastMinisterExpansionDay,
            priceControls, // [NEW] 计划经济价格管制设置
            foreignInvestments, // [NEW] 海外投资
            diplomaticReputation, // [FIX] 外交声誉
        };
    }, [resources, market, buildings, buildingUpgrades, population, popStructure, maxPopBonus, epoch, techsUnlocked, decrees, gameSpeed, nations, livingStandardStreaks, migrationCooldowns, taxShock, army, militaryQueue, jobFill, jobsAvailable, activeBuffs, activeDebuffs, taxPolicies, classWealthHistory, classNeedsHistory, militaryWageRatio, classApproval, daysElapsed, activeFestivalEffects, lastFestivalYear, isPaused, autoSaveInterval, isAutoSaveEnabled, lastAutoSaveTime, merchantState, tradeRoutes, diplomacyOrganizations, vassalDiplomacyQueue, vassalDiplomacyHistory, tradeStats, actions, actionCooldowns, actionUsage, promiseTasks, activeEventEffects, eventEffectSettings, rebellionStates, classInfluence, totalInfluence, birthAccumulator, stability, rulingCoalition, legitimacy, difficulty, officials, officialsSimCursor, activeDecrees, expansionSettings, quotaTargets, officialCapacity, ministerAssignments, ministerAutoExpansion, lastMinisterExpansionDay, priceControls, foreignInvestments, diplomaticReputation]);
    // Note: classWealth is intentionally excluded from dependencies to prevent infinite loop
    // when setClassWealth is called inside Promise chains within this effect.
    // The latest classWealth value is available via stateRef.current.classWealth

    // 监听国家列表变化，自动清理无效的贸易路线和商人派驻（修复暂停状态下无法清理的问题）
    const lastCleanupRef = useRef({ tradeRoutesLength: 0, merchantAssignmentsKeys: '', pendingTradesLength: 0 });

    useEffect(() => {
        if (!nations) return;

        // Filter valid nations (exclude annexed and zero-population nations)
        const validNationIds = new Set(
            nations
                .filter(n => !n.isAnnexed && (n.population || 0) > 0)
                .map(n => n.id)
        );

        let needsUpdate = false;

        // Clean up trade routes
        if (tradeRoutes?.routes?.length) {
            const currentLength = tradeRoutes.routes.length;
            if (currentLength !== lastCleanupRef.current.tradeRoutesLength) {
                const validRoutes = tradeRoutes.routes.filter(r => validNationIds.has(r.nationId));
                if (validRoutes.length !== currentLength) {
                    setTradeRoutes(prev => ({
                        ...prev,
                        routes: validRoutes
                    }));
                    lastCleanupRef.current.tradeRoutesLength = validRoutes.length;
                    needsUpdate = true;
                } else {
                    lastCleanupRef.current.tradeRoutesLength = currentLength;
                }
            }
        }

        // Clean up merchant assignments
        if (merchantState?.merchantAssignments && typeof merchantState.merchantAssignments === 'object') {
            const assignments = merchantState.merchantAssignments;
            const currentKeys = Object.keys(assignments).sort().join(',');

            if (currentKeys !== lastCleanupRef.current.merchantAssignmentsKeys) {
                const validAssignments = {};
                let hasInvalidAssignments = false;

                Object.entries(assignments).forEach(([nationId, count]) => {
                    if (validNationIds.has(nationId)) {
                        validAssignments[nationId] = count;
                    } else {
                        hasInvalidAssignments = true;
                    }
                });

                if (hasInvalidAssignments) {
                    // [FIX] If all assignments are invalid, clear merchantAssignments completely
                    // This allows the system to rebuild assignments from scratch
                    const finalAssignments = Object.keys(validAssignments).length > 0
                        ? validAssignments
                        : {};

                    setMerchantState(prev => ({
                        ...prev,
                        merchantAssignments: finalAssignments
                    }));
                    lastCleanupRef.current.merchantAssignmentsKeys = Object.keys(finalAssignments).sort().join(',');
                    needsUpdate = true;

                    // Log cleanup action
                    if (Object.keys(validAssignments).length === 0) {
                        console.log('[商人系统] 已清空所有无效的商人派驻，系统将重新分配商人');
                    }
                } else {
                    lastCleanupRef.current.merchantAssignmentsKeys = currentKeys;
                }
            }
        }

        // Clean up pending trades with destroyed nations
        if (merchantState?.pendingTrades && Array.isArray(merchantState.pendingTrades)) {
            const currentLength = merchantState.pendingTrades.length;

            if (currentLength !== lastCleanupRef.current.pendingTradesLength) {
                const validPendingTrades = merchantState.pendingTrades.filter(trade =>
                    !trade.partnerId || validNationIds.has(trade.partnerId)
                );

                if (validPendingTrades.length !== currentLength) {
                    setMerchantState(prev => ({
                        ...prev,
                        pendingTrades: validPendingTrades
                    }));
                    lastCleanupRef.current.pendingTradesLength = validPendingTrades.length;
                    needsUpdate = true;
                } else {
                    lastCleanupRef.current.pendingTradesLength = currentLength;
                }
            }
        }
    }, [nations, tradeRoutes, merchantState, setTradeRoutes, setMerchantState]);

    // 游戏核心循环
    useEffect(() => {
        // 初始化作弊码系统
        if (process.env.NODE_ENV !== 'production') {
            initCheatCodes(gameState, addLog, { setMerchantState, setTradeRoutes });
        }

        // 暂停时不设置游戏循环定时器，但自动保存定时器需要单独处理
        if (isPaused) {
            // 设置独立的自动保存定时器（每60秒检查一次）
            const autoSaveTimer = setInterval(() => {
                const current = stateRef.current;
                if (current.isAutoSaveEnabled) {
                    const intervalSeconds = Math.max(60, current.autoSaveInterval || 60);
                    const elapsed = Date.now() - (current.lastAutoSaveTime || 0);
                    if (elapsed >= intervalSeconds * 1000 && saveGameRef.current) {
                        saveGameRef.current({ source: 'auto' });
                        stateRef.current.lastAutoSaveTime = Date.now();
                    }
                }
            }, 60000);

            return () => clearInterval(autoSaveTimer);
        }

        // 计算 Tick 间隔：基于游戏速度动态调整
        // 1倍速 = 1000ms，2倍速 = 500ms，5倍速 = 200ms
        const tickInterval = 1000 / Math.max(1, gameSpeed);

        const timer = setInterval(() => {
            const current = stateRef.current;

            // 自动存档检测：即使暂停也照常运行，避免长时间停留丢进度
            if (current.isAutoSaveEnabled) {
                const intervalSeconds = Math.max(60, current.autoSaveInterval || 60);
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

            // check activeFestivalEffects expiration
            const currentFestivalEffects = current.activeFestivalEffects || [];
            if (currentFestivalEffects.length > 0) {
                const currentDay = current.daysElapsed || 0;
                let hasChange = false;

                const remainingEffects = currentFestivalEffects.filter(effect => {
                    if (effect.type === 'permanent') return true;

                    const duration = effect.duration || 360;
                    const activatedAt = effect.activatedAt !== undefined ? effect.activatedAt : currentDay;
                    const elapsed = currentDay - activatedAt;

                    if (elapsed >= duration) {
                        hasChange = true;
                        addLog(`庆典「${effect.name}」的影响已消退。`);
                        return false;
                    }
                    return true;
                });

                if (hasChange) {
                    setActiveFestivalEffects(remainingEffects);
                    // Update local reference so current tick uses correct effects
                    current.activeFestivalEffects = remainingEffects;
                }
            }

            // [NEW] 处理法令过期
            const currentActiveDecrees = current.activeDecrees || {};
            if (Object.keys(currentActiveDecrees).length > 0) {
                const currentDay = current.daysElapsed || 0;
                const { updatedDecrees, expiredDecrees } = processDecreeExpiry(currentActiveDecrees, currentDay);

                if (expiredDecrees.length > 0) {
                    // 更新法令状态
                    setActiveDecrees(updatedDecrees);
                    // 更新本地引用以确保当前tick使用正确的法令状态
                    current.activeDecrees = updatedDecrees;
                    stateRef.current.activeDecrees = updatedDecrees;

                    // 记录过期法令日志
                    expiredDecrees.forEach(decreeId => {
                        const decree = getAllTimedDecrees()[decreeId];
                        const decreeName = decree?.name || decreeId;
                        addLog(`法令「${decreeName}」已到期结束。`);
                    });
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

            // 官员薪水计算
            const officialDailySalary = calculateTotalDailySalary(current.officials || []);
            const canAffordOfficials = (current.resources?.silver || 0) >= officialDailySalary;

            // Build simulation parameters - 手动列出可序列化字段，排除函数对象（如 actions）
            // 这样可以正确启用 Web Worker 加速，避免 DataCloneError
            const simulationParams = {
                // 基础游戏数据
                resources: current.resources,
                market: current.market,
                buildings: current.buildings,
                buildingUpgrades: current.buildingUpgrades,
                population: current.population,
                popStructure: current.popStructure,
                birthAccumulator: current.birthAccumulator,
                maxPopBonus: current.maxPopBonus,
                epoch: current.epoch,
                techsUnlocked: current.techsUnlocked,
                decrees: current.decrees,
                nations: current.nations,
                diplomacyOrganizations: current.diplomacyOrganizations,
                classWealth: current.classWealth,
                classApproval: current.classApproval,
                classInfluence: current.classInfluence,
                totalInfluence: current.totalInfluence,
                stability: current.stability,

                // 军事相关
                army: current.army,
                militaryQueue: current.militaryQueue,
                militaryWageRatio: current.militaryWageRatio,
                autoRecruitEnabled: current.autoRecruitEnabled,
                targetArmyComposition: current.targetArmyComposition,

                // 工作和经济
                jobFill: current.jobFill,
                jobsAvailable: current.jobsAvailable,

                // 内阁协同与自由市场
                // [FIX] 使用与 UI 相同的容量计算逻辑：
                // Math.min(jobsAvailable.official, officialCapacity)
                // 这确保主导判定与 UI 显示一致
                cabinetStatus: (() => {
                    // 与 App.jsx Line 1130 保持一致的计算逻辑
                    // 使用 hook 作用域中的 jobsAvailable（而非 current.jobsAvailable）
                    const jobCapacity = jobsAvailable?.official || 0;
                    const maxCapacity = current.officialCapacity ?? officialCapacity ?? 2;
                    const effectiveCapacity = Math.min(
                        jobCapacity > 0 ? jobCapacity : maxCapacity,
                        maxCapacity
                    );
                    const status = getCabinetStatus(
                        current.officials || [],
                        current.activeDecrees || {},
                        effectiveCapacity,
                        current.epoch || 0
                    );
                    // [DEBUG] 主线程检查
                    console.log('[MAIN THREAD PRE-WORKER] cabinetStatus:', {
                        hasDominance: !!status?.dominance,
                        dominanceFaction: status?.dominance?.faction,
                        capacity: effectiveCapacity,
                        jobCapacity,
                        maxCapacity,
                        officialCount: current.officials?.length,
                    });
                    return status;
                })(),
                quotaTargets: current.quotaTargets,
                expansionSettings: current.expansionSettings,
                priceControls: current.priceControls, // [NEW] 价格管制设置
                taxPolicies: current.taxPolicies || {},
                livingStandardStreaks: current.livingStandardStreaks,
                migrationCooldowns: current.migrationCooldowns,
                previousTaxShock: current.taxShock, // [NEW] 累积税收冲击历史

                // 贸易
                merchantState: current.merchantState,
                tradeRoutes: current.tradeRoutes,
                tradeStats: current.tradeStats,
                tradeRouteTax: current.tradeStats?.tradeRouteTax || 0, // Pass last tick's value for continuity, but worker re-calculates

                // Buff/Debuff
                activeBuffs: current.activeBuffs,
                activeDebuffs: current.activeDebuffs,

                // 历史数据 (Pass from Ref for latest data without waiting for State)
                classWealthHistory: classWealthHistoryRef.current,
                classNeedsHistory: classNeedsHistoryRef.current,

                // 时间和节日
                daysElapsed: current.daysElapsed,
                activeFestivalEffects: current.activeFestivalEffects || [],
                lastFestivalYear: current.lastFestivalYear,

                // 行动冷却
                actionCooldowns: current.actionCooldowns,
                actionUsage: current.actionUsage,
                promiseTasks: current.promiseTasks,

                // 事件效果
                activeEventEffects: current.activeEventEffects,
                eventEffectSettings: current.eventEffectSettings,

                // 叛乱系统
                rebellionStates: current.rebellionStates,

                // 执政联盟
                rulingCoalition: current.rulingCoalition,
                legitimacy: current.legitimacy,

                // 难度
                difficulty: current.difficulty,

                // 游戏速度（强制归一化）
                gameSpeed: 1,
                tick: current.daysElapsed || 0,

                // 事件修正器
                eventApprovalModifiers: approvalModifiers,
                eventStabilityModifier: stabilityModifier,
                currentStability: current.stability ?? 50,
                eventResourceDemandModifiers: resourceDemandModifiers,
                eventStratumDemandModifiers: stratumDemandModifiers,
                eventBuildingProductionModifiers: buildingProductionModifiers,
                previousLegitimacy: current.legitimacy ?? 0,

                // 官员系统
                officials: current.officials || [],
                officialsSimCursor: current.officialsSimCursor || 0,
                officialsPaid: canAffordOfficials,
                ministerAssignments: current.ministerAssignments || {},
                ministerAutoExpansion: current.ministerAutoExpansion || {},
                lastMinisterExpansionDay: current.lastMinisterExpansionDay ?? 0,
                foreignInvestments: current.foreignInvestments || [], // [NEW] Pass foreign investments to worker
                overseasInvestments: overseasInvestmentsRef.current || [], // [FIX] Use ref for latest state to prevent race condition
                foreignInvestmentPolicy: current.foreignInvestmentPolicy || 'normal', // [NEW] Pass policy
                diplomaticReputation: current.diplomaticReputation ?? 50, // [NEW] Pass diplomatic reputation
            };

            const perfEnabled = typeof window !== 'undefined'
                ? (window.__PERF_LOG ?? process.env.NODE_ENV !== 'production')
                : process.env.NODE_ENV !== 'production';

            if (perfEnabled) {
                console.warn(`[PerfTick] start day=${current.daysElapsed || 0}`);
            }

            if (typeof window !== 'undefined') {
                window.__PERF_STATS = {
                    day: current.daysElapsed || 0,
                    totalMs: 0,
                    simMs: 0,
                    applyMs: 0,
                    nations: current.nations?.length || 0,
                    overseas: overseasInvestmentsRef.current?.length || 0,
                    foreign: current.foreignInvestments?.length || 0,
                    status: 'running',
                    sections: null,
                };
            }

            // Skip if a simulation is still running to avoid flooding the worker
            if (simInFlightRef.current) {
                if (perfEnabled) {
                    console.warn(`[PerfTick] skip day=${current.daysElapsed || 0} (simulation busy)`);
                }
                return;
            }

            // Execute simulation
            // Phase 2: Use async Worker execution for better performance on low-end devices
            // The runSimulation function handles Worker availability check and fallback
            const perfTickStart = (typeof performance !== 'undefined' && performance.now)
                ? performance.now()
                : Date.now();
            const perfDay = current.daysElapsed || 0;
            simInFlightRef.current = true;
            runSimulation(simulationParams).then(result => {
                // console.log('🔵🔵🔵 [GAME-LOOP] runSimulation 完成! result:', result ? 'OK' : 'NULL', 'skipped:', result?.__skipped);
                const perfSimMs = ((typeof performance !== 'undefined' && performance.now)
                    ? performance.now()
                    : Date.now()) - perfTickStart;
                simInFlightRef.current = false;
                if (!result || result.__skipped) {
                    // console.log('🔵🔵🔵 [GAME-LOOP] 跳过处理: result =', result, 'skipped =', result?.__skipped);
                    if (typeof window !== 'undefined') {
                        window.__PERF_STATS = {
                            day: perfDay,
                            totalMs: perfSimMs,
                            simMs: perfSimMs,
                            applyMs: 0,
                            nations: current.nations?.length || 0,
                            overseas: overseasInvestmentsRef.current?.length || 0,
                            foreign: current.foreignInvestments?.length || 0,
                            status: result ? 'skipped' : 'null',
                            sections: result?._perf?.sections || null,
                        };
                    }
                    if (!result) {
                        console.error('[GameLoop] Simulation returned null result');
                    }
                    return;
                }

                // 以下是处理模拟结果的代码，包装在 then 回调中

                // 更新 Modifiers 状态供 UI 显示
                setModifiers(result.modifiers || {});

                const soldierPopulationAfterEvents = Number.isFinite(result.popStructure?.soldier)
                    ? result.popStructure.soldier
                    : null;
                // [FIX] 使用战斗后的军队状态，而非战斗前的 current.army
                let armyStateForQueue = result.army || current.army || {};
                let queueOverrideForManpower = null;

                if (soldierPopulationAfterEvents !== null) {
                    const manpowerSync = syncArmyWithSoldierPopulation(
                        armyStateForQueue,
                        current.militaryQueue || [],
                        soldierPopulationAfterEvents
                        // [FIX] 移除 autoRecruitEnabled 参数 - 人口不足解散不再触发自动补兵
                    );

                    if (manpowerSync.updatedArmy) {
                        armyStateForQueue = manpowerSync.updatedArmy;
                        setArmy(manpowerSync.updatedArmy);
                    }

                    if (manpowerSync.updatedQueue) {
                        queueOverrideForManpower = manpowerSync.updatedQueue;
                    }

                    // [FIX] 人口不足导致的解散：直接解散，不触发自动补兵
                    // 只有战斗损失（通过 AUTO_REPLENISH_LOSSES 日志）才触发自动补兵
                    if (manpowerSync.removedUnits) {
                        const summary = formatUnitSummary(manpowerSync.removedUnits);
                        if (summary) {
                            addLog(`⚠️ 军人阶级人口不足，以下部队被迫解散：${summary}`);
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

                const adjustedResources = { ...result.resources };
                const resourceShortages = {}; // 记录资源短缺（由 simulation 记录时这里为空）

                // --- Realized fiscal tracking (must match visible treasury changes) ---
                // We must baseline against the treasury BEFORE this tick starts (current.resources.silver).
                // Otherwise we would only measure extra deductions done in this hook, not the full tick delta.
                const treasuryAtTickStart = Number(current.resources?.silver || 0);
                let officialSalaryPaid = 0;
                let forcedSubsidyPaid = 0;
                let forcedSubsidyUnpaid = 0;

                // 扣除官员薪水（实付：最多扣到0）
                // 如果薪水为负数，则从官员那里收取费用（需要在simulation中处理官员财富扣除）
                if (officialDailySalary > 0) {
                    const before = Number(adjustedResources.silver || 0);
                    const pay = Math.min(officialDailySalary, before);
                    adjustedResources.silver = before - pay;
                    officialSalaryPaid = pay;
                } else if (officialDailySalary < 0) {
                    // 负薪酬：从官员那里收钱到国库
                    // 实际收到的金额会在simulation中根据官员财富计算
                    // 这里先记录预期收入（负数），实际收入会在simulation中更新
                    officialSalaryPaid = officialDailySalary; // 负数表示预期收入
                }

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

                            // 从国库扣除（实付：受国库余额约束）
                            const treasuryBefore = Number(adjustedResources.silver || 0);
                            const actualPayment = Math.min(dailyAmount, treasuryBefore);
                            adjustedResources.silver = treasuryBefore - actualPayment;

                            forcedSubsidyPaid += actualPayment;
                            forcedSubsidyUnpaid += Math.max(0, dailyAmount - actualPayment);

                            // 记录阶层财富增加量
                            if (stratumKey && actualPayment > 0) {
                                subsidyWealthDelta[stratumKey] = (subsidyWealthDelta[stratumKey] || 0) + actualPayment;
                            }
                        }
                    });
                    // forcedSubsidy 的天数递减和过期清理在下面统一处理
                }

                // Save realized fiscal data for UI
                if (typeof setFiscalActual === 'function') {
                    const treasuryAfterDeductions = Number(adjustedResources.silver || 0);
                    setFiscalActual({
                        // True treasury delta for the whole tick (what the player sees on the silver number)
                        silverDelta: treasuryAfterDeductions - treasuryAtTickStart,
                        officialSalaryPaid,
                        forcedSubsidyPaid,
                        forcedSubsidyUnpaid,
                    });
                }

                // === 详细财政日志 ===
                // 记录所有影响国库的收入和支出项
                const treasuryAfterDeductions = Number(adjustedResources.silver || 0);
                const netTreasuryChange = treasuryAfterDeductions - treasuryAtTickStart;

                // console.group('💰 [财政详情] Tick ' + (current.daysElapsed || 0));
                // console.log('🏦 国库起始余额:', treasuryAtTickStart.toFixed(2), '银币');

                // 从simulation返回的税收数据
                const taxes = result.taxes || {};
                const breakdown = taxes.breakdown || {};

                // console.group('📈 收入项');
                // console.log('  人头税:', (breakdown.headTax || 0).toFixed(2));
                // console.log('  交易税:', (breakdown.industryTax || 0).toFixed(2));
                // console.log('  营业税:', (breakdown.businessTax || 0).toFixed(2));
                // console.log('  关税:', (breakdown.tariff || 0).toFixed(2));
                // if (breakdown.warIndemnity) console.log('  战争赔款收入:', breakdown.warIndemnity.toFixed(2));
                // if (breakdown.tradeRouteTax) console.log('  贸易路线税收:', breakdown.tradeRouteTax.toFixed(2));
                // if (breakdown.policyIncome) console.log('  政令收益:', breakdown.policyIncome.toFixed(2));
                // if (breakdown.priceControlIncome) console.log('  价格管制收入:', breakdown.priceControlIncome.toFixed(2));
                const effectiveFiscalIncome = typeof breakdown.totalFiscalIncome === 'number'
                    ? breakdown.totalFiscalIncome
                    : (breakdown.headTax || 0) + (breakdown.industryTax || 0) +
                    (breakdown.businessTax || 0) + (breakdown.tariff || 0) +
                    (breakdown.warIndemnity || 0);
                const totalIncome = effectiveFiscalIncome + (breakdown.priceControlIncome || 0) +
                    (breakdown.tradeRouteTax || 0);
                // console.log('  ✅ 总收入:', totalIncome.toFixed(2));
                // if (typeof breakdown.incomePercentMultiplier === 'number') {
                //     console.log('  📌 收入加成倍率:', `×${breakdown.incomePercentMultiplier.toFixed(2)}`);
                // }
                // if (taxes.efficiency && taxes.efficiency < 1) {
                //     console.log('  📊 税收效率:', (taxes.efficiency * 100).toFixed(1) + '%',
                //         `(损失: ${(totalIncome * (1 - taxes.efficiency)).toFixed(2)} 银币)`);
                // }
                // console.groupEnd();

                // console.group('📉 支出项');

                // === 军队支出（使用simulation返回的真实数据）===
                // 注意：simulation.js中已经处理了资源购买、时代加成、规模惩罚、军饷倍率
                const simulationArmyCost = result.dailyMilitaryExpense?.dailyExpense || 0;

                if (simulationArmyCost > 0) {
                    // console.group('  军队维护（simulation计算）');
                    if (result.dailyMilitaryExpense) {
                        const armyData = result.dailyMilitaryExpense;
                        // console.log(`    基础资源成本: ${(armyData.resourceCost || 0).toFixed(2)} 银币`);
                        // console.log(`    时代系数: ×${(armyData.epochMultiplier || 1).toFixed(2)}`);
                        // console.log(`    规模惩罚: ×${(armyData.scalePenalty || 1).toFixed(2)}`);
                        // console.log(`    军饷倍率: ×${(armyData.wageMultiplier || 1).toFixed(2)}`);
                        // console.log(`    💰 实际支出: ${simulationArmyCost.toFixed(2)} 银币`);

                        // 显示资源消耗明细
                        if (armyData.resourceConsumption && Object.keys(armyData.resourceConsumption).length > 0) {
                            // console.log(`    消耗资源:`, armyData.resourceConsumption);
                        }
                    } else {
                        // console.log(`    💰 总支出: ${simulationArmyCost.toFixed(2)} 银币`);
                    }
                    // console.groupEnd();
                }

                // 保留useGameLoop中的军队维护计算（仅用于对比，标记为"本地计算"）
                if (false) { // 禁用旧的统计方式
                    const maintenanceResources = {};
                    let totalMaintenanceSilverValue = 0;
                    Object.entries(maintenance || {}).forEach(([resource, cost]) => {
                        if (cost > 0) {
                            maintenanceResources[resource] = cost;
                            if (resource === 'silver') {
                                totalMaintenanceSilverValue += cost;
                            } else {
                                const price = result.market?.prices?.[resource] || 1;
                                const silverValue = cost * price;
                                totalMaintenanceSilverValue += silverValue;
                            }
                        }
                    });

                    if (Object.keys(maintenanceResources).length > 0) {
                        console.group('  军队维护（本地计算 - 仅供参考）');
                        Object.entries(maintenanceResources).forEach(([resource, cost]) => {
                            if (resource === 'silver') {
                                console.log(`    ${resource}: ${cost.toFixed(2)}`);
                            } else {
                                const price = result.market?.prices?.[resource] || 1;
                                const silverValue = cost * price;
                                console.log(`    ${resource}: ${cost.toFixed(2)} (价值 ${silverValue.toFixed(2)} 银币)`);
                            }
                        });
                        console.log(`    💰 总价值: ${totalMaintenanceSilverValue.toFixed(2)} 银币`);
                        console.groupEnd();
                    }
                }

                if (breakdown.subsidy) console.log('  税收补贴:', breakdown.subsidy.toFixed(2));
                if (breakdown.tariffSubsidy) console.log('  关税补贴:', breakdown.tariffSubsidy.toFixed(2));
                if (officialSalaryPaid > 0) console.log('  官员薪俸:', officialSalaryPaid.toFixed(2));
                if (forcedSubsidyPaid > 0) console.log('  强制补贴:', forcedSubsidyPaid.toFixed(2));
                if (breakdown.policyExpense) console.log('  政令支出:', breakdown.policyExpense.toFixed(2));
                if (breakdown.priceControlExpense) console.log('  价格管制支出:', breakdown.priceControlExpense.toFixed(2));

                // 资源短缺警告（暂时保留用于调试）
                if (Object.keys(resourceShortages).length > 0) {
                    console.group('  ⚠️ 资源短缺（军队维护需求未满足）');
                    let totalShortageValue = 0;
                    Object.entries(resourceShortages).forEach(([resource, shortage]) => {
                        const price = result.market?.prices?.[resource] || 1;
                        const silverValue = shortage * price;
                        totalShortageValue += silverValue;
                        console.log(`    ${resource}: 短缺 ${shortage.toFixed(2)}，等价 ${silverValue.toFixed(2)} 银币`);
                    });
                    console.log(`    💸 短缺总价值: ${totalShortageValue.toFixed(2)} 银币`);
                    console.warn(`    ℹ️ 注意：这些资源短缺可能导致隐藏的银币支出！`);
                    console.groupEnd();
                }

                const totalExpense = simulationArmyCost + (breakdown.subsidy || 0) +
                    (breakdown.tariffSubsidy || 0) + officialSalaryPaid + forcedSubsidyPaid +
                    (breakdown.policyExpense || 0) + (breakdown.priceControlExpense || 0);
                console.log('  ❌ 总支出:', totalExpense.toFixed(2));
                console.groupEnd();

                console.log('📊 理论净变化:', (totalIncome - totalExpense).toFixed(2), '银币/天');
                console.log('🏦 国库结束余额:', treasuryAfterDeductions.toFixed(2), '银币');
                console.log('💵 实际净变化:', netTreasuryChange.toFixed(2), '银币');

                // [DEBUG] Military Specific Trace
                if (result._debug?.militaryDebugInfo) {
                    console.log('⚔️ [GameLoop] Military Debug:', result._debug.militaryDebugInfo);
                }
                const armyCostSim = result.dailyMilitaryExpense?.dailyExpense || 0;
                console.log('⚔️ [GameLoop] Reported Military Cost:', armyCostSim);

                // === 显示simulation中的银币变化追踪 ===
                // if (result._debug?.silverChangeLog && result._debug.silverChangeLog.length > 0) {
                //     console.group('🔍 银币变化详细追踪（simulation内部）');
                //     console.log('  起始余额:', (result._debug.startingSilver || 0).toFixed(2), '银币');
                //     result._debug.silverChangeLog.forEach((log, index) => {
                //         if (!log) return;
                //         const amount = log.amount ?? 0;
                //         const balance = log.balance ?? 0;
                //         const sign = amount >= 0 ? '+' : '';
                //         console.log(`  ${index + 1}. ${log.reason}: ${sign}${amount.toFixed(2)} 银币 (余额: ${balance.toFixed(2)})`);
                //     });
                //     console.log('  结束余额:', (result._debug.endingSilver || 0).toFixed(2), '银币');
                //     const simulationChange = (result._debug.endingSilver || 0) - (result._debug.startingSilver || 0);
                //     console.log('  💰 Simulation净变化:', simulationChange.toFixed(2), '银币');
                //     console.groupEnd();
                // }

                // === useGameLoop本地扣除（simulation之后）===
                const useGameLoopDeductions = [];
                if (officialSalaryPaid > 0) {
                    useGameLoopDeductions.push({ reason: '官员薪俸', amount: -officialSalaryPaid });
                }
                if (forcedSubsidyPaid > 0) {
                    useGameLoopDeductions.push({ reason: '强制补贴', amount: -forcedSubsidyPaid });
                }

                // if (useGameLoopDeductions.length > 0) {
                //     console.group('🔧 useGameLoop本地扣除（simulation之后）');
                //     useGameLoopDeductions.forEach((item, index) => {
                //         const sign = item.amount >= 0 ? '+' : '';
                //         console.log(`  ${index + 1}. ${item.reason}: ${sign}${item.amount.toFixed(2)} 银币`);
                //     });
                //     const totalLocalDeduction = useGameLoopDeductions.reduce((sum, item) => sum + item.amount, 0);
                //     console.log('  💰 本地扣除总计:', totalLocalDeduction.toFixed(2), '银币');
                //     console.groupEnd();
                // }

                const auditEntries = [];
                if (Array.isArray(result?._debug?.silverChangeLog) && result._debug.silverChangeLog.length > 0) {
                    const aggregated = new Map();
                    result._debug.silverChangeLog.forEach((entry) => {
                        if (!entry) return;
                        const amount = Number(entry.amount || 0);
                        if (!Number.isFinite(amount) || amount === 0) return;
                        const reason = entry.reason || 'simulation';
                        aggregated.set(reason, (aggregated.get(reason) || 0) + amount);
                    });
                    aggregated.forEach((amount, reason) => {
                        auditEntries.push({
                            amount,
                            reason,
                            meta: { source: 'simulation' },
                        });
                    });
                }
                const auditReasons = new Set(auditEntries.map(entry => entry.reason));
                const hasAnyReason = (reasons) => reasons.some(reason => auditReasons.has(reason));
                const addAuditEntry = (amount, reason) => {
                    if (!Number.isFinite(amount) || amount === 0) return;
                    if (auditReasons.has(reason)) return;
                    auditEntries.push({
                        amount,
                        reason,
                        meta: { source: 'game_loop_fallback' },
                    });
                    auditReasons.add(reason);
                };
                const fallbackMilitaryExpense = Number(
                    result?.dailyMilitaryExpense?.dailyExpense
                    || current?.dailyMilitaryExpense?.dailyExpense
                    || 0
                );
                const militaryLogKeys = ['军队维护支出', '军队维护支出（部分支付）', 'militaryPay', 'expense_army_maintenance', 'expense_army_maintenance_partial'];
                const existingMilitaryEntry = auditEntries.find(e => militaryLogKeys.includes(e.reason));

                if (fallbackMilitaryExpense > 0) {
                    if (!existingMilitaryEntry) {
                        // Entry missing entirely -> Force add
                        addAuditEntry(-fallbackMilitaryExpense, 'expense_army_maintenance');
                        console.warn('[GameLoop] Fixed missing military expense log:', -fallbackMilitaryExpense);
                    } else if (existingMilitaryEntry.amount === 0) {
                        // Entry exists but amount is 0 -> Fix amount
                        existingMilitaryEntry.amount = -fallbackMilitaryExpense;
                        existingMilitaryEntry.reason = 'expense_army_maintenance'; // Ensure standard key
                        console.warn('[GameLoop] Fixed zero-amount military expense log:', -fallbackMilitaryExpense);
                    }
                    // else: Entry exists and has non-zero amount -> Assume correct
                }
                const fallbackSubsidy = Number(breakdown?.subsidy || 0);
                if (fallbackSubsidy > 0 && !hasAnyReason(['subsidy', 'head_tax_subsidy', 'tax_subsidy'])) {
                    addAuditEntry(-fallbackSubsidy, 'subsidy');
                }
                const fallbackTariffSubsidy = Number(breakdown?.tariffSubsidy || 0);
                if (fallbackTariffSubsidy > 0 && !hasAnyReason(['tariff_subsidy'])) {
                    addAuditEntry(-fallbackTariffSubsidy, 'tariff_subsidy');
                }
                const incomePercentMultiplier = Number.isFinite(breakdown?.incomePercentMultiplier)
                    ? Number(breakdown.incomePercentMultiplier)
                    : 1;
                const fallbackTariff = Number(breakdown?.tariff || 0) * incomePercentMultiplier;
                if (fallbackTariff !== 0 && !hasAnyReason(['tax_tariff', 'tariff'])) {
                    addAuditEntry(fallbackTariff, 'tax_tariff');
                }


                if (officialSalaryPaid > 0) {
                    auditEntries.push({
                        amount: -officialSalaryPaid,
                        reason: 'official_salary',
                        meta: { source: 'game_loop' },
                    });
                }
                if (forcedSubsidyPaid > 0) {
                    auditEntries.push({
                        amount: -forcedSubsidyPaid,
                        reason: 'forced_subsidy',
                        meta: { source: 'game_loop' },
                    });
                }

                // ========== 附庸每日更新（朝贡与独立倾向） - 移到主setResources之前 ==========
                // [FIX] 将附庸朝贡收入和控制成本整合到 adjustedResources 和 auditEntries 中
                // 避免产生巨大的"对账差额"
                let vassalNationsUpdated = null;
                const vassalLogs = [];
                if (current.nations && current.nations.some(n => n.vassalOf === 'player')) {
                    // Calculate player military strength from army
                    const totalArmyUnits = Object.values(current.army || {}).reduce((sum, count) => sum + count, 0);
                    const baseMilitaryStrength = Math.max(0.5, totalArmyUnits / 100);
                    const garrisonFactor = INDEPENDENCE_CONFIG?.controlMeasures?.garrison?.militaryCommitmentFactor || 0;
                    const garrisonCommitment = (current.nations || []).reduce((sum, nation) => {
                        if (nation.vassalOf !== 'player') return sum;
                        const garrison = nation.vassalPolicy?.controlMeasures?.garrison;
                        const isActive = garrison === true || (garrison && garrison.active !== false);
                        if (!isActive) return sum;
                        const vassalStrength = nation.militaryStrength || 0.5;
                        return sum + (vassalStrength * garrisonFactor);
                    }, 0);
                    const playerMilitaryStrength = Math.max(0.1, baseMilitaryStrength - garrisonCommitment);

                    const vassalUpdateResult = processVassalUpdates({
                        nations: current.nations,
                        daysElapsed: current.daysElapsed || 0,
                        epoch: current.epoch || 0,
                        playerMilitary: playerMilitaryStrength,
                        playerStability: result.stability || 50,
                        playerAtWar: current.nations.some(n => n.isAtWar && (n.warTarget === 'player' || n.id === 'player')),
                        playerWealth: adjustedResources.silver || 0,
                        playerPopulation: current.population || 1000000,
                        officials: result.officials || [],
                        difficultyLevel: current.difficulty,
                        logs: vassalLogs
                    });

                    // [NEW] Check for vassal autonomous requests (Lower Tribute, Aid, Investment)
                    checkVassalRequests(
                        current.nations.filter(n => n.vassalOf === 'player'),
                        current.daysElapsed || 0,
                        vassalLogs
                    );

                    if (vassalUpdateResult) {
                        // 保存更新后的国家列表，稍后应用
                        if (vassalUpdateResult.nations) {
                            vassalNationsUpdated = vassalUpdateResult.nations;
                        }

                        // [FIX] 将附庸朝贡收入直接添加到 adjustedResources 和 auditEntries
                        if (vassalUpdateResult.tributeIncome > 0) {
                            adjustedResources.silver = (adjustedResources.silver || 0) + vassalUpdateResult.tributeIncome;
                            auditEntries.push({
                                amount: vassalUpdateResult.tributeIncome,
                                reason: 'vassal_tribute_cash',
                                meta: { source: 'vassal_system' },
                            });
                        }

                        // [FIX] 将资源朝贡直接添加到 adjustedResources
                        if (vassalUpdateResult.resourceTribute && Object.keys(vassalUpdateResult.resourceTribute).length > 0) {
                            Object.entries(vassalUpdateResult.resourceTribute).forEach(([res, amount]) => {
                                adjustedResources[res] = (adjustedResources[res] || 0) + amount;
                            });
                        }

                        // [FIX] 将附庸控制成本直接从 adjustedResources 扣除并添加到 auditEntries
                        if (vassalUpdateResult.totalControlCost > 0) {
                            adjustedResources.silver = Math.max(0, (adjustedResources.silver || 0) - vassalUpdateResult.totalControlCost);
                            auditEntries.push({
                                amount: -vassalUpdateResult.totalControlCost,
                                reason: 'vassal_control_cost',
                                meta: { source: 'vassal_system' },
                            });
                            if (isDebugEnabled('diplomacy')) {
                                console.log(`[Vassal] Deducted ${vassalUpdateResult.totalControlCost} silver for control measures.`);
                            }
                        }
                    }
                }

                const treasuryIncome = auditEntries.reduce((sum, entry) => {
                    const amount = Number(entry?.amount || 0);
                    if (!Number.isFinite(amount) || amount <= 0) return sum;
                    return sum + amount;
                }, 0);
                const auditDelta = auditEntries.reduce((sum, entry) => {
                    const amount = Number(entry?.amount || 0);
                    return Number.isFinite(amount) ? sum + amount : sum;
                }, 0);
                console.log('📋 审计净变化:', auditDelta.toFixed(2), '银币');
                if (Math.abs(netTreasuryChange - auditDelta) > 0.1) {
                    console.warn('⚠️ 警告：审计净变化与实际净变化不一致！差异:',
                        (netTreasuryChange - auditDelta).toFixed(2));
                }

                console.groupEnd();
                // === 财政日志结束 ===
                console.log('🔴🔴🔴 [DEBUG-CHECKPOINT] 财政日志结束，继续执行...');

                // ========== 经济指标计算 ==========
                // 1. 更新价格历史（每天）
                const updatedPriceHistory = updatePriceHistory({
                    priceHistory,
                    currentPrices: market.prices,
                    maxLength: ECONOMIC_INDICATOR_CONFIG.priceHistory.maxLength,
                });
                setPriceHistory(updatedPriceHistory);

                // 2. 计算均衡价格（每10天）
                let currentEquilibriumPrices = equilibriumPrices;
                if (daysElapsed % ECONOMIC_INDICATOR_CONFIG.equilibriumPrice.updateInterval === 0) {
                    currentEquilibriumPrices = calculateEquilibriumPrices({
                        priceHistory: updatedPriceHistory,
                        basePrices: getBasePrices(),
                        window: ECONOMIC_INDICATOR_CONFIG.equilibriumPrice.window,
                    });
                    setEquilibriumPrices(currentEquilibriumPrices);
                }

                // 3. 计算所有经济指标（每天）
                console.group('🎯 [ECONOMIC INDICATORS DEBUG] Day ' + (current.daysElapsed || 0));
                console.log('📊 Input Data:', {
                    classFinancialData: result.classFinancialData,
                    buildingFinancialData: result.buildingFinancialData,
                    dailyMilitaryExpense: result.dailyMilitaryExpense,
                    officials: current.officials?.length,
                    taxBreakdown: result.taxes?.breakdown,
                    demandBreakdown: market.demandBreakdown,
                    marketPrices: market.prices,
                });

                const indicators = calculateAllIndicators({
                    // 价格数据
                    priceHistory: updatedPriceHistory,
                    equilibriumPrices: currentEquilibriumPrices,
                    marketPrices: market.prices,

                    // GDP数据
                    classFinancialData: result.classFinancialData,
                    buildingFinancialData: result.buildingFinancialData,
                    dailyMilitaryExpense: result.dailyMilitaryExpense || 0,
                    officials: current.officials,
                    taxBreakdown: result.taxes?.breakdown || {},
                    demandBreakdown: market.demandBreakdown || {},

                    // 历史数据
                    previousIndicators: economicIndicators,
                });

                console.log('✅ Calculated Indicators:', indicators);
                console.groupEnd();
                setEconomicIndicators(indicators);

                const auditStartingSilver = Number.isFinite(result?._debug?.startingSilver)
                    ? result._debug.startingSilver
                    : treasuryAtTickStart;
                setResources(adjustedResources, {
                    reason: 'tick_update',
                    meta: { day: current.daysElapsed || 0, source: 'game_loop' },
                    auditEntries,
                    auditStartingSilver,
                });

                // [FIX] 不要在这里单独setNations，会被后面的nextNations覆盖
                // 附庸系统更新的国家列表会在后面与nextNations合并

                // 显示附庸系统日志
                if (vassalLogs.length > 0) {
                    vassalLogs.forEach(log => addLog(log));
                }

                // 处理强制补贴效果的每日更新
                // 注意：这里只处理 forcedSubsidy 的递减和过期，不处理其他效果的更新
                // 其他效果（approval, stability等）由 simulation.js 中的 applyActiveEventEffects 处理
                if (forcedSubsidies.length > 0) {
                    setActiveEventEffects(prev => {
                        // 只更新 forcedSubsidy，保留其他所有效果不变
                        const updatedSubsidies = forcedSubsidies
                            .map(s => ({ ...s, remainingDays: s.remainingDays - 1 }))
                            .filter(s => s.remainingDays > 0);

                        debugLog('gameLoop', '[GAME LOOP] Updating subsidies:', forcedSubsidies.length, '->', updatedSubsidies.length);

                        return {
                            ...prev,
                            forcedSubsidy: updatedSubsidies
                        };
                    });
                }

                // 创建阶层财富对象，合并补贴转账
                let adjustedClassWealth = { ...result.classWealth };
                // 将补贴增量添加到阶层财富
                Object.entries(subsidyWealthDelta).forEach(([key, delta]) => {
                    adjustedClassWealth[key] = (adjustedClassWealth[key] || 0) + delta;
                });
                let adjustedTotalWealth = Object.values(adjustedClassWealth).reduce((sum, val) => sum + val, 0);

                // 3. 国内 -> 国外投资（每10天触发一次，分批处理所有候选国家）
                // [NEW] 不再采样，而是按优先级排序后，每个 tick 处理 2 个国家
                // 这样可以在多个 tick 中覆盖所有符合条件的国家
                const effectiveDaysElapsed = current.daysElapsed || 0;

                // [NEW] 检查是否应该开始新的投资周期（每10天）
                // [FIX] 改为基于上次处理时间的相对触发，避免在游戏中途加载时无法触发
                const lastOutboundDay = outboundInvestmentBatchRef.current.lastProcessDay;
                const shouldStartNewCycle = lastOutboundDay === null
                    ? (effectiveDaysElapsed > 0) // 首次触发：立即触发（避免在游戏中途加载时等待特定余数）
                    : (effectiveDaysElapsed - lastOutboundDay >= 10); // 后续触发：距离上次处理 >= 10 天
                const isInActiveCycle = lastOutboundDay !== null &&
                    effectiveDaysElapsed - lastOutboundDay < 10 &&
                    effectiveDaysElapsed > lastOutboundDay;

                if (shouldStartNewCycle || isInActiveCycle) {
                    // 如果是新周期的开始，重置 offset
                    if (shouldStartNewCycle && outboundInvestmentBatchRef.current.lastProcessDay !== effectiveDaysElapsed) {
                        outboundInvestmentBatchRef.current.offset = 0;
                        outboundInvestmentBatchRef.current.lastProcessDay = effectiveDaysElapsed;
                    }

                    import('../logic/diplomacy/autonomousInvestment').then(({ selectOutboundInvestmentsBatch }) => {
                        // [FIX] 玩家数据不在 nations 数组中，需要构建虚拟玩家国家对象
                        const playerNation = {
                            id: 'player',
                            name: 'Player',
                            isPlayer: true,
                            classWealth: adjustedClassWealth,
                            resources: adjustedResources,
                            market: adjustedMarket,
                        };

                        const result = selectOutboundInvestmentsBatch({
                            nations: current.nations || [],
                            playerNation,
                            diplomacyOrganizations: current.diplomacyOrganizations,
                            overseasInvestments: overseasInvestmentsRef.current || [],
                            classWealth: adjustedClassWealth,
                            market: adjustedMarket,
                            epoch: current.epoch,
                            daysElapsed: effectiveDaysElapsed,
                            taxPolicies: current.taxPolicies || {},
                            batchSize: 2, // 每个 tick 处理 2 个国家
                            batchOffset: outboundInvestmentBatchRef.current.offset,
                        });

                        const { investments, hasMore, nextOffset } = result;

                        // [NEW] 更新批次状态
                        outboundInvestmentBatchRef.current.offset = nextOffset;

                        // 如果没有更多批次了，标记周期结束
                        if (!hasMore) {
                            outboundInvestmentBatchRef.current.lastProcessDay = null;
                        }

                        if (investments.length === 0) return;

                        import('../logic/diplomacy/overseasInvestment').then(({ mergeOverseasInvestments }) => {
                            investments.forEach(option => {
                                const { stratum, targetNation, building, cost, dailyProfit, investment } = option;
                                if (!investment) return;
                                setClassWealth(prev => ({
                                    ...prev,
                                    [stratum]: Math.max(0, (prev[stratum] || 0) - cost)
                                }), { reason: 'autonomous_investment_cost', meta: { stratum } });
                                setOverseasInvestments(prev => mergeOverseasInvestments(prev, investment));
                                const stratumName = STRATA[stratum]?.name || stratum;
                                addLog(`💰 ${stratumName}在 ${targetNation.name} 投资 ${building.name}（预计日利 ${dailyProfit.toFixed(1)}），注资 ${formatNumberShortCN(cost)}。`);
                            });
                        }).catch(err => console.warn('Autonomous investment merge error:', err));

                        setNations(prev => prev.map(n => {
                            if (!investments.some(option => option.targetNation.id === n.id)) return n;
                            return { ...n, lastOutboundSampleDay: effectiveDaysElapsed };
                        }));
                    }).catch(err => console.warn('Autonomous investment error:', err));
                }

                // 4. 国外 -> 国内投资（每10天触发一次，错开5天，分批处理所有符合条件的投资国）
                // [NEW] 不再采样，而是按优先级排序后，每个 tick 处理 2 个投资国
                // [FIX] 改为基于上次处理时间的相对触发，避免在游戏中途加载时无法触发
                const lastInboundDay = inboundInvestmentBatchRef.current.lastProcessDay;
                const shouldStartInboundCycle = lastInboundDay === null
                    ? (effectiveDaysElapsed > 0) // 首次触发：立即触发（避免在游戏中途加载时等待特定余数）
                    : (effectiveDaysElapsed - lastInboundDay >= 10); // 后续触发：距离上次处理 >= 10 天
                const isInInboundCycle = lastInboundDay !== null &&
                    effectiveDaysElapsed - lastInboundDay < 10 &&
                    effectiveDaysElapsed > lastInboundDay;

                console.log('🔍 [INBOUND-CYCLE] Day', effectiveDaysElapsed,
                    '- shouldStart:', shouldStartInboundCycle,
                    '- isInCycle:', isInInboundCycle,
                    '- lastProcessDay:', lastInboundDay,
                    '- offset:', inboundInvestmentBatchRef.current.offset);

                if (shouldStartInboundCycle || isInInboundCycle) {
                    console.log('✅ [INBOUND-CYCLE] 触发 inbound investment 检查');
                    import('../logic/diplomacy/autonomousInvestment').then(({ selectInboundInvestmentsBatch }) => {
                        // 开始新周期时重置 offset
                        if (shouldStartInboundCycle && !isInInboundCycle) {
                            console.log('🔄 [INBOUND-CYCLE] 开始新周期，重置 offset');
                            inboundInvestmentBatchRef.current.offset = 0;
                            inboundInvestmentBatchRef.current.lastProcessDay = effectiveDaysElapsed;
                        }

                        // [FIX] 玩家数据不在 nations 数组中，直接从 current 获取
                        const playerState = {
                            population: current.population,
                            wealth: current.resources?.silver || 0,
                            resources: current.resources,
                            buildings: current.buildings || {},
                            jobFill: current.jobFill,
                            id: 'player',
                            treaties: [], // 玩家的条约存储在 nations 数组中的对方国家身上
                            vassalOf: null, // 玩家不会是附庸
                        };

                        console.log('🔍 [INBOUND-CYCLE] 调用 selectInboundInvestmentsBatch - offset:', inboundInvestmentBatchRef.current.offset);

                        const result = selectInboundInvestmentsBatch({
                            investorNations: current.nations || [],
                            playerState,
                            diplomacyOrganizations: current.diplomacyOrganizations,
                            market: adjustedMarket,
                            epoch: current.epoch,
                            daysElapsed: effectiveDaysElapsed,
                            foreignInvestments: current.foreignInvestments || [],
                            taxPolicies: current.taxPolicies || {},
                            batchSize: 2,
                            batchOffset: inboundInvestmentBatchRef.current.offset,
                        });

                        const { investments, hasMore, nextOffset } = result;

                        console.log('🔍 [INBOUND-CYCLE] 返回结果 - investments:', investments.length, 'hasMore:', hasMore, 'nextOffset:', nextOffset);

                        // 更新批次状态
                        inboundInvestmentBatchRef.current.offset = nextOffset;
                        if (!hasMore) {
                            // 本周期处理完毕，清空 lastProcessDay
                            console.log('✅ [INBOUND-CYCLE] 本周期处理完毕');
                            inboundInvestmentBatchRef.current.lastProcessDay = null;
                        }

                        if (investments.length === 0) {
                            console.log('❌ [INBOUND-CYCLE] 没有投资决策');
                            return;
                        }

                        console.log('💰 [INBOUND-CYCLE] 执行', investments.length, '个投资');

                        investments.forEach(decision => {
                            const { investorNation, building, cost, investmentPolicy } = decision;
                            const actionsRef = current.actions;
                            if (actionsRef && actionsRef.handleDiplomaticAction) {
                                actionsRef.handleDiplomaticAction(investorNation.id, 'accept_foreign_investment', {
                                    buildingId: building.id,
                                    ownerStratum: 'capitalist',
                                    operatingMode: 'local',
                                    investmentAmount: cost,
                                    investmentPolicy
                                });

                                setNations(prev => prev.map(n => (
                                    n.id === investorNation.id
                                        ? {
                                            ...n,
                                            lastForeignInvestmentDay: effectiveDaysElapsed,
                                            lastForeignSampleDay: effectiveDaysElapsed
                                        }
                                        : n
                                )));

                                addLog(`🏦 ${investorNation.name} 在本地投资建造了 ${building.name}。`);
                            }
                        });
                    }).catch(err => console.warn('AI investment error:', err));
                }

                // 条约维护费已在 simulation 内统一扣除并记账，避免主线程重复扣减。

                // [MOVED] 附庸每日更新已移至主 setResources 调用之前，避免产生对账差额

                // ========== 官员成长系统（每日经验与升级） ==========
                let progressionChanges = [];
                if (result.officials && result.officials.length > 0) {
                    const progressionResult = updateAllOfficialsDaily(result.officials, {
                        daysElapsed: current.daysElapsed,
                    });
                    result.officials = progressionResult.updatedOfficials;
                    progressionChanges = progressionResult.allChanges || [];

                    // Log level ups
                    progressionChanges.filter(c => c.type === 'level_up').forEach(change => {
                        const statDetails = Object.entries(change.statChanges || {})
                            .map(([stat, val]) => `${stat}+${val}`)
                            .join(', ');
                        addLog(`🎖️ ${change.officialName} 晋升至 Lv.${change.newLevel}！(${statDetails})`);
                    });
                }

                // ========== 官僚政变检测（基于忠诚度系统） ==========
                let coupOutcome = null;
                const officialsList = result.officials || [];
                if (officialsList.length > 0 && current.actions?.triggerDiplomaticEvent) {
                    const influenceShare = (stratumKey) => {
                        const influence = result.classInfluence?.[stratumKey] || 0;
                        return (result.totalInfluence || 0) > 0 ? influence / result.totalInfluence : 0;
                    };

                    // 新的政变检测条件：基于忠诚度系统
                    const { COUP_THRESHOLD, COUP_DURATION_DAYS, COUP_WEALTH_THRESHOLD,
                        COUP_PROPERTY_THRESHOLD, COUP_INFLUENCE_THRESHOLD } = LOYALTY_CONFIG;

                    const candidates = officialsList
                        .filter(official => official && official.ownedProperties?.length)
                        .map(official => {
                            const propertyValue = official.ownedProperties.reduce((sum, prop) => sum + (prop.purchaseCost || 0), 0);
                            const wealthScore = (official.wealth || 0) + propertyValue;
                            const propertyCount = (official.ownedProperties || []).length;
                            const stratumInfluence = influenceShare(official.sourceStratum || 'official');
                            return {
                                official,
                                propertyValue,
                                propertyCount,
                                wealthScore,
                                influenceShare: stratumInfluence,
                            };
                        })
                        .filter(candidate => {
                            const official = candidate.official;
                            const loyalty = official.loyalty ?? 75; // 默认兼容旧存档
                            const lowLoyaltyDays = official.lowLoyaltyDays ?? 0;

                            // 条件1：忠诚度低于阈值且持续足够天数
                            if (loyalty >= COUP_THRESHOLD || lowLoyaltyDays < COUP_DURATION_DAYS) {
                                return false;
                            }

                            // 条件2：有足够资本发动政变（满足任一）
                            const hasWealth = candidate.wealthScore >= COUP_WEALTH_THRESHOLD;
                            const hasProperties = candidate.propertyCount >= COUP_PROPERTY_THRESHOLD;
                            const hasInfluence = candidate.influenceShare >= COUP_INFLUENCE_THRESHOLD;

                            return hasWealth || hasProperties || hasInfluence;
                        });

                    if (candidates.length > 0) {
                        candidates.sort((a, b) => b.wealthScore - a.wealthScore);
                        const target = candidates[0];
                        // 降低基础概率，根据忠诚度调整
                        const loyalty = target.official.loyalty ?? 75;
                        const loyaltyFactor = Math.max(0.5, (25 - loyalty) / 25); // 忠诚度越低概率越高
                        const triggerChance = Math.min(0.15, 0.02 * loyaltyFactor);

                        if (Math.random() < triggerChance) {
                            // [FIX] 添加安全检查：确保目标官员有有效的ID，避免意外删除其他官员
                            const targetId = target.official.id;
                            if (!targetId) {
                                console.error('[COUP BUG] Target official has no ID:', target.official);
                            }
                            const newOfficials = officialsList.filter(o => o && o.id && o.id !== targetId);
                            const newBuildings = { ...(result.buildings || {}) };
                            const newBuildingUpgrades = { ...(result.buildingUpgrades || {}) };
                            const newPopStructure = { ...(result.popStructure || {}) };
                            let populationLoss = 1;

                            (target.official.ownedProperties || []).forEach(prop => {
                                const buildingId = prop.buildingId;
                                const level = prop.level || 0;
                                const building = BUILDINGS.find(b => b.id === buildingId);
                                if (building) {
                                    const config = getBuildingEffectiveConfig(building, level);
                                    Object.entries(config.jobs || {}).forEach(([role, slots]) => {
                                        if (!slots) return;
                                        const loss = Math.min(newPopStructure[role] || 0, slots);
                                        if (loss > 0) {
                                            newPopStructure[role] = Math.max(0, (newPopStructure[role] || 0) - loss);
                                            populationLoss += loss;
                                        }
                                    });
                                }

                                if (newBuildings[buildingId]) {
                                    newBuildings[buildingId] = Math.max(0, newBuildings[buildingId] - 1);
                                    if (newBuildings[buildingId] === 0) {
                                        delete newBuildings[buildingId];
                                    }
                                }

                                if (newBuildingUpgrades[buildingId] && level > 0) {
                                    newBuildingUpgrades[buildingId][level] = Math.max(0, (newBuildingUpgrades[buildingId][level] || 0) - 1);
                                    if (newBuildingUpgrades[buildingId][level] <= 0) {
                                        delete newBuildingUpgrades[buildingId][level];
                                    }
                                    if (Object.keys(newBuildingUpgrades[buildingId]).length === 0) {
                                        delete newBuildingUpgrades[buildingId];
                                    }
                                }
                            });

                            newPopStructure.official = Math.max(0, (newPopStructure.official || 0) - 1);

                            const newPopulation = Math.max(0, (result.population || 0) - populationLoss);

                            adjustedClassWealth = {
                                ...adjustedClassWealth,
                                official: Math.max(0, (adjustedClassWealth.official || 0) - (target.official.wealth || 0)),
                            };
                            adjustedTotalWealth = Object.values(adjustedClassWealth).reduce((sum, val) => sum + val, 0);

                            const rebelNation = createOfficialCoupNation(
                                target.official,
                                { propertyValue: target.propertyValue },
                                populationLoss
                            );
                            rebelNation.warStartDay = current.daysElapsed || 0;

                            const coupCallback = (action, stratum, extraData) => {
                                if (current.actions?.handleRebellionAction) {
                                    current.actions.handleRebellionAction(action, stratum, extraData);
                                }
                            };

                            const hasMilitary = hasAvailableMilitary(current.army, current.popStructure, 'official');
                            const militaryIsRebelling = isMilitaryRebelling(current.rebellionStates || {});
                            const coupEvent = createOfficialCoupEvent(
                                target.official,
                                hasMilitary,
                                militaryIsRebelling,
                                rebelNation,
                                coupCallback
                            );

                            coupOutcome = {
                                officials: newOfficials,
                                buildings: newBuildings,
                                buildingUpgrades: newBuildingUpgrades,
                                popStructure: newPopStructure,
                                population: newPopulation,
                                nations: [...(current.nations || []), rebelNation],
                                event: coupEvent,
                            };

                            addLog(`⚠️ 官僚政变：${target.official.name}携资产叛逃，成立了${rebelNation.name}！`);
                        }
                    }
                }

                const nextPopStructure = coupOutcome?.popStructure || result.popStructure;
                const nextOfficials = coupOutcome?.officials || result.officials;
                const nextBuildings = coupOutcome?.buildings || result.buildings;
                const nextBuildingUpgrades = coupOutcome?.buildingUpgrades || result.buildingUpgrades;
                // [FIX] 合并附庸系统更新到nextNations，避免被覆盖
                // vassalNationsUpdated 包含了附庸的独立倾向等更新
                let nextNations = coupOutcome?.nations || result.nations;
                if (vassalNationsUpdated && nextNations) {
                    // [DEBUG] 调试日志
                    const vassalBefore = vassalNationsUpdated.find(n => n.vassalOf === 'player');
                    const nationBefore = nextNations.find(n => n.vassalOf === 'player');
                    if (vassalBefore) {
                        console.log('[VASSAL DEBUG] Before merge:', {
                            vassalUpdated_independencePressure: vassalBefore.independencePressure,
                            vassalUpdated_lastChange: vassalBefore._lastIndependenceChange,
                            vassalUpdated_pop: vassalBefore.population,
                            vassalUpdated_wealth: vassalBefore.wealth,
                            resultNations_independencePressure: nationBefore?.independencePressure,
                            resultNations_pop: nationBefore?.population,
                            resultNations_wealth: nationBefore?.wealth,
                        });
                    }

                    // [FIX] Only merge ACTUAL vassals, not all nations!
                    // Previous bug: vassalNationsUpdated contains ALL nations (from current.nations),
                    // but non-vassal nations have STALE data (before simulation).
                    // This was overwriting AI growth results with old population/wealth values!
                    // 
                    // [FIX v2] Merge strategy:
                    // - Use vassalNationsUpdated for vassal-specific fields (independencePressure, satisfaction, etc.)
                    // - Use result.nations for simulation-updated fields (population, wealth, economyTraits, etc.)
                    const resultNationsMap = new Map(nextNations.map(n => [n.id, n]));
                    const vassalOnlyMap = new Map(
                        vassalNationsUpdated
                            .filter(n => n.vassalOf === 'player')  // Only actual vassals
                            .map(n => {
                                const resultNation = resultNationsMap.get(n.id);
                                if (resultNation) {
                                    // Merge: use simulation results for population/wealth/economyTraits,
                                    // but keep vassalNationsUpdated for vassal-specific fields
                                    return [n.id, {
                                        ...n,  // Start with vassalNationsUpdated (has independencePressure, etc.)
                                        population: resultNation.population,  // Override with simulation results
                                        wealth: resultNation.wealth,
                                        economyTraits: resultNation.economyTraits,
                                        socialStructure: resultNation.socialStructure,
                                    }];
                                }
                                return [n.id, n];
                            })
                    );
                    nextNations = nextNations.map(n => vassalOnlyMap.get(n.id) || n);

                    // [DEBUG] 合并后调试日志
                    const vassalAfter = nextNations.find(n => n.vassalOf === 'player');
                    if (vassalAfter) {
                        console.log('[VASSAL DEBUG] After merge:', {
                            nextNations_independencePressure: vassalAfter.independencePressure,
                            nextNations_lastChange: vassalAfter._lastIndependenceChange,
                            nextNations_pop: vassalAfter.population,
                            nextNations_wealth: vassalAfter.wealth,
                        });
                    }
                } else if (vassalNationsUpdated && !nextNations) {
                    nextNations = vassalNationsUpdated;
                }
                const nextPopulation = coupOutcome?.population ?? result.population;

                // --- 历史数据更新 (Update Refs directly) ---
                const MAX_POINTS = HISTORY_STORAGE_LIMIT;

                // 1. Market History Ref Update
                const mHist = marketHistoryRef.current;
                Object.keys(result.market?.prices || {}).forEach(resource => {
                    // Price
                    if (!mHist.price[resource]) mHist.price[resource] = [];
                    mHist.price[resource].push(result.market?.prices?.[resource] || 0);
                    if (mHist.price[resource].length > MAX_POINTS) mHist.price[resource].shift();

                    // Supply
                    if (!mHist.supply[resource]) mHist.supply[resource] = [];
                    mHist.supply[resource].push(result.market?.supply?.[resource] || 0);
                    if (mHist.supply[resource].length > MAX_POINTS) mHist.supply[resource].shift();

                    // Demand
                    if (!mHist.demand[resource]) mHist.demand[resource] = [];
                    mHist.demand[resource].push(result.market?.demand?.[resource] || 0);
                    if (mHist.demand[resource].length > MAX_POINTS) mHist.demand[resource].shift();
                });

                // 2. Class Wealth History Ref Update
                const wHist = classWealthHistoryRef.current;
                Object.entries(result.classWealth || {}).forEach(([key, value]) => {
                    if (!wHist[key]) wHist[key] = [];
                    wHist[key].push(value);
                    if (wHist[key].length > MAX_POINTS) wHist[key].shift();
                });

                // 3. Class Needs History Ref Update
                const nHist = classNeedsHistoryRef.current;
                Object.entries(result.needsReport || {}).forEach(([key, report]) => {
                    if (!nHist[key]) nHist[key] = [];
                    nHist[key].push(report.satisfactionRatio);
                    if (nHist[key].length > MAX_POINTS) nHist[key].shift();
                });

                const adjustedMarket = {
                    ...(result.market || {}),
                    // Use Ref data for consistency, but this object is recreated every tick.
                    // The cost is just object creation, not React render (until setState).
                    priceHistory: mHist.price,
                    supplyHistory: mHist.supply,
                    demandHistory: mHist.demand,
                    modifiers: result.modifiers || {},
                };

                // ========== 历史数据节流同步 ==========
                // 仅当计数器到达间隔时，才将 Ref 中的数据同步到 React State
                historyUpdateCounterRef.current++;
                const shouldUpdateUIState = historyUpdateCounterRef.current >= HISTORY_UPDATE_INTERVAL;

                if (shouldUpdateUIState) {
                    historyUpdateCounterRef.current = 0;

                    // Sync Class History State (clone to trigger render)
                    setClassWealthHistory({ ...classWealthHistoryRef.current });
                    setClassNeedsHistory({ ...classNeedsHistoryRef.current });

                    // Sync Global History (Legacy structure)
                    setHistory(prevHistory => {
                        const appendValue = (series = [], value) => {
                            const nextSeries = [...series, value];
                            if (nextSeries.length > MAX_POINTS) {
                                nextSeries.shift();
                            }
                            return nextSeries;
                        };

                        const safeHistory = prevHistory || {};
                        const nextHistory = {
                            ...safeHistory,
                            treasury: appendValue(safeHistory.treasury, result.resources?.silver || 0),
                            tax: appendValue(safeHistory.tax, treasuryIncome || 0),
                            population: appendValue(safeHistory.population, nextPopulation || 0),
                            // 经济指标历史
                            gdp: appendValue(safeHistory.gdp, indicators.gdp?.total || 0),
                            cpi: appendValue(safeHistory.cpi, indicators.cpi?.index || 100),
                            ppi: appendValue(safeHistory.ppi, indicators.ppi?.index || 100),
                        };

                        const previousClassHistory = safeHistory.class || {};
                        const classHistory = { ...previousClassHistory };
                        Object.keys(STRATA).forEach(key => {
                            const entry = previousClassHistory[key] || { pop: [], income: [], expense: [] };
                            classHistory[key] = {
                                pop: appendValue(entry.pop, nextPopStructure?.[key] || 0),
                                income: appendValue(entry.income, result.classIncome?.[key] || 0),
                                expense: appendValue(entry.expense, result.classExpense?.[key] || 0),
                            };
                        });
                        nextHistory.class = classHistory;
                        return nextHistory;
                    });
                }

                // 更新所有状态 - 使用批量更新减少重渲染次数
                // 将所有 setState 调用包装在 unstable_batchedUpdates 中
                // 这可以将 30+ 次渲染合并为 1 次，大幅提升低端设备性能
                unstable_batchedUpdates(() => {
                    setPopStructure(nextPopStructure);
                    setMaxPop(result.maxPop);
                    setRates(result.rates || {});
                    setClassApproval(result.classApproval);
                    setApprovalBreakdown(result.approvalBreakdown || {}); // [NEW] 保存满意度分解数据供 UI 分析使用
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
                    setClassWealth(adjustedClassWealth, { reason: 'tick_class_wealth_update', meta: { day: current.daysElapsed || 0 } });
                    setClassWealthDelta(wealthDelta);
                    setClassIncome(result.classIncome || {});
                    setClassExpense(result.classExpense || {});
                    setClassFinancialData(result.classFinancialData || {});
                    setBuildingFinancialData(result.buildingFinancialData || {});
                    // DEBUG: Store building debug data for UI display
                    if (typeof window !== 'undefined') {
                        window.__buildingDebugData = result.buildingDebugData || {};
                    }
                    // 历史数据更新已移至上方 Ref 管理部分，此处不再重复调用
                    setTotalInfluence(result.totalInfluence);
                    setTotalWealth(adjustedTotalWealth);
                    setActiveBuffs(result.activeBuffs);
                    setActiveDebuffs(result.activeDebuffs);
                    setStability(result.stability);
                    // 更新执政联盟合法性
                    if (typeof setLegitimacy === 'function' && result.legitimacy !== undefined) {
                        setLegitimacy(result.legitimacy);
                    }
                    // DEBUG: 调试关税值
                    const mainThreadDebug = isDebugEnabled('mainThread');
                    if (mainThreadDebug && result.taxes?.breakdown) {
                        debugLog('mainThread', '[MAIN THREAD DEBUG] result.taxes.breakdown:', result.taxes.breakdown);
                        // 额外打印 taxPolicies 内容
                        debugLog('mainThread', '[MAIN THREAD DEBUG] current.taxPolicies:', {
                            exportTariffMultipliers: current.taxPolicies?.exportTariffMultipliers,
                            importTariffMultipliers: current.taxPolicies?.importTariffMultipliers,
                            resourceTariffMultipliers: current.taxPolicies?.resourceTariffMultipliers,
                        });
                    }
                    setTaxes(result.taxes || {
                        total: 0,
                        breakdown: { headTax: 0, industryTax: 0, subsidy: 0, policyIncome: 0, policyExpense: 0 },
                        efficiency: 1,
                    });
                    setMarket(adjustedMarket);
                    setClassShortages(result.needsShortages || {});
                    setClassLivingStandard(result.classLivingStandard || {});
                    if (result.army) {
                        setArmy(result.army); // 保存战斗损失
                    }
                    // 更新官员状态（含独立财务数据）
                    // [FIX] 使用函数式更新，合并新雇佣的官员避免竞态条件覆盖
                    if (nextOfficials) {
                        setOfficials(prevOfficials => {
                            // 如果 simulation 返回的官员列表和当前状态一致，直接使用
                            if (!prevOfficials || prevOfficials.length === 0) {
                                return nextOfficials;
                            }

                            // 创建 simulation 结果的 ID 映射（用于快速查找）
                            const simOfficialMap = new Map(nextOfficials.map(o => [o?.id, o]));

                            // 找出当前状态中存在但 simulation 结果中没有的官员（新雇佣的）
                            const newlyHiredOfficials = prevOfficials.filter(
                                o => o?.id && !simOfficialMap.has(o.id)
                            );

                            // 如果没有新雇佣的官员，直接返回 simulation 结果
                            if (newlyHiredOfficials.length === 0) {
                                return nextOfficials;
                            }

                            // 合并：simulation 结果 + 新雇佣的官员
                            console.log(`[HIRE FIX] Preserving ${newlyHiredOfficials.length} newly hired official(s) from race condition`);
                            return [...nextOfficials, ...newlyHiredOfficials];
                        });
                    }
                    if (typeof result.officialsSimCursor === 'number' && typeof setOfficialsSimCursor === 'function') {
                        setOfficialsSimCursor(result.officialsSimCursor);
                    }
                    // 更新官员容量（基于时代、政体、科技动态计算）
                    if (typeof result.effectiveOfficialCapacity === 'number' && typeof setOfficialCapacity === 'function') {
                        setOfficialCapacity(result.effectiveOfficialCapacity);
                    }
                    setLivingStandardStreaks(result.livingStandardStreaks || current.livingStandardStreaks || {});
                    setMigrationCooldowns(result.migrationCooldowns || current.migrationCooldowns || {});
                    setTaxShock(result.taxShock || current.taxShock || {}); // [NEW] 更新累积税收冲击
                    setMerchantState(prev => {
                        const base = prev || current.merchantState || { pendingTrades: [], lastTradeTime: 0, merchantAssignments: {} };
                        const incoming = result.merchantState || current.merchantState || {};

                        // Keep backward-compatible merge so Trade 2.0 assignment UI persists across ticks.
                        const nextState = {
                            ...base,
                            ...incoming,
                            merchantAssignments:
                                (incoming && typeof incoming === 'object' && incoming.merchantAssignments && typeof incoming.merchantAssignments === 'object')
                                    ? incoming.merchantAssignments
                                    : base.merchantAssignments || {},
                        };

                        if (prev === nextState) return prev;
                        return nextState;
                    });
                    if (result.tradeRoutes) {
                        setTradeRoutes(result.tradeRoutes);
                    }
                    if (result.overseasInvestments) {
                        setOverseasInvestments(result.overseasInvestments);
                    }
                    if (result.foreignInvestments) {
                        setForeignInvestments(result.foreignInvestments);
                    }
                    // Update trade route tax stats
                    const calculatedTradeRouteTax = result.taxes?.breakdown?.tradeRouteTax || 0;
                    setTradeStats(prev => ({ ...prev, tradeRouteTax: calculatedTradeRouteTax }));

                    if (nextNations) {
                        setNations(nextNations);
                        // [CRITICAL FIX] Update stateRef immediately to ensure next tick uses updated nations
                        // Without this, vassal population/wealth growth is lost because each tick starts from stale data
                        stateRef.current.nations = nextNations;
                    }
                    // [NEW] Update diplomatic reputation (natural recovery)
                    if (result.diplomaticReputation !== undefined && typeof setDiplomaticReputation === 'function') {
                        setDiplomaticReputation(result.diplomaticReputation);
                    }
                    if (result.diplomacyOrganizations) {
                        setDiplomacyOrganizations(prev => ({
                            ...(prev || {}),
                            ...(result.diplomacyOrganizations || {}),
                            organizations: result.diplomacyOrganizations.organizations || prev?.organizations || []
                        }));
                    }
                    if (result.jobFill) {
                        setJobFill(result.jobFill);
                    }
                    if (result.jobsAvailable) {
                        setJobsAvailable(result.jobsAvailable);
                    }
                    if (result.buildingJobsRequired) {
                        setBuildingJobsRequired(result.buildingJobsRequired);
                    }
                    // [FIX] Save military expense data from simulation
                    // console.log('[useGameLoop] Saving dailyMilitaryExpense:', result.dailyMilitaryExpense);
                    if (result.dailyMilitaryExpense) {
                        // [CRITICAL FIX] 使用window对象临时存储，绕过React state延迟
                        // 这是一个临时解决方案，直到重构state管理
                        window.__GAME_MILITARY_EXPENSE__ = result.dailyMilitaryExpense;
                        current.dailyMilitaryExpense = result.dailyMilitaryExpense;
                        if (typeof setDailyMilitaryExpense === 'function') {
                            setDailyMilitaryExpense(result.dailyMilitaryExpense);
                        }
                    }
                    // [NEW] Update buildings count (from Free Market expansion)
                    if (nextBuildings) {
                        setBuildings(nextBuildings);
                    }
                    if (typeof result.lastMinisterExpansionDay === 'number') {
                        setLastMinisterExpansionDay(result.lastMinisterExpansionDay);
                    }
                    // [DEBUG] 临时日志 - 追踪自由市场机制问题
                    if (result._debug) {
                        // console.log('[FREE MARKET DEBUG]', result._debug.freeMarket);
                    }
                    // Update building upgrades from owner auto-upgrade
                    if (nextBuildingUpgrades) {
                        setBuildingUpgrades(nextBuildingUpgrades);
                    }
                    if (coupOutcome?.event) {
                        setRebellionStates(prev => ({
                            ...prev,
                            official: {
                                ...(prev?.official || {}),
                                organization: 50,
                                stage: ORGANIZATION_STAGE.MOBILIZING,
                            },
                        }));
                    }
                    // 更新事件效果状态（处理衰减和过期）
                    // 注意：nextEffects 由 processTimedEventEffects 计算得出，需要写回状态
                    setActiveEventEffects(prev => ({
                        ...prev,
                        approval: nextEffects.approval,
                        stability: nextEffects.stability,
                        resourceDemand: nextEffects.resourceDemand,
                        stratumDemand: nextEffects.stratumDemand,
                        buildingProduction: nextEffects.buildingProduction,
                        // forcedSubsidy 由单独的逻辑处理，不在此更新
                    }));
                    // 每次 Tick 推进 1 天（而非 gameSpeed 天）
                    // 加速效果通过增加 Tick 频率实现，而非增加每次推进的天数
                    setDaysElapsed(prev => {
                        const numericPrev = Number.isFinite(prev) ? prev : Number(prev);
                        return (Number.isFinite(numericPrev) ? numericPrev : 0) + 1;
                    });
                });

                if (coupOutcome?.event && current.actions?.triggerDiplomaticEvent) {
                    current.actions.triggerDiplomaticEvent(coupOutcome.event);
                }

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
                        popStructure: nextPopStructure || current.popStructure || {},
                        taxPolicies: current.taxPolicies || {},
                        market: result.market || current.market || {},
                        classLivingStandard: result.classLivingStandard || {},
                        livingStandardStreaks: result.livingStandardStreaks || current.livingStandardStreaks || {},
                        epoch: current.epoch || 0,
                        rulingCoalition: current.rulingCoalition || [], // 执政联盟
                        difficultyLevel: current.difficulty, // 游戏难度
                        organizationGrowthMod: result.modifiers?.officialEffects?.organizationGrowthMod || 0, // [NEW] 组织度增长修正
                        // 注意：classInfluence/totalInfluence 已是位置参数，无需在此重复
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
                            debugLog('gameLoop', '[ORGANIZATION] Action:', action, 'Stratum:', stratum, 'Data:', extraData);
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
                                    updatedOrganizationStates[stratumKey] = {
                                        ...updatedOrganizationStates[stratumKey],
                                        organization: 25,
                                        stage: ORGANIZATION_STAGE.GRUMBLING,
                                    };
                                    break;
                                }
                                if (stratumInfluence < MIN_REBELLION_INFLUENCE) {
                                    // 影响力不足无法叛乱，但组织度已满，触发人口外流
                                    const stratumPop = current.popStructure?.[stratumKey] || 0;
                                    const exitRate = 0.05; // 5%人口愤怒离开
                                    const leaving = Math.max(1, Math.floor(stratumPop * exitRate));
                                    const stratumWealth = current.classWealth?.[stratumKey] || 0;
                                    const perCapWealth = stratumPop > 0 ? stratumWealth / stratumPop : 0;
                                    const fleeingCapital = perCapWealth * leaving;

                                    // 扣除离开人口
                                    setPopStructure(prev => ({
                                        ...prev,
                                        [stratumKey]: Math.max(0, (prev[stratumKey] || 0) - leaving),
                                    }));
                                    setPopulation(prev => Math.max(0, prev - leaving));

                                    // 扣除带走的财富
                                    if (fleeingCapital > 0) {
                                        setClassWealth(prev => ({
                                            ...prev,
                                            [stratumKey]: Math.max(0, (prev[stratumKey] || 0) - fleeingCapital),
                                        }), { reason: 'rebellion_fleeing_capital', meta: { stratumKey } });
                                    }

                                    addLog(`⚠️ ${STRATA[stratumKey]?.name || stratumKey}阶层组织度达到100%，但社会影响力不足（${Math.round(stratumInfluence * 100)}%），无法发动叛乱！${leaving}人愤怒地离开了国家。`);

                                    // 降低组织度，让系统恢复正常运转
                                    updatedOrganizationStates[stratumKey] = {
                                        ...updatedOrganizationStates[stratumKey],
                                        organization: 75, // 降到75%而不是99，避免立即再次触发
                                    };
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
                                    // 联合叛乱处理
                                    const coalitionStrata = coalitionResult.coalitionStrata;
                                    const { details, totalLoss } = calculateCoalitionPopLoss(coalitionStrata, current.popStructure);

                                    const existingRebel = (current.nations || []).find(
                                        n => n.isRebelNation && n.isAtWar && (n.isCoalitionRebellion || coalitionStrata.includes(n.rebellionStratum))
                                    );

                                    if (existingRebel) {
                                        // 合并到已存在叛军
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
                                        // 创建新联合叛军
                                        const rebelNation = createCoalitionRebelNation(
                                            coalitionStrata,
                                            current.popStructure,
                                            current.classWealth || {},
                                            result.classInfluence || {},
                                            result.totalInfluence || 0,
                                            COALITION_REBELLION_CONFIG.COALITION_BONUS
                                        );
                                        rebelNation.isCoalitionRebellion = true;
                                        rebelNation.warStartDay = current.daysElapsed || 0;
                                        setNations(prev => [...prev, rebelNation]);
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

                                    // 降低参与阶层组织度
                                    coalitionStrata.forEach(sKey => {
                                        updatedOrganizationStates[sKey] = {
                                            ...updatedOrganizationStates[sKey],
                                            organization: 50,
                                            stage: ORGANIZATION_STAGE.MOBILIZING,
                                        };
                                    });
                                } else {
                                    // 单阶层叛乱
                                    const stratumPop = current.popStructure?.[stratumKey] || 0;
                                    const stratumWealth = current.classWealth?.[stratumKey] || 0;
                                    const rebelPopLoss = calculateRebelPopulation(stratumPop);

                                    const existingRebelNation = (current.nations || []).find(
                                        n => n.isRebelNation && n.rebellionStratum === stratumKey && n.isAtWar
                                    );

                                    if (existingRebelNation) {
                                        setNations(prev => prev.map(n => {
                                            if (n.id === existingRebelNation.id) {
                                                const newPop = (n.population || 0) + rebelPopLoss;
                                                const newWealth = (n.wealth || 0) + Math.floor(stratumWealth * 0.3);
                                                return {
                                                    ...n,
                                                    population: newPop,
                                                    wealth: newWealth,
                                                    economyTraits: { ...n.economyTraits, basePopulation: newPop, baseWealth: newWealth },
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
                                    } else {
                                        const resourceLoot = { resources: current.resources || {}, marketPrices: current.market?.prices || {} };
                                        const rebelResult = createRebelNation(stratumKey, stratumPop, stratumWealth, stratumInfluence, rebelPopLoss, resourceLoot);
                                        const rebelNation = rebelResult.nation;

                                        if (rebelResult.lootedResources && Object.keys(rebelResult.lootedResources).length > 0) {
                                            setResources(prev => {
                                                const updated = { ...prev };
                                                Object.entries(rebelResult.lootedResources).forEach(([resKey, amount]) => {
                                                    updated[resKey] = Math.max(0, (updated[resKey] || 0) - amount);
                                                });
                                                return updated;
                                            }, { reason: 'rebellion_loot' });
                                            const lootSummary = Object.entries(rebelResult.lootedResources).map(([k, v]) => `${RESOURCES[k]?.name || k}: ${v}`).join('、');
                                            addLog(`⚠️ 叛军掠夺了物资：${lootSummary}（总价值约${Math.floor(rebelResult.lootedValue)}银币）`);
                                        }

                                        rebelNation.warStartDay = current.daysElapsed || 0;
                                        setNations(prev => [...prev, rebelNation]);
                                        setPopStructure(prev => ({
                                            ...prev,
                                            [stratumKey]: Math.max(0, (prev[stratumKey] || 0) - rebelPopLoss),
                                        }));
                                        setPopulation(prev => Math.max(0, prev - rebelPopLoss));

                                        event = createActiveRebellionEvent(stratumKey, rebellionStateForEvent, hasMilitary, militaryIsRebelling, rebelNation, rebellionCallback);
                                        addLog(`🔥🔥🔥 ${STRATA[stratumKey]?.name || stratumKey}阶层组织度达到100%，发动叛乱！`);
                                    }

                                    updatedOrganizationStates[stratumKey] = {
                                        ...updatedOrganizationStates[stratumKey],
                                        organization: 50,
                                        stage: ORGANIZATION_STAGE.MOBILIZING,
                                    };
                                }
                                break;
                            }
                        }

                        if (event) {
                            current.actions.triggerDiplomaticEvent(event);
                        }
                    }
                }

                // 更新组织度状态
                setRebellionStates(updatedOrganizationStates);

                // 起义后议和检查
                const rebelNations = (current.nations || []).filter(n => n.isRebelNation && n.isAtWar);
                for (const rebelNation of rebelNations) {
                    const stratumKey = rebelNation.rebellionStratum;
                    if (!stratumKey) continue;
                    if ((rebelNation.warDuration || 0) < 60) continue;

                    const orgState = updatedOrganizationStates[stratumKey];
                    const organization = orgState?.organization ?? 50;
                    const rebelWarScore = rebelNation.warScore || 0;

                    if (organization < 30 && rebelWarScore >= -20) {
                        const stratumName = STRATA[stratumKey]?.name || stratumKey;
                        addLog(`🕊️ ${rebelNation.name}内部分裂，组织度降至${Math.round(organization)}%，叛乱崩溃！`);

                        const returnedPop = Math.floor((rebelNation.population || 0) * 0.5);
                        if (returnedPop > 0) {
                            setPopStructure(prev => ({ ...prev, [stratumKey]: (prev[stratumKey] || 0) + returnedPop }));
                            setPopulation(prev => prev + returnedPop);
                            addLog(`🏠 ${returnedPop}名${stratumName}从叛军中回归。`);
                        }

                        const collapseCallback = (action, nation) => { debugLog('gameLoop', '[REBELLION END]', action, nation?.name); };
                        const collapseEvent = createRebellionEndEvent(rebelNation, true, current.resources?.silver || 0, collapseCallback);
                        if (collapseEvent && current.actions?.triggerDiplomaticEvent) {
                            current.actions.triggerDiplomaticEvent(collapseEvent);
                        }

                        setNations(prevNations => prevNations.map(n => n.id === rebelNation.id ? { ...n, isAtWar: false, warScore: 0, warDuration: 0 } : n));
                        setTimeout(() => { setNations(prevNations => prevNations.filter(n => n.id !== rebelNation.id)); }, 500);

                        setRebellionStates(prev => ({
                            ...prev,
                            [stratumKey]: { ...prev[stratumKey], organization: Math.max(0, organization - 30) }
                        }));
                    }
                }

                // 策略行动冷却
                if (actionCooldowns && Object.keys(actionCooldowns).length > 0) {
                    setActionCooldowns(prev => {
                        if (!prev) return prev;
                        let changed = false;
                        const next = {};
                        Object.entries(prev).forEach(([key, value]) => {
                            if (value > 1) { next[key] = value - 1; changed = true; }
                            else if (value > 1e-6) { changed = true; }
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

                    if (evaluation.completed.length > 0) {
                        evaluation.completed.forEach(task => {
                            addLog(`🤝 ${task.stratumName} 的承诺已兑现：${task.description || '任务完成'}`);
                        });
                    }

                    if (evaluation.updated && evaluation.updated.length > 0) {
                        evaluation.updated.forEach(task => {
                            addLog(`✓ ${task.stratumName} 的承诺目标已达成，现在需要保持 ${task.maintainDuration} 天`);
                        });
                    }

                    if (evaluation.failed.length > 0) {
                        evaluation.failed.forEach(task => {
                            const stratumKey = task.stratumKey;
                            const failReason = task.failReason === 'maintain_broken' ? '未能保持承诺' : '未能按时完成';
                            addLog(`⚠️ 你违背了对${task.stratumName}的承诺（${failReason}），组织度暴涨！`);

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
                                const extraReason = epochBlocksRebellion ? '当前时代他们尚缺乏发动叛乱的组织力' : `社会影响力不足（${Math.round(stratumInfluence * 100)}%）`;
                                addLog(`⚠️ ${STRATA[stratumKey]?.name || stratumKey}阶层因承诺违背组织度达到100%，但${extraReason}，无法发动叛乱！`);
                            }

                            updatedOrganizationStates[stratumKey] = {
                                ...updatedOrganizationStates[stratumKey], // Note: Here we update persisted state, but we should probably use setRebellionStates for promise failure as it's separate from main loop? 
                                // Actually better to keep consistent with previous logic.
                                organization: newOrganization,
                            };

                            // Re-trigger persistence just in case
                            setRebellionStates(prev => ({
                                ...prev,
                                [stratumKey]: { ...prev[stratumKey], organization: newOrganization }
                            }));

                            if (canTriggerUprising && current.actions?.triggerDiplomaticEvent) {
                                const hasMilitary = hasAvailableMilitary(current.army, current.popStructure, stratumKey);
                                const militaryIsRebelling = isMilitaryRebelling(current.rebellionStates || {});

                                const rebellionStateForEvent = {
                                    organization: newOrganization,
                                    dissatisfactionDays: Math.floor(newOrganization),
                                    influenceShare: stratumInfluence,
                                };

                                const stratumPop = current.popStructure?.[stratumKey] || 0;
                                const stratumWealth = current.classWealth?.[stratumKey] || 0;
                                const rebelPopLoss = calculateRebelPopulation(stratumPop);
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

                                if (rebelResult.lootedResources && Object.keys(rebelResult.lootedResources).length > 0) {
                                    setResources(prev => {
                                        const updated = { ...prev };
                                        Object.entries(rebelResult.lootedResources).forEach(([resKey, amount]) => {
                                            updated[resKey] = Math.max(0, (updated[resKey] || 0) - amount);
                                        });
                                        return updated;
                                    }, { reason: 'rebellion_loot' });
                                    const lootSummary = Object.entries(rebelResult.lootedResources)
                                        .map(([k, v]) => `${RESOURCES[k]?.name || k}: ${v}`)
                                        .join('、');
                                    addLog(`⚠️ 叛军掠夺了物资：${lootSummary}（总价值约${Math.floor(rebelResult.lootedValue)}银币）`);
                                }

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
                        // updated 任务已经在 remaining 中了
                    }
                    setPromiseTasks(newRemaining);
                }

                // 处理玩家的分期支付
                if (gameState.playerInstallmentPayment && gameState.playerInstallmentPayment.remainingDays > 0) {
                    const payment = gameState.playerInstallmentPayment;
                    const paymentAmount = payment.amount;

                    if ((current.resources.silver || 0) >= paymentAmount) {
                        setResources(prev => ({
                            ...prev,
                            silver: (prev.silver || 0) - paymentAmount
                        }), { reason: 'installment_payment' });

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
                if (nextPopulation !== current.population) {
                    setPopulation(nextPopulation);
                }
                if (typeof result.birthAccumulator === 'number') {
                    setBirthAccumulator(result.birthAccumulator);
                }

                if (Array.isArray(result.vassalDiplomacyRequests) && result.vassalDiplomacyRequests.length > 0) {
                    const createdDay = current.daysElapsed || 0;
                    setVassalDiplomacyQueue(prev => {
                        const existing = Array.isArray(prev) ? prev : [];
                        const existingSignatures = new Set(
                            existing
                                .filter(item => item && item.status === 'pending')
                                .map(item => item.signature)
                        );
                        const incoming = result.vassalDiplomacyRequests.map(req => {
                            const signature = req.signature
                                || `${req.vassalId || 'unknown'}:${req.actionType || 'unknown'}:${req.targetId || 'none'}:${req.payload?.orgId || ''}`;
                            return {
                                ...req,
                                id: req.id || `vassal_action_${createdDay}_${Math.random().toString(36).slice(2, 8)}`,
                                status: 'pending',
                                createdDay,
                                expiresAt: req.expiresAt || (createdDay + 60),
                                signature,
                            };
                        }).filter(req => !existingSignatures.has(req.signature));

                        if (incoming.length === 0) return existing;
                        return [...existing, ...incoming];
                    });
                }

                if (vassalDiplomacyQueue?.length) {
                    const now = current.daysElapsed || 0;
                    const expired = [];
                    setVassalDiplomacyQueue(prev => {
                        const items = Array.isArray(prev) ? prev : [];
                        const remaining = [];
                        items.forEach(item => {
                            if (!item || item.status !== 'pending') {
                                remaining.push(item);
                                return;
                            }
                            if (item.expiresAt != null && now >= item.expiresAt) {
                                expired.push({ ...item, status: 'expired', resolvedDay: now });
                                return;
                            }
                            remaining.push(item);
                        });
                        return remaining;
                    });
                    if (expired.length > 0) {
                        setVassalDiplomacyHistory(prev => {
                            const history = Array.isArray(prev) ? prev : [];
                            return [...expired, ...history].slice(0, 120);
                        });
                        const expiredPeace = expired.filter(item => item.actionType === 'propose_peace' && item.targetId);
                        if (expiredPeace.length > 0) {
                            const expiredPairs = new Set(expiredPeace.map(item => `${item.vassalId}:${item.targetId}`));
                            setNations(prev => prev.map(n => {
                                const match = [...expiredPairs].find(pair => {
                                    const [vassalId, targetId] = pair.split(':');
                                    return n.id === vassalId || n.id === targetId;
                                });
                                if (!match) return n;
                                const [vassalId, targetId] = match.split(':');
                                const enemyId = n.id === vassalId ? targetId : vassalId;
                                const foreignWars = { ...(n.foreignWars || {}) };
                                if (foreignWars[enemyId]) {
                                    foreignWars[enemyId] = {
                                        ...foreignWars[enemyId],
                                        pendingPeaceApproval: false,
                                    };
                                }
                                return { ...n, foreignWars };
                            }));
                        }
                    }
                }

                // 添加新日志
                if (result.logs.length) {
                    // 去重：追踪已处理的突袭事件
                    const processedRaidNations = new Set();

                    // Filter and transform technical logs to human-readable format
                    const logVisibility = current?.eventEffectSettings?.logVisibility || {};
                    const shouldLogMerchantTrades = logVisibility.showMerchantTradeLogs ?? true;
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

                        // Merchant autonomous trade summary logs (from simulation)
                        // Gate behind showMerchantTradeLogs
                        if (log.startsWith('🛒 商人贸易完成')) {
                            return shouldLogMerchantTrades ? log : null;
                        }

                        // 过滤掉 AI_TRADE_EVENT 的原始 JSON，后续会通过 addLog 添加格式化日志
                        if (log.includes('AI_TRADE_EVENT:')) {
                            return null;
                        }

                        return log;
                    });

                    setLogs(prev => [...processedLogs.filter(log => log !== null), ...prev].slice(0, LOG_STORAGE_LIMIT));

                    // 检测外交事件并触发事件系统
                    const currentActions = current.actions;
                    const eventDebug = isDebugEnabled('event');
                    if (eventDebug) {
                        debugLog('event', '[EVENT DEBUG] actions:', !!currentActions, 'triggerDiplomaticEvent:', !!currentActions?.triggerDiplomaticEvent);
                    }
                    if (currentActions && currentActions.triggerDiplomaticEvent) {
                        if (eventDebug) {
                            debugLog('event', '[EVENT DEBUG] Checking logs:', result.logs);
                            debugLog('event', '[EVENT DEBUG] Total logs count:', result.logs.length);
                        }

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
                                        attackerArmy: raidData.attackerArmy, // Pass attacker army composition
                                        defenderArmy: raidData.defenderArmy, // Pass defender army composition
                                        isPlayerAttacker: false,
                                    };

                                    debugLog('event', '[EVENT DEBUG] Raid battle result created (pre-loop):', battleResult);
                                    // 使用非阻断式通知，不打断玩家操作
                                    currentActions.addBattleNotification(battleResult);
                                }
                            } catch (e) {
                                debugError('event', '[EVENT DEBUG] Failed to parse raid event log:', e);
                            }
                        }


                        result.logs.forEach((log, index) => {
                            debugLog('event', `[EVENT DEBUG] Log ${index}: `, log);
                            debugLog('event', `[EVENT DEBUG] Log ${index} includes RAID_EVENT: `, log.includes('❗RAID_EVENT❗'));

                            // 检测宣战事件（使用新的 WAR_DECLARATION_EVENT 标记）
                            if (log.includes('WAR_DECLARATION_EVENT:')) {
                                debugLog('event', '[EVENT DEBUG] War declaration detected:', log);
                                try {
                                    const jsonStr = log.replace('WAR_DECLARATION_EVENT:', '');
                                    const warData = JSON.parse(jsonStr);
                                    const aggressorId = warData.nationId;
                                    const aggressorName = warData.nationName;

                                    // 触发玩家的宣战弹窗
                                    const aggressor = result.nations?.find(n => n.id === aggressorId);
                                    if (aggressor) {
                                        // [NEW] Pass warData to show appropriate message for vassal protection wars
                                        const event = createWarDeclarationEvent(aggressor, () => {
                                            debugLog('event', '[EVENT DEBUG] War declaration acknowledged');
                                        }, warData);
                                        currentActions.triggerDiplomaticEvent(event);
                                    }


                                    // === 战争同盟连锁反应逻辑 ===
                                    // 既然 simulation.js 仅仅触发了事件，我们需要在这里处理复杂的同盟逻辑
                                    // 我们需要同时更新 state 中的 nations (result.nations 是本Tick的结果，我们需要更新它)

                                    setNations(prevNations => {
                                        const nextNations = [...prevNations];
                                        const aggressorIdx = nextNations.findIndex(n => n.id === aggressorId);
                                        if (aggressorIdx === -1) return nextNations;

                                        // 1. 识别各方盟友（使用军事国际组织）
                                        const orgs = diplomacyOrganizations?.organizations || [];

                                        // 获取某个国家所在的军事组织成员
                                        const getMilitaryOrgMembers = (nationKey) => {
                                            const members = new Set();
                                            orgs.forEach(org => {
                                                if (org?.type !== 'military_alliance') return;
                                                if (!Array.isArray(org.members) || !org.members.includes(nationKey)) return;
                                                org.members.forEach(id => {
                                                    if (id && id !== nationKey) members.add(id);
                                                });
                                            });
                                            return Array.from(members);
                                        };

                                        const aggressorAllianceIds = getMilitaryOrgMembers(aggressorId);
                                        const playerAllianceIds = getMilitaryOrgMembers('player');
                                        const sharedAllianceIds = new Set(aggressorAllianceIds.filter(id => playerAllianceIds.includes(id)));

                                        // 侵略者的盟友（排除共同盟友和附庸）
                                        const aggressorAllies = nextNations.filter(n => {
                                            if (n.id === aggressorId) return false;
                                            if (!aggressorAllianceIds.includes(n.id)) return false;
                                            if (sharedAllianceIds.has(n.id)) return false;
                                            if (n.isAtWar) return false;
                                            // 排除玩家的附庸
                                            if (n.isVassal === true) return false;
                                            return true;
                                        });

                                        // 玩家的盟友（排除共同盟友和附庸）
                                        const playerAllies = nextNations.filter(n => {
                                            if (n.id === aggressorId) return false;
                                            if (!playerAllianceIds.includes(n.id)) return false;
                                            if (sharedAllianceIds.has(n.id)) return false;
                                            if (n.isAtWar) return false;
                                            // 排除玩家的附庸
                                            if (n.isVassal === true) return false;
                                            return true;
                                        });

                                        // ========== 战争上限检查 ==========
                                        const MAX_CONCURRENT_WARS = 3;
                                        // 计算当前与玩家交战的AI国家数量（不包括叛军）
                                        let currentWarsWithPlayer = nextNations.filter(n =>
                                            n.isAtWar === true && !n.isRebelNation
                                        ).length;

                                        // 2. 处理侵略者的盟友加入战争
                                        aggressorAllies.forEach(ally => {
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

                                        // 通知共同盟友保持中立
                                        if (sharedAllianceIds.size > 0) {
                                            const neutralAllies = nextNations.filter(n => sharedAllianceIds.has(n.id));
                                            neutralAllies.forEach(ally => {
                                                addLog(`⚖️ ${ally.name} 同时是你和 ${aggressorName} 的盟友，决定保持中立。`);
                                            });
                                        }

                                        return nextNations;
                                    });

                                } catch (e) {
                                    debugError('event', '[EVENT DEBUG] Failed to parse war declaration event:', e);
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
                                debugLog('event', '[EVENT DEBUG] Peace request detected in log:', log);
                                // Support both regular numbers and scientific notation (e.g., 1.23e+25)
                                const match = log.match(/🤝 (.+) 请求和平，愿意支付 ([\d.e+\-]+) 银币作为赔款/);
                                debugLog('event', '[EVENT DEBUG] Regex match result:', match);
                                if (match) {
                                    const nationName = match[1];
                                    const tribute = parseFloat(match[2]);
                                    debugLog('event', '[EVENT DEBUG] Looking for nation:', nationName);
                                    debugLog('event', '[EVENT DEBUG] result.nations:', result.nations?.map(n => ({ name: n.name, isPeaceRequesting: n.isPeaceRequesting })));
                                    const nation = result.nations?.find(n => n.name === nationName);
                                    debugLog('event', '[EVENT DEBUG] Found nation:', nation?.name, 'isPeaceRequesting:', nation?.isPeaceRequesting);
                                    if (nation && nation.isPeaceRequesting) {
                                        debugLog('event', '[EVENT DEBUG] Creating peace request event...');
                                        debugLog('event', '[EVENT DEBUG] Parameters:', {
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
                                                },
                                                current.epoch || 0
                                            );
                                            debugLog('event', '[EVENT DEBUG] Event created:', event);
                                            debugLog('event', '[EVENT DEBUG] Calling triggerDiplomaticEvent...');
                                            currentActions.triggerDiplomaticEvent(event);
                                            debugLog('event', '[EVENT DEBUG] triggerDiplomaticEvent called');
                                        } catch (error) {
                                            debugError('event', '[EVENT DEBUG] Error creating or triggering event:', error);
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
                                        debugLog('event', '[EVENT DEBUG] Rebel surrender detected:', nationName);
                                        // 创建叛军投降事件（直接使用叛乱结束事件）
                                        // 注意：回调只处理效果，不再调用 handleRebellionWarEnd 避免重复
                                        const surrenderEvent = createRebellionEndEvent(
                                            nation,
                                            true, // 玩家胜利
                                            current.resources?.silver || 0,
                                            (action) => {
                                                // 效果由事件本身的 effects 处理，这里只做日志
                                                debugLog('gameLoop', '[REBELLION SURRENDER]', action, nation?.name);
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
                                            debugLog('gameLoop', '[REBEL ULTIMATUM] Callback triggered:', action, eventData.demandType);
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
                                                    debugLog('gameLoop', '[REBEL REFORM] Amount:', reformAmount, 'Coalition:', coalitionStrata);

                                                    // 扣除银币
                                                    setResources(prev => ({
                                                        ...prev,
                                                        silver: Math.max(0, (prev.silver || 0) - reformAmount)
                                                    }), { reason: 'rebel_reform_payment' });

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
                                                        debugLog('gameLoop', '[REBEL REFORM] Distributed:', distributions.join(', '));
                                                        return newWealth;
                                                    }, { reason: 'rebel_reform_distribution', meta: { coalitionStrata } });

                                                    const distribDesc = coalitionStrata.length > 1
                                                        ? `（按比例分配给：${distributions.join('、')}）`
                                                        : '';
                                                    addLog(`💸 你接受了叛军的改革要求，支付了 ${reformAmount} 银币${distribDesc}。`);
                                                } else if (eventData.demandType === 'subsidy') {
                                                    // 强制补贴：设置为期一年的每日补贴效果，按比例分配给所有联盟阶层
                                                    const subsidyDaily = eventData.subsidyDailyAmount || Math.ceil((eventData.demandAmount || 0) / 365);
                                                    const subsidyTotal = eventData.demandAmount || 0;
                                                    const coalitionStrata = eventData.coalitionStrata || [eventData.subsidyStratum || nationObj.rebellionStratum];
                                                    debugLog('gameLoop', '[REBEL SUBSIDY] Daily:', subsidyDaily, 'Total:', subsidyTotal, 'Coalition:', coalitionStrata);

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
                                                        debugLog('gameLoop', '[REBEL SUBSIDY] Previous state:', prev);

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
                                                        debugLog('gameLoop', '[REBEL SUBSIDY] Added', newSubsidies.length, 'subsidies');
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
                                                    debugLog('gameLoop', '[REBEL] Calling handleRebellionWarEnd for defeat...');
                                                    actions.handleRebellionWarEnd(nationObj.id, false); // false = 玩家失败
                                                } else {
                                                    debugError('gameLoop', '[REBEL] handleRebellionWarEnd not available!');
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
                                    debugError('event', '[EVENT DEBUG] Failed to parse rebel demand:', e);
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
                                            setResources(prev => ({ ...prev, silver: (prev.silver || 0) + eventData.amount }), { reason: 'ai_gift_received' });
                                            setNations(prev => prev.map(n => n.id === nation.id ? { ...n, relation: Math.min(100, (n.relation || 0) + 15) } : n));
                                            addLog(`💰 你接受了 ${nation.name} 的礼物，获得 ${eventData.amount} 银币。`);
                                        });
                                        currentActions.triggerDiplomaticEvent(event);
                                        debugLog('event', '[EVENT DEBUG] AI Gift event triggered:', nation.name, eventData.amount);
                                    }
                                } catch (e) {
                                    debugError('event', '[EVENT DEBUG] Failed to parse AI gift event:', e);
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
                                                setResources(prev => ({ ...prev, silver: (prev.silver || 0) - eventData.amount }), { reason: 'ai_request_payment' });
                                                setNations(prev => prev.map(n => n.id === nation.id ? { ...n, relation: Math.min(100, (n.relation || 0) + 10) } : n));
                                                addLog(`🤝 你满足了 ${nation.name} 的请求，关系提升了。`);
                                            } else {
                                                setNations(prev => prev.map(n => n.id === nation.id ? { ...n, relation: Math.max(0, (n.relation || 0) - 15) } : n));
                                                addLog(`❌ 你拒绝了 ${nation.name} 的请求，关系恶化了。`);
                                            }
                                        });
                                        currentActions.triggerDiplomaticEvent(event);
                                        debugLog('event', '[EVENT DEBUG] AI Request event triggered:', nation.name, eventData.amount);
                                    }
                                } catch (e) {
                                    debugError('event', '[EVENT DEBUG] Failed to parse AI request event:', e);
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
                                        debugLog('event', '[EVENT DEBUG] AI Alliance Request event triggered:', nation.name);
                                    }
                                } catch (e) {
                                    debugError('event', '[EVENT DEBUG] Failed to parse AI alliance request event:', e);
                                }
                            }

                            // Treaty 2.0 MVP: 检测 AI 条约提案事件
                            // AI 组织邀请事件
                            if (log.includes('AI_ORG_INVITE:')) {
                                try {
                                    const jsonStr = log.replace('AI_ORG_INVITE:', '');
                                    const eventData = JSON.parse(jsonStr);
                                    const nation = result.nations?.find(n => n.id === eventData.nationId);
                                    const orgList = result.diplomacyOrganizations?.organizations || current.diplomacyOrganizations?.organizations || [];
                                    const org = orgList.find(entry => entry.id === eventData.orgId);
                                    if (nation && org && currentActions && currentActions.triggerDiplomaticEvent) {
                                        const event = createOrganizationInviteEvent(nation, org, (accepted) => {
                                            if (accepted) {
                                                setDiplomacyOrganizations(prev => {
                                                    const organizations = prev?.organizations || [];
                                                    return {
                                                        ...(prev || {}),
                                                        organizations: organizations.map(entry => {
                                                            if (entry.id !== org.id) return entry;
                                                            const members = Array.isArray(entry.members) ? entry.members : [];
                                                            if (members.includes('player')) return entry;
                                                            return { ...entry, members: [...members, 'player'] };
                                                        }),
                                                    };
                                                });
                                                setNations(prev => prev.map(n =>
                                                    n.id === nation.id
                                                        ? { ...n, relation: Math.min(100, (n.relation || 0) + 8) }
                                                        : n
                                                ));
                                                addLog(`🤝 你接受了 ${nation.name} 的组织邀请，加入了“${org.name}”。`);
                                            } else {
                                                setNations(prev => prev.map(n =>
                                                    n.id === nation.id
                                                        ? { ...n, relation: Math.max(0, (n.relation || 0) - 6) }
                                                        : n
                                                ));
                                                addLog(`你拒绝了 ${nation.name} 的组织邀请，关系略有下降。`);
                                            }
                                        });
                                        currentActions.triggerDiplomaticEvent(event);
                                        debugLog('event', '[EVENT DEBUG] AI org invite event triggered:', nation.name, org?.name);
                                    }
                                } catch (e) {
                                    debugError('event', '[EVENT DEBUG] Failed to parse AI org invite event:', e);
                                }
                            }

                            if (log.includes('AI_TREATY_PROPOSAL:')) {
                                try {
                                    const jsonStr = log.replace('AI_TREATY_PROPOSAL:', '');
                                    const eventData = JSON.parse(jsonStr);
                                    const nation = result.nations?.find(n => n.id === eventData.nationId);
                                    const treaty = eventData.treaty || null;

                                    if (nation && treaty && currentActions && currentActions.triggerDiplomaticEvent) {
                                        const event = createTreatyProposalEvent(nation, treaty, (accepted) => {
                                            if (accepted) {
                                                setNations(prev => prev.map(n => {
                                                    if (n.id !== nation.id) return n;

                                                    const nextTreaties = Array.isArray(n.treaties) ? [...n.treaties] : [];
                                                    nextTreaties.push({
                                                        id: `treaty_${n.id}_${Date.now()}`,
                                                        type: treaty.type,
                                                        startDay: daysElapsed,
                                                        endDay: daysElapsed + Math.max(1, Math.floor(Number(treaty.durationDays) || 365)),
                                                        maintenancePerDay: Math.max(0, Math.floor(Number(treaty.maintenancePerDay) || 0)),
                                                        direction: 'ai_to_player',
                                                    });

                                                    const durationDays = Math.max(1, Math.floor(Number(treaty.durationDays) || 365));
                                                    const updates = { treaties: nextTreaties, relation: Math.min(100, (n.relation || 0) + 8) };

                                                    // Minimal effects reuse existing fields for immediate gameplay impact
                                                    if (OPEN_MARKET_TREATY_TYPES.includes(treaty.type)) {
                                                        updates.openMarketUntil = Math.max(n.openMarketUntil || 0, daysElapsed + durationDays);
                                                    }
                                                    if (PEACE_TREATY_TYPES.includes(treaty.type)) {
                                                        updates.peaceTreatyUntil = Math.max(n.peaceTreatyUntil || 0, daysElapsed + durationDays);
                                                    }
                                                    if (treaty.type === 'defensive_pact') {
                                                        updates.alliedWithPlayer = true;
                                                    }

                                                    return { ...n, ...updates };
                                                }));
                                                addLog(`📜 你与 ${nation.name} 签署了条约（${treaty.type}）。`);
                                            } else {
                                                setNations(prev => prev.map(n =>
                                                    n.id === nation.id
                                                        ? { ...n, relation: Math.max(0, (n.relation || 0) - 8) }
                                                        : n
                                                ));
                                                addLog(`📜 你拒绝了 ${nation.name} 的条约提案，关系下降。`);
                                            }
                                        });

                                        currentActions.triggerDiplomaticEvent(event);
                                        debugLog('event', '[EVENT DEBUG] AI Treaty Proposal event triggered:', nation.name, treaty?.type);
                                    }
                                } catch (e) {
                                    debugError('event', '[EVENT DEBUG] Failed to parse AI treaty proposal event:', e);
                                }
                            }

                            // AI条约撕毁通知
                            if (log.includes('AI_TREATY_BREACH:')) {
                                try {
                                    const jsonStr = log.replace('AI_TREATY_BREACH:', '');
                                    const eventData = JSON.parse(jsonStr);
                                    const nation = result.nations?.find(n => n.id === eventData.nationId);
                                    if (nation && currentActions && currentActions.triggerDiplomaticEvent) {
                                        const event = createTreatyBreachEvent(nation, {
                                            relationPenalty: eventData.relationPenalty,
                                        }, () => { });
                                        currentActions.triggerDiplomaticEvent(event);
                                        debugLog('event', '[EVENT DEBUG] AI Treaty Breach event triggered:', nation.name);
                                    }
                                } catch (e) {
                                    debugError('event', '[EVENT DEBUG] Failed to parse AI treaty breach event:', e);
                                }
                            }

                            // 附庸国独立战争事件
                            if (log.includes('VASSAL_INDEPENDENCE_WAR:')) {
                                try {
                                    const jsonStr = log.replace('VASSAL_INDEPENDENCE_WAR:', '');
                                    const eventData = JSON.parse(jsonStr);
                                    const nation = result.nations?.find(n => n.id === eventData.nationId);
                                    if (nation && currentActions && currentActions.triggerDiplomaticEvent) {
                                        const event = createIndependenceWarEvent(nation, {
                                            vassalType: nation.vassalType,
                                            independencePressure: nation.independencePressure,
                                            tributeRate: nation.tributeRate,
                                        }, (action) => {
                                            if (action === 'crush') {
                                                // 镇压：维持战争状态，降低稳定度
                                                setStability(prev => Math.max(0, prev - 10));
                                                addLog(`⚔️ 你决定出兵镇压 ${nation.name} 的叛乱！`);
                                            } else if (action === 'negotiate') {
                                                // 谈判：尝试取消战争，降低朝贡率
                                                setNations(prev => prev.map(n => {
                                                    if (n.id !== nation.id) return n;
                                                    return {
                                                        ...n,
                                                        isAtWar: false,
                                                        independenceWar: false,
                                                        vassalOf: 'player',
                                                        tributeRate: Math.max(0.02, (n.tributeRate || 0.1) * 0.5),
                                                        // 谈判解决：立即降低独立倾向10点（模拟谈判的即时缓和效果）
                                                        // 之后会根据政策和控制措施自然趋向目标值
                                                        independencePressure: Math.max(0, (n.independencePressure || 0) - 10),
                                                    };
                                                }));
                                                addLog(`📜 你与 ${nation.name} 达成协议，降低朝贡并平息叛乱。`);
                                            } else if (action === 'release') {
                                                // 释放：承认独立，关系提升
                                                setNations(prev => prev.map(n => {
                                                    if (n.id !== nation.id) return n;
                                                    return {
                                                        ...n,
                                                        isAtWar: false,
                                                        warTarget: null,
                                                        independenceWar: false,
                                                        vassalOf: null,
                                                        vassalType: null,
                                                        tributeRate: 0,
                                                        independencePressure: 0,
                                                        relation: Math.min(100, (n.relation || 50) + 30),
                                                    };
                                                }));
                                                addLog(`🏳️ 你承认了 ${nation.name} 的独立，对方感激你的明智决定。`);
                                            }
                                        });
                                        currentActions.triggerDiplomaticEvent(event);
                                        debugLog('event', '[EVENT DEBUG] Independence War event triggered:', nation.name);
                                    }
                                } catch (e) {
                                    debugError('event', '[EVENT DEBUG] Failed to parse independence war event:', e);
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
                                                setResources(prev => ({ ...prev, silver: (prev.silver || 0) - giftCost }), { reason: 'ally_gift' });
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
                                        debugLog('event', '[EVENT DEBUG] Ally Cold event triggered:', nation.name);
                                    }
                                } catch (e) {
                                    debugError('event', '[EVENT DEBUG] Failed to parse Ally Cold event:', e);
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
                                    // 这些属于“贸易路线/市场贸易”类日志，受 showTradeRouteLogs 控制
                                    if (isDebugEnabled('trade')) {
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
                                    }
                                } catch (e) {
                                    debugError('event', '[EVENT DEBUG] Failed to parse AI Trade event:', e);
                                }
                            }

                            // 检测AI要求投降事件
                            if (log.includes('AI_DEMAND_SURRENDER:')) {
                                try {
                                    const jsonStr = log.replace('AI_DEMAND_SURRENDER:', '');
                                    const eventData = JSON.parse(jsonStr);
                                    const nation = result.nations?.find(n => n.id === eventData.nationId);
                                    if (nation && currentActions && currentActions.triggerDiplomaticEvent) {
                                        // 传入玩家状态以便正确计算赔款选项
                                        const playerState = {
                                            population: current.population || 100,
                                            maxPopulation: current.maxPop || 1000,
                                            wealth: current.resources?.silver || 10000,
                                        };
                                        const event = createAIDemandSurrenderEvent(
                                            nation,
                                            eventData.warScore,
                                            { type: eventData.demandType, amount: eventData.demandAmount },
                                            playerState,
                                            (actionType, amount) => {
                                                if (actionType === 'reject') {
                                                    addLog(`⚔️ 你拒绝了 ${nation.name} 的投降要求，战争继续！`);
                                                    return;
                                                }

                                                // 根据选择类型处理不同的投降条件
                                                if (actionType === 'pay_high' || actionType === 'pay_standard' || actionType === 'pay_moderate') {
                                                    // 一次性支付赔款
                                                    const currentSilver = current.resources?.silver || 0;
                                                    if (currentSilver < amount) {
                                                        addLog(`❌ 银币不足（需要 ${amount}，当前 ${Math.floor(currentSilver)}），无法接受投降条件！`);
                                                        return;
                                                    }
                                                    setResources(prev => ({ ...prev, silver: Math.max(0, (prev.silver || 0) - amount) }), { reason: 'war_reparation_payment' });
                                                    addLog(`💰 你向 ${nation.name} 支付了 ${amount} 银币赔款。`);
                                                } else if (actionType === 'pay_installment') {
                                                    // 分期付款 - amount 是每日金额
                                                    // 设置玩家的分期支付状态（不是敌国的！）
                                                    gameState.setPlayerInstallmentPayment({
                                                        nationId: nation.id,
                                                        amount: amount,
                                                        remainingDays: 365,
                                                        totalAmount: amount * 365,
                                                        paidAmount: 0,
                                                    });
                                                    addLog(`📜 你同意在365天内每日向 ${nation.name} 支付 ${amount} 银币（共计 ${amount * 365} 银币）。`);
                                                } else if (actionType === 'offer_population') {
                                                    // 割让人口：扣减人口与人口上限加成，避免下一tick被模拟重算覆盖
                                                    const currentPop = current.population || 0;
                                                    if (currentPop < amount + 10) {
                                                        addLog(`❌ 人口不足（需要 ${amount}，当前 ${Math.floor(currentPop)}），无法接受投降条件！`);
                                                        return;
                                                    }
                                                    setPopulation(prev => Math.max(10, prev - amount));
                                                    // [FIX] Sync popStructure: remove population proportionally from all strata
                                                    setPopStructure(prev => {
                                                        const totalPop = Object.values(prev).reduce((sum, v) => sum + (v || 0), 0);
                                                        if (totalPop <= 0 || amount <= 0) return prev;
                                                        const next = { ...prev };
                                                        let remaining = amount;
                                                        // First try to remove from unemployed
                                                        const unemployedRemove = Math.min(next.unemployed || 0, remaining);
                                                        if (unemployedRemove > 0) {
                                                            next.unemployed = (next.unemployed || 0) - unemployedRemove;
                                                            remaining -= unemployedRemove;
                                                        }
                                                        // If still need to remove, proportionally from other strata
                                                        if (remaining > 0) {
                                                            const activePop = totalPop - (prev.unemployed || 0);
                                                            if (activePop > 0) {
                                                                Object.keys(next).forEach(key => {
                                                                    if (key === 'unemployed' || remaining <= 0) return;
                                                                    const currentVal = next[key] || 0;
                                                                    if (currentVal <= 0) return;
                                                                    const remove = Math.min(currentVal, Math.ceil((currentVal / activePop) * remaining));
                                                                    next[key] = currentVal - remove;
                                                                    remaining -= remove;
                                                                });
                                                            }
                                                        }
                                                        return next;
                                                    });
                                                    setMaxPopBonus(prev => Math.max(-currentPop + 10, prev - amount));
                                                    addLog(`🏴 你向 ${nation.name} 割让了 ${amount} 人口的领土。`);
                                                }

                                                // 结束战争
                                                setNations(prev => prev.map(n => n.id === nation.id ? {
                                                    ...n,
                                                    isAtWar: false,
                                                    warScore: 0,
                                                    warDuration: 0,
                                                    peaceTreatyUntil: current.daysElapsed + 365
                                                } : n));
                                            }
                                        );
                                        currentActions.triggerDiplomaticEvent(event);
                                        debugLog('event', '[EVENT DEBUG] AI Demand Surrender event triggered:', nation.name);
                                    }
                                } catch (e) {
                                    debugError('event', '[EVENT DEBUG] Failed to parse AI Demand Surrender event:', e);
                                }
                            }

                            // 检测AI主动提出无条件和平事件（玩家处于绝境时）
                            if (log.includes('AI_MERCY_PEACE_OFFER:')) {
                                try {
                                    const jsonStr = log.replace('AI_MERCY_PEACE_OFFER:', '');
                                    const eventData = JSON.parse(jsonStr);
                                    const nation = result.nations?.find(n => n.id === eventData.nationId);
                                    if (nation && currentActions && currentActions.triggerDiplomaticEvent) {
                                        // 创建仁慈和平事件
                                        const event = {
                                            id: `mercy_peace_${eventData.nationId}_${Date.now()}`,
                                            type: 'diplomacy',
                                            name: '🕊️ 无条件和平提议',
                                            title: '🕊️ 无条件和平提议',
                                            icon: 'HandHeart',
                                            isDiplomaticEvent: true,
                                            description: `${eventData.nationName} 见你国力衰弱，已无力继续作战，愿意无条件停战。\n\n这是一个难得的喘息机会，接受后双方将签订和平条约。`,
                                            nationId: eventData.nationId,
                                            nationName: eventData.nationName,
                                            warScore: eventData.warScore,
                                            warDuration: eventData.warDuration,
                                            options: [
                                                {
                                                    id: 'accept',
                                                    text: '🕊️ 接受和平',
                                                    description: '结束战争，签订和平条约',
                                                    style: 'success',
                                                    effects: {},
                                                    callback: () => {
                                                        // 接受和平，结束战争
                                                        setNations(prev => prev.map(n => n.id === eventData.nationId ? {
                                                            ...n,
                                                            isAtWar: false,
                                                            warScore: 0,
                                                            warDuration: 0,
                                                            peaceTreatyUntil: current.daysElapsed + 365, // 1年和平条约
                                                            isMercyPeaceOffering: false,
                                                            relation: Math.min(100, (n.relation || 50) + 10), // 关系略微改善
                                                        } : n));
                                                        addLog(`🕊️ 你接受了 ${eventData.nationName} 的和平提议，战争结束。`);
                                                    },
                                                },
                                                {
                                                    id: 'reject',
                                                    text: '⚔️ 拒绝',
                                                    description: '继续战争（不推荐）',
                                                    style: 'danger',
                                                    effects: {},
                                                    callback: () => {
                                                        // 拒绝和平
                                                        setNations(prev => prev.map(n => n.id === eventData.nationId ? {
                                                            ...n,
                                                            isMercyPeaceOffering: false,
                                                        } : n));
                                                        addLog(`⚔️ 你拒绝了 ${eventData.nationName} 的和平提议，战争继续。`);
                                                    },
                                                },
                                            ],
                                        };
                                        currentActions.triggerDiplomaticEvent(event);
                                        debugLog('event', '[EVENT DEBUG] AI Mercy Peace Offer event triggered:', nation.name);
                                    }
                                } catch (e) {
                                    debugError('event', '[EVENT DEBUG] Failed to parse AI Mercy Peace Offer event:', e);
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
                                    debugError('event', '[EVENT DEBUG] Failed to parse AI Break Alliance event:', e);
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
                                                    // ✅ 玩家拒绝援助：关系大幅下降、退出军事组织、背叛者声誉
                                                    setNations(prev => prev.map(n => {
                                                        if (n.id === ally.id) {
                                                            return {
                                                                ...n,
                                                                relation: Math.max(0, (n.relation || 50) - 40),
                                                            };
                                                        }
                                                        // 其他国家也对玩家印象变差（背叛者声誉）
                                                        return {
                                                            ...n,
                                                            relation: Math.max(0, (n.relation || 50) - 10)
                                                        };
                                                    }));

                                                    // ✅ 从军事组织中退出
                                                    setDiplomacyOrganizations(prev => {
                                                        if (!prev?.organizations) return prev;
                                                        return {
                                                            ...prev,
                                                            organizations: prev.organizations.map(org => {
                                                                if (org.type !== 'military_alliance') return org;
                                                                if (!org.members?.includes('player') || !org.members?.includes(ally.id)) return org;
                                                                // 玩家退出此组织
                                                                return {
                                                                    ...org,
                                                                    members: org.members.filter(id => id !== 'player')
                                                                };
                                                            })
                                                        };
                                                    });

                                                    addLog(`💔 你拒绝援助盟友 ${ally.name}，你退出了与其共同的军事组织！你获得了"背叛者"的声誉。`);
                                                }
                                            }
                                        );
                                        currentActions.triggerDiplomaticEvent(event);
                                        debugLog('event', '[EVENT DEBUG] Ally Attacked event triggered:', ally.name);
                                    }
                                } catch (e) {
                                    debugError('event', '[EVENT DEBUG] Failed to parse Ally Attacked event:', e);
                                }
                            }

                            // 检测海外投资机会事件
                            if (log.includes('OVERSEAS_INVESTMENT_OPPORTUNITY:')) {
                                console.log('[AI投资事件监听] 检测到投资机会日志:', log);
                                try {
                                    const jsonStr = log.replace('OVERSEAS_INVESTMENT_OPPORTUNITY:', '');
                                    const eventData = JSON.parse(jsonStr);
                                    const nation = result.nations?.find(n => n.id === eventData.nationId);
                                    console.log('[AI投资事件监听] 解析成功, nation:', nation?.name, 'currentActions:', !!currentActions, 'triggerDiplomaticEvent:', !!currentActions?.triggerDiplomaticEvent);
                                    if (nation && currentActions && currentActions.triggerDiplomaticEvent) {
                                        const event = createOverseasInvestmentOpportunityEvent(
                                            nation,
                                            eventData.opportunity,
                                            (accepted, investmentDetails) => {
                                                console.log('[AI投资事件监听] 回调被触发, accepted:', accepted, 'details:', investmentDetails);
                                                if (accepted && investmentDetails) {
                                                    // 通过外交行动建立投资
                                                    if (actions?.handleDiplomaticAction) {
                                                        actions.handleDiplomaticAction(nation.id, 'accept_foreign_investment', {
                                                            buildingId: investmentDetails.buildingId,
                                                            ownerStratum: investmentDetails.ownerStratum,
                                                            operatingMode: investmentDetails.operatingMode,
                                                            investmentAmount: investmentDetails.requiredInvestment
                                                        });
                                                    }
                                                }
                                            }
                                        );
                                        console.log('[AI投资事件监听] 创建事件成功, 正在触发:', event);
                                        currentActions.triggerDiplomaticEvent(event);
                                        debugLog('event', '[EVENT DEBUG] Overseas Investment Opportunity event triggered:', nation.name);
                                    } else {
                                        console.log('[AI投资事件监听] 缺少必要条件, nation:', !!nation, 'currentActions:', !!currentActions);
                                    }
                                } catch (e) {
                                    console.error('[AI投资事件监听] 解析失败:', e);
                                    debugError('event', '[EVENT DEBUG] Failed to parse Overseas Investment Opportunity event:', e);
                                }
                            }

                            // 检测外资国有化威胁事件
                            if (log.includes('NATIONALIZATION_THREAT:')) {
                                try {
                                    const jsonStr = log.replace('NATIONALIZATION_THREAT:', '');
                                    const eventData = JSON.parse(jsonStr);
                                    const nation = result.nations?.find(n => n.id === eventData.nationId);
                                    if (nation && currentActions && currentActions.triggerDiplomaticEvent) {
                                        const event = createNationalizationThreatEvent(
                                            nation,
                                            eventData.investment,
                                            (action, details) => {
                                                if (action === 'accept_compensation') {
                                                    // 接受补偿，移除投资
                                                    setResources(prev => ({
                                                        ...prev,
                                                        silver: (prev.silver || 0) + (details?.compensation || 0)
                                                    }), { reason: 'nationalization_compensation' });
                                                    addLog(`💰 你接受了 ${nation.name} 的国有化补偿金 ${details?.compensation || 0} 银币。`);
                                                } else if (action === 'negotiate') {
                                                    // 尝试谈判
                                                    setNations(prev => prev.map(n =>
                                                        n.id === nation.id
                                                            ? { ...n, relation: Math.max(0, (n.relation || 50) - 10) }
                                                            : n
                                                    ));
                                                    addLog(`🤝 你尝试与 ${nation.name} 就国有化问题进行谈判，关系下降。`);
                                                } else if (action === 'threaten') {
                                                    // 发出警告
                                                    setNations(prev => prev.map(n =>
                                                        n.id === nation.id
                                                            ? { ...n, relation: Math.max(0, (n.relation || 50) - 25) }
                                                            : n
                                                    ));
                                                    addLog(`⚠️ 你警告 ${nation.name} 不要国有化你的投资，关系严重恶化！`);
                                                }
                                            }
                                        );
                                        currentActions.triggerDiplomaticEvent(event);
                                        debugLog('event', '[EVENT DEBUG] Nationalization Threat event triggered:', nation.name);
                                    }
                                } catch (e) {
                                    debugError('event', '[EVENT DEBUG] Failed to parse Nationalization Threat event:', e);
                                }
                            }

                            // 检测贸易争端事件
                            if (log.includes('TRADE_DISPUTE:')) {
                                try {
                                    const jsonStr = log.replace('TRADE_DISPUTE:', '');
                                    const eventData = JSON.parse(jsonStr);
                                    const nation1 = result.nations?.find(n => n.id === eventData.nation1Id);
                                    const nation2 = result.nations?.find(n => n.id === eventData.nation2Id);
                                    if (nation1 && nation2 && currentActions && currentActions.triggerDiplomaticEvent) {
                                        const event = createTradeDisputeEvent(
                                            nation1,
                                            nation2,
                                            eventData.disputeType,
                                            (decision) => {
                                                if (decision === 'support_nation1') {
                                                    setNations(prev => prev.map(n => {
                                                        if (n.id === nation1.id) return { ...n, relation: Math.min(100, (n.relation || 50) + 10) };
                                                        if (n.id === nation2.id) return { ...n, relation: Math.max(0, (n.relation || 50) - 15) };
                                                        return n;
                                                    }));
                                                    addLog(`⚖️ 你在贸易争端中支持 ${nation1.name}。`);
                                                } else if (decision === 'support_nation2') {
                                                    setNations(prev => prev.map(n => {
                                                        if (n.id === nation2.id) return { ...n, relation: Math.min(100, (n.relation || 50) + 10) };
                                                        if (n.id === nation1.id) return { ...n, relation: Math.max(0, (n.relation || 50) - 15) };
                                                        return n;
                                                    }));
                                                    addLog(`⚖️ 你在贸易争端中支持 ${nation2.name}。`);
                                                } else if (decision === 'mediate') {
                                                    setNations(prev => prev.map(n => {
                                                        if (n.id === nation1.id || n.id === nation2.id) {
                                                            return { ...n, relation: Math.min(100, (n.relation || 50) + 5) };
                                                        }
                                                        return n;
                                                    }));
                                                    addLog(`🤝 你成功调停了 ${nation1.name} 与 ${nation2.name} 之间的贸易争端。`);
                                                }
                                            }
                                        );
                                        currentActions.triggerDiplomaticEvent(event);
                                        debugLog('event', '[EVENT DEBUG] Trade Dispute event triggered:', nation1.name, nation2.name);
                                    }
                                } catch (e) {
                                    debugError('event', '[EVENT DEBUG] Failed to parse Trade Dispute event:', e);
                                }
                            }

                            // 检测军事同盟邀请事件
                            if (log.includes('MILITARY_ALLIANCE_INVITE:')) {
                                try {
                                    const jsonStr = log.replace('MILITARY_ALLIANCE_INVITE:', '');
                                    const eventData = JSON.parse(jsonStr);
                                    const inviter = result.nations?.find(n => n.id === eventData.inviterId);
                                    const target = result.nations?.find(n => n.id === eventData.targetId);
                                    if (inviter && target && currentActions && currentActions.triggerDiplomaticEvent) {
                                        const event = createMilitaryAllianceInviteEvent(
                                            inviter,
                                            target,
                                            eventData.reason,
                                            (accepted, rejectType) => {
                                                if (accepted) {
                                                    setNations(prev => prev.map(n => {
                                                        if (n.id === inviter.id) {
                                                            return { ...n, alliedWithPlayer: true, relation: Math.min(100, (n.relation || 50) + 20) };
                                                        }
                                                        if (n.id === target.id) {
                                                            return { ...n, relation: Math.max(0, (n.relation || 50) - 20) };
                                                        }
                                                        return n;
                                                    }));
                                                    addLog(`🤝 你与 ${inviter.name} 建立军事同盟，共同对抗 ${target.name}。`);
                                                } else if (rejectType === 'warn_target') {
                                                    setNations(prev => prev.map(n => {
                                                        if (n.id === target.id) return { ...n, relation: Math.min(100, (n.relation || 50) + 15) };
                                                        if (n.id === inviter.id) return { ...n, relation: Math.max(0, (n.relation || 50) - 25) };
                                                        return n;
                                                    }));
                                                    addLog(`📢 你向 ${target.name} 通报了 ${inviter.name} 的同盟邀请。`);
                                                } else {
                                                    addLog(`你婉拒了 ${inviter.name} 的军事同盟邀请。`);
                                                }
                                            }
                                        );
                                        currentActions.triggerDiplomaticEvent(event);
                                        debugLog('event', '[EVENT DEBUG] Military Alliance Invite event triggered:', inviter.name);
                                    }
                                } catch (e) {
                                    debugError('event', '[EVENT DEBUG] Failed to parse Military Alliance Invite event:', e);
                                }
                            }

                            // 检测边境冲突事件
                            if (log.includes('BORDER_INCIDENT:')) {
                                try {
                                    const jsonStr = log.replace('BORDER_INCIDENT:', '');
                                    const eventData = JSON.parse(jsonStr);
                                    const nation = result.nations?.find(n => n.id === eventData.nationId);
                                    if (nation && currentActions && currentActions.triggerDiplomaticEvent) {
                                        const event = createBorderIncidentEvent(
                                            nation,
                                            { casualties: eventData.casualties, isOurFault: eventData.isOurFault },
                                            (response) => {
                                                if (response === 'apologize') {
                                                    setResources(prev => ({ ...prev, silver: Math.max(0, (prev.silver || 0) - 500) }), { reason: 'border_incident_compensation' });
                                                    addLog(`🙏 你向 ${nation.name} 道歉并支付了赔偿金。`);
                                                } else if (response === 'deny') {
                                                    setNations(prev => prev.map(n =>
                                                        n.id === nation.id ? { ...n, relation: Math.max(0, (n.relation || 50) - 15) } : n
                                                    ));
                                                    addLog(`❌ 你否认了边境冲突的责任，${nation.name} 对此表示不满。`);
                                                } else if (response === 'demand_apology') {
                                                    addLog(`📜 你向 ${nation.name} 发出正式抗议，要求道歉。`);
                                                } else if (response === 'retaliate') {
                                                    setNations(prev => prev.map(n =>
                                                        n.id === nation.id ? { ...n, relation: Math.max(0, (n.relation || 50) - 30) } : n
                                                    ));
                                                    addLog(`⚔️ 你下令对 ${nation.name} 进行军事报复！`);
                                                } else if (response === 'protest') {
                                                    addLog(`📜 你向 ${nation.name} 提出外交抗议。`);
                                                }
                                            }
                                        );
                                        currentActions.triggerDiplomaticEvent(event);
                                        debugLog('event', '[EVENT DEBUG] Border Incident event triggered:', nation.name);
                                    }
                                } catch (e) {
                                    debugError('event', '[EVENT DEBUG] Failed to parse Border Incident event:', e);
                                }
                            }

                            // 检测附庸请求事件
                            if (log.includes('VASSAL_REQUEST:')) {
                                try {
                                    const jsonStr = log.replace('VASSAL_REQUEST:', '');
                                    const eventData = JSON.parse(jsonStr);
                                    const nation = result.nations?.find(n => n.id === eventData.nationId);
                                    if (nation && currentActions && currentActions.triggerDiplomaticEvent) {
                                        const event = createVassalRequestEvent(
                                            nation,
                                            eventData.vassalType,
                                            eventData.reason,
                                            (accepted, vassalType) => {
                                                if (accepted) {
                                                    // 通过外交行动建立附庸关系
                                                    if (actions?.handleDiplomaticAction) {
                                                        actions.handleDiplomaticAction(nation.id, 'establish_vassal', {
                                                            vassalType: vassalType
                                                        });
                                                    }
                                                    addLog(`👑 ${nation.name} 成为你的附庸！`);
                                                } else {
                                                    addLog(`你拒绝了 ${nation.name} 成为附庸的请求。`);
                                                }
                                            }
                                        );
                                        currentActions.triggerDiplomaticEvent(event);
                                        debugLog('event', '[EVENT DEBUG] Vassal Request event triggered:', nation.name);
                                    }
                                } catch (e) {
                                    debugError('event', '[EVENT DEBUG] Failed to parse Vassal Request event:', e);
                                }
                            }


                        });
                    }
                }
                // 处理训练队列

                // [FIX] Moved Auto Replenish Logic here to share scope with setMilitaryQueue
                const autoRecruitEnabled = current.autoRecruitEnabled || false;
                const allAutoReplenishLosses = {};

                // DEBUG: Check if we are receiving any replenish logs
                const hasReplenishLog = result.logs.some(l => typeof l === 'string' && l.includes('AUTO_REPLENISH_LOSSES:'));
                if (hasReplenishLog) {
                    addLog(`🛠️ [DEBUG] Worker sent replenishment signal! AutoRecruit: ${autoRecruitEnabled}`);
                }

                if (autoRecruitEnabled) {
                    result.logs.forEach((log) => {
                        if (typeof log === 'string' && log.includes('AUTO_REPLENISH_LOSSES:')) {
                            try {
                                const jsonStr = log.replace('AUTO_REPLENISH_LOSSES:', '');
                                const losses = JSON.parse(jsonStr);
                                Object.entries(losses).forEach(([unitId, count]) => {
                                    if (count > 0) {
                                        allAutoReplenishLosses[unitId] = (allAutoReplenishLosses[unitId] || 0) + count;
                                    }
                                });
                            } catch (e) {
                                console.error(e);
                            }
                        }
                    });
                }
                const autoReplenishKey = Object.entries(allAutoReplenishLosses)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([unitId, count]) => `${unitId}:${count}`)
                    .join('|');

                const shouldProcessAutoReplenish = autoRecruitEnabled && Object.keys(allAutoReplenishLosses).length > 0;

                if (shouldProcessAutoReplenish) {
                    debugLog('gameLoop', `[AUTO_REPLENISH] Triggering for losses: ${autoReplenishKey}`);
                }

                // [FIX] 将自动补兵逻辑移入此回调，确保使用最新的队列状态
                setMilitaryQueue(prev => {
                    let baseQueue = queueOverrideForManpower || prev;
                    const currentSoldierPop = (soldierPopulationAfterEvents ?? result.popStructure?.soldier) || 0;
                    // [FIX] 使用战斗后的军队状态 (result.army)
                    const currentArmyCount = Object.values(result.army || armyStateForQueue || {}).reduce((sum, count) => sum + count, 0);
                    // [FIX] 计算军队实际人口消耗（考虑不同兵种的populationCost）
                    const currentArmyPopulation = calculateArmyPopulation(result.army || armyStateForQueue || {});
                    const militaryCapacity = getMilitaryCapacity(current.buildings || {});

                    // [FIX] 在队列处理中执行自动补兵，确保使用最新状态
                    if (shouldProcessAutoReplenish && autoRecruitEnabled && militaryCapacity > 0) {
                        // 计算可用槽位 = 容量 - 当前军队 - 当前队列
                        const availableSlotsForReplenish = Math.max(0, militaryCapacity - currentArmyCount - baseQueue.length);

                        if (availableSlotsForReplenish > 0) {
                            let slotsRemaining = availableSlotsForReplenish;
                            const replenishItems = [];
                            const replenishCounts = {};

                            // 计算每种单位可补充的数量
                            // IMPORTANT: units already queued for auto-replenish (waiting/training) should count as "already replenishing"
                            // otherwise we'd enqueue the same losses again on every tick until training finishes.
                            const queuedAutoReplenishCounts = {};
                            for (let i = 0; i < baseQueue.length; i++) {
                                const q = baseQueue[i];
                                if (!q?.isAutoReplenish) continue;
                                if (!q?.unitId) continue;
                                queuedAutoReplenishCounts[q.unitId] = (queuedAutoReplenishCounts[q.unitId] || 0) + 1;
                            }

                            Object.entries(allAutoReplenishLosses).forEach(([unitId, lossCount]) => {
                                if (lossCount <= 0 || slotsRemaining <= 0) return;
                                const unit = UNIT_TYPES[unitId];
                                if (!unit || unit.epoch > current.epoch) return;

                                const alreadyQueued = queuedAutoReplenishCounts[unitId] || 0;
                                const remainingLossToCover = Math.max(0, lossCount - alreadyQueued);
                                if (remainingLossToCover <= 0) return;

                                const fillCount = Math.min(remainingLossToCover, slotsRemaining);
                                if (fillCount > 0) {
                                    replenishCounts[unitId] = fillCount;
                                    slotsRemaining -= fillCount;
                                }
                            });

                            // 检查资源是否足够
                            const getMarketPrice = (resource) => {
                                const base = RESOURCES[resource]?.basePrice || 1;
                                return result.market?.prices?.[resource] ?? current.market?.prices?.[resource] ?? base;
                            };

                            let totalSilverCost = 0;
                            const totalResourceCost = {};
                            Object.entries(replenishCounts).forEach(([unitId, count]) => {
                                const unit = UNIT_TYPES[unitId];
                                if (!unit) return;
                                const cost = unit.recruitCost || {};
                                Object.entries(cost).forEach(([res, amount]) => {
                                    totalResourceCost[res] = (totalResourceCost[res] || 0) + amount * count;
                                });
                                const unitSilverCost = Object.entries(cost).reduce((sum, [res, amount]) => {
                                    return sum + amount * getMarketPrice(res);
                                }, 0);
                                totalSilverCost += unitSilverCost * count;
                            });

                            // 检查是否能支付
                            const currentResources = result.resources || current.resources || {};
                            let canAfford = (currentResources.silver || 0) >= totalSilverCost;
                            if (canAfford) {
                                Object.entries(totalResourceCost).forEach(([res, amount]) => {
                                    if ((currentResources[res] || 0) < amount) canAfford = false;
                                });
                            }

                            if (canAfford && Object.keys(replenishCounts).length > 0) {
                                // 扣除资源
                                setResources(prevRes => {
                                    const next = { ...prevRes };
                                    next.silver = Math.max(0, (next.silver || 0) - totalSilverCost);
                                    Object.entries(totalResourceCost).forEach(([res, amount]) => {
                                        next[res] = Math.max(0, (next[res] || 0) - amount);
                                    });
                                    return next;
                                }, { reason: 'auto_replenish_cost' });

                                // 添加到队列
                                Object.entries(replenishCounts).forEach(([unitId, count]) => {
                                    const unit = UNIT_TYPES[unitId];
                                    if (!unit) return;
                                    const trainingSpeedBonus = result.modifiers?.ministerEffects?.militaryTrainingSpeed || 0;
                                    const trainingMultiplier = Math.max(0.5, 1 - trainingSpeedBonus);
                                    const baseTrainTime = unit.trainingTime || unit.trainDays || 1;
                                    const trainTime = Math.max(1, Math.ceil(baseTrainTime * trainingMultiplier));
                                    for (let i = 0; i < count; i++) {
                                        replenishItems.push({
                                            unitId,
                                            status: 'waiting',
                                            totalTime: trainTime,
                                            remainingTime: trainTime,
                                            isAutoReplenish: true,
                                        });
                                    }
                                });

                                if (replenishItems.length > 0) {
                                    baseQueue = [...baseQueue, ...replenishItems];
                                    const summary = Object.entries(replenishCounts)
                                        .filter(([_, count]) => count > 0)
                                        .map(([unitId, count]) => `${UNIT_TYPES[unitId]?.name || unitId} ×${count}`)
                                        .join('、');
                                    addLog(`🔄 自动补兵：已花费资金招募 ${summary} 加入训练队列。`);
                                }
                            } else if (!canAfford && Object.keys(replenishCounts).length > 0) {
                                addLog(`❌ 资金或资源不足，已取消本次自动补兵（需 ${Math.ceil(totalSilverCost)} 银币）。`);
                            }
                        } else if (availableSlotsForReplenish <= 0 && Object.keys(allAutoReplenishLosses).length > 0) {
                            addLog('⚠️ 军事容量不足，自动补兵已暂停。');
                        }
                    } else if (shouldProcessAutoReplenish && militaryCapacity <= 0) {
                        addLog('⚠️ 无军事容量，自动补兵已禁用。请建造兵营。');
                    }

                    // 原有的队列裁剪逻辑
                    if (militaryCapacity > 0) {
                        const maxQueueSize = Math.max(0, militaryCapacity - currentArmyCount);
                        if (baseQueue.length > maxQueueSize) {
                            const trainingItems = baseQueue.filter(item => item.status === 'training');
                            const waitingItems = baseQueue.filter(item => item.status !== 'training');
                            let trimmedQueue = [];
                            if (trainingItems.length >= maxQueueSize) {
                                trimmedQueue = trainingItems.slice(0, maxQueueSize);
                            } else {
                                const remainingSlots = maxQueueSize - trainingItems.length;
                                trimmedQueue = [...trainingItems, ...waitingItems.slice(0, remainingSlots)];
                            }
                            const removedCount = baseQueue.length - trimmedQueue.length;
                            if (removedCount > 0) {
                                const currentDay = current.daysElapsed || 0;
                                if (capacityTrimLogRef.current.day !== currentDay) {
                                    capacityTrimLogRef.current.day = currentDay;
                                    addLog(`⚠️ 军事容量不足，已取消 ${removedCount} 个训练队列名额。`);
                                }
                            }
                            baseQueue = trimmedQueue;
                        }
                    }

                    // 计算有多少岗位可以用于新训练（避免多次 filter 带来的 O(n) 扫描）
                    // [FIX] 必须考虑不同兵种的populationCost，否则会导致超员
                    let waitingCount = 0;
                    let trainingCount = 0;
                    let trainingPopulation = 0; // [FIX] 训练中单位的实际人口消耗
                    for (let i = 0; i < baseQueue.length; i++) {
                        const item = baseQueue[i];
                        const s = item?.status;
                        if (s === 'waiting') waitingCount++;
                        else if (s === 'training') {
                            trainingCount++;
                            // [FIX] 累加训练中单位的人口消耗
                            const popCost = UNIT_TYPES[item?.unitId]?.populationCost || 1;
                            trainingPopulation += popCost;
                        }
                    }

                    // [FIX] 使用人口消耗而非单位数量来计算可用岗位
                    const occupiedPopulation = currentArmyPopulation + trainingPopulation;
                    const availableJobsForNewTraining = Math.max(0, currentSoldierPop - occupiedPopulation);

                    // 将等待中的项转为训练中（如果有可用岗位）
                    // [PERF] 大队列时逐条写日志会严重卡顿，这里做节流：只写摘要日志
                    // [FIX] 使用人口消耗而非单位数量来判断是否可以开始训练
                    let remainingPopCapacity = availableJobsForNewTraining;
                    let startedThisTick = 0;
                    const updated = baseQueue.map(item => {
                        if (item.status === 'waiting' && remainingPopCapacity > 0) {
                            // [FIX] 检查该单位的人口消耗是否在可用范围内
                            const unitPopCost = UNIT_TYPES[item?.unitId]?.populationCost || 1;
                            if (unitPopCost > remainingPopCapacity) {
                                // 人口不足以训练此单位，跳过
                                return item;
                            }
                            remainingPopCapacity -= unitPopCost;
                            startedThisTick++;
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

                    if (startedThisTick > 0) {
                        addLog(`✓ ${startedThisTick} 个单位开始训练`);
                    }

                    // 找出已完成的训练（避免再次 filter 扫描）
                    const completed = [];
                    for (let i = 0; i < updated.length; i++) {
                        const it = updated[i];
                        if (it?.status === 'training' && it.remainingTime <= 0) completed.push(it);
                    }

                    // [FIX] 计算可以加入军队的数量（不超过容量上限）
                    const currentTotalArmy = Object.values(result.army || armyStateForQueue || {}).reduce((sum, c) => sum + c, 0);
                    const slotsAvailableForCompletion = militaryCapacity > 0
                        ? Math.max(0, militaryCapacity - currentTotalArmy)
                        : completed.length; // 如果没有容量限制，允许所有完成的单位加入

                    // 只取能加入的部分
                    const canComplete = completed.slice(0, slotsAvailableForCompletion);
                    const mustWait = completed.slice(slotsAvailableForCompletion);

                    if (canComplete.length > 0) {
                        // 将完成的单位加入军队
                        setArmy(prevArmy => {
                            const newArmy = { ...prevArmy };
                            // [FIX] 再次检查容量，防止竞态条件
                            const prevTotal = Object.values(newArmy).reduce((sum, c) => sum + c, 0);
                            let addedCount = 0;

                            canComplete.forEach(item => {
                                if (militaryCapacity <= 0 || prevTotal + addedCount < militaryCapacity) {
                                    newArmy[item.unitId] = (newArmy[item.unitId] || 0) + 1;
                                    addedCount++;
                                }
                            });
                            return newArmy;
                        });

                        // [PERF] 大量单位同时毕业时逐条日志会卡顿：改为摘要 + 少量样例
                        {
                            const total = canComplete.length;
                            if (total <= 10) {
                                canComplete.forEach(item => {
                                    addLog(`✓ ${UNIT_TYPES[item.unitId].name} 训练完成！`);
                                });
                            } else {
                                const preview = canComplete
                                    .slice(0, 3)
                                    .map(item => UNIT_TYPES[item.unitId]?.name || item.unitId)
                                    .join('、');
                                addLog(`✓ ${total} 个单位训练完成（例如：${preview}...）`);
                            }
                        }
                    }

                    if (mustWait.length > 0) {
                        addLog(`⚠️ 军事容量已满，${mustWait.length} 个单位将在队列中等待。`);
                    }

                    // 返回未完成的训练（排除已完成且加入军队的），保留因容量问题未能加入的
                    // IMPORTANT: We must remove the exact items we just added to the army.
                    // Using indexes here is error-prone because `canComplete` is a slice of `completed`.
                    const canCompleteSet = new Set(canComplete);
                    return updated.filter(item => {
                        if (item.status === 'training' && item.remainingTime <= 0) {
                            // Remove only those completed items that were successfully applied to the army
                            return !canCompleteSet.has(item);
                        }
                        return true;
                    });
                });

                const perfNow = (typeof performance !== 'undefined' && performance.now)
                    ? performance.now()
                    : Date.now();
                const perfTotalMs = perfNow - perfTickStart;
                const perfApplyMs = Math.max(0, perfTotalMs - perfSimMs);
                const forceLog = typeof window !== 'undefined' && window.__PERF_LOG === true;
                const sectionEntries = result?._perf?.sections
                    ? Object.entries(result._perf.sections)
                        .filter(([, value]) => Number.isFinite(value) && value > 0)
                    : [];
                const sectionSum = sectionEntries.reduce((sum, [, value]) => sum + value, 0);
                const otherMs = Math.max(0, perfSimMs - sectionSum);
                if (typeof window !== 'undefined') {
                    window.__PERF_STATS = {
                        day: perfDay,
                        totalMs: perfTotalMs,
                        simMs: perfSimMs,
                        applyMs: perfApplyMs,
                        nations: current.nations?.length || 0,
                        overseas: overseasInvestmentsRef.current?.length || 0,
                        foreign: current.foreignInvestments?.length || 0,
                        sections: result?._perf?.sections || null,
                        otherMs,
                    };
                }
                const topSections = sectionEntries
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3)
                    .map(([label, value]) => `${label}=${value.toFixed(1)}ms`)
                    .join(' ');
                const shouldLog =
                    forceLog ||
                    !perfLogRef.current.didLogOnce ||
                    perfTotalMs >= PERF_SLOW_THRESHOLD_MS ||
                    (perfDay % PERF_LOG_INTERVAL_DAYS === 0 && perfLogRef.current.lastLogDay !== perfDay);
                if (shouldLog) {
                    perfLogRef.current.lastLogDay = perfDay;
                    perfLogRef.current.didLogOnce = true;
                    console.log(
                        `[Perf] day=${perfDay} total=${perfTotalMs.toFixed(1)}ms sim=${perfSimMs.toFixed(1)}ms apply=${perfApplyMs.toFixed(1)}ms ` +
                        `nations=${current.nations?.length || 0} overseas=${overseasInvestmentsRef.current?.length || 0} foreign=${current.foreignInvestments?.length || 0}` +
                        (topSections ? ` sections=${topSections}` : '') +
                        (otherMs > 0 ? ` other=${otherMs.toFixed(1)}ms` : '')
                    );
                    if (forceLog && sectionEntries.length > 0) {
                        const sorted = [...sectionEntries].sort((a, b) => b[1] - a[1]);
                        console.table(Object.fromEntries(sorted.map(([k, v]) => [k, Number(v.toFixed(2))])));
                    }
                }
            }).catch(error => {
                console.error('[GameLoop] Simulation error:', error);
            }).catch((error) => {
                simInFlightRef.current = false;
                console.error('[GameLoop] Simulation failed:', error);
            });
        }, tickInterval); // 根据游戏速度动态调整执行频率

        return () => clearInterval(timer);
    }, [gameSpeed, isPaused, activeFestivalEffects, setFestivalModal, setActiveFestivalEffects, setLastFestivalYear, lastFestivalYear, setIsPaused]); // 依赖游戏速度、暂停状态和庆典相关状态
};
