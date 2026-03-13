// 政治系统 Store
// 包含：rebellion, coalition, legitimacy, decrees, quotas, strategicActions 等

import { create } from 'zustand';

export const usePoliticsStore = create((set, get) => ({
    // 叛乱
    rebellionStates: {},
    setRebellionStates: (v) => set({ rebellionStates: typeof v === 'function' ? v(get().rebellionStates) : v }),

    // 执政联盟
    rulingCoalition: ['peasant'],
    setRulingCoalition: (v) => set({ rulingCoalition: typeof v === 'function' ? v(get().rulingCoalition) : v }),
    legitimacy: 0,
    setLegitimacy: (v) => set({ legitimacy: typeof v === 'function' ? v(get().legitimacy) : v }),

    // 法令
    decrees: [],
    setDecrees: (v) => set({ decrees: typeof v === 'function' ? v(get().decrees) : v }),
    activeDecrees: {},
    setActiveDecrees: (v) => set({ activeDecrees: typeof v === 'function' ? v(get().activeDecrees) : v }),
    decreeCooldowns: {},
    setDecreCooldowns: (v) => set({ decreeCooldowns: typeof v === 'function' ? v(get().decreeCooldowns) : v }),
    // Alias（拼写兼容）
    setDecreeCooldowns: (v) => set({ decreeCooldowns: typeof v === 'function' ? v(get().decreeCooldowns) : v }),

    // 配额 & 扩张
    quotaTargets: {},
    setQuotaTargets: (v) => set({ quotaTargets: typeof v === 'function' ? v(get().quotaTargets) : v }),
    expansionSettings: {},
    setExpansionSettings: (v) => set({ expansionSettings: typeof v === 'function' ? v(get().expansionSettings) : v }),

    // 策略行动
    actionCooldowns: {},
    setActionCooldowns: (v) => set({ actionCooldowns: typeof v === 'function' ? v(get().actionCooldowns) : v }),
    actionUsage: {},
    setActionUsage: (v) => set({ actionUsage: typeof v === 'function' ? v(get().actionUsage) : v }),
    promiseTasks: [],
    setPromiseTasks: (v) => set({ promiseTasks: typeof v === 'function' ? v(get().promiseTasks) : v }),

    // 批量重置
    resetPolitics: (overrides = {}) => set({
        rebellionStates: {},
        rulingCoalition: ['peasant'],
        legitimacy: 0,
        decrees: [],
        activeDecrees: {},
        decreeCooldowns: {},
        quotaTargets: {},
        expansionSettings: {},
        actionCooldowns: {},
        actionUsage: {},
        promiseTasks: [],
        ...overrides,
    }),
}));
