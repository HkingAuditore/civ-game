// 建筑 / 科技 / 时代 Store
// 包含：buildings, buildingUpgrades, techsUnlocked, epoch, daysElapsed

import { create } from 'zustand';

export const useBuildingStore = create((set, get) => ({
    buildings: {},
    setBuildings: (v) => set({ buildings: typeof v === 'function' ? v(get().buildings) : v }),

    buildingUpgrades: {},
    setBuildingUpgrades: (v) => set({ buildingUpgrades: typeof v === 'function' ? v(get().buildingUpgrades) : v }),

    techsUnlocked: [],
    setTechsUnlocked: (v) => set({ techsUnlocked: typeof v === 'function' ? v(get().techsUnlocked) : v }),

    epoch: 0,
    setEpoch: (v) => set({ epoch: typeof v === 'function' ? v(get().epoch) : v }),

    daysElapsed: 0,
    setDaysElapsed: (v) => set({ daysElapsed: typeof v === 'function' ? v(get().daysElapsed) : v }),

    // 批量重置
    resetBuildings: (overrides = {}) => set({
        buildings: {},
        buildingUpgrades: {},
        techsUnlocked: [],
        epoch: 0,
        daysElapsed: 0,
        ...overrides,
    }),
}));
