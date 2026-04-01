// 贸易 / 商人 Store
// 包含：merchantState, tradeStats

import { create } from 'zustand';

const buildInitialMerchantState = () => ({
    pendingTrades: [],
    lastTradeTime: 0,
    lockedCapital: 0,
    merchantAssignments: {},
    merchantTradePreferences: { import: {}, export: {} },
});

export const useTradeStore = create((set, get) => ({
    merchantState: buildInitialMerchantState(),
    setMerchantState: (v) => set({ merchantState: typeof v === 'function' ? v(get().merchantState) : v }),

    tradeStats: { tradeTax: 0 },
    setTradeStats: (v) => set({ tradeStats: typeof v === 'function' ? v(get().tradeStats) : v }),

    // 静态引用
    buildInitialMerchantState,

    // 批量重置
    resetTrade: (overrides = {}) => set({
        merchantState: buildInitialMerchantState(),
        tradeStats: { tradeTax: 0 },
        ...overrides,
    }),
}));
