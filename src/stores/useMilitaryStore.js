// 军事系统 Store
// 包含：army, militaryQueue, corps, generals, fronts, battles 等

import { create } from 'zustand';

export const useMilitaryStore = create((set, get) => ({
    army: {},
    setArmy: (v) => set({ army: typeof v === 'function' ? v(get().army) : v }),

    militaryQueue: [],
    setMilitaryQueue: (v) => set({ militaryQueue: typeof v === 'function' ? v(get().militaryQueue) : v }),

    selectedTarget: null,
    setSelectedTarget: (v) => set({ selectedTarget: typeof v === 'function' ? v(get().selectedTarget) : v }),

    battleResult: null,
    setBattleResult: (v) => set({ battleResult: typeof v === 'function' ? v(get().battleResult) : v }),

    battleNotifications: [],
    setBattleNotifications: (v) => set({ battleNotifications: typeof v === 'function' ? v(get().battleNotifications) : v }),

    militaryWageRatio: 1.5,
    setMilitaryWageRatio: (v) => set({ militaryWageRatio: typeof v === 'function' ? v(get().militaryWageRatio) : v }),

    autoRecruitEnabled: false,
    setAutoRecruitEnabled: (v) => set({ autoRecruitEnabled: typeof v === 'function' ? v(get().autoRecruitEnabled) : v }),

    targetArmyComposition: {},
    setTargetArmyComposition: (v) => set({ targetArmyComposition: typeof v === 'function' ? v(get().targetArmyComposition) : v }),

    lastBattleTargetId: null,
    setLastBattleTargetId: (v) => set({ lastBattleTargetId: typeof v === 'function' ? v(get().lastBattleTargetId) : v }),

    lastBattleDay: -999,
    setLastBattleDay: (v) => set({ lastBattleDay: typeof v === 'function' ? v(get().lastBattleDay) : v }),

    // 新军事系统
    militaryCorps: [],
    setMilitaryCorps: (v) => set({ militaryCorps: typeof v === 'function' ? v(get().militaryCorps) : v }),

    generals: [],
    setGenerals: (v) => set({ generals: typeof v === 'function' ? v(get().generals) : v }),

    activeFronts: [],
    setActiveFronts: (v) => set({ activeFronts: typeof v === 'function' ? v(get().activeFronts) : v }),

    activeBattles: [],
    setActiveBattles: (v) => set({ activeBattles: typeof v === 'function' ? v(get().activeBattles) : v }),

    pendingRepairs: [],
    setPendingRepairs: (v) => set({ pendingRepairs: typeof v === 'function' ? v(get().pendingRepairs) : v }),

    // 批量重置
    resetMilitary: (overrides = {}) => set({
        army: {},
        militaryQueue: [],
        selectedTarget: null,
        battleResult: null,
        battleNotifications: [],
        militaryWageRatio: 1.5,
        autoRecruitEnabled: false,
        targetArmyComposition: {},
        lastBattleTargetId: null,
        lastBattleDay: -999,
        militaryCorps: [],
        generals: [],
        activeFronts: [],
        activeBattles: [],
        pendingRepairs: [],
        ...overrides,
    }),
}));
