// 游戏循环钩子
// 处理游戏的核心循环逻辑，包括资源生产、人口增长等

import { useEffect, useRef, useState } from 'react';
import { unstable_batchedUpdates } from 'react-dom';
import { useSimulationWorker } from './useSimulationWorker';
import { isLowPerformance } from './useDevicePerformance';
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
import { buildAnnualReport } from '../utils/annualReport';

import { IDEOLOGY_MAP } from '../config/ideologies';
import { IDEOLOGY_SYNERGIES, ANTI_SYNERGIES } from '../config/ideologySynergies';
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
// 鏂扮増缁勭粐搴︾郴缁?
import {
    updateAllOrganizationStates,
    checkOrganizationEvents,
    ORGANIZATION_STAGE,
    MIN_REBELLION_INFLUENCE,
    MIN_REBELLION_POPULATION,
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
import { formatNumberShortCN } from '../utils/numberFormat';
import {
    trackPeriodicMetrics, trackRebellionPhase,
    trackEconomicFlows, trackPriceSampling,
    trackPopulationMilestone, trackPopulationStarvation,
    trackStabilityLevelChange, trackEconomicCrisis, trackTaxChange,
    trackAINationSampling,
} from '../analytics/gaTracker';
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
import { getTreatyDailyMaintenance } from '../config/diplomacy';
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
import {
    generateFront,
    processFrontTick,
    processFrontFriction,
    processFrontAdvance,
    buildResourceCoverage,
    ensureFrontDefaults,
    plunderResourceNode,
    getPlayerSide,
    getEnemySide,
    summarizeFrontState,
    getBoundedHomelandPressure,
    getEffectiveFrontWarScore,
    getWarScoreBreakdownTotal,
} from '../logic/diplomacy/frontSystem';
import { processCombatRound, calculateRoundSupplyCost, createBattle, selectBattleParticipants, ensureBattleDefaults, autoSelectTactic, processReinforcement, isBattleActive } from '../logic/diplomacy/battleSystem';
import { getCorpsGeneral, awardGeneralXP, getCorpsTotalUnits, findBestReplenishTarget } from '../logic/diplomacy/corpsSystem';
import { ensureAIMilitaryState, syncAINationMilitary, evaluateAIFrontPlan, evaluateGeneralBattleProposal, allocateAICorpsToFronts, applyAICorpsAllocation } from '../logic/diplomacy/aiWar';
import { applyMilitaryProcurementPressure, calculateWarPlunder, calculateResourcePlunder } from '../logic/diplomacy/warEconomy';
import { WAR_ECONOMY } from '../config/gameConstants';
import {
    reducePopulationWithFloor,
} from '../utils/populationClamp';

import { createBattleProposalEvent } from '../config/events/diplomaticEvents';
import { ideologyEventBus, IDEOLOGY_EVENTS } from '../logic/ideology/ideologyEventBus';
import {
    buildIdeologyScalingContext,
    createEmptyIdeologyMetrics,
    scaleLegacyResourceAmount,
    scaleLegacyMilestoneThreshold,
    updateIdeologyMetrics,
} from '../logic/ideology/ideologyScaling.js';

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

const getTotalBuildingCount = (buildingState = {}) => (
    Object.values(buildingState || {}).reduce((sum, count) => sum + (count || 0), 0)
);

// [FIX Bug8/9] 统计所有军事单位：散兵 + 训练队列 + 军团内单位
const getTotalArmyCount = (armyState = {}, queueState = [], corpsState = []) => {
    const armyCount = Object.values(armyState || {}).reduce((sum, count) => sum + (count || 0), 0);
    const queueCount = Array.isArray(queueState) ? queueState.length : 0;
    let corpsCount = 0;
    if (Array.isArray(corpsState)) {
        for (const corps of corpsState) {
            if (corps?.isAI) continue;
            corpsCount += Object.values(corps?.units || {}).reduce((sum, c) => sum + (c || 0), 0);
        }
    }
    return armyCount + queueCount + corpsCount;
};

const normalizeTaxPolicySnapshot = (taxPolicies = {}) => {
    const toSortedPairs = (obj = {}) => Object.entries(obj || {}).sort(([a], [b]) => a.localeCompare(b));
    return {
        headTaxRates: toSortedPairs(taxPolicies.headTaxRates),
        resourceTaxRates: toSortedPairs(taxPolicies.resourceTaxRates),
        businessTaxRates: toSortedPairs(taxPolicies.businessTaxRates),
        importTariffMultipliers: toSortedPairs(taxPolicies.importTariffMultipliers),
        exportTariffMultipliers: toSortedPairs(taxPolicies.exportTariffMultipliers),
    };
};

const emitTaxPolicyChanges = (prevSnapshot, nextSnapshot) => {
    const emitDiff = (taxType, prevPairs, nextPairs) => {
        const prevMap = new Map(prevPairs || []);
        const nextMap = new Map(nextPairs || []);
        const keys = new Set([...prevMap.keys(), ...nextMap.keys()]);
        keys.forEach((key) => {
            const prevVal = Number(prevMap.get(key) ?? 0);
            const nextVal = Number(nextMap.get(key) ?? 0);
            if (!Number.isFinite(nextVal)) return;
            if (Math.abs(prevVal - nextVal) < 0.0001) return;
            trackTaxChange(taxType, key, nextVal);
        });
    };

    emitDiff('head', prevSnapshot.headTaxRates, nextSnapshot.headTaxRates);
    emitDiff('resource', prevSnapshot.resourceTaxRates, nextSnapshot.resourceTaxRates);
    emitDiff('business', prevSnapshot.businessTaxRates, nextSnapshot.businessTaxRates);
    emitDiff('import_tariff', prevSnapshot.importTariffMultipliers, nextSnapshot.importTariffMultipliers);
    emitDiff('export_tariff', prevSnapshot.exportTariffMultipliers, nextSnapshot.exportTariffMultipliers);
};

const formatUnitSummary = (unitMap = {}) => {
    return Object.entries(unitMap)
        .map(([unitId, count]) => {
            const unitName = UNIT_TYPES[unitId]?.name || unitId;
            return `${unitName} x${count}`;
        })
        .join('、');
};

const mergeCorpsReplenishQueue = (currentQueue = {}, pendingUpdates = {}, corpsList = []) => {
    const corpsMap = new Map((corpsList || []).filter(Boolean).map((corps) => [corps.id, corps]));
    const next = {};

    Object.entries(currentQueue || {}).forEach(([corpsId, deficits]) => {
        const corps = corpsMap.get(corpsId);
        // 保留已销毁军团的缺额（后续转为散兵补充需求），仅排除 AI 军团
        if (corps && corps.isAI) return;
        // 若军团已不存在于列表中，也保留其缺额以防丢失
        const normalizedDeficits = {};
        Object.entries(deficits || {}).forEach(([unitId, count]) => {
            const safeCount = Math.max(0, Number(count || 0));
            if (safeCount > 0) {
                normalizedDeficits[unitId] = safeCount;
            }
        });

        if (Object.keys(normalizedDeficits).length > 0) {
            next[corpsId] = normalizedDeficits;
        }
    });

    Object.entries(pendingUpdates || {}).forEach(([corpsId, unitLosses]) => {
        const corps = corpsMap.get(corpsId);
        if (corps && corps.isAI) return;

        if (!next[corpsId]) next[corpsId] = {};

        Object.entries(unitLosses || {}).forEach(([unitId, loss]) => {
            const safeLoss = Math.max(0, Number(loss || 0));
            if (safeLoss > 0) {
                next[corpsId][unitId] = (next[corpsId][unitId] || 0) + safeLoss;
            }
        });

        if (Object.keys(next[corpsId]).length === 0) {
            delete next[corpsId];
        }
    });

    return next;
};

const cloneBuildingUpgrades = (buildingUpgrades = {}) => {
    const cloned = {};
    Object.entries(buildingUpgrades || {}).forEach(([buildingId, levelCounts]) => {
        const nextLevelCounts = {};
        Object.entries(levelCounts || {}).forEach(([levelKey, rawCount]) => {
            const count = Number(rawCount || 0);
            if (!Number.isFinite(count) || count <= 0) return;
            nextLevelCounts[levelKey] = count;
        });
        if (Object.keys(nextLevelCounts).length > 0) {
            cloned[buildingId] = nextLevelCounts;
        }
    });
    return cloned;
};

const applyBuildingUpgradeDelta = (target, buildingId, levelKey, delta) => {
    if (!delta) return;
    if (!target[buildingId]) target[buildingId] = {};
    const current = Number(target[buildingId][levelKey] || 0);
    const next = current + delta;
    if (next > 0) {
        target[buildingId][levelKey] = next;
    } else {
        delete target[buildingId][levelKey];
        if (Object.keys(target[buildingId]).length === 0) {
            delete target[buildingId];
        }
    }
};

// 合并 tick 期间发生的建筑升级变更，防止 simulation 写回覆盖玩家操作
const mergeLateBuildingUpgradeChanges = (simulatedUpgrades, currentUpgrades, tickBaseUpgrades) => {
    const merged = cloneBuildingUpgrades(simulatedUpgrades || {});
    const base = tickBaseUpgrades || {};
    const current = currentUpgrades || {};

    const buildingIds = new Set([
        ...Object.keys(base),
        ...Object.keys(current),
    ]);

    buildingIds.forEach((buildingId) => {
        const baseLevels = base[buildingId] || {};
        const currentLevels = current[buildingId] || {};
        const levelKeys = new Set([
            ...Object.keys(baseLevels),
            ...Object.keys(currentLevels),
        ]);

        levelKeys.forEach((levelKey) => {
            const before = Number(baseLevels[levelKey] || 0);
            const after = Number(currentLevels[levelKey] || 0);
            const delta = after - before;
            if (delta !== 0) {
                applyBuildingUpgradeDelta(merged, buildingId, levelKey, delta);
            }
        });
    });

    return merged;
};

const aggregateCorpsReplenishDemand = (corpsReplenishQueue = {}, corpsList = []) => {
    const corpsMap = new Map((corpsList || []).filter(Boolean).map((corps) => [corps.id, corps]));
    const aggregatedDemand = {};

    Object.entries(corpsReplenishQueue || {}).forEach(([corpsId, deficits]) => {
        const corps = corpsMap.get(corpsId);
        if (corps && corps.isAI) return;
        if (corps && corps.autoReplenish === false) return;
        // 已销毁或已不存在的军团缺额仍转为散兵补充需求

        Object.entries(deficits || {}).forEach(([unitId, count]) => {
            const safeCount = Math.max(0, Number(count || 0));
            if (safeCount > 0) {
                aggregatedDemand[unitId] = (aggregatedDemand[unitId] || 0) + safeCount;
            }
        });
    });

    return aggregatedDemand;
};

const getResourceDisplayName = (resourceKey) => {
    if (!resourceKey) return '未知资源';
    return RESOURCES[resourceKey]?.name || String(resourceKey).replace(/_/g, ' ');
};

const getBuildingDisplayName = (buildingId) => {
    if (!buildingId) return '未知建筑';
    return BUILDINGS.find((building) => building.id === buildingId)?.name || String(buildingId).replace(/_/g, ' ');
};

const getBattleLossTotal = (losses = {}) => (
    Object.values(losses || {}).reduce((sum, count) => sum + Number(count || 0), 0)
);

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
                // 浼樺厛瑙ｆ暎浜哄彛娑堣€楅珮鐨勫崟浣?
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
            // 浜哄彛涓嶈冻瀵艰嚧鐨勮В鏁ｄ笉搴旇Е鍙戣嚜鍔ㄨˉ鍏?
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
        // [FIX] 宸茬Щ闄?unitsToRequeue - 人口不足解散不应触发自动补兵
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
        setPausedBeforeEvent,
        nations,
        setNations,
        diplomaticReputation,
        setDiplomaticReputation,
        militaryCorps,
        setMilitaryCorps,
        generals,
        setGenerals,
        activeFronts,
        setActiveFronts,
        activeBattles,
        setActiveBattles,
        setPopStructure,
        setMaxPop,
        maxPopBonus,
        setMaxPopBonus,
        setRates,
        taxes,
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
        setBuildingFinancialData,
        setStateBuildingSilverOutput,
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
        annualReportBaseline,
        setAnnualReportBaseline,
        annualReportAccumulator,
        setAnnualReportAccumulator,
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
        rulingCoalition, // 执政联盟鎴愬憳
        legitimacy, // 褰撳墠鍚堟硶鎬у€?
        setLegitimacy, // 鍚堟硶鎬ф洿鏂板嚱鏁?
        setModifiers, // Modifiers更新函数
difficulty, // 游戏难度
        officials, // 官员系统
        setOfficials, // 瀹樺憳鐘舵€佹洿鏂板嚱鏁?
        officialsSimCursor,
        setOfficialsSimCursor,
        officialCapacity, // 官员容量
        setOfficialCapacity, // 官员容量更新函数
        ministerAssignments,
        ministerAutoExpansion,
        lastMinisterExpansionDay,
        setLastMinisterExpansionDay,
        fiscalActual, // [FIX] Add value for annual report snapshot
        setFiscalActual, // [NEW] realized fiscal numbers per tick
        setDailyMilitaryExpense, // [NEW] store simulation military expense for UI
        overseasInvestments, // 海外投资列表
        setOverseasInvestments, // 海外投资更新函数
        setDiplomacyOrganizations, // [FIX] Add missing setter
        foreignInvestments, // [NEW] 用于 simulation 计算
        setForeignInvestments, // [FIX] Destructure setter
        corpsReplenishQueue,
        setCorpsReplenishQueue,
        // 理念系统
        ideologyScore,
        setIdeologyScore,
        ideologyScoreSpent,
        setIdeologyScoreSpent,
        ideologyCollection,
        setIdeologyCollection,
        equippedIdeologies,
        setEquippedIdeologies,
        ideologySlotCount,
        setIdeologySlotCount,
        ideologyCooldowns,
        setIdeologyCooldowns,
        ideologyMilestones,
        setIdeologyMilestones,
        pendingIdeologyEmergence,
        setPendingIdeologyEmergence,
        ideologyEmergenceRarityBonus,
        lastEmergenceWasSkipped,
        pendingActionsRef,
    } = gameState;

    // 使用ref淇濆瓨鏈€鏂扮姸鎬侊紝閬垮厤闂寘闂
    const tickProcessingRef = useRef(false); // re-entrancy guard for high-speed ticks
    // 记录已触发政变的官员ID，防止同一官员在状态更新前重复触发政变
    const coupTriggeredOfficialIds = useRef(new Set());
    const stateRef = useRef({        resources,
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
        annualReportBaseline,
        annualReportAccumulator,
        lastFestivalYear,
        // [FIX] Add economic data for annual report snapshot
        economicIndicators,
        taxes,
        fiscalActual,
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
        rulingCoalition, // 执政联盟鎴愬憳
        legitimacy, // 褰撳墠鍚堟硶鎬у€?
difficulty, // 游戏难度
        officials,
        officialCapacity, // [FIX] 娣诲姞瀹樺憳瀹归噺锛岀敤浜?getCabinetStatus 计算
        ministerAssignments,
        ministerAutoExpansion,
        lastMinisterExpansionDay,
        activeDecrees, // [NEW] Pass activeDecrees to simulation
        quotaTargets, // [NEW] Planned Economy targets
        expansionSettings, // [NEW] Free Market settings
        priceControls, // [NEW] 价格管制设置
        corpsReplenishQueue, // Corps replenish deficit queue
        // 理念系统
        equippedIdeologies,
        ideologyCollection,
        ideologyScore,
        ideologyScoreSpent,
        ideologyCooldowns,
        ideologyMilestones,
        pendingIdeologyEmergence,
        ideologyEmergenceRarityBonus,
        lastEmergenceWasSkipped,
    });
    const autoReplenishTickRef = useRef({ day: null, key: '' });
    const capacityTrimLogRef = useRef({ day: null });
    const taxPolicySnapshotRef = useRef(null);
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

    useEffect(() => {
        const collectionMap = {};
        (ideologyCollection || []).forEach((entry) => {
            if (entry?.id) {
                collectionMap[entry.id] = entry;
            }
        });

        const resolvedEquippedIdeologies = (equippedIdeologies || [])
            .filter((id) => IDEOLOGY_MAP[id] && collectionMap[id])
            .map((id) => ({
                ...IDEOLOGY_MAP[id],
                level: collectionMap[id].level || 1,
            }));

        ideologyEventBus.registerIdeologyEvents(resolvedEquippedIdeologies);

        return () => {
            ideologyEventBus.clearAllHandlers();
        };
    }, [equippedIdeologies, ideologyCollection]);

    // [NEW] 娴峰鎶曡祫鍒嗘壒澶勭悊鐘舵€佽拷韪?
    const outboundInvestmentBatchRef = useRef({ offset: 0, lastProcessDay: null });
    const inboundInvestmentBatchRef = useRef({ offset: 0, lastProcessDay: null }); // [NEW] 澶栧浗瀵规垜鍥芥姇璧?

    // ========== 历史数据 Ref 管理 ==========
    // 使用 Ref 存储高频更新的历史数据，避免每帧触发 React 閲嶆覆鏌?
    // 仅在节流间隔到达时同步到 State 渚?UI 显示
    const classWealthHistoryRef = useRef(classWealthHistory || {});
    const classNeedsHistoryRef = useRef(classNeedsHistory || {});
    const marketHistoryRef = useRef({
        price: market?.priceHistory || {},
        supply: market?.supplyHistory || {},
        demand: market?.demandHistory || {},
        supplyBreakdown: [], // 生产数据历史（用于动态PPI绡瓙锛?
    });

    // 鍒濆鍖?同步 Ref
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
    const historyUpdateCounterRef = useRef(0);
    const HISTORY_UPDATE_INTERVAL = 5;

    // [PERF] Worker 降频传输大型 UI 数据的缓存 ref
    // 非 full-tick 时使用上一次的有效值，避免指标计算出现空数据
    const cachedClassFinancialDataRef = useRef({});
    const cachedSupplyBreakdownRef = useRef({});
    const cachedDemandBreakdownRef = useRef({});
    // [PERF] 主线程模式下的财务数据节流计数器
    // Worker 路径由 stripPayloadForTransfer 降频，主线程路径需自行节流
    const mainThreadFinancialCounterRef = useRef(0);
    const MAIN_THREAD_FINANCIAL_INTERVAL = 10;
    // [PERF] 高速模式 UI 降频：>=3x 时大部分 setState 和昂贵计算每 N tick 才执行一次
    // 模拟每 tick 照常运行（保证游戏逻辑正确），但 React 渲染频率降至 ~1/s
    const highSpeedUICounterRef = useRef(0);
    const HIGH_SPEED_UI_INTERVAL = 1;
    const ideologyMetricsRef = useRef(createEmptyIdeologyMetrics());
    // 保存上一tick的在战国家列表，用于检测战争结束（war_result理念分数触发）
    const prevWarNationsRef = useRef([]);
    // NOTE: prevTechsRef / prevEpochRef removed — tech/epoch ideology scoring
    // is now handled proactively in useGameActions (researchTech / advanceEpoch).

    const { runSimulation, syncHistory, isUsingWorker } = useSimulationWorker();

    const saveGameRef = useRef(gameState.saveGame);
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
            annualReportBaseline,
            annualReportAccumulator,
            lastFestivalYear,
            // [FIX] Add economic data for annual report snapshot
            economicIndicators,
            taxes,
            fiscalActual,
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
            rulingCoalition, // 执政联盟鎴愬憳
            legitimacy, // 褰撳墠鍚堟硶鎬у€?
difficulty, // 游戏难度
            officials,
            officialsSimCursor,
            // [FIX] 娣诲姞鍐呴榿鏈哄埗鎵€闇€鐨勭姸鎬?
            activeDecrees, // 褰撳墠鐢熸晥鐨勬敼闈╂硶浠?
            expansionSettings, // 自由市场扩张设置
            quotaTargets, // 计划经济目标配额
            officialCapacity, // 官员容量
            ministerAssignments,
            ministerAutoExpansion,
            lastMinisterExpansionDay,
            priceControls, // [NEW] 计划经济价格管制设置
            foreignInvestments, // [NEW] 海外投资
            diplomaticReputation, // [FIX] 外交声誉
            militaryCorps, // [NEW] 鍐涘洟鐘舵€?
            generals, // [NEW] 灏嗛鐘舵€?
            activeFronts, // [NEW] 活跃战线
            activeBattles, // [NEW] 杩涜涓殑鎴樻枟
            corpsReplenishQueue, // Corps replenish deficit queue
            // 理念系统
            equippedIdeologies,
            ideologyCollection,
            ideologyScore,
            ideologyScoreSpent,
            ideologyCooldowns,
            ideologyMilestones,
            pendingIdeologyEmergence,
            ideologyEmergenceRarityBonus,
        };
    }, [resources, market, buildings, buildingUpgrades, population, popStructure, maxPopBonus, epoch, techsUnlocked, decrees, gameSpeed, nations, livingStandardStreaks, migrationCooldowns, taxShock, army, militaryQueue, jobFill, jobsAvailable, activeBuffs, activeDebuffs, taxPolicies, classWealthHistory, classNeedsHistory, militaryWageRatio, classApproval, daysElapsed, annualReportBaseline, annualReportAccumulator, lastFestivalYear, economicIndicators, taxes, fiscalActual, isPaused, autoSaveInterval, isAutoSaveEnabled, lastAutoSaveTime, merchantState, tradeRoutes, diplomacyOrganizations, vassalDiplomacyQueue, vassalDiplomacyHistory, tradeStats, actions, actionCooldowns, actionUsage, promiseTasks, activeEventEffects, eventEffectSettings, rebellionStates, classInfluence, totalInfluence, birthAccumulator, stability, rulingCoalition, legitimacy, difficulty, officials, officialsSimCursor, activeDecrees, expansionSettings, quotaTargets, officialCapacity, ministerAssignments, ministerAutoExpansion, lastMinisterExpansionDay, priceControls, foreignInvestments, diplomaticReputation, militaryCorps, generals, activeFronts, activeBattles, corpsReplenishQueue, equippedIdeologies, ideologyCollection, ideologyScore, ideologyScoreSpent, ideologyCooldowns, ideologyMilestones, pendingIdeologyEmergence, ideologyEmergenceRarityBonus, isUsingWorker]);    // Note: classWealth is intentionally excluded from dependencies to prevent infinite loop
    // when setClassWealth is called inside Promise chains within this effect.
    // The latest classWealth value is available via stateRef.current.classWealth

    // 监听国家列表变化，自动清理无效的贸易路线和商人派驻
    // [FIX] 通过 ref 读取 tradeRoutes/merchantState，避免 effect 依赖自己要写入的 state 导致 React #185
    const tradeRoutesRef = useRef(tradeRoutes);
    tradeRoutesRef.current = tradeRoutes;
    const merchantStateRef = useRef(merchantState);
    merchantStateRef.current = merchantState;

    useEffect(() => {
        if (!nations) return;

        const currentTradeRoutes = tradeRoutesRef.current;
        const currentMerchantState = merchantStateRef.current;

        const validNationIds = new Set(
            nations
                .filter(n => !n.isAnnexed && (n.population || 0) > 0)
                .map(n => n.id)
        );

        // Clean up trade routes
        if (currentTradeRoutes?.routes?.length) {
            const validRoutes = currentTradeRoutes.routes.filter(r => validNationIds.has(r.nationId));
            if (validRoutes.length !== currentTradeRoutes.routes.length) {
                setTradeRoutes(prev => ({ ...prev, routes: validRoutes }));
            }
        }

        // Clean up merchant assignments
        if (currentMerchantState?.merchantAssignments && typeof currentMerchantState.merchantAssignments === 'object') {
            const assignments = currentMerchantState.merchantAssignments;
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
                const finalAssignments = Object.keys(validAssignments).length > 0
                    ? validAssignments
                    : {};
                setMerchantState(prev => ({ ...prev, merchantAssignments: finalAssignments }));
                if (Object.keys(validAssignments).length === 0) {
                    console.log('[商人系统] 已清空所有无效的商人派驻，系统将重新分配商人');
                }
            }
        }

        // Clean up pending trades with destroyed nations
        if (currentMerchantState?.pendingTrades && Array.isArray(currentMerchantState.pendingTrades)) {
            const validPendingTrades = currentMerchantState.pendingTrades.filter(trade =>
                !trade.partnerId || validNationIds.has(trade.partnerId)
            );
            if (validPendingTrades.length !== currentMerchantState.pendingTrades.length) {
                setMerchantState(prev => ({ ...prev, pendingTrades: validPendingTrades }));
            }
        }
    }, [nations, setTradeRoutes, setMerchantState]);

    // 游戏核心循环
    useEffect(() => {
        // 初始化作弊码系统
        if (process.env.NODE_ENV !== 'production') {
            initCheatCodes(gameState, addLog, { setMerchantState, setTradeRoutes });
        }

        // 暂停时不设置游戏循环定时器，但自动保存定时器需要单独管理
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

        // 计算 Tick 闂撮殧锛氬熀浜庢父鎴忛€熷害鍔ㄦ€佽皟鏁?
        // 1鍊嶉€?= 1000ms锛?鍊嶉€?= 500ms锛?鍊嶉€?= 200ms
        const tickInterval = 1000 / Math.max(1, gameSpeed);

        const timer = setInterval(() => {
            // Re-entrancy guard: prevent overlapping ticks at high game speeds
            if (tickProcessingRef.current) return;
            tickProcessingRef.current = true;
            try {
            const current = stateRef.current;
            let effectiveCorpsReplenishQueue = current.corpsReplenishQueue || {};

            // 自动存档检测：即使暂停也照常运行，避免长时间停留丢进度
            if (current.isAutoSaveEnabled) {
                const intervalSeconds = Math.max(60, current.autoSaveInterval || 60);
                const elapsed = Date.now() - (current.lastAutoSaveTime || 0);
                if (elapsed >= intervalSeconds * 1000 && saveGameRef.current) {
                    saveGameRef.current({ source: 'auto' });
                    stateRef.current.lastAutoSaveTime = Date.now();
                }
            }

            // 妫€鏌ユ槸鍚﹂渶瑕佽Е鍙戝勾搴﹀簡鍏?
            // 淇锛氭娴嬪勾浠藉彉鍖栬€岄潪鐗瑰畾鏃ユ湡锛岄伩鍏嶅姞閫熸ā寮忎笅璺宠繃瑙﹀彂鐐?
            const currentCalendar = getCalendarInfo(current.daysElapsed || 0);
            // 娉ㄦ剰锛氳繖閲屼娇鐢?1 而非 current.gameSpeed锛屽洜涓虹幇鍦ㄦ瘡娆?Tick 鍙帹杩?1 澶?
            const nextCalendar = getCalendarInfo((current.daysElapsed || 0) + 1);

            // 濡傛灉褰撳墠骞翠唤澶т簬涓婃搴嗗吀骞翠唤锛屼笖鍗冲皢璺ㄨ秺鎴栧凡缁忚法瓒婃柊骞?
            if (currentCalendar.year > (current.lastFestivalYear || 0)) {
                // Annual report: collect snapshot and compute report
                const baseline = current.annualReportBaseline || null;
                const reportData = buildAnnualReport(current, baseline);
                setFestivalModal({
                    reportData,
                    year: currentCalendar.year,
                });
                setLastFestivalYear(currentCalendar.year);
                // Save paused state before forcing pause
                setPausedBeforeEvent(current.isPaused);
                setIsPaused(true);
            }

            // [NEW] 处理法令过期
            const currentActiveDecrees = current.activeDecrees || {};
            if (Object.keys(currentActiveDecrees).length > 0) {
                const currentDay = current.daysElapsed || 0;
                const { updatedDecrees, expiredDecrees } = processDecreeExpiry(currentActiveDecrees, currentDay);

                if (expiredDecrees.length > 0) {
                    // 鏇存柊娉曚护鐘舵€?
                    setActiveDecrees(updatedDecrees);
                    // 更新本地引用以确保当前tick浣跨敤姝ｇ‘鐨勬硶浠ょ姸鎬?
                    current.activeDecrees = updatedDecrees;
                    stateRef.current.activeDecrees = updatedDecrees;

                    // 记录过期法令日志
                    expiredDecrees.forEach(decreeId => {
                        const decree = getAllTimedDecrees()[decreeId];
                        const decreeName = decree?.name || decreeId;
                        addLog('法令[' + decreeName + ']已到期结束。');
                    });
                }
            }

            // 执行游戏模拟
            // 「愬叧閿€戝己鍒跺皢 gameSpeed 设为 1锛岀‘淇濆崟娆?Tick 鍙绠?1 个单位时间的产出
            // 原因：我们已经通过调整 setInterval 的频率来实现加速（时间流）
            // 如果这里不归一化，simulateTick 鍐呴儴浼氬啀娆′箻浠?gameSpeed，导致倍率叠加
            // 渚嬪锛?倍速时，频率已经是 5 倍（200ms/娆★級锛屽鏋滃啀浼?gameSpeed=5锛?
            // 瀹為檯閫熷害浼氬彉鎴?25 鍊嶏紙5脳5锛夛紝杩欐槸閿欒鐨?
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

            // Build simulation parameters - 鎵嬪姩鍒楀嚭鍙簭鍒楀寲瀛楁锛屾帓闄ゅ嚱鏁板璞★紙濡?actions锛?
            // 杩欐牱鍙互姝ｇ'鍚敤 Web Worker 加速，避免 DataCloneError

            // [FIX] 合并玩家操作增量到 simulation 输入，防止 tick 覆盖用户操作
            let mergedBuildings = current.buildings;
            const tickBaseBuildingUpgrades = current.buildingUpgrades;
            let mergedResources = current.resources;
            let consumedPendingDeltas = null; // 记录本次消费的 delta，用于 tick 结果写回时校验
            if (pendingActionsRef?.current) {
                const pa = pendingActionsRef.current;
                const hasBuildingDeltas = Object.keys(pa.buildingDeltas).length > 0;
                const hasResourceDeltas = Object.keys(pa.resourceDeltas).length > 0;
                if (hasBuildingDeltas || hasResourceDeltas) {
                    // 快照并清空队列（原子操作，后续新 action 写入不会丢失）
                    consumedPendingDeltas = {
                        buildingDeltas: { ...pa.buildingDeltas },
                        resourceDeltas: { ...pa.resourceDeltas },
                    };
                    pa.buildingDeltas = {};
                    pa.resourceDeltas = {};

                    if (hasBuildingDeltas) {
                        mergedBuildings = { ...current.buildings };
                        Object.entries(consumedPendingDeltas.buildingDeltas).forEach(([bid, delta]) => {
                            mergedBuildings[bid] = Math.max(0, (mergedBuildings[bid] || 0) + delta);
                        });
                    }
                    if (hasResourceDeltas) {
                        mergedResources = { ...current.resources };
                        Object.entries(consumedPendingDeltas.resourceDeltas).forEach(([rid, delta]) => {
                            mergedResources[rid] = Math.max(0, (mergedResources[rid] || 0) + delta);
                        });
                    }
                }
            }

            const simulationParams = {
                // 基础游戏数据（使用合并了 pending actions 的版本）
                resources: mergedResources,
                market: current.market,
                buildings: mergedBuildings,
                buildingUpgrades: current.buildingUpgrades,
                population: current.population,
                popStructure: current.popStructure,
                birthAccumulator: current.birthAccumulator,
                maxPopBonus: current.maxPopBonus,
                epoch: current.epoch,
                techsUnlocked: current.techsUnlocked,
                decrees: current.decrees,
                // [PERF] 主线程模式下直接引用原数组，避免每 tick 全表 map+spread 产生 GC 压力
                // Worker 路径仍需 trim history 以减少 postMessage 序列化体积
                nations: (gameSpeed >= 3)
                    ? (current.nations || [])
                    : (current.nations || []).map(n => {
                        if (n.isDefeated || n.population <= 0) {
                            return { id: n.id, name: n.name, isDefeated: true, population: 0 };
                        }
                        if (!n.isPlayer) {
                            const { tradeHistory, priceHistory, resourceHistory, ...trimmedNation } = n;
                            return trimmedNation;
                        }
                        return n;
                    }),
                diplomacyOrganizations: current.diplomacyOrganizations,
                classWealth: current.classWealth,
                classApproval: current.classApproval,
                classLivingStandard: current.classLivingStandard || {},
                classInfluence: current.classInfluence,
                totalInfluence: current.totalInfluence,
                stability: current.stability,

                // 军事相关
                army: current.army,
                militaryQueue: current.militaryQueue,
                militaryWageRatio: current.militaryWageRatio,
                autoRecruitEnabled: current.autoRecruitEnabled,
                targetArmyComposition: current.targetArmyComposition,

                // 宸ヤ綔鍜岀粡娴?
                jobFill: current.jobFill,
                jobsAvailable: current.jobsAvailable,

                // 鍐呴榿鍗忓悓涓庤嚜鐢卞競鍦?
                // [FIX] 浣跨敤涓?UI 鐩稿悓鐨勫閲忚绠楅€昏緫锛?
                // Math.min(jobsAvailable.official, officialCapacity)
                // 这确保主导判定与 UI 鏄剧ず涓€鑷?
                cabinetStatus: (() => {
                    // 涓?App.jsx Line 1130 保持一致的计算逻辑
                    // 使用 hook 浣滅敤鍩熶腑鐨?jobsAvailable（而非 current.jobsAvailable锛?
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
                    // [DEBUG] 涓荤嚎绋嬫鏌?
                    debugLog('mainThread', '[MAIN THREAD PRE-WORKER] cabinetStatus:', {
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
                ideologyMetrics: ideologyMetricsRef.current,

                // Buff/Debuff
                activeBuffs: current.activeBuffs,
                activeDebuffs: current.activeDebuffs,

                // [PERF] 历史数据不再每tick传输，改用worker内部缓存；
                // 主线程直接调用时仍传入（非worker模式回退，包括 __SIM_DISABLE_WORKER 强制主线程场景）
                classWealthHistory: (isUsingWorker && !window.__SIM_DISABLE_WORKER) ? undefined : classWealthHistoryRef.current,
                classNeedsHistory: (isUsingWorker && !window.__SIM_DISABLE_WORKER) ? undefined : classNeedsHistoryRef.current,
                // 鏃堕棿鍜岃妭鏃?
                daysElapsed: current.daysElapsed,
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

                // 浜嬩欢淇鍣?
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
                militaryCorps: current.militaryCorps || [], // [NEW] Corps state
                generals: current.generals || [], // [NEW] Generals state
                activeFronts: current.activeFronts || [], // [NEW] Active fronts
                activeBattles: current.activeBattles || [], // [NEW] Active battles

                // 理念系统
                equippedIdeologies: (() => {
                    // 将equippedIds解析为完整理念对象（含等级），供simulation中的applyIdeologyEffects使用
                    const collection = current.ideologyCollection || [];
                    const equipped = current.equippedIdeologies || [];
                    // IDEOLOGY_MAP 已在文件顶部静态导入
                    const collectionMap = {};
                    for (const entry of collection) { collectionMap[entry.id] = entry; }
                    return equipped
                        .filter(id => IDEOLOGY_MAP[id] && collectionMap[id])
                        .map(id => ({ ...IDEOLOGY_MAP[id], level: collectionMap[id].level || 1 }));
                })(),
                ideologySynergies: IDEOLOGY_SYNERGIES || [],
                antiSynergies: ANTI_SYNERGIES || [],
                // [PERF] 性能模式信息，供 simulation 中动态频率调整使用
                _isLowPerformance: isLowPerformance(),
                // [PERF] 传入实际游戏速度，供 Worker 动态调整 UI 数据传输频率
                _gameSpeed: gameSpeed,
            };

            const perfEnabled = typeof window !== 'undefined' && !!window.__PERF_LOG;

            if (perfEnabled) {
                console.warn('[PerfTick] start day=' + (current.daysElapsed || 0));
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

            // [PERF] 高速模式自动切换主线程模拟，避免 postMessage 结构化克隆导致 OOM
            // 5x 速度 = 5 tick/秒 × 1-3MB/tick 的深拷贝 = 300-900MB/分钟，移动端必崩
            // 主线程直接调用 simulateTick 零拷贝开销，以少量 UI 卡顿换取内存安全
            if (typeof window !== 'undefined') {
                window.__SIM_DISABLE_WORKER = gameSpeed >= 3;
            }

            // Skip if a simulation is still running to avoid flooding the worker
            if (simInFlightRef.current) {
                if (perfEnabled) {
                    console.warn('[PerfTick] skip day=' + (current.daysElapsed || 0) + ' (simulation busy)');
                }
                tickProcessingRef.current = false;
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
                // console.log('??? [GAME-LOOP] runSimulation 完成! result:', result ? 'OK' : 'NULL', 'skipped:', result?.__skipped);
                const perfSimMs = ((typeof performance !== 'undefined' && performance.now)
                    ? performance.now()
                    : Date.now()) - perfTickStart;
                simInFlightRef.current = false;
                if (!result || result.__skipped) {
                    // console.log('??? [GAME-LOOP] 跳过处理: result =', result, 'skipped =', result?.__skipped);
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

                // 以下是处理模拟结果的代码，包装在 then 鍥炶皟涓?

                // ========== Apply 阶段分段计时 ==========
                const _ap = typeof performance !== 'undefined' ? performance.now.bind(performance) : Date.now;
                const _apStart = _ap();
                const _apSections = {};
                let _apLast = _apStart;
                const _apMark = (label) => { const now = _ap(); _apSections[label] = now - _apLast; _apLast = now; };

                // [PERF] 高速 UI 降频：>=3x 时仅每 HIGH_SPEED_UI_INTERVAL 个 tick 做完整 UI 更新
                // 中间 tick 仅更新模拟关键状态（stateRef + 必要 setState），跳过昂贵的指标计算和纯展示 setState
                highSpeedUICounterRef.current++;
                const _isHighSpeed = gameSpeed >= 3;
                const _shouldUpdateUI = !_isHighSpeed ||
                    (highSpeedUICounterRef.current % HIGH_SPEED_UI_INTERVAL === 0);

                // 更新 Modifiers 状态供 UI 显示
                if (_shouldUpdateUI) setModifiers(result.modifiers || {});

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
                    // 自动补兵只处理真实战损与军团补兵缺额，不处理人口不足导致的缩编
                    if (manpowerSync.removedUnits) {
                        const summary = formatUnitSummary(manpowerSync.removedUnits);
                        if (summary) {
                            addLog('[军队人口不足] 以下部队被迫解散: ' + summary);
                        }
                    }

                    if (manpowerSync.cancelledTraining) {
                        const summary = formatUnitSummary(manpowerSync.cancelledTraining);
                        if (summary) {
                            addLog('[训练中断] 以下单位重新排入招募: ' + summary);
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

                // 鎵ｉ櫎瀹樺憳钖按锛堝疄浠橈細鏈€澶氭墸鍒?锛?
                // 如果薪水为负数，则从官员那里收取费用（需要在simulation中处理官员财富扣除）
                if (officialDailySalary > 0) {
                    const before = Number(adjustedResources.silver || 0);
                    const pay = Math.min(officialDailySalary, before);
                    adjustedResources.silver = before - pay;
                    officialSalaryPaid = pay;
                } else if (officialDailySalary < 0) {
                    // 负薪酬：从官员那里收钱到国库
                    // 实际收到的金额会在simulation涓牴鎹畼鍛樿储瀵岃绠?
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

                            // 浠庡浗搴撴墸闄わ紙瀹炰粯锛氬彈鍥藉簱浣欓绾︽潫锛?
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

                // console.group('? [财政详情] Tick ' + (current.daysElapsed || 0));
                // console.log('🏦 国库起始余额:', treasuryAtTickStart.toFixed(2), '银币');

                // 从simulation返回的税收数据
                const taxes = result.taxes || {};
                const breakdown = taxes.breakdown || {};

                // console.group('馃搱 鏀跺叆椤?);
                // console.log('  浜哄ご绋?', (breakdown.headTax || 0).toFixed(2));
                // console.log('  浜ゆ槗绋?', (breakdown.industryTax || 0).toFixed(2));
                // console.log('  钀ヤ笟绋?', (breakdown.businessTax || 0).toFixed(2));
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
                // console.log('  鉁?鎬绘敹鍏?', totalIncome.toFixed(2));
                // if (typeof breakdown.incomePercentMultiplier === 'number') {
                //     console.log('  📌 收入加成倍率:', `×${breakdown.incomePercentMultiplier.toFixed(2)}`);
                // }
                // if (taxes.efficiency && taxes.efficiency < 1) {
                //     console.log('  📊 税收效率:', (taxes.efficiency * 100).toFixed(1) + '%',
                //         `(损失: ${(totalIncome * (1 - taxes.efficiency)).toFixed(2)} 银币)`);
                // }
                // console.groupEnd();

                // console.group('馃搲 鏀嚭椤?);

                // === 军队支出（使用simulation返回的真实数据）===
                // 注意：simulation.js中已经处理了资源购买、时代加成、规模惩罚、军饷倍率
                const simulationArmyCost = result.dailyMilitaryExpense?.dailyExpense || 0;

                if (simulationArmyCost > 0) {
                    // console.group('  军队维护（simulation璁＄畻锛?);
                    if (result.dailyMilitaryExpense) {
                        const armyData = result.dailyMilitaryExpense;
                        // console.log(`    基础资源成本: ${(armyData.resourceCost || 0).toFixed(2)} 银币`);
                        // console.log(`    时代系数: ×${(armyData.epochMultiplier || 1).toFixed(2)}`);
                        // console.log(`    规模惩罚: ×${(armyData.scalePenalty || 1).toFixed(2)}`);
                        // console.log(`    军饷倍率: ×${(armyData.wageMultiplier || 1).toFixed(2)}`);
                        // console.log(`    💰 实际支出: ${simulationArmyCost.toFixed(2)} 银币`);

                        // 鏄剧ず璧勬簮娑堣€楁槑缁?
                        if (armyData.resourceConsumption && Object.keys(armyData.resourceConsumption).length > 0) {
                            // console.log(`    娑堣€楄祫婧?`, armyData.resourceConsumption);
                        }
                    } else {
                        // console.log(`    馃挵 鎬绘敮鍑? ${simulationArmyCost.toFixed(2)} 银币`);
                    }
                    // console.groupEnd();
                }

                // 保留useGameLoop中的军队维护计算（仅用于对比，标记为"本地计算"锛?
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
                        console.group('  鍐涢槦缁存姢锛堟湰鍦拌绠?- 仅供参考）');
                        Object.entries(maintenanceResources).forEach(([resource, cost]) => {
                            if (resource === 'silver') {
                                console.log(`    ${resource}: ${cost.toFixed(2)}`);
                            } else {
                                const price = result.market?.prices?.[resource] || 1;
                                const silverValue = cost * price;
                                console.log(`    ${resource}: ${cost.toFixed(2)} (价值: ${silverValue.toFixed(2)} 银币)`);
                            }
                        });
                        console.log(`    💰 总价值: ${totalMaintenanceSilverValue.toFixed(2)} 银币`);
                        console.groupEnd();
                    }
                }

                const _fiscalDebug = isDebugEnabled('fiscal');
                if (_fiscalDebug) {
                    if (breakdown.subsidy) debugLog('fiscal', '  税收补贴:', breakdown.subsidy.toFixed(2));
                    if (breakdown.tariffSubsidy) debugLog('fiscal', '  关税补贴:', breakdown.tariffSubsidy.toFixed(2));
                    if (officialSalaryPaid > 0) debugLog('fiscal', '  官员薪俸:', officialSalaryPaid.toFixed(2));
                    if (forcedSubsidyPaid > 0) debugLog('fiscal', '  强制补贴:', forcedSubsidyPaid.toFixed(2));
                    if (breakdown.policyExpense) debugLog('fiscal', '  政令支出:', breakdown.policyExpense.toFixed(2));
                    if (breakdown.priceControlExpense) debugLog('fiscal', '  价格管制支出:', breakdown.priceControlExpense.toFixed(2));
                }

                if (_fiscalDebug && Object.keys(resourceShortages).length > 0) {
                    console.group('  [资源短缺] 军队维护需求未满足');
                    let totalShortageValue = 0;
                    Object.entries(resourceShortages).forEach(([resource, shortage]) => {
                        const price = result.market?.prices?.[resource] || 1;
                        const silverValue = shortage * price;
                        totalShortageValue += silverValue;
                        console.log('    ' + resource + ': 短缺 ' + shortage.toFixed(2) + '，折银 ' + silverValue.toFixed(2));
                    });
                    console.log('    [总短缺价值] ' + totalShortageValue.toFixed(2) + ' 银币');
                    console.warn('    [注意] 这些资源短缺可能导致隐藏的银币支出');
                    console.groupEnd();
                }

                const totalExpense = simulationArmyCost + (breakdown.subsidy || 0) +
                    (breakdown.tariffSubsidy || 0) + officialSalaryPaid + forcedSubsidyPaid +
                    (breakdown.policyExpense || 0) + (breakdown.priceControlExpense || 0);
                if (_fiscalDebug) {
                    debugLog('fiscal', '  总支出:', totalExpense.toFixed(2));
                    debugLog('fiscal', '理论净变化:', (totalIncome - totalExpense).toFixed(2), '银币/天');
                    debugLog('fiscal', '🏦 国库结束余额:', treasuryAfterDeductions.toFixed(2), '银币');
                    debugLog('fiscal', '💵 实际净变化:', netTreasuryChange.toFixed(2), '银币');
                }

                if (_fiscalDebug && result._debug) {
                    if (result._debug.militaryDebugInfo) {
                        debugLog('fiscal', '⚔️ [GameLoop] Military Debug:', result._debug.militaryDebugInfo);
                    }
                }
                const armyCostSim = result.dailyMilitaryExpense?.dailyExpense || 0;
                if (_fiscalDebug) debugLog('fiscal', '⚔️ [GameLoop] Reported Military Cost:', armyCostSim);

                // === 显示simulation涓殑银币鍙樺寲杩借釜 ===
                // if (result._debug?.silverChangeLog && result._debug.silverChangeLog.length > 0) {
                //     console.group('馃攳 银币鍙樺寲璇︾粏杩借釜锛坰imulation鍐呴儴锛?);
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
                //     console.log('  ? Simulation净变化:', simulationChange.toFixed(2), '银币');
                //     console.groupEnd();
                // }

                // === useGameLoop本地扣除（simulation涔嬪悗锛?==
                const useGameLoopDeductions = [];
                if (officialSalaryPaid > 0) {
                    useGameLoopDeductions.push({ reason: '官员薪俸', amount: -officialSalaryPaid });
                }
                if (forcedSubsidyPaid > 0) {
                    useGameLoopDeductions.push({ reason: '强制补贴', amount: -forcedSubsidyPaid });
                }

                // if (useGameLoopDeductions.length > 0) {
                //     console.group('? useGameLoop本地扣除（simulation涔嬪悗锛?);
                //     useGameLoopDeductions.forEach((item, index) => {
                //         const sign = item.amount >= 0 ? '+' : '';
                //         console.log(`  ${index + 1}. ${item.reason}: ${sign}${item.amount.toFixed(2)} 银币`);
                //     });
                //     const totalLocalDeduction = useGameLoopDeductions.reduce((sum, item) => sum + item.amount, 0);
                //     console.log('  💰 本地扣除总计:', totalLocalDeduction.toFixed(2), '银币');
                //     console.groupEnd();
                // }

                const auditEntries = [];
                if (Array.isArray(result?._auditLog) && result._auditLog.length > 0) {
                    const aggregated = new Map();
                    result._auditLog.forEach((entry) => {
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
                const militaryLogKeys = ['军队维护支出', '鍐涢槦缁存姢鏀嚭（部分支付）', 'militaryPay', 'expense_army_maintenance', 'expense_army_maintenance_partial'];
                const existingMilitaryEntry = auditEntries.find(e => militaryLogKeys.includes(e.reason));

                if (fallbackMilitaryExpense > 0) {
                    if (!existingMilitaryEntry) {
                        // Entry missing entirely -> Force add
                        addAuditEntry(-fallbackMilitaryExpense, 'expense_army_maintenance');
                        if (_fiscalDebug) debugLog('fiscal', '[GameLoop] Fixed missing military expense log:', -fallbackMilitaryExpense);
                    } else if (existingMilitaryEntry.amount === 0) {
                        existingMilitaryEntry.amount = -fallbackMilitaryExpense;
                        existingMilitaryEntry.reason = 'expense_army_maintenance';
                        if (_fiscalDebug) debugLog('fiscal', '[GameLoop] Fixed zero-amount military expense log:', -fallbackMilitaryExpense);
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

                // ========== 附庸请求检查 ==========
                // 附庸的每日结算（朝贡/独立倾向/满意度）已由 simulation.js 统一处理，
                // 这里不再重复调用 processVassalUpdates，避免同一tick重复结算导致数值异常。
                let vassalNationsUpdated = null;
                const vassalLogs = [];
                if (current.nations && current.nations.some(n => n.vassalOf === 'player')) {
                    // [NEW] Check for vassal autonomous requests (Lower Tribute, Aid, Investment)
                    checkVassalRequests(
                        current.nations.filter(n => n.vassalOf === 'player'),
                        current.daysElapsed || 0,
                        vassalLogs
                    );
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
                if (_fiscalDebug) {
                    debugLog('fiscal', '📋 审计净变化:', auditDelta.toFixed(2), '银币');
                    if (Math.abs(netTreasuryChange - auditDelta) > 0.1) {
                        console.warn('⚠️ 警告：审计净变化与实际净变化不一致！差异:',
                            (netTreasuryChange - auditDelta).toFixed(2));
                    }
                }
                // === 财政日志结束 ===
                _apMark('fiscal');

                // ========== 经济指标计算 ==========
                // [PERF] 缓存 ref 每 tick 更新，确保下次 UI tick 用最新数据
                if (result.classFinancialData) cachedClassFinancialDataRef.current = result.classFinancialData;
                if (result.market?.supplyBreakdown) cachedSupplyBreakdownRef.current = result.market.supplyBreakdown;
                if (result.market?.demandBreakdown) cachedDemandBreakdownRef.current = result.market.demandBreakdown;

                // [PERF] 高速模式下跳过昂贵的指标计算 + 价格历史更新（每 N tick 才做一次）
                let updatedPriceHistory = priceHistory;
                let currentEquilibriumPrices = equilibriumPrices;

                let indicators = economicIndicators;

                if (_shouldUpdateUI) {
                // 1. 更新价格历史（每天）
                updatedPriceHistory = updatePriceHistory({
                    priceHistory,
                    currentPrices: market.prices,
                    maxLength: ECONOMIC_INDICATOR_CONFIG.priceHistory.maxLength,
                });
                setPriceHistory(updatedPriceHistory);

                // 2. 计算均衡价格（每10天）
                if (daysElapsed % ECONOMIC_INDICATOR_CONFIG.equilibriumPrice.updateInterval === 0) {
                    currentEquilibriumPrices = calculateEquilibriumPrices({
                        priceHistory: updatedPriceHistory,
                        basePrices: getBasePrices(),
                        window: ECONOMIC_INDICATOR_CONFIG.equilibriumPrice.window,
                    });
                    setEquilibriumPrices(currentEquilibriumPrices);
                }

                // 3. 璁＄畻鎵€鏈夌粡娴庢寚鏍囷紙姣忓ぉ锛?
                if (isDebugEnabled('fiscal')) {
                    console.group('🎯 [ECONOMIC INDICATORS DEBUG] Day ' + (current.daysElapsed || 0));
                    console.log('📊 Input Data:', {
                        classFinancialData: result.classFinancialData,
                        dailyInvestment: result.dailyInvestment,
                        dailyMilitaryExpense: result.dailyMilitaryExpense,
                        officials: current.officials?.length,
                        taxBreakdown: result.taxes?.breakdown,
                        demandBreakdown: market.demandBreakdown,
                        marketPrices: market.prices,
                    });
                }

                indicators = calculateAllIndicators({
                    priceHistory: updatedPriceHistory,
                    equilibriumPrices: currentEquilibriumPrices,
                    marketPrices: market.prices,

                    classFinancialData: result.classFinancialData || cachedClassFinancialDataRef.current,
                    dailyInvestment: result.dailyInvestment || 0,
                    dailyOwnerRevenue: result.dailyOwnerRevenue || 0, // 鏂板锛氬缓绛戜骇鍑烘敹鍏?
                    dailyMilitaryExpense: result.dailyMilitaryExpense || 0,
                    stateBuildingSilverOutput: result.stateBuildingSilverOutput || 0,
                    officials: current.officials,
                    taxBreakdown: result.taxes?.breakdown || {},
                    demandBreakdown: result.market?.demandBreakdown || cachedDemandBreakdownRef.current,
                    supplyBreakdown: result.market?.supplyBreakdown || cachedSupplyBreakdownRef.current,

                    // 历史数据
                    previousIndicators: economicIndicators,
                    supplyBreakdownHistory: marketHistoryRef.current.supplyBreakdown, // 鏂板锛氱敓浜ф暟鎹巻鍙?
                });

                if (isDebugEnabled('fiscal')) {
                    console.log('✅ Calculated Indicators:', indicators);
                    console.groupEnd();
                }
                setEconomicIndicators(indicators);
                } // end _shouldUpdateUI — 经济指标

                // 税收政策变化采集：仅在实际变化时上报，避免高频噪音。
                const nextTaxSnapshot = normalizeTaxPolicySnapshot(current.taxPolicies || taxPolicies || {});
                if (!taxPolicySnapshotRef.current) {
                    taxPolicySnapshotRef.current = nextTaxSnapshot;
                } else {
                    emitTaxPolicyChanges(taxPolicySnapshotRef.current, nextTaxSnapshot);
                    taxPolicySnapshotRef.current = nextTaxSnapshot;
                }

                // GameAnalytics 周期采样（每 90 游戏日）
                const nextDay = (current.daysElapsed || 0) + 1;
                if (nextDay % 90 === 0) {
                    const totalArmyCount = Object.values(result.army || current.army || {}).reduce((s, v) => s + (v || 0), 0);
                    const pop = result.population || current.population;
                    const stab = result.stability;
                    trackPeriodicMetrics({
                        gdp: economicIndicators?.gdp?.total,
                        cpi: economicIndicators?.cpi?.index,
                        ppi: economicIndicators?.ppi?.index,
                        population: pop,
                        stability: stab,
                        treasury: result.resources?.silver,
                        armySize: totalArmyCount,
                    });

                    // 经济流水采样
                    const slog = result.silverChangeLog || {};
                    trackEconomicFlows({
                        taxIncome: (slog.tax_income || 0) + (slog.head_tax || 0) + (slog.resource_tax || 0) + (slog.business_tax || 0),
                        tradeIncome: (slog.trade_income || 0) + (slog.trade_route_transaction || 0),
                        militaryCost: Math.abs(slog.military_maintenance || 0) + Math.abs(slog.military_wage || 0),
                        buildingCost: Math.abs(slog.building_maintenance || 0),
                        officialCost: Math.abs(slog.official_salary || 0),
                    });

                    // 市场价格采样
                    trackPriceSampling(result.market?.prices);

                    // 人口里程碑检测
                    const prevPop = current.population || 0;
                    const milestones = [100, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000];
                    for (const m of milestones) {
                        if (prevPop < m && pop >= m) {
                            trackPopulationMilestone(m, pop);
                        }
                    }

                    // 饥荒死亡追踪
                    if (result.starvationDeaths > 0) {
                        trackPopulationStarvation(result.starvationDeaths);
                    }

                    // 稳定度等级变化
                    const prevStab = current.stability || 50;
                    const stabLevels = [20, 40, 60, 80];
                    for (const lvl of stabLevels) {
                        if ((prevStab >= lvl && stab < lvl) || (prevStab < lvl && stab >= lvl)) {
                            const levelName = stab < 20 ? 'critical' : stab < 40 ? 'low' : stab < 60 ? 'medium' : stab < 80 ? 'high' : 'excellent';
                            trackStabilityLevelChange(levelName, stab);
                            break;
                        }
                    }

                    // 经济危机检测
                    if (result.resources?.silver <= 0) trackEconomicCrisis('bankruptcy', 0);
                    if (indicators.cpi?.index > 200) trackEconomicCrisis('hyperinflation', indicators.cpi.index);

                    // AI 国家状态采样
                    trackAINationSampling(result.nations || current.nations);
                }

                setAnnualReportAccumulator(prev => {
                    const base = prev || {
                        daysCount: 0,
                        gdpSum: 0,
                        cpiSum: 0,
                        ppiSum: 0,
                        taxSum: 0,
                        fiscalNetIncomeSum: 0,
                    };
                    return {
                        daysCount: (base.daysCount || 0) + 1,
                        gdpSum: (base.gdpSum || 0) + Number(indicators.gdp?.total || 0),
                        cpiSum: (base.cpiSum || 0) + Number(indicators.cpi?.index || 0),
                        ppiSum: (base.ppiSum || 0) + Number(indicators.ppi?.index || 0),
                        taxSum: (base.taxSum || 0) + Number(treasuryIncome || 0),
                        fiscalNetIncomeSum: (base.fiscalNetIncomeSum || 0) + Number(netTreasuryChange || 0),
                    };
                });

                const auditStartingSilver = Number.isFinite(result?._auditStartingSilver)
                    ? result._auditStartingSilver
                    : treasuryAtTickStart;
                // [FIX] 使用函数更新器合并 tick 期间新产生的玩家操作资源增量
                setResources(prev => {
                    // adjustedResources 已包含 tick 启动时消费的 pending delta
                    // 但 tick 运行期间可能有新的 buyBuilding 消耗资源
                    // 通过 diff(prev, mergedResources) 检测新增量
                    const result2 = { ...adjustedResources };
                    if (mergedResources) {
                        Object.keys(prev).forEach(rid => {
                            const prevVal = prev[rid] || 0;
                            const mergedVal = mergedResources[rid] || 0;
                            const lateActionDelta = prevVal - mergedVal;
                            if (lateActionDelta !== 0) {
                                result2[rid] = Math.max(0, (result2[rid] || 0) + lateActionDelta);
                            }
                        });
                    }
                    return result2;
                }, {
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

                // 澶勭悊寮哄埗琛ヨ创鏁堟灉鐨勬瘡鏃ユ洿鏂?
                // 注意：这里只处理 forcedSubsidy 的递减和过期，不处理其他效果的更新
                // 其他效果（approval, stability绛夛級鐢?simulation.js 中的 applyActiveEventEffects 处理
                if (forcedSubsidies.length > 0) {
                    setActiveEventEffects(prev => {
                        // 鍙洿鏂?forcedSubsidy锛屼繚鐣欏叾浠栨墍鏈夋晥鏋滀笉鍙?
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

                _apMark('indicators+resources');

                // ========== 理念系统每日更新 ==========
                // 1. 冷却减少
                if (current.ideologyCooldowns && Object.keys(current.ideologyCooldowns).length > 0) {
                    import('../logic/ideology/ideologySlots').then(({ tickCooldowns }) => {
                        setIdeologyCooldowns(prev => tickCooldowns(prev));
                    });
                }

                // 2. 理念分数检查（使用prevState对比）
                {
                    import('../logic/ideology/ideologyScoring').then(({ checkAndAwardIdeologyScore, checkEmergence, getEmergenceThreshold }) => {
                        import('../logic/ideology/ideologyEmergence').then(({ generateEmergenceCandidates }) => {
                            // 使用stateRef.current获取最新状态，避免异步时序问题
                            const latestState = stateRef.current;
                            // 计算当前贸易量（贸易路线价值之和）
                            const _tradeVolume = (latestState.tradeRoutes?.routes || []).reduce((sum, r) => sum + (r.value || r.amount || 0), 0);
                            // 构建当前在战国家列表（用于检测战争结束）
                            const _curWarNations = (latestState.nations || [])
                                .filter(n => n.isAtWar && !n.isRebelNation)
                                .map(n => ({ id: n.id, warScore: n.warScore || 0, eventId: `${n.id}_${n.warStartDay || 0}` }));
                            const prevState = {
                                stability: latestState.stability || 50,
                                completedChains: latestState.completedChains || 0,
                                // 上一tick的在战国家列表（用于检测战争结束）
                                warNations: prevWarNationsRef.current,
                            };
                            const curState = {
                                stability: result.stability ?? latestState.stability ?? 50,
                                population: result.population ?? latestState.population ?? 0,
                                epoch: latestState.epoch ?? epoch ?? 0,
                                techsUnlocked: latestState.techsUnlocked || techsUnlocked || [],
                                rulingCoalition: latestState.rulingCoalition || rulingCoalition || [],
                                buildings: latestState.buildings || {},
                                resources: adjustedResources,
                                popStructure: result.popStructure || latestState.popStructure || {},
                                classApproval: result.classApproval || latestState.classApproval || {},
                                ideologyMilestones: latestState.ideologyMilestones || [],
                                completedChains: result.completedChains ?? latestState.completedChains ?? 0,
                                tradeVolume: _tradeVolume,
                                warNations: _curWarNations,
                            };
                            // 更新上一tick的快照（供下一tick使用）
                            prevWarNationsRef.current = _curWarNations;
                            const scoreResult = checkAndAwardIdeologyScore(curState, prevState);
                            if (scoreResult.scoreGained > 0) {
                                setIdeologyScore(prev => (prev || 0) + scoreResult.scoreGained);
                                if (scoreResult.updatedMilestones) {
                                    setIdeologyMilestones(scoreResult.updatedMilestones);
                                }
                            }

                            // 3. 涌现检查
                            const newScore = (latestState.ideologyScore || 0) + scoreResult.scoreGained;
                            const newSpent = latestState.ideologyScoreSpent || 0;
                            const ownedCount = (latestState.ideologyCollection || []).length;
                            if (!latestState.pendingIdeologyEmergence && checkEmergence(newScore, newSpent, ownedCount)) {
                                // 只有上次是跳过时才继承稀有度加成，选择后加成清零
                                const wasSkipped = latestState.lastEmergenceWasSkipped ?? false;
                                const rarityBonus = wasSkipped ? (latestState.ideologyEmergenceRarityBonus || ideologyEmergenceRarityBonus || 0) : 0;
                                const candidates = generateEmergenceCandidates(curState, latestState.ideologyCollection || [], rarityBonus);
                                if (candidates.length > 0) {
                                    setIsPaused(true);
                                    setPendingIdeologyEmergence({ candidates });
                                }
                            }
                        });
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
                // [NEW] 不再采样，而是按优先级排序后，每个 tick 处理 2 涓浗瀹?
                // 杩欐牱鍙互鍦ㄥ涓?tick 中覆盖所有符合条件的国家
                const effectiveDaysElapsed = current.daysElapsed || 0;

                // [NEW] 妫€鏌ユ槸鍚﹀簲璇ュ紑濮嬫柊鐨勬姇璧勫懆鏈燂紙姣?0天）
                // [FIX] 改为基于上次处理时间的相对触发，避免在游戏中途加载时无法触发
                const lastOutboundDay = outboundInvestmentBatchRef.current.lastProcessDay;
                const shouldStartNewCycle = lastOutboundDay === null
                    ? (effectiveDaysElapsed > 0) // 棣栨瑙﹀彂锛氱珛鍗宠Е鍙戯紙閬垮厤鍦ㄦ父鎴忎腑閫斿姞杞芥椂绛夊緟鐗瑰畾浣欐暟锛?
                    : (effectiveDaysElapsed - lastOutboundDay >= 10); // 鍚庣画瑙﹀彂锛氳窛绂讳笂娆″鐞?>= 10 澶?
                const isInActiveCycle = lastOutboundDay !== null &&
                    effectiveDaysElapsed - lastOutboundDay < 10 &&
                    effectiveDaysElapsed > lastOutboundDay;

                if (shouldStartNewCycle || isInActiveCycle) {
                    // 如果是新周期的开始，重置 offset
                    if (shouldStartNewCycle && outboundInvestmentBatchRef.current.lastProcessDay !== effectiveDaysElapsed) {
                        outboundInvestmentBatchRef.current.offset = 0;
                        outboundInvestmentBatchRef.current.lastProcessDay = effectiveDaysElapsed;
                    }

                    import('../logic/diplomacy/autonomousInvestment').then(({ selectOutboundInvestmentsBatch, resetInvestmentCache }) => {
                        if (shouldStartNewCycle && !isInActiveCycle) resetInvestmentCache();
                        // [FIX] 玩家数据不在 nations 鏁扮粍涓紝闇€瑕佹瀯寤鸿櫄鎷熺帺瀹跺浗瀹跺璞?
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
                            batchSize: 2, // 每个 tick 处理 2 涓浗瀹?
                            batchOffset: outboundInvestmentBatchRef.current.offset,
                        });

                        const { investments, hasMore, nextOffset } = result;

                        // [NEW] 鏇存柊鎵规鐘舵€?
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
                                addLog('[自治投资] ' + stratumName + ' 在 ' + targetNation.name + ' 投资 ' + building.name + '（预计日回报 ' + dailyProfit.toFixed(1) + '），注资 ' + formatNumberShortCN(cost) + '。');
                            });
                        }).catch(err => console.warn('Autonomous investment merge error:', err));

                        setNations(prev => prev.map(n => {
                            if (!investments.some(option => option.targetNation.id === n.id)) return n;
                            return { ...n, lastOutboundSampleDay: effectiveDaysElapsed };
                        }));
                    }).catch(err => console.warn('Autonomous investment error:', err));
                }

                // 4. 国外 -> 国内投资（每10澶╄Е鍙戜竴娆★紝閿欏紑5澶╋紝鍒嗘壒处理所有符合条件的投资国）
                // [NEW] 不再采样，而是按优先级排序后，每个 tick 处理 2 个投资国
                // [FIX] 改为基于上次处理时间的相对触发，避免在游戏中途加载时无法触发
                const lastInboundDay = inboundInvestmentBatchRef.current.lastProcessDay;
                const shouldStartInboundCycle = lastInboundDay === null
                    ? (effectiveDaysElapsed > 0) // 棣栨瑙﹀彂锛氱珛鍗宠Е鍙戯紙閬垮厤鍦ㄦ父鎴忎腑閫斿姞杞芥椂绛夊緟鐗瑰畾浣欐暟锛?
                    : (effectiveDaysElapsed - lastInboundDay >= 10); // 鍚庣画瑙﹀彂锛氳窛绂讳笂娆″鐞?>= 10 澶?
                const isInInboundCycle = lastInboundDay !== null &&
                    effectiveDaysElapsed - lastInboundDay < 10 &&
                    effectiveDaysElapsed > lastInboundDay;

                debugLog('trade', '? [INBOUND-CYCLE] Day', effectiveDaysElapsed,
                    '- shouldStart:', shouldStartInboundCycle,
                    '- isInCycle:', isInInboundCycle,
                    '- lastProcessDay:', lastInboundDay,
                    '- offset:', inboundInvestmentBatchRef.current.offset);

                if (shouldStartInboundCycle || isInInboundCycle) {
                    debugLog('trade', '[INBOUND-CYCLE] 触发 inbound investment 检查');
                    import('../logic/diplomacy/autonomousInvestment').then(({ selectInboundInvestmentsBatch, resetInvestmentCache }) => {
                        if (shouldStartInboundCycle && !isInInboundCycle) resetInvestmentCache();
                        // 寮€濮嬫柊鍛ㄦ湡鏃堕噸缃?offset
                        if (shouldStartInboundCycle && !isInInboundCycle) {
                            debugLog('trade', '? [INBOUND-CYCLE] 寮€濮嬫柊鍛ㄦ湡锛岄噸缃?offset');
                            inboundInvestmentBatchRef.current.offset = 0;
                            inboundInvestmentBatchRef.current.lastProcessDay = effectiveDaysElapsed;
                        }

                        // [FIX] 玩家数据不在 nations 鏁扮粍涓紝鐩存帴浠?current 获取
                        const playerState = {
                            population: current.population,
                            wealth: current.resources?.silver || 0,
                            resources: current.resources,
                            buildings: current.buildings || {},
                            jobFill: current.jobFill,
                            id: 'player',
                            treaties: [], // 玩家的条约存储在 nations 数组中的对方国家身上
                            vassalOf: null, // 鐜╁涓嶄細鏄檮搴?
                        };

                        debugLog('trade', '? [INBOUND-CYCLE] 调用 selectInboundInvestmentsBatch - offset:', inboundInvestmentBatchRef.current.offset);

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

                        debugLog('trade', '? [INBOUND-CYCLE] 返回结果 - investments:', investments.length, 'hasMore:', hasMore, 'nextOffset:', nextOffset);

                        // 鏇存柊鎵规鐘舵€?
                        inboundInvestmentBatchRef.current.offset = nextOffset;
                        if (!hasMore) {
                            // 本周期处理完毕，清空 lastProcessDay
                            debugLog('trade', '[INBOUND-CYCLE] 本周期处理完毕');
                            inboundInvestmentBatchRef.current.lastProcessDay = null;
                        }

                        if (investments.length === 0) {
                            debugLog('trade', '鉂?[INBOUND-CYCLE] 没有投资决策');
                            return;
                        }

                        debugLog('trade', '[INBOUND-CYCLE] 执行', investments.length, '个投资');

                        investments.forEach(decision => {
                            const { investorNation, building, cost, investmentPolicy } = decision;
                            const actionsRef = current.actions;
                            if (actionsRef && actionsRef.handleDiplomaticAction) {
                                actionsRef.handleDiplomaticAction(investorNation.id, 'accept_foreign_investment', {
                                    buildingId: building.id,
                                    ownerStratum: 'capitalist',
                                    operatingMode: 'local',
                                    investmentAmount: cost,
                                    investmentPolicy,
                                    trackAnalytics: false,
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

                                addLog('[外资建设] ' + investorNation.name + ' 在本国投资建设了 ' + building.name + '。');
                            }
                        });
                    }).catch(err => console.warn('AI investment error:', err));
                }

                // 条约维护费已在 simulation 内统一扣除并记账，避免主线程重复扣减

                // [MOVED] 附庸每日更新已移至主 setResources 调用之前，避免产生对账差额

                _apMark('ideology+investment_dispatch');

                // ========== 官员成长系统（每日经验与升级）==========
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
                        addLog('[官员升级] ' + change.officialName + ' 升至 Lv.' + change.newLevel + ' (' + statDetails + ')');
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

                    // 鏂扮殑鏀垮彉妫€娴嬫潯浠讹細鍩轰簬蹇犺瘹搴︾郴缁?
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
                            const loyalty = official.loyalty ?? 75; // 榛樿鍏煎鏃у瓨妗?
                            const lowLoyaltyDays = official.lowLoyaltyDays ?? 0;

                            // 条件1：忠诚度低于阈值且持续足够天数
                            if (loyalty >= COUP_THRESHOLD || lowLoyaltyDays < COUP_DURATION_DAYS) {
                                return false;
                            }

                            // 鏉′欢2锛氭湁瓒冲璧勬湰鍙戝姩鏀垮彉锛堟弧瓒充换涓€锛?
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
                        const loyaltyFactor = Math.max(0.5, (25 - loyalty) / 25); // 蹇犺瘹搴﹁秺浣庢鐜囪秺楂?
                        const triggerChance = Math.min(0.15, 0.02 * loyaltyFactor);

                        if (Math.random() < triggerChance) {
                            // [FIX] 添加安全检查：确保目标官员有有效的ID，避免意外删除其他官员
                            const targetId = target.official.id;
                            if (!targetId) {
                                console.error('[COUP BUG] Target official has no ID:', target.official);
                            }
                            // [FIX] 防止同一官员在状态更新前重复触发政变（多tick竞态）
                            if (coupTriggeredOfficialIds.current.has(targetId)) {
                                // 该官员已触发政变，跳过
                            } else {
                                coupTriggeredOfficialIds.current.add(targetId);
                                // 60秒后清除记录（防止内存泄漏，实际上官员已被移除）
                                setTimeout(() => coupTriggeredOfficialIds.current.delete(targetId), 60000);
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

                            addLog('[官僚政变] ' + target.official.name + ' 携资叛逃，成立了 ' + rebelNation.name + '。');
                            } // end else (not already triggered)
                        }
                    }
                }

                const nextPopStructure = coupOutcome?.popStructure || result.popStructure;
                const nextOfficials = Array.isArray(coupOutcome?.officials) ? coupOutcome.officials
                    : Array.isArray(result.officials) ? result.officials : null;
                const nextBuildings = coupOutcome?.buildings || result.buildings;
                const nextBuildingUpgrades = coupOutcome?.buildingUpgrades || result.buildingUpgrades;
                // [FIX] 合并附庸系统更新到nextNations，避免被覆盖
                // vassalNationsUpdated 鍖呭惈浜嗛檮搴哥殑鐙珛鍊惧悜绛夋洿鏂?
                let nextNations = coupOutcome?.nations || result.nations;
                if (vassalNationsUpdated && nextNations) {
                    // [DEBUG] 调试日志
                    const vassalBefore = vassalNationsUpdated.find(n => n.vassalOf === 'player');
                    const nationBefore = nextNations.find(n => n.vassalOf === 'player');
                    if (vassalBefore) {
                        debugLog('vassal', '[VASSAL DEBUG] Before merge:', {
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

                    // [DEBUG] 鍚堝苟鍚庤皟璇曟棩蹇?
                    const vassalAfter = nextNations.find(n => n.vassalOf === 'player');
                    if (vassalAfter) {
                        debugLog('vassal', '[VASSAL DEBUG] After merge:', {
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

                _apMark('officials+coup+vassal_merge');

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

                // 4. Supply Breakdown History Update (for dynamic PPI basket)
                if (result.market?.supplyBreakdown) {
                    // 确保supplyBreakdown鏁扮粍瀛樺湪锛堝吋瀹规棫瀛樻。锛?
                    if (!mHist.supplyBreakdown) {
                        mHist.supplyBreakdown = [];
                    }
                    mHist.supplyBreakdown.push(result.market.supplyBreakdown);
                    // 淇濈暀鏈€杩?0天的数据（用于PPI绡瓙璁＄畻锛?
                    const MAX_SUPPLY_BREAKDOWN_DAYS = 10;
                    if (mHist.supplyBreakdown.length > MAX_SUPPLY_BREAKDOWN_DAYS) {
                        mHist.supplyBreakdown.shift();
                    }
                }

                const adjustedMarket = {
                    ...(result.market || {}),
                    // [PERF] 非 full-tick 时 Worker 不传 breakdown/consumption，用缓存填充
                    supplyBreakdown: result.market?.supplyBreakdown || cachedSupplyBreakdownRef.current,
                    demandBreakdown: result.market?.demandBreakdown || cachedDemandBreakdownRef.current,
                    priceHistory: mHist.price,
                    supplyHistory: mHist.supply,
                    demandHistory: mHist.demand,
                    modifiers: result.modifiers || {},
                };

                // ========== 历史数据节流同步 ==========
                // 浠呭綋璁℃暟鍣ㄥ埌杈鹃棿闅旀椂锛屾墠灏?Ref 涓殑鏁版嵁鍚屾鍒?React State
                historyUpdateCounterRef.current++;
                const shouldUpdateUIState = historyUpdateCounterRef.current >= HISTORY_UPDATE_INTERVAL;

                if (shouldUpdateUIState) {
                    historyUpdateCounterRef.current = 0;

                    // [PERF] 低频同步history到worker缓存
                    syncHistory({
                        classWealthHistory: classWealthHistoryRef.current,
                        classNeedsHistory: classNeedsHistoryRef.current,
                    });

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
                            fiscalNetIncome: appendValue(safeHistory.fiscalNetIncome, netTreasuryChange || 0),
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

                ideologyMetricsRef.current = updateIdeologyMetrics(ideologyMetricsRef.current, {
                    tax: result.taxes?.breakdown?.totalFiscalIncome
                        ?? (
                            (result.taxes?.breakdown?.headTax || 0)
                            + (result.taxes?.breakdown?.industryTax || 0)
                            + (result.taxes?.breakdown?.businessTax || 0)
                            + (result.taxes?.breakdown?.policyIncome || 0)
                            + (result.taxes?.breakdown?.warIndemnity || 0)
                        ),
                    trade: Math.max(
                        ((result.tradeRoutes?.routes || current.tradeRoutes?.routes || []).reduce((sum, route) => (
                            sum + (route?.value || route?.amount || 0)
                        ), 0)),
                        (result.taxes?.breakdown?.tariff || 0) + (result.taxes?.breakdown?.tradeRouteTax || 0)
                    ),
                    science: Math.max(0, result.rates?.science || 0),
                    culture: Math.max(0, result.rates?.culture || 0),
                });

                if (isUsingWorker) {
                    const ideologyTick = (current.daysElapsed || 0) + 1;
                    const livingLevelOrder = ['赤贫', '贫困', '温饱', '小康', '富裕', '奢华'];
                    const getLivingLevelRank = (level) => {
                        const index = livingLevelOrder.indexOf(level);
                        return index >= 0 ? index : -1;
                    };
                    const ideologyScaling = buildIdeologyScalingContext({
                        epoch: current.epoch || 0,
                        ideologyMetrics: ideologyMetricsRef.current,
                        population: result.population || current.population || 0,
                        totalBuildings: getTotalBuildingCount(current.buildings),
                        militarySize: getTotalArmyCount(current.army, current.militaryQueue, current.militaryCorps),
                        vassalCount: (nextNations || current.nations || []).filter(n => n.vassalOf === 'player' || n.isAnnexed).length,
                    });
                    if (ideologyTick > 0 && ideologyTick % 360 === 0) {
                        ideologyEventBus.emit(IDEOLOGY_EVENTS.ON_YEAR_END, {
                            year: Math.floor(ideologyTick / 360),
                        }, ideologyTick);
                    }
                    if (ideologyTick > 0 && ideologyTick % 90 === 0) {
                        ideologyEventBus.emit(IDEOLOGY_EVENTS.ON_SEASON_CHANGE, {
                            season: Math.floor((ideologyTick % 360) / 90),
                        }, ideologyTick);
                    }
                    const completedTrades = result.merchantState?.completedTrades || [];
                    if (completedTrades.length > 0) {
                        ideologyEventBus.emit(IDEOLOGY_EVENTS.ON_TRADE_COMPLETE, {
                            tradeCount: completedTrades.length,
                            totalProfit: completedTrades.reduce((sum, trade) => sum + (trade.profit || 0), 0),
                        }, ideologyTick);
                    }
                    if (ideologyTick > 0 && ideologyTick % 30 === 0) {
                        const totalTax = result.taxes?.breakdown?.totalFiscalIncome
                            ?? (
                                (result.taxes?.breakdown?.headTax || 0)
                                + (result.taxes?.breakdown?.industryTax || 0)
                                + (result.taxes?.breakdown?.businessTax || 0)
                                + (result.taxes?.breakdown?.policyIncome || 0)
                                + (result.taxes?.breakdown?.warIndemnity || 0)
                            );
                        if (totalTax > 0) {
                            ideologyEventBus.emit(IDEOLOGY_EVENTS.ON_TAX_COLLECT, {
                                totalTax,
                                taxes: result.taxes,
                            }, ideologyTick);
                        }
                        const totalSubsidy = Math.max(0, result.taxes?.breakdown?.subsidy || 0);
                        if (totalSubsidy > 0) {
                            ideologyEventBus.emit(IDEOLOGY_EVENTS.ON_SUBSIDY_PAID, {
                                totalSubsidy,
                            }, ideologyTick);
                        }
                    }
                    const treasuryMilestoneStep = scaleLegacyMilestoneThreshold({
                        threshold: 5000,
                        type: 'treasury',
                        context: ideologyScaling,
                    });
                    const previousTreasuryMilestone = Math.floor((current.resources?.silver || 0) / treasuryMilestoneStep);
                    const nextTreasuryMilestone = Math.floor((result.resources?.silver || 0) / treasuryMilestoneStep);
                    if (nextTreasuryMilestone > previousTreasuryMilestone && (result.resources?.silver || 0) > 0) {
                        ideologyEventBus.emit(IDEOLOGY_EVENTS.ON_TREASURY_MILESTONE, {
                            treasury: result.resources?.silver || 0,
                            milestone: nextTreasuryMilestone * treasuryMilestoneStep,
                        }, ideologyTick);
                    }
                    const populationMilestoneStep = scaleLegacyMilestoneThreshold({
                        threshold: 100,
                        type: 'population',
                        context: ideologyScaling,
                    });
                    const previousPopulationMilestone = Math.floor((current.population || 0) / populationMilestoneStep);
                    const nextPopulationMilestone = Math.floor((result.population || 0) / populationMilestoneStep);
                    if (nextPopulationMilestone > previousPopulationMilestone && (result.population || 0) > 0) {
                        ideologyEventBus.emit(IDEOLOGY_EVENTS.ON_POP_MILESTONE, {
                            population: result.population || 0,
                            milestone: nextPopulationMilestone * populationMilestoneStep,
                        }, ideologyTick);
                    }
                    const previousLivingStandards = current.market?.classLivingStandard || {};
                    const nextLivingStandards = result.classLivingStandard || {};
                    const livingStrata = new Set([
                        ...Object.keys(previousLivingStandards),
                        ...Object.keys(nextLivingStandards),
                    ]);
                    livingStrata.forEach((stratumKey) => {
                        const fromLevel = previousLivingStandards?.[stratumKey]?.level;
                        const toLevel = nextLivingStandards?.[stratumKey]?.level;
                        if (!fromLevel || !toLevel || fromLevel === toLevel) return;
                        ideologyEventBus.emit(IDEOLOGY_EVENTS.ON_LIVING_STANDARD_CHANGE, {
                            stratumKey,
                            fromLevel,
                            toLevel,
                            direction: getLivingLevelRank(toLevel) >= getLivingLevelRank(fromLevel) ? 'up' : 'down',
                        }, ideologyTick);
                    });
                    Object.entries(result.classApproval || {}).forEach(([stratumKey, approval]) => {
                        const previousApproval = current.classApproval?.[stratumKey] ?? 100;
                        if (previousApproval >= 40 && approval < 40) {
                            ideologyEventBus.emit(IDEOLOGY_EVENTS.ON_CLASS_APPROVAL_LOW, {
                                stratumKey,
                                approval,
                                previousApproval,
                            }, ideologyTick);
                        }
                    });
                    if ((result.starvationDeaths || 0) > 0) {
                        ideologyEventBus.emit(IDEOLOGY_EVENTS.ON_STARVATION, {
                            deaths: result.starvationDeaths,
                            severity: result.starvationDeaths >= Math.max(10, Math.floor((result.population || current.population || 0) * 0.02)) ? 'severe' : 'minor',
                        }, ideologyTick);
                    }
                    const previousLegitimacy = current.legitimacy ?? result.legitimacy ?? 50;
                    const nextLegitimacy = result.legitimacy ?? previousLegitimacy;
                    if (Math.abs(nextLegitimacy - previousLegitimacy) >= 5) {
                        ideologyEventBus.emit(IDEOLOGY_EVENTS.ON_LEGITIMACY_CHANGE, {
                            legitimacy: nextLegitimacy,
                            previousLegitimacy,
                            delta: nextLegitimacy - previousLegitimacy,
                        }, ideologyTick);
                    }
                    const previousStability = current.stability ?? result.stability ?? 50;
                    const nextStability = result.stability ?? previousStability;
                    if (previousStability > 25 && nextStability <= 25) {
                        ideologyEventBus.emit(IDEOLOGY_EVENTS.ON_STABILITY_CRISIS, {
                            stability: nextStability,
                        }, ideologyTick);
                    }
                    if (previousStability < 75 && nextStability >= 75) {
                        ideologyEventBus.emit(IDEOLOGY_EVENTS.ON_STABILITY_HIGH, {
                            stability: nextStability,
                        }, ideologyTick);
                    }
                    const previousNationMap = new Map((current.nations || []).map((nation) => [nation.id, nation]));
                    const previousVassals = new Set(
                        (current.nations || [])
                            .filter((nation) => nation?.id && nation.vassalOf === 'player')
                            .map((nation) => nation.id)
                    );
                    (nextNations || []).forEach((nation) => {
                        if (!nation?.id || nation.id === 'player') return;
                        const previousNation = previousNationMap.get(nation.id);
                        if (previousNation) {
                            const relationDelta = (nation.relation || 0) - (previousNation.relation || 0);
                            if (relationDelta >= 10) {
                                ideologyEventBus.emit(IDEOLOGY_EVENTS.ON_RELATION_IMPROVE, {
                                    nationId: nation.id,
                                    relation: nation.relation || 0,
                                    delta: relationDelta,
                                }, ideologyTick);
                            } else if (relationDelta <= -10) {
                                ideologyEventBus.emit(IDEOLOGY_EVENTS.ON_RELATION_HOSTILE, {
                                    nationId: nation.id,
                                    relation: nation.relation || 0,
                                    delta: relationDelta,
                                }, ideologyTick);
                            }
                        }
                        if (!previousVassals.has(nation.id) && nation.vassalOf === 'player') {
                            ideologyEventBus.emit(IDEOLOGY_EVENTS.ON_VASSAL_GAIN, {
                                nationId: nation.id,
                                relation: nation.relation || 0,
                            }, ideologyTick);
                        }
                    });
                }

                // 鏇存柊鎵€鏈夌姸鎬?- 浣跨敤鎵归噺鏇存柊鍑忓皯閲嶆覆鏌撴鏁?
                // 灏嗘墍鏈?setState 璋冪敤鍖呰鍦?unstable_batchedUpdates 涓?
                // 这可以将 30+ 次渲染合并为 1 次，大幅提升低端设备性能
                // [FIX] 将 currentActions 提升到 .then() 回调顶层作用域，
                // 确保 unstable_batchedUpdates 内外所有代码都能访问
                const currentActions = current.actions;

                _apMark('history+ideology_events');

                unstable_batchedUpdates(() => {
                    // [PERF] 面板数据降频 setState（approvalBreakdown / classFinancialData / buildingFinancialData）
                    // Worker 路径：stripPayloadForTransfer 已降频（非 full tick 传 null）→ 此处跳过 null
                    // 主线程路径：simulation 每 tick 都返回数据 → 用计数器节流，每 10 tick 更新一次
                    mainThreadFinancialCounterRef.current++;
                    const shouldUpdatePanelData = result._isFullTick ||
                        (mainThreadFinancialCounterRef.current % MAIN_THREAD_FINANCIAL_INTERVAL === 0);

                    // [PERF] 高速模式：纯展示 setState 仅每 N tick 更新一次
                    if (_shouldUpdateUI) {
                        setPopStructure(nextPopStructure);
                        setMaxPop(result.maxPop);
                        setRates(result.rates || {});
                    }
                    setClassApproval(result.classApproval);
                    if (result.approvalBreakdown && shouldUpdatePanelData) {
                        setApprovalBreakdown(result.approvalBreakdown);
                    }
                    const adjustedInfluence = { ...(result.classInfluence || {}) };
                    Object.entries(classInfluenceShift || {}).forEach(([key, delta]) => {
                        if (!delta) return;
                        adjustedInfluence[key] = (adjustedInfluence[key] || 0) + delta;
                    });
                    if (_shouldUpdateUI) setClassInfluence(adjustedInfluence);
                    stateRef.current.classInfluence = adjustedInfluence;
                    const wealthDelta = {};
                    Object.keys(adjustedClassWealth).forEach(key => {
                        const prevWealth = current.classWealth?.[key] || 0;
                        wealthDelta[key] = adjustedClassWealth[key] - prevWealth;
                    });
                    setClassWealth(adjustedClassWealth, { reason: 'tick_class_wealth_update', meta: { day: current.daysElapsed || 0 } });
                    if (_shouldUpdateUI) {
                        setClassWealthDelta(wealthDelta);
                        setClassIncome(result.classIncome || {});
                        setClassExpense(result.classExpense || {});
                    }
                    if (result.classFinancialData && shouldUpdatePanelData) {
                        setClassFinancialData(result.classFinancialData);
                    }
                    if (result.buildingFinancialData && shouldUpdatePanelData) {
                        setBuildingFinancialData(result.buildingFinancialData);
                    }
                    if (_shouldUpdateUI && typeof setStateBuildingSilverOutput === 'function') {
                        setStateBuildingSilverOutput(result.stateBuildingSilverOutput || 0);
                    }
                    if (typeof window !== 'undefined' && result.buildingDebugData) {
                        window.__buildingDebugData = result.buildingDebugData;
                    }
                    // 鍘嗗彶鏁版嵁鏇存柊宸茬Щ鑷充笂鏂?Ref 绠＄悊閮ㄥ垎锛屾澶勪笉鍐嶉噸澶嶈皟鐢?
                    if (_shouldUpdateUI) {
                        setTotalInfluence(result.totalInfluence);
                        setTotalWealth(adjustedTotalWealth);
                    }
                    setActiveBuffs(result.activeBuffs);
                    setActiveDebuffs(result.activeDebuffs);
                    setStability(result.stability);
                    // 鏇存柊鎵ф斂鑱旂洘鍚堟硶鎬?
                    if (typeof setLegitimacy === 'function' && result.legitimacy !== undefined) {
                        setLegitimacy(result.legitimacy);
                    }
                    // DEBUG: 璋冭瘯鍏崇◣鍊?
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
                    if (_shouldUpdateUI) {
                        setClassShortages(result.needsShortages || {});
                        setClassLivingStandard(result.classLivingStandard || {});
                    }
                    if (result.army) {
                        setArmy(result.army); // 保存战斗损失
                    }
                    // 更新官员状态（含独立财务数据）
                    // [FIX] 浣跨敤鍑芥暟寮忔洿鏂帮紝鍚堝苟鏂伴泧浣ｇ殑瀹樺憳閬垮厤绔炴€佹潯浠惰鐩?
                    if (nextOfficials) {
                        setOfficials(prevOfficials => {
                            // 如果 simulation 返回的官员列表和当前状态一致，直接使用
                            if (!prevOfficials || prevOfficials.length === 0) {
                                return nextOfficials;
                            }

                            // 创建 simulation 缁撴灉鐨?ID 映射（用于快速查找）
                            const simOfficialMap = new Map(nextOfficials.map(o => [o?.id, o]));

                            // 鎵惧嚭褰撳墠鐘舵€佷腑瀛樺湪浣?simulation 结果中没有的官员（新雇佣的）
                            const newlyHiredOfficials = prevOfficials.filter(
                                o => o?.id && !simOfficialMap.has(o.id)
                            );

                            // 濡傛灉娌℃湁鏂伴泧浣ｇ殑瀹樺憳锛岀洿鎺ヨ繑鍥?simulation 结果
                            if (newlyHiredOfficials.length === 0) {
                                return nextOfficials;
                            }

                            // 合并：simulation 结果 + 新雇佣的官员（去重保护）
                            debugLog('mainThread', `[HIRE FIX] Preserving ${newlyHiredOfficials.length} newly hired official(s) from race condition`);
                            const merged = [...nextOfficials, ...newlyHiredOfficials];
                            // Deduplicate by id to prevent key conflicts in UI
                            const seen = new Set();
                            return merged.filter(o => {
                                if (!o?.id || seen.has(o.id)) return false;
                                seen.add(o.id);
                                return true;
                            });
                        });
                    }
                    if (typeof result.officialsSimCursor === 'number' && typeof setOfficialsSimCursor === 'function') {
                        setOfficialsSimCursor(result.officialsSimCursor);
                    }
                    // 更新官员容量（基于时代、政体、科技动态计算）
                    if (typeof result.effectiveOfficialCapacity === 'number' && typeof setOfficialCapacity === 'function') {
                        setOfficialCapacity(result.effectiveOfficialCapacity);
                    }
                    if (_shouldUpdateUI) {
                        setLivingStandardStreaks(result.livingStandardStreaks || current.livingStandardStreaks || {});
                        setMigrationCooldowns(result.migrationCooldowns || current.migrationCooldowns || {});
                        setTaxShock(result.taxShock || current.taxShock || {});
                    }
                    // stateRef 直写确保模拟正确性
                    stateRef.current.livingStandardStreaks = result.livingStandardStreaks || current.livingStandardStreaks || {};
                    stateRef.current.migrationCooldowns = result.migrationCooldowns || current.migrationCooldowns || {};
                    stateRef.current.taxShock = result.taxShock || current.taxShock || {};
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
                    if (result.tradeRoutes && _shouldUpdateUI) {
                        setTradeRoutes(result.tradeRoutes);
                    }
                    if (result.overseasInvestments && _shouldUpdateUI) {
                        setOverseasInvestments(result.overseasInvestments);
                    }
                    if (result.foreignInvestments && _shouldUpdateUI) {
                        setForeignInvestments(result.foreignInvestments);
                    }
                    if (_shouldUpdateUI) {
                        const calculatedTradeRouteTax = result.taxes?.breakdown?.tradeRouteTax || 0;
                        setTradeStats(prev => ({ ...prev, tradeRouteTax: calculatedTradeRouteTax }));
                    }

                    if (nextNations) {
                        setNations(nextNations);
                        // [CRITICAL FIX] Update stateRef immediately to ensure next tick uses updated nations
                        // Without this, vassal population/wealth growth is lost because each tick starts from stale data
                        stateRef.current.nations = nextNations;
                    }
                    if (result.diplomaticReputation !== undefined) {
                        stateRef.current.diplomaticReputation = result.diplomaticReputation;
                        if (_shouldUpdateUI && typeof setDiplomaticReputation === 'function') {
                            setDiplomaticReputation(result.diplomaticReputation);
                        }
                    }
                    // [NEW] Update military corps & battle system states
                    if (result.militaryCorps && typeof setMilitaryCorps === 'function') {
                        setMilitaryCorps(result.militaryCorps);
                        stateRef.current.militaryCorps = result.militaryCorps;
                    }
                    if (result.generals && typeof setGenerals === 'function') {
                        setGenerals(result.generals);
                        stateRef.current.generals = result.generals;
                    }
                    if (result.activeFronts && typeof setActiveFronts === 'function') {
                        const resolvedNations = result.nations || current.nations || [];
                        const normalizedFronts = (result.activeFronts || []).map(front => {
                            const normalized = ensureFrontDefaults(front);
                            if (normalized.status !== 'active') return normalized;
                            const enemyId = normalized.attackerId === 'player' ? normalized.defenderId : normalized.attackerId;
                            const enemyNation = resolvedNations.find(n => n.id === enemyId);
                            if (enemyNation && enemyNation.isAtWar !== true) {
                                return { ...normalized, status: 'collapsed' };
                            }
                            return normalized;
                        });
                        // [FIX] 使用函数式更新合并，防止覆盖 tick 运行期间用户创建的 front
                        // 典型场景：用户宣战 createFrontForWar 排入队列 → tick 结果覆盖 → front 丢失
                        const simFrontIds = new Set(normalizedFronts.map(f => f.id));
                        setActiveFronts(prev => {
                            const existing = Array.isArray(prev) ? prev : [];
                            const userCreatedFronts = existing.filter(f => !simFrontIds.has(f.id));
                            const merged = [...normalizedFronts, ...userCreatedFronts];
                            // 同步 stateRef 使下一个 tick 能读到完整数据
                            stateRef.current.activeFronts = merged;
                            return merged;
                        });
                    }
                    if (result.activeBattles && typeof setActiveBattles === 'function') {
                        // [FIX] 同理：函数式更新合并，防止覆盖 tick 期间新增的 battle
                        const simBattleIds = new Set((result.activeBattles || []).map(b => b.id));
                        setActiveBattles(prev => {
                            const existing = Array.isArray(prev) ? prev : [];
                            const userCreatedBattles = existing.filter(b => !simBattleIds.has(b.id));
                            const merged = [...(result.activeBattles || []), ...userCreatedBattles];
                            stateRef.current.activeBattles = merged;
                            return merged;
                        });
                    }
                    if (result.diplomacyOrganizations) {
                        setDiplomacyOrganizations(prev => ({
                            ...(prev || {}),
                            ...(result.diplomacyOrganizations || {}),
                            organizations: result.diplomacyOrganizations.organizations || prev?.organizations || []
                        }));
                    }
                    if (result.jobFill && _shouldUpdateUI) {
                        setJobFill(result.jobFill);
                    }
                    if (result.jobsAvailable && _shouldUpdateUI) {
                        setJobsAvailable(result.jobsAvailable);
                    }
                    if (result.buildingJobsRequired && _shouldUpdateUI) {
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
                    // [FIX] 使用函数更新器合并 tick 期间新产生的玩家操作增量
                    if (nextBuildings) {
                        setBuildings(prev => {
                            // nextBuildings 已包含 tick 启动时消费的 pending delta
                            // 但 tick 运行期间可能有新的 buyBuilding/sellBuilding 调用
                            // 这些新增量已写入 React state (prev) 但不在 nextBuildings 中
                            // 通过 diff(prev, mergedBuildings) 检测新增量
                            const result = { ...nextBuildings };
                            if (mergedBuildings) {
                                Object.keys(prev).forEach(bid => {
                                    const prevCount = prev[bid] || 0;
                                    const mergedCount = mergedBuildings[bid] || 0;
                                    const lateActionDelta = prevCount - mergedCount;
                                    if (lateActionDelta !== 0) {
                                        result[bid] = Math.max(0, (result[bid] || 0) + lateActionDelta);
                                    }
                                });
                                // 处理 prev 中有但 mergedBuildings 中没有的新建筑（极端情况）
                                Object.keys(prev).forEach(bid => {
                                    if (!(bid in mergedBuildings) && prev[bid] > 0) {
                                        result[bid] = (result[bid] || 0) + prev[bid];
                                    }
                                });
                            }
                            return result;
                        });
                    }
                    if (
                        typeof result.lastMinisterExpansionDay === 'number' ||
                        (result.lastMinisterExpansionDay && typeof result.lastMinisterExpansionDay === 'object')
                    ) {
                        setLastMinisterExpansionDay(result.lastMinisterExpansionDay);
                    }
                    
                    // Update building upgrades from owner auto-upgrade
                    if (nextBuildingUpgrades) {
                        setBuildingUpgrades(prev => mergeLateBuildingUpgradeChanges(
                            nextBuildingUpgrades,
                            prev,
                            tickBaseBuildingUpgrades
                        ));
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
                    // 注意：nextEffects 鐢?processTimedEventEffects 璁＄畻寰楀嚭锛岄渶瑕佸啓鍥炵姸鎬?
                    setActiveEventEffects(prev => ({
                        ...prev,
                        approval: nextEffects.approval,
                        stability: nextEffects.stability,
                        resourceDemand: nextEffects.resourceDemand,
                        stratumDemand: nextEffects.stratumDemand,
                        buildingProduction: nextEffects.buildingProduction,
                        // forcedSubsidy 由单独的逻辑处理，不在此更新
                    }));

                    _apMark('setState_batch_basic');

                    // ========== 战斗回合推进 & 战线 Tick ==========
                    const currentActiveBattles = current.activeBattles || [];
                    const currentActiveFronts = current.activeFronts || [];
                    const currentCorps = current.militaryCorps || [];
                    const currentGenerals = current.generals || [];
                    let updatedBattles = [...currentActiveBattles].filter(Boolean).map((battle) => ensureBattleDefaults(battle));
                    let updatedFronts = currentActiveFronts.map(front => ensureFrontDefaults(front));
                    let updatedCorps = [...currentCorps];
                    let updatedGenerals = [...currentGenerals];

                    const _milBattleStart = _ap();
                    let _milBattleRoundsMs = 0, _milFrictionMs = 0;
                    if (currentActiveBattles.length > 0 || currentActiveFronts.length > 0) {
                        let updatedArmyFromBattle = null;
                        const battleLogs = [];
                        const frontAdvanceDeltas = {};
                        const nationWarScoreDeltaByEnemyId = {};
                        const resolvedDay = (current.daysElapsed || 0) + 1;
                        // Collect corps-level losses for auto-replenish queue
                        const pendingCorpsLossUpdates = {}; // { corpsId: { unitId: lossCount } }

                        // --- Process each active battle ---
                        updatedBattles = updatedBattles.map(battle => {
                            if (battle.status !== 'active') return battle;
                            // [FIX] Skip battles already finalized (defense against stale state at high speeds)
                            if (battle.result?.finalized) return battle;

                            const atkGeneral = currentGenerals.find(g => g.id === battle.attacker.generalId) || null;
                            const defGeneral = currentGenerals.find(g => g.id === battle.defender.generalId) || null;

                            const front = currentActiveFronts.find(f => f.id === battle.frontId);
                            const playerSide = front ? getPlayerSide(front) : null;
                            let battleContext = { front, supply: {} };

                            if (front && playerSide) {
                                const attackerCorpsIds = front.assignedCorps?.attacker || [];
                                const defenderCorpsIds = front.assignedCorps?.defender || [];
                                const attackerCorpsOnFront = updatedCorps.filter(corps => attackerCorpsIds.includes(corps.id));
                                const defenderCorpsOnFront = updatedCorps.filter(corps => defenderCorpsIds.includes(corps.id));
                                const frontSummary = summarizeFrontState(
                                    { ...front, playerResources: adjustedResources || {} },
                                    playerSide === 'attacker' ? attackerCorpsOnFront : defenderCorpsOnFront,
                                    playerSide === 'attacker' ? defenderCorpsOnFront : attackerCorpsOnFront
                                );
                                const playerOwnState = frontSummary?.playerView?.own || {};
                                const playerEnemyState = frontSummary?.playerView?.enemy || {};
                                battleContext = {
                                    front,
                                    supply: playerSide === 'attacker'
                                        ? {
                                            attacker: { ratio: playerOwnState.supplyRatio, state: playerOwnState.supplyState },
                                            defender: { ratio: playerEnemyState.supplyRatio, state: playerEnemyState.supplyState },
                                        }
                                        : {
                                            attacker: { ratio: playerEnemyState.supplyRatio, state: playerEnemyState.supplyState },
                                            defender: { ratio: playerOwnState.supplyRatio, state: playerOwnState.supplyState },
                                        },
                                };
                            }

                            // Deduct supply costs from player
                            if (playerSide) {
                                const supplyCost = calculateRoundSupplyCost(battle, playerSide, current.epoch || 0);
                                let hasEnoughSupply = true;
                                // [FIX Bug12] 计算实际补给满足率（定量而非定性）
                                let totalNeeded = 0;
                                let totalFulfilled = 0;
                                for (const [resource, cost] of Object.entries(supplyCost)) {
                                    const available = adjustedResources[resource] || 0;
                                    totalNeeded += cost;
                                    totalFulfilled += Math.min(available, cost);
                                    if (available < cost) hasEnoughSupply = false;
                                    adjustedResources[resource] = Math.max(0, available - cost);
                                }
                                // [FIX Bug12] 用实际满足率更新 supply ratio
                                const actualSupplyRatio = totalNeeded > 0 ? totalFulfilled / totalNeeded : 1;
                                if (!hasEnoughSupply) {
                                    if (playerSide === 'attacker') {
                                        battleContext.supply.attacker = {
                                            ...(battleContext.supply.attacker || {}),
                                            hasEnoughSupply: false,
                                            ratio: Math.min(battleContext.supply.attacker?.ratio ?? 1, actualSupplyRatio),
                                        };
                                    } else {
                                        battleContext.supply.defender = {
                                            ...(battleContext.supply.defender || {}),
                                            hasEnoughSupply: false,
                                            ratio: Math.min(battleContext.supply.defender?.ratio ?? 1, actualSupplyRatio),
                                        };
                                    }
                                    battleLogs.push(`⚠️ 补给不足，?{battle.typeName}「?{battle.attacker.corpsName} vs ${battle.defender.corpsName}「嶆垬鏂楀姏涓嬮檷`);
                                }
                            }

                            // Process one combat round
                            const updatedBattle = processCombatRound(battle, atkGeneral, defGeneral, battleContext);
                            const phaseResolved = Number(updatedBattle.lastResolvedPhaseDay || 0) > Number(battle.lastResolvedPhaseDay || 0);

                            // 阶段切换时：将领自动调整战术
                            if (phaseResolved && updatedBattle.status === 'active') {
                                const newAtkTactic = autoSelectTactic(updatedBattle, 'attacker', atkGeneral);
                                const newDefTactic = autoSelectTactic(updatedBattle, 'defender', defGeneral);
                                if (updatedBattle.battlePlan) {
                                    updatedBattle.battlePlan.attacker = newAtkTactic;
                                    updatedBattle.battlePlan.defender = newDefTactic;
                                }
                                if (updatedBattle.attacker) updatedBattle.attacker.plan = newAtkTactic;
                                if (updatedBattle.defender) updatedBattle.defender.plan = newDefTactic;
                            }

                            if (front && playerSide && phaseResolved && updatedBattle.latestPhaseOutcome) {
                                const phaseOutcome = updatedBattle.latestPhaseOutcome;
                                const orientedShift = playerSide === 'attacker'
                                    ? Number(phaseOutcome.lineShift || 0)
                                    : -Number(phaseOutcome.lineShift || 0);
                                const orientedPhaseWarScore = playerSide === 'attacker'
                                    ? Number(phaseOutcome.warScoreDelta || 0)
                                    : -Number(phaseOutcome.warScoreDelta || 0);
                                frontAdvanceDeltas[front.id] = (frontAdvanceDeltas[front.id] || 0) + orientedShift;

                                updatedFronts = updatedFronts.map((f) => {
                                    if (f.id !== front.id) return f;
                                    const warScoreBreakdown = {
                                        battle: Number(f.warScoreBreakdown?.battle || 0) + orientedPhaseWarScore,
                                        advance: Number(f.warScoreBreakdown?.advance || 0),
                                        economic: Number(f.warScoreBreakdown?.economic || 0),
                                        homeland: Number(f.warScoreBreakdown?.homeland || 0),
                                    };
                                    return {
                                        ...f,
                                        activeBattleId: updatedBattle.status === 'active' ? updatedBattle.id : null,
                                        warScore: Math.max(-500, Math.min(500, getWarScoreBreakdownTotal(warScoreBreakdown))),
                                        warScoreBreakdown,
                                    };
                                });

                                const enemyId = playerSide === 'attacker' ? front.defenderId : front.attackerId;
                                if (enemyId && orientedPhaseWarScore !== 0) {
                                    nationWarScoreDeltaByEnemyId[enemyId] = (nationWarScoreDeltaByEnemyId[enemyId] || 0) + orientedPhaseWarScore;
                                }

                                battleLogs.push(`[会战阶段] ${updatedBattle.engagementName}·${phaseOutcome.phase}：${phaseOutcome.outcomeSummary}`);
                            }

                            // Handle battle end
                            if (updatedBattle.result && updatedBattle.result.finalized && !battle.result) {
                                const winner = updatedBattle.result.winner;
                                const reason = updatedBattle.result.reason;
                                const reasonText = reason === 'annihilation'
                                    ? '全歼'
                                    : reason === 'morale_collapse'
                                        ? '士气崩溃'
                                        : reason === 'withdrawal'
                                            ? '有序脱离'
                                            : '阶段结束';
                                const winnerName = winner === 'attacker' ? updatedBattle.attacker.corpsName : updatedBattle.defender.corpsName;
                                const loserName = winner === 'attacker' ? updatedBattle.defender.corpsName : updatedBattle.attacker.corpsName;
                                battleLogs.push('[战斗] ' + updatedBattle.engagementName + ' 结束，' + winnerName + ' 击败 ' + loserName + '（' + reasonText + '，共' + updatedBattle.result.totalDays + '天）');

                                // Ideology event: battle victory / defeat
                                if (playerSide) {
                                    const isPlayerWin = (winner === playerSide);
                                    ideologyEventBus.emit(
                                        isPlayerWin ? IDEOLOGY_EVENTS.ON_BATTLE_VICTORY : IDEOLOGY_EVENTS.ON_BATTLE_DEFEAT,
                                        { engagementName: updatedBattle.engagementName, reason, durationDays: updatedBattle.result.totalDays || 0 },
                                        current.daysElapsed || 0
                                    );
                                }

                                // Sync survivors back to corps: support multi-corps battles
                                // 多兵团模式：按各兵团初始兵力比例分配剩余兵力
                                const distributeSurvivorsToCorps = (sideData, sideCorpsList) => {
                                    const survivors = { ...sideData };
                                    const totalSurvivors = Object.values(survivors).reduce((s, c) => s + Number(c || 0), 0);
                                    // 安全检查：空军团列表则直接返回空结果
                                    const validCorpsList = (sideCorpsList || []).filter(Boolean);
                                    if (validCorpsList.length === 0) {
                                        return [];
                                    }
                                    if (validCorpsList.length <= 1) {
                                        return [{ corpsId: validCorpsList[0], units: survivors, morale: 0 }];
                                    }
                                    // 多兵团：按初始兵力比例分配
                                    const corpsInitialTotals = validCorpsList.map(cid => {
                                        const c = updatedCorps.find(x => x.id === cid);
                                        return Object.values(c?.units || {}).reduce((s, v) => s + v, 0);
                                    });
                                    const totalInitial = corpsInitialTotals.reduce((s, v) => s + v, 0) || 1;
                                    const result = [];
                                    let remainingSurvivors = { ...survivors };
                                    validCorpsList.forEach((cid, idx) => {
                                        if (idx === validCorpsList.length - 1) {
                                            result.push({ corpsId: cid, units: { ...remainingSurvivors }, morale: 0 });
                                        } else {
                                            const share = totalInitial > 0 ? corpsInitialTotals[idx] / totalInitial : 0;
                                            const corpsUnits = {};
                                            for (const [uid, count] of Object.entries(remainingSurvivors)) {
                                                const allocated = Math.floor(count * share);
                                                if (allocated > 0) corpsUnits[uid] = allocated;
                                                remainingSurvivors[uid] = (remainingSurvivors[uid] || 0) - (corpsUnits[uid] || 0);
                                            }
                                            result.push({ corpsId: cid, units: corpsUnits, morale: 0 });
                                        }
                                    });
                                    return result;
                                };

                                const atkCorpsIds = updatedBattle.attacker.corpsIds || [updatedBattle.attacker.corpsId];
                                const defCorpsIds = updatedBattle.defender.corpsIds || [updatedBattle.defender.corpsId];
                                const atkDistrib = distributeSurvivorsToCorps(updatedBattle.result.attackerSurvivors, atkCorpsIds);
                                const defDistrib = distributeSurvivorsToCorps(updatedBattle.result.defenderSurvivors, defCorpsIds);
                                const allBattleCorpsIds = new Set([...atkCorpsIds, ...defCorpsIds].filter(Boolean));

                                // Snapshot player corps units before survivor distribution
                                const playerCorpsIdSet = playerSide === 'attacker'
                                    ? new Set(atkCorpsIds)
                                    : new Set(defCorpsIds);

                                const preDistribSnapshot = {};
                                if (playerSide) {
                                    for (const c of updatedCorps) {
                                        if (!c.isAI && playerCorpsIdSet.has(c.id)) {
                                            preDistribSnapshot[c.id] = { ...c.units };
                                        }
                                    }
                                }

                                updatedCorps = updatedCorps.map((c) => {
                                    if (!allBattleCorpsIds.has(c.id)) return c;
                                    const atkEntry = atkDistrib.find(e => e.corpsId === c.id);
                                    const defEntry = defDistrib.find(e => e.corpsId === c.id);
                                    const entry = atkEntry || defEntry;
                                    if (!entry) return c;
                                    const survivorUnits = entry.units;
                                    const remainingUnits = Object.values(survivorUnits).reduce((sum, count) => sum + Number(count || 0), 0);
                                    const sideMorale = atkEntry ? updatedBattle.attacker.morale : updatedBattle.defender.morale;
                                    return {
                                        ...c,
                                        units: survivorUnits,
                                        status: remainingUnits > 0
                                            ? (c.assignedFrontId ? 'deployed' : 'idle')
                                            : 'destroyed',
                                        assignedFrontId: remainingUnits > 0 ? c.assignedFrontId : null,
                                        morale: Math.max(20, sideMorale),
                                    };
                                });

                                // Calculate per-corps losses for auto-replenish queue
                                if (playerSide) {
                                    for (const corpsId of Object.keys(preDistribSnapshot)) {
                                        const before = preDistribSnapshot[corpsId];
                                        const afterCorps = updatedCorps.find(c => c.id === corpsId);
                                        if (!afterCorps) continue;
                                        const after = afterCorps.units || {};
                                        const allUnitIds = new Set([...Object.keys(before), ...Object.keys(after)]);
                                        for (const uid of allUnitIds) {
                                            const loss = (before[uid] || 0) - (after[uid] || 0);
                                            if (loss > 0) {
                                                if (!pendingCorpsLossUpdates[corpsId]) pendingCorpsLossUpdates[corpsId] = {};
                                                pendingCorpsLossUpdates[corpsId][uid] = (pendingCorpsLossUpdates[corpsId][uid] || 0) + loss;
                                            }
                                        }
                                    }
                                }

                                // Front battles consume corps troops directly. Do not deduct the reserve pool again.
                                if (playerSide) {
                                    const playerCasualties = playerSide === 'attacker'
                                        ? updatedBattle.result.attackerCasualties
                                        : updatedBattle.result.defenderCasualties;
                                    if (playerCasualties && Object.keys(playerCasualties).length > 0) {
                                        const totalPlayerLoss = Object.values(playerCasualties).reduce((s, c) => s + c, 0);
                                        battleLogs.push('[我军伤亡] ' + totalPlayerLoss + ' 人');
                                    }
                                }

                                // Award XP to generals
                                const xpReward = updatedBattle.result.totalRounds * 10;
                                if (atkGeneral) {
                                    updatedGenerals = updatedGenerals.map(g =>
                                        g.id === atkGeneral.id ? awardGeneralXP(g, winner === 'attacker' ? xpReward * 1.5 : xpReward * 0.5) : g
                                    );
                                }
                                if (defGeneral) {
                                    updatedGenerals = updatedGenerals.map(g =>
                                        g.id === defGeneral.id ? awardGeneralXP(g, winner === 'defender' ? xpReward * 1.5 : xpReward * 0.5) : g
                                    );
                                }

                                // Update front warScore
                                if (front) {
                                    updatedFronts = updatedFronts.map(f => {
                                        if (f.id !== front.id) return f;
                                        const report = {
                                            id: `${updatedBattle.id}_report`,
                                            battleId: updatedBattle.id,
                                            endedDay: resolvedDay,
                                            expiresDay: resolvedDay + 7,
                                            engagementName: updatedBattle.engagementName,
                                            winner,
                                            isPlayerWinner: winner === playerSide,
                                            reason,
                                            durationDays: updatedBattle.result.totalDays || updatedBattle.currentRound || 0,
                                            lineShift: playerSide === 'attacker'
                                                ? Number(updatedBattle.result.totalLineShift || 0)
                                                : -Number(updatedBattle.result.totalLineShift || 0),
                                            warScoreDelta: playerSide === 'attacker'
                                                ? Number(updatedBattle.result.totalWarScoreDelta || 0)
                                                : -Number(updatedBattle.result.totalWarScoreDelta || 0),
                                            playerLosses: getBattleLossTotal(playerSide === 'attacker'
                                                ? updatedBattle.result.attackerCasualties
                                                : updatedBattle.result.defenderCasualties),
                                            enemyLosses: getBattleLossTotal(playerSide === 'attacker'
                                                ? updatedBattle.result.defenderCasualties
                                                : updatedBattle.result.attackerCasualties),
                                            summary: updatedBattle.phaseReports?.[updatedBattle.phaseReports.length - 1]?.outcomeSummary
                                                || `${winner === playerSide ? '我方赢下了这场会战。' : '敌方赢下了这场会战。'}`,
                                        };
                                        return {
                                            ...f,
                                            activeBattleId: null,
                                            activeBattleType: null,
                                            lastBattleEndDay: resolvedDay,
                                            recentBattleReports: [report, ...(f.recentBattleReports || [])]
                                                .filter((item) => Number(item?.expiresDay || 0) >= resolvedDay)
                                                .slice(0, 5),
                                        };
                                    });
                                }

                                // [FIX] Removed redundant nation.warScore update on battle resolution.
                                // Battle phase deltas already flow through nationWarScoreDeltaByEnemyId (per-phase)
                                // AND front.warScoreBreakdown.battle (accumulated by simulation).
                                // The old code double-counted totalWarScoreDelta AND clamped to ±100.

                            }

                            return updatedBattle;
                        });

                        updatedBattles = updatedBattles.filter((battle) => battle?.status === 'active');
                        _milBattleRoundsMs = _ap() - _milBattleStart;

                        // --- Process front ticks (resource regeneration) ---
                        updatedFronts = updatedFronts.map(f => {
                            if (f.status !== 'active') return f;
                            const tickedFront = processFrontTick(f);
                            return {
                                ...tickedFront,
                                recentBattleReports: (tickedFront.recentBattleReports || [])
                                    .filter((report) => Number(report?.expiresDay || 0) >= resolvedDay)
                                    .slice(0, 5),
                            };
                        });

                        // --- Process front friction events (low-intensity combat between battles) ---
                        const currentDay = (current.daysElapsed || 0) + 1;
                        const buildingDestructionQueue = []; // { buildingId, count } for player buildings destroyed
                        const aiNationBuildingDestruction = []; // { nationId, buildingId, count } for AI buildings destroyed
                        const frictionPlunderQueue = []; // [NEW] 战线摩擦中的持续掠夺收集
                        const reversePlunderQueue = []; // 反向掠夺：AI掠夺玩家的银币/资源
                        const reverseNodePlunderQueue = []; // 反向资源节点掠夺
                        updatedFronts = updatedFronts.map(f => {
                            if (f.status !== 'active') return f;
                            const playerSide = getPlayerSide(f);
                            if (!playerSide) return f;
                            const enemySide = playerSide === 'attacker' ? 'defender' : 'attacker';
                            const playerCorpsIds = f.assignedCorps?.[playerSide] || [];
                            const enemyCorpsIds = f.assignedCorps?.[enemySide] || [];
                            const pCorps = playerCorpsIds.map(id => updatedCorps.find(c => c.id === id)).filter(Boolean);
                            const eCorps = enemyCorpsIds.map(id => updatedCorps.find(c => c.id === id)).filter(Boolean);

                            // Skip if there's an active battle on this front
                            const hasBattle = updatedBattles.some(b => b.frontId === f.id && b.status === 'active');
                            if (hasBattle) return f;

                            const attackerNation = (current.nations || []).find(n => n.id === f.attackerId);
                            const defenderNation = (current.nations || []).find(n => n.id === f.defenderId);
                            const frontRuntime = {
                                ...f,
                                playerResources: current.resources || {},
                                epoch: current.epoch || 0,
                                sideResources: {
                                    attacker: f.attackerId === 'player' ? (current.resources || {}) : (attackerNation?.military?.stockpile || {}),
                                    defender: f.defenderId === 'player' ? (current.resources || {}) : (defenderNation?.military?.stockpile || {}),
                                },
                            };
                            const frictionResult = processFrontFriction(frontRuntime, pCorps, eCorps, currentDay, f.posture || 'balanced');
                            if (!frictionResult) return f;

                            // Apply casualties to corps (distribute across all corps, multiple passes)
                            // Track per-corps friction losses for auto-replenish
                            if (frictionResult.casualties.player > 0 && pCorps.length > 0) {
                                let remaining = frictionResult.casualties.player;
                                let passes = 0;
                                while (remaining > 0 && passes < 5) {
                                    for (const corps of pCorps) {
                                        if (remaining <= 0) break;
                                        if (corps.isAI) continue;
                                        const unitKeys = Object.keys(corps.units || {}).filter(k => (corps.units[k] || 0) > 0);
                                        if (unitKeys.length === 0) continue;
                                        const key = unitKeys[Math.floor(Math.random() * unitKeys.length)];
                                        const corpsUnits = corps.units[key] || 0;
                                        const loss = Math.min(remaining, Math.max(1, Math.ceil(corpsUnits * 0.03)));
                                        corps.units[key] = Math.max(0, corpsUnits - loss);
                                        remaining -= loss;
                                        // Record friction loss per corps for auto-replenish
                                        if (loss > 0) {
                                            if (!pendingCorpsLossUpdates[corps.id]) pendingCorpsLossUpdates[corps.id] = {};
                                            pendingCorpsLossUpdates[corps.id][key] = (pendingCorpsLossUpdates[corps.id][key] || 0) + loss;
                                        }
                                    }
                                    passes++;
                                }
                            }
                            if (frictionResult.casualties.enemy > 0 && eCorps.length > 0) {
                                let remaining = frictionResult.casualties.enemy;
                                let passes = 0;
                                while (remaining > 0 && passes < 5) {
                                    for (const corps of eCorps) {
                                        if (remaining <= 0) break;
                                        const unitKeys = Object.keys(corps.units || {}).filter(k => (corps.units[k] || 0) > 0);
                                        if (unitKeys.length === 0) continue;
                                        const key = unitKeys[Math.floor(Math.random() * unitKeys.length)];
                                        const corpsUnits = corps.units[key] || 0;
                                        const loss = Math.min(remaining, Math.max(1, Math.ceil(corpsUnits * 0.03)));
                                        corps.units[key] = Math.max(0, corpsUnits - loss);
                                        remaining -= loss;
                                    }
                                    passes++;
                                }
                            }

                            // Update war score
                            const warScoreDelta = frictionResult.warScoreDelta || 0;
                            const orientedAdvanceDelta = playerSide === 'attacker'
                                ? (frictionResult.advanceDelta || 0)
                                : -(frictionResult.advanceDelta || 0);
                            frontAdvanceDeltas[f.id] = (frontAdvanceDeltas[f.id] || 0) + orientedAdvanceDelta;

                            // Front war score now directly affects nation war score (player perspective).
                            const enemyId = playerSide === 'attacker' ? f.defenderId : f.attackerId;
                            if (enemyId && warScoreDelta !== 0) {
                                nationWarScoreDeltaByEnemyId[enemyId] = (nationWarScoreDeltaByEnemyId[enemyId] || 0) + warScoreDelta;
                            }

                            // Update friction log (keep last 10 entries)
                            const frictionLog = [...(f.frictionLog || []), ...frictionResult.events].slice(-10);

                            // Auto-plunder: friction event may automatically destroy an enemy resource node
                            const mergedEconomicDamage = {
                                supplyLineDamage: Number(f.economicDamageBreakdown?.supplyLineDamage || 0) + Number(frictionResult.economicDamage?.supplyLineDamage || 0),
                                productionLoss: Number(f.economicDamageBreakdown?.productionLoss || 0) + Number(frictionResult.economicDamage?.productionLoss || 0),
                                infrastructureLoss: Number(f.economicDamageBreakdown?.infrastructureLoss || 0) + Number(frictionResult.economicDamage?.infrastructureLoss || 0),
                                civilianPressure: Number(f.economicDamageBreakdown?.civilianPressure || 0) + Number(frictionResult.economicDamage?.civilianPressure || 0),
                            };
                            const warScoreBreakdown = {
                                battle: Number(f.warScoreBreakdown?.battle || 0),
                                advance: Number(f.warScoreBreakdown?.advance || 0) + Number(frictionResult.warScoreBreakdown?.advance || 0),
                                economic: Number(f.warScoreBreakdown?.economic || 0) + Number(frictionResult.warScoreBreakdown?.economic || 0),
                                homeland: Number(f.warScoreBreakdown?.homeland || 0),
                            };
                            let updatedFront = {
                                ...f,
                                warScore: Math.max(-200, Math.min(200, getWarScoreBreakdownTotal(warScoreBreakdown))),
                                frictionLog,
                                economicDamageBreakdown: mergedEconomicDamage,
                                warScoreBreakdown,
                            };
                            if (frictionResult.autoPlunderNodeId) {
                                const plunderSide = playerSide || 'attacker';
                                const plunderResult = plunderResourceNode(updatedFront, frictionResult.autoPlunderNodeId, plunderSide, 1.0);
                                updatedFront = plunderResult.front;
                                // Sync building destruction
                                if (plunderResult.destruction) {
                                    const { buildingId, ownerId } = plunderResult.destruction;
                                    const buildingName = getBuildingDisplayName(buildingId);
                                    if (ownerId === 'player') {
                                        buildingDestructionQueue.push({ buildingId, count: 1 });
                                    } else {
                                        aiNationBuildingDestruction.push({ nationId: ownerId, buildingId, count: 1 });
                                    }
                                    frictionLog.push({ text: `前线破袭摧毁了一处${buildingName}`, day: currentDay });
                                }
                            }

                            // Reverse auto-plunder: AI plunders player resource node
                            if (frictionResult.reverseAutoPlunderNodeId) {
                                const enemySideForPlunder = playerSide === 'attacker' ? 'defender' : 'attacker';
                                const revPlunderResult = plunderResourceNode(updatedFront, frictionResult.reverseAutoPlunderNodeId, enemySideForPlunder, 1.0);
                                updatedFront = revPlunderResult.front;
                                if (revPlunderResult.loot && Object.keys(revPlunderResult.loot).length > 0) {
                                    reverseNodePlunderQueue.push({ loot: revPlunderResult.loot });
                                }
                                if (revPlunderResult.destruction) {
                                    const { buildingId, ownerId } = revPlunderResult.destruction;
                                    const buildingName = getBuildingDisplayName(buildingId);
                                    if (ownerId === 'player') {
                                        buildingDestructionQueue.push({ buildingId, count: 1 });
                                    } else {
                                        aiNationBuildingDestruction.push({ nationId: ownerId, buildingId, count: 1 });
                                    }
                                    frictionLog.push({ text: `敌军破袭摧毁了我方一处${buildingName}`, day: currentDay });
                                }
                            }

                            updatedFront = {
                                ...updatedFront,
                                lastResolvedFactors: (frictionResult.factors || []).slice(0, 4),
                                frontDailySummary: [
                                    ...((updatedFront.frontDailySummary || []).slice(-29)),
                                    {
                                        day: currentDay,
                                        lineVelocity: Number((frictionResult.advanceDelta || 0).toFixed(2)),
                                        phase: updatedFront.phase,
                                        contestedZone: updatedFront.contestedZone,
                                        supplyState: updatedFront.supplyState?.player || '稳定',
                                        pressure: updatedFront.pressure || 50,
                                        factors: (frictionResult.factors || []).slice(0, 4),
                                    },
                                ],
                            };

                            // Log friction event
                            if (frictionResult.events.length > 0) {
                                battleLogs.push(`战线摩擦：${frictionResult.events[0].text}（我方损失${frictionResult.casualties.player}，敌方损失${frictionResult.casualties.enemy}）`);
                            }

                            // [NEW] 持续财富掠夺：用实际敌方财富计算（玩家→AI方向）
                            const enemyIdForPlunder = playerSide === 'attacker' ? f.defenderId : f.attackerId;
                            const enemyNationForPlunder = (current.nations || []).find(n => n.id === enemyIdForPlunder);
                            if (enemyNationForPlunder) {
                                // Calculate force ratio for plunder amplification
                                const pTotal = pCorps.reduce((s, c) => s + Object.values(c.units || {}).reduce((a, b) => a + (b || 0), 0), 0);
                                const eTotal = eCorps.reduce((s, c) => s + Object.values(c.units || {}).reduce((a, b) => a + (b || 0), 0), 0);
                                const plunderUnitRatio = eTotal > 0 ? pTotal / eTotal : (pTotal > 0 ? 5.0 : 0.2);
                                const actualPlunder = calculateWarPlunder({
                                    targetWealth: enemyNationForPlunder.wealth || 0,
                                    linePosition: updatedFront.linePosition || f.linePosition || 50,
                                    side: playerSide === 'attacker' ? 'defender' : 'attacker',
                                    raidMod: 1.0,
                                    unitRatio: plunderUnitRatio,
                                });
                                if (actualPlunder.wealthPlundered > 0) {
                                    frictionPlunderQueue.push({
                                        enemyId: enemyIdForPlunder,
                                        wealthPlundered: actualPlunder.wealthPlundered,
                                        wealthGained: actualPlunder.wealthGained,
                                    });
                                }

                                // [NEW] Reverse plunder: AI plunders player silver (defenderPlunder direction)
                                const reverseUnitRatio = eTotal > 0 && pTotal > 0 ? eTotal / pTotal : (eTotal > 0 ? 5.0 : 0.2);
                                const reversePlunder = calculateWarPlunder({
                                    targetWealth: current.resources?.silver || 0,
                                    linePosition: updatedFront.linePosition || f.linePosition || 50,
                                    side: playerSide,
                                    raidMod: 1.0,
                                    unitRatio: reverseUnitRatio,
                                    efficiencyOverride: WAR_ECONOMY.REVERSE_PLUNDER_EFFICIENCY,
                                });
                                if (reversePlunder.wealthPlundered > 0) {
                                    reversePlunderQueue.push({
                                        enemyId: enemyIdForPlunder,
                                        silverPlundered: reversePlunder.wealthPlundered,
                                        wealthGainedByEnemy: reversePlunder.wealthGained,
                                        zoneType: reversePlunder.zoneType,
                                    });
                                }
                            }

                            return updatedFront;
                        });

                        _milFrictionMs = _ap() - _milBattleStart - _milBattleRoundsMs;
                        // --- Sync friction-caused building destruction ---
                        if (buildingDestructionQueue.length > 0) {
                            setBuildings(prev => {
                                const next = { ...prev };
                                for (const { buildingId, count } of buildingDestructionQueue) {
                                    next[buildingId] = Math.max(0, (next[buildingId] || 0) - count);
                                }
                                return next;
                            });
                        }
                        if (aiNationBuildingDestruction.length > 0) {
                            setNations(prev => prev.map(n => {
                                const destructions = aiNationBuildingDestruction.filter(d => d.nationId === n.id);
                                if (destructions.length === 0) return n;
                                const newBuildings = { ...(n.economy?.buildings || {}) };
                                for (const { buildingId, count } of destructions) {
                                    newBuildings[buildingId] = Math.max(0, (newBuildings[buildingId] || 0) - count);
                                }
                                return { ...n, economy: { ...n.economy, buildings: newBuildings } };
                            }));
                        }

                        // --- [NEW] 消费战线摩擦中的持续财富掠夺 ---
                        if (frictionPlunderQueue.length > 0) {
                            // 汇总每个AI国家的掠夺
                            const plunderByEnemy = {};
                            let totalPlayerGain = 0;
                            for (const { enemyId, wealthPlundered, wealthGained } of frictionPlunderQueue) {
                                plunderByEnemy[enemyId] = (plunderByEnemy[enemyId] || 0) + wealthPlundered;
                                totalPlayerGain += wealthGained;
                            }
                            // 扣减AI财富
                            if (Object.keys(plunderByEnemy).length > 0) {
                                setNations(prev => prev.map(n => {
                                    const loss = plunderByEnemy[n.id];
                                    if (!loss) return n;
                                    return { ...n, wealth: Math.max(100, Math.round((n.wealth || 500) - loss)) };
                                }));
                            }
                            // 增加玩家银币
                            if (totalPlayerGain > 1) {
                                const gain = Math.floor(totalPlayerGain);
                                setResources(prev => ({
                                    ...prev,
                                    silver: (prev.silver || 0) + gain,
                                }));
                                battleLogs.push(`💰 从敌方经济区持续掠夺${gain}银币`);
                            }
                        }

                        // --- [NEW] 消费反向掠夺：AI掠夺玩家银币和实物资源 ---
                        if (reversePlunderQueue.length > 0) {
                            let totalSilverLoss = 0;
                            let totalWealthGainByEnemy = {};
                            for (const { enemyId, silverPlundered, wealthGainedByEnemy, zoneType } of reversePlunderQueue) {
                                totalSilverLoss += silverPlundered;
                                totalWealthGainByEnemy[enemyId] = (totalWealthGainByEnemy[enemyId] || 0) + wealthGainedByEnemy;
                            }

                            // Apply silver floor protection
                            const currentSilver = current.resources?.silver || 0;
                            const silverFloor = currentSilver * WAR_ECONOMY.PLUNDER_SILVER_FLOOR_RATIO;
                            const maxSilverLoss = Math.max(0, currentSilver - silverFloor);
                            const actualSilverLoss = Math.min(totalSilverLoss, maxSilverLoss);
                            const silverDeficit = totalSilverLoss - actualSilverLoss;

                            if (actualSilverLoss > 1) {
                                setResources(prev => ({
                                    ...prev,
                                    silver: Math.max(0, (prev.silver || 0) - Math.floor(actualSilverLoss)),
                                }));
                                battleLogs.push(`💸 敌军掠夺了我方 ${Math.floor(actualSilverLoss)} 银币`);
                            }

                            // If silver was insufficient, plunder physical resources instead
                            if (silverDeficit > 0) {
                                const bestZoneType = reversePlunderQueue.find(r => r.zoneType === 'capital')?.zoneType || 'economic';
                                const resourceResult = calculateResourcePlunder({
                                    resourceInventory: current.resources || {},
                                    zoneType: bestZoneType,
                                    efficiencyOverride: WAR_ECONOMY.REVERSE_PLUNDER_EFFICIENCY,
                                    nationPrices: current.nationPrices || {},
                                });
                                if (Object.keys(resourceResult.resourcesPlundered).length > 0) {
                                    setResources(prev => {
                                        const next = { ...prev };
                                        for (const [type, amount] of Object.entries(resourceResult.resourcesPlundered)) {
                                            next[type] = Math.max(0, (next[type] || 0) - Math.floor(amount));
                                        }
                                        return next;
                                    });
                                    const lootDesc = Object.entries(resourceResult.resourcesPlundered)
                                        .map(([type, amount]) => `${Math.floor(amount)} ${type}`)
                                        .join('、');
                                    battleLogs.push(`💸 敌军掠夺了我方 ${lootDesc}`);
                                    // Add wealth equivalent to enemy AI
                                    for (const enemyId of Object.keys(totalWealthGainByEnemy)) {
                                        totalWealthGainByEnemy[enemyId] += resourceResult.totalWealthEquivalent * WAR_ECONOMY.PLUNDER_GAIN_RATIO / Object.keys(totalWealthGainByEnemy).length;
                                    }
                                }
                            }

                            // Increase enemy AI wealth
                            if (Object.keys(totalWealthGainByEnemy).length > 0) {
                                setNations(prev => prev.map(n => {
                                    const gain = totalWealthGainByEnemy[n.id];
                                    if (!gain) return n;
                                    return { ...n, wealth: Math.round((n.wealth || 500) + gain) };
                                }));
                            }
                        }

                        // --- [NEW] 消费反向资源节点掠夺：AI掠夺玩家资源节点 ---
                        if (reverseNodePlunderQueue.length > 0) {
                            const totalLoot = {};
                            for (const { loot } of reverseNodePlunderQueue) {
                                for (const [type, amount] of Object.entries(loot)) {
                                    totalLoot[type] = (totalLoot[type] || 0) + amount;
                                }
                            }
                            if (Object.keys(totalLoot).length > 0) {
                                setResources(prev => {
                                    const next = { ...prev };
                                    for (const [type, amount] of Object.entries(totalLoot)) {
                                        next[type] = Math.max(0, (next[type] || 0) - Math.floor(amount));
                                    }
                                    return next;
                                });
                                const lootDesc = Object.entries(totalLoot)
                                    .map(([type, amount]) => `${type} ×${Math.floor(amount)}`)
                                    .join('、');
                                battleLogs.push(`🏚️ 敌军掠夺了我方 ${lootDesc}`);
                            }
                        }

                        // --- Core zone population loss: when enemy pushes into capital zone ---
                        updatedFronts.forEach(front => {
                            if (front.status !== 'active') return;
                            const playerSide = getPlayerSide(front);
                            if (!playerSide) return;
                            const linePos = front.linePosition || 50;
                            let popLossRate = 0;
                            if (playerSide === 'attacker' && linePos < 15) {
                                popLossRate = 0.005 * ((15 - linePos) / 15);
                            } else if (playerSide === 'defender' && linePos > 85) {
                                popLossRate = 0.005 * ((linePos - 85) / 15);
                            }
                            if (popLossRate > 0) {
                                const currentPop = current.population || 1000;
                                const popLoss = Math.max(1, Math.floor(currentPop * popLossRate));
                                setPopulation(prev => reducePopulationWithFloor(prev, popLoss));
                                battleLogs.push(`💀 战火蔓延至我方核心区，平民伤亡 ${popLoss} 人`);
                            }
                            // Also apply pop loss to AI if we push into their core
                            const enemyId = playerSide === 'attacker' ? front.defenderId : front.attackerId;
                            let aiPopLossRate = 0;
                            if (playerSide === 'attacker' && linePos > 85) {
                                aiPopLossRate = 0.005 * ((linePos - 85) / 15);
                            } else if (playerSide === 'defender' && linePos < 15) {
                                aiPopLossRate = 0.005 * ((15 - linePos) / 15);
                            }
                            if (aiPopLossRate > 0 && enemyId) {
                                setNations(prev => prev.map(n => {
                                    if (n.id !== enemyId) return n;
                                    const aiPopLoss = Math.max(1, Math.floor((n.population || 1000) * aiPopLossRate));
                                    return { ...n, population: reducePopulationWithFloor((n.population || 1000), aiPopLoss) };
                                }));
                            }
                        });

                        // --- Process line advancement and war-front consistency ---
                        const warEconomyDamages = []; // 收集 processFrontAdvance 产生的战争经济伤害
                        updatedFronts = updatedFronts.map(front => {
                            if (front.status !== 'active') return front;
                            const playerSide = getPlayerSide(front);
                            const attackerCorps = (front.assignedCorps?.attacker || [])
                                .map(id => updatedCorps.find(c => c.id === id))
                                .filter(Boolean);
                            const defenderCorps = (front.assignedCorps?.defender || [])
                                .map(id => updatedCorps.find(c => c.id === id))
                                .filter(Boolean);

                            // Determine buildings for each side
                            const attackerNationId = front.attackerId;
                            const defenderNationId = front.defenderId;
                            const attackerBuildings = attackerNationId === 'player'
                                ? (current.buildings || {})
                                : ((current.nations || []).find(n => n.id === attackerNationId)?.economy?.buildings || {});
                            const defenderBuildings = defenderNationId === 'player'
                                ? (current.buildings || {})
                                : ((current.nations || []).find(n => n.id === defenderNationId)?.economy?.buildings || {});

                            const attackerNation = (current.nations || []).find(n => n.id === front.attackerId);
                            const defenderNation = (current.nations || []).find(n => n.id === front.defenderId);
                            const advancedFront = processFrontAdvance(
                                {
                                    ...front,
                                    playerResources: current.resources || {},
                                    epoch: current.epoch || 0,
                                    sideResources: {
                                        attacker: front.attackerId === 'player' ? (current.resources || {}) : (attackerNation?.military?.stockpile || {}),
                                        defender: front.defenderId === 'player' ? (current.resources || {}) : (defenderNation?.military?.stockpile || {}),
                                    },
                                },
                                attackerCorps,
                                defenderCorps,
                                currentDay,
                                frontAdvanceDeltas[front.id] || 0,
                                attackerBuildings,
                                defenderBuildings
                            );
                            const resolvedSummary = summarizeFrontState(advancedFront, attackerCorps, defenderCorps);

                            // [NEW] 收集战争经济伤害（建筑破坏、人口流失）
                            if (advancedFront.warEconomyDamage) {
                                warEconomyDamages.push(advancedFront.warEconomyDamage);
                            }

                            const lineShift = (advancedFront.linePosition || 0) - (front.linePosition || 0);
                            const playerAdvance = playerSide === 'attacker' ? lineShift : -lineShift;
                            const playerRelativePosition = playerSide === 'attacker'
                                ? Number(advancedFront.linePosition || 50)
                                : 100 - Number(advancedFront.linePosition || 50);
                            const totalFrontUnits = attackerCorps.reduce((sum, corps) => sum + Object.values(corps?.units || {}).reduce((s, c) => s + (c || 0), 0), 0)
                                + defenderCorps.reduce((sum, corps) => sum + Object.values(corps?.units || {}).reduce((s, c) => s + (c || 0), 0), 0);
                            const homelandPressure = getBoundedHomelandPressure(playerRelativePosition);
                            let occupationDelta = 0;
                            let nextOccupationScoreDay = Number(advancedFront.lastOccupationScoreDay || advancedFront.startDay || currentDay);
                            if (advancedFront?.status === 'active' && totalFrontUnits > 0) {
                                let occupationInterval = null;
                                if (playerRelativePosition >= 85) {
                                    occupationDelta = 1;
                                    occupationInterval = 4;
                                } else if (playerRelativePosition >= 65) {
                                    occupationDelta = 1;
                                    occupationInterval = 6;
                                } else if (playerRelativePosition >= 50) {
                                    occupationDelta = 1;
                                    occupationInterval = 10;
                                } else if (playerRelativePosition <= 15) {
                                    occupationDelta = -1;
                                    occupationInterval = 4;
                                } else if (playerRelativePosition <= 35) {
                                    occupationDelta = -1;
                                    occupationInterval = 6;
                                } else if (playerRelativePosition < 50) {
                                    occupationDelta = -1;
                                    occupationInterval = 10;
                                }

                                if (!occupationInterval || currentDay - nextOccupationScoreDay < occupationInterval) {
                                    occupationDelta = 0;
                                } else {
                                    nextOccupationScoreDay = currentDay;
                                }
                            }
                            // Convert strategic line movement into nation war score drift:
                            // front movement is only a light source of war score; occupation is the main slow source.
                            if (playerSide && advancedFront?.status === 'active') {
                                const enemyId = playerSide === 'attacker' ? advancedFront.defenderId : advancedFront.attackerId;
                                const strategicDelta = Math.trunc(playerAdvance / 18) + occupationDelta;
                                if (enemyId && strategicDelta !== 0) {
                                    nationWarScoreDeltaByEnemyId[enemyId] = (nationWarScoreDeltaByEnemyId[enemyId] || 0) + strategicDelta;
                                }
                            }
                            // Advance score natural decay: when player has recovered territory,
                            // old negative advance score should decay toward 0 (and vice versa)
                            let rawAdvance = Number(advancedFront.warScoreBreakdown?.advance || 0) + Math.trunc(playerAdvance / 18) + occupationDelta;
                            // Decay rate: 2% per tick when position contradicts score, 0.5% passive decay
                            if (rawAdvance < 0 && playerRelativePosition >= 50) {
                                // Player recovered but advance is still negative → accelerate decay
                                const decayRate = playerRelativePosition >= 65 ? 0.04 : 0.02;
                                rawAdvance = Math.min(0, rawAdvance + Math.max(1, Math.abs(rawAdvance) * decayRate));
                            } else if (rawAdvance > 0 && playerRelativePosition < 50) {
                                // Player losing ground but advance is positive → decay
                                const decayRate = playerRelativePosition <= 35 ? 0.04 : 0.02;
                                rawAdvance = Math.max(0, rawAdvance - Math.max(1, Math.abs(rawAdvance) * decayRate));
                            } else if (Math.abs(rawAdvance) > 5) {
                                // Passive decay: 0.5% toward 0
                                const passiveDecay = Math.max(0.5, Math.abs(rawAdvance) * 0.005);
                                rawAdvance = rawAdvance > 0
                                    ? rawAdvance - passiveDecay
                                    : rawAdvance + passiveDecay;
                            }
                            const nextWarScoreBreakdown = {
                                battle: Number(advancedFront.warScoreBreakdown?.battle || 0),
                                advance: Math.round(rawAdvance),
                                economic: Number(advancedFront.warScoreBreakdown?.economic || 0),
                                homeland: -homelandPressure,
                            };
                            return {
                                ...advancedFront,
                                lastOccupationScoreDay: nextOccupationScoreDay,
                                pressure: resolvedSummary.pressure,
                                supplyState: resolvedSummary.supplyState,
                                sideState: resolvedSummary.sideState,
                                raidIntensity: resolvedSummary.raidIntensity,
                                entrenchment: resolvedSummary.entrenchment,
                                contestedZone: resolvedSummary.contestedZone,
                                warScore: Math.max(-500, Math.min(500, getWarScoreBreakdownTotal(nextWarScoreBreakdown))),
                                warScoreBreakdown: nextWarScoreBreakdown,
                                economicDamageBreakdown: {
                                    supplyLineDamage: Number(advancedFront.economicDamageBreakdown?.supplyLineDamage || 0),
                                    productionLoss: Number(advancedFront.economicDamageBreakdown?.productionLoss || 0),
                                    infrastructureLoss: Number(advancedFront.economicDamageBreakdown?.infrastructureLoss || 0),
                                    civilianPressure: Math.max(0, Math.round(Math.abs(homelandPressure))),
                                },
                            };
                        });

                        // --- [NEW] 消费 processFrontAdvance 产生的战争经济伤害 ---
                        if (warEconomyDamages.length > 0) {
                            const playerBuildingDamage = {};   // 玩家建筑破坏
                            const aiDamages = {};              // AI国家经济损伤
                            const aiBuildingDamage = {};       // AI国家建筑破坏
                            let playerPopLoss = 0;
                            let playerWealthGain = 0;          // 玩家掠夺获益

                            for (const dmg of warEconomyDamages) {
                                if (!dmg) continue;
                                const victimId = dmg.victimId;

                                if (victimId === 'player') {
                                    // 玩家侧建筑破坏
                                    for (const [bId, cnt] of Object.entries(dmg.destroyedBuildings || {})) {
                                        playerBuildingDamage[bId] = (playerBuildingDamage[bId] || 0) + cnt;
                                    }
                                    // 玩家人口流失
                                    if (dmg.populationLossRate > 0) {
                                        playerPopLoss += Math.floor((current.population || 1000) * dmg.populationLossRate);
                                    }
                                } else if (victimId) {
                                    // AI侧经济损伤
                                    if (!aiDamages[victimId]) aiDamages[victimId] = { wealthLoss: 0, milStrLoss: 0 };
                                    aiDamages[victimId].wealthLoss += (dmg.wealthLoss || 0);
                                    aiDamages[victimId].milStrLoss += (dmg.milStrLoss || 0);
                                    if (!aiBuildingDamage[victimId]) aiBuildingDamage[victimId] = {};
                                    for (const [bId, cnt] of Object.entries(dmg.destroyedBuildings || {})) {
                                        aiBuildingDamage[victimId][bId] = (aiBuildingDamage[victimId][bId] || 0) + cnt;
                                    }
                                    // 玩家获得掠夺收益（通过建筑破坏间接获益的部分，这里取AI财富损失的60%）
                                    if (dmg.wealthLoss > 0) {
                                        playerWealthGain += dmg.wealthLoss * 0.6;
                                    }
                                }
                            }

                            // 应用玩家建筑破坏
                            if (Object.keys(playerBuildingDamage).length > 0) {
                                setBuildings(prev => {
                                    const next = { ...prev };
                                    for (const [bId, cnt] of Object.entries(playerBuildingDamage)) {
                                        next[bId] = Math.max(0, (next[bId] || 0) - cnt);
                                    }
                                    return next;
                                });
                                const damagedNames = Object.keys(playerBuildingDamage).map(bId => getBuildingDisplayName(bId)).filter(Boolean);
                                if (damagedNames.length > 0) {
                                    battleLogs.push(`🔥 战线推进破坏了我方建筑：${damagedNames.join('、')}`);
                                }
                            }

                            // 应用AI经济损伤
                            if (Object.keys(aiDamages).length > 0 || Object.keys(aiBuildingDamage).length > 0) {
                                setNations(prev => prev.map(n => {
                                    const dmg = aiDamages[n.id];
                                    const buildingDamage = aiBuildingDamage[n.id] || {};
                                    if (!dmg && Object.keys(buildingDamage).length === 0) return n;
                                    const newBuildings = { ...(n.economy?.buildings || {}) };
                                    for (const [buildingId, count] of Object.entries(buildingDamage)) {
                                        newBuildings[buildingId] = Math.max(0, (newBuildings[buildingId] || 0) - count);
                                    }
                                    return {
                                        ...n,
                                        wealth: Math.max(100, Math.round((n.wealth || 500) - (dmg?.wealthLoss || 0))),
                                        militaryStrength: Math.max(0.25, (n.militaryStrength ?? 1.0) - (dmg?.milStrLoss || 0)),
                                        economy: {
                                            ...n.economy,
                                            buildings: newBuildings,
                                        },
                                    };
                                }));
                            }

                            // 应用玩家人口流失
                            if (playerPopLoss > 0) {
                                setPopulation(prev => reducePopulationWithFloor(prev, playerPopLoss));
                                battleLogs.push(`💀 战线推进造成平民伤亡，人口损失${playerPopLoss}`);
                            }

                            // 应用玩家掠夺获益
                            if (playerWealthGain > 1) {
                                const gain = Math.floor(playerWealthGain);
                                setResources(prev => ({
                                    ...prev,
                                    silver: (prev.silver || 0) + gain,
                                }));
                                battleLogs.push(`💰 从敌方战区掠夺${gain}银币`);
                            }
                        }

                        // Collapse active fronts if the nation is no longer at war with player.
                        updatedFronts = updatedFronts.map(front => {
                            if (front.status !== 'active') return front;
                            const enemyId = front.attackerId === 'player' ? front.defenderId : front.attackerId;
                            const enemyNation = (current.nations || []).find(n => n.id === enemyId);
                            if (!enemyNation || enemyNation.isAtWar !== true) {
                                return { ...front, status: 'collapsed' };
                            }
                            return front;
                        });

                        // Rebuild missing fronts for nations already at war with player.
                        const activeFrontEnemyIds = new Set(
                            updatedFronts
                                .filter(front => front.status === 'active' && (front.attackerId === 'player' || front.defenderId === 'player'))
                                .map(front => (front.attackerId === 'player' ? front.defenderId : front.attackerId))
                        );
                        const missingFrontWars = (current.nations || []).filter(n => n?.isAtWar === true && !activeFrontEnemyIds.has(n.id));
                        if (missingFrontWars.length > 0) {
                            const playerEco = {
                                resources: current.resources || {},
                                buildings: current.buildings || {},
                                population: current.population || 0,
                                wealth: current.resources?.silver || 0,
                            };
                            missingFrontWars.forEach(enemyNation => {
                                const enemyEco = {
                                    resources: {},
                                    buildings: {},
                                    population: enemyNation.population || enemyNation.militaryPower || 200,
                                    wealth: enemyNation.wealth || 500,
                                };
                                const rebuiltFront = generateFront(enemyNation.id, 'player', current.epoch || 0, enemyEco, playerEco);
                                rebuiltFront.createdDay = currentDay;
                                rebuiltFront.startDay = currentDay;
                                updatedFronts.push(rebuiltFront);
                                battleLogs.push('[战线修复] 已为 ' + enemyNation.name + ' 自动补建战线。');
                            });
                        }

                        // Recover player corps that still points to inactive/missing fronts after wars ended.
                        const activeFrontIdSet = new Set(
                            updatedFronts
                                .filter(front => front?.status === 'active')
                                .map(front => front.id)
                        );
                        // 收集活跃会战中的兵团 ID，用于判断 in_combat 是否合法（支持多兵团）
                        const activeBattleCorpsSet = new Set(
                            (updatedBattles || [])
                                .filter(b => b?.status === 'active')
                                .flatMap(b => [
                                    b?.attacker?.corpsId,
                                    b?.defender?.corpsId,
                                    ...(b?.attacker?.corpsIds || []),
                                    ...(b?.defender?.corpsIds || []),
                                ])
                                .filter(Boolean)
                        );
                        const recoveredCorpsIds = new Set(); // 记录被恢复为 idle 的兵团 ID
                        updatedCorps = updatedCorps.map(corps => {
                            if (!corps || corps.isAI) return corps;
                            const frontId = corps.assignedFrontId;
                            const hasActiveFront = frontId ? activeFrontIdSet.has(frontId) : false;
                            const shouldRecoverFromInvalidFront = frontId && !hasActiveFront;
                            const shouldRecoverFromOrphanDeployed = !frontId && corps.status === 'deployed';
                            // [FIX] 没有 assignedFrontId 且不在活跃会战中的 in_combat 兵团应恢复为 idle
                            const isOrphanCombat = !frontId && corps.status === 'in_combat' && !activeBattleCorpsSet.has(corps.id);
                            if (!shouldRecoverFromInvalidFront && !shouldRecoverFromOrphanDeployed && !isOrphanCombat) {
                                return corps;
                            }
                            // 仅在兵团不在活跃会战中时才恢复状态
                            const inActiveBattle = activeBattleCorpsSet.has(corps.id);
                            if (!inActiveBattle) {
                                recoveredCorpsIds.add(corps.id);
                            }
                            return {
                                ...corps,
                                status: inActiveBattle ? 'in_combat' : 'idle',
                                assignedFrontId: inActiveBattle ? corps.assignedFrontId : null,
                            };
                        });
                        // [FIX] 从 front.assignedCorps 中清理已被恢复为 idle 的兵团幽灵引用
                        if (recoveredCorpsIds.size > 0) {
                            updatedFronts = updatedFronts.map(front => {
                                if (!front) return front;
                                const pruneSide = (list = []) => list.filter(id => !recoveredCorpsIds.has(id));
                                const newAttacker = pruneSide(front.assignedCorps?.attacker);
                                const newDefender = pruneSide(front.assignedCorps?.defender);
                                if (newAttacker.length === (front.assignedCorps?.attacker || []).length &&
                                    newDefender.length === (front.assignedCorps?.defender || []).length) {
                                    return front; // 无变化
                                }
                                return {
                                    ...front,
                                    assignedCorps: {
                                        attacker: newAttacker,
                                        defender: newDefender,
                                    },
                                };
                            });
                        }
                        updatedCorps = updatedCorps.map((corps) => {
                            if (!corps) return corps;
                            const totalUnits = getCorpsTotalUnits(corps);
                            if (totalUnits <= 0) {
                                return {
                                    ...corps,
                                    status: 'destroyed',
                                    assignedFrontId: null,
                                };
                            }
                            // [FIX] 仅依赖 activeBattleCorpsSet 判断是否在战斗中，
                            // 不再用旧的 corps.status === 'in_combat' 避免状态死循环
                            const isInCombat = activeBattleCorpsSet.has(corps.id);
                            const isOnFront = Boolean(corps.assignedFrontId);

                            // 补给不足 → 缓慢掉士气
                            let moraleDelta = 0;
                            if (isOnFront) {
                                const corpsOnFront = updatedFronts.find(f => f?.id === corps.assignedFrontId);
                                let supplyRatio = 1;
                                if (corpsOnFront) {
                                    const corpsSide = corps.isAI
                                        ? (corpsOnFront.attackerId === corps.nationId ? 'attacker' : corpsOnFront.defenderId === corps.nationId ? 'defender' : null)
                                        : (corpsOnFront.attackerId === 'player' ? 'attacker' : corpsOnFront.defenderId === 'player' ? 'defender' : null);
                                    supplyRatio = Number(
                                        corpsSide
                                            ? (corpsOnFront.sideState?.[corpsSide]?.supplyRatio ?? 1)
                                            : (corpsOnFront.supplyState?.playerRatio ?? 1)
                                    );
                                }
                                if (supplyRatio < 0.85) {
                                    // 补给率 < 85% 开始掉士气，越低掉越快（最多每 tick -10）
                                    moraleDelta = -Math.ceil((0.85 - supplyRatio) * 12);
                                }
                            } else {

                                // 待命军团缓慢恢复士气
                                moraleDelta = corps.morale < 100 ? 2 : 0;
                            }

                            // [FIX Bug5] 欠饷被动士气衰减：每 tick -3 ~ -6（视支付比例而定）
                            if (!corps.isAI) {
                                const milExpense = current.dailyMilitaryExpense;
                                if (milExpense?.isUnderPaid) {
                                    const payRatio = milExpense.payRatio ?? 0;
                                    // payRatio=0 → -6/tick，payRatio=0.5 → -3/tick
                                    moraleDelta -= Math.ceil((1 - payRatio) * 6);
                                }
                            }

                            return {
                                ...corps,
                                // [FIX] 战斗中以 activeBattleCorpsSet 为准；
                                // 不在战斗中时，若旧状态是 in_combat/destroyed，恢复为正确状态
                                status: isInCombat
                                    ? 'in_combat'
                                    : (corps.status === 'in_combat' || corps.status === 'destroyed')
                                        ? (isOnFront ? 'deployed' : 'idle')
                                        : corps.status,
                                morale: Math.max(10, Math.min(100, (corps.morale ?? 100) + moraleDelta)),
                            };
                        });

                        // [FIX] 仅清理已部署到前线或属于 AI 的空兵团；
                        // 玩家未部署的 idle 空兵团保留，给玩家时间分配兵力
                        const removedCorpsIds = new Set(
                            updatedCorps
                                .filter((corps) => {
                                    if (!corps) return true;
                                    if (getCorpsTotalUnits(corps) > 0) return false;
                                    // AI 兵团空了直接清理
                                    if (corps.isAI) return true;
                                    // 玩家兵团：仅清理已部署到前线的空兵团（战损殆尽）
                                    // 未部署(idle)的空兵团是玩家刚创建的，保留
                                    return !!corps.assignedFrontId;
                                })
                                .map((corps) => corps?.id)
                                .filter(Boolean)
                        );
                        if (removedCorpsIds.size > 0) {
                            updatedCorps = updatedCorps.filter((corps) => corps && !removedCorpsIds.has(corps.id));
                            updatedFronts = updatedFronts.map((front) => {
                                if (!front) return front;
                                const pruneList = (list = []) => list.filter((id) => !removedCorpsIds.has(id));
                                return {
                                    ...front,
                                    assignedCorps: {
                                        attacker: pruneList(front.assignedCorps?.attacker),
                                        defender: pruneList(front.assignedCorps?.defender),
                                    },
                                    frontlineCorpsOrder: {
                                        attacker: pruneList(front.frontlineCorpsOrder?.attacker),
                                        defender: pruneList(front.frontlineCorpsOrder?.defender),
                                    },
                                };
                            });
                            updatedGenerals = updatedGenerals.map((general) => (
                                removedCorpsIds.has(general?.assignedCorpsId)
                                    ? { ...general, assignedCorpsId: null }
                                    : general
                            ));
                        }

                        // Apply aggregated frontline war-score impact to nation-level warScore.
                        if (Object.keys(nationWarScoreDeltaByEnemyId).length > 0) {
                            setNations(prev => prev.map(n => {
                                const delta = nationWarScoreDeltaByEnemyId[n.id] || 0;
                                if (!delta) return n;
                                return {
                                    ...n,
                                    warScore: (n.warScore || 0) + delta,
                                };
                            }));
                        }

                        // --- Apply all state updates ---
                        setActiveBattles(updatedBattles);
                        setActiveFronts(updatedFronts);
                        if (updatedCorps !== currentCorps) setMilitaryCorps(updatedCorps);
                        if (updatedGenerals !== currentGenerals) setGenerals(updatedGenerals);
                        if (updatedArmyFromBattle) setArmy(updatedArmyFromBattle);

                        // Merge corps losses into replenish queue (battle + friction combined)
                        if (Object.keys(pendingCorpsLossUpdates).length > 0) {
                            effectiveCorpsReplenishQueue = mergeCorpsReplenishQueue(
                                effectiveCorpsReplenishQueue,
                                pendingCorpsLossUpdates,
                                updatedCorps
                            );
                            setCorpsReplenishQueue(effectiveCorpsReplenishQueue);
                        }

                        // [FIX] Sync stateRef immediately to prevent stale reads in fast ticks
                        stateRef.current.activeBattles = updatedBattles;
                        stateRef.current.activeFronts = updatedFronts;
                        stateRef.current.militaryCorps = updatedCorps;
                        stateRef.current.generals = updatedGenerals;
                        stateRef.current.corpsReplenishQueue = effectiveCorpsReplenishQueue;
                        current.corpsReplenishQueue = effectiveCorpsReplenishQueue;
                        if (updatedArmyFromBattle) stateRef.current.army = updatedArmyFromBattle;

                        // Log battle events
                        if (battleLogs.length > 0) {
                            battleLogs.forEach(log => addLog(log));
                        }

                    }

                    // [FIX-Bug8] ÿ tick 检查是否有交战国缺少战线，即使当前无活跃会战/战线也执行
                    {
                        const activeFrontEnemyIds = new Set(
                            updatedFronts
                                .filter(front => front.status === 'active' && (front.attackerId === 'player' || front.defenderId === 'player'))
                                .map(front => (front.attackerId === 'player' ? front.defenderId : front.attackerId))
                        );
                        const missingFrontWars = (current.nations || []).filter(n => n?.isAtWar === true && !activeFrontEnemyIds.has(n.id));
                        if (missingFrontWars.length > 0) {
                            const playerEco = {
                                resources: current.resources || {},
                                buildings: current.buildings || {},
                                population: current.population || 0,
                                wealth: current.resources?.silver || 0,
                            };
                            missingFrontWars.forEach(enemyNation => {
                                const enemyEco = {
                                    resources: {},
                                    buildings: {},
                                    population: enemyNation.population || enemyNation.militaryPower || 200,
                                    wealth: enemyNation.wealth || 500,
                                };
                                const rebuiltFront = generateFront(enemyNation.id, 'player', current.epoch || 0, enemyEco, playerEco);
                                rebuiltFront.createdDay = current.daysElapsed || 0;
                                rebuiltFront.startDay = current.daysElapsed || 0;
                                updatedFronts.push(rebuiltFront);
                                addLog('[战线修复] 已为 ' + enemyNation.name + ' 自动补建战线。');
                            });
                            setActiveFronts(updatedFronts);
                            stateRef.current.activeFronts = updatedFronts;
                        }
                    }

                    // Flush ideology event bus logs and effects (outside battle if-block so it runs every tick)
                    {
                        const ideologyLogs = ideologyEventBus.flushLogs();
                        if (ideologyLogs.length > 0) {
                            ideologyLogs.forEach(log => addLog(log));
                        }
                        const ideologyEffects = ideologyEventBus.flushEffects();
                        if (ideologyEffects.length > 0) {
                            const ideologyScaling = buildIdeologyScalingContext({
                                epoch: current.epoch || 0,
                                ideologyMetrics: ideologyMetricsRef.current,
                                population: current.population || 0,
                                totalBuildings: getTotalBuildingCount(current.buildings),
                                militarySize: getTotalArmyCount(current.army, current.militaryQueue, current.militaryCorps),
                                vassalCount: (current.nations || []).filter(n => n.vassalOf === 'player' || n.isAnnexed).length,
                            });
                            for (const eff of ideologyEffects) {
                                const r = eff.result;
                                if (r.action === 'addStability' && setStability) {
                                    setStability(prev => Math.max(0, Math.min(100, prev + r.amount)));
                                } else if (r.action === 'addResource' && r.resource) {
                                    const scaledAmount = scaleLegacyResourceAmount({
                                        amount: r.amount,
                                        resource: r.resource,
                                        context: ideologyScaling,
                                        mode: 'reward',
                                    });
                                    setResources(prev => ({
                                        ...prev,
                                        [r.resource]: Math.max(0, (prev[r.resource] || 0) + scaledAmount)
                                    }), { reason: 'ideology_event_effect', ideologyId: eff.ideologyId, eventId: eff.eventId });
                                } else if (r.action === 'addBuff' && setActiveBuffs) {
                                    setActiveBuffs(prev => {
                                        const next = Array.isArray(prev) ? [...prev] : [];
                                        const buffId = r.buffId || `ideology_buff_${eff.ideologyId}_${eff.tick}`;
                                        const existingIndex = next.findIndex(buff => buff?.buffId === buffId);
                                        const payload = {
                                            buffId,
                                            name: r.name || '理念效果',
                                            duration: Math.max(1, Math.floor(r.duration || 1)),
                                            source: 'ideology',
                                            ideologyId: eff.ideologyId,
                                            ...(r.effects || {}),
                                        };
                                        if (existingIndex >= 0) {
                                            next[existingIndex] = payload;
                                        } else {
                                            next.push(payload);
                                        }
                                        return next;
                                    });
                                } else if (r.action === 'modifyBonus' && setActiveBuffs && r.bonusKey) {
                                    setActiveBuffs(prev => {
                                        const next = Array.isArray(prev) ? [...prev] : [];
                                        const buffId = `ideology_modifier_${eff.ideologyId}_${r.bonusKey}`;
                                        const existingIndex = next.findIndex(buff => buff?.buffId === buffId);
                                        const payload = {
                                            buffId,
                                            name: r.name || '理念修正',
                                            duration: Math.max(1, Math.floor(r.duration || 1)),
                                            source: 'ideology',
                                            ideologyId: eff.ideologyId,
                                            [r.bonusKey]: r.amount,
                                        };
                                        if (existingIndex >= 0) {
                                            next[existingIndex] = payload;
                                        } else {
                                            next.push(payload);
                                        }
                                        return next;
                                    });
                                } else if (r.action === 'addIdeologyScore' && setIdeologyScore) {
                                    setIdeologyScore(prev => (prev || 0) + r.amount);
                                }
                            }
                        }
                    }

                    // ========== AI Enemy Corps & Auto-Battle Logic ==========
                    {
                        const _milStart = _ap();
                        const fronts = updatedFronts;
                        const battles = updatedBattles || [];
                        const currentDay = (current.daysElapsed || 0) + 1;
                        let aiNations = [...(current.nations || [])].map((nation) => ensureAIMilitaryState(nation, current.epoch || 0));
                        const aiNationChangedIds = new Set();

                        // [PERF] 用 Map 代替反复 .map() 全量拷贝数组
                        const corpsMap = new Map(updatedCorps.map(c => [c.id, c]));
                        const generalMap = new Map(updatedGenerals.map(g => [g.id, g]));

                        aiNations = aiNations.map((nation) => {
                            if (!nation || nation.id === 'player') return nation;
                            const syncResult = syncAINationMilitary({
                                nation,
                                epoch: current.epoch || 0,
                                currentDay,
                                militaryCorps: updatedCorps,
                                generals: updatedGenerals,
                            });
                            syncResult.corps.forEach((corps) => {
                                const existing = corpsMap.get(corps.id);
                                if (existing) {
                                    corpsMap.set(corps.id, { ...existing, ...corps });
                                } else {
                                    corpsMap.set(corps.id, corps);
                                }
                            });
                            syncResult.generals.forEach((general) => {
                                if (!generalMap.has(general.id)) {
                                    generalMap.set(general.id, general);
                                }
                            });
                            aiNationChangedIds.add(syncResult.nation.id);
                            return syncResult.nation;
                        });

                        // 同步回数组
                        updatedCorps = Array.from(corpsMap.values());
                        updatedGenerals = Array.from(generalMap.values());
                        const _milSyncMs = _ap() - _milStart;

                        // [NEW] 跨战线军团调度：每个AI国家的有限军团按优先级分配到各活跃战线
                        // [PERF] 用 Map 索引代替嵌套 find/filter
                        const corpsIdxMap = new Map(updatedCorps.map(c => [c.id, c]));
                        const frontIdxMap = new Map(updatedFronts.map(f => [f.id, f]));

                        for (const nation of aiNations) {
                            if (!nation || nation.id === 'player') continue;
                            const nationActiveFronts = updatedFronts.filter(f =>
                                f.status === 'active' && (f.attackerId === nation.id || f.defenderId === nation.id)
                            );
                            if (nationActiveFronts.length === 0) continue;

                            const { allocations } = allocateAICorpsToFronts({
                                nation,
                                allCorps: updatedCorps,
                                activeFronts: nationActiveFronts,
                                epoch: current.epoch || 0,
                            });

                            updatedCorps = applyAICorpsAllocation({
                                allocations,
                                allCorps: updatedCorps,
                                nation,
                                epoch: current.epoch || 0,
                            });
                            // 刷新 Map 索引
                            updatedCorps.forEach(c => corpsIdxMap.set(c.id, c));

                            for (const [frontId, corpsIds] of Object.entries(allocations)) {
                                const f = frontIdxMap.get(frontId);
                                if (!f) continue;
                                const side = f.attackerId === nation.id ? 'attacker' : 'defender';
                                const kept = (f.assignedCorps?.[side] || []).filter(id => {
                                    const corps = corpsIdxMap.get(id);
                                    return corps && corps.nationId !== nation.id;
                                });
                                const merged = {
                                    ...f,
                                    assignedCorps: {
                                        ...f.assignedCorps,
                                        [side]: [...new Set([...kept, ...corpsIds])],
                                    },
                                };
                                frontIdxMap.set(frontId, merged);
                            }
                            aiNationChangedIds.add(nation.id);
                        }
                        updatedFronts = Array.from(frontIdxMap.values());
                        const _milAllocMs = _ap() - _milStart - _milSyncMs;

                        for (const front of fronts) {
                            if (front.status !== 'active') continue;

                            const playerSide = getPlayerSide(front);
                            if (!playerSide) continue;
                            const enemySide = getEnemySide(playerSide);
                            const enemyId = playerSide === 'attacker' ? front.defenderId : front.attackerId;
                            const enemyNation = aiNations.find(n => n.id === enemyId);
                            if (!enemyNation) continue;

                            // Get all corps on this front (both player and AI)
                            const allCorps = updatedCorps || [];
                            const enemyCorpsOnFront = allCorps.filter(c =>
                                c.isAI && c.assignedFrontId === front.id && c.nationId === enemyId
                            );
                            const playerCorpsOnFront = (front.assignedCorps?.[playerSide] || [])
                                .map(cid => allCorps.find(c => c.id === cid))
                                .filter(Boolean);
                            const idleEnemyCorps = allCorps
                                .filter(c => c.isAI && c.nationId === enemyId && !c.assignedFrontId && c.status !== 'in_combat' && Object.values(c.units || {}).reduce((sum, count) => sum + (count || 0), 0) > 0)
                                .sort((a, b) => Object.values(b.units || {}).reduce((sum, count) => sum + (count || 0), 0) - Object.values(a.units || {}).reduce((sum, count) => sum + (count || 0), 0));
                            const frontPlan = evaluateAIFrontPlan({
                                nation: enemyNation,
                                front,
                                ownCorps: enemyCorpsOnFront,
                                enemyCorps: playerCorpsOnFront,
                            });
                            const desiredEnemyCorps = frontPlan.desiredCorps;
                            const neededCorps = Math.max(0, desiredEnemyCorps - enemyCorpsOnFront.length);
                            if (neededCorps > 0 && idleEnemyCorps.length > 0) {
                                const deployedIds = idleEnemyCorps.slice(0, neededCorps).map((corps) => corps.id);
                                updatedCorps = updatedCorps.map((corps) => {
                                    if (!deployedIds.includes(corps.id)) return corps;
                                    return {
                                        ...corps,
                                        assignedFrontId: front.id,
                                        status: 'deployed',
                                        frontTask: frontPlan.taskAssignments[corps.id] || corps.frontTask || 'assault',
                                    };
                                });
                                // AI reinforcement: if there's an active battle on this front, reinforce it
                                const frontBattle = updatedBattles.find(b => b.frontId === front.id && isBattleActive(b));
                                if (frontBattle) {
                                    const aiSide = enemySide; // AI is the enemy side
                                    for (const deployedId of deployedIds) {
                                        const deployedCorps = updatedCorps.find(c => c.id === deployedId);
                                        if (deployedCorps && deployedCorps.units) {
                                            const reinforced = processReinforcement(frontBattle, aiSide, deployedCorps.units, deployedCorps);
                                            updatedBattles = updatedBattles.map(b => b.id === frontBattle.id ? reinforced : b);
                                        }
                                    }
                                    updatedCorps = updatedCorps.map(c => {
                                        if (!deployedIds.includes(c.id)) return c;
                                        return { ...c, status: 'in_combat' };
                                    });
                                }
                                updatedFronts = updatedFronts.map((f) => {
                                    if (f.id !== front.id) return f;
                                    return {
                                        ...f,
                                        aiPosture: frontPlan.posture,
                                        postures: {
                                            ...(f.postures || {}),
                                            [enemySide]: frontPlan.posture,
                                        },
                                        assignedCorps: {
                                            ...f.assignedCorps,
                                            [enemySide]: [...new Set([...(f.assignedCorps?.[enemySide] || []), ...deployedIds])],
                                        },
                                        frontlineCorpsOrder: {
                                            ...(f.frontlineCorpsOrder || {}),
                                            [enemySide]: frontPlan.frontlineCorpsOrder.length > 0 ? frontPlan.frontlineCorpsOrder : [...(f.frontlineCorpsOrder?.[enemySide] || []), ...deployedIds],
                                        },
                                        frontPlans: {
                                            ...(f.frontPlans || {}),
                                            [enemyId]: {
                                                ...frontPlan,
                                                updatedDay: currentDay,
                                            },
                                        },
                                    };
                                });
                                aiNationChangedIds.add(enemyId);
                            } else {
                                updatedCorps = updatedCorps.map((corps) => {
                                    if (!corps.isAI || corps.nationId !== enemyId || corps.assignedFrontId !== front.id) return corps;
                                    return {
                                        ...corps,
                                        frontTask: frontPlan.taskAssignments[corps.id] || corps.frontTask || 'assault',
                                    };
                                });
                                updatedFronts = updatedFronts.map((f) => {
                                    if (f.id !== front.id) return f;
                                    return {
                                        ...f,
                                        aiPosture: frontPlan.posture,
                                        postures: {
                                            ...(f.postures || {}),
                                            [enemySide]: frontPlan.posture,
                                        },
                                        frontlineCorpsOrder: {
                                            ...(f.frontlineCorpsOrder || {}),
                                            [enemySide]: frontPlan.frontlineCorpsOrder,
                                        },
                                        frontPlans: {
                                            ...(f.frontPlans || {}),
                                            [enemyId]: {
                                                ...frontPlan,
                                                updatedDay: currentDay,
                                            },
                                        },
                                    };
                                });
                            }


                            // --- 会战发起逻辑：将领提议（玩家侧）+ AI自动 ---
                            const hasBattleOnFront = battles.some(b =>
                                b.frontId === front.id && b.status === 'active'
                            );
                            const refreshedEnemyCorpsOnFront = updatedCorps.filter(c => c.isAI && c.assignedFrontId === front.id && c.nationId === enemyId);

                            if (!hasBattleOnFront && refreshedEnemyCorpsOnFront.length > 0 && playerCorpsOnFront.length > 0) {
                                const lastBattleDay = front._lastBattleDay || 0;
const battleCooldown = front._battleCooldown || (45 + Math.floor(Math.random() * 60));
                                const cooldownMet = currentDay - lastBattleDay >= battleCooldown;

                                // === 玩家侧：将领提议系统 ===
                                if (cooldownMet && currentActions?.triggerDiplomaticEvent) {
                                    for (const pCorps of playerCorpsOnFront) {
                                        const pGeneral = (updatedGenerals || []).find(g => g.assignedCorpsId === pCorps.id);
                                        if (!pGeneral) continue;

                                        const proposal = evaluateGeneralBattleProposal({
                                            general: pGeneral,
                                            corps: pCorps,
                                            front,
                                            allCorps: updatedCorps,
                                            generals: updatedGenerals,
                                            epoch: current.epoch || 0,
                                            currentDay,
                                        });

                                        if (!proposal.shouldPropose) continue;

                                        // 更新将军的提议日
                                        updatedGenerals = updatedGenerals.map(g =>
                                            g.id === pGeneral.id ? { ...g, lastBattleProposalDay: currentDay } : g
                                        );

                                        // 生成提议事件弹窗
                                        const proposalEvent = createBattleProposalEvent({
                                            general: pGeneral,
                                            corps: pCorps,
                                            front,
                                            proposal,
                                            callback: (choice) => {
                                                if (choice === 'approve') {
                                                    // 批准：所有前线兵团参战
                                                    const latestCorps = [...(updatedCorps || [])];
                                                    const latestGenerals = [...(updatedGenerals || [])];
                                                    const allPlayerOnFront = latestCorps.filter(c => !c.isAI && c.assignedFrontId === front.id && Object.values(c.units || {}).reduce((s, v) => s + v, 0) > 0);
                                                    const allEnemyOnFront = latestCorps.filter(c => c.isAI && c.assignedFrontId === front.id && c.nationId === enemyId && Object.values(c.units || {}).reduce((s, v) => s + v, 0) > 0);
                                                    const atkList = playerSide === 'attacker' ? allPlayerOnFront : allEnemyOnFront;
                                                    const defList = playerSide === 'attacker' ? allEnemyOnFront : allPlayerOnFront;
                                                    if (atkList.length === 0 || defList.length === 0) return;
                                                    const atkGen = latestGenerals.find(g => g.assignedCorpsId === pCorps.id) || null;
                                                    const defGen = latestGenerals.find(g => allEnemyOnFront.some(c => g.assignedCorpsId === c.id || g.id === c.generalId)) || null;
                                                    const atkTactic = autoSelectTactic(null, 'attacker', atkGen);
                                                    const defTactic = autoSelectTactic(null, 'defender', defGen);
                                                    const newBattle = createBattle({
                                                        attackerCorpsList: atkList,
                                                        defenderCorpsList: defList,
                                                        attackerGeneral: atkGen,
                                                        defenderGeneral: defGen,
                                                        front,
                                                        engagementType: proposal.engagementType,
                                                        battlePlan: { attacker: atkTactic, defender: defTactic },
                                                        epoch: current.epoch || 0,
                                                        currentDay,
                                                    });
                                                    if (!newBattle) return;
                                                    setActiveBattles(prev => [...(prev || []), newBattle]);
                                                    const allBattleIds = new Set([...atkList, ...defList].map(c => c.id));
                                                    setMilitaryCorps(prev => prev.map(c =>
                                                        allBattleIds.has(c.id) ? { ...c, status: 'in_combat' } : c
                                                    ));
                                                    setActiveFronts(prev => prev.map(f =>
                                                        f.id !== front.id ? f : {
                                                            ...f,
                                                            activeBattleId: newBattle.id,
                                                            activeBattleType: proposal.engagementType,
                                                            _lastBattleDay: currentDay,
_battleCooldown: 45 + Math.floor(Math.random() * 60),
                                                        }
                                                    ));
                                                    setGenerals(prev => prev.map(g =>
                                                        g.id === pGeneral.id ? { ...g, proposalCooldownDays: 0 } : g
                                                    ));
                                                    addLog(`?? ${pGeneral.name}将军率「${pCorps.name}」发起${proposal.engagementType === 'siege' ? '攻坚围城' : proposal.engagementType === 'assault' ? '主力决战' : '试探接敌'}`);
                                                } else if (choice === 'delay') {
                                                    // 暂缓：48天冷却
                                                    setGenerals(prev => prev.map(g =>
                                                        g.id === pGeneral.id ? { ...g, proposalCooldownDays: 48 } : g
                                                    ));
                                                } else if (choice === 'reject') {
                                                    // 否决：士气-8，30天冷却
                                                    setMilitaryCorps(prev => prev.map(c =>
                                                        c.id === pCorps.id ? { ...c, morale: Math.max(0, (c.morale || 100) - 8) } : c
                                                    ));
                                                    setGenerals(prev => prev.map(g =>
                                                        g.id === pGeneral.id ? { ...g, proposalCooldownDays: 30 } : g
                                                    ));
                                                    addLog(`${pGeneral.name}将军的请战被否决`);
                                                }
                                            },
                                        });

                                        currentActions.triggerDiplomaticEvent(proposalEvent);
                                        break; // 每条战线每日最多一个提议
                                    }
                                }

                                // === AI 侧：自动发起会战（多兵团参战）===
                                if (cooldownMet && frontPlan.shouldAttack) {
                                    // 收集前线所有兵团参战
                                    const allPlayerCorps = playerCorpsOnFront.filter(c => Object.values(c.units || {}).reduce((s, v) => s + v, 0) > 0);
                                    const allEnemyCorps = refreshedEnemyCorpsOnFront.filter(c => Object.values(c.units || {}).reduce((s, v) => s + v, 0) > 0);
                                    if (allPlayerCorps.length > 0 && allEnemyCorps.length > 0) {
                                        const aiTotalUnits = allEnemyCorps.reduce((s, c) => s + Object.values(c.units || {}).reduce((a, v) => a + v, 0), 0);
                                        const playerTotalUnits = allPlayerCorps.reduce((s, c) => s + Object.values(c.units || {}).reduce((a, v) => a + v, 0), 0);
                                        const totalUnitsCount = aiTotalUnits + playerTotalUnits;
                                        const playerRelativePosition = playerSide === 'attacker'
                                            ? Number(front.linePosition || 50)
                                            : 100 - Number(front.linePosition || 50);
                                        const aiForceRatio = aiTotalUnits / Math.max(1, playerTotalUnits);
                                        let engagementType = 'probe';
                                        if (aiForceRatio >= 1.3 || (aiForceRatio >= 1.0 && totalUnitsCount >= 200)) {
                                            engagementType = 'assault';
                                        }
                                        if (playerRelativePosition >= 65 || playerRelativePosition <= 35) {
                                            engagementType = 'assault';
                                        }
                                        if ((playerRelativePosition >= 82 || playerRelativePosition <= 18) && totalUnitsCount > 180) {
                                            engagementType = 'siege';
                                        }

                                        const isPlayerAttacker = playerSide === 'attacker';
                                        const atkCorpsList = isPlayerAttacker ? allPlayerCorps : allEnemyCorps;
                                        const defCorpsList = isPlayerAttacker ? allEnemyCorps : allPlayerCorps;
                                        // 找到主将（按兵力最大的兵团的将领）
                                        const pickGeneral = (corpsList) => {
                                            const sorted = [...corpsList].sort((a, b) => {
                                                const aU = Object.values(a.units || {}).reduce((s, v) => s + v, 0);
                                                const bU = Object.values(b.units || {}).reduce((s, v) => s + v, 0);
                                                return bU - aU;
                                            });
                                            for (const c of sorted) {
                                                const g = (updatedGenerals || []).find(g => g.assignedCorpsId === c.id || g.id === c.generalId);
                                                if (g) return g;
                                            }
                                            return null;
                                        };
                                        const atkGeneral = pickGeneral(atkCorpsList);
                                        const defGeneral = pickGeneral(defCorpsList);
                                        const atkTactic = autoSelectTactic(null, 'attacker', atkGeneral);
                                        const defTactic = autoSelectTactic(null, 'defender', defGeneral);
                                        const newBattle = createBattle({
                                            attackerCorpsList: atkCorpsList,
                                            defenderCorpsList: defCorpsList,
                                            attackerGeneral: atkGeneral,
                                            defenderGeneral: defGeneral,
                                            front,
                                            engagementType,
                                            battlePlan: { attacker: atkTactic, defender: defTactic },
                                            epoch: current.epoch || 0,
                                            currentDay,
                                        });

                                        if (newBattle) {
                                            updatedBattles.push(newBattle);
                                            const allBattleCorpsIds = new Set([...atkCorpsList, ...defCorpsList].map(c => c.id));
                                            updatedCorps = updatedCorps.map(c => {
                                                if (allBattleCorpsIds.has(c.id)) {
                                                    return { ...c, status: 'in_combat' };
                                                }
                                                return c;
                                            });
                                            updatedFronts = updatedFronts.map(f => {
                                                if (f.id !== front.id) return f;
                                                return {
                                                    ...f,
                                                    activeBattleId: newBattle.id,
                                                    activeBattleType: engagementType,
                                                    _lastBattleDay: currentDay,
_battleCooldown: 45 + Math.floor(Math.random() * 60),
                                                };
                                            });
                                            addLog(`⚔️ 敌军发起会战：${newBattle.attacker.corpsName} 对阵 ${newBattle.defender.corpsName}`);
                                        }
                                    }
                                }
                            }
                        }

                        const _milFrontLoopMs = _ap() - _milStart - _milSyncMs - _milAllocMs;
                        if (aiNationChangedIds.size > 0) {
                            const aiMarketPrices = result.market?.prices || current.market?.prices || {};
                            const aiNationsMap = new Map(aiNations.map(n => [n.id, n]));
                            setNations(prev => prev.map(nation => {
                                const updatedNation = aiNationsMap.get(nation.id);
                                if (!updatedNation || !aiNationChangedIds.has(nation.id)) return nation;

                                const activeNationFronts = (updatedFronts || []).filter((front) => front?.status === 'active' && (front.attackerId === nation.id || front.defenderId === nation.id));
                                const warEconomy = activeNationFronts.reduce((acc, front) => {
                                    const side = front.attackerId === nation.id ? 'attacker' : 'defender';
                                    const sideState = front.sideState?.[side] || {};
                                    acc.frontCount += 1;
                                    Object.entries(sideState.supplyNeed?.resources || {}).forEach(([resourceKey, amount]) => {
                                        acc.resourceUpkeep[resourceKey] = (acc.resourceUpkeep[resourceKey] || 0) + Number(amount || 0);
                                    });
                                    acc.frontlinePressure += Math.abs(Number(front.lineVelocity || 0)) + Math.max(0, Number(front.economicDamageBreakdown?.civilianPressure || 0));
                                    acc.productionPressure += Number(front.economicDamageBreakdown?.productionLoss || 0) + Number(front.economicDamageBreakdown?.infrastructureLoss || 0);
                                    return acc;
                                }, {
                                    frontCount: 0,
                                    resourceUpkeep: {},
                                    frontlinePressure: 0,
                                    productionPressure: 0,
                                });

                                const procurementDemand = {};
                                Object.entries(warEconomy.resourceUpkeep).forEach(([resourceKey, amount]) => {
                                    const required = Math.max(0, Number(amount || 0));
                                    if (required <= 0) return;
                                    const currentStock = Math.max(0, Number(updatedNation.military?.stockpile?.[resourceKey] || 0));
                                    const desiredBuffer = required * 1.15;
                                    const topUpAmount = Math.max(0, desiredBuffer - currentStock);
                                    if (topUpAmount > 0.01) {
                                        procurementDemand[resourceKey] = Number(topUpAmount.toFixed(2));
                                    }
                                });

                                const reserveWealth = Math.max(80, Number((updatedNation.wealth || nation.wealth || 0) * 0.05));
                                const procurementNation = applyMilitaryProcurementPressure({
                                    nation: updatedNation,
                                    resourceDemand: procurementDemand,
                                    marketPrices: aiMarketPrices,
                                    reserveWealth,
                                    day: currentDay,
                                });

                                const stockpileBeforeConsumption = {
                                    ...(procurementNation.military?.stockpile || {}),
                                };
                                const consumedResources = {};
                                const unmetDemand = {};
                                Object.entries(warEconomy.resourceUpkeep).forEach(([resourceKey, amount]) => {
                                    const required = Math.max(0, Number(amount || 0));
                                    if (required <= 0) return;
                                    const available = Math.max(0, Number(stockpileBeforeConsumption[resourceKey] || 0));
                                    const consumed = Math.min(required, available);
                                    consumedResources[resourceKey] = Number(consumed.toFixed(2));
                                    unmetDemand[resourceKey] = Number(Math.max(0, required - consumed).toFixed(2));
                                    stockpileBeforeConsumption[resourceKey] = Number(Math.max(0, available - consumed).toFixed(2));
                                });
                                const supplyCoverage = buildResourceCoverage(
                                    warEconomy.resourceUpkeep,
                                    procurementNation.military?.stockpile || {}
                                );
                                const domesticPressure = Object.entries(warEconomy.resourceUpkeep).reduce((maxPressure, [resourceKey, amount]) => {
                                    const required = Math.max(0, Number(amount || 0));
                                    if (required <= 0 || resourceKey === 'silver') return maxPressure;
                                    const domesticInventory = Math.max(0, Number(procurementNation.nationInventories?.[resourceKey] || 0));
                                    const pressure = Math.max(0, 1 - domesticInventory / Math.max(required * 3, 1));
                                    return Math.max(maxPressure, pressure);
                                }, 0);
                                const procurement = procurementNation.military?.procurement || {};

                                return {
                                    ...nation,
                                    militaryStrength: procurementNation.militaryStrength,
                                    wealth: procurementNation.wealth,
                                    nationPrices: procurementNation.nationPrices || nation.nationPrices,
                                    nationInventories: procurementNation.nationInventories || nation.nationInventories,
                                    inventory: procurementNation.inventory || nation.inventory,
                                    military: {
                                        ...(nation.military || {}),
                                        ...(updatedNation.military || {}),
                                        ...(procurementNation.military || {}),
                                        stockpile: stockpileBeforeConsumption,
                                        organization: Math.max(15, Number(procurementNation.military?.organization || updatedNation.military?.organization || 50) - (supplyCoverage < 0.75 ? 1 : 0) + (warEconomy.frontCount === 0 ? 1 : 0)),
                                    },
                                    warEconomy: {
                                        ...(nation.warEconomy || {}),
                                        ...warEconomy,
                                        foodUpkeep: Number(warEconomy.resourceUpkeep.food || 0),
                                        silverUpkeep: Number(warEconomy.resourceUpkeep.silver || 0),
                                        materielUpkeep: Number(warEconomy.resourceUpkeep.ammunition || warEconomy.resourceUpkeep.gunpowder || warEconomy.resourceUpkeep.wood || 0),
                                        supplyCoverage: Number(supplyCoverage.toFixed(2)),
                                        consumedResources,
                                        unmetDemand,
                                        domesticPressure: Number(domesticPressure.toFixed(2)),
                                        procurement: {
                                            ...procurement,
                                            reserveWealth: Number(reserveWealth.toFixed(2)),
                                            targetBuffer: procurementDemand,
                                        },
                                    },
                                };
                            }));
                        }


                        const _milSetNationsMs = _ap() - _milStart - _milSyncMs - _milAllocMs - _milFrontLoopMs;
                        setActiveBattles(updatedBattles);
                        setActiveFronts(updatedFronts);
                        if (updatedCorps !== currentCorps) setMilitaryCorps(updatedCorps);
                        if (updatedGenerals !== currentGenerals) setGenerals(updatedGenerals);

                        // [FIX] Sync stateRef for AI section too
                        stateRef.current.activeBattles = updatedBattles;
                        stateRef.current.activeFronts = updatedFronts;
                        stateRef.current.militaryCorps = updatedCorps;
                        stateRef.current.generals = updatedGenerals;
                        const _milTotalMs = _ap() - _milBattleStart;
                        if (_milTotalMs > 50) {
                            debugLog('perf', `[Perf-Military] total=${_milTotalMs.toFixed(1)}ms battleRounds=${_milBattleRoundsMs.toFixed(1)} friction=${_milFrictionMs.toFixed(1)} aiSync=${_milSyncMs.toFixed(1)} aiAlloc=${_milAllocMs.toFixed(1)} frontLoop=${_milFrontLoopMs.toFixed(1)} setNations=${_milSetNationsMs.toFixed(1)} battles=${currentActiveBattles.length} fronts=${currentActiveFronts.length} corps=${updatedCorps.length} nations=${aiNations.length}`);
                        }
                    }

                    // 姣忔 Tick 推进 1 天（而非 gameSpeed 天）                    // 加速效果通过增加 Tick 棰戠巼瀹炵幇锛岃€岄潪澧炲姞姣忔鎺ㄨ繘鐨勫ぉ鏁?
                    setDaysElapsed(prev => {
                        const numericPrev = Number.isFinite(prev) ? prev : Number(prev);
                        return (Number.isFinite(numericPrev) ? numericPrev : 0) + 1;
                    });
                });

                _apMark('batchedUpdates+military');

                if (coupOutcome?.event && current.actions?.triggerDiplomaticEvent) {
                    current.actions.triggerDiplomaticEvent(coupOutcome.event);
                }

                // ========== 缁勭粐搴︾郴缁熸洿鏂?==========
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
                        organizationGrowthMod: result.modifiers?.officialEffects?.organizationGrowthMod || 0,
                        effectiveTaxModifier: result.effectiveTaxModifier ?? 1, // [NEW] 缁勭粐搴﹀闀夸慨姝?
                        // 注意：classInfluence/totalInfluence 已是位置参数，无需在此重复
                    }
                );

                // 妫€鏌ユ槸鍚︽湁闃跺眰璺ㄨ秺缁勭粐搴﹂槇鍊奸渶瑕佽Е鍙戜簨浠?
                const organizationEvents = checkOrganizationEvents(
                    currentOrganizationStates,
                    updatedOrganizationStates
                );
                const currentEpoch = current.epoch || 0;

                // GameAnalytics: 组织度阶段跃迁上报
                if (organizationEvents.length > 0) {
                    for (const orgEvt of organizationEvents) {
                        const org = updatedOrganizationStates[orgEvt.stratumKey];
                        trackRebellionPhase(orgEvt.type, orgEvt.stratumKey, org?.organization);
                    }
                }

                // 澶勭悊缁勭粐搴︿簨浠?
                if (organizationEvents.length > 0 && current.actions?.triggerDiplomaticEvent) {
                    for (const orgEvent of organizationEvents) {
                        const stratumKey = orgEvent.stratumKey;
                        const epochBlocksRebellion = stratumKey === 'unemployed' && currentEpoch <= 0;
                        const hasMilitary = hasAvailableMilitary(current.army, current.popStructure, stratumKey);
                        const militaryIsRebelling = isMilitaryRebelling(updatedOrganizationStates);

                        // 若当前已有未处理事件，跳过非起义的组织度事件
                        // uprising 是跨越式检测，跳过后不会重触发，因此必须放行
                        if (current.currentEvent && orgEvent.type !== 'uprising') {
                            continue;
                        }

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
                                // 鍒涘缓浜嬩欢寮圭獥鎻愰啋鐜╁锛堥€夐」涓嶇洿鎺ュ奖鍝嶇粍缁囧害锛?
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
                                addLog(`?? ${STRATA[stratumKey]?.name || stratumKey}闃跺眰缁勭粐搴﹁揪鍒?0%，出现不满情绪！`);
                                break;

                            case 'plotting':
                                // 鍒涘缓浜嬩欢寮圭獥鎻愰啋鐜╁锛堥€夐」涓嶇洿鎺ュ奖鍝嶇粍缁囧害锛?
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
                                addLog(`? ${STRATA[stratumKey]?.name || stratumKey}闃跺眰缁勭粐搴﹁揪鍒?0%，正在密谋叛乱！`);
                                break;


                            case 'uprising': {
                                const stratumInfluence = rebellionStateForEvent.influenceShare;
                                const stratumPopForRebellion = current.popStructure?.[stratumKey] || 0;
                                if (epochBlocksRebellion) {
                                    addLog('[组织不足] ' + (STRATA[stratumKey]?.name || stratumKey) + ' 阶层尚未具备发动叛乱能力。');
                                    updatedOrganizationStates[stratumKey] = {
                                        ...updatedOrganizationStates[stratumKey],
                                        organization: 25,
                                        stage: ORGANIZATION_STAGE.GRUMBLING,
                                    };
                                    break;
                                }
                                // 人口过少无法组织有效叛乱，按人口外流处理
                                if (stratumPopForRebellion < MIN_REBELLION_POPULATION) {
                                    const leaving = Math.max(1, Math.floor(stratumPopForRebellion * 0.1));
                                    const popWealth = current.classWealth?.[stratumKey] || 0;
                                    const perCapW = stratumPopForRebellion > 0 ? popWealth / stratumPopForRebellion : 0;
                                    const fleeCapital = perCapW * leaving;

                                    setPopStructure(prev => ({
                                        ...prev,
                                        [stratumKey]: Math.max(0, (prev[stratumKey] || 0) - leaving),
                                    }));
                                    setPopulation(prev => reducePopulationWithFloor(prev, leaving));

                                    if (fleeCapital > 0) {
                                        setClassWealth(prev => ({
                                            ...prev,
                                            [stratumKey]: Math.max(0, (prev[stratumKey] || 0) - fleeCapital),
                                        }), { reason: 'rebellion_fleeing_capital', meta: { stratumKey } });
                                    }

                                    addLog('[人口不足] ' + (STRATA[stratumKey]?.name || stratumKey) + ' 仅有 ' + stratumPopForRebellion + ' 人，无法组织叛乱，' + leaving + ' 人愤怒离开。');

                                    updatedOrganizationStates[stratumKey] = {
                                        ...updatedOrganizationStates[stratumKey],
                                        organization: 40,
                                        stage: ORGANIZATION_STAGE.GRUMBLING,
                                    };
                                    break;
                                }
                                if (stratumInfluence < MIN_REBELLION_INFLUENCE) {
                                    // 褰卞搷鍔涗笉瓒虫棤娉曞彌涔憋紝浣嗙粍缁囧害宸叉弧锛岃Е鍙戜汉鍙ｅ娴?
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
                                    setPopulation(prev => reducePopulationWithFloor(prev, leaving));

                                    // 鎵ｉ櫎甯﹁蛋鐨勮储瀵?
                                    if (fleeingCapital > 0) {
                                        setClassWealth(prev => ({
                                            ...prev,
                                            [stratumKey]: Math.max(0, (prev[stratumKey] || 0) - fleeingCapital),
                                        }), { reason: 'rebellion_fleeing_capital', meta: { stratumKey } });
                                    }

                                    addLog('[叛乱未达阈值] ' + (STRATA[stratumKey]?.name || stratumKey) + ' 组织度到达100%，但影响力仅 ' + Math.round(stratumInfluence * 100) + '%，' + leaving + ' 人离开国家。');

                                    // 闄嶄綆缁勭粐搴︼紝璁╃郴缁熸仮澶嶆甯歌繍杞?
                                    updatedOrganizationStates[stratumKey] = {
                                        ...updatedOrganizationStates[stratumKey],
                                        organization: 75, // 降到75%鑰屼笉鏄?9锛岄伩鍏嶇珛鍗冲啀娆¤Е鍙?
                                    };
                                    break;
                                }

                                // ========== 鑱斿悎鍙涗贡妫€娴?==========
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
                                        setPopulation(prev => reducePopulationWithFloor(prev, totalLoss));
                                        addLog('[联合叛乱] 更多人（' + totalLoss + '）加入了 ' + existingRebel.name + '。');
                                    } else {
                                        // 鍒涘缓鏂拌仈鍚堝彌鍐?
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
                                        setPopulation(prev => reducePopulationWithFloor(prev, totalLoss));
                                        event = createCoalitionRebellionEvent(
                                            coalitionStrata,
                                            rebelNation,
                                            hasMilitary,
                                            militaryIsRebelling,
                                            details,
                                            rebellionCallback
                                        );
                                        ideologyEventBus.emit(IDEOLOGY_EVENTS.ON_REBELLION_START, {
                                            rebelNationId: rebelNation.id,
                                            isCoalition: true,
                                            coalitionStrata,
                                            hasMilitary,
                                            militaryIsRebelling,
                                        }, current.daysElapsed || 0);
                                        const coalitionNames = coalitionStrata.map(k => STRATA[k]?.name || k).join('、');
                                        addLog(`??? ${coalitionNames}绛夊涓樁灞傝仈鍚堝彂鍔ㄥ彌涔憋紒`);
                                        // 为联盟叛乱创建战线
                                        if (typeof setActiveFronts === 'function') {
                                            const playerEco = {
                                                resources: current.resources || {},
                                                buildings: current.buildings || {},
                                                population: current.population || 0,
                                                wealth: current.resources?.silver || 0,
                                            };
                                            const rebelEco = {
                                                resources: {},
                                                buildings: {},
                                                population: rebelNation.population || 200,
                                                wealth: rebelNation.wealth || 500,
                                            };
                                            const rebelFront = generateFront(rebelNation.id, 'player', current.epoch || 0, rebelEco, playerEco);
                                            rebelFront.createdDay = current.daysElapsed || 0;
                                            rebelFront.startDay = current.daysElapsed || 0;
                                            setActiveFronts(prev => {
                                                const existing = Array.isArray(prev) ? prev : [];
                                                if (existing.some(f => f.status === 'active' && (f.warId === rebelFront.warId || f.warId === `player_vs_${rebelNation.id}`))) {
                                                    return existing;
                                                }
                                                return [...existing, rebelFront];
                                            });
                                        }                                    }

                                    // 闄嶄綆鍙備笌闃跺眰缁勭粐搴?
                                    coalitionStrata.forEach(sKey => {
                                        updatedOrganizationStates[sKey] = {
                                            ...updatedOrganizationStates[sKey],
                                            organization: 50,
                                            stage: ORGANIZATION_STAGE.MOBILIZING,
                                        };
                                    });
                                } else {
                                    // 鍗曢樁灞傚彌涔?
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
                                        setPopulation(prev => reducePopulationWithFloor(prev, rebelPopLoss));
                                        addLog('[叛军扩张] 更多' + (STRATA[stratumKey]?.name || stratumKey) + '（' + rebelPopLoss + '人）加入了 ' + existingRebelNation.name + '。');
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
                                            const lootSummary = Object.entries(rebelResult.lootedResources).map(([k, v]) => (RESOURCES[k]?.name || k) + ': ' + v).join('、');
                                            addLog('[叛军掠夺] ' + lootSummary + '（总价值约' + Math.floor(rebelResult.lootedValue) + '银币）');
                                        }

                                        rebelNation.warStartDay = current.daysElapsed || 0;
                                        setNations(prev => [...prev, rebelNation]);
                                        setPopStructure(prev => ({
                                            ...prev,
                                            [stratumKey]: Math.max(0, (prev[stratumKey] || 0) - rebelPopLoss),
                                        }));
                                        setPopulation(prev => reducePopulationWithFloor(prev, rebelPopLoss));

                                        event = createActiveRebellionEvent(stratumKey, rebellionStateForEvent, hasMilitary, militaryIsRebelling, rebelNation, rebellionCallback);
                                        ideologyEventBus.emit(IDEOLOGY_EVENTS.ON_REBELLION_START, {
                                            rebelNationId: rebelNation.id,
                                            isCoalition: false,
                                            stratumKey,
                                            hasMilitary,
                                            militaryIsRebelling,
                                        }, current.daysElapsed || 0);
                                        addLog(`??? ${STRATA[stratumKey]?.name || stratumKey}闃跺眰缁勭粐搴﹁揪鍒?00%，发动叛乱！`);
                                        // 为单阶层叛乱创建战线
                                        if (typeof setActiveFronts === 'function') {
                                            const playerEco = {
                                                resources: current.resources || {},
                                                buildings: current.buildings || {},
                                                population: current.population || 0,
                                                wealth: current.resources?.silver || 0,
                                            };
                                            const rebelEco = {
                                                resources: {},
                                                buildings: {},
                                                population: rebelNation.population || 200,
                                                wealth: rebelNation.wealth || 500,
                                            };
                                            const rebelFront = generateFront(rebelNation.id, 'player', current.epoch || 0, rebelEco, playerEco);
                                            rebelFront.createdDay = current.daysElapsed || 0;
                                            rebelFront.startDay = current.daysElapsed || 0;
                                            setActiveFronts(prev => {
                                                const existing = Array.isArray(prev) ? prev : [];
                                                if (existing.some(f => f.status === 'active' && (f.warId === rebelFront.warId || f.warId === `player_vs_${rebelNation.id}`))) {
                                                    return existing;
                                                }
                                                return [...existing, rebelFront];
                                            });
                                        }
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

                // 鏇存柊缁勭粐搴︾姸鎬?
                setRebellionStates(updatedOrganizationStates);

                // 璧蜂箟鍚庤鍜屾鏌?
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
                        addLog(`馃晩锔?${rebelNation.name}内部分裂，组织度降至${Math.round(organization)}%，叛乱崩溃！`);

                        const returnedPop = Math.floor((rebelNation.population || 0) * 0.5);
                        if (returnedPop > 0) {
                            setPopStructure(prev => ({ ...prev, [stratumKey]: (prev[stratumKey] || 0) + returnedPop }));
                            setPopulation(prev => prev + returnedPop);
                            addLog('[复员回归] ' + returnedPop + ' 名' + stratumName + ' 从叛军中回归。');
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
                            addLog(`? ${task.stratumName} 鐨勬壙璇哄凡鍏戠幇锛?{task.description || '任务完成'}`);
                        });
                    }

                    if (evaluation.updated && evaluation.updated.length > 0) {
                        evaluation.updated.forEach(task => {
                            addLog('[承诺达成] ' + task.stratumName + ' 的承诺目标已达成，需继续维持 ' + task.maintainDuration + ' 天。');
                        });
                    }

                    if (evaluation.failed.length > 0) {
                        evaluation.failed.forEach(task => {
                            const stratumKey = task.stratumKey;
                            const failReason = task.failReason === 'maintain_broken' ? '未能保持承诺' : '未能按时完成';
                            addLog(`⚠️ 你违背了对?{task.stratumName}的承诺（${failReason}），组织度暴涨！`);

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
                                    ? '当前时代该阶层尚不具备叛乱组织能力'
                                    : '社会影响力不足（' + Math.round(stratumInfluence * 100) + '%）';
                                addLog('[承诺违背] ' + (STRATA[stratumKey]?.name || stratumKey) + ' 组织度达到100%，但' + extraReason + '，无法发动叛乱。');
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
                                        .map(([k, v]) => (RESOURCES[k]?.name || k) + ': ' + v)
                                        .join('、');
                                    addLog('[叛军掠夺] ' + lootSummary + '（总价值约' + Math.floor(rebelResult.lootedValue) + '银币）');
                                }

                                rebelNation.warStartDay = current.daysElapsed || 0;
                                setNations(prev => [...prev, rebelNation]);
                                setPopStructure(prev => ({
                                    ...prev,
                                    [stratumKey]: Math.max(0, (prev[stratumKey] || 0) - rebelPopLoss),
                                }));
                                setPopulation(prev => reducePopulationWithFloor(prev, rebelPopLoss));

                                // 为叛乱创建战线
                                if (typeof setActiveFronts === 'function') {
                                    const playerEco = {
                                        resources: current.resources || {},
                                        buildings: current.buildings || {},
                                        population: current.population || 0,
                                        wealth: current.resources?.silver || 0,
                                    };
                                    const rebelEco = {
                                        resources: {},
                                        buildings: {},
                                        population: rebelNation.population || 200,
                                        wealth: rebelNation.wealth || 500,
                                    };
                                    const rebelFront = generateFront(rebelNation.id, 'player', current.epoch || 0, rebelEco, playerEco);
                                    rebelFront.createdDay = current.daysElapsed || 0;
                                    rebelFront.startDay = current.daysElapsed || 0;
                                    setActiveFronts(prev => {
                                        const existing = Array.isArray(prev) ? prev : [];
                                        if (existing.some(f => f.status === 'active' && (f.warId === rebelFront.warId || f.warId === `player_vs_${rebelNation.id}`))) {
                                            return existing;
                                        }
                                        return [...existing, rebelFront];
                                    });
                                }

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
                                ideologyEventBus.emit(IDEOLOGY_EVENTS.ON_REBELLION_START, {
                                    rebelNationId: rebelNation.id,
                                    isCoalition: false,
                                    stratumKey,
                                    hasMilitary,
                                    militaryIsRebelling,
                                }, current.daysElapsed || 0);
                                addLog(`??? ${STRATA[stratumKey]?.name || stratumKey}鍥犳壙璇鸿繚鑳岋紝缁勭粐搴﹁揪鍒?00%，发动叛乱！`);
                                current.actions.triggerDiplomaticEvent(event);
                                setIsPaused(true);
                            }
                        });
                    }

                    // 鏇存柊浠诲姟鍒楄〃锛堝寘鎷繘鍏ヤ繚鎸侀樁娈电殑浠诲姟锛?
                    const newRemaining = [...evaluation.remaining];
                    if (evaluation.updated) {
                        // updated 浠诲姟宸茬粡鍦?remaining 中了
                    }
                    setPromiseTasks(newRemaining);
                }

                // 澶勭悊鐜╁鐨勫垎鏈熸敮浠?
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
                            addLog('[分期支付完成] 你已完成全部分期赔款（共 ' + payment.totalAmount + ' 银币）。');
                            gameState.setPlayerInstallmentPayment(null);
                        }
                    } else {
                        // 银币涓嶈冻锛岃繚绾?
                        addLog('[违约复战] 银币不足，无法支付分期赔款，和平协议被破坏。');
                        setNations(prev => prev.map(n =>
                            n.id === payment.nationId
                                ? {
                                    ...n,
                                    isAtWar: true,
                                    warStartDay: current.daysElapsed || 0,
                                    warDuration: 0,
                                    relation: Math.max(0, (n.relation || 0) - 50),
                                    peaceTreatyUntil: undefined,
                                    lootReserve: (n.wealth || 500) * 1.5, // 鍒濆鍖栨帬澶哄偍澶?
                                    lastMilitaryActionDay: undefined, // 重置军事行动冷却
                                }
                                : n
                        ));
                        const breachNation = (current.nations || []).find(n => n.id === payment.nationId);
                        if (breachNation && typeof setActiveFronts === 'function') {
                            const playerEco = {
                                resources: current.resources || {},
                                buildings: current.buildings || {},
                                population: current.population || 0,
                                wealth: current.resources?.silver || 0,
                            };
                            const enemyEco = {
                                resources: {},
                                buildings: {},
                                population: breachNation.population || breachNation.militaryPower || 200,
                                wealth: breachNation.wealth || 500,
                            };
                            const rebuiltFront = generateFront(breachNation.id, 'player', current.epoch || 0, enemyEco, playerEco);
                            rebuiltFront.createdDay = current.daysElapsed || 0;
                            rebuiltFront.startDay = current.daysElapsed || 0;
                            setActiveFronts(prev => {
                                const existing = Array.isArray(prev) ? prev : [];
                                if (existing.some(front => front.status === 'active' && (front.warId === rebuiltFront.warId || front.warId === `player_vs_${breachNation.id}`))) {
                                    return existing;
                                }
                                return [...existing, rebuiltFront];
                            });
                        }
                        if (breachNation && current.actions?.triggerDiplomaticEvent) {
                            const breachEvent = createWarDeclarationEvent(breachNation, () => { }, { reason: 'installment_default' });
                            current.actions.triggerDiplomaticEvent(breachEvent);
                        }
                        gameState.setPlayerInstallmentPayment(null);
                    }
                }

                setClassInfluenceShift(prev => {                    if (!prev || Object.keys(prev).length === 0) return prev || {};
                    const next = {};
                    Object.entries(prev).forEach(([key, value]) => {
                        const decayed = value * 0.9;
                        if (Math.abs(decayed) >= 0.1) {
                            next[key] = decayed;
                        }
                    });
                    return Object.keys(next).length > 0 ? next : {};
                });

                // 鏇存柊浜哄彛锛堝鏋滄湁鍙樺寲锛?
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

                _apMark('rebellion+diplomacy+vassal');

                const _logs = Array.isArray(result.logs) ? result.logs : [];
                if (_logs.length) {
                    // 鍘婚噸锛氳拷韪凡澶勭悊鐨勭獊琚簨浠?
                    const processedRaidNations = new Set();

                    // Filter and transform technical logs to human-readable format
                    const logVisibility = current?.eventEffectSettings?.logVisibility || {};
                    const shouldLogMerchantTrades = logVisibility.showMerchantTradeLogs ?? true;
                    const processedLogs = _logs.map(log => {
                        if (typeof log !== 'string') return log;

                        // Transform RAID_EVENT logs to human-readable format (now supports multiple action types)
                        if (log.includes('RAID_EVENT')) {
                            try {
                                const jsonStr = log.replace('RAID_EVENT', '');
                                const raidData = JSON.parse(jsonStr);

                                // 鍘婚噸锛氬鏋滆繖涓浗瀹跺凡缁忔湁鍐涗簨琛屽姩璁板綍锛岃烦杩?
                                if (processedRaidNations.has(raidData.nationName)) {
                                    return null; // 返回null，稍后过滤掉
                                }
                                processedRaidNations.add(raidData.nationName);

                                // 获取行动名称，默认为"突袭"
                                const actionName = raidData.actionName || '突袭';

                                if (raidData.victory) {
                                    return '[防御成功] 击退了 ' + raidData.nationName + ' 的' + actionName + '。';
                                }
                                const losses = [];
                                if (raidData.foodLoss > 0) losses.push('粮食 -' + raidData.foodLoss);
                                if (raidData.silverLoss > 0) losses.push('银币 -' + raidData.silverLoss);
                                if (raidData.woodLoss > 0) losses.push('木材 -' + raidData.woodLoss);
                                if (raidData.popLoss > 0) losses.push('人口 -' + raidData.popLoss);
                                const lossText = losses.length > 0 ? '（' + losses.join('，') + '）' : '';
                                return '[遭袭] ' + raidData.nationName + ' 发动了' + actionName + lossText;
                            } catch (e) {
                                return `⚔️ 发生了一场敌方军事行动！`;
                            }
                        }

                        // Transform WAR_DECLARATION_EVENT logs to human-readable format
                        if (log.includes('WAR_DECLARATION_EVENT:')) {
                            try {
                                const jsonStr = log.replace('WAR_DECLARATION_EVENT:', '');
                                const warData = JSON.parse(jsonStr);
                                return '[宣战] ' + warData.nationName + ' 对你宣战。';
                            } catch (e) {
                                return '[宣战] 有国家对你宣战。';
                            }
                        }

                        // Ideology event: war start (AI declares war on player)
                        if (log.includes('WAR_DECLARATION_EVENT:') && !log._ideologyWarStartEmitted) {
                            try {
                                const warJson = JSON.parse(log.replace('WAR_DECLARATION_EVENT:', ''));
                                ideologyEventBus.emit(IDEOLOGY_EVENTS.ON_WAR_START, {
                                    nationId: warJson.nationId, nationName: warJson.nationName
                                }, current.daysElapsed || 0);
                            } catch (_e) { /* ignore parse errors */ }
                        }

                        if (log.includes('AI_GIFT_EVENT:')) {
                            return '🎁 收到一份来自外国的外交礼物通知';
                        }
                        if (log.includes('AI_REQUEST_EVENT:')) {
                            return '📩 收到一份来自外国的外交请求';
                        }
                        // Merchant autonomous trade summary logs (from simulation)
                        // Gate behind showMerchantTradeLogs
                        if (log.startsWith('📦 商人贸易完成')) {
                            return shouldLogMerchantTrades ? log : null;
                        }

                        // 杩囨护鎺?AI_TRADE_EVENT 鐨勫師濮?JSON，后续会通过 addLog 娣诲姞鏍煎紡鍖栨棩蹇?
                        if (log.includes('AI_TRADE_EVENT:')) {
                            return null;
                        }

                        return log;
                    });

                    setLogs(prev => [...processedLogs.filter(log => log !== null), ...prev].slice(0, LOG_STORAGE_LIMIT));

                    // 检测外交事件并触发事件系统
                    const eventDebug = isDebugEnabled('event');
                    if (eventDebug) {
                        debugLog('event', '[EVENT DEBUG] actions:', !!currentActions, 'triggerDiplomaticEvent:', !!currentActions?.triggerDiplomaticEvent);
                    }
                    if (currentActions && currentActions.triggerDiplomaticEvent) {
                        if (eventDebug) {
                            debugLog('event', '[EVENT DEBUG] Checking logs:', _logs);
                            debugLog('event', '[EVENT DEBUG] Total logs count:', _logs.length);
                        }

                        // 先解析突袭事件日志，触发战斗结果弹窗
                        const raidLogEntry = _logs.find((log) => typeof log === 'string' && log.includes('RAID_EVENT'));
                        if (raidLogEntry && currentActions.addBattleNotification) {
                            try {
                                const jsonStart = raidLogEntry.indexOf('{');
                                if (jsonStart !== -1) {
                                    const raidJson = raidLogEntry.slice(jsonStart);
                                    const raidData = JSON.parse(raidJson);

                                    // 获取行动名称，默认为"突袭"
                                    const actionName = raidData.actionName || '突袭';

                                    let description = `${raidData.nationName} 鍙戝姩浜?{actionName}！\n\n`;
                                    if (raidData.victory) {
                                        description += `你的军队成功击退了?{actionName}！\n\n`;
                                        description += '战斗力对比：\n';
                                        description += `鎴戞柟锛?{raidData.ourPower || 0} \n`;
                                        description += `鏁屾柟锛?{raidData.enemyPower || 0} \n`;
                                        if (raidData.battleReport && raidData.battleReport.length > 0) {
                                            description += '\n' + raidData.battleReport.join('\n');
                                        }
                                    } else {
                                        if (!raidData.ourPower) {
                                            description += `你没有军队防御，${actionName}鎴愬姛！\n\n`;
                                        } else {
                                            description += `你的军队未能阻止${actionName}！\n\n`;
                                            description += '战斗力对比：\n';
                                            description += `鎴戞柟锛?{raidData.ourPower || 0} \n`;
                                            description += `鏁屾柟锛?{raidData.enemyPower || 0} \n`;
                                            if (raidData.battleReport && raidData.battleReport.length > 0) {
                                                description += '\n' + raidData.battleReport.join('\n');
                                            }
                                        }
                                        description += `\n${actionName}损失：\n`;
                                        if (raidData.foodLoss > 0) description += `绮锛?{raidData.foodLoss} \n`;
                                        if (raidData.silverLoss > 0) description += `银币：?{raidData.silverLoss} \n`;
                                        if (raidData.woodLoss > 0) description += `鏈ㄦ潗锛?{raidData.woodLoss} \n`;
                                        if (raidData.popLoss > 0) description += `浜哄彛锛?{raidData.popLoss} \n`;
                                    }

                                    const battleResult = {
                                        victory: !!raidData.victory,
                                        missionName: raidData.nationName + ' 的' + actionName,
                                        missionDesc: raidData.victory
                                            ? '你成功击退了敌方的' + actionName + '。'
                                            : '敌方对你发动了' + actionName + '。',
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


                        _logs.forEach((log, index) => {
                            debugLog('event', `[EVENT DEBUG] Log ${index}: `, log);
                            debugLog('event', `[EVENT DEBUG] Log ${index} includes RAID_EVENT: `, typeof log === 'string' && log.includes('RAID_EVENT'));

                            // 检测宣战事件（使用新的 WAR_DECLARATION_EVENT 鏍囪锛?
                            if (log.includes('WAR_DECLARATION_EVENT:')) {
                                debugLog('event', '[EVENT DEBUG] War declaration detected:', log);
                                try {
                                    const jsonStr = log.replace('WAR_DECLARATION_EVENT:', '');
                                    const warData = JSON.parse(jsonStr);
                                    const aggressorId = warData.nationId;
                                    const aggressorName = warData.nationName;

                                    // 被宣战时自动暂停游戏，让玩家有时间应对
                                    setIsPaused(true);

                                    // 瑙﹀彂鐜╁鐨勫鎴樺脊绐?
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
                                    // 鎴戜滑闇€瑕佸悓鏃舵洿鏂?state 中的 nations (result.nations 是本Tick鐨勭粨鏋滐紝我们需要更新它)

                                    // Track allies that actually join the war (for front generation)
                                    const joinedAggressorAllyIds = [];

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

                                        // 渚电暐鑰呯殑鐩熷弸锛堟帓闄ゅ叡鍚岀洘鍙嬪拰闄勫焊锛?
                                        const aggressorAllies = nextNations.filter(n => {
                                            if (n.id === aggressorId) return false;
                                            if (!aggressorAllianceIds.includes(n.id)) return false;
                                            if (sharedAllianceIds.has(n.id)) return false;
                                            if (n.isAtWar) return false;
                                            // [FIX] Exclude player's vassals - use vassalOf which is the actual field
                                            if (n.vassalOf === 'player') return false;
                                            return true;
                                        });
                                        // 玩家的盟友（排除共同盟友和附庸）
                                        const playerAllies = nextNations.filter(n => {
                                            if (n.id === aggressorId) return false;
                                            if (!playerAllianceIds.includes(n.id)) return false;
                                            if (sharedAllianceIds.has(n.id)) return false;
                                            if (n.isAtWar) return false;
                                            // [FIX] Exclude player's vassals - use vassalOf which is the actual field
                                            if (n.vassalOf === 'player') return false;
                                            return true;
                                        });
                                        // ========== 鎴樹簤涓婇檺妫€鏌?==========
                                        const MAX_CONCURRENT_WARS = 3;
                                        // 璁＄畻褰撳墠涓庣帺家交战的AI鍥藉鏁伴噺锛堜笉鍖呮嫭鍙涘啗锛?
                                        let currentWarsWithPlayer = nextNations.filter(n =>
                                            n.isAtWar === true && !n.isRebelNation
                                        ).length;

                                        // 2. 处理侵略者的盟友加入战争
                                        aggressorAllies.forEach(ally => {
                                            // 妫€鏌ユ垬浜変笂闄愶細濡傛灉宸茶揪涓婇檺锛岀洘鍙嬩繚鎸佷腑绔?
                                            if (currentWarsWithPlayer >= MAX_CONCURRENT_WARS) {
                                                addLog('[盟友观望] ' + ally.name + ' 虽为 ' + aggressorName + ' 的盟友，但选择暂时观望。');
                                                return;
                                            }

                                            // 鍚﹀垯锛屽姞鍏ヤ镜鐣ヨ€呬竴鏂癸紝瀵圭帺瀹跺鎴?
                                            const allyIdx = nextNations.findIndex(n => n.id === ally.id);
                                            if (allyIdx !== -1) {
                                                nextNations[allyIdx] = {
                                                    ...nextNations[allyIdx],
                                                    isAtWar: true,
                                                    warStartDay: daysElapsed,
                                                    warDuration: 0,
                                                    relation: 0 // 涓庣帺瀹跺叧绯荤牬瑁?
                                                };
                                                currentWarsWithPlayer++; // 更新计数
                                                joinedAggressorAllyIds.push(ally.id);
                                                addLog('[盟友参战] ' + ally.name + ' 作为 ' + aggressorName + ' 的盟友，对你宣战。');
                                            }
                                        });

                                        // 3. 澶勭悊鐜╁鐨勭洘鍙嬪姞鍏ユ垬浜?
                                        playerAllies.forEach(ally => {
                                            // 鍚﹀垯锛岃鐩熷弸瀵逛镜鐣ヨ€呭強鍏剁洘鍙嬪鎴?(设置 foreignWars)
                                            const allyIdx = nextNations.findIndex(n => n.id === ally.id);
                                            if (allyIdx !== -1) {
                                                const updatedAlly = { ...nextNations[allyIdx] };
                                                if (!updatedAlly.foreignWars) updatedAlly.foreignWars = {};

                                                // 瀵逛镜鐣ヨ€呭鎴?
                                                updatedAlly.foreignWars[aggressorId] = {
                                                    isAtWar: true,
                                                    warStartDay: daysElapsed,
                                                    warScore: 0
                                                };

                                                // 同时也需要更新侵略者的 foreignWars 状态，标记它与该盟友开战了
                                                // 注意：aggressorIdx 鐨勫紩鐢ㄥ鏋滀笉鏇存柊锛屽彲鑳藉鑷寸姸鎬佷笉涓€鑷?
                                                // 我们直接修改 nextNations 数组中的对象
                                                if (!nextNations[aggressorIdx].foreignWars) nextNations[aggressorIdx].foreignWars = {};
                                                nextNations[aggressorIdx].foreignWars[ally.id] = {
                                                    isAtWar: true,
                                                    warStartDay: daysElapsed,
                                                    warScore: 0
                                                };

                                                nextNations[allyIdx] = updatedAlly;
                                                addLog('[盟友支援] 你的盟友 ' + ally.name + ' 响应号召，对 ' + aggressorName + ' 宣战。');
                                            }
                                        });

                                        // 通知共同盟友保持中立
                                        if (sharedAllianceIds.size > 0) {
                                            const neutralAllies = nextNations.filter(n => sharedAllianceIds.has(n.id));
                                            neutralAllies.forEach(ally => {
                                                addLog('[中立] ' + ally.name + ' 同时是你与 ' + aggressorName + ' 的盟友，选择保持中立。');
                                            });
                                        }

                                        return nextNations;
                                    });

                                    // Generate front for this war (AI declared war on player)
                                    if (typeof setActiveFronts === 'function') {
                                        const playerEco = {
                                            resources: resources || {},
                                            buildings: buildings || {},
                                            population: population || 0,
                                            wealth: (resources?.silver || 0),
                                        };

                                        // Main aggressor front
                                        const aggressor = result.nations?.find(n => n.id === aggressorId);
                                        const enemyEco = {
                                            resources: {},
                                            buildings: {},
                                            population: aggressor?.population || aggressor?.militaryPower || 200,
                                            wealth: aggressor?.wealth || 500,
                                        };
                                        const front = generateFront(aggressorId, 'player', epoch, enemyEco, playerEco);
                                        front.createdDay = daysElapsed;

                                        // Collect all new fronts (aggressor + allies)
                                        const newFronts = [front];
                                        joinedAggressorAllyIds.forEach(allyId => {
                                            const allyNation = result.nations?.find(n => n.id === allyId);
                                            const allyEco = {
                                                resources: {},
                                                buildings: {},
                                                population: allyNation?.population || allyNation?.militaryPower || 200,
                                                wealth: allyNation?.wealth || 500,
                                            };
                                            const allyFront = generateFront(allyId, 'player', epoch, allyEco, playerEco);
                                            allyFront.createdDay = daysElapsed;
                                            newFronts.push(allyFront);
                                        });

                                        setActiveFronts(prev => {
                                            const existing = Array.isArray(prev) ? prev : [];
                                            // Filter out duplicate fronts
                                            const toAdd = newFronts.filter(nf => {
                                                const altWarId = `player_vs_${nf.attackerId}`;
                                                return !existing.some(f => f.status === 'active' && (f.warId === nf.warId || f.warId === altWarId));
                                            });
                                            return [...existing, ...toAdd];
                                        });
                                    }

                                } catch (e) {
                                    debugError('event', '[EVENT DEBUG] Failed to parse war declaration event:', e);
                                }
                            }
                            // 兼容旧的宣战检测逻辑
                            else if (log.includes('对你发动了战争') && !log.includes('WAR_DECLARATION_EVENT')) {
                                const match = log.match(/(.+) 对你发动了战争/);
                                if (match) {
                                    const nationName = match[1];
                                    const nation = result.nations?.find(n => n.name === nationName);
                                    if (nation) {
                                        const event = createWarDeclarationEvent(nation, () => {
                                            // 瀹ｆ垬浜嬩欢鍙渶瑕佺‘璁わ紝涓嶉渶瑕侀澶栨搷浣?
                                        });
                                        currentActions.triggerDiplomaticEvent(event);
                                        // Generate front for legacy war declaration
                                        if (typeof setActiveFronts === 'function') {
                                            const playerEco = {
                                                resources: resources || {},
                                                buildings: buildings || {},
                                                population: population || 0,
                                                wealth: (resources?.silver || 0),
                                            };
                                            const enemyEco = {
                                                resources: {},
                                                buildings: {},
                                                population: nation?.population || nation?.militaryPower || 200,
                                                wealth: nation?.wealth || 500,
                                            };
                                            const legacyFront = generateFront(nation.id, 'player', epoch, enemyEco, playerEco);
                                            legacyFront.createdDay = daysElapsed;
                                            setActiveFronts(prev => {
                                                const existing = Array.isArray(prev) ? prev : [];
                                                if (existing.some(f => f.status === 'active' && (f.warId === legacyFront.warId || f.warId === `player_vs_${nation.id}`))) {
                                                    return existing;
                                                }
                                                return [...existing, legacyFront];
                                            });
                                        }
                                    }
                                }
                            }

                            // 检测和平请求事件
                            if (log.includes('请求和平')) {
                                debugLog('event', '[EVENT DEBUG] Peace request detected in log:', log);
                                // Support both regular numbers and scientific notation (e.g., 1.23e+25)
                                const match = log.match(/🤝\s+(.+?)\s+请求和平，愿意支付\s*([\d.e+\-]+)\s*银币作为赔款。?/);
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
                                        // 优先从战线系统读取战争分数（上限±200），nation.warScore 被限制在±100
                                        const nationFronts = (activeFronts || []).filter(f =>
                                            f?.status === 'active' && (
                                                (f.attackerId === nation.id && f.defenderId === 'player') ||
                                                (f.attackerId === 'player' && f.defenderId === nation.id)
                                            )
                                        );
                                        const frontWarScore = nationFronts.length > 0
                                            ? nationFronts.reduce((sum, f) => sum + getEffectiveFrontWarScore(f), 0)
                                            : null;
                                        const effectiveWarScore = frontWarScore !== null ? frontWarScore : (nation.warScore || 0);
                                        debugLog('event', '[EVENT DEBUG] Parameters:', {
                                            nation: nation.name,
                                            nationId: nation.id,
                                            tribute,
                                            warScore: effectiveWarScore,
                                            population: nation.population
                                        });
                                        try {
                                            const event = createEnemyPeaceRequestEvent(
                                                nation,
                                                tribute,
                                                effectiveWarScore,
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
                                        // 清除和平请求标记，避免重复触发
                                        setNations(prev => prev.map(n =>
                                            n.id === nation.id ? { ...n, isPeaceRequesting: false } : n
                                        ));
                                    }
                                }
                            }

                            // 妫€娴嬪彌鍐涙姇闄嶄簨浠?
                            if (log.includes('请求投降')) {
                                const nation = result.nations?.find(n => n.isRebelNation && log.includes(n.name));
                                if (nation) {
                                    const nationName = nation.name;
                                    if (nation && nation.isPeaceRequesting) {
                                        debugLog('event', '[EVENT DEBUG] Rebel surrender detected:', nationName);
                                        // 创建叛军投降事件（直接使用叛乱结束事件）
                                        // 娉ㄦ剰锛氬洖璋冨彧澶勭悊鏁堟灉锛屼笉鍐嶈皟鐢?handleRebellionWarEnd 避免重复
                                        const surrenderEvent = createRebellionEndEvent(
                                            nation,
                                            true, // 玩家胜利
                                            current.resources?.silver || 0,
                                            (action) => {
                                                // 效果由事件本身的 effects 澶勭悊锛岃繖閲屽彧鍋氭棩蹇?
                                                debugLog('gameLoop', '[REBELLION SURRENDER]', action, nation?.name);
                                            }
                                        );
                                        currentActions.triggerDiplomaticEvent(surrenderEvent);

                                        // 直接处理叛军移除和状态重置（不再通过 handleRebellionWarEnd锛?
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
                                            // 閲嶇疆缁勭粐搴?
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

                            // 妫€娴嬪彌鍐涘嫆绱?最后通牒事件
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
                                                    setPopulation(prev => reducePopulationWithFloor(prev, popLoss));
                                                    setMaxPop(prev => Math.max(20, prev - popLoss));
                                                    addLog(`馃拃 鍙涘啗杩涜浜嗗ぇ灞犳潃锛屼綘澶卞幓浜?${popLoss} 人口和人口上限！`);

                                                    // 对应阶层人口也需减少
                                                    const massacreStratumKey = nationObj.rebellionStratum;
                                                    if (massacreStratumKey) {
                                                        setPopStructure(prev => ({
                                                            ...prev,
                                                            [massacreStratumKey]: Math.max(0, (prev[massacreStratumKey] || 0) - popLoss)
                                                        }));
                                                    }
                                                } else if (eventData.demandType === 'reform') {
                                                    // 鏀归潻濡ュ崗锛氫竴娆℃€т粠鍥藉簱鎵ｉ櫎银币：岃浆鍏ヨ闃跺眰鐨勮储瀵?
                                                    const reformAmount = eventData.demandAmount || 0;
                                                    const coalitionStrata = eventData.coalitionStrata || [eventData.reformStratum || nationObj.rebellionStratum];
                                                    debugLog('gameLoop', '[REBEL REFORM] Amount:', reformAmount, 'Coalition:', coalitionStrata);

                                                    // 鎵ｉ櫎银币
                                                    setResources(prev => ({
                                                        ...prev,
                                                        silver: Math.max(0, (prev.silver || 0) - reformAmount)
                                                    }), { reason: 'rebel_reform_payment' });

                                                    // 鎸変汉鍙ｆ瘮渚嬪垎閰嶇粰鍚勯樁灞?
                                                    const popShare = {};
                                                    let totalPop = 0;
                                                    coalitionStrata.forEach(sKey => {
                                                        const pop = current.popStructure?.[sKey] || 0;
                                                        popShare[sKey] = pop;
                                                        totalPop += pop;
                                                    });

                                                    // 濡傛灉鎬讳汉鍙ｄ负0锛屽钩鍧囧垎閰?
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
                                                        ? '（按比例分配给：' + distributions.join('、') + '）'
                                                        : '';
                                                    addLog('[叛军改革] 你接受了叛军的改革要求，支付 ' + reformAmount + ' 银币' + distribDesc + '。');
                                                } else if (eventData.demandType === 'subsidy') {
                                                    // 寮哄埗琛ヨ创锛氳缃负鏈熶竴骞寸殑姣忔棩琛ヨ创鏁堟灉锛屾寜姣斾緥鍒嗛厤缁欐墍鏈夎仈鐩熼樁灞?
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

                                                    // 濡傛灉鎬讳汉鍙ｄ负0锛屽钩鍧囧垎閰?
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
                                                            subsidyDescParts.push(`${stratumName}(${dailyAmount}/澶?`);

                                                            return {
                                                                id: `rebel_subsidy_${nationObj.id}_${sKey}_${Date.now()}`,
                                                                type: 'rebel_forced_subsidy',
                                                                name: '对' + stratumName + '的强制补贴',
                                                                description: '每日支付 ' + dailyAmount + ' 银币给 ' + stratumName,
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
                                                        ? '（按比例分配给：' + subsidyDescParts.join('、') + '）'
                                                        : '给 ' + (STRATA[coalitionStrata[0]]?.name || '起义阶层');
                                                    addLog('[强制补贴] 你接受了叛军要求，未来一年每日支付 ' + subsidyDaily + ' 银币' + distribDesc + '（共 ' + subsidyTotal + ' 银币）。');
                                                }

                                                // 2. 绔嬪嵆缁撴潫鎴樹簤锛岀Щ闄ゅ彌鍐涘浗瀹跺苟閲嶇疆鐘舵€?
                                                // 使用 handleRebellionWarEnd 函数（与玩家主动求和使用相同的函数）
                                                // 这个函数会正确删除叛军、重置状态并触发"灞堣颈鐨勫拰骞?事件
                                                if (actions?.handleRebellionWarEnd) {
                                                    debugLog('gameLoop', '[REBEL] Calling handleRebellionWarEnd for defeat...');
                                                    actions.handleRebellionWarEnd(nationObj.id, false); // false = 玩家失败
                                                } else {
                                                    debugError('gameLoop', '[REBEL] handleRebellionWarEnd not available!');
                                                    // 澶囩敤鏂规锛氭墜鍔ㄦ竻鐞?
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
                                                addLog(`⚔️ 你拒绝了叛军的?${eventData.demandType})要求，战争继续！`);
                                            }
                                        });
                                        currentActions.triggerDiplomaticEvent(event);
                                    }
                                } catch (e) {
                                    debugError('event', '[EVENT DEBUG] Failed to parse rebel demand:', e);
                                }
                            }

                            // 妫€娴?AI 送礼事件
                            if (log.includes('AI_GIFT_EVENT:')) {
                                try {
                                    const jsonStr = log.replace('AI_GIFT_EVENT:', '');
                                    const eventData = JSON.parse(jsonStr);
                                    const nation = result.nations?.find(n => n.id === eventData.nationId);
                                    if (nation && currentActions && currentActions.triggerDiplomaticEvent) {
                                        const event = createGiftEvent(nation, eventData.amount, () => {
                                            // 鎺ュ彈绀肩墿鐨勫洖璋?
                                            setResources(prev => ({ ...prev, silver: (prev.silver || 0) + eventData.amount }), { reason: 'ai_gift_received' });
                                            setNations(prev => prev.map(n => n.id === nation.id ? { ...n, relation: Math.min(100, (n.relation || 0) + 15) } : n));
                                            addLog('[外交赠礼] 你接受了 ' + nation.name + ' 的礼物，获得 ' + eventData.amount + ' 银币。');
                                        });
                                        currentActions.triggerDiplomaticEvent(event);
                                        debugLog('event', '[EVENT DEBUG] AI Gift event triggered:', nation.name, eventData.amount);
                                    }
                                } catch (e) {
                                    debugError('event', '[EVENT DEBUG] Failed to parse AI gift event:', e);
                                }
                            }

                            // 妫€娴?AI 索要事件
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
                                                    addLog('[请求失败] 银币不足，无法满足 ' + nation.name + ' 的请求。');
                                                    return;
                                                }
                                                setResources(prev => ({ ...prev, silver: (prev.silver || 0) - eventData.amount }), { reason: 'ai_request_payment' });
                                                setNations(prev => prev.map(n => n.id === nation.id ? { ...n, relation: Math.min(100, (n.relation || 0) + 10) } : n));
                                                addLog('[外交请求] 你满足了 ' + nation.name + ' 的请求，关系提升。');
                                            } else {
                                                setNations(prev => prev.map(n => n.id === nation.id ? { ...n, relation: Math.max(0, (n.relation || 0) - 15) } : n));
                                                addLog('[外交请求] 你拒绝了 ' + nation.name + ' 的请求，关系恶化。');
                                            }
                                        });
                                        currentActions.triggerDiplomaticEvent(event);
                                        debugLog('event', '[EVENT DEBUG] AI Request event triggered:', nation.name, eventData.amount);
                                    }
                                } catch (e) {
                                    debugError('event', '[EVENT DEBUG] Failed to parse AI request event:', e);
                                }
                            }

                            // 妫€娴?AI 联盟请求事件
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
                                                addLog('[结盟] 你接受了 ' + nation.name + ' 的结盟请求，你们成为盟友。');
                                            } else {
                                                setNations(prev => prev.map(n =>
                                                    n.id === nation.id
                                                        ? { ...n, relation: Math.max(0, (n.relation || 0) - 10) }
                                                        : n
                                                ));
                                                addLog('[结盟] 你婉拒了 ' + nation.name + ' 的结盟请求，关系略有下降。');
                                            }
                                        });
                                        currentActions.triggerDiplomaticEvent(event);
                                        debugLog('event', '[EVENT DEBUG] AI Alliance Request event triggered:', nation.name);
                                    }
                                } catch (e) {
                                    debugError('event', '[EVENT DEBUG] Failed to parse AI alliance request event:', e);
                                }
                            }

                            // Treaty 2.0 MVP: 妫€娴?AI 条约提案事件
                            // AI 缁勭粐閭€璇蜂簨浠?
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
                                                addLog('[组织邀请] 你接受了 ' + nation.name + ' 的组织邀请，加入了「' + org.name + '」。');
                                            } else {
                                                setNations(prev => prev.map(n =>
                                                    n.id === nation.id
                                                        ? { ...n, relation: Math.max(0, (n.relation || 0) - 6) }
                                                        : n
                                                ));
                                                addLog('[组织邀请] 你拒绝了 ' + nation.name + ' 的组织邀请，关系略有下降。');
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
                                                addLog('[条约] 你与 ' + nation.name + ' 签署了条约（' + treaty.type + '）。');
                                            } else {
                                                setNations(prev => prev.map(n =>
                                                    n.id === nation.id
                                                        ? { ...n, relation: Math.max(0, (n.relation || 0) - 8) }
                                                        : n
                                                ));
                                                addLog('[条约] 你拒绝了 ' + nation.name + ' 的条约提案，关系下降。');
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

                            // 闄勫焊鍥界嫭绔嬫垬浜変簨浠?
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
                                                // 闀囧帇锛氱淮鎸佹垬浜夌姸鎬侊紝闄嶄綆绋冲畾搴?
                                                setStability(prev => Math.max(0, prev - 10));
                                                addLog(`⚔️ 你决定出兵镇压?${nation.name} 的叛乱！`);
                                            } else if (action === 'negotiate') {
                                                // 璋堝垽锛氬皾璇曞彇娑堟垬浜夛紝闄嶄綆鏈濊础鐜?
                                                setNations(prev => prev.map(n => {
                                                    if (n.id !== nation.id) return n;
                                                    return {
                                                        ...n,
                                                        isAtWar: false,
                                                        independenceWar: false,
                                                        vassalOf: 'player',
                                                        tributeRate: Math.max(0.02, (n.tributeRate || 0.1) * 0.5),
                                                        // 谈判解决：立即降低独立倾向10点（模拟谈判的即时缓和效果）
                                                        // 涔嬪悗浼氭牴鎹斂绛栧拰鎺у埗鎺柦鑷劧瓒嬪悜鐩爣鍊?
                                                        independencePressure: Math.max(0, (n.independencePressure || 0) - 10),
                                                    };
                                                }));
                                                addLog('[ͣս] 你与 ' + nation.name + ' 达成协议，降低朝贡并平息叛乱。');
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
                                                addLog('[承认独立] 你承认了 ' + nation.name + ' 的独立。');
                                            }
                                        });
                                        currentActions.triggerDiplomaticEvent(event);
                                        debugLog('event', '[EVENT DEBUG] Independence War event triggered:', nation.name);
                                    }
                                } catch (e) {
                                    debugError('event', '[EVENT DEBUG] Failed to parse independence war event:', e);
                                }
                            }

                            // 妫€娴嬬洘鍙嬪喎娣′簨浠?
                            if (log.includes('ALLY_COLD_EVENT:')) {
                                try {
                                    const jsonStr = log.replace('ALLY_COLD_EVENT:', '');
                                    const eventData = JSON.parse(jsonStr);
                                    const nation = result.nations?.find(n => n.id === eventData.nationId);
                                    if (nation && currentActions && currentActions.triggerDiplomaticEvent) {
                                        const event = createAllyColdEvent(nation, eventData.relation, (action, giftCost) => {
                                            if (action === 'gift') {
                                                // 妫€鏌ラ摱甯佹槸鍚﹁冻澶?
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
                                                addLog('[盟友关系] 你向盟友 ' + nation.name + ' 赠送礼物，关系提升。');
                                            } else {
                                                // 不管：关系继续下降，增加解盟风险
                                                setNations(prev => prev.map(n =>
                                                    n.id === nation.id
                                                        ? { ...n, relation: Math.max(0, (n.relation || 0) - 5), allianceStrain: ((n.allianceStrain || 0) + 1) }
                                                        : n
                                                ));
                                                addLog('[盟友关系] 你忽视了盟友 ' + nation.name + ' 的关系问题，同盟关系出现裂痕。');
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

                                    // 将关税记入tradeStats，显示在财政面板中
                                    if (eventData.tariff > 0) {
                                        setTradeStats(prev => ({ ...prev, tradeTax: (prev.tradeTax || 0) + eventData.tariff }));
                                    }

                                    // 鐢熸垚璇︾粏鐨勮锤鏄撴棩蹇楋紙鐜╁鏀垮簻鍙敹鍏崇◣锛?
                                    // 这些属于"贸易路线/市场贸易"类日志，受 showTradeRouteLogs 控制
                                    if (isDebugEnabled('trade')) {
                                        if (eventData.tradeType === 'export') {
                                            // 玩家出口：资源减少，只收关税
                                            if (eventData.tariff > 0) {
                                                addLog('[市场交易] ' + eventData.nationName + ' 从你市场购买 ' + eventData.quantity + ' ' + resourceName + '，你收取关税 ' + eventData.tariff + '。');
                                            } else {
                                                addLog('[市场交易] ' + eventData.nationName + ' 从你市场购买 ' + eventData.quantity + ' ' + resourceName + '（开放市场，无关税）。');
                                            }
                                        } else if (eventData.tradeType === 'import') {
                                            // 玩家进口：资源增加，只收关税
                                            if (eventData.tariff > 0) {
                                                addLog('[市场交易] ' + eventData.nationName + ' 向你市场出售 ' + eventData.quantity + ' ' + resourceName + '，你收取关税 ' + eventData.tariff + '。');
                                            } else {
                                                addLog('[市场交易] ' + eventData.nationName + ' 向你市场出售 ' + eventData.quantity + ' ' + resourceName + '（开放市场，无关税）。');
                                            }
                                        } else {
                                            // 旧版兼容
                                            if (eventData.tariff > 0) {
                                                addLog('[市场交易] ' + eventData.nationName + ' 与你进行了贸易，你收取关税 ' + eventData.tariff + '。');
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
                                                    addLog('[拒绝投降] 你拒绝了 ' + nation.name + ' 的投降要求，战争继续。');
                                                    return;
                                                }

                                                // 鏍规嵁閫夋嫨绫诲瀷澶勭悊涓嶅悓鐨勬姇闄嶆潯浠?
                                                if (actionType === 'pay_high' || actionType === 'pay_standard' || actionType === 'pay_moderate') {
                                                    // 涓€娆℃€ф敮浠樿禂娆?
                                                    const currentSilver = current.resources?.silver || 0;
                                                    if (currentSilver < amount) {
                                                        addLog('[投降失败] 银币不足（需要 ' + amount + '，当前 ' + Math.floor(currentSilver) + '），无法接受投降条件。');
                                                        return;
                                                    }
                                                    setResources(prev => ({ ...prev, silver: Math.max(0, (prev.silver || 0) - amount) }), { reason: 'war_reparation_payment' });
                                                    addLog('[战争赔款] 你向 ' + nation.name + ' 支付了 ' + amount + ' 银币。');
                                                } else if (actionType === 'pay_installment') {
                                                    // 分期付款 - amount 鏄瘡鏃ラ噾棰?
                                                    // 璁剧疆鐜╁鐨勫垎鏈熸敮浠樼姸鎬侊紙涓嶆槸鏁屽浗鐨勶紒锛?
                                                    gameState.setPlayerInstallmentPayment({
                                                        nationId: nation.id,
                                                        amount: amount,
                                                        remainingDays: 365,
                                                        totalAmount: amount * 365,
                                                        paidAmount: 0,
                                                    });
                                                    addLog('[分期赔款] 你同意在365天内每日向 ' + nation.name + ' 支付 ' + amount + ' 银币（共 ' + (amount * 365) + ' 银币）。');
                                                } else if (actionType === 'offer_population') {
                                                    // 割让人口：扣减人口与人口上限加成，避免下一tick琚ā鎷熼噸绠楄鐩?
                                                    const currentPop = current.population || 0;
                                                    if (currentPop < amount + 10) {
                                                        addLog('[投降失败] 人口不足（需要 ' + amount + '，当前 ' + Math.floor(currentPop) + '），无法接受投降条件。');
                                                        return;
                                                    }
                                                    setPopulation(prev => reducePopulationWithFloor(prev, amount));
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
                                                    addLog('[人口割让] 你向 ' + nation.name + ' 割让了 ' + amount + ' 人口。');
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
                                            name: '无条件和平提议',
                                            title: '无条件和平提议',
                                            icon: 'HandHeart',
                                            isDiplomaticEvent: true,
                                            description: eventData.nationName + ' 因国力衰弱，提出无条件停战。接受后双方将签订和平条约。',
                                            nationId: eventData.nationId,
                                            nationName: eventData.nationName,
                                            warScore: eventData.warScore,
                                            warDuration: eventData.warDuration,
                                            options: [
                                                {
                                                    id: 'accept',
                                                    text: '接受和平',
                                                    description: '结束战争，签订和平条约',
                                                    style: 'success',
                                                    effects: {},
                                                    callback: () => {
                                                        if (typeof currentActions?.handleEnemyPeaceAccept === 'function') {
                                                            currentActions.handleEnemyPeaceAccept(eventData.nationId, 'peace_only', 0);
                                                        } else {
                                                            setNations(prev => prev.map(n => n.id === eventData.nationId ? {
                                                                ...n,
                                                                isAtWar: false,
                                                                warScore: 0,
                                                                warDuration: 0,
                                                                peaceTreatyUntil: current.daysElapsed + 365,
                                                                isMercyPeaceOffering: false,
                                                                relation: Math.min(100, (n.relation || 50) + 10),
                                                            } : n));
                                                            addLog('[停战达成] 你接受了 ' + eventData.nationName + ' 的和平提议，战争结束。');
                                                        }
                                                    },
                                                },
                                                {
                                                    id: 'reject',
                                                    text: '婉拒停战',
                                                    description: '继续战争（不推荐）',
                                                    style: 'danger',
                                                    effects: {},
                                                    callback: () => {
                                                        // 拒绝和平
                                                        setNations(prev => prev.map(n => n.id === eventData.nationId ? {
                                                            ...n,
                                                            isMercyPeaceOffering: false,
                                                        } : n));
                                                        addLog('[继续战争] 你拒绝了 ' + eventData.nationName + ' 的和平提议，战争继续。');
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
                                        : '由于你多次忽视盟友诉求';
                                    addLog('[联盟破裂] ' + reasonText + '，' + eventData.nationName + ' 决定解除与你的同盟关系。');
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
                                                    // 鐜╁閫夋嫨鎻村姪鐩熷弸锛屽鏀诲嚮鑰呭鎴?
                                                    setNations(prev => prev.map(n => {
                                                        if (n.id === attacker.id) {
                                                            return {
                                                                ...n,
                                                                isAtWar: true,
                                                                warStartDay: current.daysElapsed,
                                                                warDuration: 0,
                                                                relation: Math.max(0, (n.relation || 50) - 40),
                                                                lootReserve: (n.wealth || 500) * 1.5, // 鍒濆鍖栨帬澶哄偍澶?
                                                                lastMilitaryActionDay: undefined, // 重置军事行动冷却
                                                            };
                                                        }
                                                        return n;
                                                    }));
                                                    if (typeof setActiveFronts === 'function') {
                                                        const playerEco = {
                                                            resources: current.resources || {},
                                                            buildings: current.buildings || {},
                                                            population: current.population || 0,
                                                            wealth: current.resources?.silver || 0,
                                                        };
                                                        const enemyEco = {
                                                            resources: {},
                                                            buildings: {},
                                                            population: attacker.population || attacker.militaryPower || 200,
                                                            wealth: attacker.wealth || 500,
                                                        };
                                                        const allyWarFront = generateFront(attacker.id, 'player', current.epoch || 0, enemyEco, playerEco);
                                                        allyWarFront.createdDay = current.daysElapsed || 0;
                                                        allyWarFront.startDay = current.daysElapsed || 0;
                                                        setActiveFronts(prev => {
                                                            const existing = Array.isArray(prev) ? prev : [];
                                                            if (existing.some(front => front.status === 'active' && (front.warId === allyWarFront.warId || front.warId === `player_vs_${attacker.id}`))) {
                                                                return existing;
                                                            }
                                                            return [...existing, allyWarFront];
                                                        });
                                                    }
                                                    addLog('[盟友参战] 你决定援助盟友 ' + ally.name + '，对 ' + attacker.name + ' 宣战。');
                                                } else {
                                                    // 鉁?鐜╁鎷掔粷鎻村姪锛氬叧绯诲ぇ骞呬笅闄嶃€侀€€鍑哄啗浜嬬粍缁囥€佽儗鍙涜€呭０瑾?
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

                                                    // 鉁?浠庡啗浜嬬粍缁囦腑閫€鍑?
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

                                                    addLog('[拒绝援助] 你拒绝援助盟友 ' + ally.name + '，并退出与其共同军事组织。');
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

                            // 妫€娴嬫捣澶栨姇璧勬満浼氫簨浠?
                            if (log.includes('OVERSEAS_INVESTMENT_OPPORTUNITY:')) {
                                debugLog('trade', '[AI投资事件监听] 检测到投资机会日志:', log);
                                try {
                                    const jsonStr = log.replace('OVERSEAS_INVESTMENT_OPPORTUNITY:', '');
                                    const eventData = JSON.parse(jsonStr);
                                    const nation = result.nations?.find(n => n.id === eventData.nationId);
                                    debugLog('trade', '[AI投资事件监听] 解析成功, nation:', nation?.name, 'currentActions:', !!currentActions, 'triggerDiplomaticEvent:', !!currentActions?.triggerDiplomaticEvent);
                                    if (nation && currentActions && currentActions.triggerDiplomaticEvent) {
                                        const event = createOverseasInvestmentOpportunityEvent(
                                            nation,
                                            eventData.opportunity,
                                            (accepted, investmentDetails) => {
                                                debugLog('trade', '[AI投资事件监听] 鍥炶皟琚Е鍙? accepted:', accepted, 'details:', investmentDetails);
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
                                        debugLog('trade', '[AI投资事件监听] 创建事件成功, 正在触发:', event);
                                        currentActions.triggerDiplomaticEvent(event);
                                        debugLog('event', '[EVENT DEBUG] Overseas Investment Opportunity event triggered:', nation.name);
                                    } else {
                                        debugLog('trade', '[AI投资事件监听] 缺少必要条件, nation:', !!nation, 'currentActions:', !!currentActions);
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
                                                    // 鎺ュ彈琛ュ伩锛岀Щ闄ゆ姇璧?
                                                    setResources(prev => ({
                                                        ...prev,
                                                        silver: (prev.silver || 0) + (details?.compensation || 0)
                                                    }), { reason: 'nationalization_compensation' });
                                                    addLog('[国有化补偿] 你接受了 ' + nation.name + ' 的补偿 ' + (details?.compensation || 0) + ' 银币。');
                                                } else if (action === 'negotiate') {
                                                    // 尝试谈判
                                                    setNations(prev => prev.map(n =>
                                                        n.id === nation.id
                                                            ? { ...n, relation: Math.max(0, (n.relation || 50) - 10) }
                                                            : n
                                                    ));
                                                    addLog('[国有化谈判] 你尝试与 ' + nation.name + ' 谈判，关系下降。');
                                                } else if (action === 'threaten') {
                                                    // 发出警告
                                                    setNations(prev => prev.map(n =>
                                                        n.id === nation.id
                                                            ? { ...n, relation: Math.max(0, (n.relation || 50) - 25) }
                                                            : n
                                                    ));
                                                    addLog('[强硬警告] 你警告 ' + nation.name + ' 不要国有化你的投资，关系严重恶化。');
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

                            // 妫€娴嬭锤鏄撲簤绔簨浠?
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
                                                    if (typeof setActiveFronts === 'function') {
                                                        const playerEco = {
                                                            resources: current.resources || {},
                                                            buildings: current.buildings || {},
                                                            population: current.population || 0,
                                                            wealth: current.resources?.silver || 0,
                                                        };
                                                        const enemyEco = {
                                                            resources: {},
                                                            buildings: {},
                                                            population: attacker.population || attacker.militaryPower || 200,
                                                            wealth: attacker.wealth || 500,
                                                        };
                                                        const allyWarFront = generateFront(attacker.id, 'player', current.epoch || 0, enemyEco, playerEco);
                                                        allyWarFront.createdDay = current.daysElapsed || 0;
                                                        allyWarFront.startDay = current.daysElapsed || 0;
                                                        setActiveFronts(prev => {
                                                            const existing = Array.isArray(prev) ? prev : [];
                                                            if (existing.some(front => front.status === 'active' && (front.warId === allyWarFront.warId || front.warId === `player_vs_${attacker.id}`))) {
                                                                return existing;
                                                            }
                                                            return [...existing, allyWarFront];
                                                        });
                                                    }
                                                    addLog('[贸易争端] 你在贸易争端中支持了 ' + nation1.name + '。');
                                                } else if (decision === 'support_nation2') {
                                                    setNations(prev => prev.map(n => {
                                                        if (n.id === nation2.id) return { ...n, relation: Math.min(100, (n.relation || 50) + 10) };
                                                        if (n.id === nation1.id) return { ...n, relation: Math.max(0, (n.relation || 50) - 15) };
                                                        return n;
                                                    }));
                                                    if (typeof setActiveFronts === 'function') {
                                                        const playerEco = {
                                                            resources: current.resources || {},
                                                            buildings: current.buildings || {},
                                                            population: current.population || 0,
                                                            wealth: current.resources?.silver || 0,
                                                        };
                                                        const enemyEco = {
                                                            resources: {},
                                                            buildings: {},
                                                            population: attacker.population || attacker.militaryPower || 200,
                                                            wealth: attacker.wealth || 500,
                                                        };
                                                        const allyWarFront = generateFront(attacker.id, 'player', current.epoch || 0, enemyEco, playerEco);
                                                        allyWarFront.createdDay = current.daysElapsed || 0;
                                                        allyWarFront.startDay = current.daysElapsed || 0;
                                                        setActiveFronts(prev => {
                                                            const existing = Array.isArray(prev) ? prev : [];
                                                            if (existing.some(front => front.status === 'active' && (front.warId === allyWarFront.warId || front.warId === `player_vs_${attacker.id}`))) {
                                                                return existing;
                                                            }
                                                            return [...existing, allyWarFront];
                                                        });
                                                    }
                                                    addLog('[贸易争端] 你在贸易争端中支持了 ' + nation2.name + '。');
                                                } else if (decision === 'mediate') {
                                                    setNations(prev => prev.map(n => {
                                                        if (n.id === nation1.id || n.id === nation2.id) {
                                                            return { ...n, relation: Math.min(100, (n.relation || 50) + 5) };
                                                        }
                                                        return n;
                                                    }));
                                                    if (typeof setActiveFronts === 'function') {
                                                        const playerEco = {
                                                            resources: current.resources || {},
                                                            buildings: current.buildings || {},
                                                            population: current.population || 0,
                                                            wealth: current.resources?.silver || 0,
                                                        };
                                                        const enemyEco = {
                                                            resources: {},
                                                            buildings: {},
                                                            population: attacker.population || attacker.militaryPower || 200,
                                                            wealth: attacker.wealth || 500,
                                                        };
                                                        const allyWarFront = generateFront(attacker.id, 'player', current.epoch || 0, enemyEco, playerEco);
                                                        allyWarFront.createdDay = current.daysElapsed || 0;
                                                        allyWarFront.startDay = current.daysElapsed || 0;
                                                        setActiveFronts(prev => {
                                                            const existing = Array.isArray(prev) ? prev : [];
                                                            if (existing.some(front => front.status === 'active' && (front.warId === allyWarFront.warId || front.warId === `player_vs_${attacker.id}`))) {
                                                                return existing;
                                                            }
                                                            return [...existing, allyWarFront];
                                                        });
                                                    }
                                                    addLog('[贸易调停] 你成功调停了 ' + nation1.name + ' 与 ' + nation2.name + ' 之间的贸易争端。');
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

                            // 妫€娴嬪啗浜嬪悓鐩熼個璇蜂簨浠?
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
                                                    if (typeof setActiveFronts === 'function') {
                                                        const playerEco = {
                                                            resources: current.resources || {},
                                                            buildings: current.buildings || {},
                                                            population: current.population || 0,
                                                            wealth: current.resources?.silver || 0,
                                                        };
                                                        const enemyEco = {
                                                            resources: {},
                                                            buildings: {},
                                                            population: attacker.population || attacker.militaryPower || 200,
                                                            wealth: attacker.wealth || 500,
                                                        };
                                                        const allyWarFront = generateFront(attacker.id, 'player', current.epoch || 0, enemyEco, playerEco);
                                                        allyWarFront.createdDay = current.daysElapsed || 0;
                                                        allyWarFront.startDay = current.daysElapsed || 0;
                                                        setActiveFronts(prev => {
                                                            const existing = Array.isArray(prev) ? prev : [];
                                                            if (existing.some(front => front.status === 'active' && (front.warId === allyWarFront.warId || front.warId === `player_vs_${attacker.id}`))) {
                                                                return existing;
                                                            }
                                                            return [...existing, allyWarFront];
                                                        });
                                                    }
                                                    addLog('[军事同盟] 你与 ' + inviter.name + ' 建立军事同盟，共同对抗 ' + target.name + '。');
                                                } else if (rejectType === 'warn_target') {
                                                    setNations(prev => prev.map(n => {
                                                        if (n.id === target.id) return { ...n, relation: Math.min(100, (n.relation || 50) + 15) };
                                                        if (n.id === inviter.id) return { ...n, relation: Math.max(0, (n.relation || 50) - 25) };
                                                        return n;
                                                    }));
                                                    if (typeof setActiveFronts === 'function') {
                                                        const playerEco = {
                                                            resources: current.resources || {},
                                                            buildings: current.buildings || {},
                                                            population: current.population || 0,
                                                            wealth: current.resources?.silver || 0,
                                                        };
                                                        const enemyEco = {
                                                            resources: {},
                                                            buildings: {},
                                                            population: attacker.population || attacker.militaryPower || 200,
                                                            wealth: attacker.wealth || 500,
                                                        };
                                                        const allyWarFront = generateFront(attacker.id, 'player', current.epoch || 0, enemyEco, playerEco);
                                                        allyWarFront.createdDay = current.daysElapsed || 0;
                                                        allyWarFront.startDay = current.daysElapsed || 0;
                                                        setActiveFronts(prev => {
                                                            const existing = Array.isArray(prev) ? prev : [];
                                                            if (existing.some(front => front.status === 'active' && (front.warId === allyWarFront.warId || front.warId === `player_vs_${attacker.id}`))) {
                                                                return existing;
                                                            }
                                                            return [...existing, allyWarFront];
                                                        });
                                                    }
                                                    addLog('[军事同盟] 你向 ' + target.name + ' 通报了 ' + inviter.name + ' 的同盟邀请。');
                                                } else {
                                                    addLog('[军事同盟] 你婉拒了 ' + inviter.name + ' 的军事同盟邀请。');
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

                            // 妫€娴嬭竟澧冨啿绐佷簨浠?
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
                                                    addLog('[边境事件] 你向 ' + nation.name + ' 道歉并支付了赔偿金。');
                                                } else if (response === 'deny') {
                                                    setNations(prev => prev.map(n =>
                                                        n.id === nation.id ? { ...n, relation: Math.max(0, (n.relation || 50) - 15) } : n
                                                    ));
                                                    addLog('[边境事件] 你否认了责任，' + nation.name + ' 对此表示不满。');
                                                } else if (response === 'demand_apology') {
                                                    addLog('[边境事件] 你向 ' + nation.name + ' 发出正式抗议，要求道歉。');
                                                } else if (response === 'retaliate') {
                                                    setNations(prev => prev.map(n =>
                                                        n.id === nation.id ? { ...n, relation: Math.max(0, (n.relation || 50) - 30) } : n
                                                    ));
                                                    addLog('[边境事件] 你下令对 ' + nation.name + ' 进行军事报复。');
                                                } else if (response === 'protest') {
                                                    addLog('[边境事件] 你向 ' + nation.name + ' 提出外交抗议。');
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

                            // 妫€娴嬮檮搴歌姹備簨浠?
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
                                                    addLog('[附庸] ' + nation.name + ' 成为你的附庸。');
                                                } else {
                                                    addLog('[附庸] 你拒绝了 ' + nation.name + ' 成为附庸的请求。');
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

                _apMark("logs+events");
                // [FIX] Moved Auto Replenish Logic here to share scope with setMilitaryQueue
                const autoRecruitEnabled = current.autoRecruitEnabled || false;
                const allAutoReplenishLosses = {};

                // DEBUG: Check if we are receiving any replenish logs
                const hasReplenishLog = _logs.some(l => typeof l === 'string' && l.includes('AUTO_REPLENISH_LOSSES:'));
                if (hasReplenishLog) {
                    addLog(`馃洜锔?[DEBUG] Worker sent replenishment signal! AutoRecruit: ${autoRecruitEnabled}`);
                }

                if (autoRecruitEnabled) {
                    _logs.forEach((log) => {
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

                    const corpsDemand = aggregateCorpsReplenishDemand(
                        effectiveCorpsReplenishQueue,
                        current.militaryCorps || []
                    );
                    Object.entries(corpsDemand).forEach(([unitId, count]) => {
                        if (count > 0) {
                            allAutoReplenishLosses[unitId] = (allAutoReplenishLosses[unitId] || 0) + count;
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

                // [FIX] 灏嗚嚜鍔ㄨˉ鍏甸€昏緫绉诲叆姝ゅ洖璋冿紝纭繚浣跨敤鏈€鏂扮殑闃熷垪鐘舵€?
                setMilitaryQueue(prev => {
                    let baseQueue = queueOverrideForManpower || prev;
                    const currentSoldierPop = (soldierPopulationAfterEvents ?? result.popStructure?.soldier) || 0;
                    // [FIX Bug8/9] 使用战斗后的军队状态 + 军团内单位
                    let currentArmyCount = Object.values(result.army || armyStateForQueue || {}).reduce((sum, count) => sum + count, 0);
                    const corpsForQueueCap = current.militaryCorps || [];
                    for (const cps of corpsForQueueCap) {
                        if (cps?.isAI) continue;
                        currentArmyCount += Object.values(cps?.units || {}).reduce((sum, c) => sum + c, 0);
                    }
                    // [FIX] 计算军队实际人口消耗（考虑不同兵种的populationCost锛?
                    const currentArmyPopulation = calculateArmyPopulation(result.army || armyStateForQueue || {});
                    const militaryCapacity = getMilitaryCapacity(current.buildings || {});

                    // [FIX] 鍦ㄩ槦鍒楀鐞嗕腑鎵ц鑷姩琛ュ叺锛岀‘淇濅娇鐢ㄦ渶鏂扮姸鎬?
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

                            // 妫€鏌ヨ祫婧愭槸鍚﹁冻澶?
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

                                // 娣诲姞鍒伴槦鍒?
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
                                        .map(([unitId, count]) => (UNIT_TYPES[unitId]?.name || unitId) + ' x' + count)
                                        .join('、');
                                    addLog('[自动补兵] 已花费资金招募 ' + summary + ' 并加入训练队列。');
                                }
                            } else if (!canAfford && Object.keys(replenishCounts).length > 0) {
                                addLog('[自动补兵取消] 资金或资源不足（需 ' + Math.ceil(totalSilverCost) + ' 银币）。');
                            }
                        } else if (availableSlotsForReplenish <= 0 && Object.keys(allAutoReplenishLosses).length > 0) {
                            addLog('[自动补兵暂停] 军事容量不足。');
                        }
                    } else if (shouldProcessAutoReplenish && militaryCapacity <= 0) {
                        addLog('[自动补兵禁用] 无军事容量，请先建设兵营。');
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
                                    addLog('[容量限制] 军事容量不足，已取消 ' + removedCount + ' 个训练队列名额。');
                                }
                            }
                            baseQueue = trimmedQueue;
                        }
                    }

                    // 璁＄畻鏈夊灏戝矖浣嶅彲浠ョ敤浜庢柊璁粌锛堥伩鍏嶅娆?filter 甯︽潵鐨?O(n) 鎵弿锛?
                    // [FIX] 必须考虑不同兵种的populationCost，否则会导致超员
                    let waitingCount = 0;
                    let trainingCount = 0;
                    let trainingPopulation = 0; // [FIX] 璁粌涓崟浣嶇殑瀹為檯浜哄彛娑堣€?
                    for (let i = 0; i < baseQueue.length; i++) {
                        const item = baseQueue[i];
                        const s = item?.status;
                        if (s === 'waiting') waitingCount++;
                        else if (s === 'training') {
                            trainingCount++;
                            // [FIX] 绱姞璁粌涓崟浣嶇殑浜哄彛娑堣€?
                            const popCost = UNIT_TYPES[item?.unitId]?.populationCost || 1;
                            trainingPopulation += popCost;
                        }
                    }

                    // [FIX] 浣跨敤浜哄彛娑堣€楄€岄潪鍗曚綅鏁伴噺鏉ヨ绠楀彲鐢ㄥ矖浣?
                    const occupiedPopulation = currentArmyPopulation + trainingPopulation;
                    const availableJobsForNewTraining = Math.max(0, currentSoldierPop - occupiedPopulation);

                    // 将等待中的项转为训练中（如果有可用岗位）
                    // [PERF] 澶ч槦鍒楁椂閫愭潯鍐欐棩蹇椾細涓ラ噸鍗￠】锛岃繖閲屽仛鑺傛祦锛氬彧鍐欐憳瑕佹棩蹇?
                    // [FIX] 浣跨敤浜哄彛娑堣€楄€岄潪鍗曚綅鏁伴噺鏉ュ垽鏂槸鍚﹀彲浠ュ紑濮嬭缁?
                    let remainingPopCapacity = availableJobsForNewTraining;
                    let startedThisTick = 0;
                    const updated = baseQueue.map(item => {
                        if (item.status === 'waiting' && remainingPopCapacity > 0) {
                            // [FIX] 妫€鏌ヨ鍗曚綅鐨勪汉鍙ｆ秷鑰楁槸鍚﹀湪鍙敤鑼冨洿鍐?
                            const unitPopCost = UNIT_TYPES[item?.unitId]?.populationCost || 1;
                            if (unitPopCost > remainingPopCapacity) {
                                // 浜哄彛涓嶈冻浠ヨ缁冩鍗曚綅锛岃烦杩?
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
                        // 鍙璁粌涓殑椤硅繘琛屽€掕鏃?
                        if (item.status === 'training') {
                            return {
                                ...item,
                                remainingTime: item.remainingTime - 1
                            };
                        }
                        return item;
                    });

                    if (startedThisTick > 0) {
                        addLog('[训练开始] ' + startedThisTick + ' 个单位开始训练。');
                    }

                    // 鎵惧嚭宸插畬鎴愮殑璁粌锛堥伩鍏嶅啀娆?filter 鎵弿锛?
                    const completed = [];
                    for (let i = 0; i < updated.length; i++) {
                        const it = updated[i];
                        if (it?.status === 'training' && it.remainingTime <= 0) completed.push(it);
                    }

                    // [FIX] 计算可以加入军队的数量（不超过容量上限）
                    // [FIX Bug8] 计算可以加入军队的数量（不超过容量上限）
                    // 必须包含军团内的兵力，否则容量计算偏低导致丢兵
                    let currentTotalArmy = Object.values(result.army || armyStateForQueue || {}).reduce((sum, c) => sum + c, 0);
                    const corpsForCapCheck = current.militaryCorps || [];
                    for (const cps of corpsForCapCheck) {
                        if (cps?.isAI) continue;
                        currentTotalArmy += Object.values(cps?.units || {}).reduce((sum, c) => sum + c, 0);
                    }
                    const slotsAvailableForCompletion = militaryCapacity > 0
                        ? Math.max(0, militaryCapacity - currentTotalArmy)
                        : completed.length; // 如果没有容量限制，允许所有完成的单位加入

                    // 只取能加入的部分
                    const canComplete = completed.slice(0, slotsAvailableForCompletion);
                    const mustWait = completed.slice(slotsAvailableForCompletion);

                    if (canComplete.length > 0) {
                        // Separate auto-replenish items from normal training completions
                        const replenishItems = canComplete.filter(item => item.isAutoReplenish);
                        const normalItems = canComplete.filter(item => !item.isAutoReplenish);

                        // Try to assign replenish items directly to damaged corps
                        const toArmy = [...normalItems]; // items that go to the army pool
                        const toCorps = []; // { item, corpsId, corpsName }
                        const currentReplenishQueue = effectiveCorpsReplenishQueue;
                        const currentCorpsList = current.militaryCorps || [];
                        const currentFronts = current.activeFronts || [];
                        // Build a working copy of the queue to track assignments within this tick
                        const workingQueue = JSON.parse(JSON.stringify(currentReplenishQueue));

                        for (const item of replenishItems) {
                            const target = findBestReplenishTarget(
                                item.unitId,
                                workingQueue,
                                currentCorpsList,
                                currentFronts
                            );
                            if (target) {
                                toCorps.push({ item, corpsId: target.corpsId, corpsName: target.corps.name });
                                // Decrement working queue so next item picks a different corps if needed
                                if (workingQueue[target.corpsId]?.[item.unitId]) {
                                    workingQueue[target.corpsId][item.unitId] -= 1;
                                    if (workingQueue[target.corpsId][item.unitId] <= 0) {
                                        delete workingQueue[target.corpsId][item.unitId];
                                        if (Object.keys(workingQueue[target.corpsId]).length === 0) {
                                            delete workingQueue[target.corpsId];
                                        }
                                    }
                                }
                            } else {
                                // No corps needs this unit type, fall back to army pool
                                toArmy.push(item);
                            }
                        }

                        // Add units to corps via setMilitaryCorps
                        if (toCorps.length > 0) {
                            setMilitaryCorps(prevCorps => {
                                const nextCorps = prevCorps.map(c => ({ ...c, units: { ...c.units } }));
                                for (const { item, corpsId } of toCorps) {
                                    const corps = nextCorps.find(c => c.id === corpsId);
                                    if (corps) {
                                        corps.units[item.unitId] = (corps.units[item.unitId] || 0) + 1;
                                    }
                                }
                                return nextCorps;
                            });
                            // Update replenish queue: decrement deficits
                            setCorpsReplenishQueue(prev => {
                                const next = { ...prev };
                                for (const { item, corpsId } of toCorps) {
                                    if (next[corpsId]?.[item.unitId]) {
                                        next[corpsId][item.unitId] -= 1;
                                        if (next[corpsId][item.unitId] <= 0) {
                                            delete next[corpsId][item.unitId];
                                        }
                                        if (Object.keys(next[corpsId]).length === 0) {
                                            delete next[corpsId];
                                        }
                                    }
                                }
                                return next;
                            });
                            // Log corps assignments
                            const corpsAssignSummary = {};
                            toCorps.forEach(({ item, corpsName }) => {
                                const unitName = UNIT_TYPES[item.unitId]?.name || item.unitId;
                                const key = `${corpsName}:${unitName}`;
                                corpsAssignSummary[key] = (corpsAssignSummary[key] || 0) + 1;
                            });
                            for (const [key, count] of Object.entries(corpsAssignSummary)) {
                                const [corpsName, unitName] = key.split(':');
                                addLog(`[自动补兵] ${unitName} x${count} 已补充到 ${corpsName}`);
                            }
                        }

                        // Add remaining units to army pool (normal + fallback replenish)
                        if (toArmy.length > 0) {
                            setArmy(prevArmy => {
                                const newArmy = { ...prevArmy };
                                let prevTotal = Object.values(newArmy).reduce((sum, c) => sum + c, 0);
                                const corpsForRaceCheck = current.militaryCorps || [];
                                for (const cps of corpsForRaceCheck) {
                                    if (cps?.isAI) continue;
                                    prevTotal += Object.values(cps?.units || {}).reduce((sum, c) => sum + c, 0);
                                }
                                let addedCount = 0;

                                toArmy.forEach(item => {
                                    if (militaryCapacity <= 0 || prevTotal + addedCount < militaryCapacity) {
                                        newArmy[item.unitId] = (newArmy[item.unitId] || 0) + 1;
                                        addedCount++;
                                    }
                                });
                                return newArmy;
                            });
                        }
                        // [PERF] 大量单位同时毕业时逐条日志会卡顿：改为摘要 + 少量样例
                        {
                            const total = canComplete.length;
                            if (total <= 10) {
                                canComplete.forEach(item => {
                                    addLog('[训练完成] ' + UNIT_TYPES[item.unitId].name + ' 训练完成。');
                                });
                            } else {
                                const preview = canComplete
                                    .slice(0, 3)
                                    .map(item => UNIT_TYPES[item.unitId]?.name || item.unitId)
                                    .join('、');
                                addLog('[训练完成] ' + total + ' 个单位训练完成（例如：' + preview + '...）。');
                            }
                        }
                    }

                    if (mustWait.length > 0) {
                        addLog('[容量已满] ' + mustWait.length + ' 个单位将在队列中等待。');
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

                _apMark('recruit+queue');
                // 记录完整 apply sections
                const _apTotalMs = _ap() - _apStart;
                if (typeof window !== 'undefined') {
                    window.__APPLY_SECTIONS = { ..._apSections, _total: _apTotalMs };
                }

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
                    const applySectionStr = Object.entries(_apSections)
                        .filter(([, v]) => v > 1)
                        .sort((a, b) => b[1] - a[1])
                        .map(([k, v]) => `${k}=${v.toFixed(1)}`)
                        .join(' ');
                    console.log(
                        `[Perf] day=${perfDay} total=${perfTotalMs.toFixed(1)}ms sim=${perfSimMs.toFixed(1)}ms apply=${perfApplyMs.toFixed(1)}ms ` +
                        `nations=${current.nations?.length || 0} overseas=${overseasInvestmentsRef.current?.length || 0} foreign=${current.foreignInvestments?.length || 0}` +
                        (topSections ? ` sections=${topSections}` : '') +
                        (otherMs > 0 ? ` other=${otherMs.toFixed(1)}ms` : '')
                    );
                    if (applySectionStr) {
                        console.log(`[Perf-Apply] ${applySectionStr} _total=${_apTotalMs.toFixed(1)}ms`);
                    }
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
            }).finally(() => {
                tickProcessingRef.current = false;
            });
            } catch (err) {
                tickProcessingRef.current = false;
                console.error('[GameLoop] Tick error:', err);
            }
        }, tickInterval); // 根据游戏速度动态调整执行频率
        return () => clearInterval(timer);
    }, [gameSpeed, isPaused, setFestivalModal, setLastFestivalYear, lastFestivalYear, setIsPaused]); // Dependencies: game speed, pause state, and annual report related state
};

