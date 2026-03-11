// 经济系统 Store（阶层经济衍生 + 事件效果 + 庆典）
// 与 useResourceStore 区分：这里是"系统性经济状态"，不是"资源数值"

import { create } from 'zustand';

const DEFAULT_EVENT_EFFECT_SETTINGS = {
    approval: { duration: 30, decayRate: 0.04 },
    stability: { duration: 30, decayRate: 0.04 },
    resourceDemand: { duration: 60, decayRate: 0.02 },
    stratumDemand: { duration: 60, decayRate: 0.02 },
    buildingProduction: { duration: 45, decayRate: 0.025 },
    logVisibility: {
        showMerchantTradeLogs: true,
        showTradeRouteLogs: true,
    },
};

const buildInitialEventEffects = () => ({
    approval: [],
    stability: [],
    resourceDemand: [],
    stratumDemand: [],
    buildingProduction: [],
    forcedSubsidy: [],
});

export const useEconomyStore = create((set, get) => ({
    // 事件效果设置
    eventEffectSettings: { ...DEFAULT_EVENT_EFFECT_SETTINGS },
    setEventEffectSettings: (v) => set({ eventEffectSettings: typeof v === 'function' ? v(get().eventEffectSettings) : v }),

    // 活跃事件效果
    activeEventEffects: buildInitialEventEffects(),
    setActiveEventEffects: (v) => set({ activeEventEffects: typeof v === 'function' ? v(get().activeEventEffects) : v }),

    // 庆典
    festivalModal: null,
    setFestivalModal: (v) => set({ festivalModal: typeof v === 'function' ? v(get().festivalModal) : v }),
    activeFestivalEffects: [],
    setActiveFestivalEffects: (v) => set({ activeFestivalEffects: typeof v === 'function' ? v(get().activeFestivalEffects) : v }),
    lastFestivalYear: 1,
    setLastFestivalYear: (v) => set({ lastFestivalYear: typeof v === 'function' ? v(get().lastFestivalYear) : v }),

    // 价格管控
    priceControls: {
        enabled: false,
        governmentBuyPrices: {},
        governmentSellPrices: {},
    },
    setPriceControls: (v) => set({ priceControls: typeof v === 'function' ? v(get().priceControls) : v }),

    // 静态引用
    DEFAULT_EVENT_EFFECT_SETTINGS,
    buildInitialEventEffects,

    // 批量重置
    resetEconomy: (overrides = {}) => set({
        eventEffectSettings: { ...DEFAULT_EVENT_EFFECT_SETTINGS },
        activeEventEffects: buildInitialEventEffects(),
        festivalModal: null,
        activeFestivalEffects: [],
        lastFestivalYear: 1,
        priceControls: { enabled: false, governmentBuyPrices: {}, governmentSellPrices: {} },
        ...overrides,
    }),
}));
