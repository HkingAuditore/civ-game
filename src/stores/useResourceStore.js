// 资源 / 经济指标 Store
// 包含：resources, market, priceHistory, equilibriumPrices, economicIndicators, fiscalActual, treasuryChangeLog 等

import { create } from 'zustand';
import { RESOURCES } from '../config';

const isTradable = (resourceKey) => {
    if (resourceKey === 'silver') return false;
    const def = RESOURCES[resourceKey];
    if (!def) return false;
    return !def.type || def.type !== 'virtual';
};

const buildInitialMarket = () => {
    const prices = {};
    Object.keys(RESOURCES).forEach(key => {
        if (!isTradable(key)) return;
        prices[key] = Math.max(0.5, RESOURCES[key].basePrice || 1);
    });
    return {
        prices,
        demand: {},
        supply: {},
        wages: {},
        priceHistory: {},
        supplyHistory: {},
        demandHistory: {},
    };
};

const INITIAL_RESOURCES = {
    food: 200, wood: 200, stone: 200, cloth: 80,
    plank: 0, brick: 0, iron: 0, tools: 0,
    copper: 0, papyrus: 0, spice: 0, coffee: 0,
    coal: 0, steel: 0, silver: 400, science: 0, culture: 300,
};

// 通用 setter 辅助：支持函数式或直接赋值
const makeSetter = (key) => (set, get) => (v) =>
    set({ [key]: typeof v === 'function' ? v(get()[key]) : v });

export const useResourceStore = create((set, get) => ({
    // 基础资源（内部状态，外部通过 setResources 包装器更新）
    resources: { ...INITIAL_RESOURCES },
    _setResourcesRaw: (v) => set({ resources: typeof v === 'function' ? v(get().resources) : v }),

    // 市场
    market: buildInitialMarket(),
    setMarket: (v) => set({ market: typeof v === 'function' ? v(get().market) : v }),

    // 经济指标
    priceHistory: {},
    setPriceHistory: (v) => set({ priceHistory: typeof v === 'function' ? v(get().priceHistory) : v }),
    equilibriumPrices: {},
    setEquilibriumPrices: (v) => set({ equilibriumPrices: typeof v === 'function' ? v(get().equilibriumPrices) : v }),
    economicIndicators: {
        gdp: { total: 0, consumption: 0, investment: 0, government: 0, netExports: 0, change: 0 },
        cpi: { index: 100, change: 0, breakdown: {} },
        ppi: { index: 100, change: 0, breakdown: {} },
    },
    setEconomicIndicators: (v) => set({ economicIndicators: typeof v === 'function' ? v(get().economicIndicators) : v }),

    // 财政实际口径
    fiscalActual: {
        silverDelta: 0,
        officialSalaryPaid: 0,
        forcedSubsidyPaid: 0,
        forcedSubsidyUnpaid: 0,
    },
    setFiscalActual: (v) => set({ fiscalActual: typeof v === 'function' ? v(get().fiscalActual) : v }),

    // 每日军队维护成本
    dailyMilitaryExpense: null,
    setDailyMilitaryExpense: (v) => set({ dailyMilitaryExpense: typeof v === 'function' ? v(get().dailyMilitaryExpense) : v }),

    // 变更日志（审计用）
    treasuryChangeLog: [],
    setTreasuryChangeLog: (v) => set({ treasuryChangeLog: typeof v === 'function' ? v(get().treasuryChangeLog) : v }),
    resourceChangeLog: [],
    setResourceChangeLog: (v) => set({ resourceChangeLog: typeof v === 'function' ? v(get().resourceChangeLog) : v }),
    classWealthChangeLog: [],
    setClassWealthChangeLog: (v) => set({ classWealthChangeLog: typeof v === 'function' ? v(get().classWealthChangeLog) : v }),

    // 产出速率（每日产出概览）
    rates: {},
    setRates: (v) => set({ rates: typeof v === 'function' ? v(get().rates) : v }),

    // 税收汇总
    taxes: {
        total: 0,
        breakdown: { headTax: 0, industryTax: 0, subsidy: 0, policyIncome: 0, policyExpense: 0 },
        efficiency: 1,
    },
    setTaxes: (v) => set({ taxes: typeof v === 'function' ? v(get().taxes) : v }),

    // 税收政策
    taxPolicies: {
        headTaxRates: (() => { const r = {}; Object.keys(RESOURCES).forEach(k => { if (!isTradable(k)) return; }); return r; })(),
        resourceTaxRates: {},
        businessTaxRates: {},
        exportTariffMultipliers: {},
        importTariffMultipliers: {},
        resourceTariffMultipliers: {},
    },
    setTaxPolicies: (v) => set({ taxPolicies: typeof v === 'function' ? v(get().taxPolicies) : v }),

    // 批量重置
    resetResources: (overrides = {}) => set({
        resources: { ...INITIAL_RESOURCES },
        market: buildInitialMarket(),
        priceHistory: {},
        equilibriumPrices: {},
        economicIndicators: {
            gdp: { total: 0, consumption: 0, investment: 0, government: 0, netExports: 0, change: 0 },
            cpi: { index: 100, change: 0, breakdown: {} },
            ppi: { index: 100, change: 0, breakdown: {} },
        },
        fiscalActual: { silverDelta: 0, officialSalaryPaid: 0, forcedSubsidyPaid: 0, forcedSubsidyUnpaid: 0 },
        dailyMilitaryExpense: null,
        treasuryChangeLog: [],
        resourceChangeLog: [],
        classWealthChangeLog: [],
        rates: {},
        taxes: { total: 0, breakdown: { headTax: 0, industryTax: 0, subsidy: 0, policyIncome: 0, policyExpense: 0 }, efficiency: 1 },
        ...overrides,
    }),

    // 静态引用
    INITIAL_RESOURCES,
    buildInitialMarket,
}));
