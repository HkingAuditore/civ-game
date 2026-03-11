// 事件 / 成就系统 Store
// 包含：currentEvent, eventHistory, achievements 等

import { create } from 'zustand';

const ACHIEVEMENT_STORAGE_KEY = 'civ_game_achievements_v1';
const ACHIEVEMENT_PROGRESS_KEY = 'civ_game_achievement_progress_v1';

const loadAchievementsFromStorage = () => {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(ACHIEVEMENT_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
};

const loadAchievementProgressFromStorage = () => {
    if (typeof window === 'undefined') return {};
    try {
        const raw = localStorage.getItem(ACHIEVEMENT_PROGRESS_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch { return {}; }
};

export const useEventStore = create((set, get) => ({
    // 事件
    currentEvent: null,
    setCurrentEvent: (v) => set({ currentEvent: typeof v === 'function' ? v(get().currentEvent) : v }),
    eventHistory: [],
    setEventHistory: (v) => set({ eventHistory: typeof v === 'function' ? v(get().eventHistory) : v }),

    // 成就
    unlockedAchievements: loadAchievementsFromStorage(),
    setUnlockedAchievements: (v) => set({ unlockedAchievements: typeof v === 'function' ? v(get().unlockedAchievements) : v }),
    achievementNotifications: [],
    setAchievementNotifications: (v) => set({ achievementNotifications: typeof v === 'function' ? v(get().achievementNotifications) : v }),
    achievementProgress: loadAchievementProgressFromStorage(),
    setAchievementProgress: (v) => set({ achievementProgress: typeof v === 'function' ? v(get().achievementProgress) : v }),

    // 解锁成就方法
    unlockAchievement: (achievementId) => {
        const state = get();
        if (state.unlockedAchievements.includes(achievementId)) return;
        const next = [...state.unlockedAchievements, achievementId];
        set({
            unlockedAchievements: next,
            achievementNotifications: [...state.achievementNotifications, { id: achievementId, timestamp: Date.now() }],
        });
        try {
            localStorage.setItem(ACHIEVEMENT_STORAGE_KEY, JSON.stringify(next));
        } catch { /* ignore */ }
    },

    dismissAchievementNotification: (notificationId) => {
        set({ achievementNotifications: get().achievementNotifications.filter(item => item.id !== notificationId) });
    },

    incrementAchievementProgress: (achievementId, amount = 1) => {
        const prev = get().achievementProgress;
        const current = prev[achievementId] || 0;
        const next = { ...prev, [achievementId]: current + amount };
        set({ achievementProgress: next });
        try {
            localStorage.setItem(ACHIEVEMENT_PROGRESS_KEY, JSON.stringify(next));
        } catch { /* ignore */ }
    },

    // 批量重置
    resetEvents: (overrides = {}) => set({
        currentEvent: null,
        eventHistory: [],
        ...overrides,
    }),
}));
