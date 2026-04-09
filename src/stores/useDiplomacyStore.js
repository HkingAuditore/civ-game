// 外交系统 Store
// 包含：nations, diplomaticReputation, diplomacyOrganizations, vassal, overseas 等

import { create } from 'zustand';

export const useDiplomacyStore = create((set, get) => ({
    nations: [],
    setNations: (v) => set({ nations: typeof v === 'function' ? v(get().nations) : v }),

    diplomaticReputation: 50,
    setDiplomaticReputation: (v) => set({ diplomaticReputation: typeof v === 'function' ? v(get().diplomaticReputation) : v }),

    // 组织
    diplomacyOrganizations: { organizations: [], lastGlobalGiftToPlayerDay: 0 },
    setDiplomacyOrganizations: (v) => set({ diplomacyOrganizations: typeof v === 'function' ? v(get().diplomacyOrganizations) : v }),

    // 附庸外交
    vassalDiplomacyQueue: [],
    setVassalDiplomacyQueue: (v) => set({ vassalDiplomacyQueue: typeof v === 'function' ? v(get().vassalDiplomacyQueue) : v }),
    vassalDiplomacyHistory: [],
    setVassalDiplomacyHistory: (v) => set({ vassalDiplomacyHistory: typeof v === 'function' ? v(get().vassalDiplomacyHistory) : v }),

    // 海外投资
    overseasInvestments: [],
    setOverseasInvestments: (v) => set({ overseasInvestments: typeof v === 'function' ? v(get().overseasInvestments) : v }),
    foreignInvestments: [],
    setForeignInvestments: (v) => set({ foreignInvestments: typeof v === 'function' ? v(get().foreignInvestments) : v }),
    foreignInvestmentPolicy: 'normal',
    setForeignInvestmentPolicy: (v) => set({ foreignInvestmentPolicy: typeof v === 'function' ? v(get().foreignInvestmentPolicy) : v }),
    foreignInvestmentPolicyOverrides: {},
    setForeignInvestmentPolicyOverrides: (v) => set({ foreignInvestmentPolicyOverrides: typeof v === 'function' ? v(get().foreignInvestmentPolicyOverrides) : v }),
    overseasBuildings: [],
    setOverseasBuildings: (v) => set({ overseasBuildings: typeof v === 'function' ? v(get().overseasBuildings) : v }),

    // 和平协议
    playerInstallmentPayment: null,
    setPlayerInstallmentPayment: (v) => set({ playerInstallmentPayment: typeof v === 'function' ? v(get().playerInstallmentPayment) : v }),

    // 批量重置
    resetDiplomacy: (overrides = {}) => set({
        nations: [],
        diplomaticReputation: 50,
        diplomacyOrganizations: { organizations: [], lastGlobalGiftToPlayerDay: 0 },
        vassalDiplomacyQueue: [],
        vassalDiplomacyHistory: [],
        overseasInvestments: [],
        foreignInvestments: [],
        foreignInvestmentPolicy: 'normal',
        foreignInvestmentPolicyOverrides: {},
        overseasBuildings: [],
        playerInstallmentPayment: null,
        ...overrides,
    }),
}));
