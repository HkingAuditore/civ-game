// Store 工具函数
// 提供 snapshot（快照）/ batch update / 兼容桥接等功能
// 这是 useGameState → Zustand 迁移的核心桥接层

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

/**
 * 获取所有 store 的当前状态快照（纯数据，不含函数）
 * 用于存档、传入 simulation worker 等
 */
export const getStoreSnapshot = () => {
    const ui = useUIStore.getState();
    const res = useResourceStore.getState();
    const pop = usePopulationStore.getState();
    const build = useBuildingStore.getState();
    const eco = useEconomyStore.getState();
    const mil = useMilitaryStore.getState();
    const diplo = useDiplomacyStore.getState();
    const pol = usePoliticsStore.getState();
    const off = useOfficialStore.getState();
    const evt = useEventStore.getState();
    const trade = useTradeStore.getState();

    // 返回纯数据（排除 set* 函数和工具方法）
    return {
        // UI
        activeTab: ui.activeTab,
        gameSpeed: ui.gameSpeed,
        isPaused: ui.isPaused,
        pausedBeforeEvent: ui.pausedBeforeEvent,
        autoSaveInterval: ui.autoSaveInterval,
        isAutoSaveEnabled: ui.isAutoSaveEnabled,
        lastAutoSaveTime: ui.lastAutoSaveTime,
        difficulty: ui.difficulty,
        empireName: ui.empireName,
        eventConfirmationEnabled: ui.eventConfirmationEnabled,
        showTutorial: ui.showTutorial,
        logs: ui.logs,
        clicks: ui.clicks,
        stratumDetailView: ui.stratumDetailView,
        resourceDetailView: ui.resourceDetailView,
        populationDetailView: ui.populationDetailView,

        // 资源
        resources: res.resources,
        market: res.market,
        priceHistory: res.priceHistory,
        equilibriumPrices: res.equilibriumPrices,
        economicIndicators: res.economicIndicators,
        fiscalActual: res.fiscalActual,
        dailyMilitaryExpense: res.dailyMilitaryExpense,
        rates: res.rates,
        taxes: res.taxes,
        taxPolicies: res.taxPolicies,

        // 人口
        population: pop.population,
        popStructure: pop.popStructure,
        maxPop: pop.maxPop,
        maxPopBonus: pop.maxPopBonus,
        birthAccumulator: pop.birthAccumulator,
        classApproval: pop.classApproval,
        approvalBreakdown: pop.approvalBreakdown,
        classInfluence: pop.classInfluence,
        classInfluenceShift: pop.classInfluenceShift,
        classWealth: pop.classWealth,
        classWealthDelta: pop.classWealthDelta,
        classIncome: pop.classIncome,
        classExpense: pop.classExpense,
        classFinancialData: pop.classFinancialData,
        buildingFinancialData: pop.buildingFinancialData,
        classWealthHistory: pop.classWealthHistory,
        classNeedsHistory: pop.classNeedsHistory,
        history: pop.history,
        totalInfluence: pop.totalInfluence,
        totalWealth: pop.totalWealth,
        activeBuffs: pop.activeBuffs,
        activeDebuffs: pop.activeDebuffs,
        stability: pop.stability,
        classShortages: pop.classShortages,
        classLivingStandard: pop.classLivingStandard,
        livingStandardStreaks: pop.livingStandardStreaks,
        migrationCooldowns: pop.migrationCooldowns,
        taxShock: pop.taxShock,
        jobFill: pop.jobFill,
        jobsAvailable: pop.jobsAvailable,
        buildingJobsRequired: pop.buildingJobsRequired,
        modifiers: pop.modifiers,

        // 建筑
        buildings: build.buildings,
        buildingUpgrades: build.buildingUpgrades,
        techsUnlocked: build.techsUnlocked,
        epoch: build.epoch,
        daysElapsed: build.daysElapsed,

        // 经济
        eventEffectSettings: eco.eventEffectSettings,
        activeEventEffects: eco.activeEventEffects,
        festivalModal: eco.festivalModal,
        lastFestivalYear: eco.lastFestivalYear,
        annualReportBaseline: eco.annualReportBaseline,
        priceControls: eco.priceControls,

        // 军事
        army: mil.army,
        militaryQueue: mil.militaryQueue,
        selectedTarget: mil.selectedTarget,
        battleResult: mil.battleResult,
        battleNotifications: mil.battleNotifications,
        militaryWageRatio: mil.militaryWageRatio,
        autoRecruitEnabled: mil.autoRecruitEnabled,
        targetArmyComposition: mil.targetArmyComposition,
        lastBattleTargetId: mil.lastBattleTargetId,
        lastBattleDay: mil.lastBattleDay,
        militaryCorps: mil.militaryCorps,
        generals: mil.generals,
        activeFronts: mil.activeFronts,
        activeBattles: mil.activeBattles,
        pendingRepairs: mil.pendingRepairs,

        // 外交
        nations: diplo.nations,
        diplomaticReputation: diplo.diplomaticReputation,
        diplomacyOrganizations: diplo.diplomacyOrganizations,
        vassalDiplomacyQueue: diplo.vassalDiplomacyQueue,
        vassalDiplomacyHistory: diplo.vassalDiplomacyHistory,
        overseasInvestments: diplo.overseasInvestments,
        foreignInvestments: diplo.foreignInvestments,
        foreignInvestmentPolicy: diplo.foreignInvestmentPolicy,
        overseasBuildings: diplo.overseasBuildings,
        playerInstallmentPayment: diplo.playerInstallmentPayment,

        // 政治
        rebellionStates: pol.rebellionStates,
        rulingCoalition: pol.rulingCoalition,
        legitimacy: pol.legitimacy,
        decrees: pol.decrees,
        activeDecrees: pol.activeDecrees,
        decreeCooldowns: pol.decreeCooldowns,
        quotaTargets: pol.quotaTargets,
        expansionSettings: pol.expansionSettings,
        actionCooldowns: pol.actionCooldowns,
        actionUsage: pol.actionUsage,
        promiseTasks: pol.promiseTasks,

        // 官员
        officials: off.officials,
        officialsSimCursor: off.officialsSimCursor,
        officialCandidates: off.officialCandidates,
        lastSelectionDay: off.lastSelectionDay,
        officialCapacity: off.officialCapacity,
        ministerAssignments: off.ministerAssignments,
        ministerAutoExpansion: off.ministerAutoExpansion,
        lastMinisterExpansionDay: off.lastMinisterExpansionDay,

        // 事件
        currentEvent: evt.currentEvent,
        eventHistory: evt.eventHistory,
        unlockedAchievements: evt.unlockedAchievements,
        achievementProgress: evt.achievementProgress,

        // 贸易
        merchantState: trade.merchantState,
        tradeStats: trade.tradeStats,
    };
};

/**
 * 将快照数据应用到所有 store（用于 loadGame）
 * @param {Object} data - 存档数据
 */
export const applyStoreSnapshot = (data) => {
    if (!data || typeof data !== 'object') return;

    // UI
    useUIStore.setState({
        ...(data.activeTab !== undefined && { activeTab: data.activeTab }),
        ...(data.gameSpeed !== undefined && { gameSpeed: data.gameSpeed }),
        ...(data.isPaused !== undefined && { isPaused: data.isPaused }),
        ...(data.autoSaveInterval !== undefined && { autoSaveInterval: data.autoSaveInterval }),
        ...(data.isAutoSaveEnabled !== undefined && { isAutoSaveEnabled: data.isAutoSaveEnabled }),
        ...(data.difficulty !== undefined && { difficulty: data.difficulty }),
        ...(data.empireName !== undefined && { empireName: data.empireName }),
        ...(data.eventConfirmationEnabled !== undefined && { eventConfirmationEnabled: data.eventConfirmationEnabled }),
        ...(data.showTutorial !== undefined && { showTutorial: data.showTutorial }),
        ...(data.logs !== undefined && { logs: data.logs }),
    });

    // 资源
    useResourceStore.setState({
        ...(data.resources !== undefined && { resources: data.resources }),
        ...(data.market !== undefined && { market: data.market }),
        ...(data.priceHistory !== undefined && { priceHistory: data.priceHistory }),
        ...(data.equilibriumPrices !== undefined && { equilibriumPrices: data.equilibriumPrices }),
        ...(data.economicIndicators !== undefined && { economicIndicators: data.economicIndicators }),
        ...(data.rates !== undefined && { rates: data.rates }),
        ...(data.taxes !== undefined && { taxes: data.taxes }),
        ...(data.taxPolicies !== undefined && { taxPolicies: data.taxPolicies }),
    });

    // 人口
    usePopulationStore.setState({
        ...(data.population !== undefined && { population: data.population }),
        ...(data.popStructure !== undefined && { popStructure: data.popStructure }),
        ...(data.maxPop !== undefined && { maxPop: data.maxPop }),
        ...(data.maxPopBonus !== undefined && { maxPopBonus: data.maxPopBonus }),
        ...(data.birthAccumulator !== undefined && { birthAccumulator: data.birthAccumulator }),
        ...(data.classApproval !== undefined && { classApproval: data.classApproval }),
        ...(data.classInfluence !== undefined && { classInfluence: data.classInfluence }),
        ...(data.classWealth !== undefined && { classWealth: data.classWealth }),
        ...(data.classWealthHistory !== undefined && { classWealthHistory: data.classWealthHistory }),
        ...(data.classNeedsHistory !== undefined && { classNeedsHistory: data.classNeedsHistory }),
        ...(data.history !== undefined && { history: data.history }),
        ...(data.stability !== undefined && { stability: data.stability }),
        ...(data.activeBuffs !== undefined && { activeBuffs: data.activeBuffs }),
        ...(data.activeDebuffs !== undefined && { activeDebuffs: data.activeDebuffs }),
        ...(data.livingStandardStreaks !== undefined && { livingStandardStreaks: data.livingStandardStreaks }),
        ...(data.migrationCooldowns !== undefined && { migrationCooldowns: data.migrationCooldowns }),
        ...(data.jobFill !== undefined && { jobFill: data.jobFill }),
        ...(data.modifiers !== undefined && { modifiers: data.modifiers }),
    });

    // 建筑
    useBuildingStore.setState({
        ...(data.buildings !== undefined && { buildings: data.buildings }),
        ...(data.buildingUpgrades !== undefined && { buildingUpgrades: data.buildingUpgrades }),
        ...(data.techsUnlocked !== undefined && { techsUnlocked: data.techsUnlocked }),
        ...(data.epoch !== undefined && { epoch: data.epoch }),
        ...(data.daysElapsed !== undefined && { daysElapsed: data.daysElapsed }),
    });

    // 经济
    useEconomyStore.setState({
        ...(data.eventEffectSettings !== undefined && { eventEffectSettings: data.eventEffectSettings }),
        ...(data.activeEventEffects !== undefined && { activeEventEffects: data.activeEventEffects }),
        ...(data.lastFestivalYear !== undefined && { lastFestivalYear: data.lastFestivalYear }),
        ...(data.annualReportBaseline !== undefined && { annualReportBaseline: data.annualReportBaseline }),
        ...(data.priceControls !== undefined && { priceControls: data.priceControls }),
    });

    // 军事
    useMilitaryStore.setState({
        ...(data.army !== undefined && { army: data.army }),
        ...(data.militaryQueue !== undefined && { militaryQueue: data.militaryQueue }),
        ...(data.battleResult !== undefined && { battleResult: data.battleResult }),
        ...(data.militaryWageRatio !== undefined && { militaryWageRatio: data.militaryWageRatio }),
        ...(data.autoRecruitEnabled !== undefined && { autoRecruitEnabled: data.autoRecruitEnabled }),
        ...(data.targetArmyComposition !== undefined && { targetArmyComposition: data.targetArmyComposition }),
        ...(data.militaryCorps !== undefined && { militaryCorps: data.militaryCorps }),
        ...(data.generals !== undefined && { generals: data.generals }),
        ...(data.activeFronts !== undefined && { activeFronts: data.activeFronts }),
        ...(data.activeBattles !== undefined && { activeBattles: data.activeBattles }),
    });

    // 外交
    useDiplomacyStore.setState({
        ...(data.nations !== undefined && { nations: data.nations }),
        ...(data.diplomaticReputation !== undefined && { diplomaticReputation: data.diplomaticReputation }),
        ...(data.diplomacyOrganizations !== undefined && { diplomacyOrganizations: data.diplomacyOrganizations }),
        ...(data.vassalDiplomacyQueue !== undefined && { vassalDiplomacyQueue: data.vassalDiplomacyQueue }),
        ...(data.vassalDiplomacyHistory !== undefined && { vassalDiplomacyHistory: data.vassalDiplomacyHistory }),
        ...(data.overseasInvestments !== undefined && { overseasInvestments: data.overseasInvestments }),
        ...(data.foreignInvestments !== undefined && { foreignInvestments: data.foreignInvestments }),
        ...(data.foreignInvestmentPolicy !== undefined && { foreignInvestmentPolicy: data.foreignInvestmentPolicy }),
        ...(data.overseasBuildings !== undefined && { overseasBuildings: data.overseasBuildings }),
        ...(data.playerInstallmentPayment !== undefined && { playerInstallmentPayment: data.playerInstallmentPayment }),
    });

    // 政治
    usePoliticsStore.setState({
        ...(data.rebellionStates !== undefined && { rebellionStates: data.rebellionStates }),
        ...(data.rulingCoalition !== undefined && { rulingCoalition: data.rulingCoalition }),
        ...(data.legitimacy !== undefined && { legitimacy: data.legitimacy }),
        ...(data.decrees !== undefined && { decrees: data.decrees }),
        ...(data.activeDecrees !== undefined && { activeDecrees: data.activeDecrees }),
        ...(data.decreeCooldowns !== undefined && { decreeCooldowns: data.decreeCooldowns }),
        ...(data.quotaTargets !== undefined && { quotaTargets: data.quotaTargets }),
        ...(data.expansionSettings !== undefined && { expansionSettings: data.expansionSettings }),
        ...(data.actionCooldowns !== undefined && { actionCooldowns: data.actionCooldowns }),
        ...(data.promiseTasks !== undefined && { promiseTasks: data.promiseTasks }),
    });

    // 官员
    useOfficialStore.setState({
        ...(data.officials !== undefined && { officials: data.officials }),
        ...(data.officialCandidates !== undefined && { officialCandidates: data.officialCandidates }),
        ...(data.officialCapacity !== undefined && { officialCapacity: data.officialCapacity }),
        ...(data.ministerAssignments !== undefined && { ministerAssignments: data.ministerAssignments }),
        ...(data.ministerAutoExpansion !== undefined && { ministerAutoExpansion: data.ministerAutoExpansion }),
        ...(data.lastMinisterExpansionDay !== undefined && { lastMinisterExpansionDay: data.lastMinisterExpansionDay }),
        ...(data.activeDecrees !== undefined && { /* handled in politics */ }),
    });

    // 事件
    useEventStore.setState({
        ...(data.currentEvent !== undefined && { currentEvent: data.currentEvent }),
        ...(data.eventHistory !== undefined && { eventHistory: data.eventHistory }),
        ...(data.unlockedAchievements !== undefined && { unlockedAchievements: data.unlockedAchievements }),
        ...(data.achievementProgress !== undefined && { achievementProgress: data.achievementProgress }),
    });

    // 贸易
    useTradeStore.setState({
        ...(data.merchantState !== undefined && { merchantState: data.merchantState }),
        ...(data.tradeStats !== undefined && { tradeStats: data.tradeStats }),
    });
};

/**
 * 批量更新多个 store（用于 game loop tick 结束时的批量写入）
 * @param {Object} updates - { storeName: { field: value, ... }, ... }
 */
export const batchStoreUpdate = (updates) => {
    if (!updates || typeof updates !== 'object') return;

    if (updates.ui) useUIStore.setState(updates.ui);
    if (updates.resource) useResourceStore.setState(updates.resource);
    if (updates.population) usePopulationStore.setState(updates.population);
    if (updates.building) useBuildingStore.setState(updates.building);
    if (updates.economy) useEconomyStore.setState(updates.economy);
    if (updates.military) useMilitaryStore.setState(updates.military);
    if (updates.diplomacy) useDiplomacyStore.setState(updates.diplomacy);
    if (updates.politics) usePoliticsStore.setState(updates.politics);
    if (updates.official) useOfficialStore.setState(updates.official);
    if (updates.event) useEventStore.setState(updates.event);
    if (updates.trade) useTradeStore.setState(updates.trade);
};

/**
 * 获取所有 store 引用（用于在非 React 上下文中直接操作）
 */
export const getAllStores = () => ({
    ui: useUIStore,
    resource: useResourceStore,
    population: usePopulationStore,
    building: useBuildingStore,
    economy: useEconomyStore,
    military: useMilitaryStore,
    diplomacy: useDiplomacyStore,
    politics: usePoliticsStore,
    official: useOfficialStore,
    event: useEventStore,
    trade: useTradeStore,
});
