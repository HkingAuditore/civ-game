// 人口 / 社会阶层 Store
// 包含：population, popStructure, classApproval, classWealth, classInfluence, stability 等

import { create } from 'zustand';
import { STRATA } from '../config';

const buildInitialWealth = () => {
    const wealth = {};
    Object.keys(STRATA).forEach(key => {
        wealth[key] = STRATA[key].startingWealth || 0;
    });
    return wealth;
};

const buildInitialWealthHistory = () => {
    const history = {};
    Object.keys(STRATA).forEach(key => { history[key] = []; });
    return history;
};

const buildInitialNeedsHistory = () => {
    const history = {};
    Object.keys(STRATA).forEach(key => { history[key] = []; });
    return history;
};

const buildInitialLivingStandardStreaks = () => {
    const streaks = {};
    Object.keys(STRATA).forEach(key => {
        streaks[key] = { streak: 0, level: null };
    });
    return streaks;
};

const buildInitialHistory = () => {
    const classHistory = {};
    Object.keys(STRATA).forEach(key => {
        classHistory[key] = { pop: [], income: [], expense: [] };
    });
    return { treasury: [], tax: [], population: [], class: classHistory, gdp: [], cpi: [], ppi: [] };
};

export const usePopulationStore = create((set, get) => ({
    // 人口基础
    population: 5,
    setPopulation: (v) => set({ population: typeof v === 'function' ? v(get().population) : v }),
    popStructure: {},
    setPopStructure: (v) => set({ popStructure: typeof v === 'function' ? v(get().popStructure) : v }),
    maxPop: 10,
    setMaxPop: (v) => set({ maxPop: typeof v === 'function' ? v(get().maxPop) : v }),
    maxPopBonus: 0,
    setMaxPopBonus: (v) => set({ maxPopBonus: typeof v === 'function' ? v(get().maxPopBonus) : v }),
    birthAccumulator: 0,
    setBirthAccumulator: (v) => set({ birthAccumulator: typeof v === 'function' ? v(get().birthAccumulator) : v }),

    // 社会阶层
    classApproval: {},
    setClassApproval: (v) => set({ classApproval: typeof v === 'function' ? v(get().classApproval) : v }),
    approvalBreakdown: {},
    setApprovalBreakdown: (v) => set({ approvalBreakdown: typeof v === 'function' ? v(get().approvalBreakdown) : v }),
    classInfluence: {},
    setClassInfluence: (v) => set({ classInfluence: typeof v === 'function' ? v(get().classInfluence) : v }),
    classInfluenceShift: {},
    setClassInfluenceShift: (v) => set({ classInfluenceShift: typeof v === 'function' ? v(get().classInfluenceShift) : v }),

    // 阶层财富（内部状态，外部通过包装器更新）
    classWealth: buildInitialWealth(),
    _setClassWealthRaw: (v) => set({ classWealth: typeof v === 'function' ? v(get().classWealth) : v }),
    classWealthDelta: {},
    setClassWealthDelta: (v) => set({ classWealthDelta: typeof v === 'function' ? v(get().classWealthDelta) : v }),
    classIncome: {},
    setClassIncome: (v) => set({ classIncome: typeof v === 'function' ? v(get().classIncome) : v }),
    classExpense: {},
    setClassExpense: (v) => set({ classExpense: typeof v === 'function' ? v(get().classExpense) : v }),
    classFinancialData: {},
    setClassFinancialData: (v) => set({ classFinancialData: typeof v === 'function' ? v(get().classFinancialData) : v }),
    buildingFinancialData: {},
    setBuildingFinancialData: (v) => set({ buildingFinancialData: typeof v === 'function' ? v(get().buildingFinancialData) : v }),

    // 历史
    classWealthHistory: buildInitialWealthHistory(),
    setClassWealthHistory: (v) => set({ classWealthHistory: typeof v === 'function' ? v(get().classWealthHistory) : v }),
    classNeedsHistory: buildInitialNeedsHistory(),
    setClassNeedsHistory: (v) => set({ classNeedsHistory: typeof v === 'function' ? v(get().classNeedsHistory) : v }),
    history: buildInitialHistory(),
    setHistory: (v) => set({ history: typeof v === 'function' ? v(get().history) : v }),

    // 汇总
    totalInfluence: 0,
    setTotalInfluence: (v) => set({ totalInfluence: typeof v === 'function' ? v(get().totalInfluence) : v }),
    totalWealth: 0,
    setTotalWealth: (v) => set({ totalWealth: typeof v === 'function' ? v(get().totalWealth) : v }),

    // Buff/Debuff
    activeBuffs: [],
    setActiveBuffs: (v) => set({ activeBuffs: typeof v === 'function' ? v(get().activeBuffs) : v }),
    activeDebuffs: [],
    setActiveDebuffs: (v) => set({ activeDebuffs: typeof v === 'function' ? v(get().activeDebuffs) : v }),

    // 稳定性
    stability: 50,
    setStability: (v) => set({ stability: typeof v === 'function' ? v(get().stability) : v }),

    // 生活水平
    classShortages: {},
    setClassShortages: (v) => set({ classShortages: typeof v === 'function' ? v(get().classShortages) : v }),
    classLivingStandard: {},
    setClassLivingStandard: (v) => set({ classLivingStandard: typeof v === 'function' ? v(get().classLivingStandard) : v }),
    livingStandardStreaks: buildInitialLivingStandardStreaks(),
    setLivingStandardStreaks: (v) => set({ livingStandardStreaks: typeof v === 'function' ? v(get().livingStandardStreaks) : v }),
    migrationCooldowns: {},
    setMigrationCooldowns: (v) => set({ migrationCooldowns: typeof v === 'function' ? v(get().migrationCooldowns) : v }),
    taxShock: {},
    setTaxShock: (v) => set({ taxShock: typeof v === 'function' ? v(get().taxShock) : v }),

    // 就业
    jobFill: {},
    setJobFill: (v) => set({ jobFill: typeof v === 'function' ? v(get().jobFill) : v }),
    jobsAvailable: {},
    setJobsAvailable: (v) => set({ jobsAvailable: typeof v === 'function' ? v(get().jobsAvailable) : v }),
    buildingJobsRequired: {},
    setBuildingJobsRequired: (v) => set({ buildingJobsRequired: typeof v === 'function' ? v(get().buildingJobsRequired) : v }),

    // Modifiers
    modifiers: {},
    setModifiers: (v) => set({ modifiers: typeof v === 'function' ? v(get().modifiers) : v }),

    // 静态构造器引用
    buildInitialWealth,
    buildInitialWealthHistory,
    buildInitialNeedsHistory,
    buildInitialHistory,
    buildInitialLivingStandardStreaks,

    // 批量重置
    resetPopulation: (overrides = {}) => set({
        population: 5,
        popStructure: {},
        maxPop: 10,
        maxPopBonus: 0,
        birthAccumulator: 0,
        classApproval: {},
        approvalBreakdown: {},
        classInfluence: {},
        classInfluenceShift: {},
        classWealth: buildInitialWealth(),
        classWealthDelta: {},
        classIncome: {},
        classExpense: {},
        classFinancialData: {},
        buildingFinancialData: {},
        classWealthHistory: buildInitialWealthHistory(),
        classNeedsHistory: buildInitialNeedsHistory(),
        history: buildInitialHistory(),
        totalInfluence: 0,
        totalWealth: 0,
        activeBuffs: [],
        activeDebuffs: [],
        stability: 50,
        classShortages: {},
        classLivingStandard: {},
        livingStandardStreaks: buildInitialLivingStandardStreaks(),
        migrationCooldowns: {},
        taxShock: {},
        jobFill: {},
        jobsAvailable: {},
        buildingJobsRequired: {},
        modifiers: {},
        ...overrides,
    }),
}));
