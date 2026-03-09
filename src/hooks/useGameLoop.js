// 娓告垙寰幆閽╁瓙
// 澶勭悊娓告垙鐨勬牳蹇冨惊鐜€昏緫锛屽寘鎷祫婧愮敓浜с€佷汉鍙ｅ闀跨瓑

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
// 鏂扮増缁勭粐搴︾郴缁?
import {
    updateAllOrganizationStates,
    checkOrganizationEvents,
    ORGANIZATION_STAGE,
    MIN_REBELLION_INFLUENCE,
    checkCoalitionRebellion,
    COALITION_REBELLION_CONFIG,
} from '../logic/organizationSystem';
import { calculateAllPenalties } from '../logic/organizationPenalties';
// 鑱斿悎鍙涗贡绯荤粺
import {
    createCoalitionRebelNation,
    createCoalitionRebellionEvent,
    calculateCoalitionPopLoss,
} from '../config/events';
import { evaluatePromiseTasks } from '../logic/promiseTasks';
import { debugLog, debugError, isDebugEnabled } from '../utils/debugFlags';
// 鍙涗贡浜嬩欢锛堜繚鐣欎簨浠跺垱寤哄嚱鏁帮級
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
// 缁忔祹鎸囨爣绯荤粺
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
    ensureFrontDefaults,
    plunderResourceNode,
    getPlayerSide,
    getEnemySide,
    summarizeFrontState,
} from '../logic/diplomacy/frontSystem';
import { processCombatRound, calculateRoundSupplyCost, createBattle, selectBattleParticipants, ensureBattleDefaults, autoSelectTactic } from '../logic/diplomacy/battleSystem';
import { getCorpsGeneral, awardGeneralXP, getCorpsTotalUnits } from '../logic/diplomacy/corpsSystem';
import { ensureAIMilitaryState, syncAINationMilitary, evaluateAIFrontPlan, evaluateGeneralBattleProposal, allocateAICorpsToFronts, applyAICorpsAllocation } from '../logic/diplomacy/aiWar';
import { calculateWarPlunder } from '../logic/diplomacy/warEconomy';
import { createBattleProposalEvent } from '../config/events/diplomaticEvents';

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

const formatUnitSummary = (unitMap = {}) => {
    return Object.entries(unitMap)
        .map(([unitId, count]) => {
            const unitName = UNIT_TYPES[unitId]?.name || unitId;
            return `${unitName} x${count}`;
        })
        .join('、');
};

const getResourceDisplayName = (resourceKey) => {
    if (!resourceKey) return '未知资源';
    return RESOURCES[resourceKey]?.name || String(resourceKey).replace(/_/g, ' ');
};

const getBuildingDisplayName = (buildingId) => {
    if (!buildingId) return '未知建筑';
    return BUILDINGS.find((building) => building.id === buildingId)?.name || String(buildingId).replace(/_/g, ' ');
};

const getFrontWarScoreTotal = (breakdown = {}) => (
    Number(breakdown?.battle || 0)
    + Number(breakdown?.advance || 0)
    + Number(breakdown?.economic || 0)
    + Number(breakdown?.homeland || 0)
);

const getBattleLossTotal = (losses = {}) => (
    Object.values(losses || {}).reduce((sum, count) => sum + Number(count || 0), 0)
);

/**
 * 鏍规嵁鍙敤澹叺鏁伴噺鍚屾鐜板焦閮ㄩ槦涓庤缁冮槦鍒?
 * [FIX] 绉婚櫎 autoRecruitEnabled 鍙傛暟 - 浜哄彛涓嶈冻瑙ｆ暎涓嶅啀瑙﹀彂鑷姩琛ュ叺
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
    // [FIX] 鍑忓皬瀹瑰樊鍊硷紝闃叉闀挎湡瓒呭憳瀵艰嚧鏃犻檺鐖嗗叺
    // 鍙繚鐣?鐐瑰宸敤浜庡鐞嗘瘯涓氭椂鐨勬椂搴忛棶棰?
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
    // [FIX] 绉婚櫎 unitsToRequeue 閫昏緫 - 浜哄彛涓嶈冻瀵艰嚧鐨勮В鏁ｄ笉搴旇Е鍙戣嚜鍔ㄨˉ鍏?
    // 鍙湁鎴樻枟鎹熷け(閫氳繃 AUTO_REPLENISH_LOSSES 鏃ュ織)鎵嶅簲瑙﹀彂鑷姩琛ュ叺

    // [FIX] 鍑忓皬瀹瑰樊鍊硷紝鍙负鍗冲皢姣曚笟鐨勫崟浣嶄繚鐣欏宸?
    // 鍩虹瀹瑰樊浠?鍑忓埌1锛岄槻姝㈤暱鏈熻秴鍛樺鑷存棤闄愮垎鍏?
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

        // [FIX] 绉婚櫎鑷姩閲嶆柊鎺掗槦閫昏緫 - 浜哄彛涓嶈冻瀵艰嚧鐨勮В鏁ｆ槸鐪熸鐨勮В鏁?
        // 涓嶅簲璇ユ秷鑰楄祫婧愰噸鏂版嫑鍕燂紝杩欐牱鍋氫細瀵艰嚧鏃犻檺寰幆

        const armyEntries = Object.entries(updatedArmy)
            .filter(([, count]) => count > 0)
            .map(([unitId, count]) => ({
                unitId,
                count,
                popCost: getUnitPopulationCost(unitId),
                epoch: UNIT_TYPES[unitId]?.epoch ?? 0,
                trainingTime: UNIT_TYPES[unitId]?.trainingTime || 1, // [NEW] 璁板綍璁粌鏃堕棿鐢ㄤ簬閲嶆柊鎺掗槦
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

            // [FIX] 宸茬Щ闄よ嚜鍔ㄩ噸鏂版帓闃熼€昏緫
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
        // [FIX] 宸茬Щ闄?unitsToRequeue - 浜哄彛涓嶈冻瑙ｆ暎涓嶅簲瑙﹀彂鑷姩琛ュ叺
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
 * 娓告垙寰幆閽╁瓙
 * 澶勭悊娓告垙鐨勬牳蹇冨惊鐜€昏緫
 * @param {Object} gameState - 娓告垙鐘舵€佸璞?
 * @param {Function} addLog - 娣诲姞鏃ュ織鍑芥暟
 * @param {Object} actions - 娓告垙鎿嶄綔鍑芥暟闆?
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
        priceControls, // [NEW] 浠锋牸绠″埗璁剧疆
        decrees,
        gameSpeed,
        isPaused,
        setIsPaused,
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
        setRates,
        setTaxes,
        setClassApproval,
        classApproval,
        setApprovalBreakdown, // [NEW] 鐢ㄤ簬淇濆瓨 simulation 杩斿洖鐨勬弧鎰忓害鍒嗚В鏁版嵁
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
        // 缁忔祹鎸囨爣
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
        rulingCoalition, // 鎵ф斂鑱旂洘鎴愬憳
        legitimacy, // 褰撳墠鍚堟硶鎬у€?
        setLegitimacy, // 鍚堟硶鎬ф洿鏂板嚱鏁?
        setModifiers, // Modifiers鏇存柊鍑芥暟
        difficulty, // 娓告垙闅惧害
        officials, // 瀹樺憳绯荤粺
        setOfficials, // 瀹樺憳鐘舵€佹洿鏂板嚱鏁?
        officialsSimCursor,
        setOfficialsSimCursor,
        officialCapacity, // 瀹樺憳瀹归噺
        setOfficialCapacity, // 瀹樺憳瀹归噺鏇存柊鍑芥暟
        ministerAssignments,
        ministerAutoExpansion,
        lastMinisterExpansionDay,
        setLastMinisterExpansionDay,
        setFiscalActual, // [NEW] realized fiscal numbers per tick
        setDailyMilitaryExpense, // [NEW] store simulation military expense for UI
        overseasInvestments, // 娴峰鎶曡祫鍒楄〃
        setOverseasInvestments, // 娴峰鎶曡祫鏇存柊鍑芥暟
        setDiplomacyOrganizations, // [FIX] Add missing setter
        foreignInvestments, // [NEW] 鐢ㄤ簬 simulation 璁＄畻
        setForeignInvestments, // [FIX] Destructure setter
    } = gameState;

    // 浣跨敤ref淇濆瓨鏈€鏂扮姸鎬侊紝閬垮厤闂寘闂
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
        rulingCoalition, // 鎵ф斂鑱旂洘鎴愬憳
        legitimacy, // 褰撳墠鍚堟硶鎬у€?
        difficulty, // 娓告垙闅惧害
        officials,
        officialCapacity, // [FIX] 娣诲姞瀹樺憳瀹归噺锛岀敤浜?getCabinetStatus 璁＄畻
        ministerAssignments,
        ministerAutoExpansion,
        lastMinisterExpansionDay,
        activeDecrees, // [NEW] Pass activeDecrees to simulation
        quotaTargets, // [NEW] Planned Economy targets
        expansionSettings, // [NEW] Free Market settings
        priceControls, // [NEW] 浠锋牸绠″埗璁剧疆
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

    // [NEW] 娴峰鎶曡祫鍒嗘壒澶勭悊鐘舵€佽拷韪?
    const outboundInvestmentBatchRef = useRef({ offset: 0, lastProcessDay: null });
    const inboundInvestmentBatchRef = useRef({ offset: 0, lastProcessDay: null }); // [NEW] 澶栧浗瀵规垜鍥芥姇璧?

    // ========== 鍘嗗彶鏁版嵁 Ref 绠＄悊 ==========
    // 浣跨敤 Ref 瀛樺偍楂橀鏇存柊鐨勫巻鍙叉暟鎹紝閬垮厤姣忓抚瑙﹀彂 React 閲嶆覆鏌?
    // 浠呭湪鑺傛祦闂撮殧鍒拌揪鏃跺悓姝ュ埌 State 渚?UI 鏄剧ず
    const classWealthHistoryRef = useRef(classWealthHistory || {});
    const classNeedsHistoryRef = useRef(classNeedsHistory || {});
    const marketHistoryRef = useRef({
        price: market?.priceHistory || {},
        supply: market?.supplyHistory || {},
        demand: market?.demandHistory || {},
        supplyBreakdown: [], // 鐢熶骇鏁版嵁鍘嗗彶锛堢敤浜庡姩鎬丳PI绡瓙锛?
    });

    // 鍒濆鍖?鍚屾 Ref
    useEffect(() => {
        if (classWealthHistory) classWealthHistoryRef.current = classWealthHistory;
    }, []); // 浠呮寕杞芥椂鍚屾锛屽悗缁敱 loop 缁存姢

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

    // ========== 鍘嗗彶鏁版嵁鑺傛祦 ==========
    // 姣?HISTORY_UPDATE_INTERVAL 涓?tick 鎵嶆洿鏂颁竴娆″巻鍙叉暟鎹?State
    const historyUpdateCounterRef = useRef(0);
    const HISTORY_UPDATE_INTERVAL = 5; // 姣?涓猼ick鍚屾涓€娆″巻鍙叉暟鎹埌UI锛堟樉钁楀噺灏戦噸娓叉煋锛?

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
            rulingCoalition, // 鎵ф斂鑱旂洘鎴愬憳
            legitimacy, // 褰撳墠鍚堟硶鎬у€?
            difficulty, // 娓告垙闅惧害
            officials,
            officialsSimCursor,
            // [FIX] 娣诲姞鍐呴榿鏈哄埗鎵€闇€鐨勭姸鎬?
            activeDecrees, // 褰撳墠鐢熸晥鐨勬敼闈╂硶浠?
            expansionSettings, // 鑷敱甯傚満鎵╁紶璁剧疆
            quotaTargets, // 璁″垝缁忔祹鐩爣閰嶉
            officialCapacity, // 瀹樺憳瀹归噺
            ministerAssignments,
            ministerAutoExpansion,
            lastMinisterExpansionDay,
            priceControls, // [NEW] 璁″垝缁忔祹浠锋牸绠″埗璁剧疆
            foreignInvestments, // [NEW] 娴峰鎶曡祫
            diplomaticReputation, // [FIX] 澶栦氦澹拌獕
            militaryCorps, // [NEW] 鍐涘洟鐘舵€?
            generals, // [NEW] 灏嗛鐘舵€?
            activeFronts, // [NEW] 娲昏穬鎴樼嚎
            activeBattles, // [NEW] 杩涜涓殑鎴樻枟
        };
    }, [resources, market, buildings, buildingUpgrades, population, popStructure, maxPopBonus, epoch, techsUnlocked, decrees, gameSpeed, nations, livingStandardStreaks, migrationCooldowns, taxShock, army, militaryQueue, jobFill, jobsAvailable, activeBuffs, activeDebuffs, taxPolicies, classWealthHistory, classNeedsHistory, militaryWageRatio, classApproval, daysElapsed, activeFestivalEffects, lastFestivalYear, isPaused, autoSaveInterval, isAutoSaveEnabled, lastAutoSaveTime, merchantState, tradeRoutes, diplomacyOrganizations, vassalDiplomacyQueue, vassalDiplomacyHistory, tradeStats, actions, actionCooldowns, actionUsage, promiseTasks, activeEventEffects, eventEffectSettings, rebellionStates, classInfluence, totalInfluence, birthAccumulator, stability, rulingCoalition, legitimacy, difficulty, officials, officialsSimCursor, activeDecrees, expansionSettings, quotaTargets, officialCapacity, ministerAssignments, ministerAutoExpansion, lastMinisterExpansionDay, priceControls, foreignInvestments, diplomaticReputation, militaryCorps, generals, activeFronts, activeBattles]);
    // Note: classWealth is intentionally excluded from dependencies to prevent infinite loop
    // when setClassWealth is called inside Promise chains within this effect.
    // The latest classWealth value is available via stateRef.current.classWealth

    // 鐩戝惉鍥藉鍒楄〃鍙樺寲锛岃嚜鍔ㄦ竻鐞嗘棤鏁堢殑璐告槗璺嚎鍜屽晢浜烘淳椹伙紙淇鏆傚仠鐘舵€佷笅鏃犳硶娓呯悊鐨勯棶棰橈級
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
                        console.log('[鍟嗕汉绯荤粺] 宸叉竻绌烘墍鏈夋棤鏁堢殑鍟嗕汉娲鹃┗锛岀郴缁熷皢閲嶆柊鍒嗛厤鍟嗕汉');
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

    // 娓告垙鏍稿績寰幆
    useEffect(() => {
        // 鍒濆鍖栦綔寮婄爜绯荤粺
        if (process.env.NODE_ENV !== 'production') {
            initCheatCodes(gameState, addLog, { setMerchantState, setTradeRoutes });
        }

        // 鏆傚仠鏃朵笉璁剧疆娓告垙寰幆瀹氭椂鍣紝浣嗚嚜鍔ㄤ繚瀛樺畾鏃跺櫒闇€瑕佸崟鐙鐞?
        if (isPaused) {
            // 璁剧疆鐙珛鐨勮嚜鍔ㄤ繚瀛樺畾鏃跺櫒锛堟瘡60绉掓鏌ヤ竴娆★級
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

        // 璁＄畻 Tick 闂撮殧锛氬熀浜庢父鎴忛€熷害鍔ㄦ€佽皟鏁?
        // 1鍊嶉€?= 1000ms锛?鍊嶉€?= 500ms锛?鍊嶉€?= 200ms
        const tickInterval = 1000 / Math.max(1, gameSpeed);

        const timer = setInterval(() => {
            const current = stateRef.current;

            // 鑷姩瀛樻。妫€娴嬶細鍗充娇鏆傚仠涔熺収甯歌繍琛岋紝閬垮厤闀挎椂闂村仠鐣欎涪杩涘害
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
            // 娉ㄦ剰锛氳繖閲屼娇鐢?1 鑰岄潪 current.gameSpeed锛屽洜涓虹幇鍦ㄦ瘡娆?Tick 鍙帹杩?1 澶?
            const nextCalendar = getCalendarInfo((current.daysElapsed || 0) + 1);

            // 濡傛灉褰撳墠骞翠唤澶т簬涓婃搴嗗吀骞翠唤锛屼笖鍗冲皢璺ㄨ秺鎴栧凡缁忚法瓒婃柊骞?
            if (currentCalendar.year > (current.lastFestivalYear || 0)) {
                // 鏂扮殑涓€骞村紑濮嬶紝瑙﹀彂搴嗗吀
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
                        addLog('庆典「' + effect.name + '」的影响已消退。');
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

            // [NEW] 澶勭悊娉曚护杩囨湡
            const currentActiveDecrees = current.activeDecrees || {};
            if (Object.keys(currentActiveDecrees).length > 0) {
                const currentDay = current.daysElapsed || 0;
                const { updatedDecrees, expiredDecrees } = processDecreeExpiry(currentActiveDecrees, currentDay);

                if (expiredDecrees.length > 0) {
                    // 鏇存柊娉曚护鐘舵€?
                    setActiveDecrees(updatedDecrees);
                    // 鏇存柊鏈湴寮曠敤浠ョ‘淇濆綋鍓峵ick浣跨敤姝ｇ‘鐨勬硶浠ょ姸鎬?
                    current.activeDecrees = updatedDecrees;
                    stateRef.current.activeDecrees = updatedDecrees;

                    // 璁板綍杩囨湡娉曚护鏃ュ織
                    expiredDecrees.forEach(decreeId => {
                        const decree = getAllTimedDecrees()[decreeId];
                        const decreeName = decree?.name || decreeId;
                        addLog('法令[' + decreeName + ']已到期结束。');
                    });
                }
            }

            // 鎵ц娓告垙妯℃嫙
            // 銆愬叧閿€戝己鍒跺皢 gameSpeed 璁句负 1锛岀‘淇濆崟娆?Tick 鍙绠?1 涓崟浣嶆椂闂寸殑浜у嚭
            // 鍘熷洜锛氭垜浠凡缁忛€氳繃璋冩暣 setInterval 鐨勯鐜囨潵瀹炵幇鍔犻€燂紙鏃堕棿娴侊級
            // 濡傛灉杩欓噷涓嶅綊涓€鍖栵紝simulateTick 鍐呴儴浼氬啀娆′箻浠?gameSpeed锛屽鑷村€嶇巼鍙犲姞
            // 渚嬪锛?鍊嶉€熸椂锛岄鐜囧凡缁忔槸 5 鍊嶏紙200ms/娆★級锛屽鏋滃啀浼?gameSpeed=5锛?
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

            // 瀹樺憳钖按璁＄畻
            const officialDailySalary = calculateTotalDailySalary(current.officials || []);
            const canAffordOfficials = (current.resources?.silver || 0) >= officialDailySalary;

            // Build simulation parameters - 鎵嬪姩鍒楀嚭鍙簭鍒楀寲瀛楁锛屾帓闄ゅ嚱鏁板璞★紙濡?actions锛?
            // 杩欐牱鍙互姝ｇ‘鍚敤 Web Worker 鍔犻€燂紝閬垮厤 DataCloneError
            const simulationParams = {
                // 鍩虹娓告垙鏁版嵁
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

                // 鍐涗簨鐩稿叧
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
                // 杩欑‘淇濅富瀵煎垽瀹氫笌 UI 鏄剧ず涓€鑷?
                cabinetStatus: (() => {
                    // 涓?App.jsx Line 1130 淇濇寔涓€鑷寸殑璁＄畻閫昏緫
                    // 浣跨敤 hook 浣滅敤鍩熶腑鐨?jobsAvailable锛堣€岄潪 current.jobsAvailable锛?
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
                priceControls: current.priceControls, // [NEW] 浠锋牸绠″埗璁剧疆
                taxPolicies: current.taxPolicies || {},
                livingStandardStreaks: current.livingStandardStreaks,
                migrationCooldowns: current.migrationCooldowns,
                previousTaxShock: current.taxShock, // [NEW] 绱Н绋庢敹鍐插嚮鍘嗗彶

                // 璐告槗
                merchantState: current.merchantState,
                tradeRoutes: current.tradeRoutes,
                tradeStats: current.tradeStats,
                tradeRouteTax: current.tradeStats?.tradeRouteTax || 0, // Pass last tick's value for continuity, but worker re-calculates

                // Buff/Debuff
                activeBuffs: current.activeBuffs,
                activeDebuffs: current.activeDebuffs,

                // 鍘嗗彶鏁版嵁 (Pass from Ref for latest data without waiting for State)
                classWealthHistory: classWealthHistoryRef.current,
                classNeedsHistory: classNeedsHistoryRef.current,

                // 鏃堕棿鍜岃妭鏃?
                daysElapsed: current.daysElapsed,
                activeFestivalEffects: current.activeFestivalEffects || [],
                lastFestivalYear: current.lastFestivalYear,

                // 琛屽姩鍐峰嵈
                actionCooldowns: current.actionCooldowns,
                actionUsage: current.actionUsage,
                promiseTasks: current.promiseTasks,

                // 浜嬩欢鏁堟灉
                activeEventEffects: current.activeEventEffects,
                eventEffectSettings: current.eventEffectSettings,

                // 鍙涗贡绯荤粺
                rebellionStates: current.rebellionStates,

                // 鎵ф斂鑱旂洘
                rulingCoalition: current.rulingCoalition,
                legitimacy: current.legitimacy,

                // 闅惧害
                difficulty: current.difficulty,

                // 娓告垙閫熷害锛堝己鍒跺綊涓€鍖栵級
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

                // 瀹樺憳绯荤粺
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
            };

            const perfEnabled = typeof window !== 'undefined'
                ? (window.__PERF_LOG ?? process.env.NODE_ENV !== 'production')
                : process.env.NODE_ENV !== 'production';

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

            // Skip if a simulation is still running to avoid flooding the worker
            if (simInFlightRef.current) {
                if (perfEnabled) {
                    console.warn('[PerfTick] skip day=' + (current.daysElapsed || 0) + ' (simulation busy)');
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
                // console.log('馃數馃數馃數 [GAME-LOOP] runSimulation 瀹屾垚! result:', result ? 'OK' : 'NULL', 'skipped:', result?.__skipped);
                const perfSimMs = ((typeof performance !== 'undefined' && performance.now)
                    ? performance.now()
                    : Date.now()) - perfTickStart;
                simInFlightRef.current = false;
                if (!result || result.__skipped) {
                    // console.log('馃數馃數馃數 [GAME-LOOP] 璺宠繃澶勭悊: result =', result, 'skipped =', result?.__skipped);
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

                // 浠ヤ笅鏄鐞嗘ā鎷熺粨鏋滅殑浠ｇ爜锛屽寘瑁呭湪 then 鍥炶皟涓?

                // 鏇存柊 Modifiers 鐘舵€佷緵 UI 鏄剧ず
                setModifiers(result.modifiers || {});

                const soldierPopulationAfterEvents = Number.isFinite(result.popStructure?.soldier)
                    ? result.popStructure.soldier
                    : null;
                // [FIX] 浣跨敤鎴樻枟鍚庣殑鍐涢槦鐘舵€侊紝鑰岄潪鎴樻枟鍓嶇殑 current.army
                let armyStateForQueue = result.army || current.army || {};
                let queueOverrideForManpower = null;

                if (soldierPopulationAfterEvents !== null) {
                    const manpowerSync = syncArmyWithSoldierPopulation(
                        armyStateForQueue,
                        current.militaryQueue || [],
                        soldierPopulationAfterEvents
                        // [FIX] 绉婚櫎 autoRecruitEnabled 鍙傛暟 - 浜哄彛涓嶈冻瑙ｆ暎涓嶅啀瑙﹀彂鑷姩琛ュ叺
                    );

                    if (manpowerSync.updatedArmy) {
                        armyStateForQueue = manpowerSync.updatedArmy;
                        setArmy(manpowerSync.updatedArmy);
                    }

                    if (manpowerSync.updatedQueue) {
                        queueOverrideForManpower = manpowerSync.updatedQueue;
                    }

                    // [FIX] 浜哄彛涓嶈冻瀵艰嚧鐨勮В鏁ｏ細鐩存帴瑙ｆ暎锛屼笉瑙﹀彂鑷姩琛ュ叺
                    // 鍙湁鎴樻枟鎹熷け锛堥€氳繃 AUTO_REPLENISH_LOSSES 鏃ュ織锛夋墠瑙﹀彂鑷姩琛ュ叺
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
                const resourceShortages = {}; // 璁板綍璧勬簮鐭己锛堢敱 simulation 璁板綍鏃惰繖閲屼负绌猴級

                // --- Realized fiscal tracking (must match visible treasury changes) ---
                // We must baseline against the treasury BEFORE this tick starts (current.resources.silver).
                // Otherwise we would only measure extra deductions done in this hook, not the full tick delta.
                const treasuryAtTickStart = Number(current.resources?.silver || 0);
                let officialSalaryPaid = 0;
                let forcedSubsidyPaid = 0;
                let forcedSubsidyUnpaid = 0;

                // 鎵ｉ櫎瀹樺憳钖按锛堝疄浠橈細鏈€澶氭墸鍒?锛?
                // 濡傛灉钖按涓鸿礋鏁帮紝鍒欎粠瀹樺憳閭ｉ噷鏀跺彇璐圭敤锛堥渶瑕佸湪simulation涓鐞嗗畼鍛樿储瀵屾墸闄わ級
                if (officialDailySalary > 0) {
                    const before = Number(adjustedResources.silver || 0);
                    const pay = Math.min(officialDailySalary, before);
                    adjustedResources.silver = before - pay;
                    officialSalaryPaid = pay;
                } else if (officialDailySalary < 0) {
                    // 璐熻柂閰細浠庡畼鍛橀偅閲屾敹閽卞埌鍥藉簱
                    // 瀹為檯鏀跺埌鐨勯噾棰濅細鍦╯imulation涓牴鎹畼鍛樿储瀵岃绠?
                    // 杩欓噷鍏堣褰曢鏈熸敹鍏ワ紙璐熸暟锛夛紝瀹為檯鏀跺叆浼氬湪simulation涓洿鏂?
                    officialSalaryPaid = officialDailySalary; // 璐熸暟琛ㄧず棰勬湡鏀跺叆
                }

                // 澶勭悊寮哄埗琛ヨ创鏁堟灉锛堟瘡鏃ヤ粠鍥藉簱鏀粯缁欐寚瀹氶樁灞傦級
                const forcedSubsidies = Array.isArray(current.activeEventEffects?.forcedSubsidy)
                    ? current.activeEventEffects.forcedSubsidy
                    : [];

                // 璁＄畻琛ヨ创瀵瑰悇闃跺眰璐㈠瘜鐨勫鍔犻噺锛堢◢鍚庡悎骞跺埌 adjustedClassWealth锛?
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

                            // 璁板綍闃跺眰璐㈠瘜澧炲姞閲?
                            if (stratumKey && actualPayment > 0) {
                                subsidyWealthDelta[stratumKey] = (subsidyWealthDelta[stratumKey] || 0) + actualPayment;
                            }
                        }
                    });
                    // forcedSubsidy 鐨勫ぉ鏁伴€掑噺鍜岃繃鏈熸竻鐞嗗湪涓嬮潰缁熶竴澶勭悊
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

                // === 璇︾粏璐㈡斂鏃ュ織 ===
                // 璁板綍鎵€鏈夊奖鍝嶅浗搴撶殑鏀跺叆鍜屾敮鍑洪」
                const treasuryAfterDeductions = Number(adjustedResources.silver || 0);
                const netTreasuryChange = treasuryAfterDeductions - treasuryAtTickStart;

                // console.group('馃挵 [璐㈡斂璇︽儏] Tick ' + (current.daysElapsed || 0));
                // console.log('馃彟 鍥藉簱璧峰浣欓:', treasuryAtTickStart.toFixed(2), '閾跺竵');

                // 浠巗imulation杩斿洖鐨勭◣鏀舵暟鎹?
                const taxes = result.taxes || {};
                const breakdown = taxes.breakdown || {};

                // console.group('馃搱 鏀跺叆椤?);
                // console.log('  浜哄ご绋?', (breakdown.headTax || 0).toFixed(2));
                // console.log('  浜ゆ槗绋?', (breakdown.industryTax || 0).toFixed(2));
                // console.log('  钀ヤ笟绋?', (breakdown.businessTax || 0).toFixed(2));
                // console.log('  鍏崇◣:', (breakdown.tariff || 0).toFixed(2));
                // if (breakdown.warIndemnity) console.log('  鎴樹簤璧旀鏀跺叆:', breakdown.warIndemnity.toFixed(2));
                // if (breakdown.tradeRouteTax) console.log('  璐告槗璺嚎绋庢敹:', breakdown.tradeRouteTax.toFixed(2));
                // if (breakdown.policyIncome) console.log('  鏀夸护鏀剁泭:', breakdown.policyIncome.toFixed(2));
                // if (breakdown.priceControlIncome) console.log('  浠锋牸绠″埗鏀跺叆:', breakdown.priceControlIncome.toFixed(2));
                const effectiveFiscalIncome = typeof breakdown.totalFiscalIncome === 'number'
                    ? breakdown.totalFiscalIncome
                    : (breakdown.headTax || 0) + (breakdown.industryTax || 0) +
                    (breakdown.businessTax || 0) + (breakdown.tariff || 0) +
                    (breakdown.warIndemnity || 0);
                const totalIncome = effectiveFiscalIncome + (breakdown.priceControlIncome || 0) +
                    (breakdown.tradeRouteTax || 0);
                // console.log('  鉁?鎬绘敹鍏?', totalIncome.toFixed(2));
                // if (typeof breakdown.incomePercentMultiplier === 'number') {
                //     console.log('  馃搶 鏀跺叆鍔犳垚鍊嶇巼:', `脳${breakdown.incomePercentMultiplier.toFixed(2)}`);
                // }
                // if (taxes.efficiency && taxes.efficiency < 1) {
                //     console.log('  馃搳 绋庢敹鏁堢巼:', (taxes.efficiency * 100).toFixed(1) + '%',
                //         `(鎹熷け: ${(totalIncome * (1 - taxes.efficiency)).toFixed(2)} 閾跺竵)`);
                // }
                // console.groupEnd();

                // console.group('馃搲 鏀嚭椤?);

                // === 鍐涢槦鏀嚭锛堜娇鐢╯imulation杩斿洖鐨勭湡瀹炴暟鎹級===
                // 娉ㄦ剰锛歴imulation.js涓凡缁忓鐞嗕簡璧勬簮璐拱銆佹椂浠ｅ姞鎴愩€佽妯℃儵缃氥€佸啗楗峰€嶇巼
                const simulationArmyCost = result.dailyMilitaryExpense?.dailyExpense || 0;

                if (simulationArmyCost > 0) {
                    // console.group('  鍐涢槦缁存姢锛坰imulation璁＄畻锛?);
                    if (result.dailyMilitaryExpense) {
                        const armyData = result.dailyMilitaryExpense;
                        // console.log(`    鍩虹璧勬簮鎴愭湰: ${(armyData.resourceCost || 0).toFixed(2)} 閾跺竵`);
                        // console.log(`    鏃朵唬绯绘暟: 脳${(armyData.epochMultiplier || 1).toFixed(2)}`);
                        // console.log(`    瑙勬ā鎯╃綒: 脳${(armyData.scalePenalty || 1).toFixed(2)}`);
                        // console.log(`    鍐涢シ鍊嶇巼: 脳${(armyData.wageMultiplier || 1).toFixed(2)}`);
                        // console.log(`    馃挵 瀹為檯鏀嚭: ${simulationArmyCost.toFixed(2)} 閾跺竵`);

                        // 鏄剧ず璧勬簮娑堣€楁槑缁?
                        if (armyData.resourceConsumption && Object.keys(armyData.resourceConsumption).length > 0) {
                            // console.log(`    娑堣€楄祫婧?`, armyData.resourceConsumption);
                        }
                    } else {
                        // console.log(`    馃挵 鎬绘敮鍑? ${simulationArmyCost.toFixed(2)} 閾跺竵`);
                    }
                    // console.groupEnd();
                }

                // 淇濈暀useGameLoop涓殑鍐涢槦缁存姢璁＄畻锛堜粎鐢ㄤ簬瀵规瘮锛屾爣璁颁负"鏈湴璁＄畻"锛?
                if (false) { // 绂佺敤鏃х殑缁熻鏂瑰紡
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
                        console.group('  鍐涢槦缁存姢锛堟湰鍦拌绠?- 浠呬緵鍙傝€冿級');
                        Object.entries(maintenanceResources).forEach(([resource, cost]) => {
                            if (resource === 'silver') {
                                console.log(`    ${resource}: ${cost.toFixed(2)}`);
                            } else {
                                const price = result.market?.prices?.[resource] || 1;
                                const silverValue = cost * price;
                                console.log(`    ${resource}: ${cost.toFixed(2)} (浠峰€?${silverValue.toFixed(2)} 閾跺竵)`);
                            }
                        });
                        console.log(`    馃挵 鎬讳环鍊? ${totalMaintenanceSilverValue.toFixed(2)} 閾跺竵`);
                        console.groupEnd();
                    }
                }

                if (breakdown.subsidy) console.log('  绋庢敹琛ヨ创:', breakdown.subsidy.toFixed(2));
                if (breakdown.tariffSubsidy) console.log('  鍏崇◣琛ヨ创:', breakdown.tariffSubsidy.toFixed(2));
                if (officialSalaryPaid > 0) console.log('  瀹樺憳钖扛:', officialSalaryPaid.toFixed(2));
                if (forcedSubsidyPaid > 0) console.log('  寮哄埗琛ヨ创:', forcedSubsidyPaid.toFixed(2));
                if (breakdown.policyExpense) console.log('  鏀夸护鏀嚭:', breakdown.policyExpense.toFixed(2));
                if (breakdown.priceControlExpense) console.log('  浠锋牸绠″埗鏀嚭:', breakdown.priceControlExpense.toFixed(2));

                // 璧勬簮鐭己璀﹀憡锛堟殏鏃朵繚鐣欑敤浜庤皟璇曪級
                if (Object.keys(resourceShortages).length > 0) {
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
                console.log('  鉂?鎬绘敮鍑?', totalExpense.toFixed(2));
                console.groupEnd();

                console.log('理论净变化:', (totalIncome - totalExpense).toFixed(2), '银币/天');
                console.log('馃彟 鍥藉簱缁撴潫浣欓:', treasuryAfterDeductions.toFixed(2), '閾跺竵');
                console.log('馃挼 瀹為檯鍑€鍙樺寲:', netTreasuryChange.toFixed(2), '閾跺竵');

                // [DEBUG] Military Specific Trace
                if (result._debug?.militaryDebugInfo) {
                    console.log('鈿旓笍 [GameLoop] Military Debug:', result._debug.militaryDebugInfo);
                }
                const armyCostSim = result.dailyMilitaryExpense?.dailyExpense || 0;
                console.log('鈿旓笍 [GameLoop] Reported Military Cost:', armyCostSim);

                // === 鏄剧ずsimulation涓殑閾跺竵鍙樺寲杩借釜 ===
                // if (result._debug?.silverChangeLog && result._debug.silverChangeLog.length > 0) {
                //     console.group('馃攳 閾跺竵鍙樺寲璇︾粏杩借釜锛坰imulation鍐呴儴锛?);
                //     console.log('  璧峰浣欓:', (result._debug.startingSilver || 0).toFixed(2), '閾跺竵');
                //     result._debug.silverChangeLog.forEach((log, index) => {
                //         if (!log) return;
                //         const amount = log.amount ?? 0;
                //         const balance = log.balance ?? 0;
                //         const sign = amount >= 0 ? '+' : '';
                //         console.log(`  ${index + 1}. ${log.reason}: ${sign}${amount.toFixed(2)} 閾跺竵 (浣欓: ${balance.toFixed(2)})`);
                //     });
                //     console.log('  缁撴潫浣欓:', (result._debug.endingSilver || 0).toFixed(2), '閾跺竵');
                //     const simulationChange = (result._debug.endingSilver || 0) - (result._debug.startingSilver || 0);
                //     console.log('  馃挵 Simulation鍑€鍙樺寲:', simulationChange.toFixed(2), '閾跺竵');
                //     console.groupEnd();
                // }

                // === useGameLoop鏈湴鎵ｉ櫎锛坰imulation涔嬪悗锛?==
                const useGameLoopDeductions = [];
                if (officialSalaryPaid > 0) {
                    useGameLoopDeductions.push({ reason: '瀹樺憳钖扛', amount: -officialSalaryPaid });
                }
                if (forcedSubsidyPaid > 0) {
                    useGameLoopDeductions.push({ reason: '寮哄埗琛ヨ创', amount: -forcedSubsidyPaid });
                }

                // if (useGameLoopDeductions.length > 0) {
                //     console.group('馃敡 useGameLoop鏈湴鎵ｉ櫎锛坰imulation涔嬪悗锛?);
                //     useGameLoopDeductions.forEach((item, index) => {
                //         const sign = item.amount >= 0 ? '+' : '';
                //         console.log(`  ${index + 1}. ${item.reason}: ${sign}${item.amount.toFixed(2)} 閾跺竵`);
                //     });
                //     const totalLocalDeduction = useGameLoopDeductions.reduce((sum, item) => sum + item.amount, 0);
                //     console.log('  馃挵 鏈湴鎵ｉ櫎鎬昏:', totalLocalDeduction.toFixed(2), '閾跺竵');
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
                const militaryLogKeys = ['鍐涢槦缁存姢鏀嚭', '鍐涢槦缁存姢鏀嚭锛堥儴鍒嗘敮浠橈級', 'militaryPay', 'expense_army_maintenance', 'expense_army_maintenance_partial'];
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

                // ========== 闄勫焊姣忔棩鏇存柊锛堟湞璐′笌鐙珛鍊惧悜锛?- 绉诲埌涓籹etResources涔嬪墠 ==========
                // [FIX] 灏嗛檮搴告湞璐℃敹鍏ュ拰鎺у埗鎴愭湰鏁村悎鍒?adjustedResources 鍜?auditEntries 涓?
                // 閬垮厤浜х敓宸ㄥぇ鐨?瀵硅处宸"
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
                        // 淇濆瓨鏇存柊鍚庣殑鍥藉鍒楄〃锛岀◢鍚庡簲鐢?
                        if (vassalUpdateResult.nations) {
                            vassalNationsUpdated = vassalUpdateResult.nations;
                        }

                        // [FIX] 灏嗛檮搴告湞璐℃敹鍏ョ洿鎺ユ坊鍔犲埌 adjustedResources 鍜?auditEntries
                        if (vassalUpdateResult.tributeIncome > 0) {
                            adjustedResources.silver = (adjustedResources.silver || 0) + vassalUpdateResult.tributeIncome;
                            auditEntries.push({
                                amount: vassalUpdateResult.tributeIncome,
                                reason: 'vassal_tribute_cash',
                                meta: { source: 'vassal_system' },
                            });
                        }

                        // [FIX] 灏嗚祫婧愭湞璐＄洿鎺ユ坊鍔犲埌 adjustedResources
                        if (vassalUpdateResult.resourceTribute && Object.keys(vassalUpdateResult.resourceTribute).length > 0) {
                            Object.entries(vassalUpdateResult.resourceTribute).forEach(([res, amount]) => {
                                adjustedResources[res] = (adjustedResources[res] || 0) + amount;
                            });
                        }

                        // [FIX] 灏嗛檮搴告帶鍒舵垚鏈洿鎺ヤ粠 adjustedResources 鎵ｉ櫎骞舵坊鍔犲埌 auditEntries
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
                console.log('馃搵 瀹¤鍑€鍙樺寲:', auditDelta.toFixed(2), '閾跺竵');
                if (Math.abs(netTreasuryChange - auditDelta) > 0.1) {
                    console.warn('鈿狅笍 璀﹀憡锛氬璁″噣鍙樺寲涓庡疄闄呭噣鍙樺寲涓嶄竴鑷达紒宸紓:',
                        (netTreasuryChange - auditDelta).toFixed(2));
                }

                console.groupEnd();
                // === 璐㈡斂鏃ュ織缁撴潫 ===
                console.log('馃敶馃敶馃敶 [DEBUG-CHECKPOINT] 璐㈡斂鏃ュ織缁撴潫锛岀户缁墽琛?..');

                // ========== 缁忔祹鎸囨爣璁＄畻 ==========
                // 1. 鏇存柊浠锋牸鍘嗗彶锛堟瘡澶╋級
                const updatedPriceHistory = updatePriceHistory({
                    priceHistory,
                    currentPrices: market.prices,
                    maxLength: ECONOMIC_INDICATOR_CONFIG.priceHistory.maxLength,
                });
                setPriceHistory(updatedPriceHistory);

                // 2. 璁＄畻鍧囪　浠锋牸锛堟瘡10澶╋級
                let currentEquilibriumPrices = equilibriumPrices;
                if (daysElapsed % ECONOMIC_INDICATOR_CONFIG.equilibriumPrice.updateInterval === 0) {
                    currentEquilibriumPrices = calculateEquilibriumPrices({
                        priceHistory: updatedPriceHistory,
                        basePrices: getBasePrices(),
                        window: ECONOMIC_INDICATOR_CONFIG.equilibriumPrice.window,
                    });
                    setEquilibriumPrices(currentEquilibriumPrices);
                }

                // 3. 璁＄畻鎵€鏈夌粡娴庢寚鏍囷紙姣忓ぉ锛?
                console.group('馃幆 [ECONOMIC INDICATORS DEBUG] Day ' + (current.daysElapsed || 0));
                console.log('馃搳 Input Data:', {
                    classFinancialData: result.classFinancialData,
                    dailyInvestment: result.dailyInvestment,
                    dailyMilitaryExpense: result.dailyMilitaryExpense,
                    officials: current.officials?.length,
                    taxBreakdown: result.taxes?.breakdown,
                    demandBreakdown: market.demandBreakdown,
                    marketPrices: market.prices,
                });

                const indicators = calculateAllIndicators({
                    // 浠锋牸鏁版嵁
                    priceHistory: updatedPriceHistory,
                    equilibriumPrices: currentEquilibriumPrices,
                    marketPrices: market.prices,

                    // GDP鏁版嵁
                    classFinancialData: result.classFinancialData,
                    dailyInvestment: result.dailyInvestment || 0,
                    dailyOwnerRevenue: result.dailyOwnerRevenue || 0, // 鏂板锛氬缓绛戜骇鍑烘敹鍏?
                    dailyMilitaryExpense: result.dailyMilitaryExpense || 0,
                    officials: current.officials,
                    taxBreakdown: result.taxes?.breakdown || {},
                    demandBreakdown: result.market?.demandBreakdown || {}, // [FIX] 浣跨敤simulation杩斿洖鐨勬柊鏁版嵁
                    supplyBreakdown: result.market?.supplyBreakdown || {}, // [FIX] 浣跨敤simulation杩斿洖鐨勬柊鏁版嵁

                    // 鍘嗗彶鏁版嵁
                    previousIndicators: economicIndicators,
                    supplyBreakdownHistory: marketHistoryRef.current.supplyBreakdown, // 鏂板锛氱敓浜ф暟鎹巻鍙?
                });

                console.log('鉁?Calculated Indicators:', indicators);
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

                // [FIX] 涓嶈鍦ㄨ繖閲屽崟鐙瑂etNations锛屼細琚悗闈㈢殑nextNations瑕嗙洊
                // 闄勫焊绯荤粺鏇存柊鐨勫浗瀹跺垪琛ㄤ細鍦ㄥ悗闈笌nextNations鍚堝苟

                // 鏄剧ず闄勫焊绯荤粺鏃ュ織
                if (vassalLogs.length > 0) {
                    vassalLogs.forEach(log => addLog(log));
                }

                // 澶勭悊寮哄埗琛ヨ创鏁堟灉鐨勬瘡鏃ユ洿鏂?
                // 娉ㄦ剰锛氳繖閲屽彧澶勭悊 forcedSubsidy 鐨勯€掑噺鍜岃繃鏈燂紝涓嶅鐞嗗叾浠栨晥鏋滅殑鏇存柊
                // 鍏朵粬鏁堟灉锛坅pproval, stability绛夛級鐢?simulation.js 涓殑 applyActiveEventEffects 澶勭悊
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

                // 鍒涘缓闃跺眰璐㈠瘜瀵硅薄锛屽悎骞惰ˉ璐磋浆璐?
                let adjustedClassWealth = { ...result.classWealth };
                // 灏嗚ˉ璐村閲忔坊鍔犲埌闃跺眰璐㈠瘜
                Object.entries(subsidyWealthDelta).forEach(([key, delta]) => {
                    adjustedClassWealth[key] = (adjustedClassWealth[key] || 0) + delta;
                });
                let adjustedTotalWealth = Object.values(adjustedClassWealth).reduce((sum, val) => sum + val, 0);

                // 3. 鍥藉唴 -> 鍥藉鎶曡祫锛堟瘡10澶╄Е鍙戜竴娆★紝鍒嗘壒澶勭悊鎵€鏈夊€欓€夊浗瀹讹級
                // [NEW] 涓嶅啀閲囨牱锛岃€屾槸鎸変紭鍏堢骇鎺掑簭鍚庯紝姣忎釜 tick 澶勭悊 2 涓浗瀹?
                // 杩欐牱鍙互鍦ㄥ涓?tick 涓鐩栨墍鏈夌鍚堟潯浠剁殑鍥藉
                const effectiveDaysElapsed = current.daysElapsed || 0;

                // [NEW] 妫€鏌ユ槸鍚﹀簲璇ュ紑濮嬫柊鐨勬姇璧勫懆鏈燂紙姣?0澶╋級
                // [FIX] 鏀逛负鍩轰簬涓婃澶勭悊鏃堕棿鐨勭浉瀵硅Е鍙戯紝閬垮厤鍦ㄦ父鎴忎腑閫斿姞杞芥椂鏃犳硶瑙﹀彂
                const lastOutboundDay = outboundInvestmentBatchRef.current.lastProcessDay;
                const shouldStartNewCycle = lastOutboundDay === null
                    ? (effectiveDaysElapsed > 0) // 棣栨瑙﹀彂锛氱珛鍗宠Е鍙戯紙閬垮厤鍦ㄦ父鎴忎腑閫斿姞杞芥椂绛夊緟鐗瑰畾浣欐暟锛?
                    : (effectiveDaysElapsed - lastOutboundDay >= 10); // 鍚庣画瑙﹀彂锛氳窛绂讳笂娆″鐞?>= 10 澶?
                const isInActiveCycle = lastOutboundDay !== null &&
                    effectiveDaysElapsed - lastOutboundDay < 10 &&
                    effectiveDaysElapsed > lastOutboundDay;

                if (shouldStartNewCycle || isInActiveCycle) {
                    // 濡傛灉鏄柊鍛ㄦ湡鐨勫紑濮嬶紝閲嶇疆 offset
                    if (shouldStartNewCycle && outboundInvestmentBatchRef.current.lastProcessDay !== effectiveDaysElapsed) {
                        outboundInvestmentBatchRef.current.offset = 0;
                        outboundInvestmentBatchRef.current.lastProcessDay = effectiveDaysElapsed;
                    }

                    import('../logic/diplomacy/autonomousInvestment').then(({ selectOutboundInvestmentsBatch }) => {
                        // [FIX] 鐜╁鏁版嵁涓嶅湪 nations 鏁扮粍涓紝闇€瑕佹瀯寤鸿櫄鎷熺帺瀹跺浗瀹跺璞?
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
                            batchSize: 2, // 姣忎釜 tick 澶勭悊 2 涓浗瀹?
                            batchOffset: outboundInvestmentBatchRef.current.offset,
                        });

                        const { investments, hasMore, nextOffset } = result;

                        // [NEW] 鏇存柊鎵规鐘舵€?
                        outboundInvestmentBatchRef.current.offset = nextOffset;

                        // 濡傛灉娌℃湁鏇村鎵规浜嗭紝鏍囪鍛ㄦ湡缁撴潫
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

                // 4. 鍥藉 -> 鍥藉唴鎶曡祫锛堟瘡10澶╄Е鍙戜竴娆★紝閿欏紑5澶╋紝鍒嗘壒澶勭悊鎵€鏈夌鍚堟潯浠剁殑鎶曡祫鍥斤級
                // [NEW] 涓嶅啀閲囨牱锛岃€屾槸鎸変紭鍏堢骇鎺掑簭鍚庯紝姣忎釜 tick 澶勭悊 2 涓姇璧勫浗
                // [FIX] 鏀逛负鍩轰簬涓婃澶勭悊鏃堕棿鐨勭浉瀵硅Е鍙戯紝閬垮厤鍦ㄦ父鎴忎腑閫斿姞杞芥椂鏃犳硶瑙﹀彂
                const lastInboundDay = inboundInvestmentBatchRef.current.lastProcessDay;
                const shouldStartInboundCycle = lastInboundDay === null
                    ? (effectiveDaysElapsed > 0) // 棣栨瑙﹀彂锛氱珛鍗宠Е鍙戯紙閬垮厤鍦ㄦ父鎴忎腑閫斿姞杞芥椂绛夊緟鐗瑰畾浣欐暟锛?
                    : (effectiveDaysElapsed - lastInboundDay >= 10); // 鍚庣画瑙﹀彂锛氳窛绂讳笂娆″鐞?>= 10 澶?
                const isInInboundCycle = lastInboundDay !== null &&
                    effectiveDaysElapsed - lastInboundDay < 10 &&
                    effectiveDaysElapsed > lastInboundDay;

                debugLog('trade', '馃攳 [INBOUND-CYCLE] Day', effectiveDaysElapsed,
                    '- shouldStart:', shouldStartInboundCycle,
                    '- isInCycle:', isInInboundCycle,
                    '- lastProcessDay:', lastInboundDay,
                    '- offset:', inboundInvestmentBatchRef.current.offset);

                if (shouldStartInboundCycle || isInInboundCycle) {
                    debugLog('trade', '[INBOUND-CYCLE] 触发 inbound investment 检查');
                    import('../logic/diplomacy/autonomousInvestment').then(({ selectInboundInvestmentsBatch }) => {
                        // 寮€濮嬫柊鍛ㄦ湡鏃堕噸缃?offset
                        if (shouldStartInboundCycle && !isInInboundCycle) {
                            debugLog('trade', '馃攧 [INBOUND-CYCLE] 寮€濮嬫柊鍛ㄦ湡锛岄噸缃?offset');
                            inboundInvestmentBatchRef.current.offset = 0;
                            inboundInvestmentBatchRef.current.lastProcessDay = effectiveDaysElapsed;
                        }

                        // [FIX] 鐜╁鏁版嵁涓嶅湪 nations 鏁扮粍涓紝鐩存帴浠?current 鑾峰彇
                        const playerState = {
                            population: current.population,
                            wealth: current.resources?.silver || 0,
                            resources: current.resources,
                            buildings: current.buildings || {},
                            jobFill: current.jobFill,
                            id: 'player',
                            treaties: [], // 鐜╁鐨勬潯绾﹀瓨鍌ㄥ湪 nations 鏁扮粍涓殑瀵规柟鍥藉韬笂
                            vassalOf: null, // 鐜╁涓嶄細鏄檮搴?
                        };

                        debugLog('trade', '馃攳 [INBOUND-CYCLE] 璋冪敤 selectInboundInvestmentsBatch - offset:', inboundInvestmentBatchRef.current.offset);

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

                        debugLog('trade', '馃攳 [INBOUND-CYCLE] 杩斿洖缁撴灉 - investments:', investments.length, 'hasMore:', hasMore, 'nextOffset:', nextOffset);

                        // 鏇存柊鎵规鐘舵€?
                        inboundInvestmentBatchRef.current.offset = nextOffset;
                        if (!hasMore) {
                            // 鏈懆鏈熷鐞嗗畬姣曪紝娓呯┖ lastProcessDay
                            debugLog('trade', '[INBOUND-CYCLE] 本周期处理完毕');
                            inboundInvestmentBatchRef.current.lastProcessDay = null;
                        }

                        if (investments.length === 0) {
                            debugLog('trade', '鉂?[INBOUND-CYCLE] 娌℃湁鎶曡祫鍐崇瓥');
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

                                addLog('[外资建设] ' + investorNation.name + ' 在本国投资建设了 ' + building.name + '。');
                            }
                        });
                    }).catch(err => console.warn('AI investment error:', err));
                }

                // 鏉＄害缁存姢璐瑰凡鍦?simulation 鍐呯粺涓€鎵ｉ櫎骞惰璐︼紝閬垮厤涓荤嚎绋嬮噸澶嶆墸鍑忋€?

                // [MOVED] 闄勫焊姣忔棩鏇存柊宸茬Щ鑷充富 setResources 璋冪敤涔嬪墠锛岄伩鍏嶄骇鐢熷璐﹀樊棰?

                // ========== 瀹樺憳鎴愰暱绯荤粺锛堟瘡鏃ョ粡楠屼笌鍗囩骇锛?==========
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

                // ========== 瀹樺儦鏀垮彉妫€娴嬶紙鍩轰簬蹇犺瘹搴︾郴缁燂級 ==========
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

                            // 鏉′欢1锛氬繝璇氬害浣庝簬闃堝€间笖鎸佺画瓒冲澶╂暟
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
                        // 闄嶄綆鍩虹姒傜巼锛屾牴鎹繝璇氬害璋冩暣
                        const loyalty = target.official.loyalty ?? 75;
                        const loyaltyFactor = Math.max(0.5, (25 - loyalty) / 25); // 蹇犺瘹搴﹁秺浣庢鐜囪秺楂?
                        const triggerChance = Math.min(0.15, 0.02 * loyaltyFactor);

                        if (Math.random() < triggerChance) {
                            // [FIX] 娣诲姞瀹夊叏妫€鏌ワ細纭繚鐩爣瀹樺憳鏈夋湁鏁堢殑ID锛岄伩鍏嶆剰澶栧垹闄ゅ叾浠栧畼鍛?
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

                            addLog('[官僚政变] ' + target.official.name + ' 携资叛逃，成立了 ' + rebelNation.name + '。');
                        }
                    }
                }

                const nextPopStructure = coupOutcome?.popStructure || result.popStructure;
                const nextOfficials = coupOutcome?.officials || result.officials;
                const nextBuildings = coupOutcome?.buildings || result.buildings;
                const nextBuildingUpgrades = coupOutcome?.buildingUpgrades || result.buildingUpgrades;
                // [FIX] 鍚堝苟闄勫焊绯荤粺鏇存柊鍒皀extNations锛岄伩鍏嶈瑕嗙洊
                // vassalNationsUpdated 鍖呭惈浜嗛檮搴哥殑鐙珛鍊惧悜绛夋洿鏂?
                let nextNations = coupOutcome?.nations || result.nations;
                if (vassalNationsUpdated && nextNations) {
                    // [DEBUG] 璋冭瘯鏃ュ織
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

                    // [DEBUG] 鍚堝苟鍚庤皟璇曟棩蹇?
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

                // --- 鍘嗗彶鏁版嵁鏇存柊 (Update Refs directly) ---
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
                    // 纭繚supplyBreakdown鏁扮粍瀛樺湪锛堝吋瀹规棫瀛樻。锛?
                    if (!mHist.supplyBreakdown) {
                        mHist.supplyBreakdown = [];
                    }
                    mHist.supplyBreakdown.push(result.market.supplyBreakdown);
                    // 淇濈暀鏈€杩?0澶╃殑鏁版嵁锛堢敤浜嶱PI绡瓙璁＄畻锛?
                    const MAX_SUPPLY_BREAKDOWN_DAYS = 30;
                    if (mHist.supplyBreakdown.length > MAX_SUPPLY_BREAKDOWN_DAYS) {
                        mHist.supplyBreakdown.shift();
                    }
                }

                const adjustedMarket = {
                    ...(result.market || {}),
                    // Use Ref data for consistency, but this object is recreated every tick.
                    // The cost is just object creation, not React render (until setState).
                    priceHistory: mHist.price,
                    supplyHistory: mHist.supply,
                    demandHistory: mHist.demand,
                    modifiers: result.modifiers || {},
                };

                // ========== 鍘嗗彶鏁版嵁鑺傛祦鍚屾 ==========
                // 浠呭綋璁℃暟鍣ㄥ埌杈鹃棿闅旀椂锛屾墠灏?Ref 涓殑鏁版嵁鍚屾鍒?React State
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
                            // 缁忔祹鎸囨爣鍘嗗彶
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

                // 鏇存柊鎵€鏈夌姸鎬?- 浣跨敤鎵归噺鏇存柊鍑忓皯閲嶆覆鏌撴鏁?
                // 灏嗘墍鏈?setState 璋冪敤鍖呰鍦?unstable_batchedUpdates 涓?
                // 杩欏彲浠ュ皢 30+ 娆℃覆鏌撳悎骞朵负 1 娆★紝澶у箙鎻愬崌浣庣璁惧鎬ц兘
                // [FIX] 将 currentActions 提升到 .then() 回调顶层作用域，
                // 确保 unstable_batchedUpdates 内外所有代码都能访问
                const currentActions = current.actions;

                unstable_batchedUpdates(() => {
                    setPopStructure(nextPopStructure);
                    setMaxPop(result.maxPop);
                    setRates(result.rates || {});
                    setClassApproval(result.classApproval);
                    setApprovalBreakdown(result.approvalBreakdown || {}); // [NEW] 淇濆瓨婊℃剰搴﹀垎瑙ｆ暟鎹緵 UI 鍒嗘瀽浣跨敤
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
                    // 鍘嗗彶鏁版嵁鏇存柊宸茬Щ鑷充笂鏂?Ref 绠＄悊閮ㄥ垎锛屾澶勪笉鍐嶉噸澶嶈皟鐢?
                    setTotalInfluence(result.totalInfluence);
                    setTotalWealth(adjustedTotalWealth);
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
                        // 棰濆鎵撳嵃 taxPolicies 鍐呭
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
                        setArmy(result.army); // 淇濆瓨鎴樻枟鎹熷け
                    }
                    // 鏇存柊瀹樺憳鐘舵€侊紙鍚嫭绔嬭储鍔℃暟鎹級
                    // [FIX] 浣跨敤鍑芥暟寮忔洿鏂帮紝鍚堝苟鏂伴泧浣ｇ殑瀹樺憳閬垮厤绔炴€佹潯浠惰鐩?
                    if (nextOfficials) {
                        setOfficials(prevOfficials => {
                            // 濡傛灉 simulation 杩斿洖鐨勫畼鍛樺垪琛ㄥ拰褰撳墠鐘舵€佷竴鑷达紝鐩存帴浣跨敤
                            if (!prevOfficials || prevOfficials.length === 0) {
                                return nextOfficials;
                            }

                            // 鍒涘缓 simulation 缁撴灉鐨?ID 鏄犲皠锛堢敤浜庡揩閫熸煡鎵撅級
                            const simOfficialMap = new Map(nextOfficials.map(o => [o?.id, o]));

                            // 鎵惧嚭褰撳墠鐘舵€佷腑瀛樺湪浣?simulation 缁撴灉涓病鏈夌殑瀹樺憳锛堟柊闆囦剑鐨勶級
                            const newlyHiredOfficials = prevOfficials.filter(
                                o => o?.id && !simOfficialMap.has(o.id)
                            );

                            // 濡傛灉娌℃湁鏂伴泧浣ｇ殑瀹樺憳锛岀洿鎺ヨ繑鍥?simulation 缁撴灉
                            if (newlyHiredOfficials.length === 0) {
                                return nextOfficials;
                            }

                            // 鍚堝苟锛歴imulation 缁撴灉 + 鏂伴泧浣ｇ殑瀹樺憳锛堝幓閲嶄繚鎶わ級
                            console.log(`[HIRE FIX] Preserving ${newlyHiredOfficials.length} newly hired official(s) from race condition`);
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
                    // 鏇存柊瀹樺憳瀹归噺锛堝熀浜庢椂浠ｃ€佹斂浣撱€佺鎶€鍔ㄦ€佽绠楋級
                    if (typeof result.effectiveOfficialCapacity === 'number' && typeof setOfficialCapacity === 'function') {
                        setOfficialCapacity(result.effectiveOfficialCapacity);
                    }
                    setLivingStandardStreaks(result.livingStandardStreaks || current.livingStandardStreaks || {});
                    setMigrationCooldowns(result.migrationCooldowns || current.migrationCooldowns || {});
                    setTaxShock(result.taxShock || current.taxShock || {}); // [NEW] 鏇存柊绱Н绋庢敹鍐插嚮
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
                        setActiveFronts(normalizedFronts);
                        stateRef.current.activeFronts = normalizedFronts;
                    }
                    if (result.activeBattles && typeof setActiveBattles === 'function') {
                        setActiveBattles(result.activeBattles);
                        stateRef.current.activeBattles = result.activeBattles;
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
                        // [CRITICAL FIX] 浣跨敤window瀵硅薄涓存椂瀛樺偍锛岀粫杩嘡eact state寤惰繜
                        // 杩欐槸涓€涓复鏃惰В鍐虫柟妗堬紝鐩村埌閲嶆瀯state绠＄悊
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
                    // [DEBUG] 涓存椂鏃ュ織 - 杩借釜鑷敱甯傚満鏈哄埗闂
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
                    // 鏇存柊浜嬩欢鏁堟灉鐘舵€侊紙澶勭悊琛板噺鍜岃繃鏈燂級
                    // 娉ㄦ剰锛歯extEffects 鐢?processTimedEventEffects 璁＄畻寰楀嚭锛岄渶瑕佸啓鍥炵姸鎬?
                    setActiveEventEffects(prev => ({
                        ...prev,
                        approval: nextEffects.approval,
                        stability: nextEffects.stability,
                        resourceDemand: nextEffects.resourceDemand,
                        stratumDemand: nextEffects.stratumDemand,
                        buildingProduction: nextEffects.buildingProduction,
                        // forcedSubsidy 鐢卞崟鐙殑閫昏緫澶勭悊锛屼笉鍦ㄦ鏇存柊
                    }));

                    // ========== 鎴樻枟鍥炲悎鎺ㄨ繘 & 鎴樼嚎 Tick ==========
                    const currentActiveBattles = current.activeBattles || [];
                    const currentActiveFronts = current.activeFronts || [];
                    const currentCorps = current.militaryCorps || [];
                    const currentGenerals = current.generals || [];
                    let updatedBattles = [...currentActiveBattles].filter(Boolean).map((battle) => ensureBattleDefaults(battle));
                    let updatedFronts = currentActiveFronts.map(front => ensureFrontDefaults(front));
                    let updatedCorps = [...currentCorps];
                    let updatedGenerals = [...currentGenerals];

                    if (currentActiveBattles.length > 0 || currentActiveFronts.length > 0) {
                        let updatedArmyFromBattle = null;
                        const battleLogs = [];
                        const frontAdvanceDeltas = {};
                        const nationWarScoreDeltaByEnemyId = {};
                        const resolvedDay = (current.daysElapsed || 0) + 1;

                        // --- Process each active battle ---
                        updatedBattles = updatedBattles.map(battle => {
                            if (battle.status !== 'active') return battle;

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
                                    battleLogs.push(`鈿狅笍 琛ョ粰涓嶈冻锛?{battle.typeName}銆?{battle.attacker.corpsName} vs ${battle.defender.corpsName}銆嶆垬鏂楀姏涓嬮檷`);
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
                                        warScore: Math.max(-200, Math.min(200, getFrontWarScoreTotal(warScoreBreakdown))),
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

                                // Sync survivors back to corps and explicitly release them from battle lock.
                                updatedCorps = updatedCorps.map((c) => {
                                    if (c.id === updatedBattle.attacker.corpsId) {
                                        const survivors = { ...updatedBattle.result.attackerSurvivors };
                                        const remainingUnits = Object.values(survivors).reduce((sum, count) => sum + Number(count || 0), 0);
                                        return {
                                            ...c,
                                            units: survivors,
                                            status: remainingUnits > 0
                                                ? (c.assignedFrontId ? 'deployed' : 'idle')
                                                : 'destroyed',
                                            assignedFrontId: remainingUnits > 0 ? c.assignedFrontId : null,
                                            morale: Math.max(20, updatedBattle.attacker.morale),
                                        };
                                    }
                                    if (c.id === updatedBattle.defender.corpsId) {
                                        const survivors = { ...updatedBattle.result.defenderSurvivors };
                                        const remainingUnits = Object.values(survivors).reduce((sum, count) => sum + Number(count || 0), 0);
                                        return {
                                            ...c,
                                            units: survivors,
                                            status: remainingUnits > 0
                                                ? (c.assignedFrontId ? 'deployed' : 'idle')
                                                : 'destroyed',
                                            assignedFrontId: remainingUnits > 0 ? c.assignedFrontId : null,
                                            morale: Math.max(20, updatedBattle.defender.morale),
                                        };
                                    }
                                    return c;
                                });

                                // Subtract player casualties from global army
                                if (playerSide) {
                                    const playerCasualties = playerSide === 'attacker'
                                        ? updatedBattle.result.attackerCasualties
                                        : updatedBattle.result.defenderCasualties;
                                    if (playerCasualties && Object.keys(playerCasualties).length > 0) {
                                        if (!updatedArmyFromBattle) updatedArmyFromBattle = { ...(armyStateForQueue || current.army || {}) };
                                        for (const [uid, count] of Object.entries(playerCasualties)) {
                                            updatedArmyFromBattle[uid] = Math.max(0, (updatedArmyFromBattle[uid] || 0) - count);
                                            if (updatedArmyFromBattle[uid] <= 0) delete updatedArmyFromBattle[uid];
                                        }
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

                                // Update nation warScore
                                if (front && playerSide) {
                                    const isPlayerWinner = (winner === playerSide);
                                    const enemyId = front.attackerId === 'player' ? front.defenderId : front.attackerId;
                                    const warScoreChange = playerSide === 'attacker'
                                        ? Number(updatedBattle.result?.totalWarScoreDelta || 0)
                                        : -Number(updatedBattle.result?.totalWarScoreDelta || 0);
                                    setNations(prev => prev.map(n =>
                                        n.id === enemyId ? { ...n, warScore: Math.max(-100, Math.min(100, (n.warScore || 0) + (warScoreChange || (isPlayerWinner ? 12 : -12)))) } : n
                                    ));
                                }

                            }

                            return updatedBattle;
                        });

                        updatedBattles = updatedBattles.filter((battle) => battle?.status === 'active');

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

                            // Apply casualties to corps (distribute proportionally)
                            if (frictionResult.casualties.player > 0 && pCorps.length > 0) {
                                let remaining = frictionResult.casualties.player;
                                for (const corps of pCorps) {
                                    if (remaining <= 0) break;
                                    const unitKeys = Object.keys(corps.units || {});
                                    if (unitKeys.length === 0) continue;
                                    const key = unitKeys[Math.floor(Math.random() * unitKeys.length)];
                                    const loss = Math.min(remaining, Math.max(1, Math.floor((corps.units[key] || 0) * 0.01)));
                                    corps.units[key] = Math.max(0, (corps.units[key] || 0) - loss);
                                    remaining -= loss;
                                }
                            }
                            if (frictionResult.casualties.enemy > 0 && eCorps.length > 0) {
                                let remaining = frictionResult.casualties.enemy;
                                for (const corps of eCorps) {
                                    if (remaining <= 0) break;
                                    const unitKeys = Object.keys(corps.units || {});
                                    if (unitKeys.length === 0) continue;
                                    const key = unitKeys[Math.floor(Math.random() * unitKeys.length)];
                                    const loss = Math.min(remaining, Math.max(1, Math.floor((corps.units[key] || 0) * 0.01)));
                                    corps.units[key] = Math.max(0, (corps.units[key] || 0) - loss);
                                    remaining -= loss;
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
                                warScore: Math.max(-200, Math.min(200, getFrontWarScoreTotal(warScoreBreakdown))),
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

                            // [NEW] 持续财富掠夺：用实际敌方财富计算
                            const enemyIdForPlunder = playerSide === 'attacker' ? f.defenderId : f.attackerId;
                            const enemyNationForPlunder = (current.nations || []).find(n => n.id === enemyIdForPlunder);
                            if (enemyNationForPlunder) {
                                const actualPlunder = calculateWarPlunder({
                                    targetWealth: enemyNationForPlunder.wealth || 0,
                                    linePosition: updatedFront.linePosition || f.linePosition || 50,
                                    side: playerSide === 'attacker' ? 'defender' : 'attacker',
                                    raidMod: frictionResult.plunderResult?.raidMod || 1.0,
                                });
                                if (actualPlunder.wealthPlundered > 0) {
                                    frictionPlunderQueue.push({
                                        enemyId: enemyIdForPlunder,
                                        wealthPlundered: actualPlunder.wealthPlundered,
                                        wealthGained: actualPlunder.wealthGained,
                                    });
                                }
                            }

                            return updatedFront;
                        });

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
                                setPopulation(prev => Math.max(100, prev - popLoss));
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
                                    return { ...n, population: Math.max(100, (n.population || 1000) - aiPopLoss) };
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
                            const homelandPressure = playerRelativePosition >= 85
                                ? Math.max(1, Math.round(Math.abs(playerAdvance) || 1))
                                : playerRelativePosition <= 15
                                    ? -Math.max(1, Math.round(Math.abs(playerAdvance) || 1))
                                    : 0;
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
                            const nextWarScoreBreakdown = {
                                battle: Number(advancedFront.warScoreBreakdown?.battle || 0),
                                advance: Number(advancedFront.warScoreBreakdown?.advance || 0) + Math.trunc(playerAdvance / 18) + occupationDelta,
                                economic: Number(advancedFront.warScoreBreakdown?.economic || 0),
                                homeland: Number(advancedFront.warScoreBreakdown?.homeland || 0) + homelandPressure,
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
                                warScore: Math.max(-200, Math.min(200, getFrontWarScoreTotal(nextWarScoreBreakdown))),
                                warScoreBreakdown: nextWarScoreBreakdown,
                                economicDamageBreakdown: {
                                    supplyLineDamage: Number(advancedFront.economicDamageBreakdown?.supplyLineDamage || 0),
                                    productionLoss: Number(advancedFront.economicDamageBreakdown?.productionLoss || 0),
                                    infrastructureLoss: Number(advancedFront.economicDamageBreakdown?.infrastructureLoss || 0),
                                    civilianPressure: Number(advancedFront.economicDamageBreakdown?.civilianPressure || 0) + homelandPressure,
                                },
                            };
                        });

                        // --- [NEW] 消费 processFrontAdvance 产生的战争经济伤害 ---
                        if (warEconomyDamages.length > 0) {
                            const playerBuildingDamage = {};   // 玩家建筑破坏
                            const aiDamages = {};              // AI国家经济损伤
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
                            if (Object.keys(aiDamages).length > 0) {
                                setNations(prev => prev.map(n => {
                                    const dmg = aiDamages[n.id];
                                    if (!dmg) return n;
                                    return {
                                        ...n,
                                        wealth: Math.max(100, Math.round((n.wealth || 500) - dmg.wealthLoss)),
                                        militaryStrength: Math.max(0.25, (n.militaryStrength ?? 1.0) - dmg.milStrLoss),
                                    };
                                }));
                            }

                            // 应用玩家人口流失
                            if (playerPopLoss > 0) {
                                setPopulation(prev => Math.max(100, prev - playerPopLoss));
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
                        const missingFrontWars = (current.nations || []).filter(n => n?.isAtWar === true && !n?.isRebelNation && !activeFrontEnemyIds.has(n.id));
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
                        // 收集活跃会战中的兵团 ID，用于判断 in_combat 是否合法
                        const activeBattleCorpsSet = new Set(
                            (updatedBattles || [])
                                .filter(b => b?.status === 'active')
                                .flatMap(b => [b?.attacker?.corpsId, b?.defender?.corpsId])
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
                                const supplyRatio = corpsOnFront?.supplyState?.playerRatio ?? 1;
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
                                    warScore: Math.max(-100, Math.min(100, (n.warScore || 0) + delta)),
                                };
                            }));
                        }

                        // --- Apply all state updates ---
                        setActiveBattles(updatedBattles);
                        setActiveFronts(updatedFronts);
                        if (updatedCorps !== currentCorps) setMilitaryCorps(updatedCorps);
                        if (updatedGenerals !== currentGenerals) setGenerals(updatedGenerals);
                        if (updatedArmyFromBattle) setArmy(updatedArmyFromBattle);

                        // Log battle events
                        if (battleLogs.length > 0) {
                            battleLogs.forEach(log => addLog(log));
                        }
                    }

                    // ========== AI Enemy Corps & Auto-Battle Logic ==========
                    {
                        const fronts = updatedFronts;
                        const battles = updatedBattles || [];
                        const currentDay = (current.daysElapsed || 0) + 1;
                        let aiNations = [...(current.nations || [])].map((nation) => ensureAIMilitaryState(nation, current.epoch || 0));
                        const aiNationChangedIds = new Set();

                        aiNations = aiNations.map((nation) => {
                            if (!nation || nation.id === 'player') return nation;
                            const syncResult = syncAINationMilitary({
                                nation,
                                epoch: current.epoch || 0,
                                currentDay,
                                militaryCorps: updatedCorps,
                                generals: updatedGenerals,
                            });
                            const existingIds = new Set(updatedCorps.map((corps) => corps.id));
                            syncResult.corps.forEach((corps) => {
                                if (!existingIds.has(corps.id)) {
                                    updatedCorps.push(corps);
                                    existingIds.add(corps.id);
                                } else {
                                    updatedCorps = updatedCorps.map((item) => item.id === corps.id ? { ...item, ...corps } : item);
                                }
                            });
                            const existingGeneralIds = new Set(updatedGenerals.map((general) => general.id));
                            syncResult.generals.forEach((general) => {
                                if (!existingGeneralIds.has(general.id)) {
                                    updatedGenerals.push(general);
                                    existingGeneralIds.add(general.id);
                                }
                            });
                            aiNationChangedIds.add(syncResult.nation.id);
                            return syncResult.nation;
                        });

                        // [NEW] 跨战线军团调度：每个AI国家的有限军团按优先级分配到各活跃战线
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

                            // 同步战线的 assignedCorps 记录
                            for (const [frontId, corpsIds] of Object.entries(allocations)) {
                                updatedFronts = updatedFronts.map(f => {
                                    if (f.id !== frontId) return f;
                                    const side = f.attackerId === nation.id ? 'attacker' : 'defender';
                                    return {
                                        ...f,
                                        assignedCorps: {
                                            ...f.assignedCorps,
                                            [side]: [...new Set([...(f.assignedCorps?.[side] || []).filter(id => {
                                                // 保留非本国家的军团ID
                                                const corps = updatedCorps.find(c => c.id === id);
                                                return corps && corps.nationId !== nation.id;
                                            }), ...corpsIds])],
                                        },
                                    };
                                });
                            }
                            aiNationChangedIds.add(nation.id);
                        }

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
                                const battleCooldown = front._battleCooldown || (5 + Math.floor(Math.random() * 10));
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
                                                    // 批准：创建会战
                                                    const picks = selectBattleParticipants({
                                                        attackerCorps: playerSide === 'attacker' ? [pCorps] : refreshedEnemyCorpsOnFront,
                                                        defenderCorps: playerSide === 'attacker' ? refreshedEnemyCorpsOnFront : [pCorps],
                                                        generals: updatedGenerals || [],
                                                    });
                                                    const atkCorps = picks.attacker?.corps;
                                                    const defCorps = picks.defender?.corps;
                                                    if (!atkCorps || !defCorps) return;
                                                    const atkGen = (updatedGenerals || []).find(g => g.id === atkCorps.generalId || g.assignedCorpsId === atkCorps.id) || null;
                                                    const defGen = (updatedGenerals || []).find(g => g.id === defCorps.generalId || g.assignedCorpsId === defCorps.id) || null;
                                                    // 将领自动选择战术
                                                    const atkTactic = autoSelectTactic(null, 'attacker', atkGen);
                                                    const defTactic = autoSelectTactic(null, 'defender', defGen);
                                                    const newBattle = createBattle({
                                                        attackerCorps: atkCorps,
                                                        defenderCorps: defCorps,
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
                                                    setMilitaryCorps(prev => prev.map(c =>
                                                        (c.id === atkCorps.id || c.id === defCorps.id) ? { ...c, status: 'in_combat' } : c
                                                    ));
                                                    setActiveFronts(prev => prev.map(f =>
                                                        f.id !== front.id ? f : {
                                                            ...f,
                                                            activeBattleId: newBattle.id,
                                                            activeBattleType: proposal.engagementType,
                                                            _lastBattleDay: currentDay,
                                                            _battleCooldown: 5 + Math.floor(Math.random() * 10),
                                                        }
                                                    ));
                                                    setGenerals(prev => prev.map(g =>
                                                        g.id === pGeneral.id ? { ...g, proposalCooldownDays: 0 } : g
                                                    ));
                                                    addLog(`⚔️ ${pGeneral.name}将军率「${pCorps.name}」发起${proposal.engagementType === 'siege' ? '攻坚围城' : proposal.engagementType === 'assault' ? '主力决战' : '试探接敌'}`);
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

                                // === AI 侧：自动发起会战（保留原有逻辑，改用 autoSelectTactic）===
                                if (cooldownMet && frontPlan.shouldAttack) {
                                    const picks = selectBattleParticipants({
                                        attackerCorps: playerSide === 'attacker' ? playerCorpsOnFront : refreshedEnemyCorpsOnFront,
                                        defenderCorps: playerSide === 'attacker' ? refreshedEnemyCorpsOnFront : playerCorpsOnFront,
                                        generals: updatedGenerals || [],
                                    });
                                    const aiCorps = playerSide === 'attacker' ? picks.defender?.corps : picks.attacker?.corps;
                                    const playerCorps = playerSide === 'attacker' ? picks.attacker?.corps : picks.defender?.corps;
                                    if (aiCorps && playerCorps) {
                                        const aiGeneral = (updatedGenerals || []).find(g => g.id === aiCorps.generalId) || null;
                                        const playerGeneral = (updatedGenerals || []).find(g => g.assignedCorpsId === playerCorps.id) || null;

                                        const aiUnits = Object.values(aiCorps.units || {}).reduce((s, c) => s + c, 0);
                                        const playerUnitsCount = Object.values(playerCorps.units || {}).reduce((s, c) => s + c, 0);
                                        const totalUnitsCount = aiUnits + playerUnitsCount;
                                        const playerRelativePosition = playerSide === 'attacker'
                                            ? Number(front.linePosition || 50)
                                            : 100 - Number(front.linePosition || 50);
                                        let engagementType = 'probe';
                                        if (playerRelativePosition >= 65 || playerRelativePosition <= 35) {
                                            engagementType = 'assault';
                                        }
                                        if ((playerRelativePosition >= 82 || playerRelativePosition <= 18) && totalUnitsCount > 180) {
                                            engagementType = 'siege';
                                        }

                                        const isPlayerAttacker = playerSide === 'attacker';
                                        // 双方将领自动选择战术
                                        const atkTactic = autoSelectTactic(null, 'attacker', isPlayerAttacker ? playerGeneral : aiGeneral);
                                        const defTactic = autoSelectTactic(null, 'defender', isPlayerAttacker ? aiGeneral : playerGeneral);
                                        const newBattle = createBattle({
                                            attackerCorps: isPlayerAttacker ? playerCorps : aiCorps,
                                            defenderCorps: isPlayerAttacker ? aiCorps : playerCorps,
                                            attackerGeneral: isPlayerAttacker ? playerGeneral : aiGeneral,
                                            defenderGeneral: isPlayerAttacker ? aiGeneral : playerGeneral,
                                            front,
                                            engagementType,
                                            battlePlan: { attacker: atkTactic, defender: defTactic },
                                            epoch: current.epoch || 0,
                                            currentDay,
                                        });

                                        if (newBattle) {
                                            updatedBattles.push(newBattle);
                                            updatedCorps = updatedCorps.map(c => {
                                                if (c.id === aiCorps.id || c.id === playerCorps.id) {
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
                                                    _battleCooldown: 5 + Math.floor(Math.random() * 10),
                                                };
                                            });
                                            const atkName = isPlayerAttacker ? playerCorps.name : aiCorps.name;
                                            const defName = isPlayerAttacker ? aiCorps.name : playerCorps.name;
                                            addLog(`⚔️ 敌军发起会战：${atkName} 对阵 ${defName}`);
                                        }
                                    }
                                }
                            }
                        }

                        if (aiNationChangedIds.size > 0) {
                            setNations(prev => prev.map(nation => {
                                const updatedNation = aiNations.find(item => item.id === nation.id);
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
                                const stockpile = {
                                    ...(updatedNation.military?.stockpile || {}),
                                };
                                Object.entries(warEconomy.resourceUpkeep).forEach(([resourceKey, amount]) => {
                                    stockpile[resourceKey] = Math.max(0, Number(stockpile[resourceKey] || 0) - Number(amount || 0));
                                });
                                const shortagePenalty = Object.entries(warEconomy.resourceUpkeep).map(([resourceKey, amount]) => (
                                    Number(amount || 0) > 0 ? Number(stockpile[resourceKey] || 0) / Math.max(1, Number(amount || 0)) : 1
                                ));
                                const supplyCoverage = shortagePenalty.length > 0
                                    ? Math.max(0, Math.min(...shortagePenalty))
                                    : 1;

                                return {
                                    ...nation,
                                    militaryStrength: updatedNation.militaryStrength,
                                    military: {
                                        ...(nation.military || {}),
                                        ...(updatedNation.military || {}),
                                        stockpile,
                                        organization: Math.max(15, Number(updatedNation.military?.organization || 50) - (supplyCoverage < 0.75 ? 1 : 0) + (warEconomy.frontCount === 0 ? 1 : 0)),
                                    },
                                    warEconomy: {
                                        ...(nation.warEconomy || {}),
                                        ...warEconomy,
                                        foodUpkeep: Number(warEconomy.resourceUpkeep.food || 0),
                                        silverUpkeep: Number(warEconomy.resourceUpkeep.silver || 0),
                                        materielUpkeep: Number(warEconomy.resourceUpkeep.ammunition || warEconomy.resourceUpkeep.gunpowder || warEconomy.resourceUpkeep.wood || 0),
                                        supplyCoverage: Number(supplyCoverage.toFixed(2)),
                                    },
                                };
                            }));
                        }

                        setActiveBattles(updatedBattles);
                        setActiveFronts(updatedFronts);
                        if (updatedCorps !== currentCorps) setMilitaryCorps(updatedCorps);
                        if (updatedGenerals !== currentGenerals) setGenerals(updatedGenerals);
                    }

                    // 姣忔 Tick 鎺ㄨ繘 1 澶╋紙鑰岄潪 gameSpeed 澶╋級
                    // 鍔犻€熸晥鏋滈€氳繃澧炲姞 Tick 棰戠巼瀹炵幇锛岃€岄潪澧炲姞姣忔鎺ㄨ繘鐨勫ぉ鏁?
                    setDaysElapsed(prev => {
                        const numericPrev = Number.isFinite(prev) ? prev : Number(prev);
                        return (Number.isFinite(numericPrev) ? numericPrev : 0) + 1;
                    });
                });

                if (coupOutcome?.event && current.actions?.triggerDiplomaticEvent) {
                    current.actions.triggerDiplomaticEvent(coupOutcome.event);
                }

                // ========== 缁勭粐搴︾郴缁熸洿鏂?==========
                // 浣跨敤鏂扮殑缁勭粐搴︽満鍒舵浛浠ｆ棫鐨凴NG鍙涗贡绯荤粺
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
                        rulingCoalition: current.rulingCoalition || [], // 鎵ф斂鑱旂洘
                        difficultyLevel: current.difficulty, // 娓告垙闅惧害
                        organizationGrowthMod: result.modifiers?.officialEffects?.organizationGrowthMod || 0, // [NEW] 缁勭粐搴﹀闀夸慨姝?
                        // 娉ㄦ剰锛歝lassInfluence/totalInfluence 宸叉槸浣嶇疆鍙傛暟锛屾棤闇€鍦ㄦ閲嶅
                    }
                );

                // 妫€鏌ユ槸鍚︽湁闃跺眰璺ㄨ秺缁勭粐搴﹂槇鍊奸渶瑕佽Е鍙戜簨浠?
                const organizationEvents = checkOrganizationEvents(
                    currentOrganizationStates,
                    updatedOrganizationStates
                );
                const currentEpoch = current.epoch || 0;

                // 澶勭悊缁勭粐搴︿簨浠?
                if (organizationEvents.length > 0 && current.actions?.triggerDiplomaticEvent) {
                    for (const orgEvent of organizationEvents) {
                        const stratumKey = orgEvent.stratumKey;
                        const epochBlocksRebellion = stratumKey === 'unemployed' && currentEpoch <= 0;
                        const hasMilitary = hasAvailableMilitary(current.army, current.popStructure, stratumKey);
                        const militaryIsRebelling = isMilitaryRebelling(updatedOrganizationStates);

                        // 鏋勫缓鍙涗贡鐘舵€佸璞′緵浜嬩欢浣跨敤
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

                        // 鏍规嵁浜嬩欢绫诲瀷澶勭悊
                        switch (orgEvent.type) {
                            case 'brewing':
                                // 鍒涘缓浜嬩欢寮圭獥鎻愰啋鐜╁锛堥€夐」涓嶇洿鎺ュ奖鍝嶇粍缁囧害锛?
                                event = createBrewingEvent(
                                    stratumKey,
                                    rebellionStateForEvent,
                                    hasMilitary,
                                    militaryIsRebelling,
                                    current.resources?.silver || 0, // 浼犲叆褰撳墠閾跺竵
                                    rebellionCallback,
                                    stratumPopulation,
                                    marketPrices
                                );
                                addLog(`鈿狅笍 ${STRATA[stratumKey]?.name || stratumKey}闃跺眰缁勭粐搴﹁揪鍒?0%锛屽嚭鐜颁笉婊℃儏缁紒`);
                                break;

                            case 'plotting':
                                // 鍒涘缓浜嬩欢寮圭獥鎻愰啋鐜╁锛堥€夐」涓嶇洿鎺ュ奖鍝嶇粍缁囧害锛?
                                event = createPlottingEvent(
                                    stratumKey,
                                    rebellionStateForEvent,
                                    hasMilitary,
                                    militaryIsRebelling,
                                    current.resources?.silver || 0, // 浼犲叆褰撳墠閾跺竵
                                    rebellionCallback,
                                    stratumPopulation,
                                    marketPrices
                                );
                                addLog(`馃敟 ${STRATA[stratumKey]?.name || stratumKey}闃跺眰缁勭粐搴﹁揪鍒?0%锛屾鍦ㄥ瘑璋嬪彌涔憋紒`);
                                break;


                            case 'uprising': {
                                // 妫€鏌ュ奖鍝嶅姏鍗犳瘮鏄惁瓒冲鍙戝姩鍙涗贡
                                const stratumInfluence = rebellionStateForEvent.influenceShare;
                                if (epochBlocksRebellion) {
                                    addLog('[组织不足] ' + (STRATA[stratumKey]?.name || stratumKey) + ' 阶层尚未具备发动叛乱能力。');
                                    updatedOrganizationStates[stratumKey] = {
                                        ...updatedOrganizationStates[stratumKey],
                                        organization: 25,
                                        stage: ORGANIZATION_STAGE.GRUMBLING,
                                    };
                                    break;
                                }
                                if (stratumInfluence < MIN_REBELLION_INFLUENCE) {
                                    // 褰卞搷鍔涗笉瓒虫棤娉曞彌涔憋紝浣嗙粍缁囧害宸叉弧锛岃Е鍙戜汉鍙ｅ娴?
                                    const stratumPop = current.popStructure?.[stratumKey] || 0;
                                    const exitRate = 0.05; // 5%浜哄彛鎰ゆ€掔寮€
                                    const leaving = Math.max(1, Math.floor(stratumPop * exitRate));
                                    const stratumWealth = current.classWealth?.[stratumKey] || 0;
                                    const perCapWealth = stratumPop > 0 ? stratumWealth / stratumPop : 0;
                                    const fleeingCapital = perCapWealth * leaving;

                                    // 鎵ｉ櫎绂诲紑浜哄彛
                                    setPopStructure(prev => ({
                                        ...prev,
                                        [stratumKey]: Math.max(0, (prev[stratumKey] || 0) - leaving),
                                    }));
                                    setPopulation(prev => Math.max(0, prev - leaving));

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
                                        organization: 75, // 闄嶅埌75%鑰屼笉鏄?9锛岄伩鍏嶇珛鍗冲啀娆¤Е鍙?
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
                                    // 鑱斿悎鍙涗贡澶勭悊
                                    const coalitionStrata = coalitionResult.coalitionStrata;
                                    const { details, totalLoss } = calculateCoalitionPopLoss(coalitionStrata, current.popStructure);

                                    const existingRebel = (current.nations || []).find(
                                        n => n.isRebelNation && n.isAtWar && (n.isCoalitionRebellion || coalitionStrata.includes(n.rebellionStratum))
                                    );

                                    if (existingRebel) {
                                        // 鍚堝苟鍒板凡瀛樺湪鍙涘啗
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
                                        // 鎵ｉ櫎浜哄彛
                                        setPopStructure(prev => {
                                            const updated = { ...prev };
                                            details.forEach(({ stratumKey: sKey, loss }) => {
                                                updated[sKey] = Math.max(0, (prev[sKey] || 0) - loss);
                                            });
                                            return updated;
                                        });
                                        setPopulation(prev => Math.max(0, prev - totalLoss));
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
                                        addLog(`馃敟馃敟馃敟 ${coalitionNames}绛夊涓樁灞傝仈鍚堝彂鍔ㄥ彌涔憋紒`);
                                    }

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
                                        setPopulation(prev => Math.max(0, prev - rebelPopLoss));
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
                                        setPopulation(prev => Math.max(0, prev - rebelPopLoss));

                                        event = createActiveRebellionEvent(stratumKey, rebellionStateForEvent, hasMilitary, militaryIsRebelling, rebelNation, rebellionCallback);
                                        addLog(`馃敟馃敟馃敟 ${STRATA[stratumKey]?.name || stratumKey}闃跺眰缁勭粐搴﹁揪鍒?00%锛屽彂鍔ㄥ彌涔憋紒`);
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
                        addLog(`馃晩锔?${rebelNation.name}鍐呴儴鍒嗚锛岀粍缁囧害闄嶈嚦${Math.round(organization)}%锛屽彌涔卞穿婧冿紒`);

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

                // 绛栫暐琛屽姩鍐峰嵈
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

                // 璇勪及鎵胯浠诲姟
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
                            addLog(`馃 ${task.stratumName} 鐨勬壙璇哄凡鍏戠幇锛?{task.description || '浠诲姟瀹屾垚'}`);
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
                            const failReason = task.failReason === 'maintain_broken' ? '鏈兘淇濇寔鎵胯' : '鏈兘鎸夋椂瀹屾垚';
                            addLog(`鈿狅笍 浣犺繚鑳屼簡瀵?{task.stratumName}鐨勬壙璇猴紙${failReason}锛夛紝缁勭粐搴︽毚娑紒`);

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
                                addLog(`馃敟馃敟馃敟 ${STRATA[stratumKey]?.name || stratumKey}鍥犳壙璇鸿繚鑳岋紝缁勭粐搴﹁揪鍒?00%锛屽彂鍔ㄥ彌涔憋紒`);
                                current.actions.triggerDiplomaticEvent(event);
                                setIsPaused(true);
                            }
                        });
                    }

                    // 鏇存柊浠诲姟鍒楄〃锛堝寘鎷繘鍏ヤ繚鎸侀樁娈电殑浠诲姟锛?
                    const newRemaining = [...evaluation.remaining];
                    if (evaluation.updated) {
                        // updated 浠诲姟宸茬粡鍦?remaining 涓簡
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
                        // 閾跺竵涓嶈冻锛岃繚绾?
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
                                    lastMilitaryActionDay: undefined, // 閲嶇疆鍐涗簨琛屽姩鍐峰嵈
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

                // 鏇存柊搴嗗吀鏁堟灉锛岀Щ闄よ繃鏈熺殑鐭湡鏁堟灉
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

                // 娣诲姞鏂版棩蹇?
                if (result.logs.length) {
                    // 鍘婚噸锛氳拷韪凡澶勭悊鐨勭獊琚簨浠?
                    const processedRaidNations = new Set();

                    // Filter and transform technical logs to human-readable format
                    const logVisibility = current?.eventEffectSettings?.logVisibility || {};
                    const shouldLogMerchantTrades = logVisibility.showMerchantTradeLogs ?? true;
                    const processedLogs = result.logs.map(log => {
                        if (typeof log !== 'string') return log;

                        // Transform RAID_EVENT logs to human-readable format (now supports multiple action types)
                        if (log.includes('RAID_EVENT')) {
                            try {
                                const jsonStr = log.replace('RAID_EVENT', '');
                                const raidData = JSON.parse(jsonStr);

                                // 鍘婚噸锛氬鏋滆繖涓浗瀹跺凡缁忔湁鍐涗簨琛屽姩璁板綍锛岃烦杩?
                                if (processedRaidNations.has(raidData.nationName)) {
                                    return null; // 杩斿洖null锛岀◢鍚庤繃婊ゆ帀
                                }
                                processedRaidNations.add(raidData.nationName);

                                // 鑾峰彇琛屽姩鍚嶇О锛岄粯璁や负"绐佽"
                                const actionName = raidData.actionName || '绐佽';

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
                                return `鈿旓笍 鍙戠敓浜嗕竴鍦烘晫鏂瑰啗浜嬭鍔紒`;
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

                        if (log.includes('AI_GIFT_EVENT:')) {
                            return '馃挐 鏀跺埌涓€浠芥潵鑷鍥界殑澶栦氦绀肩墿閫氱煡';
                        }
                        if (log.includes('AI_REQUEST_EVENT:')) {
                            return '馃棧锔?鏀跺埌涓€浠芥潵鑷鍥界殑澶栦氦璇锋眰';
                        }

                        // Merchant autonomous trade summary logs (from simulation)
                        // Gate behind showMerchantTradeLogs
                        if (log.startsWith('馃洅 鍟嗕汉璐告槗瀹屾垚')) {
                            return shouldLogMerchantTrades ? log : null;
                        }

                        // 杩囨护鎺?AI_TRADE_EVENT 鐨勫師濮?JSON锛屽悗缁細閫氳繃 addLog 娣诲姞鏍煎紡鍖栨棩蹇?
                        if (log.includes('AI_TRADE_EVENT:')) {
                            return null;
                        }

                        return log;
                    });

                    setLogs(prev => [...processedLogs.filter(log => log !== null), ...prev].slice(0, LOG_STORAGE_LIMIT));

                    // 妫€娴嬪浜や簨浠跺苟瑙﹀彂浜嬩欢绯荤粺
                    const eventDebug = isDebugEnabled('event');
                    if (eventDebug) {
                        debugLog('event', '[EVENT DEBUG] actions:', !!currentActions, 'triggerDiplomaticEvent:', !!currentActions?.triggerDiplomaticEvent);
                    }
                    if (currentActions && currentActions.triggerDiplomaticEvent) {
                        if (eventDebug) {
                            debugLog('event', '[EVENT DEBUG] Checking logs:', result.logs);
                            debugLog('event', '[EVENT DEBUG] Total logs count:', result.logs.length);
                        }

                        // 鍏堣В鏋愮獊琚簨浠舵棩蹇楋紝瑙﹀彂鎴樻枟缁撴灉寮圭獥
                        const raidLogEntry = Array.isArray(result.logs)
                            ? result.logs.find((log) => typeof log === 'string' && log.includes('RAID_EVENT'))
                            : null;
                        if (raidLogEntry && currentActions.addBattleNotification) {
                            try {
                                const jsonStart = raidLogEntry.indexOf('{');
                                if (jsonStart !== -1) {
                                    const raidJson = raidLogEntry.slice(jsonStart);
                                    const raidData = JSON.parse(raidJson);

                                    // 鑾峰彇琛屽姩鍚嶇О锛岄粯璁や负"绐佽"
                                    const actionName = raidData.actionName || '绐佽';

                                    let description = `${raidData.nationName} 鍙戝姩浜?{actionName}锛乗n\n`;
                                    if (raidData.victory) {
                                        description += `浣犵殑鍐涢槦鎴愬姛鍑婚€€浜?{actionName}锛乗n\n`;
                                        description += '鎴樻枟鍔涘姣旓細\n';
                                        description += `鎴戞柟锛?{raidData.ourPower || 0} \n`;
                                        description += `鏁屾柟锛?{raidData.enemyPower || 0} \n`;
                                        if (raidData.battleReport && raidData.battleReport.length > 0) {
                                            description += '\n' + raidData.battleReport.join('\n');
                                        }
                                    } else {
                                        if (!raidData.ourPower) {
                                            description += `浣犳病鏈夊啗闃熼槻寰★紝${actionName}鎴愬姛锛乗n\n`;
                                        } else {
                                            description += `浣犵殑鍐涢槦鏈兘闃绘${actionName}锛乗n\n`;
                                            description += '鎴樻枟鍔涘姣旓細\n';
                                            description += `鎴戞柟锛?{raidData.ourPower || 0} \n`;
                                            description += `鏁屾柟锛?{raidData.enemyPower || 0} \n`;
                                            if (raidData.battleReport && raidData.battleReport.length > 0) {
                                                description += '\n' + raidData.battleReport.join('\n');
                                            }
                                        }
                                        description += `\n${actionName}鎹熷け锛歕n`;
                                        if (raidData.foodLoss > 0) description += `绮锛?{raidData.foodLoss} \n`;
                                        if (raidData.silverLoss > 0) description += `閾跺竵锛?{raidData.silverLoss} \n`;
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
                                    // 浣跨敤闈為樆鏂紡閫氱煡锛屼笉鎵撴柇鐜╁鎿嶄綔
                                    currentActions.addBattleNotification(battleResult);
                                }
                            } catch (e) {
                                debugError('event', '[EVENT DEBUG] Failed to parse raid event log:', e);
                            }
                        }


                        result.logs.forEach((log, index) => {
                            debugLog('event', `[EVENT DEBUG] Log ${index}: `, log);
                            debugLog('event', `[EVENT DEBUG] Log ${index} includes RAID_EVENT: `, log.includes('RAID_EVENT'));

                            // 妫€娴嬪鎴樹簨浠讹紙浣跨敤鏂扮殑 WAR_DECLARATION_EVENT 鏍囪锛?
                            if (log.includes('WAR_DECLARATION_EVENT:')) {
                                debugLog('event', '[EVENT DEBUG] War declaration detected:', log);
                                try {
                                    const jsonStr = log.replace('WAR_DECLARATION_EVENT:', '');
                                    const warData = JSON.parse(jsonStr);
                                    const aggressorId = warData.nationId;
                                    const aggressorName = warData.nationName;

                                    // 瑙﹀彂鐜╁鐨勫鎴樺脊绐?
                                    const aggressor = result.nations?.find(n => n.id === aggressorId);
                                    if (aggressor) {
                                        // [NEW] Pass warData to show appropriate message for vassal protection wars
                                        const event = createWarDeclarationEvent(aggressor, () => {
                                            debugLog('event', '[EVENT DEBUG] War declaration acknowledged');
                                        }, warData);
                                        currentActions.triggerDiplomaticEvent(event);
                                    }


                                    // === 鎴樹簤鍚岀洘杩為攣鍙嶅簲閫昏緫 ===
                                    // 鏃㈢劧 simulation.js 浠呬粎瑙﹀彂浜嗕簨浠讹紝鎴戜滑闇€瑕佸湪杩欓噷澶勭悊澶嶆潅鐨勫悓鐩熼€昏緫
                                    // 鎴戜滑闇€瑕佸悓鏃舵洿鏂?state 涓殑 nations (result.nations 鏄湰Tick鐨勭粨鏋滐紝鎴戜滑闇€瑕佹洿鏂板畠)

                                    // Track allies that actually join the war (for front generation)
                                    const joinedAggressorAllyIds = [];

                                    setNations(prevNations => {
                                        const nextNations = [...prevNations];
                                        const aggressorIdx = nextNations.findIndex(n => n.id === aggressorId);
                                        if (aggressorIdx === -1) return nextNations;

                                        // 1. 璇嗗埆鍚勬柟鐩熷弸锛堜娇鐢ㄥ啗浜嬪浗闄呯粍缁囷級
                                        const orgs = diplomacyOrganizations?.organizations || [];

                                        // 鑾峰彇鏌愪釜鍥藉鎵€鍦ㄧ殑鍐涗簨缁勭粐鎴愬憳
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
                                            // 鎺掗櫎鐜╁鐨勯檮搴?
                                            if (n.isVassal === true) return false;
                                            return true;
                                        });

                                        // 鐜╁鐨勭洘鍙嬶紙鎺掗櫎鍏卞悓鐩熷弸鍜岄檮搴革級
                                        const playerAllies = nextNations.filter(n => {
                                            if (n.id === aggressorId) return false;
                                            if (!playerAllianceIds.includes(n.id)) return false;
                                            if (sharedAllianceIds.has(n.id)) return false;
                                            if (n.isAtWar) return false;
                                            // 鎺掗櫎鐜╁鐨勯檮搴?
                                            if (n.isVassal === true) return false;
                                            return true;
                                        });

                                        // ========== 鎴樹簤涓婇檺妫€鏌?==========
                                        const MAX_CONCURRENT_WARS = 3;
                                        // 璁＄畻褰撳墠涓庣帺瀹朵氦鎴樼殑AI鍥藉鏁伴噺锛堜笉鍖呮嫭鍙涘啗锛?
                                        let currentWarsWithPlayer = nextNations.filter(n =>
                                            n.isAtWar === true && !n.isRebelNation
                                        ).length;

                                        // 2. 澶勭悊渚电暐鑰呯殑鐩熷弸鍔犲叆鎴樹簤
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
                                                currentWarsWithPlayer++; // 鏇存柊璁℃暟
                                                joinedAggressorAllyIds.push(ally.id);
                                                addLog('[盟友参战] ' + ally.name + ' 作为 ' + aggressorName + ' 的盟友，对你宣战。');
                                            }
                                        });

                                        // 3. 澶勭悊鐜╁鐨勭洘鍙嬪姞鍏ユ垬浜?
                                        playerAllies.forEach(ally => {
                                            // 鍚﹀垯锛岃鐩熷弸瀵逛镜鐣ヨ€呭強鍏剁洘鍙嬪鎴?(璁剧疆 foreignWars)
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

                                                // 鍚屾椂涔熼渶瑕佹洿鏂颁镜鐣ヨ€呯殑 foreignWars 鐘舵€侊紝鏍囪瀹冧笌璇ョ洘鍙嬪紑鎴樹簡
                                                // 娉ㄦ剰锛歛ggressorIdx 鐨勫紩鐢ㄥ鏋滀笉鏇存柊锛屽彲鑳藉鑷寸姸鎬佷笉涓€鑷?
                                                // 鎴戜滑鐩存帴淇敼 nextNations 鏁扮粍涓殑瀵硅薄
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

                                        // 閫氱煡鍏卞悓鐩熷弸淇濇寔涓珛
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
                            // 鍏煎鏃х殑瀹ｆ垬妫€娴嬮€昏緫
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
                                        // 鍒涘缓鍙涘啗鎶曢檷浜嬩欢锛堢洿鎺ヤ娇鐢ㄥ彌涔辩粨鏉熶簨浠讹級
                                        // 娉ㄦ剰锛氬洖璋冨彧澶勭悊鏁堟灉锛屼笉鍐嶈皟鐢?handleRebellionWarEnd 閬垮厤閲嶅
                                        const surrenderEvent = createRebellionEndEvent(
                                            nation,
                                            true, // 鐜╁鑳滃埄
                                            current.resources?.silver || 0,
                                            (action) => {
                                                // 鏁堟灉鐢变簨浠舵湰韬殑 effects 澶勭悊锛岃繖閲屽彧鍋氭棩蹇?
                                                debugLog('gameLoop', '[REBELLION SURRENDER]', action, nation?.name);
                                            }
                                        );
                                        currentActions.triggerDiplomaticEvent(surrenderEvent);

                                        // 鐩存帴澶勭悊鍙涘啗绉婚櫎鍜岀姸鎬侀噸缃紙涓嶅啀閫氳繃 handleRebellionWarEnd锛?
                                        const stratumKey = nation.rebellionStratum;
                                        if (stratumKey) {
                                            // 鎭㈠閮ㄥ垎浜哄彛
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
                                        // 绉婚櫎鍙涘啗
                                        setNations(prev => prev.filter(n => n.id !== nation.id));
                                    }
                                }
                            }

                            // 妫€娴嬪彌鍐涘嫆绱?鏈€鍚庨€氱墥浜嬩欢
                            if (log.includes('REBEL_DEMAND_SURRENDER:')) {
                                try {
                                    const jsonStr = log.replace('REBEL_DEMAND_SURRENDER:', '');
                                    const data = JSON.parse(jsonStr);
                                    const nation = result.nations?.find(n => n.id === data.nationId);

                                    if (nation) {
                                        const event = createRebelDemandSurrenderEvent(nation, data, (action, nationObj, eventData) => {
                                            debugLog('gameLoop', '[REBEL ULTIMATUM] Callback triggered:', action, eventData.demandType);
                                            if (action === 'accept') {
                                                // 1. 鏍规嵁绫诲瀷鎵ｉ櫎璧勬簮
                                                if (eventData.demandType === 'massacre') {
                                                    // 灞犳潃锛氭墸闄や汉鍙ｅ拰浜哄彛涓婇檺
                                                    const popLoss = eventData.demandAmount || 0;
                                                    setPopulation(prev => Math.max(10, prev - popLoss));
                                                    setMaxPop(prev => Math.max(20, prev - popLoss));
                                                    addLog(`馃拃 鍙涘啗杩涜浜嗗ぇ灞犳潃锛屼綘澶卞幓浜?${popLoss} 浜哄彛鍜屼汉鍙ｄ笂闄愶紒`);

                                                    // 瀵瑰簲闃跺眰浜哄彛涔熼渶鍑忓皯
                                                    const massacreStratumKey = nationObj.rebellionStratum;
                                                    if (massacreStratumKey) {
                                                        setPopStructure(prev => ({
                                                            ...prev,
                                                            [massacreStratumKey]: Math.max(0, (prev[massacreStratumKey] || 0) - popLoss)
                                                        }));
                                                    }
                                                } else if (eventData.demandType === 'reform') {
                                                    // 鏀归潻濡ュ崗锛氫竴娆℃€т粠鍥藉簱鎵ｉ櫎閾跺竵锛岃浆鍏ヨ闃跺眰鐨勮储瀵?
                                                    const reformAmount = eventData.demandAmount || 0;
                                                    const coalitionStrata = eventData.coalitionStrata || [eventData.reformStratum || nationObj.rebellionStratum];
                                                    debugLog('gameLoop', '[REBEL REFORM] Amount:', reformAmount, 'Coalition:', coalitionStrata);

                                                    // 鎵ｉ櫎閾跺竵
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

                                                    // 灏嗛挶鎸夋瘮渚嬭浆鍏ュ悇闃跺眰璐㈠瘜
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

                                                    // 鎸変汉鍙ｆ瘮渚嬭绠楁瘡涓樁灞傜殑浠介
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

                                                    // 涓烘瘡涓樁灞傛坊鍔犺ˉ璐存晥鏋?
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
                                                // 浣跨敤 handleRebellionWarEnd 鍑芥暟锛堜笌鐜╁涓诲姩姹傚拰浣跨敤鐩稿悓鐨勫嚱鏁帮級
                                                // 杩欎釜鍑芥暟浼氭纭垹闄ゅ彌鍐涖€侀噸缃姸鎬佸苟瑙﹀彂"灞堣颈鐨勫拰骞?浜嬩欢
                                                if (actions?.handleRebellionWarEnd) {
                                                    debugLog('gameLoop', '[REBEL] Calling handleRebellionWarEnd for defeat...');
                                                    actions.handleRebellionWarEnd(nationObj.id, false); // false = 鐜╁澶辫触
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
                                                addLog(`鈿旓笍 浣犳嫆缁濅簡鍙涘啗鐨?${eventData.demandType})瑕佹眰锛屾垬浜夌户缁紒`);
                                            }
                                        });
                                        currentActions.triggerDiplomaticEvent(event);
                                    }
                                } catch (e) {
                                    debugError('event', '[EVENT DEBUG] Failed to parse rebel demand:', e);
                                }
                            }

                            // 妫€娴?AI 閫佺ぜ浜嬩欢
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

                            // 妫€娴?AI 绱㈣浜嬩欢
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

                            // 妫€娴?AI 鑱旂洘璇锋眰浜嬩欢
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

                            // Treaty 2.0 MVP: 妫€娴?AI 鏉＄害鎻愭浜嬩欢
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

                            // AI鏉＄害鎾曟瘉閫氱煡
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
                                                addLog(`鈿旓笍 浣犲喅瀹氬嚭鍏甸晣鍘?${nation.name} 鐨勫彌涔憋紒`);
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
                                                        // 璋堝垽瑙ｅ喅锛氱珛鍗抽檷浣庣嫭绔嬪€惧悜10鐐癸紙妯℃嫙璋堝垽鐨勫嵆鏃剁紦鍜屾晥鏋滐級
                                                        // 涔嬪悗浼氭牴鎹斂绛栧拰鎺у埗鎺柦鑷劧瓒嬪悜鐩爣鍊?
                                                        independencePressure: Math.max(0, (n.independencePressure || 0) - 10),
                                                    };
                                                }));
                                                addLog('[停战] 你与 ' + nation.name + ' 达成协议，降低朝贡并平息叛乱。');
                                            } else if (action === 'release') {
                                                // 閲婃斁锛氭壙璁ょ嫭绔嬶紝鍏崇郴鎻愬崌
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
                                                    addLog(`鉂?閾跺竵涓嶈冻锛屾棤娉曞悜 ${nation.name} 璧犻€佺ぜ鐗╋紒`);
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
                                                // 涓嶇锛氬叧绯荤户缁笅闄嶏紝澧炲姞瑙ｇ洘椋庨櫓
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

                            // 妫€娴婣I璐告槗浜嬩欢锛堣祫婧愬彉鍖栧凡鍦╯imulation涓鐞嗭紝杩欓噷鍙渶璁板綍鍜屾樉绀猴級
                            if (log.includes('AI_TRADE_EVENT:')) {
                                try {
                                    const jsonStr = log.replace('AI_TRADE_EVENT:', '');
                                    const eventData = JSON.parse(jsonStr);
                                    const resourceName = RESOURCES[eventData.resourceKey]?.name || eventData.resourceKey;

                                    // 灏嗗叧绋庤鍏radeStats锛屾樉绀哄湪璐㈡斂闈㈡澘涓?
                                    if (eventData.tariff > 0) {
                                        setTradeStats(prev => ({ ...prev, tradeTax: (prev.tradeTax || 0) + eventData.tariff }));
                                    }

                                    // 鐢熸垚璇︾粏鐨勮锤鏄撴棩蹇楋紙鐜╁鏀垮簻鍙敹鍏崇◣锛?
                                    // 杩欎簺灞炰簬鈥滆锤鏄撹矾绾?甯傚満璐告槗鈥濈被鏃ュ織锛屽彈 showTradeRouteLogs 鎺у埗
                                    if (isDebugEnabled('trade')) {
                                        if (eventData.tradeType === 'export') {
                                            // 鐜╁鍑哄彛锛氳祫婧愬噺灏戯紝鍙敹鍏崇◣
                                            if (eventData.tariff > 0) {
                                                addLog('[市场交易] ' + eventData.nationName + ' 从你市场购买 ' + eventData.quantity + ' ' + resourceName + '，你收取关税 ' + eventData.tariff + '。');
                                            } else {
                                                addLog('[市场交易] ' + eventData.nationName + ' 从你市场购买 ' + eventData.quantity + ' ' + resourceName + '（开放市场，无关税）。');
                                            }
                                        } else if (eventData.tradeType === 'import') {
                                            // 鐜╁杩涘彛锛氳祫婧愬鍔狅紝鍙敹鍏崇◣
                                            if (eventData.tariff > 0) {
                                                addLog('[市场交易] ' + eventData.nationName + ' 向你市场出售 ' + eventData.quantity + ' ' + resourceName + '，你收取关税 ' + eventData.tariff + '。');
                                            } else {
                                                addLog('[市场交易] ' + eventData.nationName + ' 向你市场出售 ' + eventData.quantity + ' ' + resourceName + '（开放市场，无关税）。');
                                            }
                                        } else {
                                            // 鏃х増鍏煎
                                            if (eventData.tariff > 0) {
                                                addLog('[市场交易] ' + eventData.nationName + ' 与你进行了贸易，你收取关税 ' + eventData.tariff + '。');
                                            }
                                        }
                                    }
                                } catch (e) {
                                    debugError('event', '[EVENT DEBUG] Failed to parse AI Trade event:', e);
                                }
                            }

                            // 妫€娴婣I瑕佹眰鎶曢檷浜嬩欢
                            if (log.includes('AI_DEMAND_SURRENDER:')) {
                                try {
                                    const jsonStr = log.replace('AI_DEMAND_SURRENDER:', '');
                                    const eventData = JSON.parse(jsonStr);
                                    const nation = result.nations?.find(n => n.id === eventData.nationId);
                                    if (nation && currentActions && currentActions.triggerDiplomaticEvent) {
                                        // 浼犲叆鐜╁鐘舵€佷互渚挎纭绠楄禂娆鹃€夐」
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
                                                    // 鍒嗘湡浠樻 - amount 鏄瘡鏃ラ噾棰?
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
                                                    // 鍓茶浜哄彛锛氭墸鍑忎汉鍙ｄ笌浜哄彛涓婇檺鍔犳垚锛岄伩鍏嶄笅涓€tick琚ā鎷熼噸绠楄鐩?
                                                    const currentPop = current.population || 0;
                                                    if (currentPop < amount + 10) {
                                                        addLog('[投降失败] 人口不足（需要 ' + amount + '，当前 ' + Math.floor(currentPop) + '），无法接受投降条件。');
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
                                                    addLog('[人口割让] 你向 ' + nation.name + ' 割让了 ' + amount + ' 人口。');
                                                }

                                                // 缁撴潫鎴樹簤
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

                            // 妫€娴婣I涓诲姩鎻愬嚭鏃犳潯浠跺拰骞充簨浠讹紙鐜╁澶勪簬缁濆鏃讹級
                            if (log.includes('AI_MERCY_PEACE_OFFER:')) {
                                try {
                                    const jsonStr = log.replace('AI_MERCY_PEACE_OFFER:', '');
                                    const eventData = JSON.parse(jsonStr);
                                    const nation = result.nations?.find(n => n.id === eventData.nationId);
                                    if (nation && currentActions && currentActions.triggerDiplomaticEvent) {
                                        // 鍒涘缓浠佹厛鍜屽钩浜嬩欢
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
                                                        // 鎺ュ彈鍜屽钩锛岀粨鏉熸垬浜?
                                                        setNations(prev => prev.map(n => n.id === eventData.nationId ? {
                                                            ...n,
                                                            isAtWar: false,
                                                            warScore: 0,
                                                            warDuration: 0,
                                                            peaceTreatyUntil: current.daysElapsed + 365, // 1骞村拰骞虫潯绾?
                                                            isMercyPeaceOffering: false,
                                                            relation: Math.min(100, (n.relation || 50) + 10), // 鍏崇郴鐣ュ井鏀瑰杽
                                                        } : n));
                                                        addLog('[停战达成] 你接受了 ' + eventData.nationName + ' 的和平提议，战争结束。');
                                                    },
                                                },
                                                {
                                                    id: 'reject',
                                                    text: '鈿旓笍 鎷掔粷',
                                                    description: '继续战争（不推荐）',
                                                    style: 'danger',
                                                    effects: {},
                                                    callback: () => {
                                                        // 鎷掔粷鍜屽钩
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

                            // 妫€娴婣I瑙ｉ櫎鑱旂洘浜嬩欢
                            if (log.includes('AI_BREAK_ALLIANCE:')) {
                                try {
                                    const jsonStr = log.replace('AI_BREAK_ALLIANCE:', '');
                                    const eventData = JSON.parse(jsonStr);
                                    const reasonText = eventData.reason === 'relation_low'
                                        ? '鐢变簬鍙屾柟鍏崇郴鎭跺寲'
                                        : '由于你多次忽视盟友诉求';
                                    addLog('[联盟破裂] ' + reasonText + '，' + eventData.nationName + ' 决定解除与你的同盟关系。');
                                } catch (e) {
                                    debugError('event', '[EVENT DEBUG] Failed to parse AI Break Alliance event:', e);
                                }
                            }

                            // 妫€娴嬬洘鍙嬭鏀诲嚮浜嬩欢
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
                                                                lastMilitaryActionDay: undefined, // 閲嶇疆鍐涗簨琛屽姩鍐峰嵈
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
                                                        // 鍏朵粬鍥藉涔熷鐜╁鍗拌薄鍙樺樊锛堣儗鍙涜€呭０瑾夛級
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
                                                                // 鐜╁閫€鍑烘缁勭粐
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
                                debugLog('trade', '[AI鎶曡祫浜嬩欢鐩戝惉] 妫€娴嬪埌鎶曡祫鏈轰細鏃ュ織:', log);
                                try {
                                    const jsonStr = log.replace('OVERSEAS_INVESTMENT_OPPORTUNITY:', '');
                                    const eventData = JSON.parse(jsonStr);
                                    const nation = result.nations?.find(n => n.id === eventData.nationId);
                                    debugLog('trade', '[AI鎶曡祫浜嬩欢鐩戝惉] 瑙ｆ瀽鎴愬姛, nation:', nation?.name, 'currentActions:', !!currentActions, 'triggerDiplomaticEvent:', !!currentActions?.triggerDiplomaticEvent);
                                    if (nation && currentActions && currentActions.triggerDiplomaticEvent) {
                                        const event = createOverseasInvestmentOpportunityEvent(
                                            nation,
                                            eventData.opportunity,
                                            (accepted, investmentDetails) => {
                                                debugLog('trade', '[AI鎶曡祫浜嬩欢鐩戝惉] 鍥炶皟琚Е鍙? accepted:', accepted, 'details:', investmentDetails);
                                                if (accepted && investmentDetails) {
                                                    // 閫氳繃澶栦氦琛屽姩寤虹珛鎶曡祫
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
                                        debugLog('trade', '[AI鎶曡祫浜嬩欢鐩戝惉] 鍒涘缓浜嬩欢鎴愬姛, 姝ｅ湪瑙﹀彂:', event);
                                        currentActions.triggerDiplomaticEvent(event);
                                        debugLog('event', '[EVENT DEBUG] Overseas Investment Opportunity event triggered:', nation.name);
                                    } else {
                                        debugLog('trade', '[AI鎶曡祫浜嬩欢鐩戝惉] 缂哄皯蹇呰鏉′欢, nation:', !!nation, 'currentActions:', !!currentActions);
                                    }
                                } catch (e) {
                                    console.error('[AI鎶曡祫浜嬩欢鐩戝惉] 瑙ｆ瀽澶辫触:', e);
                                    debugError('event', '[EVENT DEBUG] Failed to parse Overseas Investment Opportunity event:', e);
                                }
                            }

                            // 妫€娴嬪璧勫浗鏈夊寲濞佽儊浜嬩欢
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
                                                    // 灏濊瘯璋堝垽
                                                    setNations(prev => prev.map(n =>
                                                        n.id === nation.id
                                                            ? { ...n, relation: Math.max(0, (n.relation || 50) - 10) }
                                                            : n
                                                    ));
                                                    addLog('[国有化谈判] 你尝试与 ' + nation.name + ' 谈判，关系下降。');
                                                } else if (action === 'threaten') {
                                                    // 鍙戝嚭璀﹀憡
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
                                                    // 閫氳繃澶栦氦琛屽姩寤虹珛闄勫焊鍏崇郴
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
                // 澶勭悊璁粌闃熷垪

                // [FIX] Moved Auto Replenish Logic here to share scope with setMilitaryQueue
                const autoRecruitEnabled = current.autoRecruitEnabled || false;
                const allAutoReplenishLosses = {};

                // DEBUG: Check if we are receiving any replenish logs
                const hasReplenishLog = result.logs.some(l => typeof l === 'string' && l.includes('AUTO_REPLENISH_LOSSES:'));
                if (hasReplenishLog) {
                    addLog(`馃洜锔?[DEBUG] Worker sent replenishment signal! AutoRecruit: ${autoRecruitEnabled}`);
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
                    // [FIX] 璁＄畻鍐涢槦瀹為檯浜哄彛娑堣€楋紙鑰冭檻涓嶅悓鍏电鐨刾opulationCost锛?
                    const currentArmyPopulation = calculateArmyPopulation(result.army || armyStateForQueue || {});
                    const militaryCapacity = getMilitaryCapacity(current.buildings || {});

                    // [FIX] 鍦ㄩ槦鍒楀鐞嗕腑鎵ц鑷姩琛ュ叺锛岀‘淇濅娇鐢ㄦ渶鏂扮姸鎬?
                    if (shouldProcessAutoReplenish && autoRecruitEnabled && militaryCapacity > 0) {
                        // 璁＄畻鍙敤妲戒綅 = 瀹归噺 - 褰撳墠鍐涢槦 - 褰撳墠闃熷垪
                        const availableSlotsForReplenish = Math.max(0, militaryCapacity - currentArmyCount - baseQueue.length);

                        if (availableSlotsForReplenish > 0) {
                            let slotsRemaining = availableSlotsForReplenish;
                            const replenishItems = [];
                            const replenishCounts = {};

                            // 璁＄畻姣忕鍗曚綅鍙ˉ鍏呯殑鏁伴噺
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

                            // 妫€鏌ユ槸鍚﹁兘鏀粯
                            const currentResources = result.resources || current.resources || {};
                            let canAfford = (currentResources.silver || 0) >= totalSilverCost;
                            if (canAfford) {
                                Object.entries(totalResourceCost).forEach(([res, amount]) => {
                                    if ((currentResources[res] || 0) < amount) canAfford = false;
                                });
                            }

                            if (canAfford && Object.keys(replenishCounts).length > 0) {
                                // 鎵ｉ櫎璧勬簮
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

                    // 鍘熸湁鐨勯槦鍒楄鍓€昏緫
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
                    // [FIX] 蹇呴』鑰冭檻涓嶅悓鍏电鐨刾opulationCost锛屽惁鍒欎細瀵艰嚧瓒呭憳
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

                    // 灏嗙瓑寰呬腑鐨勯」杞负璁粌涓紙濡傛灉鏈夊彲鐢ㄥ矖浣嶏級
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

                    // [FIX] 璁＄畻鍙互鍔犲叆鍐涢槦鐨勬暟閲忥紙涓嶈秴杩囧閲忎笂闄愶級
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

                    // 鍙彇鑳藉姞鍏ョ殑閮ㄥ垎
                    const canComplete = completed.slice(0, slotsAvailableForCompletion);
                    const mustWait = completed.slice(slotsAvailableForCompletion);

                    if (canComplete.length > 0) {
                        // 灏嗗畬鎴愮殑鍗曚綅鍔犲叆鍐涢槦
                        setArmy(prevArmy => {
                            const newArmy = { ...prevArmy };
                            // [FIX] 鍐嶆妫€鏌ュ閲忥紝闃叉绔炴€佹潯浠?
                            // [FIX Bug8] 竞态条件检查：prevTotal 需要包含军团内的兵力
                            let prevTotal = Object.values(newArmy).reduce((sum, c) => sum + c, 0);
                            const corpsForRaceCheck = current.militaryCorps || [];
                            for (const cps of corpsForRaceCheck) {
                                if (cps?.isAI) continue;
                                prevTotal += Object.values(cps?.units || {}).reduce((sum, c) => sum + c, 0);
                            }
                            let addedCount = 0;

                            canComplete.forEach(item => {
                                if (militaryCapacity <= 0 || prevTotal + addedCount < militaryCapacity) {
                                    newArmy[item.unitId] = (newArmy[item.unitId] || 0) + 1;
                                    addedCount++;
                                }
                            });
                            return newArmy;
                        });

                        // [PERF] 澶ч噺鍗曚綅鍚屾椂姣曚笟鏃堕€愭潯鏃ュ織浼氬崱椤匡細鏀逛负鎽樿 + 灏戦噺鏍蜂緥
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

                    // 杩斿洖鏈畬鎴愮殑璁粌锛堟帓闄ゅ凡瀹屾垚涓斿姞鍏ュ啗闃熺殑锛夛紝淇濈暀鍥犲閲忛棶棰樻湭鑳藉姞鍏ョ殑
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
        }, tickInterval); // 鏍规嵁娓告垙閫熷害鍔ㄦ€佽皟鏁存墽琛岄鐜?

        return () => clearInterval(timer);
    }, [gameSpeed, isPaused, activeFestivalEffects, setFestivalModal, setActiveFestivalEffects, setLastFestivalYear, lastFestivalYear, setIsPaused]); // 渚濊禆娓告垙閫熷害銆佹殏鍋滅姸鎬佸拰搴嗗吀鐩稿叧鐘舵€?
};

