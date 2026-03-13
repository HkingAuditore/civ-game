// UI / 游戏控制 Store
// 包含：标签页、游戏速度、暂停、存档设置、难度、日志、点击等纯 UI 状态

import { create } from 'zustand';

export const useUIStore = create((set, get) => ({
    // 标签页
    activeTab: 'overview',
    setActiveTab: (v) => set({ activeTab: v }),

    // 游戏速度 & 暂停
    gameSpeed: 1,
    setGameSpeed: (v) => set({ gameSpeed: typeof v === 'function' ? v(get().gameSpeed) : v }),
    isPaused: false,
    setIsPaused: (v) => set({ isPaused: typeof v === 'function' ? v(get().isPaused) : v }),
    pausedBeforeEvent: false,
    setPausedBeforeEvent: (v) => set({ pausedBeforeEvent: typeof v === 'function' ? v(get().pausedBeforeEvent) : v }),

    // 存档设置
    autoSaveInterval: 60,
    setAutoSaveInterval: (v) => set({ autoSaveInterval: typeof v === 'function' ? v(get().autoSaveInterval) : v }),
    isAutoSaveEnabled: true,
    setIsAutoSaveEnabled: (v) => set({ isAutoSaveEnabled: typeof v === 'function' ? v(get().isAutoSaveEnabled) : v }),
    lastAutoSaveTime: Date.now(),
    setLastAutoSaveTime: (v) => set({ lastAutoSaveTime: typeof v === 'function' ? v(get().lastAutoSaveTime) : v }),
    isSaving: false,
    setIsSaving: (v) => set({ isSaving: typeof v === 'function' ? v(get().isSaving) : v }),

    // 难度 & 帝国名称
    difficulty: 'normal',
    setDifficulty: (v) => set({ difficulty: v }),
    empireName: '我的帝国',
    setEmpireName: (v) => set({ empireName: v }),

    // 事件确认开关
    eventConfirmationEnabled: false,
    setEventConfirmationEnabled: (v) => set({ eventConfirmationEnabled: typeof v === 'function' ? v(get().eventConfirmationEnabled) : v }),

    // 教程
    showTutorial: (() => {
        try {
            const completed = typeof window !== 'undefined' ? localStorage.getItem('tutorial_completed') : null;
            return !completed;
        } catch { return true; }
    })(),
    setShowTutorial: (v) => set({ showTutorial: typeof v === 'function' ? v(get().showTutorial) : v }),

    // 日志
    logs: ['欢迎来到第 1 天，您的文明刚刚起步！'],
    setLogs: (v) => set({ logs: typeof v === 'function' ? v(get().logs) : v }),

    // 浮动文字点击
    clicks: [],
    setClicks: (v) => set({ clicks: typeof v === 'function' ? v(get().clicks) : v }),

    // 详情视图开关
    stratumDetailView: null,
    setStratumDetailView: (v) => set({ stratumDetailView: typeof v === 'function' ? v(get().stratumDetailView) : v }),
    resourceDetailView: null,
    setResourceDetailView: (v) => set({ resourceDetailView: typeof v === 'function' ? v(get().resourceDetailView) : v }),
    populationDetailView: false,
    setPopulationDetailView: (v) => set({ populationDetailView: typeof v === 'function' ? v(get().populationDetailView) : v }),

    // 批量重置（用于 loadGame / resetGame）
    resetUI: (overrides = {}) => set({
        activeTab: 'overview',
        gameSpeed: 1,
        isPaused: false,
        pausedBeforeEvent: false,
        isSaving: false,
        logs: ['欢迎来到第 1 天，您的文明刚刚起步！'],
        clicks: [],
        stratumDetailView: null,
        resourceDetailView: null,
        populationDetailView: false,
        ...overrides,
    }),
}));
