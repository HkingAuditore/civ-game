// Store 同步层
// 将 useGameState 返回的 useState 值实时同步到 Zustand stores
// 这是渐进迁移方案的核心：保持 useGameState 不变，通过同步层让 Zustand stores 保持最新
//
// 策略：
// 1. useGameState 继续使用 useState 管理状态（不修改 3787 行的核心文件）
// 2. 本文件提供 useStoreSync(gameState) hook，在 App 层调用
// 3. 每次 gameState 变化时，自动同步到对应的 Zustand store
// 4. 新组件可以直接从 Zustand store 读取，获得 selector 级别的精细渲染优化
// 5. 后续可以逐步将 useGameState 中的 useState 替换为 store 读写

import { useEffect, useRef } from 'react';
import { useUIStore } from './useUIStore';
import { useResourceStore } from './useResourceStore';
import { usePopulationStore } from './usePopulationStore';
import { useBuildingStore } from './useBuildingStore';
import { useEconomyStore } from './useEconomyStore';
import { useMilitaryStore } from './useMilitaryStore';
import { useDiplomacyStore } from './useDiplomacyStore';
import { usePoliticsStore } from './usePoliticsStore';
import { useOfficialStore } from './useOfficialStore';
import { useEventStore } from './useEventStore';
import { useTradeStore } from './useTradeStore';

// 辅助：浅比较两个值是否相同（避免不必要的 setState）
const shallowEqual = (a, b) => a === b;

// 辅助：批量同步一个 store，只更新变化的字段
const syncStore = (store, fieldMap) => {
    const state = store.getState();
    const updates = {};
    let hasChanges = false;

    for (const [storeKey, sourceValue] of Object.entries(fieldMap)) {
        if (!shallowEqual(state[storeKey], sourceValue) && sourceValue !== undefined) {
            updates[storeKey] = sourceValue;
            hasChanges = true;
        }
    }

    if (hasChanges) {
        store.setState(updates);
    }
};

/**
 * 将 useGameState 的返回值同步到 Zustand stores
 * 在 App.jsx 中调用：useStoreSync(gameState)
 * 
 * 同步是单向的：gameState → stores
 * 这样 stores 始终反映最新的游戏状态，
 * 新组件可以直接用 useXxxStore() 读取
 * 
 * @param {Object} gs - useGameState() 的返回值
 */
export const useStoreSync = (gs) => {
    const prevRef = useRef(null);
    const lastSyncTimeRef = useRef(0);

    useEffect(() => {
        if (!gs) return;

        // 节流：至少间隔 16ms（一帧）才执行同步，减少高频渲染下的开销
        const now = Date.now();
        if (now - lastSyncTimeRef.current < 16) return;
        lastSyncTimeRef.current = now;

        // 同步 UI Store
        syncStore(useUIStore, {
            activeTab: gs.activeTab,
            gameSpeed: gs.gameSpeed,
            isPaused: gs.isPaused,
            pausedBeforeEvent: gs.pausedBeforeEvent,
            autoSaveInterval: gs.autoSaveInterval,
            isAutoSaveEnabled: gs.isAutoSaveEnabled,
            lastAutoSaveTime: gs.lastAutoSaveTime,
            difficulty: gs.difficulty,
            empireName: gs.empireName,
            eventConfirmationEnabled: gs.eventConfirmationEnabled,
            showTutorial: gs.showTutorial,
            logs: gs.logs,
            clicks: gs.clicks,
            stratumDetailView: gs.stratumDetailView,
            resourceDetailView: gs.resourceDetailView,
            populationDetailView: gs.populationDetailView,
        });

        // 同步 Resource Store
        syncStore(useResourceStore, {
            resources: gs.resources,
            market: gs.market,
            priceHistory: gs.priceHistory,
            equilibriumPrices: gs.equilibriumPrices,
            economicIndicators: gs.economicIndicators,
            fiscalActual: gs.fiscalActual,
            dailyMilitaryExpense: gs.dailyMilitaryExpense,
            rates: gs.rates,
            taxes: gs.taxes,
            taxPolicies: gs.taxPolicies,
        });

        // 同步 Population Store
        syncStore(usePopulationStore, {
            population: gs.population,
            popStructure: gs.popStructure,
            maxPop: gs.maxPop,
            maxPopBonus: gs.maxPopBonus,
            birthAccumulator: gs.birthAccumulator,
            classApproval: gs.classApproval,
            approvalBreakdown: gs.approvalBreakdown,
            classInfluence: gs.classInfluence,
            classInfluenceShift: gs.classInfluenceShift,
            classWealth: gs.classWealth,
            classWealthDelta: gs.classWealthDelta,
            classIncome: gs.classIncome,
            classExpense: gs.classExpense,
            classFinancialData: gs.classFinancialData,
            buildingFinancialData: gs.buildingFinancialData,
            classWealthHistory: gs.classWealthHistory,
            classNeedsHistory: gs.classNeedsHistory,
            history: gs.history,
            totalInfluence: gs.totalInfluence,
            totalWealth: gs.totalWealth,
            activeBuffs: gs.activeBuffs,
            activeDebuffs: gs.activeDebuffs,
            stability: gs.stability,
            classShortages: gs.classShortages,
            classLivingStandard: gs.classLivingStandard,
            livingStandardStreaks: gs.livingStandardStreaks,
            migrationCooldowns: gs.migrationCooldowns,
            taxShock: gs.taxShock,
            jobFill: gs.jobFill,
            jobsAvailable: gs.jobsAvailable,
            buildingJobsRequired: gs.buildingJobsRequired,
            modifiers: gs.modifiers,
        });

        // 同步 Building Store
        syncStore(useBuildingStore, {
            buildings: gs.buildings,
            buildingUpgrades: gs.buildingUpgrades,
            techsUnlocked: gs.techsUnlocked,
            epoch: gs.epoch,
            daysElapsed: gs.daysElapsed,
        });

        // 同步 Economy Store
        syncStore(useEconomyStore, {
            eventEffectSettings: gs.eventEffectSettings,
            activeEventEffects: gs.activeEventEffects,
            festivalModal: gs.festivalModal,
            lastFestivalYear: gs.lastFestivalYear,
            annualReportBaseline: gs.annualReportBaseline,
            priceControls: gs.priceControls,
        });

        // 同步 Military Store
        syncStore(useMilitaryStore, {
            army: gs.army,
            militaryQueue: gs.militaryQueue,
            selectedTarget: gs.selectedTarget,
            battleResult: gs.battleResult,
            battleNotifications: gs.battleNotifications,
            militaryWageRatio: gs.militaryWageRatio,
            autoRecruitEnabled: gs.autoRecruitEnabled,
            targetArmyComposition: gs.targetArmyComposition,
            lastBattleTargetId: gs.lastBattleTargetId,
            lastBattleDay: gs.lastBattleDay,
            militaryCorps: gs.militaryCorps,
            generals: gs.generals,
            activeFronts: gs.activeFronts,
            activeBattles: gs.activeBattles,
            pendingRepairs: gs.pendingRepairs,
        });

        // 同步 Diplomacy Store
        syncStore(useDiplomacyStore, {
            nations: gs.nations,
            diplomaticReputation: gs.diplomaticReputation,
            diplomacyOrganizations: gs.diplomacyOrganizations,
            vassalDiplomacyQueue: gs.vassalDiplomacyQueue,
            vassalDiplomacyHistory: gs.vassalDiplomacyHistory,
            overseasInvestments: gs.overseasInvestments,
            foreignInvestments: gs.foreignInvestments,
            foreignInvestmentPolicy: gs.foreignInvestmentPolicy,
            overseasBuildings: gs.overseasBuildings,
            playerInstallmentPayment: gs.playerInstallmentPayment,
        });

        // 同步 Politics Store
        syncStore(usePoliticsStore, {
            rebellionStates: gs.rebellionStates,
            rulingCoalition: gs.rulingCoalition,
            legitimacy: gs.legitimacy,
            decrees: gs.decrees,
            activeDecrees: gs.activeDecrees,
            decreeCooldowns: gs.decreeCooldowns,
            quotaTargets: gs.quotaTargets,
            expansionSettings: gs.expansionSettings,
            actionCooldowns: gs.actionCooldowns,
            actionUsage: gs.actionUsage,
            promiseTasks: gs.promiseTasks,
        });

        // 同步 Official Store
        syncStore(useOfficialStore, {
            officials: gs.officials,
            officialsSimCursor: gs.officialsSimCursor,
            officialCandidates: gs.officialCandidates,
            lastSelectionDay: gs.lastSelectionDay,
            officialCapacity: gs.officialCapacity,
            ministerAssignments: gs.ministerAssignments,
            ministerAutoExpansion: gs.ministerAutoExpansion,
            lastMinisterExpansionDay: gs.lastMinisterExpansionDay,
        });

        // 同步 Event Store
        syncStore(useEventStore, {
            currentEvent: gs.currentEvent,
            eventHistory: gs.eventHistory,
            unlockedAchievements: gs.unlockedAchievements,
            achievementProgress: gs.achievementProgress,
        });

        // 同步 Trade Store
        syncStore(useTradeStore, {
            merchantState: gs.merchantState,
            tradeRoutes: gs.tradeRoutes,
            tradeStats: gs.tradeStats,
        });

        prevRef.current = gs;
    });
    // 注意：不添加依赖数组 → 每次渲染都检查同步
    // 这是有意为之的：gameState 内部有 120+ 个字段，逐一列为依赖不实际
    // syncStore 内部的浅比较确保了不会产生不必要的 store 更新
};

/**
 * 一次性将外部数据同步到所有 stores（用于 loadGame / resetGame）
 * 不是 hook，可以在任何地方调用
 * 
 * @param {Object} data - 完整的游戏状态数据
 */
export const syncAllStoresToSnapshot = (data) => {
    if (!data || typeof data !== 'object') return;

    // 批量 setState 到各 store
    const pick = (keys) => {
        const result = {};
        keys.forEach(key => {
            if (data[key] !== undefined) {
                result[key] = data[key];
            }
        });
        return result;
    };

    const uiFields = pick([
        'activeTab', 'gameSpeed', 'isPaused', 'pausedBeforeEvent',
        'autoSaveInterval', 'isAutoSaveEnabled', 'lastAutoSaveTime',
        'difficulty', 'empireName', 'eventConfirmationEnabled',
        'showTutorial', 'logs', 'clicks',
        'stratumDetailView', 'resourceDetailView', 'populationDetailView',
    ]);
    if (Object.keys(uiFields).length > 0) useUIStore.setState(uiFields);

    const resFields = pick([
        'resources', 'market', 'priceHistory', 'equilibriumPrices',
        'economicIndicators', 'fiscalActual', 'dailyMilitaryExpense',
        'rates', 'taxes', 'taxPolicies',
    ]);
    if (Object.keys(resFields).length > 0) useResourceStore.setState(resFields);

    const popFields = pick([
        'population', 'popStructure', 'maxPop', 'maxPopBonus', 'birthAccumulator',
        'classApproval', 'approvalBreakdown', 'classInfluence', 'classInfluenceShift',
        'classWealth', 'classWealthDelta', 'classIncome', 'classExpense',
        'classFinancialData', 'buildingFinancialData',
        'classWealthHistory', 'classNeedsHistory', 'history',
        'totalInfluence', 'totalWealth', 'activeBuffs', 'activeDebuffs',
        'stability', 'classShortages', 'classLivingStandard',
        'livingStandardStreaks', 'migrationCooldowns', 'taxShock',
        'jobFill', 'jobsAvailable', 'buildingJobsRequired', 'modifiers',
    ]);
    if (Object.keys(popFields).length > 0) usePopulationStore.setState(popFields);

    const buildFields = pick(['buildings', 'buildingUpgrades', 'techsUnlocked', 'epoch', 'daysElapsed']);
    if (Object.keys(buildFields).length > 0) useBuildingStore.setState(buildFields);

    const ecoFields = pick([
        'eventEffectSettings', 'activeEventEffects',
        'festivalModal', 'lastFestivalYear', 'annualReportBaseline', 'priceControls',
    ]);
    if (Object.keys(ecoFields).length > 0) useEconomyStore.setState(ecoFields);

    const milFields = pick([
        'army', 'militaryQueue', 'selectedTarget', 'battleResult', 'battleNotifications',
        'militaryWageRatio', 'autoRecruitEnabled', 'targetArmyComposition',
        'lastBattleTargetId', 'lastBattleDay',
        'militaryCorps', 'generals', 'activeFronts', 'activeBattles', 'pendingRepairs',
    ]);
    if (Object.keys(milFields).length > 0) useMilitaryStore.setState(milFields);

    const diploFields = pick([
        'nations', 'diplomaticReputation', 'diplomacyOrganizations',
        'vassalDiplomacyQueue', 'vassalDiplomacyHistory',
        'overseasInvestments', 'foreignInvestments', 'foreignInvestmentPolicy',
        'overseasBuildings', 'playerInstallmentPayment',
    ]);
    if (Object.keys(diploFields).length > 0) useDiplomacyStore.setState(diploFields);

    const polFields = pick([
        'rebellionStates', 'rulingCoalition', 'legitimacy',
        'decrees', 'activeDecrees', 'decreeCooldowns',
        'quotaTargets', 'expansionSettings',
        'actionCooldowns', 'actionUsage', 'promiseTasks',
    ]);
    if (Object.keys(polFields).length > 0) usePoliticsStore.setState(polFields);

    const offFields = pick([
        'officials', 'officialsSimCursor', 'officialCandidates', 'lastSelectionDay',
        'officialCapacity', 'ministerAssignments', 'ministerAutoExpansion', 'lastMinisterExpansionDay',
    ]);
    if (Object.keys(offFields).length > 0) useOfficialStore.setState(offFields);

    const evtFields = pick(['currentEvent', 'eventHistory', 'unlockedAchievements', 'achievementProgress']);
    if (Object.keys(evtFields).length > 0) useEventStore.setState(evtFields);

    const tradeFields = pick(['merchantState', 'tradeRoutes', 'tradeStats']);
    if (Object.keys(tradeFields).length > 0) useTradeStore.setState(tradeFields);
};
