// 贸易 / 商人 Store
// 包含：merchantState, tradeRoutes, tradeStats

import { create } from 'zustand';

const buildInitialMerchantState = () => ({
    pendingTrades: [],
    lastTradeTime: 0,
    lockedCapital: 0,
    merchantAssignments: {},
    merchantTradePreferences: { import: {}, export: {} },
});

const buildInitialTradeRoutes = () => ({
    routes: [],
});

export const useTradeStore = create((set, get) => ({
    merchantState: buildInitialMerchantState(),
    setMerchantState: (v) => set({ merchantState: typeof v === 'function' ? v(get().merchantState) : v }),

    tradeRoutes: buildInitialTradeRoutes(),
    setTradeRoutes: (v) => set({ tradeRoutes: typeof v === 'function' ? v(get().tradeRoutes) : v }),

    tradeStats: { tradeTax: 0, tradeRouteTax: 0 },
    setTradeStats: (v) => set({ tradeStats: typeof v === 'function' ? v(get().tradeStats) : v }),

    // 静态引用
    buildInitialMerchantState,
    buildInitialTradeRoutes,

    // 批量重置
    resetTrade: (overrides = {}) => set({
        merchantState: buildInitialMerchantState(),
        tradeRoutes: buildInitialTradeRoutes(),
        tradeStats: { tradeTax: 0, tradeRouteTax: 0 },
        ...overrides,
    }),
}));
