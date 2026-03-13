// 官员系统 Store
// 包含：officials, candidates, capacity, ministerAssignments 等

import { create } from 'zustand';

const buildInitialMinisterAssignments = () => ({
    agriculture: null,
    industry: null,
    commerce: null,
    civic: null,
    military: null,
    diplomacy: null,
});

const buildInitialMinisterAutoExpansion = () => ({
    agriculture: true,
    industry: true,
    commerce: true,
    civic: true,
});

export const useOfficialStore = create((set, get) => ({
    officials: [],
    setOfficials: (v) => set({ officials: typeof v === 'function' ? v(get().officials) : v }),

    officialsSimCursor: 0,
    setOfficialsSimCursor: (v) => set({ officialsSimCursor: typeof v === 'function' ? v(get().officialsSimCursor) : v }),

    officialCandidates: [],
    setOfficialCandidates: (v) => set({ officialCandidates: typeof v === 'function' ? v(get().officialCandidates) : v }),

    lastSelectionDay: -999,
    setLastSelectionDay: (v) => set({ lastSelectionDay: typeof v === 'function' ? v(get().lastSelectionDay) : v }),

    officialCapacity: 2,
    setOfficialCapacity: (v) => set({ officialCapacity: typeof v === 'function' ? v(get().officialCapacity) : v }),

    ministerAssignments: buildInitialMinisterAssignments(),
    setMinisterAssignments: (v) => set({ ministerAssignments: typeof v === 'function' ? v(get().ministerAssignments) : v }),

    ministerAutoExpansion: buildInitialMinisterAutoExpansion(),
    setMinisterAutoExpansion: (v) => set({ ministerAutoExpansion: typeof v === 'function' ? v(get().ministerAutoExpansion) : v }),

    lastMinisterExpansionDay: 0,
    setLastMinisterExpansionDay: (v) => set({ lastMinisterExpansionDay: typeof v === 'function' ? v(get().lastMinisterExpansionDay) : v }),

    // 静态引用
    buildInitialMinisterAssignments,
    buildInitialMinisterAutoExpansion,

    // 批量重置
    resetOfficials: (overrides = {}) => set({
        officials: [],
        officialsSimCursor: 0,
        officialCandidates: [],
        lastSelectionDay: -999,
        officialCapacity: 2,
        ministerAssignments: buildInitialMinisterAssignments(),
        ministerAutoExpansion: buildInitialMinisterAutoExpansion(),
        lastMinisterExpansionDay: 0,
        ...overrides,
    }),
}));
