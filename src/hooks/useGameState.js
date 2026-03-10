// 游戏状态管理钩�?
// 集中管理所有游戏状态，避免App.jsx中状态定义过�?

import { useEffect, useRef, useState } from 'react';
import { COUNTRIES, DEFAULT_VASSAL_STATUS, RESOURCES, STRATA } from '../config';
import { HISTORY_STORAGE_LIMIT, LOG_STORAGE_LIMIT } from '../config/gameConstants';
import { isOldUpgradeFormat, migrateUpgradesToNewFormat } from '../utils/buildingUpgradeUtils';
import { migrateAllOfficialsForInvestment } from '../logic/officials/migration';
import { ensureFrontDefaults, generateFront } from '../logic/diplomacy/frontSystem';
import { ensureBattleDefaults } from '../logic/diplomacy/battleSystem';
import { migrateNationEconomy } from '../logic/diplomacy/economy';
import { calculateAITreasuryTargetRatio } from '../logic/diplomacy/economyUtils';
import { ensureAIMilitaryState, syncAINationMilitary, evaluateAIFrontPlan } from '../logic/diplomacy/aiWar';
import { DEFAULT_DIFFICULTY, getDifficultyConfig, getStartingSilverMultiplier, getInitialBuildings } from '../config/difficulty';
import { getScenarioById } from '../config/scenarios';
import { Share } from '@capacitor/share';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

// 多存档槽位系�?
const SAVE_SLOT_COUNT = 10; // 手动存档槽位数量
const SAVE_SLOT_PREFIX = 'civ_game_save_slot_';
const AUTOSAVE_KEY = 'civ_game_autosave_v1';
const SAVE_FORMAT_VERSION = 1;
const SAVE_FILE_EXTENSION = 'cgsave';
const SAVE_OBFUSCATION_KEY = 'civ_game_simple_mask_v1';
// Lower soft limit to prefer IndexedDB earlier (localStorage quota issues)
const LOCAL_STORAGE_SOFT_LIMIT = 1 * 1024 * 1024;
const EXTERNAL_SAVE_FLAG = '__externalSave';
const EXTERNAL_SAVE_STORAGE = 'indexeddb';
const SAVE_IDB_NAME = 'civ_game_save_db_v1';
const SAVE_IDB_STORE = 'saves';

// 兼容旧存档的 key（用于迁移）
const LEGACY_SAVE_KEY = 'civ_game_save_data_v1';
const ACHIEVEMENT_STORAGE_KEY = 'civ_game_achievements_v1';
const ACHIEVEMENT_PROGRESS_KEY = 'civ_game_achievement_progress_v1';

const hasIndexedDb = () => typeof indexedDB !== 'undefined';

const openSaveDb = () => new Promise((resolve, reject) => {
    if (!hasIndexedDb()) {
        reject(new Error('IndexedDB not available'));
        return;
    }
    const request = indexedDB.open(SAVE_IDB_NAME, 1);
    request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(SAVE_IDB_STORE)) {
            db.createObjectStore(SAVE_IDB_STORE);
        }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
});

const readSaveFromIndexedDb = async (key) => {
    const db = await openSaveDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(SAVE_IDB_STORE, 'readonly');
        const store = tx.objectStore(SAVE_IDB_STORE);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error || new Error('Failed to read save'));
    });
};

const writeSaveToIndexedDb = async (key, value) => {
    const db = await openSaveDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(SAVE_IDB_STORE, 'readwrite');
        const store = tx.objectStore(SAVE_IDB_STORE);
        const request = store.put(value, key);
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error || new Error('Failed to write save'));
    });
};

const removeSaveFromIndexedDb = async (key) => {
    const db = await openSaveDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(SAVE_IDB_STORE, 'readwrite');
        const store = tx.objectStore(SAVE_IDB_STORE);
        const request = store.delete(key);
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error || new Error('Failed to delete save'));
    });
};

const buildExternalSaveStub = (payload, { storage = EXTERNAL_SAVE_STORAGE, sizeBytes = 0 } = {}) => ({
    [EXTERNAL_SAVE_FLAG]: true,
    storage,
    sizeBytes,
    updatedAt: payload.updatedAt,
    saveSource: payload.saveSource,
    difficulty: payload.difficulty,
    empireName: payload.empireName,
    daysElapsed: payload.daysElapsed,
    epoch: payload.epoch,
    population: payload.population,
});

const isExternalSaveStub = (data) => !!(data && data[EXTERNAL_SAVE_FLAG]);

// Helper function to calculate save size
const calculateSaveSize = (data) => {
    try {
        const jsonString = JSON.stringify(data);
        const sizeInBytes = new Blob([jsonString]).size;
        const sizeInKB = (sizeInBytes / 1024).toFixed(1);
        const sizeInMB = (sizeInBytes / (1024 * 1024)).toFixed(2);
        return {
            bytes: sizeInBytes,
            kb: sizeInKB,
            mb: sizeInMB,
            display: sizeInBytes > 1024 * 1024 ? `${sizeInMB}MB` : `${sizeInKB}KB`
        };
    } catch (e) {
        return { bytes: 0, kb: '0', mb: '0', display: '0KB' };
    }
};

const getLoadedCorpsTotalUnits = (corps) => Object.values(corps?.units || {}).reduce((sum, count) => sum + Number(count || 0), 0);

const loadAchievementsFromStorage = () => {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(ACHIEVEMENT_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn('Failed to load achievements:', error);
        return [];
    }
};

const loadAchievementProgressFromStorage = () => {
    if (typeof window === 'undefined') return {};
    try {
        const raw = localStorage.getItem(ACHIEVEMENT_PROGRESS_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
        console.warn('Failed to load achievement progress:', error);
        return {};
    }
};

/**
 * 获取所有存档槽位信�?
 * @returns {Array} 存档槽位信息数组
 */
export const getAllSaveSlots = () => {
    if (typeof window === 'undefined') return [];

    const slots = [];

    // 获取手动存档槽位
    for (let i = 0; i < SAVE_SLOT_COUNT; i++) {
        const key = `${SAVE_SLOT_PREFIX}${i}`;
        const raw = localStorage.getItem(key);
        if (raw) {
            try {
                const data = JSON.parse(raw);
                const diffConfig = getDifficultyConfig(data.difficulty);
                slots.push({
                    slotIndex: i,
                    isEmpty: false,
                    name: `存档 ${i + 1}`,
                    empireName: data.empireName || null,
                    updatedAt: data.updatedAt,
                    daysElapsed: data.daysElapsed || 0,
                    epoch: data.epoch || 0,
                    population: data.population || 0,
                    difficulty: data.difficulty || DEFAULT_DIFFICULTY,
                    difficultyName: diffConfig?.name || '??',
                    difficultyIcon: diffConfig?.icon || '??',
                });
            } catch (e) {
                slots.push({ slotIndex: i, isEmpty: true, name: `存档 ${i + 1}` });
            }
        } else {
            slots.push({ slotIndex: i, isEmpty: true, name: `存档 ${i + 1}` });
        }
    }

    // 获取自动存档
    const autoRaw = localStorage.getItem(AUTOSAVE_KEY);
    if (autoRaw) {
        try {
            const data = JSON.parse(autoRaw);
            const diffConfig = getDifficultyConfig(data.difficulty);
            slots.push({
                slotIndex: -1,
                isAutoSave: true,
                isEmpty: false,
                name: '自动存档',
                empireName: data.empireName || null,
                updatedAt: data.updatedAt,
                daysElapsed: data.daysElapsed || 0,
                epoch: data.epoch || 0,
                population: data.population || 0,
                difficulty: data.difficulty || DEFAULT_DIFFICULTY,
                    difficultyName: diffConfig?.name || '??',
                    difficultyIcon: diffConfig?.icon || '??',
            });
        } catch (e) {
            // 自动存档损坏，忽�?
        }
    }

    return slots;
};

/**
 * 删除指定的存档槽位（独立函数，可在组件外调用�?
 * @param {number} slotIndex - 存档槽位索引�?-2为手动存档，-1为自动存档）
 * @returns {boolean} 是否删除成功
 */
export const deleteSaveSlot = (slotIndex) => {
    if (typeof window === 'undefined') return false;

    try {
        let targetKey;

        if (slotIndex === -1) {
            // 删除自动存档
            targetKey = AUTOSAVE_KEY;
        } else {
            // 删除手动存档槽位
            const safeIndex = Math.max(0, Math.min(SAVE_SLOT_COUNT - 1, slotIndex));
            targetKey = `${SAVE_SLOT_PREFIX}${safeIndex}`;
        }

        const rawData = localStorage.getItem(targetKey);
        if (!rawData) {
            return false;
        }

        try {
            const parsed = JSON.parse(rawData);
            if (isExternalSaveStub(parsed)) {
                void removeSaveFromIndexedDb(targetKey);
            }
        } catch (parseError) {
            // Ignore malformed save metadata
        }

        localStorage.removeItem(targetKey);
        return true;
    } catch (error) {
        console.error('Delete save slot failed:', error);
        return false;
    }
};

const textEncoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
const textDecoder = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null;

const toBase64 = (arrayBuffer) => {
    if (typeof window === 'undefined') {
        if (typeof Buffer !== 'undefined') {
            return Buffer.from(arrayBuffer).toString('base64');
        }
        throw new Error('Base64 编码不可�');
    }
    let binary = '';
    const bytes = new Uint8Array(arrayBuffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i += 1) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
};

const fromBase64 = (base64) => {
    if (typeof window === 'undefined') {
        if (typeof Buffer !== 'undefined') {
            return Uint8Array.from(Buffer.from(base64, 'base64'));
        }
        throw new Error('Base64 解码不可�');
    }
    const binary = window.atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
};

const canObfuscate = !!textEncoder && !!textDecoder;

const encodeSavePayload = (payload) => {
    if (!canObfuscate) throw new Error('当前环境不支持写入混淆存�');
    const jsonBytes = textEncoder.encode(JSON.stringify(payload));
    const keyBytes = textEncoder.encode(SAVE_OBFUSCATION_KEY);
    const masked = new Uint8Array(jsonBytes.length);
    for (let i = 0; i < jsonBytes.length; i += 1) {
        masked[i] = jsonBytes[i] ^ keyBytes[i % keyBytes.length];
    }
    return toBase64(masked.buffer);
};

const decodeSavePayload = (encoded) => {
    if (!canObfuscate) throw new Error('当前环境不支持读取混淆存�');
    const maskedBytes = fromBase64(encoded);
    const keyBytes = textEncoder.encode(SAVE_OBFUSCATION_KEY);
    const restored = new Uint8Array(maskedBytes.length);
    for (let i = 0; i < maskedBytes.length; i += 1) {
        restored[i] = maskedBytes[i] ^ keyBytes[i % keyBytes.length];
    }
    return JSON.parse(textDecoder.decode(restored));
};

const INITIAL_RESOURCES = {
    food: 200,
    wood: 200,
    stone: 200,
    cloth: 80,
    plank: 0,
    brick: 0,
    iron: 0,
    tools: 0,
    copper: 0,
    papyrus: 0,
    spice: 0,
    coffee: 0,
    coal: 0,
    steel: 0,
    silver: 400,
    science: 0,
    culture: 300
};

const buildInitialWealth = () => {
    const wealth = {};
    Object.keys(STRATA).forEach(key => {
        wealth[key] = STRATA[key].startingWealth || 0;
    });
    return wealth;
};

const sanitizeExpansionSettings = (settings = {}) => {
    if (!settings || typeof settings !== 'object') return {};
    const cleaned = {};
    Object.entries(settings).forEach(([buildingId, config]) => {
        if (!config || typeof config !== 'object') return;
        const { maxCount, ...rest } = config;
        cleaned[buildingId] = { ...rest };
    });
    return cleaned;
};

const buildInitialWealthHistory = () => {
    const history = {};
    Object.keys(STRATA).forEach(key => {
        history[key] = [];
    });
    return history;
};

const buildInitialNeedsHistory = () => {
    const history = {};
    Object.keys(STRATA).forEach(key => {
        history[key] = [];
    });
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
    return {
        treasury: [],
        tax: [],
        population: [],
        class: classHistory,
        // 经济指标历史
        gdp: [],
        cpi: [],
        ppi: [],
    };
};

const buildInitialMerchantState = () => ({
    pendingTrades: [],
    lastTradeTime: 0,
    lockedCapital: 0,

    // Trade 2.0: player-assigned merchants by nation id
    // Example: { 'rome': 10, 'egypt': 5 }
    merchantAssignments: {},

    // Trade 2.0: per-resource preference multipliers (1 = neutral)
    // Shape: { import: { food: 1.2 }, export: { iron: 1.5 } }
    merchantTradePreferences: { import: {}, export: {} },
});

// Use constants from gameConstants.js for consistent limits
const AUTO_SAVE_LIMITS = {
    history: HISTORY_STORAGE_LIMIT,
    classHistory: HISTORY_STORAGE_LIMIT,
    eventHistory: HISTORY_STORAGE_LIMIT,
    classSeries: HISTORY_STORAGE_LIMIT,
    marketHistory: HISTORY_STORAGE_LIMIT,
    logs: LOG_STORAGE_LIMIT,
};

// Aggressive limits are half of normal limits, minimum 5
const AUTO_SAVE_AGGRESSIVE_LIMITS = {
    history: Math.max(5, Math.floor(HISTORY_STORAGE_LIMIT / 3)),
    classHistory: Math.max(5, Math.floor(HISTORY_STORAGE_LIMIT / 3)),
    eventHistory: Math.max(5, Math.floor(HISTORY_STORAGE_LIMIT / 3)),
    classSeries: Math.max(5, Math.floor(HISTORY_STORAGE_LIMIT / 3)),
    marketHistory: Math.max(5, Math.floor(HISTORY_STORAGE_LIMIT / 3)),
    logs: Math.max(10, Math.floor(LOG_STORAGE_LIMIT / 2)),
};

const trimArray = (value, limit) => (Array.isArray(value) ? value.slice(-limit) : value);
const trimRecentLogs = (logs, limit) => (Array.isArray(logs) ? logs.slice(0, limit) : logs);

const trimClassSeriesMap = (seriesMap, limit) => {
    if (!seriesMap || typeof seriesMap !== 'object') {
        return seriesMap;
    }
    const trimmed = {};
    Object.keys(seriesMap).forEach((key) => {
        trimmed[key] = trimArray(seriesMap[key], limit);
    });
    return trimmed;
};

const trimHistorySnapshot = (history, limit) => {
    if (!history || typeof history !== 'object') {
        return history;
    }
    const next = {
        ...history,
        treasury: trimArray(history.treasury, limit),
        tax: trimArray(history.tax, limit),
        population: trimArray(history.population, limit),
    };
    if (history.class && typeof history.class === 'object') {
        const classHistory = {};
        Object.keys(history.class).forEach((key) => {
            const entry = history.class[key] || {};
            classHistory[key] = {
                ...entry,
                pop: trimArray(entry.pop, limit),
                income: trimArray(entry.income, limit),
                expense: trimArray(entry.expense, limit),
            };
        });
        next.class = classHistory;
    }
    return next;
};

// [NEW] 迁移旧版海外投资数据（从 input/output �?strategy�?
const migrateOverseasInvestments = (investments) => {
    if (!Array.isArray(investments)) return [];

    const normalize = (inv) => {
        const baseInv = inv.strategy ? { ...inv } : { ...inv };
        if (!baseInv.strategy) {
            if (inv.outputDest === 'home') {
                baseInv.strategy = 'RESOURCE_EXTRACTION';
            } else if (inv.inputSource === 'home') {
                baseInv.strategy = 'MARKET_DUMPING';
            } else {
                baseInv.strategy = 'PROFIT_MAX';
            }
        }
        if (!Number.isFinite(baseInv.count)) {
            baseInv.count = 1;
        }
        return baseInv;
    };

    const getGroupKey = (inv) => {
        const strategy = inv.strategy || 'PROFIT_MAX';
        return `${inv.targetNationId}::${inv.buildingId}::${inv.ownerStratum || 'capitalist'}::${strategy}`;
    };

    const merged = new Map();
    investments.forEach((raw) => {
        const inv = normalize(raw);
        const key = getGroupKey(inv);
        if (!merged.has(key)) {
            merged.set(key, inv);
            return;
        }
        const existing = merged.get(key);
        merged.set(key, {
            ...existing,
            count: (existing.count || 1) + (inv.count || 1),
            investmentAmount: (existing.investmentAmount || 0) + (inv.investmentAmount || 0),
            createdDay: Math.min(existing.createdDay || inv.createdDay || 0, inv.createdDay || 0),
        });
    });

    return Array.from(merged.values());
};

const migrateForeignInvestments = (investments) => {
    if (!Array.isArray(investments)) return [];

    const normalize = (inv) => {
        const baseInv = { ...inv };
        if (!baseInv.strategy) {
            baseInv.strategy = 'PROFIT_MAX';
        }
        if (!Number.isFinite(baseInv.count)) {
            baseInv.count = 1;
        }
        return baseInv;
    };

    const getGroupKey = (inv) => {
        const strategy = inv.strategy || 'PROFIT_MAX';
        return `${inv.ownerNationId}::${inv.buildingId}::${inv.investorStratum || 'capitalist'}::${strategy}`;
    };

    const merged = new Map();
    investments.forEach((raw) => {
        const inv = normalize(raw);
        const key = getGroupKey(inv);
        if (!merged.has(key)) {
            merged.set(key, inv);
            return;
        }
        const existing = merged.get(key);
        merged.set(key, {
            ...existing,
            count: (existing.count || 1) + (inv.count || 1),
            investmentAmount: (existing.investmentAmount || 0) + (inv.investmentAmount || 0),
            createdDay: Math.min(existing.createdDay || inv.createdDay || 0, inv.createdDay || 0),
        });
    });

    return Array.from(merged.values());
};

const trimMarketSnapshot = (market, limit) => {
    if (!market || typeof market !== 'object') {
        return market;
    }
    const trimSeriesMap = (seriesMap) => {
        if (!seriesMap || typeof seriesMap !== 'object') {
            return seriesMap;
        }
        const trimmed = {};
        Object.keys(seriesMap).forEach((key) => {
            trimmed[key] = trimArray(seriesMap[key], limit);
        });
        return trimmed;
    };
    return {
        ...market,
        priceHistory: trimSeriesMap(market.priceHistory),
        supplyHistory: trimSeriesMap(market.supplyHistory),
        demandHistory: trimSeriesMap(market.demandHistory),
    };
};

const compactSavePayload = (payload, { aggressive = false } = {}) => {
    const limits = aggressive ? AUTO_SAVE_AGGRESSIVE_LIMITS : AUTO_SAVE_LIMITS;

    // Compact nations array (remove history and unnecessary data from vassals)
    const compactNations = (nations) => {
        if (!Array.isArray(nations)) return nations;
        return nations.map(nation => {
            const compacted = { ...nation };
            const historyLimit = nation.isPlayer ? limits.history : Math.floor(limits.history / 2);
            const classSeriesLimit = nation.isPlayer ? limits.classSeries : Math.floor(limits.classSeries / 2);
            const eventLimit = nation.isPlayer ? limits.eventHistory : Math.floor(limits.eventHistory / 2);
            const logLimit = nation.isPlayer ? Math.min(limits.logs, 20) : Math.min(limits.logs, 10);

            if (aggressive) {
                delete compacted.history;
                delete compacted.classWealthHistory;
                delete compacted.classNeedsHistory;
                compacted.eventHistory = [];
                compacted.logs = [];
            } else {
                if (compacted.history) {
                    compacted.history = trimHistorySnapshot(compacted.history, historyLimit);
                }
                if (compacted.classWealthHistory) {
                    compacted.classWealthHistory = trimClassSeriesMap(compacted.classWealthHistory, classSeriesLimit);
                }
                if (compacted.classNeedsHistory) {
                    compacted.classNeedsHistory = trimClassSeriesMap(compacted.classNeedsHistory, classSeriesLimit);
                }
                if (compacted.eventHistory) {
                    compacted.eventHistory = trimArray(compacted.eventHistory, eventLimit);
                }
                if (compacted.logs) {
                    compacted.logs = trimRecentLogs(compacted.logs, logLimit);
                }
            }

            if (compacted.market) {
                if (aggressive || !nation.isPlayer) {
                    compacted.market = {
                        ...compacted.market,
                        priceHistory: {},
                        supplyHistory: {},
                        demandHistory: {},
                    };
                } else {
                    compacted.market = trimMarketSnapshot(compacted.market, Math.floor(limits.marketHistory / 2));
                }
            }

            return compacted;
        });
    };

    const compacted = {
        ...payload,
        history: trimHistorySnapshot(payload.history, limits.history),
        classWealthHistory: trimClassSeriesMap(payload.classWealthHistory, limits.classSeries),
        classNeedsHistory: trimClassSeriesMap(payload.classNeedsHistory, limits.classSeries),
        market: trimMarketSnapshot(payload.market, limits.marketHistory),
        eventHistory: trimArray(payload.eventHistory, limits.eventHistory),
        logs: trimRecentLogs(payload.logs, limits.logs),
        vassalDiplomacyHistory: trimArray(payload.vassalDiplomacyHistory, limits.eventHistory),
        nations: compactNations(payload.nations),
        clicks: [],
    };
    if (aggressive) {
        compacted.history = buildInitialHistory();
        compacted.classWealthHistory = buildInitialWealthHistory();
        compacted.classNeedsHistory = buildInitialNeedsHistory();
        compacted.eventHistory = trimArray(payload.eventHistory, Math.min(5, limits.eventHistory));
        compacted.logs = trimRecentLogs(payload.logs, Math.min(5, limits.logs));
    }
    return compacted;
};

const buildMinimalAutoSavePayload = (payload) => {
    // Ultra-minimal nations (only essential data)
    const minimalNations = Array.isArray(payload.nations) ? payload.nations.map(nation => {
        if (nation.isPlayer) {
            // Keep player nation but remove history
            return {
                ...nation,
                history: undefined,
                classWealthHistory: undefined,
                classNeedsHistory: undefined,
                eventHistory: [],
                logs: [],
                market: nation.market ? {
                    prices: nation.market.prices,
                    priceHistory: {},
                    supplyHistory: {},
                    demandHistory: {},
                } : undefined,
            };
        }
        // For vassals, keep only critical data
        return {
            id: nation.id,
            name: nation.name,
            isPlayer: nation.isPlayer,
            resources: nation.resources,
            population: nation.population,
            wealth: nation.wealth,
            budget: nation.budget,
            economyTraits: nation.economyTraits,
            lastGiftToPlayerDay: nation.lastGiftToPlayerDay,
            buildings: nation.buildings,
            vassalType: nation.vassalType,
            overlordId: nation.overlordId,
            vassalPolicy: nation.vassalPolicy,
            independenceTendency: nation.independenceTendency,
            socialStructure: nation.socialStructure,
        };
    }) : [];

    return {
        saveFormatVersion: payload.saveFormatVersion,
        resources: payload.resources,
        population: payload.population,
        popStructure: payload.popStructure,
        maxPop: payload.maxPop,
        buildings: payload.buildings,
        buildingUpgrades: payload.buildingUpgrades,
        techsUnlocked: payload.techsUnlocked,
        epoch: payload.epoch,
        gameSpeed: payload.gameSpeed,
        isPaused: payload.isPaused,
        nations: minimalNations,
        classApproval: payload.classApproval,
        classInfluence: payload.classInfluence,
        classWealth: payload.classWealth,
        stability: payload.stability,
        daysElapsed: payload.daysElapsed,
        army: payload.army,
        militaryCorps: payload.militaryCorps,
        generals: payload.generals,
        activeFronts: payload.activeFronts,
        activeBattles: payload.activeBattles,
        taxes: payload.taxes,
        taxPolicies: payload.taxPolicies,
        jobFill: payload.jobFill,
        market: payload.market ? {
            prices: payload.market.prices,
            priceHistory: {},
            supplyHistory: {},
            demandHistory: {},
        } : undefined,
        tradeRoutes: payload.tradeRoutes,
        overseasBuildings: payload.overseasBuildings || [],
        rebellionStates: payload.rebellionStates,
        rulingCoalition: payload.rulingCoalition,
        legitimacy: payload.legitimacy,
        officials: payload.officials,
        ministerAssignments: payload.ministerAssignments,
        activeDecrees: payload.activeDecrees || [],
        autoSaveInterval: payload.autoSaveInterval,
        isAutoSaveEnabled: payload.isAutoSaveEnabled,
        difficulty: payload.difficulty,
        empireName: payload.empireName,
        updatedAt: payload.updatedAt,
        saveSource: 'auto-minimal',
        // Remove ALL heavy data
        history: undefined,
        classWealthHistory: undefined,
        classNeedsHistory: undefined,
        eventHistory: [],
        logs: [],
        clicks: [],
        // Remove non-essential fields
        maxPopBonus: undefined,
        birthAccumulator: undefined,
        activeTab: undefined,
        classWealthDelta: undefined,
        classIncome: undefined,
        classExpense: undefined,
        classFinancialData: undefined,
        totalInfluence: undefined,
        totalWealth: undefined,
        activeBuffs: undefined,
        activeDebuffs: undefined,
        classInfluenceShift: undefined,
        classShortages: undefined,
        classLivingStandard: undefined,
        livingStandardStreaks: undefined,
        migrationCooldowns: undefined,
        militaryQueue: undefined,
        selectedTarget: undefined,
        battleResult: undefined,
        playerInstallmentPayment: undefined,
        autoRecruitEnabled: undefined,
        targetArmyComposition: undefined,
        militaryWageRatio: undefined,
        lastBattleTargetId: undefined,
        lastBattleDay: undefined,
        activeFestivalEffects: undefined,
        lastFestivalYear: undefined,
        showTutorial: undefined,
        currentEvent: undefined,
        merchantState: undefined,
        tradeStats: undefined,
        diplomacyOrganizations: undefined,
        vassalDiplomacyQueue: undefined,
        vassalDiplomacyHistory: [],
        foreignInvestmentPolicy: undefined,
        eventEffectSettings: undefined,
        activeEventEffects: undefined,
        actionCooldowns: undefined,
        actionUsage: undefined,
        promiseTasks: undefined,
        lastAutoSaveTime: undefined,
        officialCandidates: undefined,
        lastSelectionDay: undefined,
        officialCapacity: undefined,
        lastMinisterExpansionDay: undefined,
        decreeCooldowns: undefined,
        quotaTargets: undefined,
    };
};

const DEFAULT_EVENT_EFFECT_SETTINGS = {
    approval: { duration: 30, decayRate: 0.04 },
    stability: { duration: 30, decayRate: 0.04 },
    // Economic effect settings - longer duration, slower decay
    resourceDemand: { duration: 60, decayRate: 0.02 },      // Resource demand modifier
    stratumDemand: { duration: 60, decayRate: 0.02 },       // Stratum consumption modifier
    buildingProduction: { duration: 45, decayRate: 0.025 }, // Building production modifier

    // UI / Log visibility settings
    logVisibility: {
        showMerchantTradeLogs: true,
        showTradeRouteLogs: true,
    },
};

const buildInitialEventEffects = () => ({
    approval: [],
    stability: [],
    // Economic effects: array of { target, currentValue, remainingDays, decayRate, source }
    resourceDemand: [],      // target: resource key, currentValue: percentage modifier (e.g., 0.2 = +20%)
    stratumDemand: [],       // target: stratum key, currentValue: percentage modifier
    buildingProduction: [],  // target: building category or id, currentValue: percentage modifier
    // Forced subsidies from rebel ultimatums
    forcedSubsidy: [],       // { id, name, stratumKey, dailyAmount, remainingDays, createdAt }
});

// 初始化贸易路线状�?
const buildInitialTradeRoutes = () => ({
    // 贸易路线数组，每个路线包含：
    // { nationId, resource, type: 'import'|'export', createdAt }
    routes: [],
});

const buildInitialDiplomacyOrganizations = () => ({
    organizations: [],
    lastGlobalGiftToPlayerDay: 0,
});

/**
 * 迁移旧存档中的组织数据，确保每个组织都有 founderId
 * @param {Object} diplomacyOrganizations - 外交组织数据
 * @returns {Object} 迁移后的组织数据
 */
const migrateDiplomacyOrganizations = (diplomacyOrganizations) => {
    if (!diplomacyOrganizations || typeof diplomacyOrganizations !== 'object') {
        return buildInitialDiplomacyOrganizations();
    }

    const organizations = Array.isArray(diplomacyOrganizations.organizations)
        ? diplomacyOrganizations.organizations
        : [];

    const migratedOrganizations = organizations
        .map(org => {
            // 如果组织已经�?founderId，直接返�?
            if (org.founderId) {
                return org;
            }

            // 旧存档兼容：使用第一个成员作为创始人
            const firstMember = org.members?.[0];
            if (!firstMember) {
                // 没有成员的组织应该被移除
                console.log(`[Save Migration] Removing organization "${org.name}" with no members.`);
                return null;
            }

            console.log(`[Save Migration] Organization "${org.name}" missing founderId, using first member: ${firstMember}`);
            return {
                ...org,
                founderId: firstMember,
            };
        })
        .filter(org => org !== null); // 移除无效组织

    const lastGlobalGiftToPlayerDay = Number.isFinite(diplomacyOrganizations.lastGlobalGiftToPlayerDay)
        ? diplomacyOrganizations.lastGlobalGiftToPlayerDay
        : 0;

    return {
        ...diplomacyOrganizations,
        organizations: migratedOrganizations,
        lastGlobalGiftToPlayerDay,
    };
};

const buildInitialOverseasBuildings = () => ([]);

const buildInitialMinisterAssignments = () => ({
    agriculture: null,
    industry: null,
    commerce: null,
    civic: null,
    military: null,
    diplomacy: null,
});

const buildInitialMinisterAutoExpansion = () => ({
    agriculture: true,
    industry: true,
    commerce: true,
    civic: true,
});

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

const buildDefaultHeadTaxRates = () => {
    const rates = {};
    Object.keys(STRATA).forEach(key => {
        rates[key] = 1;
    });
    return rates;
};

const buildDefaultResourceTaxRates = () => {
    const rates = {};
    Object.keys(RESOURCES).forEach(key => {
        if (!isTradable(key)) return;
        rates[key] = 0.05;
    });
    return rates;
};

const buildDefaultBusinessTaxRates = () => {
    const rates = {};
    // 默认所有建筑营业税�?（不收税也不补贴�?
    return rates;
};

const buildInitialNations = (playerState = null) => {
    // 如果提供了玩家状态，用于缩放新国家的初始�?
    const playerPopulation = playerState?.population || 0;
    const playerCivilianWealth = Object.values(playerState?.classWealth || {}).reduce((sum, value) => {
        return sum + Math.max(0, Number(value) || 0);
    }, 0);
    const playerWealth = (playerState?.resources?.silver || 0) + playerCivilianWealth * 0.35;
    const currentEpoch = playerState?.epoch || 0;

    return COUNTRIES.map(nation => {
        const appearEpoch = nation.appearEpoch ?? 0;
        
        // 计算缩放因子：基于玩家当前发展水平和国家出现时代
        let populationScale = 1.0;
        let wealthScale = 1.0;
        
        if (playerState && appearEpoch > 0) {
            // 如果国家出现时代晚于当前时代，说明是后期解锁的国�?
            // 需要根据玩家当前实力进行缩�?
            if (appearEpoch <= currentEpoch) {
                // 人口缩放：基于玩家当前人口，但有上下�?
                // 新国家人口应该是玩家�?0%-80%之间
                populationScale = Math.max(0.3, Math.min(0.8, playerPopulation / 5000));
                
                // 财富缩放：基于玩家当前财富，但有上下�?
                // 新国家财富应该是玩家�?0%-60%之间
                wealthScale = Math.max(0.2, Math.min(0.6, playerWealth / 50000));
                
                // 时代加成：每个时代额外增�?0%
                const epochBonus = 1 + (appearEpoch * 0.2);
                populationScale *= epochBonus;
                wealthScale *= epochBonus;
            }
        }
        
        // 初始化库存：基于资源偏差，围绕目标库�?00波动
        const inventory = {};
        const targetInventory = 500;
        if (nation.economyTraits?.resourceBias) {
            Object.entries(nation.economyTraits.resourceBias).forEach(([resourceKey, bias]) => {
                // 使用�?aiEconomy.js 一致的目标库存公式
                const dynamicTarget = Math.round(500 * Math.pow(bias, 1.2));
                if (bias > 1) {
                    // 特产资源：高库存，在目标值的1.0-1.5倍之间（已经很高了）
                    inventory[resourceKey] = Math.floor(dynamicTarget * (1.0 + Math.random() * 0.5));
                } else if (bias < 1) {
                    // 稀缺资源：低库存，在目标值的0.3-0.6倍之�?
                    inventory[resourceKey] = Math.floor(dynamicTarget * (0.3 + Math.random() * 0.3));
                } else {
                    // 中性资源：中等库存，在目标值的0.8-1.2倍之�?
                    inventory[resourceKey] = Math.floor(dynamicTarget * (0.8 + Math.random() * 0.4));
                }
            });
        }

        // 初始化财富：应用缩放因子
        const baseWealth = nation.wealth ?? 800;
        const wealth = Math.floor(baseWealth * wealthScale);
        const budget = Math.floor(wealth * calculateAITreasuryTargetRatio({
            wealth,
            population: nation.population || 100,
            epoch: appearEpoch,
            isAtWar: false,
            aggression: nation.aggression || 0.3,
            capacityUsage: 0.55,
            developmentRate: nation.economyTraits?.developmentRate || 1.0,
        }));
        
        const wealthRating = Math.max(0.4, wealth / 800);
        const baseVolatility = typeof nation.marketVolatility === 'number'
            ? Math.min(0.9, Math.max(0.1, nation.marketVolatility))
            : 0.3;
        const populationLean = nation.culturalTraits?.agriculturalFocus ? 1.15 : 1;
        const populationFactor = Math.min(2.5, Math.max(0.6, wealthRating * populationLean));
        const wealthFactor = Math.min(
            3.5,
            Math.max(
                0.5,
                wealthRating * (1 + Math.max(0, appearEpoch) * 0.05)
            )
        );

        // 初始化基础人口：应用缩放因�?
        const basePopulation = Math.floor((1000 + Math.floor(Math.random() * 500)) * populationScale); // 应用缩放
        const vassalStatus = {
            vassalOf: Object.prototype.hasOwnProperty.call(nation, 'vassalOf')
                ? nation.vassalOf
                : DEFAULT_VASSAL_STATUS.vassalOf,
            vassalType: Object.prototype.hasOwnProperty.call(nation, 'vassalType')
                ? nation.vassalType
                : DEFAULT_VASSAL_STATUS.vassalType,
            tributeRate: Number.isFinite(nation.tributeRate)
                ? nation.tributeRate
                : DEFAULT_VASSAL_STATUS.tributeRate,
            independencePressure: Number.isFinite(nation.independencePressure)
                ? nation.independencePressure
                : DEFAULT_VASSAL_STATUS.independencePressure,
        };

        return {
            ...nation,
            relation: 50,
            treaties: Array.isArray(nation.treaties) ? nation.treaties : [],
            openMarketUntil: nation.openMarketUntil ?? null,
            peaceTreatyUntil: nation.peaceTreatyUntil ?? null,
            ...vassalStatus,
            organizationMemberships: Array.isArray(nation.organizationMemberships)
                ? nation.organizationMemberships
                : [],
            overseasAssets: Array.isArray(nation.overseasAssets) ? nation.overseasAssets : [],
            warScore: nation.warScore ?? 0,
            isAtWar: nation.isAtWar ?? false,
            wealth,
            budget,
            inventory,
            enemyLosses: 0,
            warDuration: 0,
            warStartDay: null,
            lastLootDay: null,
            militaryStrength: 1.0, // 初始军事实力为满�?
            population: basePopulation, // 初始人口
            wealthTemplate: wealth,
            foreignPower: {
                baseRating: wealthRating,
                volatility: baseVolatility,
                appearEpoch,
                populationFactor,
                wealthFactor,
            },
            economyTraits: {
                ...nation.economyTraits,
                baseWealth: wealth, // 保存基础财富用于恢复
                basePopulation, // 保存基础人口用于恢复
            },
        };
    });
};

const buildScenarioPopulation = (scenarioOverrides) => {
    if (!scenarioOverrides?.popStructure) return null;
    const total = Object.values(scenarioOverrides.popStructure)
        .reduce((sum, value) => sum + (Number(value) || 0), 0);
    return total || null;
};

/**
 * 游戏状态管理钩�?
 * 集中管理所有游戏状�?
 * @returns {Object} 包含所有状态和状态更新函数的对象
 */
export const useGameState = () => {
    // ========== 基础资源状�?==========
    const [resources, setResourcesState] = useState(INITIAL_RESOURCES);

    // ========== 人口与社会状�?==========
    const [population, setPopulation] = useState(5);
    const [popStructure, setPopStructure] = useState({});
    const [maxPop, setMaxPop] = useState(10);
    const [birthAccumulator, setBirthAccumulator] = useState(0);
    // 额外人口上限加成（如通过割地获得），不会被每日模拟覆�?
    const [maxPopBonus, setMaxPopBonus] = useState(0);

    // ========== 建筑与科技状�?==========
    const [buildings, setBuildings] = useState({});
    const [buildingUpgrades, setBuildingUpgrades] = useState({}); // 建筑升级等级 { buildingId: { level: count } } - 每个等级的建筑数�?
    const [techsUnlocked, setTechsUnlocked] = useState([]);
    const [epoch, setEpoch] = useState(0);

    // ========== 游戏控制状�?==========
    const [activeTab, setActiveTab] = useState('overview');
    const [gameSpeed, setGameSpeed] = useState(1);
    const [isPaused, setIsPaused] = useState(false);
    const [pausedBeforeEvent, setPausedBeforeEvent] = useState(false); // 事件触发前的暂停状�?
    const [autoSaveInterval, setAutoSaveInterval] = useState(60); // 自动存档间隔（秒�?
    const [isAutoSaveEnabled, setIsAutoSaveEnabled] = useState(true); // 自动存档开�?
    const [lastAutoSaveTime, setLastAutoSaveTime] = useState(() => Date.now()); // 上次自动存档时间
    const [autoSaveBlocked, setAutoSaveBlocked] = useState(false); // 自动存档因配额被禁用
    const [isSaving, setIsSaving] = useState(false); // UI保存状态指�?
    const [difficulty, setDifficulty] = useState(DEFAULT_DIFFICULTY); // 游戏难度
    const [empireName, setEmpireName] = useState('我的帝国'); // 国家/帝国名称
    const [eventConfirmationEnabled, setEventConfirmationEnabled] = useState(false); // 事件二次确认开�?
    const savingIndicatorTimer = useRef(null);
    const autoSaveQuotaNotifiedRef = useRef(false);

    // ========== 政令与外交状�?==========
    const [nations, setNations] = useState(buildInitialNations());
    const [diplomaticReputation, setDiplomaticReputation] = useState(50); // 国际声誉 (0-100)

    // ========== 海外投资系统状�?==========
    const [overseasInvestments, setOverseasInvestments] = useState([]);    // 玩家在附庸国的投�?
    const [foreignInvestments, setForeignInvestments] = useState([]);
    const [foreignInvestmentPolicy, setForeignInvestmentPolicy] = useState('normal');      // 外国在玩家国的投�?

    // ========== 官员系统状�?==========
    const [officials, setOfficials] = useState([]);           // 当前雇佣的官�?
    const [officialsSimCursor, setOfficialsSimCursor] = useState(0); // 官员分片模拟游标
    const [officialCandidates, setOfficialCandidates] = useState([]); // 当前候选人列表
    const [lastSelectionDay, setLastSelectionDay] = useState(-999);   // 上次举办选拔的时�?
    const [officialCapacity, setOfficialCapacity] = useState(2);      // 官员容量
    const [ministerAssignments, setMinisterAssignments] = useState(buildInitialMinisterAssignments());
    const [ministerAutoExpansion, setMinisterAutoExpansion] = useState(buildInitialMinisterAutoExpansion());
    const [lastMinisterExpansionDay, setLastMinisterExpansionDay] = useState(0);
    // ========== 内阁协同系统状�?==========
    // Permanent policy decrees (legacy) - stored as array of { id, active, modifiers, ... }
    const [decrees, setDecrees] = useState([]);

    const [activeDecrees, setActiveDecrees] = useState({});           // 当前生效的临时法�?
    const [decreeCooldowns, setDecreCooldowns] = useState({});       // 法令冷却时间
    const [quotaTargets, setQuotaTargets] = useState({});             // 计划经济阶层配额目标
    const [expansionSettings, setExpansionSettings] = useState({});   // 自由市场建筑扩张设置
    // ========== 政府价格管制状态（计划经济�?==========
    const [priceControls, setPriceControls] = useState({
        enabled: false,              // 是否启用价格管制
        governmentBuyPrices: {},     // 政府收购�?{ resourceKey: price }
        governmentSellPrices: {},    // 政府出售�?{ resourceKey: price }
    });


    // ========== 社会阶层状�?==========
    const [classApproval, setClassApproval] = useState({});
    const [approvalBreakdown, setApprovalBreakdown] = useState({}); // [NEW] 各阶层满意度分解数据（来�?simulation�?
    const [classInfluence, setClassInfluence] = useState({});
    const [classWealth, setClassWealthState] = useState(buildInitialWealth());
    const [classWealthDelta, setClassWealthDelta] = useState({});
    const [classIncome, setClassIncome] = useState({});
    const [classExpense, setClassExpense] = useState({});
    const [classFinancialData, setClassFinancialData] = useState({}); // Detailed financial breakdown
    const [buildingFinancialData, setBuildingFinancialData] = useState({}); // Per-building realized financial stats
    const [classWealthHistory, setClassWealthHistory] = useState(buildInitialWealthHistory());
    const [classNeedsHistory, setClassNeedsHistory] = useState(buildInitialNeedsHistory());
    const [totalInfluence, setTotalInfluence] = useState(0);
    const [totalWealth, setTotalWealth] = useState(0);
    const [activeBuffs, setActiveBuffs] = useState([]);
    const [activeDebuffs, setActiveDebuffs] = useState([]);
    const [classInfluenceShift, setClassInfluenceShift] = useState({});
    const [stability, setStability] = useState(50);
    const [stratumDetailView, setStratumDetailView] = useState(null);
    const [resourceDetailView, setResourceDetailView] = useState(null);
    const [classShortages, setClassShortages] = useState({});
    const [classLivingStandard, setClassLivingStandard] = useState({}); // 各阶层生活水平数�?
    const [livingStandardStreaks, setLivingStandardStreaks] = useState(buildInitialLivingStandardStreaks());
    const [migrationCooldowns, setMigrationCooldowns] = useState({}); // 阶层迁移冷却状�?{ roleKey: ticksRemaining }
    const [taxShock, setTaxShock] = useState({}); // [NEW] 各阶层累积税收冲击�?{ roleKey: number }
    const [populationDetailView, setPopulationDetailView] = useState(false);
    const [history, setHistory] = useState(buildInitialHistory());
    
    // ========== 经济指标 ==========
    const [priceHistory, setPriceHistory] = useState({}); // 价格历史（最�?65天）
    const [equilibriumPrices, setEquilibriumPrices] = useState({}); // 长期均衡价格�?0天滚动平均）
    const [economicIndicators, setEconomicIndicators] = useState({
        gdp: { total: 0, consumption: 0, investment: 0, government: 0, netExports: 0, change: 0 },
        cpi: { index: 100, change: 0, breakdown: {} },
        ppi: { index: 100, change: 0, breakdown: {} },
    });
    
    const [eventEffectSettings, setEventEffectSettings] = useState(DEFAULT_EVENT_EFFECT_SETTINGS);
    const [activeEventEffects, setActiveEventEffects] = useState(buildInitialEventEffects());

    // ========== 财政（实际口径） ==========
    // Stores realized per-tick treasury changes and actual payments (not "planned" amounts).
    const [fiscalActual, setFiscalActual] = useState({
        silverDelta: 0,
        officialSalaryPaid: 0,
        forcedSubsidyPaid: 0,
        forcedSubsidyUnpaid: 0,
    });
    const [treasuryChangeLog, setTreasuryChangeLog] = useState([]);
    const [resourceChangeLog, setResourceChangeLog] = useState([]);
    const [classWealthChangeLog, setClassWealthChangeLog] = useState([]);

    // [FIX] 每日军队维护成本（simulation返回的完整数据）
    const [dailyMilitaryExpense, setDailyMilitaryExpense] = useState(null);

    // ========== 时间状�?==========
    const [daysElapsed, setDaysElapsed] = useState(0);

    const appendTreasuryChangeLog = (entry) => {
        setTreasuryChangeLog(prev => {
            const next = [...prev, entry];
            return next.slice(-300);
        });
    };

    const appendResourceChangeLog = (entries) => {
        if (!Array.isArray(entries) || entries.length === 0) return;
        setResourceChangeLog(prev => {
            const next = [...prev, ...entries];
            return next.slice(-600);
        });
    };

    const appendClassWealthChangeLog = (entries) => {
        if (!Array.isArray(entries) || entries.length === 0) return;
        setClassWealthChangeLog(prev => {
            const next = [...prev, ...entries];
            return next.slice(-600);
        });
    };

    const setResources = (updater, options = {}) => {
        const {
            reason = 'unknown',
            meta = null,
            audit = true,
            auditEntries = null,
            auditStartingSilver = null,
        } = options || {};
        setResourcesState(prev => {
            const before = Number(prev?.silver || 0);
            const next = typeof updater === 'function' ? updater(prev) : updater;
            if (!next || typeof next !== 'object') return prev;
            const after = Number(next?.silver || 0);
            const logDay = Number.isFinite(meta?.day) ? meta.day : daysElapsed;
            const metaSource = meta && typeof meta === 'object' ? meta.source : undefined;
            if (audit) {
                const resourceEntries = [];
                const allKeys = new Set([
                    ...Object.keys(prev || {}),
                    ...Object.keys(next || {}),
                ]);
                const timestamp = Date.now();
                allKeys.forEach((key) => {
                    const beforeValue = Number(prev?.[key] || 0);
                    const afterValue = Number(next?.[key] || 0);
                    if (!Number.isFinite(beforeValue) && !Number.isFinite(afterValue)) return;
                    if (beforeValue === afterValue) return;
                    resourceEntries.push({
                        timestamp,
                        day: logDay,
                        resource: key,
                        amount: afterValue - beforeValue,
                        before: beforeValue,
                        after: afterValue,
                        reason,
                        meta,
                    });
                });
                if (resourceEntries.length > 0) {
                    appendResourceChangeLog(resourceEntries);
                }

                const entries = Array.isArray(auditEntries) ? auditEntries : [];
                if (entries.length > 0 && Number.isFinite(after)) {
                    let running = Number.isFinite(auditStartingSilver) ? auditStartingSilver : before;
                    let entryTotal = 0;
                    entries.forEach((entry) => {
                        const amount = Number(entry?.amount || 0);
                        if (!Number.isFinite(amount) || Math.abs(amount) < 0.01) return;
                        const entryBefore = running;
                        const entryAfter = entryBefore + amount;
                        appendTreasuryChangeLog({
                            timestamp: Date.now(),
                            day: logDay,
                            amount,
                            before: entryBefore,
                            after: entryAfter,
                            reason: entry?.reason || reason,
                            meta: entry?.meta ?? meta,
                        });
                        running = entryAfter;
                        entryTotal += amount;
                    });
                    const residual = (after - before) - entryTotal;
                    if (Number.isFinite(residual) && Math.abs(residual) > 0.01) {
                        appendTreasuryChangeLog({
                            timestamp: Date.now(),
                            day: logDay,
                            amount: residual,
                            before: running,
                            after: running + residual,
                            reason: 'untracked_delta',
                            meta: metaSource ? { reason, meta, source: metaSource } : { reason, meta },
                        });
                    }
                } else if (Number.isFinite(after) && after !== before) {
                    appendTreasuryChangeLog({
                        timestamp: Date.now(),
                        day: logDay,
                        amount: after - before,
                        before,
                        after,
                        reason,
                        meta,
                    });
                }
            }
            return next;
        });
    };

    const setClassWealth = (updater, options = {}) => {
        const { reason = 'unknown', meta = null, audit = true } = options || {};
        setClassWealthState(prev => {
            const next = typeof updater === 'function' ? updater(prev) : updater;
            if (!next || typeof next !== 'object') return prev;
            if (audit) {
                const entries = [];
                const timestamp = Date.now();
                const allKeys = new Set([
                    ...Object.keys(prev || {}),
                    ...Object.keys(next || {}),
                ]);
                allKeys.forEach((key) => {
                    const beforeValue = Number(prev?.[key] || 0);
                    const afterValue = Number(next?.[key] || 0);
                    if (!Number.isFinite(beforeValue) && !Number.isFinite(afterValue)) return;
                    if (beforeValue === afterValue) return;
                    entries.push({
                        timestamp,
                        day: daysElapsed,
                        stratum: key,
                        amount: afterValue - beforeValue,
                        before: beforeValue,
                        after: afterValue,
                        reason,
                        meta,
                    });
                });
                appendClassWealthChangeLog(entries);
            }
            return next;
        });
    };

    // ========== 军事系统状�?==========
    const [army, setArmy] = useState({});
    const [militaryQueue, setMilitaryQueue] = useState([]);
    const [selectedTarget, setSelectedTarget] = useState(null);
    const [battleResult, setBattleResult] = useState(null);
    const [battleNotifications, setBattleNotifications] = useState([]); // 战斗通知队列
    const [militaryWageRatio, setMilitaryWageRatio] = useState(1.5);
    const [autoRecruitEnabled, setAutoRecruitEnabled] = useState(false);  // 自动补兵开�?
    const [targetArmyComposition, setTargetArmyComposition] = useState({});  // 目标军队编制
    const [lastBattleTargetId, setLastBattleTargetId] = useState(null); // 上次攻击的目标ID
    const [lastBattleDay, setLastBattleDay] = useState(-999); // 上次攻击的时�?
    const [militaryCorps, setMilitaryCorps] = useState([]); // 军团列表
    const [generals, setGenerals] = useState([]); // 将领列表
    const [activeFronts, setActiveFronts] = useState([]); // 活跃战线
    const [activeBattles, setActiveBattles] = useState([]); // 进行中的战斗
    const [pendingRepairs, setPendingRepairs] = useState([]); // 战后待修复建�?[{ buildingId, count, source }]

    // ========== 庆典系统状�?==========
    const [festivalModal, setFestivalModal] = useState(null); // { options: [], year: number }
    const [activeFestivalEffects, setActiveFestivalEffects] = useState([]); // 激活的庆典效果
    const [lastFestivalYear, setLastFestivalYear] = useState(1); // 上次庆典的年份（�?开始，避免�?年触发）

    // ========== 商人交易状�?==========
    const [merchantState, setMerchantState] = useState(buildInitialMerchantState); // 商人交易状态：买入-持有-卖出周期

    // ========== 贸易路线状�?==========
    const [tradeRoutes, setTradeRoutes] = useState(buildInitialTradeRoutes); // 玩家创建的贸易路�?
    const [tradeStats, setTradeStats] = useState({ tradeTax: 0, tradeRouteTax: 0 }); // 每日贸易路线税收
    const [diplomacyOrganizations, setDiplomacyOrganizations] = useState(buildInitialDiplomacyOrganizations);
    const [vassalDiplomacyQueue, setVassalDiplomacyQueue] = useState([]);
    const [vassalDiplomacyHistory, setVassalDiplomacyHistory] = useState([]);
    const [overseasBuildings, setOverseasBuildings] = useState(buildInitialOverseasBuildings);

    // ========== 和平协议状�?==========
    // ========== 策略行动状�?==========
    const [actionCooldowns, setActionCooldowns] = useState({});
    const [actionUsage, setActionUsage] = useState({});
    const [promiseTasks, setPromiseTasks] = useState([]);

    const [playerInstallmentPayment, setPlayerInstallmentPayment] = useState(null); // 玩家的分期支付协�?

    // ========== 叛乱系统状�?==========
    // 追踪各阶层的叛乱状�?
    // 格式: { [stratumKey]: { dissatisfactionDays: number, phase: string, influenceShare: number } }
    const [rebellionStates, setRebellionStates] = useState({});

    // ========== 执政联盟状�?==========
    // 默认自耕农(peasant)为联盟成�?
    const [rulingCoalition, setRulingCoalition] = useState(['peasant']); // 联盟成员阶层键数�?
    const [legitimacy, setLegitimacy] = useState(0); // 合法性�?(0-100)

    // ========== 游戏运算中间值（Modifiers�?==========
    const [modifiers, setModifiers] = useState({});

    // ========== 教程系统状�?==========
    const [showTutorial, setShowTutorial] = useState(() => {
        // 检查是否已完成教程
        const completed = localStorage.getItem('tutorial_completed');
        return !completed; // 如果没有记录，则显示教程
    });

    // ========== 事件系统状�?==========
    const [currentEvent, setCurrentEvent] = useState(null); // 当前显示的事�?
    const [eventHistory, setEventHistory] = useState([]); // 事件历史记录

    // ========== 成就系统状�?==========
    const [unlockedAchievements, setUnlockedAchievements] = useState(loadAchievementsFromStorage);
    const [achievementNotifications, setAchievementNotifications] = useState([]);
    const [achievementProgress, setAchievementProgress] = useState(loadAchievementProgressFromStorage);

    // ========== UI状�?==========
    const [logs, setLogs] = useState(["????????? 1 ????????????????????"]);
    const [clicks, setClicks] = useState([]);
    const [rates, setRates] = useState({});
    const [taxes, setTaxes] = useState({
        total: 0,
        breakdown: { headTax: 0, industryTax: 0, subsidy: 0, policyIncome: 0, policyExpense: 0 },
        efficiency: 1,
    });
    const [taxPolicies, setTaxPolicies] = useState({
        headTaxRates: buildDefaultHeadTaxRates(),
        resourceTaxRates: buildDefaultResourceTaxRates(),
        businessTaxRates: buildDefaultBusinessTaxRates(),
        exportTariffMultipliers: {}, // 初始化为空对象，避免 undefined
        importTariffMultipliers: {}, // 初始化为空对象，避免 undefined
        resourceTariffMultipliers: {}, // 兼容旧版
    });
    const [jobFill, setJobFill] = useState({});
    const [jobsAvailable, setJobsAvailable] = useState({}); // 各阶层可用岗位数�?
    const [buildingJobsRequired, setBuildingJobsRequired] = useState({}); // 每个建筑的实际岗位需�?
    const [market, setMarket] = useState(buildInitialMarket());

    useEffect(() => {
        return () => {
            if (savingIndicatorTimer.current) {
                clearTimeout(savingIndicatorTimer.current);
            }
        };
    }, []);

    const addLogEntry = (message) => {
        setLogs(prev => [message, ...prev].slice(0, 8));
    };

    const applyScenarioConfig = (scenarioId) => {
        if (!scenarioId) return;
        const scenario = getScenarioById(scenarioId);
        if (!scenario) return;

        const overrides = scenario.overrides || {};

        if (overrides.resources) {
            setResources(
                { ...INITIAL_RESOURCES, ...overrides.resources },
                { reason: 'scenario_override', meta: { scenarioId } }
            );
        }

        // Default starting buildings: 1 farm + 1 lumber camp + 1 loom house
        // This gives the player a basic food/wood/cloth supply at game start.
        const defaultStartingBuildings = { farm: 1, lumber_camp: 1, loom_house: 1 };

        if (overrides.buildings) {
            // Merge to ensure defaults exist unless explicitly overridden
            setBuildings({ ...defaultStartingBuildings, ...overrides.buildings });
        } else {
            setBuildings(defaultStartingBuildings);
        }

        if (overrides.buildingUpgrades) {
            setBuildingUpgrades(overrides.buildingUpgrades);
        }

        if (overrides.techsUnlocked) {
            setTechsUnlocked(overrides.techsUnlocked);
        }

        if (typeof overrides.epoch === 'number') {
            setEpoch(overrides.epoch);
        }

        if (overrides.classApproval) {
            setClassApproval(overrides.classApproval);
        }

        if (overrides.classInfluence) {
            setClassInfluence(overrides.classInfluence);
        }

        if (overrides.classWealth) {
            setClassWealth(
                { ...buildInitialWealth(), ...overrides.classWealth },
                { reason: 'scenario_override', meta: { scenarioId } }
            );
        }

        if (typeof overrides.stability === 'number') {
            setStability(overrides.stability);
        }

        if (overrides.rulingCoalition) {
            setRulingCoalition(overrides.rulingCoalition);
        }

        if (typeof overrides.maxPopBonus === 'number') {
            setMaxPopBonus(overrides.maxPopBonus);
        }

        if (overrides.popStructure) {
            setPopStructure(overrides.popStructure);
        }

        const scenarioPopulation = buildScenarioPopulation(overrides);
        const targetPopulation = typeof overrides.population === 'number'
            ? overrides.population
            : scenarioPopulation;

        if (typeof targetPopulation === 'number') {
            setPopulation(targetPopulation);
            const nextMaxPop = typeof overrides.maxPop === 'number'
                ? Math.max(overrides.maxPop, targetPopulation)
                : Math.max(10, targetPopulation);
            setMaxPop(nextMaxPop);
        } else if (typeof overrides.maxPop === 'number') {
            setMaxPop(overrides.maxPop);
        }

        // ========== 新增配置项支�?==========

        // 外交关系配置
        if (overrides.nationRelations) {
            setNations(prev => prev.map(n => ({
                ...n,
                relation: typeof overrides.nationRelations[n.id] === 'number'
                    ? overrides.nationRelations[n.id]
                    : n.relation
            })));
        }

        // 初始军队配置
        if (overrides.army) {
            setArmy(overrides.army);
        }

        // 市场价格配置
        if (overrides.marketPrices) {
            setMarket(prev => ({
                ...prev,
                prices: { ...prev.prices, ...overrides.marketPrices }
            }));
        }

        // 合法性配�?
        if (typeof overrides.legitimacy === 'number') {
            setLegitimacy(overrides.legitimacy);
        }

        // 税收政策配置
        if (overrides.taxPolicies) {
            setTaxPolicies(prev => ({
                ...prev,
                ...overrides.taxPolicies
            }));
        }
    };

    // Auto-load the most recent save on startup
    const hasInitializedRef = useRef(false);
    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (hasInitializedRef.current) return;
        hasInitializedRef.current = true;

        try {
            // 检查是否是新游戏模式（�?另开新档"进入�?
            const startNewGame = localStorage.getItem('start_new_game');
            if (startNewGame === 'true') {
                localStorage.removeItem('start_new_game');
                const newGameDifficulty = localStorage.getItem('new_game_difficulty');
                let difficultyForNewGame = DEFAULT_DIFFICULTY;
                if (newGameDifficulty) {
                    console.log(`[DEBUG] Initializing New Game with Difficulty: ${newGameDifficulty}`);
                    difficultyForNewGame = newGameDifficulty;
                    setDifficulty(newGameDifficulty);
                    localStorage.removeItem('new_game_difficulty');
                }
                // 读取并设置帝国名�?
                const newGameEmpireName = localStorage.getItem('new_game_empire_name');
                if (newGameEmpireName) {
                    setEmpireName(newGameEmpireName);
                    localStorage.removeItem('new_game_empire_name');
                }
                const newGameScenario = localStorage.getItem('new_game_scenario');
                if (newGameScenario) {
                    applyScenarioConfig(newGameScenario);
                    localStorage.removeItem('new_game_scenario');
                } else {
                    // Standard Game: Apply difficulty-based initial buildings
                    const initialBuildings = getInitialBuildings(difficultyForNewGame);
                    setBuildings(initialBuildings);
                }

                // Difficulty-based starting treasury boost
                const startingSilverMultiplier = getStartingSilverMultiplier(difficultyForNewGame);
                if (startingSilverMultiplier !== 1.0) {
                    setResources(
                        prev => ({
                            ...prev,
                            silver: Math.floor((prev?.silver ?? INITIAL_RESOURCES.silver) * startingSilverMultiplier),
                        }),
                        { reason: 'difficulty_starting_silver' }
                    );
                }

                // 跳过自动加载，开始新游戏
                return;
            }

            // 收集所有存档的时间�?
            const saves = [];

            // 检查手动存档槽�?
            for (let i = 0; i < SAVE_SLOT_COUNT; i++) {
                const key = `${SAVE_SLOT_PREFIX}${i}`;
                const raw = localStorage.getItem(key);
                if (raw) {
                    try {
                        const data = JSON.parse(raw);
                        if (data.updatedAt) {
                            saves.push({ slotIndex: i, updatedAt: data.updatedAt, source: 'manual' });
                        }
                    } catch (e) {
                        console.warn(`Failed to parse slot ${i}:`, e);
                    }
                }
            }

            // 检查自动存�?
            const autoRaw = localStorage.getItem(AUTOSAVE_KEY);
            if (autoRaw) {
                try {
                    const autoData = JSON.parse(autoRaw);
                    if (autoData.updatedAt) {
                        saves.push({ slotIndex: -1, updatedAt: autoData.updatedAt, source: 'auto' });
                    }
                } catch (e) {
                    console.warn('Failed to parse auto-save:', e);
                }
            }

            // 检查旧版存档并迁移到槽�?
            const legacyRaw = localStorage.getItem(LEGACY_SAVE_KEY);
            if (legacyRaw && saves.filter(s => s.source === 'manual').length === 0) {
                try {
                    // 迁移旧存档到槽位0
                    localStorage.setItem(`${SAVE_SLOT_PREFIX}0`, legacyRaw);
                    localStorage.removeItem(LEGACY_SAVE_KEY);
                    const legacyData = JSON.parse(legacyRaw);
                    if (legacyData.updatedAt) {
                        saves.push({ slotIndex: 0, updatedAt: legacyData.updatedAt, source: 'manual' });
                    }
                    console.log('Migrated legacy save to slot 0');
                } catch (e) {
                    console.warn('Failed to migrate legacy save:', e);
                }
            }

            if (saves.length === 0) {
                // No saves found, start fresh - check for new game difficulty
                const newGameDifficulty = localStorage.getItem('new_game_difficulty');
                let difficultyForNewGame = DEFAULT_DIFFICULTY;
                if (newGameDifficulty) {
                    difficultyForNewGame = newGameDifficulty;
                    setDifficulty(newGameDifficulty);
                    localStorage.removeItem('new_game_difficulty');
                }
                const newGameScenario = localStorage.getItem('new_game_scenario');
                if (newGameScenario) {
                    applyScenarioConfig(newGameScenario);
                    localStorage.removeItem('new_game_scenario');
                } else {
                    // Standard Game: Apply difficulty-based initial buildings
                    const initialBuildings = getInitialBuildings(difficultyForNewGame);
                    setBuildings(initialBuildings);
                }

                // Difficulty-based starting treasury boost
                const startingSilverMultiplier = getStartingSilverMultiplier(difficultyForNewGame);
                if (startingSilverMultiplier !== 1.0) {
                    setResources(
                        prev => ({
                            ...prev,
                            silver: Math.floor((prev?.silver ?? INITIAL_RESOURCES.silver) * startingSilverMultiplier),
                        }),
                        { reason: 'difficulty_starting_silver' }
                    );
                }

                return;
            }

            // 找到最新的存档
            saves.sort((a, b) => b.updatedAt - a.updatedAt);
            const mostRecent = saves[0];

            // Use setTimeout to ensure loadGame has access to addLogEntry
            setTimeout(() => {
                loadGame({ source: mostRecent.source, slotIndex: mostRecent.slotIndex });
            }, 0);
        } catch (error) {
            console.warn('Auto-load failed:', error);
        }
    }, []);

    const triggerSavingIndicator = () => {
        setIsSaving(true);
        if (savingIndicatorTimer.current) {
            clearTimeout(savingIndicatorTimer.current);
        }
        savingIndicatorTimer.current = setTimeout(() => {
            setIsSaving(false);
            savingIndicatorTimer.current = null;
        }, 1000);
    };

    const buildSavePayload = ({ source = 'manual', timestamp = Date.now() } = {}) => {
        const nextLastAuto = source === 'auto' ? timestamp : lastAutoSaveTime;
        return {
            payload: {
                saveFormatVersion: SAVE_FORMAT_VERSION,
                resources,
                population,
                popStructure,
                maxPop,
                maxPopBonus,
                birthAccumulator,
                buildings,
                buildingUpgrades,
                techsUnlocked,
                epoch,
                activeTab,
                gameSpeed,
                isPaused,
                nations,
                diplomaticReputation,
                officials,
                officialsSimCursor,
                officialCandidates,
                lastSelectionDay,
                officialCapacity,
                ministerAssignments,
                ministerAutoExpansion,
                lastMinisterExpansionDay,
                decrees,
                activeDecrees,
                decreeCooldowns,
                quotaTargets,
                expansionSettings: sanitizeExpansionSettings(expansionSettings),
                priceControls, // [NEW] planned economy price control settings
                classApproval,
                classInfluence,
                classWealth,
                classWealthDelta,
                classIncome,
                classExpense,
                classFinancialData,
                buildingFinancialData,
                classWealthHistory,
                classNeedsHistory,
                totalInfluence,
                totalWealth,
                activeBuffs,
                activeDebuffs,
                classInfluenceShift,
                stability,
                stratumDetailView,
                resourceDetailView,
                classShortages,
                classLivingStandard,
                livingStandardStreaks,
                migrationCooldowns,
                populationDetailView,
                history,
                // 经济指标
                priceHistory,
                equilibriumPrices,
                economicIndicators,
                daysElapsed,
                army,
                militaryQueue,
                militaryCorps,
                generals,
                activeFronts,
                activeBattles,
                pendingRepairs,
                selectedTarget,
                battleResult,
                playerInstallmentPayment,
                autoRecruitEnabled,
                targetArmyComposition,
                militaryWageRatio,
                festivalModal,
                activeFestivalEffects,
                lastFestivalYear,
                showTutorial,
                currentEvent,
                eventHistory,
                logs,
                clicks,
                rates,
                taxes,
                taxPolicies,
                jobFill,
                market,
                merchantState,
                tradeRoutes,
                tradeStats,
                diplomacyOrganizations,
                vassalDiplomacyQueue,
                vassalDiplomacyHistory,
                overseasBuildings,
                overseasInvestments,
                foreignInvestments,
                foreignInvestmentPolicy,
                eventEffectSettings,
                activeEventEffects,
                rebellionStates,
                rulingCoalition,
                legitimacy,
                actionCooldowns,
                actionUsage,
                promiseTasks,
                autoSaveInterval,
                isAutoSaveEnabled,
                lastAutoSaveTime: nextLastAuto,
                difficulty,
                empireName,
                eventConfirmationEnabled,
                updatedAt: timestamp,
                saveSource: source,
                // AI balance version marker - increment to trigger re-migration of old saves
                // v1: initial migration for too-strong/too-weak AI
                // v2: fix missing economyTraits fields that prevent AI development
                // v3: clamp future AI ticks + seed missing AI gift cooldown
                // v4: fix infinite growth bug (populationBasedMinimum loop)
                // v5: economy migration + display split
                // v6: battle/front/corps load reconciliation
                aiBalanceVersion: 6,
            },
            nextLastAuto,
        };
    };

    const applyLoadedGameState = (data) => {
        if (!data || typeof data !== 'object') {
            throw new Error('存档数据无效');
        }
        setResources(data.resources || INITIAL_RESOURCES, { reason: 'load_game', audit: false });

        // [FIX] 存档人口同步修复：防止population和popStructure不一致导致的恶性扣减循�?
        // 如果存档中的population与popStructure总和不一致，以popStructure为准
        let loadedPopulation = data.population ?? 5;
        const loadedPopStructure = data.popStructure || {};
        const popStructureTotal = Object.values(loadedPopStructure).reduce((sum, val) => sum + (val || 0), 0);

        if (popStructureTotal > 0 && Math.abs(loadedPopulation - popStructureTotal) > 0.5) {
            console.log(`[Save Migration] Population mismatch detected! population=${loadedPopulation}, popStructure sum=${popStructureTotal}. Fixing...`);
            loadedPopulation = popStructureTotal; // 以popStructure总和为准
        }

        setPopulation(loadedPopulation);
        setPopStructure(loadedPopStructure);
        setMaxPop(data.maxPop ?? 10);
        setMaxPopBonus(data.maxPopBonus || 0);
        setBirthAccumulator(data.birthAccumulator || 0);
        setBuildings(data.buildings || {});
        // 升级格式迁移：检测旧格式并自动转�?
        let upgrades = data.buildingUpgrades || {};
        if (isOldUpgradeFormat(upgrades, data.buildings)) {
            console.log('[Save Migration] Detected old buildingUpgrades format, migrating...');
            upgrades = migrateUpgradesToNewFormat(upgrades, data.buildings);
        }
        
        // [FIX] 清理不一致的升级数据：确保升级数量不超过建筑数量
        // 这可以修复由于数据损坏或旧版本bug导致的不一�?
        const buildings = data.buildings || {};
        let hasInconsistency = false;
        for (const [buildingId, levelCounts] of Object.entries(upgrades)) {
            if (!levelCounts || typeof levelCounts !== 'object') continue;
            const buildingCount = buildings[buildingId] || 0;
            let totalUpgraded = 0;
            for (const lvlCount of Object.values(levelCounts)) {
                if (typeof lvlCount === 'number' && lvlCount > 0) {
                    totalUpgraded += lvlCount;
                }
            }
            if (totalUpgraded > buildingCount) {
                console.warn(`[Save Migration] Building upgrade inconsistency detected for ${buildingId}: ${totalUpgraded} upgrades > ${buildingCount} buildings. Normalizing...`);
                hasInconsistency = true;
                // 规范化：按高等级优先分配
                const sortedLevels = Object.keys(levelCounts)
                    .map(k => parseInt(k))
                    .filter(k => Number.isFinite(k) && k > 0 && levelCounts[k] > 0)
                    .sort((a, b) => b - a);
                let remaining = buildingCount;
                const normalizedCounts = {};
                for (const lvl of sortedLevels) {
                    const wanted = levelCounts[lvl];
                    const actual = Math.min(wanted, remaining);
                    if (actual > 0) {
                        normalizedCounts[lvl] = actual;
                        remaining -= actual;
                    }
                }
                if (Object.keys(normalizedCounts).length > 0) {
                    upgrades[buildingId] = normalizedCounts;
                } else {
                    delete upgrades[buildingId];
                }
            }
        }
        if (hasInconsistency) {
            console.log('[Save Migration] Building upgrade data normalized.');
        }
        
        setBuildingUpgrades(upgrades);
        setTechsUnlocked(data.techsUnlocked || []);
        setEpoch(data.epoch ?? 0);
        setActiveTab(data.activeTab || 'build');
        setGameSpeed(data.gameSpeed ?? 1);
        setIsPaused(data.isPaused ?? false);
        setDiplomaticReputation(data.diplomaticReputation ?? 50);

        // [FIX] Legacy save migration: Fix AI nations with broken population/wealth from old versions
        // Only apply to saves WITHOUT aiBalanceVersion marker (old saves before this fix)
        const loadedNations = (data.nations || buildInitialNations()).map((nation) => {
            if (!nation || nation.id === 'player') return nation;
            return ensureAIMilitaryState(migrateNationEconomy(nation), data.epoch ?? 0);
        });
        const playerPop = loadedPopulation; // Use player population loaded above
        const playerWealth = (data.resources?.silver) || 1000;
        const currentEpoch = data.epoch ?? 0;
        const loadedTick = data.daysElapsed || 0;
        
        let migratedNations = loadedNations;
        // [FIX v2] Check if save version is outdated (missing OR less than current version)
        // This ensures old saves that were saved after partial fixes still get updated
        const CURRENT_AI_BALANCE_VERSION = 6;
        const saveAIVersion = data.aiBalanceVersion || 0;
        const needsMigration = saveAIVersion < CURRENT_AI_BALANCE_VERSION;
        
        if (needsMigration) {
            console.log(`[Save Migration] AI balance version ${saveAIVersion} < ${CURRENT_AI_BALANCE_VERSION}, applying migration...`);
            // This is an old save - check for broken AI nations
            migratedNations = loadedNations.map(n => {
                // Skip player nation
                if (n.id === 'player') return n;
                
                const aiPop = n.population || 0;
                const aiWealth = n.wealth || 0;
                const popRatio = aiPop / Math.max(1, playerPop);
                const wealthRatio = aiWealth / Math.max(1, playerWealth);
                
                // [FIX v4] Also check per-capita wealth cap (reduced caps)
                // Per-capita wealth cap by epoch: Stone=2k, Ancient=4k, Medieval=8k, Industrial=16k, Modern=32k
                const nationEpoch = n.epoch ?? 0;
                const perCapitaWealthCap = Math.min(50000, 2000 * Math.pow(2, Math.min(nationEpoch, 4)));
                const aiPerCapitaWealth = aiWealth / Math.max(1, aiPop);
                const perCapitaExceeded = aiPerCapitaWealth > perCapitaWealthCap;
                
                // [FIX v3] Check if AI nation is TOO WEAK (population < 100 or less than 5% of player)
                // Old saves often have AI stuck at 10-30 population due to missing growth logic
                const isTooWeak = aiPop < 100 || (playerPop > 100 && popRatio < 0.05);
                
                // [FIX v4] Check for infinite growth bug (population > 1 billion indicates bug)
                // Bug was caused by populationBasedMinimum = currentPop * 10 creating feedback loop
                const hasInfiniteGrowthBug = aiPop > 1000000000 || aiWealth > 1000000000000;
                
                // If AI population OR wealth exceeds 10x player's level, OR per-capita wealth exceeds cap, OR is too weak, OR has infinite growth bug
                if (popRatio > 10 || wealthRatio > 10 || perCapitaExceeded || isTooWeak || hasInfiniteGrowthBug) {
                    const reason = hasInfiniteGrowthBug
                        ? `INFINITE GROWTH BUG: pop=${aiPop.toExponential(2)}, wealth=${aiWealth.toExponential(2)}`
                        : isTooWeak 
                        ? `TOO WEAK: pop=${aiPop}, wealth=${aiWealth}` 
                        : `TOO STRONG: pop=${aiPop}, wealth=${aiWealth}, per-capita=${aiPerCapitaWealth.toFixed(0)}, cap=${perCapitaWealthCap}`;
                    console.log(`[Save Migration] Resetting broken AI nation: ${n.name} (${reason})`);
                    
                    
                    // Calculate reasonable values based on player's current development
                    // AI nations should be at 30-80% of player's level, scaled by their appear epoch
                    const appearEpoch = n.appearEpoch ?? 0;
                    const epochBonus = 1 + Math.min(appearEpoch, currentEpoch) * 0.2;
                    
                    // Population: 30-80% of player, with epoch bonus
                    const targetPopScale = 0.3 + Math.random() * 0.5; // 0.3 to 0.8
                    const newPopulation = Math.max(100, Math.floor(playerPop * targetPopScale * epochBonus));
                    
                    // Wealth: 20-60% of player, with epoch bonus, but capped by per-capita limit
                    const targetWealthScale = 0.2 + Math.random() * 0.4; // 0.2 to 0.6
                    const rawNewWealth = Math.floor(playerWealth * targetWealthScale * epochBonus);
                    // Ensure per-capita wealth doesn't exceed cap (use 50% of cap for safety margin)
                    const maxWealthByPerCapita = newPopulation * perCapitaWealthCap * 0.5;
                    const newWealth = Math.max(500, Math.min(rawNewWealth, maxWealthByPerCapita));
                    
                    // Reset economy traits
                    const newEconomyTraits = {
                        ...(n.economyTraits || {}),
                        ownBasePopulation: Math.max(5, Math.floor(newPopulation / 10)),
                        ownBaseWealth: newWealth,
                        basePopulation: newPopulation,
                        baseWealth: newWealth,
                        developmentRate: 0.8 + Math.random() * 0.4,
                        lastGrowthTick: Math.max(0, loadedTick - 15), // [FIX] Set to recent tick instead of 0
                    };
                    
                    return {
                        ...n,
                        population: newPopulation,
                        wealth: newWealth,
                        budget: Math.floor(newWealth * calculateAITreasuryTargetRatio({
                            wealth: newWealth,
                            population: newPopulation,
                            epoch: nationEpoch,
                            isAtWar: false,
                            aggression: n.aggression || 0.3,
                            capacityUsage: 0.6,
                            developmentRate: 1.0,
                        })),
                        wealthTemplate: newWealth,
                        economyTraits: newEconomyTraits,
                    };
                }
                
                // [FIX v2] For nations that don't need full reset, still ensure they have ALL required economyTraits
                // This fixes old saves where nations may have economyTraits but missing critical fields
                // Without these fields, AI nations WILL NOT DEVELOP!
                const fixedEconomyTraits = { ...(n.economyTraits || {}) };
                let needsFix = false;
                const currentPop = n.population || 16;
                const currentWealth = n.wealth || 1000;
                
                // [CRITICAL] Fix missing ownBasePopulation - without this, growth model fails!
                if (!fixedEconomyTraits.ownBasePopulation || !Number.isFinite(fixedEconomyTraits.ownBasePopulation) || fixedEconomyTraits.ownBasePopulation < 1) {
                    fixedEconomyTraits.ownBasePopulation = Math.max(5, currentPop);
                    needsFix = true;
                    console.log(`[Save Migration] Fixed missing ownBasePopulation for: ${n.name} -> ${fixedEconomyTraits.ownBasePopulation}`);
                }
                
                // [CRITICAL] Fix missing ownBaseWealth
                if (!fixedEconomyTraits.ownBaseWealth || !Number.isFinite(fixedEconomyTraits.ownBaseWealth) || fixedEconomyTraits.ownBaseWealth < 100) {
                    fixedEconomyTraits.ownBaseWealth = Math.max(500, currentWealth);
                    needsFix = true;
                    console.log(`[Save Migration] Fixed missing ownBaseWealth for: ${n.name} -> ${fixedEconomyTraits.ownBaseWealth}`);
                }
                
                // [CRITICAL] Fix missing developmentRate - controls growth speed!
                if (!fixedEconomyTraits.developmentRate || !Number.isFinite(fixedEconomyTraits.developmentRate) || fixedEconomyTraits.developmentRate < 0.1) {
                    fixedEconomyTraits.developmentRate = 0.8 + Math.random() * 0.4; // 0.8 - 1.2
                    needsFix = true;
                    console.log(`[Save Migration] Fixed missing developmentRate for: ${n.name} -> ${fixedEconomyTraits.developmentRate.toFixed(2)}`);
                }
                
                // Fix missing lastGrowthTick
                if (fixedEconomyTraits.lastGrowthTick === undefined || fixedEconomyTraits.lastGrowthTick === null || !Number.isFinite(fixedEconomyTraits.lastGrowthTick)) {
                    fixedEconomyTraits.lastGrowthTick = Math.max(0, loadedTick - 15);
                    needsFix = true;
                    console.log(`[Save Migration] Fixed missing lastGrowthTick for: ${n.name}`);
                }
                
                // Fix missing lastDevelopmentTick
                if (fixedEconomyTraits.lastDevelopmentTick === undefined || fixedEconomyTraits.lastDevelopmentTick === null || !Number.isFinite(fixedEconomyTraits.lastDevelopmentTick)) {
                    fixedEconomyTraits.lastDevelopmentTick = Math.max(0, loadedTick - 15);
                    needsFix = true;
                }
                
                // Fix missing basePopulation (target for development)
                if (!fixedEconomyTraits.basePopulation || !Number.isFinite(fixedEconomyTraits.basePopulation)) {
                    fixedEconomyTraits.basePopulation = currentPop;
                    needsFix = true;
                }
                
                // Fix missing baseWealth (target for development)
                if (!fixedEconomyTraits.baseWealth || !Number.isFinite(fixedEconomyTraits.baseWealth)) {
                    fixedEconomyTraits.baseWealth = currentWealth;
                    needsFix = true;
                }
                
                if (needsFix) {
                    console.log(`[Save Migration] Applied economyTraits fixes for: ${n.name}`);
                    return { ...n, economyTraits: fixedEconomyTraits };
                }
                
                return n;
            });

            // [FIX v3] 修正未来时间�?+ 补齐 AI 送礼冷却字段
            const safeLoadedTick = Number.isFinite(loadedTick) ? loadedTick : 0;
            migratedNations = migratedNations.map(n => {
                if (!n || n.id === 'player') return n;
                const next = { ...n };

                if (next.economyTraits) {
                    if (Number.isFinite(next.economyTraits.lastGrowthTick) && next.economyTraits.lastGrowthTick > safeLoadedTick) {
                        next.economyTraits.lastGrowthTick = Math.max(0, safeLoadedTick - 15);
                    }
                    if (Number.isFinite(next.economyTraits.lastDevelopmentTick) && next.economyTraits.lastDevelopmentTick > safeLoadedTick) {
                        next.economyTraits.lastDevelopmentTick = Math.max(0, safeLoadedTick - 15);
                    }
                }

                if (!Number.isFinite(next.lastGiftToPlayerDay) || next.lastGiftToPlayerDay > safeLoadedTick) {
                    // 旧存档缺失该字段会绕过全局送礼冷却
                    next.lastGiftToPlayerDay = safeLoadedTick;
                }

                return next;
            });
        }

        // ========================================================================
        // [CRITICAL FIX] UNCONDITIONAL lastGrowthTick/lastDevelopmentTick reset
        // This MUST run for ALL saves (not just old versions) because:
        // 1. The save file stores lastGrowthTick from when it was saved
        // 2. When loaded, daysElapsed is restored but growth functions check
        //    (currentTick - lastGrowthTick >= 10) to decide if growth should happen
        // 3. If the save was made recently (e.g., lastGrowthTick = daysElapsed - 2),
        //    then after loading, nations won't grow until 10 ticks pass
        // 4. This caused the "frozen AI" bug after loading saves
        // 
        // Solution: Reset lastGrowthTick to (loadedTick - 20) so growth triggers
        // immediately on the first simulation tick after loading.
        // ========================================================================
        const finalLoadedTick = Number.isFinite(loadedTick) ? loadedTick : 0;
        
        migratedNations = migratedNations.map(n => {
            if (!n || n.id === 'player') return n;
            
            const next = { ...n };
            
            // Ensure economyTraits exists
            if (!next.economyTraits) {
                next.economyTraits = {};
            } else {
                next.economyTraits = { ...next.economyTraits };
            }
            
            // [FIX v4] ALWAYS reset lastGrowthTick unconditionally
            // This ensures growth will happen on the first tick after loading
            next.economyTraits.lastGrowthTick = Math.max(0, finalLoadedTick - 20);
            
            // Also reset lastDevelopmentTick unconditionally
            next.economyTraits.lastDevelopmentTick = Math.max(0, finalLoadedTick - 20);
            
            return next;
        });

        setNations(migratedNations.map(n => {
            const normalizedNation = n.id === 'player' ? n : migrateNationEconomy(n);
            return {
            ...normalizedNation,
            treaties: Array.isArray(n.treaties) ? n.treaties : [],
            openMarketUntil: Object.prototype.hasOwnProperty.call(n, 'openMarketUntil') ? n.openMarketUntil : null,
            peaceTreatyUntil: Object.prototype.hasOwnProperty.call(n, 'peaceTreatyUntil') ? n.peaceTreatyUntil : null,
            vassalOf: Object.prototype.hasOwnProperty.call(n, 'vassalOf') ? n.vassalOf : DEFAULT_VASSAL_STATUS.vassalOf,
            vassalType: Object.prototype.hasOwnProperty.call(n, 'vassalType') ? n.vassalType : DEFAULT_VASSAL_STATUS.vassalType,
            tributeRate: Number.isFinite(n.tributeRate) ? n.tributeRate : DEFAULT_VASSAL_STATUS.tributeRate,
            independencePressure: Number.isFinite(n.independencePressure) ? n.independencePressure : DEFAULT_VASSAL_STATUS.independencePressure,
            organizationMemberships: Array.isArray(n.organizationMemberships) ? n.organizationMemberships : [],
            overseasAssets: Array.isArray(n.overseasAssets) ? n.overseasAssets : [],
            };
        }));
        setOfficials(migrateAllOfficialsForInvestment(data.officials || [], data.daysElapsed || 0));
        setOfficialsSimCursor(data.officialsSimCursor ?? 0);
        setOfficialCandidates(data.officialCandidates || []);
        setLastSelectionDay(data.lastSelectionDay ?? -999);
        setOfficialCapacity(data.officialCapacity ?? 2);
        setMinisterAssignments({
            ...buildInitialMinisterAssignments(),
            ...(data.ministerAssignments || {}),
        });
        setMinisterAutoExpansion({
            ...buildInitialMinisterAutoExpansion(),
            ...(data.ministerAutoExpansion || {}),
        });
        setLastMinisterExpansionDay(data.lastMinisterExpansionDay ?? 0);
        setExpansionSettings(sanitizeExpansionSettings(data.expansionSettings)); // [FIX] 加载自由市场扩张设置
        setDecrees(Array.isArray(data.decrees) ? data.decrees : []);
        setActiveDecrees(data.activeDecrees || {});
        setDecreCooldowns(data.decreeCooldowns || {});
        // Planned economy quota controls: keep backward compatibility with older saves
        const loadedQuotaTargets = data.quotaTargets;
        const normalizedQuotaTargets = loadedQuotaTargets
            && typeof loadedQuotaTargets === 'object'
            && Object.prototype.hasOwnProperty.call(loadedQuotaTargets, 'targets')
            ? loadedQuotaTargets
            : { enabled: true, targets: loadedQuotaTargets || {} };
        setQuotaTargets(normalizedQuotaTargets);
        setPriceControls(data.priceControls || {
            enabled: false,
            governmentBuyPrices: {},
            governmentSellPrices: {},
        });
        setTaxShock(data.taxShock || {});
        setClassApproval(data.classApproval || {});
        setClassInfluence(data.classInfluence || {});
        setClassWealth(data.classWealth || buildInitialWealth(), { reason: 'load_game', audit: false });
        setClassWealthDelta(data.classWealthDelta || {});
        setClassIncome(data.classIncome || {});
        setClassExpense(data.classExpense || {});
        setClassFinancialData(data.classFinancialData || {});
        setClassWealthHistory(trimClassSeriesMap(
            data.classWealthHistory || buildInitialWealthHistory(),
            AUTO_SAVE_LIMITS.classSeries,
        ));
        setClassNeedsHistory(trimClassSeriesMap(
            data.classNeedsHistory || buildInitialNeedsHistory(),
            AUTO_SAVE_LIMITS.classSeries,
        ));
        setTotalInfluence(data.totalInfluence || 0);
        setTotalWealth(data.totalWealth || 0);
        setActiveBuffs(data.activeBuffs || []);
        setActiveDebuffs(data.activeDebuffs || []);
        setClassInfluenceShift(data.classInfluenceShift || {});
        setStability(data.stability ?? 50);
        setStratumDetailView(data.stratumDetailView || null);
        setResourceDetailView(data.resourceDetailView || null);
        setClassShortages(data.classShortages || {});
        setClassLivingStandard(data.classLivingStandard || {});
        setLivingStandardStreaks(data.livingStandardStreaks || buildInitialLivingStandardStreaks());
        setMigrationCooldowns(data.migrationCooldowns || {});
        setPopulationDetailView(data.populationDetailView || false);
        setHistory(trimHistorySnapshot(data.history || buildInitialHistory(), AUTO_SAVE_LIMITS.history));
        
        // 经济指标
        setPriceHistory(data.priceHistory || {});
        setEquilibriumPrices(data.equilibriumPrices || {});
        setEconomicIndicators(data.economicIndicators || {
            gdp: { total: 0, consumption: 0, investment: 0, government: 0, netExports: 0, change: 0 },
            cpi: { index: 100, change: 0, breakdown: {} },
            ppi: { index: 100, change: 0, breakdown: {} },
        });
        
        const parsedDaysElapsed = Number.isFinite(data.daysElapsed)
            ? data.daysElapsed
            : Number(data.daysElapsed);
        setDaysElapsed(Number.isFinite(parsedDaysElapsed) ? parsedDaysElapsed : 0);
        setArmy(data.army || {});
        setMilitaryQueue(data.militaryQueue || []);
        let loadedMilitaryCorps = (data.militaryCorps || [])
            .filter(Boolean)
            .filter((corps) => getLoadedCorpsTotalUnits(corps) > 0);
        let loadedGenerals = (data.generals || []).filter(Boolean);
        const loadedFronts = (data.activeFronts || []).map(front => ensureFrontDefaults(front));
        const playerWarNations = (migratedNations || []).filter(n => n?.isAtWar === true && !n?.isRebelNation);
        const existingActiveEnemyIds = new Set(
            loadedFronts
                .filter(front => front.status === 'active' && (front.attackerId === 'player' || front.defenderId === 'player'))
                .map(front => (front.attackerId === 'player' ? front.defenderId : front.attackerId))
        );
        const playerEco = {
            resources: data.resources || {},
            buildings: data.buildings || {},
            population: loadedPopulation || data.population || 0,
            wealth: data.resources?.silver || 0,
        };
        const rebuiltFronts = playerWarNations
            .filter(nation => !existingActiveEnemyIds.has(nation.id))
            .map(nation => {
                const enemyEco = {
                    resources: {},
                    buildings: {},
                    population: nation.population || nation.militaryPower || 200,
                    wealth: nation.wealth || 500,
                };
                const front = generateFront(nation.id, 'player', data.epoch ?? 0, enemyEco, playerEco);
                front.createdDay = data.daysElapsed || 0;
                front.startDay = data.daysElapsed || 0;
                return front;
            });

        let reconciledFronts = [...loadedFronts, ...rebuiltFronts].map(front => {
            if (front.status !== 'active') return front;
            const enemyId = front.attackerId === 'player' ? front.defenderId : front.attackerId;
            const enemyNation = (migratedNations || []).find(n => n.id === enemyId);
            if (!enemyNation || enemyNation.isAtWar !== true) {
                return { ...front, status: 'collapsed' };
            }
            return front;
        });
        const initialFrontIdSet = new Set(reconciledFronts.map((front) => front.id));
        loadedMilitaryCorps = loadedMilitaryCorps.map((corps) => {
            const assignedFrontId = initialFrontIdSet.has(corps.assignedFrontId) ? corps.assignedFrontId : null;
            return {
                ...corps,
                assignedFrontId,
                status: assignedFrontId ? 'deployed' : 'idle',
            };
        });

        let hydratedNations = (migratedNations || []).map((nation) => {
            if (!nation || nation.id === 'player') return nation;
            const syncResult = syncAINationMilitary({
                nation,
                epoch: currentEpoch,
                currentDay: parsedDaysElapsed || 0,
                militaryCorps: loadedMilitaryCorps,
                generals: loadedGenerals,
            });
            loadedMilitaryCorps = [
                ...loadedMilitaryCorps.filter((corps) => !(corps?.isAI && corps.nationId === nation.id)),
                ...syncResult.corps,
            ];
            loadedGenerals = [
                ...loadedGenerals.filter((general) => !syncResult.corps.some((corps) => corps.generalId === general.id)),
                ...syncResult.generals,
            ];
            return syncResult.nation;
        });

        const corpsIdSet = new Set(loadedMilitaryCorps.map((corps) => corps.id));
        reconciledFronts = reconciledFronts.map((front) => {
            const pruneList = (list = []) => list.filter((id) => corpsIdSet.has(id));
            return {
                ...front,
                assignedCorps: {
                    attacker: pruneList(front.assignedCorps?.attacker),
                    defender: pruneList(front.assignedCorps?.defender),
                },
                frontlineCorpsOrder: {
                    attacker: pruneList(front.frontlineCorpsOrder?.attacker),
                    defender: pruneList(front.frontlineCorpsOrder?.defender),
                },
                activeBattleId: null,
            };
        });

        for (const front of reconciledFronts) {
            if (front?.status !== 'active') continue;
            const enemyId = front.attackerId === 'player' ? front.defenderId : front.attackerId;
            const enemyNation = hydratedNations.find((nation) => nation.id === enemyId);
            if (!enemyNation) continue;
            const playerSide = front.attackerId === 'player' ? 'attacker' : 'defender';
            const enemySide = playerSide === 'attacker' ? 'defender' : 'attacker';
            const enemyCorpsOnFront = loadedMilitaryCorps.filter((corps) => corps.isAI && corps.nationId === enemyId && corps.assignedFrontId === front.id);
            if (enemyCorpsOnFront.length > 0) continue;
            const playerCorpsOnFront = loadedMilitaryCorps.filter((corps) => !corps.isAI && corps.assignedFrontId === front.id);
            const idleEnemyCorps = loadedMilitaryCorps.filter((corps) => corps.isAI && corps.nationId === enemyId && !corps.assignedFrontId);
            if (idleEnemyCorps.length <= 0) continue;
            const frontPlan = evaluateAIFrontPlan({
                nation: enemyNation,
                front,
                ownCorps: idleEnemyCorps,
                enemyCorps: playerCorpsOnFront,
            });
            const deployCount = Math.max(1, Math.min(idleEnemyCorps.length, frontPlan.desiredCorps || 1));
            const deployIds = idleEnemyCorps.slice(0, deployCount).map((corps) => corps.id);
            loadedMilitaryCorps = loadedMilitaryCorps.map((corps) => {
                if (!deployIds.includes(corps.id)) return corps;
                return {
                    ...corps,
                    assignedFrontId: front.id,
                    status: 'deployed',
                    frontTask: frontPlan.taskAssignments?.[corps.id] || corps.frontTask || 'assault',
                };
            });
            reconciledFronts = reconciledFronts.map((item) => {
                if (item.id !== front.id) return item;
                return {
                    ...item,
                    aiPosture: frontPlan.posture,
                    postures: {
                        ...(item.postures || {}),
                        [enemySide]: frontPlan.posture,
                    },
                    assignedCorps: {
                        ...item.assignedCorps,
                        [enemySide]: deployIds,
                    },
                    frontlineCorpsOrder: {
                        ...(item.frontlineCorpsOrder || {}),
                        [enemySide]: frontPlan.frontlineCorpsOrder?.length > 0 ? frontPlan.frontlineCorpsOrder : deployIds,
                    },
                };
            });
        }

        const frontStatusMap = new Map(reconciledFronts.map(front => [front.id, front.status]));
        const activeCorpsIds = new Set(loadedMilitaryCorps.map((corps) => corps.id));
        const corpsById = new Map(loadedMilitaryCorps.map((corps) => [corps.id, corps]));
        const reconciledBattles = (data.activeBattles || [])
            .map((rawBattle) => ensureBattleDefaults(rawBattle))
            .filter((battle) => {
                if (!battle || battle.status !== 'active') return false;
                if (battle.result?.finalized) return false;
                if (frontStatusMap.get(battle.frontId) !== 'active') return false;
                if (battle.currentRound >= battle.totalDays) return false;
                const attackerCorps = corpsById.get(battle.attacker?.corpsId);
                const defenderCorps = corpsById.get(battle.defender?.corpsId);
                if (!activeCorpsIds.has(battle.attacker?.corpsId) || !activeCorpsIds.has(battle.defender?.corpsId)) return false;
                return attackerCorps?.assignedFrontId === battle.frontId && defenderCorps?.assignedFrontId === battle.frontId;
            });
        const activeBattleCorps = new Set(
            reconciledBattles.flatMap((battle) => [battle.attacker?.corpsId, battle.defender?.corpsId]).filter(Boolean)
        );
        loadedMilitaryCorps = loadedMilitaryCorps.map((corps) => ({
            ...corps,
            status: activeBattleCorps.has(corps.id)
                ? 'in_combat'
                : (corps.assignedFrontId ? 'deployed' : 'idle'),
        }));
        const activeBattleIdByFront = new Map(reconciledBattles.map((battle) => [battle.frontId, battle.id]));
        reconciledFronts = reconciledFronts.map((front) => ({
            ...front,
            activeBattleId: activeBattleIdByFront.get(front.id) || null,
        }));

        setMilitaryCorps(loadedMilitaryCorps);
        setGenerals(loadedGenerals);
        setActiveFronts(reconciledFronts);
        setActiveBattles(reconciledBattles);
        setPendingRepairs(data.pendingRepairs || []);
        migratedNations = hydratedNations;
        setSelectedTarget(data.selectedTarget || null);
        setBattleResult(data.battleResult || null);
        setPlayerInstallmentPayment(data.playerInstallmentPayment || null);
        setMilitaryWageRatio(data.militaryWageRatio || 1.5);
        setAutoRecruitEnabled(data.autoRecruitEnabled || false);
        setTargetArmyComposition(data.targetArmyComposition || {});
        setFestivalModal(data.festivalModal || null);
        setActiveFestivalEffects(data.activeFestivalEffects || []);
        setLastFestivalYear(data.lastFestivalYear || 1);
        setShowTutorial(data.showTutorial ?? true);
        setCurrentEvent(data.currentEvent || null);
        setEventHistory(trimArray(data.eventHistory || [], AUTO_SAVE_LIMITS.eventHistory));
        setLogs(Array.isArray(data.logs) ? data.logs : []);
        setClicks(Array.isArray(data.clicks) ? data.clicks : []);
        setRates(data.rates || {});
        setTaxes(data.taxes || {
            total: 0,
            breakdown: { headTax: 0, industryTax: 0, subsidy: 0, policyIncome: 0, policyExpense: 0 },
            efficiency: 1,
        });
        const defaultTaxPolicies = {
            headTaxRates: buildDefaultHeadTaxRates(),
            resourceTaxRates: buildDefaultResourceTaxRates(),
            businessTaxRates: buildDefaultBusinessTaxRates(),
            exportTariffMultipliers: {},
            importTariffMultipliers: {},
            resourceTariffMultipliers: {},
        };
        const loadedTaxPolicies = data.taxPolicies || {};
        setTaxPolicies({
            ...defaultTaxPolicies,
            ...loadedTaxPolicies,
            exportTariffMultipliers: loadedTaxPolicies.exportTariffMultipliers
                ?? loadedTaxPolicies.resourceTariffMultipliers
                ?? defaultTaxPolicies.exportTariffMultipliers,
            importTariffMultipliers: loadedTaxPolicies.importTariffMultipliers
                ?? loadedTaxPolicies.resourceTariffMultipliers
                ?? defaultTaxPolicies.importTariffMultipliers,
            resourceTariffMultipliers: loadedTaxPolicies.resourceTariffMultipliers
                ?? defaultTaxPolicies.resourceTariffMultipliers,
        });
        setJobFill(data.jobFill || {});
        const loadedMarket = trimMarketSnapshot(
            data.market || buildInitialMarket(),
            AUTO_SAVE_LIMITS.marketHistory,
        );
        setMarket(loadedMarket);
        const loadedMerchantStateRaw = data.merchantState || buildInitialMerchantState();
        setMerchantState({
            ...buildInitialMerchantState(),
            ...(loadedMerchantStateRaw || {}),
            merchantAssignments: (loadedMerchantStateRaw && typeof loadedMerchantStateRaw === 'object' && loadedMerchantStateRaw.merchantAssignments && typeof loadedMerchantStateRaw.merchantAssignments === 'object')
                ? loadedMerchantStateRaw.merchantAssignments
                : (loadedMerchantStateRaw?.assignments && typeof loadedMerchantStateRaw.assignments === 'object' ? loadedMerchantStateRaw.assignments : {}),
        });
        setTradeRoutes(data.tradeRoutes || buildInitialTradeRoutes());
        setTradeStats(data.tradeStats || { tradeTax: 0, tradeRouteTax: 0 });
        setDiplomacyOrganizations(migrateDiplomacyOrganizations(data.diplomacyOrganizations));
        setVassalDiplomacyQueue(Array.isArray(data.vassalDiplomacyQueue) ? data.vassalDiplomacyQueue : []);
        setVassalDiplomacyHistory(Array.isArray(data.vassalDiplomacyHistory) ? data.vassalDiplomacyHistory : []);
        setOverseasBuildings(data.overseasBuildings || buildInitialOverseasBuildings());
        setOverseasInvestments(migrateOverseasInvestments(data.overseasInvestments || []));
        setForeignInvestments(migrateForeignInvestments(data.foreignInvestments || []));
        setForeignInvestmentPolicy(data.foreignInvestmentPolicy || 'normal');
        setAutoSaveInterval(data.autoSaveInterval ?? 60);
        setIsAutoSaveEnabled(data.isAutoSaveEnabled ?? true);
        setLastAutoSaveTime(data.lastAutoSaveTime || Date.now());
        setDifficulty(data.difficulty || DEFAULT_DIFFICULTY);
        setEmpireName(data.empireName || '我的帝国');
        setEventEffectSettings({
            ...DEFAULT_EVENT_EFFECT_SETTINGS,
            ...(data.eventEffectSettings || {}),
            logVisibility: {
                ...DEFAULT_EVENT_EFFECT_SETTINGS.logVisibility,
                ...((data.eventEffectSettings || {}).logVisibility || {}),
            },
        });
        const loadedEffects = data.activeEventEffects || {};
        setActiveEventEffects({
            approval: Array.isArray(loadedEffects.approval) ? loadedEffects.approval : [],
            stability: Array.isArray(loadedEffects.stability) ? loadedEffects.stability : [],
            resourceDemand: Array.isArray(loadedEffects.resourceDemand) ? loadedEffects.resourceDemand : [],
            stratumDemand: Array.isArray(loadedEffects.stratumDemand) ? loadedEffects.stratumDemand : [],
            buildingProduction: Array.isArray(loadedEffects.buildingProduction) ? loadedEffects.buildingProduction : [],
            forcedSubsidy: Array.isArray(loadedEffects.forcedSubsidy) ? loadedEffects.forcedSubsidy : [],
        });
        setRebellionStates(data.rebellionStates || {});
        // 如果存档没有联盟或为空数组，默认使用自耕农
        const loadedCoalition = data.rulingCoalition;
        setRulingCoalition(Array.isArray(loadedCoalition) && loadedCoalition.length > 0 ? loadedCoalition : ['peasant']);
        setLegitimacy(data.legitimacy || 0);
        setActionCooldowns(data.actionCooldowns || {});
        setActionUsage(data.actionUsage || {});
        setPromiseTasks(data.promiseTasks || []);
        setEventConfirmationEnabled(data.eventConfirmationEnabled || false);
    };

    const saveGame = async ({ source = 'manual', slotIndex = 0 } = {}) => {
        if (source === 'auto' && (autoSaveBlocked || !isAutoSaveEnabled)) {
            return;
        }
        const timestamp = Date.now();
        const { payload } = buildSavePayload({ source, timestamp });
        // Always compact saves to reduce storage usage (both manual and auto)
        const payloadToSave = compactSavePayload(payload);
        let targetKey;
        let friendlyName;

        // Helper function to clean up old saves
        const cleanupOldSaves = ({ includeAutoSave = false } = {}) => {
            try {
                // Find and remove oldest manual save slots (keep only the most recent 3)
                const saveSlots = [];
                for (let i = 0; i < SAVE_SLOT_COUNT; i++) {
                    const key = `${SAVE_SLOT_PREFIX}${i}`;
                    const data = localStorage.getItem(key);
                    if (data) {
                        try {
                            const parsed = JSON.parse(data);
                            saveSlots.push({ key, timestamp: parsed.updatedAt || 0, size: data.length });
                        } catch (e) {
                            // Invalid save, remove it
                            localStorage.removeItem(key);
                        }
                    }
                }

                // Sort by timestamp (oldest first) and remove oldest saves
                saveSlots.sort((a, b) => a.timestamp - b.timestamp);
                const toRemove = saveSlots.slice(0, Math.max(0, saveSlots.length - 3));
                toRemove.forEach(slot => {
                    localStorage.removeItem(slot.key);
                    void removeSaveFromIndexedDb(slot.key);
                    console.log(`Cleaned up old save: ${slot.key} (${(slot.size / 1024).toFixed(1)}KB)`);
                });

                let removedAuto = false;
                if (includeAutoSave && localStorage.getItem(AUTOSAVE_KEY)) {
                    localStorage.removeItem(AUTOSAVE_KEY);
                    void removeSaveFromIndexedDb(AUTOSAVE_KEY);
                    removedAuto = true;
                    console.log('Cleaned up autosave to free space.');
                }

                if (localStorage.getItem(LEGACY_SAVE_KEY)) {
                    localStorage.removeItem(LEGACY_SAVE_KEY);
                }

                return toRemove.length > 0 || removedAuto;
            } catch (e) {
                console.error('Failed to cleanup old saves:', e);
                return false;
            }
        };

        const shouldUseExternalStorage = (bytes) => hasIndexedDb() && bytes >= LOCAL_STORAGE_SOFT_LIMIT;

        const persistExternalSave = async (payloadToStore, saveSize) => {
            if (!hasIndexedDb()) {
                return false;
            }
            try {
                await writeSaveToIndexedDb(targetKey, JSON.stringify(payloadToStore));
            } catch (error) {
                console.error('External save failed:', error);
                return false;
            }

            const stub = buildExternalSaveStub(payloadToStore, { sizeBytes: saveSize.bytes });
            let stubStored = false;
            try {
                localStorage.setItem(targetKey, JSON.stringify(stub));
                stubStored = true;
            } catch (stubError) {
                const cleaned = cleanupOldSaves({ includeAutoSave: source !== 'auto' });
                if (cleaned) {
                    try {
                        localStorage.setItem(targetKey, JSON.stringify(stub));
                        stubStored = true;
                    } catch (retryError) {
                        console.warn('Failed to store external save stub:', retryError);
                    }
                }
            }

            if (!stubStored) {
                void removeSaveFromIndexedDb(targetKey);
                return false;
            }

            triggerSavingIndicator();
            if (source === 'auto') {
                setLastAutoSaveTime(timestamp);
            } else {
                addLogEntry(`💾 游戏已保存到${friendlyName}�?${saveSize.display})`);
            }
            return true;
        };

        try {

            // 确定存储 key
            if (source === 'auto') {
                targetKey = AUTOSAVE_KEY;
                friendlyName = '自动存档';
            } else {
                // 手动存档使用槽位
                const safeIndex = Math.max(0, Math.min(SAVE_SLOT_COUNT - 1, slotIndex));
                targetKey = `${SAVE_SLOT_PREFIX}${safeIndex}`;
                friendlyName = `存档 ${safeIndex + 1}`;
            }

            // Calculate and log save size
            const saveSize = calculateSaveSize(payloadToSave);
            console.log(`Attempting to save (${friendlyName}): ${saveSize.display}`);

            if (shouldUseExternalStorage(saveSize.bytes)) {
                const stored = await persistExternalSave(payloadToSave, saveSize);
                if (stored) {
                    return;
                }
            }

            localStorage.setItem(targetKey, JSON.stringify(payloadToSave));
            triggerSavingIndicator();

            if (source === 'auto') {
                setLastAutoSaveTime(timestamp);
            } else {
                addLogEntry(`💾 游戏已保存到${friendlyName}�?${saveSize.display})`);
            }
        } catch (error) {
            const isQuotaExceeded = error?.name === 'QuotaExceededError'
                || `${error?.message || ''}`.toLowerCase().includes('quota');
            if (isQuotaExceeded) {
                // On quota exceeded, try IndexedDB first (don't rely on size threshold)
                if (hasIndexedDb()) {
                    console.log('Quota exceeded - trying IndexedDB directly...');
                    const compactedPayload = compactSavePayload(payload, { aggressive: true });
                    const compactSize = calculateSaveSize(compactedPayload);
                    const stored = await persistExternalSave(compactedPayload, compactSize);
                    if (stored) {
                        addLogEntry(`⚠️ 存档空间不足，已保存到浏览器数据�?(${compactSize.display})。`);
                        return;
                    }
                }

                // Fallback: Try aggressive compaction to localStorage
                try {
                    const compactedPayload = compactSavePayload(payload, { aggressive: true });
                    const compactSize = calculateSaveSize(compactedPayload);
                    console.log(`Trying compact save: ${compactSize.display}`);

                    localStorage.setItem(targetKey, JSON.stringify(compactedPayload));
                    triggerSavingIndicator();
                    if (source === 'auto') {
                        setLastAutoSaveTime(timestamp);
                    }
                    addLogEntry(`⚠️ 存档空间不足，已使用精简存档 (${compactSize.display})。`);
                    return;
                } catch (fallbackError) {
                    console.error('Compact save failed:', fallbackError);
                }

                // Try minimal save for manual save as last resort
                if (source !== 'auto') {
                    try {
                        const minimalPayload = {
                            ...buildMinimalAutoSavePayload(payload),
                            saveSource: 'manual-minimal',
                        };
                        const minimalSize = calculateSaveSize(minimalPayload);
                        console.log(`Trying minimal manual save: ${minimalSize.display}`);

                        // Try IndexedDB first for minimal save too
                        if (hasIndexedDb()) {
                            const stored = await persistExternalSave(minimalPayload, minimalSize);
                            if (stored) {
                                addLogEntry(`⚠️ 存档已保存到浏览器数据库 (${minimalSize.display})。`);
                                return;
                            }
                        }

                        localStorage.setItem(targetKey, JSON.stringify(minimalPayload));
                        triggerSavingIndicator();
                        addLogEntry(`⚠️ 存档空间不足，已切换为最小存�?(${minimalSize.display})。`);
                        return;
                    } catch (minimalManualError) {
                        console.error('Minimal manual save failed:', minimalManualError);
                    }
                }

                // Try minimal save for auto-save
                if (source === 'auto') {
                    try {
                        const minimalPayload = buildMinimalAutoSavePayload(payload);
                        const minimalSize = calculateSaveSize(minimalPayload);
                        console.log(`Trying minimal save: ${minimalSize.display}`);

                        // Try IndexedDB first for minimal save too
                        if (hasIndexedDb()) {
                            const stored = await persistExternalSave(minimalPayload, minimalSize);
                            if (stored) {
                                setLastAutoSaveTime(timestamp);
                                return;
                            }
                        }

                        localStorage.setItem(targetKey, JSON.stringify(minimalPayload));
                        triggerSavingIndicator();
                        setLastAutoSaveTime(timestamp);
                        addLogEntry(`⚠️ 自动存档已切换为最小存�?(${minimalSize.display})。`);
                        return;
                    } catch (minimalError) {
                        console.error('Minimal auto save failed:', minimalError);
                    }
                }

                // Try cleaning up old saves and retry
                const cleaned = cleanupOldSaves({ includeAutoSave: source !== 'auto' });
                if (cleaned) {
                    try {
                        const minimalPayload = source === 'auto'
                            ? buildMinimalAutoSavePayload(payload)
                            : compactSavePayload(payload, { aggressive: true });
                        const retrySize = calculateSaveSize(minimalPayload);
                        console.log(`Retrying after cleanup: ${retrySize.display}`);

                        // Try IndexedDB first after cleanup
                        if (hasIndexedDb()) {
                            const stored = await persistExternalSave(minimalPayload, retrySize);
                            if (stored) {
                                if (source === 'auto') {
                                    setLastAutoSaveTime(timestamp);
                                }
                                addLogEntry(`⚠️ 已清理旧存档并保�?(${retrySize.display})。`);
                                return;
                            }
                        }

                        localStorage.setItem(targetKey, JSON.stringify(minimalPayload));
                        triggerSavingIndicator();
                        if (source === 'auto') {
                            setLastAutoSaveTime(timestamp);
                        }
                        addLogEntry(`⚠️ 已清理旧存档并保�?(${retrySize.display})。建议定期导出存档。`);
                        return;
                    } catch (retryError) {
                        console.error('Save failed after cleanup:', retryError);
                    }
                }

                // Remove redundant final IndexedDB attempt since we already tried it first

                // All attempts failed
                if (source === 'auto') {
                    setIsAutoSaveEnabled(false);
                    setAutoSaveBlocked(true);
                    if (!autoSaveQuotaNotifiedRef.current) {
                        autoSaveQuotaNotifiedRef.current = true;
                        addLogEntry('�?自动存档空间不足，已自动关闭。请导出存档或清理浏览器缓存�');
                    }
                    return;
                } else {
                    addLogEntry('�?存档失败：存储空间不足。请导出当前存档或清理浏览器缓存�');
                }
            } else {
                console.error(`${source === 'auto' ? 'Auto' : 'Manual'} save failed:`, error);
                if (source === 'auto') {
                    addLogEntry(`�?自动存档失败�?{error.message}`);
                } else {
                    addLogEntry(`�?存档失败�?{error.message}`);
                }
            }
            setIsSaving(false);
        }
    };

    const loadGame = async ({ source = 'manual', slotIndex = 0 } = {}) => {
        try {
            // 确定存储 key
            let targetKey;
            let friendlyName;

            if (source === 'auto' || slotIndex === -1) {
                // 加载自动存档
                targetKey = AUTOSAVE_KEY;
                friendlyName = '自动存档';
            } else {
                // 加载手动存档槽位
                const safeIndex = Math.max(0, Math.min(SAVE_SLOT_COUNT - 1, slotIndex));
                targetKey = `${SAVE_SLOT_PREFIX}${safeIndex}`;
                friendlyName = `存档 ${safeIndex + 1}`;
            }

            const rawData = localStorage.getItem(targetKey);
            if (!rawData) {
                addLogEntry(`⚠️ 未找�?{friendlyName}数据。`);
                return false;
            }

            const data = JSON.parse(rawData);
            if (isExternalSaveStub(data)) {
                if (!hasIndexedDb()) {
                    addLogEntry(`�?${friendlyName}读取失败：浏览器不支持扩展存储。`);
                    return false;
                }
                const externalRaw = await readSaveFromIndexedDb(targetKey);
                if (!externalRaw) {
                    addLogEntry(`�?${friendlyName}读取失败：外部存档数据缺失。`);
                    return false;
                }
                const externalData = typeof externalRaw === 'string'
                    ? JSON.parse(externalRaw)
                    : externalRaw;
                applyLoadedGameState(externalData);
                addLogEntry(`📂 ${friendlyName}读取成功！`);
                return true;
            }
            applyLoadedGameState(data);
            addLogEntry(`📂 ${friendlyName}读取成功！`);
            return true;
        } catch (error) {
            console.error('Load game failed:', error);
            addLogEntry(`�?读取存档失败�?{error.message}`);
            return false;
        }
    };

    /**
     * 删除指定的存�?
     * @param {number} slotIndex - 存档槽位索引�?-2为手动存档，-1为自动存档）
     * @returns {boolean} 是否删除成功
     */
    const deleteSave = ({ slotIndex = 0 } = {}) => {
        try {
            let targetKey;
            let friendlyName;

            if (slotIndex === -1) {
                // 删除自动存档
                targetKey = AUTOSAVE_KEY;
                friendlyName = '自动存档';
            } else {
                // 删除手动存档槽位
                const safeIndex = Math.max(0, Math.min(SAVE_SLOT_COUNT - 1, slotIndex));
                targetKey = `${SAVE_SLOT_PREFIX}${safeIndex}`;
                friendlyName = `存档 ${safeIndex + 1}`;
            }

            const rawData = localStorage.getItem(targetKey);
            if (!rawData) {
                addLogEntry(`⚠️ ${friendlyName}不存在，无需删除。`);
                return false;
            }

            try {
                const parsed = JSON.parse(rawData);
                if (isExternalSaveStub(parsed)) {
                    void removeSaveFromIndexedDb(targetKey);
                }
            } catch (parseError) {
                // Ignore malformed save metadata
            }

            localStorage.removeItem(targetKey);
            addLogEntry(`🗑�?${friendlyName}已删除。`);
            return true;
        } catch (error) {
            console.error('Delete save failed:', error);
            addLogEntry(`�?删除存档失败�?{error.message}`);
            return false;
        }
    };

    const exportSaveToBinary = async () => {
        if (typeof window === 'undefined' || typeof Blob === 'undefined') {
            throw new Error('导出仅支持浏览器环境');
        }
        try {
            const timestamp = Date.now();
            const { payload } = buildSavePayload({ source: 'binary-export', timestamp });
            // Compact the payload before export to reduce file size
            const compactedPayload = compactSavePayload(payload);
            let fileJson = JSON.stringify(compactedPayload);
            let note = '?? ????????????????';
            if (canObfuscate) {
                fileJson = JSON.stringify({
                    format: SAVE_FORMAT_VERSION,
                    obfuscated: true,
                    data: encodeSavePayload(compactedPayload),
                    updatedAt: compactedPayload.updatedAt,
                });
                note = '?? ?????????????????';
            }
            const blob = new Blob([fileJson], { type: 'application/octet-stream' });
            const iso = new Date(timestamp).toISOString().replace(/[:.]/g, '-');
            // 生成文件名：如果有帝国名称则包含在文件名中，否则使用默认格式
            const safeEmpireName = empireName
                ? empireName.replace(/[<>:"/\\|?*\s]/g, '_').slice(0, 20)
                : '';
            const filename = safeEmpireName
                ? `civ-save-${safeEmpireName}-${iso}.${SAVE_FILE_EXTENSION}`
                : `civ-save-${iso}.${SAVE_FILE_EXTENSION}`;

            // 检测运行环�?
            const isMobile = /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
            // 只有当运行在原生平台（iOS/Android）时才认为是 Native 环境
            // �?Web 端（包括 PC 浏览器和移动端浏览器），即使引入�?Capacitor 也是 Web 平台，支持下载链�?
            const isNative = window.Capacitor?.isNativePlatform() || false;
            console.log('[Export] Environment:', { isMobile, isNative, platform: window.Capacitor?.getPlatform() || 'web', userAgent: navigator.userAgent });

            // 方案0：原�?App 导出 (Capacitor Native)
            // 使用 Filesystem 写入缓存，然后用 Share 插件分享文件
            if (isNative) {
                try {
                    console.log('[Export] Trying Native Filesystem & Share...');
                    // 写入临时文件到缓存目�?
                    const result = await Filesystem.writeFile({
                        path: filename,
                        data: fileJson,
                        directory: Directory.Cache,
                        encoding: Encoding.UTF8,
                    });

                    console.log('[Export] File written to:', result.uri);

                    // 调用原生系统分享
                    await Share.share({
                        title: '导出存档',
                        text: `文明崛起存档: ${filename}`,
                        url: result.uri,
                        dialogTitle: '???????',
                    });

                    addLogEntry('📤 存档已导出！');
                    return true;
                } catch (nativeError) {
                    console.error('[Export] Native export failed:', nativeError);
                    if (nativeError.message !== 'Share canceled') {
                        addLogEntry(`⚠️ 原生导出出错: ${nativeError.message}，尝试使用剪贴板。`);
                    } else {
                        return false; // 用户取消
                    }
                    // 如果失败，继续执行后备方案（主要是剪贴板�?
                }
            }

            // 方案1：Web Share API（支持分享文件的设备，仅限移动端 Web�?
            // �?PC 端尝�?Share API 可能会消耗用户手势，导致后续的下载被拦截，所以仅在移动端启用
            if (isMobile && navigator.share && navigator.canShare) {
                try {
                    const file = new File([blob], filename, { type: 'application/octet-stream' });
                    const shareData = { files: [file] };

                    if (navigator.canShare(shareData)) {
                        console.log('[Export] Trying Web Share API with file...');
                        await navigator.share(shareData);
                        addLogEntry('📤 存档已通过分享导出�');
                        return true;
                    }
                } catch (shareError) {
                    if (shareError.name === 'AbortError') {
                        addLogEntry('ℹ️ 已取消分享�');
                        return false;
                    }
                    console.warn('[Export] Share API with file failed:', shareError);
                }
            }

            // 方案2：桌面浏览器下载（非移动�?Web端）
            // 优先尝试下载文件，这是最符合用户预期�?导出到文�?的行�?
            // 即使�?Capacitor Web 版（PC浏览器），isNative 也是 false，可以下�?
            if (!isNative) {
                try {
                    console.log('[Export] Trying download link...');
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = filename;
                    link.style.display = 'none';
                    document.body.appendChild(link);
                    await new Promise(resolve => setTimeout(resolve, 100));
                    link.click();
                    setTimeout(() => {
                        document.body.removeChild(link);
                        URL.revokeObjectURL(url);
                    }, 1000);
                    addLogEntry(note);
                    return true;
                } catch (downloadError) {
                    console.warn('[Export] Download link failed:', downloadError);
                }
            }

            // 方案3：剪贴板 API（作为后备方案）
            if (navigator.clipboard && navigator.clipboard.writeText) {
                try {
                    console.log('[Export] Trying Clipboard API...');
                    await navigator.clipboard.writeText(fileJson);
                    addLogEntry('📋 存档数据已复制到剪贴板！请粘贴保存到备忘录或文本文件�');
                    return true;
                } catch (clipboardError) {
                    console.warn('[Export] Clipboard API failed:', clipboardError);
                }
            }

            // 方案4（最终保底）：弹窗提示用户手动复�?
            console.log('[Export] Falling back to prompt...');
            // 缩短存档数据用于显示（太长会导致弹窗问题�?
            const shortData = fileJson.length > 500
                ? fileJson.substring(0, 500) + '...[数据已截断，请使用下方完整复制]'
                : fileJson;

            // 创建一个隐藏的 textarea 用于复制
            const textarea = document.createElement('textarea');
            textarea.value = fileJson;
            textarea.style.position = 'fixed';
            textarea.style.left = '-9999px';
            textarea.style.top = '0';
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();

            try {
                const copied = document.execCommand('copy');
                document.body.removeChild(textarea);
                if (copied) {
                    addLogEntry('📋 存档数据已复制到剪贴板！请粘贴保存到备忘录�');
                    alert('存档数据已复制到剪贴板！\n\n请打开备忘录或其他文本应用，粘贴保存�');
                    return true;
                }
            } catch (execError) {
                document.body.removeChild(textarea);
                console.warn('[Export] execCommand copy failed:', execError);
            }

            // 如果所有方案都失败，显示存档数据让用户手动复制
            addLogEntry('⚠️ 自动导出失败，请手动复制存档数据�');
            const userCopied = window.prompt(
                '自动导出失败。请手动长按下方文本全选复制，保存到备忘录：\n（文本很长，请确保全部复制）',
                fileJson
            );

            if (userCopied !== null) {
                addLogEntry('📋 请确保已复制完整存档数据�');
                return true;
            }

            return false;
        } catch (error) {
            console.error('Export save failed:', error);
            addLogEntry(`�?导出存档失败�?{error.message}`);
            throw error;
        }
    };

    // 导出存档到剪贴板
    const exportSaveToClipboard = async () => {
        try {
            const timestamp = Date.now();
            const { payload } = buildSavePayload({ source: 'clipboard-export', timestamp });
            let fileJson = JSON.stringify(payload);
            if (canObfuscate) {
                fileJson = JSON.stringify({
                    format: SAVE_FORMAT_VERSION,
                    obfuscated: true,
                    data: encodeSavePayload(payload),
                    updatedAt: payload.updatedAt,
                });
            }

            // 尝试使用 Clipboard API
            if (navigator.clipboard && navigator.clipboard.writeText) {
                try {
                    await navigator.clipboard.writeText(fileJson);
                    addLogEntry('📋 存档已复制到剪贴板！');
                    return true;
                } catch (clipboardError) {
                    console.warn('[Export] Clipboard API failed:', clipboardError);
                }
            }

            // 回退方案：使�?execCommand
            const textarea = document.createElement('textarea');
            textarea.value = fileJson;
            textarea.style.position = 'fixed';
            textarea.style.left = '-9999px';
            textarea.style.top = '0';
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();

            try {
                const copied = document.execCommand('copy');
                document.body.removeChild(textarea);
                if (copied) {
                    addLogEntry('📋 存档已复制到剪贴板！');
                    return true;
                }
            } catch (execError) {
                document.body.removeChild(textarea);
                console.warn('[Export] execCommand copy failed:', execError);
            }

            throw new Error('无法复制到剪贴板');
        } catch (error) {
            console.error('Export to clipboard failed:', error);
            addLogEntry(`�?复制失败�?{error.message}`);
            throw error;
        }
    };

    const persistImportedSave = async (payload, targetKey) => {
        const size = calculateSaveSize(payload);
        const storeStub = (stub) => {
            try {
                localStorage.setItem(targetKey, JSON.stringify(stub));
                return true;
            } catch (error) {
                return false;
            }
        };

        const saveToIndexedDb = async () => {
            await writeSaveToIndexedDb(targetKey, JSON.stringify(payload));
            const stub = buildExternalSaveStub(payload, { sizeBytes: size.bytes });
            const stubStored = storeStub(stub);
            if (!stubStored) {
                await removeSaveFromIndexedDb(targetKey);
                throw new Error('External stub storage failed');
            }
            return { stored: true, external: true, size };
        };

        if (hasIndexedDb() && size.bytes >= LOCAL_STORAGE_SOFT_LIMIT) {
            try {
                return await saveToIndexedDb();
            } catch (error) {
                console.warn('[Import] External storage failed:', error);
            }
        }

        try {
            localStorage.setItem(targetKey, JSON.stringify(payload));
            return { stored: true, external: false, size };
        } catch (error) {
            if (hasIndexedDb()) {
                return await saveToIndexedDb();
            }
            throw error;
        }
    };

    const importSaveFromBinary = async (fileOrBuffer) => {
        try {
            if (!fileOrBuffer) {
                throw new Error('请选择有效的存档文�');
            }
            if (!textDecoder) {
                throw new Error('当前环境不支持解析存档文�');
            }
            let buffer;
            if (fileOrBuffer instanceof ArrayBuffer) {
                buffer = fileOrBuffer;
            } else if (fileOrBuffer instanceof Uint8Array) {
                buffer = fileOrBuffer.buffer;
            } else if (typeof fileOrBuffer.arrayBuffer === 'function') {
                buffer = await fileOrBuffer.arrayBuffer();
            } else {
                throw new Error('无法解析的文件类�');
            }
            const jsonString = textDecoder.decode(buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer));
            const parsed = JSON.parse(jsonString);
            const processed = parsed && parsed.obfuscated && parsed.data
                ? decodeSavePayload(parsed.data)
                : parsed;
            const normalized = {
                ...processed,
                saveFormatVersion: processed.saveFormatVersion || parsed.format || SAVE_FORMAT_VERSION,
                saveSource: 'binary-import',
                updatedAt: processed.updatedAt || parsed.updatedAt || Date.now(),
                lastAutoSaveTime: processed.lastAutoSaveTime || lastAutoSaveTime || Date.now(),
            };

            // Helper function to check quota error
            const isQuotaExceeded = (err) => err?.name === 'QuotaExceededError'
                || `${err?.message || ''}`.toLowerCase().includes('quota');

            // Try to save, with fallback compression for quota issues
            const targetKey = `${SAVE_SLOT_PREFIX}0`;
            try {
                await persistImportedSave(normalized, targetKey);
            } catch (saveError) {
                if (isQuotaExceeded(saveError)) {
                    // First fallback: aggressive compact
                    console.warn('[Import] Quota exceeded, trying aggressive compact...');
                    try {
                        const compactedPayload = compactSavePayload(normalized, { aggressive: true });
                        await persistImportedSave(compactedPayload, targetKey);
                        addLogEntry('⚠️ 存档空间不足，已使用精简导入�');
                    } catch (compactError) {
                        if (isQuotaExceeded(compactError)) {
                            // Second fallback: minimal payload
                            console.warn('[Import] Compact failed, trying minimal payload...');
                            try {
                                const minimalPayload = buildMinimalAutoSavePayload(normalized);
                                await persistImportedSave(minimalPayload, targetKey);
                                addLogEntry('⚠️ 存档空间严重不足，已使用最小导入（部分历史数据丢失）�');
                            } catch (minimalError) {
                                // Final fallback: clear old saves and retry
                                console.warn('[Import] Minimal failed, clearing old saves...');
                                try {
                                    localStorage.removeItem(AUTOSAVE_KEY);
                                    const minimalPayload = buildMinimalAutoSavePayload(normalized);
                                    await persistImportedSave(minimalPayload, targetKey);
                                    addLogEntry('⚠️ 已清理自动存档以腾出空间，导入成功�');
                                } catch (finalError) {
                                    throw new Error('存储空间已满，无法导入存档。请在浏览器设置中清理网站数据或删除现有存档后重试�');
                                }
                            }
                        } else {
                            throw compactError;
                        }
                    }
                } else {
                    throw saveError;
                }
            }

            applyLoadedGameState(normalized);
            addLogEntry('📥 已从备份文件导入存档�');
            return true;
        } catch (error) {
            console.error('Import save failed:', error);
            addLogEntry(`�?导入存档失败�?{error.message}`);
            throw error;
        }
    };

    // 从文�?剪贴板导入存�?
    const importSaveFromText = async (textInput = null) => {
        try {
            let jsonString = textInput;

            // 如果没有传入文本，尝试从剪贴板读取或弹窗让用户粘�?
            if (!jsonString) {
                // 方案1：尝试从剪贴板读�?
                if (navigator.clipboard && navigator.clipboard.readText) {
                    try {
                        jsonString = await navigator.clipboard.readText();
                        if (jsonString && jsonString.trim()) {
                            console.log('[Import] Read from clipboard, length:', jsonString.length);
                        }
                    } catch (clipboardError) {
                        console.warn('[Import] Clipboard read failed:', clipboardError);
                    }
                }

                // 方案2：如果剪贴板读取失败或为空，弹窗让用户粘�?
                if (!jsonString || !jsonString.trim()) {
                    jsonString = window.prompt(
                        '请粘贴存档数据：\n（长按输入框，选择粘贴�',
                        ''
                    );
                    if (jsonString === null) {
                        addLogEntry('ℹ️ 已取消导入�');
                        return false;
                    }
                }
            }

            if (!jsonString || !jsonString.trim()) {
                throw new Error('存档数据为空');
            }

            // 解析 JSON
            const parsed = JSON.parse(jsonString.trim());
            const processed = parsed && parsed.obfuscated && parsed.data
                ? decodeSavePayload(parsed.data)
                : parsed;

            const normalized = {
                ...processed,
                saveFormatVersion: processed.saveFormatVersion || parsed.format || SAVE_FORMAT_VERSION,
                saveSource: 'text-import',
                updatedAt: processed.updatedAt || parsed.updatedAt || Date.now(),
                lastAutoSaveTime: processed.lastAutoSaveTime || lastAutoSaveTime || Date.now(),
            };

            // Helper function to check quota error
            const isQuotaExceeded = (err) => err?.name === 'QuotaExceededError'
                || `${err?.message || ''}`.toLowerCase().includes('quota');

            // Try to save, with fallback compression for quota issues
            const targetKey = `${SAVE_SLOT_PREFIX}0`;
            try {
                await persistImportedSave(normalized, targetKey);
            } catch (saveError) {
                if (isQuotaExceeded(saveError)) {
                    // First fallback: aggressive compact
                    console.warn('[Import] Quota exceeded, trying aggressive compact...');
                    try {
                        const compactedPayload = compactSavePayload(normalized, { aggressive: true });
                        await persistImportedSave(compactedPayload, targetKey);
                        addLogEntry('⚠️ 存档空间不足，已使用精简导入�');
                    } catch (compactError) {
                        if (isQuotaExceeded(compactError)) {
                            // Second fallback: minimal payload
                            console.warn('[Import] Compact failed, trying minimal payload...');
                            try {
                                const minimalPayload = buildMinimalAutoSavePayload(normalized);
                                await persistImportedSave(minimalPayload, targetKey);
                                addLogEntry('⚠️ 存档空间严重不足，已使用最小导入（部分历史数据丢失）�');
                            } catch (minimalError) {
                                // Final fallback: clear old saves and retry
                                console.warn('[Import] Minimal failed, clearing old saves...');
                                try {
                                    localStorage.removeItem(AUTOSAVE_KEY);
                                    const minimalPayload = buildMinimalAutoSavePayload(normalized);
                                    await persistImportedSave(minimalPayload, targetKey);
                                    addLogEntry('⚠️ 已清理自动存档以腾出空间，导入成功�');
                                } catch (finalError) {
                                    throw new Error('存储空间已满，无法导入存档。请在浏览器设置中清理网站数据或删除现有存档后重试�');
                                }
                            }
                        } else {
                            throw compactError;
                        }
                    }
                } else {
                    throw saveError;
                }
            }

            applyLoadedGameState(normalized);
            addLogEntry('📥 已从剪贴板导入存档！');
            return true;
        } catch (error) {
            console.error('Import from text failed:', error);
            if (error instanceof SyntaxError) {
                addLogEntry('�?导入失败：存档数据格式无效，请确保完整复制�');
            } else {
                addLogEntry(`�?导入存档失败�?{error.message}`);
            }
            throw error;
        }
    };

    // 开始新游戏（不删除现有存档�?
    const resetGame = (options = null) => {
        if (typeof window === 'undefined') {
            return;
        }
        const normalized = typeof options === 'string'
            ? { difficulty: options }
            : (options || {});
        // 标记为新游戏模式，启动时不加载任何存�?
        localStorage.setItem('start_new_game', 'true');
        // 如果指定了难度，保存�?localStorage 以便新游戏启动时使用
        if (normalized.difficulty) {
            localStorage.setItem('new_game_difficulty', normalized.difficulty);
        }
        if (normalized.scenarioId) {
            localStorage.setItem('new_game_scenario', normalized.scenarioId);
        }
        // 如果指定了帝国名称，保存�?localStorage 以便新游戏启动时使用
        if (normalized.empireName) {
            localStorage.setItem('new_game_empire_name', normalized.empireName);
        }
        window.location.reload();
    };

    const unlockAchievement = (achievement) => {
        if (!achievement?.id) return;
        setUnlockedAchievements(prev => {
            if (prev.some(item => item.id === achievement.id)) return prev;
            const unlockedAt = Date.now();
            const next = [...prev, { id: achievement.id, unlockedAt }];
            if (typeof window !== 'undefined') {
                try {
                    localStorage.setItem(ACHIEVEMENT_STORAGE_KEY, JSON.stringify(next));
                } catch (error) {
                    console.warn('Failed to save achievements:', error);
                }
            }
            setAchievementNotifications(list => [
                ...list,
                {
                    id: `${achievement.id}-${unlockedAt}`,
                    name: achievement.name,
                    description: achievement.description,
                    icon: achievement.icon,
                },
            ]);
            return next;
        });
    };

    const incrementAchievementProgress = (key, amount = 1) => {
        if (!key) return;
        setAchievementProgress(prev => {
            const nextValue = (prev?.[key] || 0) + amount;
            const next = { ...(prev || {}), [key]: nextValue };
            if (typeof window !== 'undefined') {
                try {
                    localStorage.setItem(ACHIEVEMENT_PROGRESS_KEY, JSON.stringify(next));
                } catch (error) {
                    console.warn('Failed to save achievement progress:', error);
                }
            }
            return next;
        });
    };

    const dismissAchievementNotification = (notificationId) => {
        setAchievementNotifications(prev => prev.filter(item => item.id !== notificationId));
    };

    const hasAutoSave = () => {
        if (typeof window === 'undefined') return false;
        return !!localStorage.getItem(AUTOSAVE_KEY);
    };

    // 返回所有状态和更新函数
    return {
        // 资源
        resources,
        setResources,
        treasuryChangeLog,
        resourceChangeLog,
        market,
        setMarket,

        // 人口
        population,
        setPopulation,
        popStructure,
        setPopStructure,
        maxPop,
        setMaxPop,
        maxPopBonus,
        setMaxPopBonus,
        birthAccumulator,
        setBirthAccumulator,

        // 建筑与科技
        buildings,
        setBuildings,
        buildingUpgrades,
        setBuildingUpgrades,
        techsUnlocked,
        setTechsUnlocked,
        epoch,
        setEpoch,
        daysElapsed,
        setDaysElapsed,

        // 游戏控制
        activeTab,
        setActiveTab,
        gameSpeed,
        setGameSpeed,
        isPaused,
        setIsPaused,
        pausedBeforeEvent,
        setPausedBeforeEvent,
        autoSaveInterval,
        setAutoSaveInterval,
        isAutoSaveEnabled,
        setIsAutoSaveEnabled,
        lastAutoSaveTime,
        setLastAutoSaveTime,
        isSaving,
        difficulty,
        setDifficulty,

        // 政令与外�?
        nations,
        setNations,
        diplomaticReputation,
        setDiplomaticReputation,
        selectedTarget,
        setSelectedTarget,

        // 官员系统 (新增)
        officials,
        setOfficials,
        officialsSimCursor,
        setOfficialsSimCursor,
        officialCandidates,
        setOfficialCandidates,
        lastSelectionDay,
        setLastSelectionDay,
        officialCapacity,
        setOfficialCapacity,
        ministerAssignments,
        setMinisterAssignments,
        ministerAutoExpansion,
        setMinisterAutoExpansion,
        lastMinisterExpansionDay,
        setLastMinisterExpansionDay,
        // 内阁协同系统
        decrees,
        setDecrees,
        activeDecrees,
        setActiveDecrees,
        decreeCooldowns,
        setDecreCooldowns,
        // Alias with correct spelling for callers
        setDecreeCooldowns: setDecreCooldowns,
        quotaTargets,
        setQuotaTargets,
        expansionSettings,
        setExpansionSettings,
        priceControls,
        setPriceControls,

        // 社会阶层
        classApproval,
        setClassApproval,
        approvalBreakdown,
        setApprovalBreakdown,
        classInfluence,
        setClassInfluence,
        classWealth,
        setClassWealth,
        classWealthChangeLog,
        classWealthDelta,
        setClassWealthDelta,
        classIncome,
        setClassIncome,
        classExpense,
        setClassExpense,
        classFinancialData,
        setClassFinancialData,
        buildingFinancialData,
        setBuildingFinancialData,
        classWealthHistory,
        setClassWealthHistory,
        classNeedsHistory,
        setClassNeedsHistory,
        totalInfluence,
        setTotalInfluence,
        totalWealth,
        setTotalWealth,
        activeBuffs,
        setActiveBuffs,
        activeDebuffs,
        setActiveDebuffs,
        classInfluenceShift,
        setClassInfluenceShift,
        stability,
        setStability,
        stratumDetailView,
        setStratumDetailView,
        resourceDetailView,
        setResourceDetailView,
        classShortages,
        setClassShortages,
        classLivingStandard,
        setClassLivingStandard,
        livingStandardStreaks,
        setLivingStandardStreaks,
        migrationCooldowns,
        setMigrationCooldowns,
        taxShock,
        setTaxShock,
        populationDetailView,
        setPopulationDetailView,
        history,
        setHistory,
        
        // 经济指标
        priceHistory,
        setPriceHistory,
        equilibriumPrices,
        setEquilibriumPrices,
        economicIndicators,
        setEconomicIndicators,
        
        eventEffectSettings,
        setEventEffectSettings,
        activeEventEffects,
        setActiveEventEffects,

        // 财政（实际口径）
        fiscalActual,
        setFiscalActual,

        // 军事系统
        army,
        setArmy,
        militaryQueue,
        setMilitaryQueue,
        battleResult,
        setBattleResult,
        battleNotifications,
        setBattleNotifications,
        militaryWageRatio,
        setMilitaryWageRatio,
        autoRecruitEnabled,
        setAutoRecruitEnabled,
        targetArmyComposition,
        setTargetArmyComposition,
        lastBattleTargetId,
        setLastBattleTargetId,
        lastBattleDay,
        setLastBattleDay,
        militaryCorps,
        setMilitaryCorps,
        generals,
        setGenerals,
        activeFronts,
        setActiveFronts,
        activeBattles,
        setActiveBattles,
        pendingRepairs,
        setPendingRepairs,

        // 庆典系统
        festivalModal,
        setFestivalModal,
        activeFestivalEffects,
        setActiveFestivalEffects,
        lastFestivalYear,
        setLastFestivalYear,

        // 商人交易系统
        merchantState,
        setMerchantState,

        // 贸易路线系统
        tradeRoutes,
        setTradeRoutes,
        tradeStats,
        setTradeStats,
        diplomacyOrganizations,
        setDiplomacyOrganizations,
        vassalDiplomacyQueue,
        setVassalDiplomacyQueue,
        vassalDiplomacyHistory,
        setVassalDiplomacyHistory,
        overseasInvestments,
        setOverseasInvestments,
        foreignInvestments,
        setForeignInvestments, // [FIX] Expose setter
        foreignInvestmentPolicy,
        setForeignInvestmentPolicy,
        setOverseasBuildings, setOverseasBuildings,

        // 策略行动
        actionCooldowns,
        setActionCooldowns,
        actionUsage,
        setActionUsage,
        promiseTasks,
        setPromiseTasks,

        // 教程系统
        showTutorial,
        setShowTutorial,

        // 事件系统
        currentEvent,
        setCurrentEvent,
        eventHistory,
        setEventHistory,
        unlockedAchievements,
        setUnlockedAchievements,
        achievementNotifications,
        unlockAchievement,
        dismissAchievementNotification,
        achievementProgress,
        incrementAchievementProgress,

        // 和平协议
        playerInstallmentPayment,
        setPlayerInstallmentPayment,

        // 叛乱系统
        rebellionStates,
        setRebellionStates,

        // 执政联盟
        rulingCoalition,
        setRulingCoalition,
        legitimacy,
        setLegitimacy,

        // Modifiers
        modifiers,
        setModifiers,

        // UI
        logs,
        setLogs,
        clicks,
        setClicks,
        rates,
        setRates,
        taxes,
        setTaxes,
        taxPolicies,
        setTaxPolicies,
        jobFill,
        setJobFill,
        jobsAvailable,
        setJobsAvailable,
        buildingJobsRequired,
        setBuildingJobsRequired,
        saveGame,
        loadGame,
        deleteSave,
        exportSaveToBinary,
        exportSaveToClipboard,
        importSaveFromBinary,
        importSaveFromText,
        hasAutoSave,
        resetGame,
        eventConfirmationEnabled,
        setEventConfirmationEnabled,
        // 国家/帝国名称
        empireName,
        setEmpireName,
        // 财政数据
        fiscalActual,
        setFiscalActual,
        dailyMilitaryExpense,
        setDailyMilitaryExpense,
    };
};

