// 游戏状态管理钩子
// 集中管理所有游戏状态，避免App.jsx中状态定义过多

import { useEffect, useRef, useState } from 'react';
import { COUNTRIES, DEFAULT_VASSAL_STATUS, RESOURCES, STRATA } from '../config';
import { isOldUpgradeFormat, migrateUpgradesToNewFormat } from '../utils/buildingUpgradeUtils';
import { migrateAllOfficialsForInvestment } from '../logic/officials/migration';
import { DEFAULT_DIFFICULTY, getDifficultyConfig, getStartingSilverMultiplier, getInitialBuildings } from '../config/difficulty';
import { getScenarioById } from '../config/scenarios';
import { Share } from '@capacitor/share';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

// 多存档槽位系统
const SAVE_SLOT_COUNT = 3; // 手动存档槽位数量
const SAVE_SLOT_PREFIX = 'civ_game_save_slot_';
const AUTOSAVE_KEY = 'civ_game_autosave_v1';
const SAVE_FORMAT_VERSION = 1;
const SAVE_FILE_EXTENSION = 'cgsave';
const SAVE_OBFUSCATION_KEY = 'civ_game_simple_mask_v1';

// 兼容旧存档的 key（用于迁移）
const LEGACY_SAVE_KEY = 'civ_game_save_data_v1';
const ACHIEVEMENT_STORAGE_KEY = 'civ_game_achievements_v1';
const ACHIEVEMENT_PROGRESS_KEY = 'civ_game_achievement_progress_v1';

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
 * 获取所有存档槽位信息
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
                    updatedAt: data.updatedAt,
                    daysElapsed: data.daysElapsed || 0,
                    epoch: data.epoch || 0,
                    population: data.population || 0,
                    difficulty: data.difficulty || DEFAULT_DIFFICULTY,
                    difficultyName: diffConfig?.name || '普通',
                    difficultyIcon: diffConfig?.icon || '⚖️',
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
                updatedAt: data.updatedAt,
                daysElapsed: data.daysElapsed || 0,
                epoch: data.epoch || 0,
                population: data.population || 0,
                difficulty: data.difficulty || DEFAULT_DIFFICULTY,
                difficultyName: diffConfig?.name || '普通',
                difficultyIcon: diffConfig?.icon || '⚖️',
            });
        } catch (e) {
            // 自动存档损坏，忽略
        }
    }

    return slots;
};

const textEncoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
const textDecoder = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null;

const toBase64 = (arrayBuffer) => {
    if (typeof window === 'undefined') {
        if (typeof Buffer !== 'undefined') {
            return Buffer.from(arrayBuffer).toString('base64');
        }
        throw new Error('Base64 编码不可用');
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
        throw new Error('Base64 解码不可用');
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
    if (!canObfuscate) throw new Error('当前环境不支持写入混淆存档');
    const jsonBytes = textEncoder.encode(JSON.stringify(payload));
    const keyBytes = textEncoder.encode(SAVE_OBFUSCATION_KEY);
    const masked = new Uint8Array(jsonBytes.length);
    for (let i = 0; i < jsonBytes.length; i += 1) {
        masked[i] = jsonBytes[i] ^ keyBytes[i % keyBytes.length];
    }
    return toBase64(masked.buffer);
};

const decodeSavePayload = (encoded) => {
    if (!canObfuscate) throw new Error('当前环境不支持读取混淆存档');
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

const AUTO_SAVE_LIMITS = {
    history: 30,
    classHistory: 30,
    eventHistory: 30,
    classSeries: 30,
    marketHistory: 30,
};

const AUTO_SAVE_AGGRESSIVE_LIMITS = {
    history: 10,
    classHistory: 10,
    eventHistory: 10,
    classSeries: 10,
    marketHistory: 10,
};

const trimArray = (value, limit) => (Array.isArray(value) ? value.slice(-limit) : value);

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

// [NEW] 迁移旧版海外投资数据（从 input/output 到 strategy）
const migrateOverseasInvestments = (investments) => {
    if (!Array.isArray(investments)) return [];
    return investments.map(inv => {
        // 如果已有 strategy 且有效，则跳过
        if (inv.strategy) return inv;

        const newInv = { ...inv };
        if (inv.outputDest === 'home') {
            newInv.strategy = 'RESOURCE_EXTRACTION';
        } else if (inv.inputSource === 'home') {
            newInv.strategy = 'MARKET_DUMPING';
        } else {
            newInv.strategy = 'PROFIT_MAX';
        }
        return newInv;
    });
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
    const compacted = {
        ...payload,
        history: trimHistorySnapshot(payload.history, limits.history),
        classWealthHistory: trimClassSeriesMap(payload.classWealthHistory, limits.classSeries),
        classNeedsHistory: trimClassSeriesMap(payload.classNeedsHistory, limits.classSeries),
        market: trimMarketSnapshot(payload.market, limits.marketHistory),
        eventHistory: trimArray(payload.eventHistory, limits.eventHistory),
        clicks: [],
    };
    if (aggressive) {
        compacted.history = buildInitialHistory();
        compacted.classWealthHistory = buildInitialWealthHistory();
        compacted.classNeedsHistory = buildInitialNeedsHistory();
        compacted.eventHistory = [];
        compacted.logs = [];
    }
    return compacted;
};

const buildMinimalAutoSavePayload = (payload) => ({
    saveFormatVersion: payload.saveFormatVersion,
    resources: payload.resources,
    population: payload.population,
    popStructure: payload.popStructure,
    maxPop: payload.maxPop,
    maxPopBonus: payload.maxPopBonus,
    birthAccumulator: payload.birthAccumulator,
    buildings: payload.buildings,
    buildingUpgrades: payload.buildingUpgrades,
    techsUnlocked: payload.techsUnlocked,
    epoch: payload.epoch,
    activeTab: payload.activeTab,
    gameSpeed: payload.gameSpeed,
    isPaused: payload.isPaused,
    nations: payload.nations,
    classApproval: payload.classApproval,
    classInfluence: payload.classInfluence,
    classWealth: payload.classWealth,
    classWealthDelta: payload.classWealthDelta,
    classIncome: payload.classIncome,
    classExpense: payload.classExpense,
    classFinancialData: payload.classFinancialData,
    totalInfluence: payload.totalInfluence,
    totalWealth: payload.totalWealth,
    activeBuffs: payload.activeBuffs,
    activeDebuffs: payload.activeDebuffs,
    classInfluenceShift: payload.classInfluenceShift,
    stability: payload.stability,
    classShortages: payload.classShortages,
    classLivingStandard: payload.classLivingStandard,
    livingStandardStreaks: payload.livingStandardStreaks,
    migrationCooldowns: payload.migrationCooldowns,
    daysElapsed: payload.daysElapsed,
    army: payload.army,
    militaryQueue: payload.militaryQueue,
    selectedTarget: payload.selectedTarget,
    battleResult: payload.battleResult,
    playerInstallmentPayment: payload.playerInstallmentPayment,
    autoRecruitEnabled: payload.autoRecruitEnabled,
    targetArmyComposition: payload.targetArmyComposition,
    militaryWageRatio: payload.militaryWageRatio,
    lastBattleTargetId: payload.lastBattleTargetId,
    lastBattleDay: payload.lastBattleDay,
    activeFestivalEffects: payload.activeFestivalEffects,
    lastFestivalYear: payload.lastFestivalYear,
    showTutorial: payload.showTutorial,
    currentEvent: payload.currentEvent,
    taxes: payload.taxes,
    taxPolicies: payload.taxPolicies,
    jobFill: payload.jobFill,
    market: payload.market,
    merchantState: payload.merchantState,
    tradeRoutes: payload.tradeRoutes,
    tradeStats: payload.tradeStats,
    diplomacyOrganizations: payload.diplomacyOrganizations,
    vassalDiplomacyQueue: payload.vassalDiplomacyQueue,
    vassalDiplomacyHistory: payload.vassalDiplomacyHistory,
    overseasBuildings: payload.overseasBuildings,
    foreignInvestmentPolicy: payload.foreignInvestmentPolicy,
    eventEffectSettings: payload.eventEffectSettings,
    activeEventEffects: payload.activeEventEffects,
    rebellionStates: payload.rebellionStates,
    rulingCoalition: payload.rulingCoalition,
    legitimacy: payload.legitimacy,
    actionCooldowns: payload.actionCooldowns,
    actionUsage: payload.actionUsage,
    promiseTasks: payload.promiseTasks,
    autoSaveInterval: payload.autoSaveInterval,
    isAutoSaveEnabled: payload.isAutoSaveEnabled,
    lastAutoSaveTime: payload.lastAutoSaveTime,
    difficulty: payload.difficulty,
    updatedAt: payload.updatedAt,
    saveSource: payload.saveSource,
    officials: payload.officials,
    officialCandidates: payload.officialCandidates,
    lastSelectionDay: payload.lastSelectionDay,
    officialCapacity: payload.officialCapacity,
    activeDecrees: payload.activeDecrees,
    decreeCooldowns: payload.decreeCooldowns,
    quotaTargets: payload.quotaTargets,
    expansionSettings: payload.expansionSettings,
    priceControls: payload.priceControls,  // [NEW] 价格管制状态
    taxShock: payload.taxShock,  // [NEW] 累积税收冲击状态
    eventConfirmationEnabled: payload.eventConfirmationEnabled,
    dailyMilitaryExpense: payload.dailyMilitaryExpense, // [FIX] 每日军费数据
});

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

// 初始化贸易路线状态
const buildInitialTradeRoutes = () => ({
    // 贸易路线数组，每个路线包含：
    // { nationId, resource, type: 'import'|'export', createdAt }
    routes: [],
});

const buildInitialDiplomacyOrganizations = () => ({
    organizations: [],
});

const buildInitialOverseasBuildings = () => ([]);

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
    // 默认所有建筑营业税为0（不收税也不补贴）
    return rates;
};

const buildInitialNations = () => {
    return COUNTRIES.map(nation => {
        // 初始化库存：基于资源偏差，围绕目标库存500波动
        const inventory = {};
        const targetInventory = 500;
        if (nation.economyTraits?.resourceBias) {
            Object.entries(nation.economyTraits.resourceBias).forEach(([resourceKey, bias]) => {
                // 使用与 aiEconomy.js 一致的目标库存公式
                const dynamicTarget = Math.round(500 * Math.pow(bias, 1.2));
                if (bias > 1) {
                    // 特产资源：高库存，在目标值的1.0-1.5倍之间（已经很高了）
                    inventory[resourceKey] = Math.floor(dynamicTarget * (1.0 + Math.random() * 0.5));
                } else if (bias < 1) {
                    // 稀缺资源：低库存，在目标值的0.3-0.6倍之间
                    inventory[resourceKey] = Math.floor(dynamicTarget * (0.3 + Math.random() * 0.3));
                } else {
                    // 中性资源：中等库存，在目标值的0.8-1.2倍之间
                    inventory[resourceKey] = Math.floor(dynamicTarget * (0.8 + Math.random() * 0.4));
                }
            });
        }

        // 初始化预算：基于财富
        const wealth = nation.wealth ?? 800;
        const budget = Math.floor(wealth * 0.5);
        const appearEpoch = nation.appearEpoch ?? 0;
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

        // 初始化基础人口（用于战后恢复）
        const basePopulation = 1000 + Math.floor(Math.random() * 500); // 1000-1500
        const vassalStatus = {
            vassalOf: Object.prototype.hasOwnProperty.call(nation, 'vassalOf')
                ? nation.vassalOf
                : DEFAULT_VASSAL_STATUS.vassalOf,
            vassalType: Object.prototype.hasOwnProperty.call(nation, 'vassalType')
                ? nation.vassalType
                : DEFAULT_VASSAL_STATUS.vassalType,
            autonomy: Number.isFinite(nation.autonomy)
                ? nation.autonomy
                : DEFAULT_VASSAL_STATUS.autonomy,
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
            militaryStrength: 1.0, // 初始军事实力为满值
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
 * 游戏状态管理钩子
 * 集中管理所有游戏状态
 * @returns {Object} 包含所有状态和状态更新函数的对象
 */
export const useGameState = () => {
    // ========== 基础资源状态 ==========
    const [resources, setResourcesState] = useState(INITIAL_RESOURCES);

    // ========== 人口与社会状态 ==========
    const [population, setPopulation] = useState(5);
    const [popStructure, setPopStructure] = useState({});
    const [maxPop, setMaxPop] = useState(10);
    const [birthAccumulator, setBirthAccumulator] = useState(0);
    // 额外人口上限加成（如通过割地获得），不会被每日模拟覆盖
    const [maxPopBonus, setMaxPopBonus] = useState(0);

    // ========== 建筑与科技状态 ==========
    const [buildings, setBuildings] = useState({});
    const [buildingUpgrades, setBuildingUpgrades] = useState({}); // 建筑升级等级 { buildingId: { level: count } } - 每个等级的建筑数量
    const [techsUnlocked, setTechsUnlocked] = useState([]);
    const [epoch, setEpoch] = useState(0);

    // ========== 游戏控制状态 ==========
    const [activeTab, setActiveTab] = useState('overview');
    const [gameSpeed, setGameSpeed] = useState(1);
    const [isPaused, setIsPaused] = useState(false);
    const [pausedBeforeEvent, setPausedBeforeEvent] = useState(false); // 事件触发前的暂停状态
    const [autoSaveInterval, setAutoSaveInterval] = useState(60); // 自动存档间隔（秒）
    const [isAutoSaveEnabled, setIsAutoSaveEnabled] = useState(true); // 自动存档开关
    const [lastAutoSaveTime, setLastAutoSaveTime] = useState(() => Date.now()); // 上次自动存档时间
    const [autoSaveBlocked, setAutoSaveBlocked] = useState(false); // 自动存档因配额被禁用
    const [isSaving, setIsSaving] = useState(false); // UI保存状态指示
    const [difficulty, setDifficulty] = useState(DEFAULT_DIFFICULTY); // 游戏难度
    const [eventConfirmationEnabled, setEventConfirmationEnabled] = useState(false); // 事件二次确认开关
    const savingIndicatorTimer = useRef(null);
    const autoSaveQuotaNotifiedRef = useRef(false);

    // ========== 政令与外交状态 ==========
    const [nations, setNations] = useState(buildInitialNations());

    // ========== 海外投资系统状态 ==========
    const [overseasInvestments, setOverseasInvestments] = useState([]);    // 玩家在附庸国的投资
    const [foreignInvestments, setForeignInvestments] = useState([]);
    const [foreignInvestmentPolicy, setForeignInvestmentPolicy] = useState('normal');      // 外国在玩家国的投资

    // ========== 官员系统状态 ==========
    const [officials, setOfficials] = useState([]);           // 当前雇佣的官员
    const [officialCandidates, setOfficialCandidates] = useState([]); // 当前候选人列表
    const [lastSelectionDay, setLastSelectionDay] = useState(-999);   // 上次举办选拔的时间
    const [officialCapacity, setOfficialCapacity] = useState(2);      // 官员容量
    // ========== 内阁协同系统状态 ==========
    // Permanent policy decrees (legacy) - stored as array of { id, active, modifiers, ... }
    const [decrees, setDecrees] = useState([]);

    const [activeDecrees, setActiveDecrees] = useState({});           // 当前生效的临时法令
    const [decreeCooldowns, setDecreCooldowns] = useState({});       // 法令冷却时间
    const [quotaTargets, setQuotaTargets] = useState({});             // 计划经济阶层配额目标
    const [expansionSettings, setExpansionSettings] = useState({});   // 自由市场建筑扩张设置
    // ========== 政府价格管制状态（计划经济） ==========
    const [priceControls, setPriceControls] = useState({
        enabled: false,              // 是否启用价格管制
        governmentBuyPrices: {},     // 政府收购价 { resourceKey: price }
        governmentSellPrices: {},    // 政府出售价 { resourceKey: price }
    });


    // ========== 社会阶层状态 ==========
    const [classApproval, setClassApproval] = useState({});
    const [approvalBreakdown, setApprovalBreakdown] = useState({}); // [NEW] 各阶层满意度分解数据（来自 simulation）
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
    const [classLivingStandard, setClassLivingStandard] = useState({}); // 各阶层生活水平数据
    const [livingStandardStreaks, setLivingStandardStreaks] = useState(buildInitialLivingStandardStreaks());
    const [migrationCooldowns, setMigrationCooldowns] = useState({}); // 阶层迁移冷却状态 { roleKey: ticksRemaining }
    const [taxShock, setTaxShock] = useState({}); // [NEW] 各阶层累积税收冲击值 { roleKey: number }
    const [populationDetailView, setPopulationDetailView] = useState(false);
    const [history, setHistory] = useState(buildInitialHistory());
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

    // ========== 时间状态 ==========
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
                        day: daysElapsed,
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
                        if (!Number.isFinite(amount) || amount === 0) return;
                        const entryBefore = running;
                        const entryAfter = entryBefore + amount;
                        appendTreasuryChangeLog({
                            timestamp: Date.now(),
                            day: daysElapsed,
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
                            day: daysElapsed,
                            amount: residual,
                            before: running,
                            after: running + residual,
                            reason: 'untracked_delta',
                            meta: { reason, meta },
                        });
                    }
                } else if (Number.isFinite(after) && after !== before) {
                    appendTreasuryChangeLog({
                        timestamp: Date.now(),
                        day: daysElapsed,
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

    // ========== 军事系统状态 ==========
    const [army, setArmy] = useState({});
    const [militaryQueue, setMilitaryQueue] = useState([]);
    const [selectedTarget, setSelectedTarget] = useState(null);
    const [battleResult, setBattleResult] = useState(null);
    const [battleNotifications, setBattleNotifications] = useState([]); // 战斗通知队列
    const [militaryWageRatio, setMilitaryWageRatio] = useState(1.5);
    const [autoRecruitEnabled, setAutoRecruitEnabled] = useState(false);  // 自动补兵开关
    const [targetArmyComposition, setTargetArmyComposition] = useState({});  // 目标军队编制
    const [lastBattleTargetId, setLastBattleTargetId] = useState(null); // 上次攻击的目标ID
    const [lastBattleDay, setLastBattleDay] = useState(-999); // 上次攻击的时间

    // ========== 庆典系统状态 ==========
    const [festivalModal, setFestivalModal] = useState(null); // { options: [], year: number }
    const [activeFestivalEffects, setActiveFestivalEffects] = useState([]); // 激活的庆典效果
    const [lastFestivalYear, setLastFestivalYear] = useState(1); // 上次庆典的年份（从1开始，避免第1年触发）

    // ========== 商人交易状态 ==========
    const [merchantState, setMerchantState] = useState(buildInitialMerchantState); // 商人交易状态：买入-持有-卖出周期

    // ========== 贸易路线状态 ==========
    const [tradeRoutes, setTradeRoutes] = useState(buildInitialTradeRoutes); // 玩家创建的贸易路线
    const [tradeStats, setTradeStats] = useState({ tradeTax: 0, tradeRouteTax: 0 }); // 每日贸易路线税收
    const [diplomacyOrganizations, setDiplomacyOrganizations] = useState(buildInitialDiplomacyOrganizations);
    const [vassalDiplomacyQueue, setVassalDiplomacyQueue] = useState([]);
    const [vassalDiplomacyHistory, setVassalDiplomacyHistory] = useState([]);
    const [overseasBuildings, setOverseasBuildings] = useState(buildInitialOverseasBuildings);

    // ========== 和平协议状态 ==========
    // ========== 策略行动状态 ==========
    const [actionCooldowns, setActionCooldowns] = useState({});
    const [actionUsage, setActionUsage] = useState({});
    const [promiseTasks, setPromiseTasks] = useState([]);

    const [playerInstallmentPayment, setPlayerInstallmentPayment] = useState(null); // 玩家的分期支付协议

    // ========== 叛乱系统状态 ==========
    // 追踪各阶层的叛乱状态
    // 格式: { [stratumKey]: { dissatisfactionDays: number, phase: string, influenceShare: number } }
    const [rebellionStates, setRebellionStates] = useState({});

    // ========== 执政联盟状态 ==========
    // 默认自耕农(peasant)为联盟成员
    const [rulingCoalition, setRulingCoalition] = useState(['peasant']); // 联盟成员阶层键数组
    const [legitimacy, setLegitimacy] = useState(0); // 合法性值 (0-100)

    // ========== 游戏运算中间值（Modifiers） ==========
    const [modifiers, setModifiers] = useState({});

    // ========== 教程系统状态 ==========
    const [showTutorial, setShowTutorial] = useState(() => {
        // 检查是否已完成教程
        const completed = localStorage.getItem('tutorial_completed');
        return !completed; // 如果没有记录，则显示教程
    });

    // ========== 事件系统状态 ==========
    const [currentEvent, setCurrentEvent] = useState(null); // 当前显示的事件
    const [eventHistory, setEventHistory] = useState([]); // 事件历史记录

    // ========== 成就系统状态 ==========
    const [unlockedAchievements, setUnlockedAchievements] = useState(loadAchievementsFromStorage);
    const [achievementNotifications, setAchievementNotifications] = useState([]);
    const [achievementProgress, setAchievementProgress] = useState(loadAchievementProgressFromStorage);

    // ========== UI状态 ==========
    const [logs, setLogs] = useState(["文明的黎明已至，第 1 年春季从这里开启，请分配你的人民工作吧。"]);
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
    const [jobsAvailable, setJobsAvailable] = useState({}); // 各阶层可用岗位数量
    const [buildingJobsRequired, setBuildingJobsRequired] = useState({}); // 每个建筑的实际岗位需求
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

        // ========== 新增配置项支持 ==========

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

        // 合法性配置
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
            // 检查是否是新游戏模式（从"另开新档"进入）
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

            // 收集所有存档的时间戳
            const saves = [];

            // 检查手动存档槽位
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

            // 检查自动存档
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

            // 检查旧版存档并迁移到槽位0
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
                officials,
                officialCandidates,
                lastSelectionDay,
                officialCapacity,
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
                daysElapsed,
                army,
                militaryQueue,
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
                eventConfirmationEnabled,
                updatedAt: timestamp,
                saveSource: source,
            },
            nextLastAuto,
        };
    };

    const applyLoadedGameState = (data) => {
        if (!data || typeof data !== 'object') {
            throw new Error('存档数据无效');
        }
        setResources(data.resources || INITIAL_RESOURCES, { reason: 'load_game', audit: false });

        // [FIX] 存档人口同步修复：防止population和popStructure不一致导致的恶性扣减循环
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
        // 升级格式迁移：检测旧格式并自动转换
        let upgrades = data.buildingUpgrades || {};
        if (isOldUpgradeFormat(upgrades, data.buildings)) {
            console.log('[Save Migration] Detected old buildingUpgrades format, migrating...');
            upgrades = migrateUpgradesToNewFormat(upgrades, data.buildings);
        }
        setBuildingUpgrades(upgrades);
        setTechsUnlocked(data.techsUnlocked || []);
        setEpoch(data.epoch ?? 0);
        setActiveTab(data.activeTab || 'build');
        setGameSpeed(data.gameSpeed ?? 1);
        setIsPaused(data.isPaused ?? false);
        setNations((data.nations || buildInitialNations()).map(n => ({
            ...n,
            treaties: Array.isArray(n.treaties) ? n.treaties : [],
            openMarketUntil: Object.prototype.hasOwnProperty.call(n, 'openMarketUntil') ? n.openMarketUntil : null,
            peaceTreatyUntil: Object.prototype.hasOwnProperty.call(n, 'peaceTreatyUntil') ? n.peaceTreatyUntil : null,
            vassalOf: Object.prototype.hasOwnProperty.call(n, 'vassalOf') ? n.vassalOf : DEFAULT_VASSAL_STATUS.vassalOf,
            vassalType: Object.prototype.hasOwnProperty.call(n, 'vassalType') ? n.vassalType : DEFAULT_VASSAL_STATUS.vassalType,
            autonomy: Number.isFinite(n.autonomy) ? n.autonomy : DEFAULT_VASSAL_STATUS.autonomy,
            tributeRate: Number.isFinite(n.tributeRate) ? n.tributeRate : DEFAULT_VASSAL_STATUS.tributeRate,
            independencePressure: Number.isFinite(n.independencePressure) ? n.independencePressure : DEFAULT_VASSAL_STATUS.independencePressure,
            organizationMemberships: Array.isArray(n.organizationMemberships) ? n.organizationMemberships : [],
            overseasAssets: Array.isArray(n.overseasAssets) ? n.overseasAssets : [],
        })));
        setOfficials(migrateAllOfficialsForInvestment(data.officials || [], data.daysElapsed || 0));
        setOfficialCandidates(data.officialCandidates || []);
        setLastSelectionDay(data.lastSelectionDay ?? -999);
        setOfficialCapacity(data.officialCapacity ?? 2);
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
        setDaysElapsed(data.daysElapsed || 0);
        setArmy(data.army || {});
        setMilitaryQueue(data.militaryQueue || []);
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
        setDiplomacyOrganizations(data.diplomacyOrganizations || buildInitialDiplomacyOrganizations());
        setVassalDiplomacyQueue(Array.isArray(data.vassalDiplomacyQueue) ? data.vassalDiplomacyQueue : []);
        setVassalDiplomacyHistory(Array.isArray(data.vassalDiplomacyHistory) ? data.vassalDiplomacyHistory : []);
        setOverseasBuildings(data.overseasBuildings || buildInitialOverseasBuildings());
        setOverseasInvestments(migrateOverseasInvestments(data.overseasInvestments || []));
        setForeignInvestments(data.foreignInvestments || []);
        setForeignInvestmentPolicy(data.foreignInvestmentPolicy || 'normal');
        setAutoSaveInterval(data.autoSaveInterval ?? 60);
        setIsAutoSaveEnabled(data.isAutoSaveEnabled ?? true);
        setLastAutoSaveTime(data.lastAutoSaveTime || Date.now());
        setDifficulty(data.difficulty || DEFAULT_DIFFICULTY);
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

    const saveGame = ({ source = 'manual', slotIndex = 0 } = {}) => {
        if (source === 'auto' && (autoSaveBlocked || !isAutoSaveEnabled)) {
            return;
        }
        const timestamp = Date.now();
        const { payload } = buildSavePayload({ source, timestamp });
        const shouldCompact = source === 'auto';
        const payloadToSave = shouldCompact ? compactSavePayload(payload) : payload;
        let targetKey;
        let friendlyName;
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

            localStorage.setItem(targetKey, JSON.stringify(payloadToSave));
            triggerSavingIndicator();

            if (source === 'auto') {
                setLastAutoSaveTime(timestamp);
            } else {
                addLogEntry(`💾 游戏已保存到${friendlyName}！`);
            }
        } catch (error) {
            const isQuotaExceeded = error?.name === 'QuotaExceededError'
                || `${error?.message || ''}`.toLowerCase().includes('quota');
            if (isQuotaExceeded) {
                try {
                    const compactedPayload = compactSavePayload(payload, { aggressive: true });
                    localStorage.setItem(targetKey, JSON.stringify(compactedPayload));
                    triggerSavingIndicator();
                    if (source === 'auto') {
                        setLastAutoSaveTime(timestamp);
                    }
                    addLogEntry('⚠️ 存档空间不足，已使用精简存档。');
                    return;
                } catch (fallbackError) {
                    console.error('Compact save failed:', fallbackError);
                }
                if (source === 'auto') {
                    try {
                        const minimalPayload = buildMinimalAutoSavePayload(payload);
                        localStorage.setItem(targetKey, JSON.stringify(minimalPayload));
                        triggerSavingIndicator();
                        setLastAutoSaveTime(timestamp);
                        addLogEntry('⚠️ 自动存档已切换为最小存档。');
                        return;
                    } catch (minimalError) {
                        console.error('Minimal auto save failed:', minimalError);
                    }
                }
                if (source === 'auto') {
                    setIsAutoSaveEnabled(false);
                    setAutoSaveBlocked(true);
                    if (!autoSaveQuotaNotifiedRef.current) {
                        autoSaveQuotaNotifiedRef.current = true;
                        addLogEntry('❌ 自动存档空间不足，已自动关闭。请清理旧存档或导出存档。');
                    }
                    return;
                }
            }
            console.error(`${source === 'auto' ? 'Auto' : 'Manual'} save failed:`, error);
            if (source === 'auto') {
                addLogEntry(`❌ 自动存档失败：${error.message}`);
            } else {
                addLogEntry(`❌ 存档失败：${error.message}`);
            }
            setIsSaving(false);
        }
    };

    const loadGame = ({ source = 'manual', slotIndex = 0 } = {}) => {
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
                addLogEntry(`⚠️ 未找到${friendlyName}数据。`);
                return false;
            }

            const data = JSON.parse(rawData);
            applyLoadedGameState(data);
            addLogEntry(`📂 ${friendlyName}读取成功！`);
            return true;
        } catch (error) {
            console.error('Load game failed:', error);
            addLogEntry(`❌ 读取存档失败：${error.message}`);
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
            let fileJson = JSON.stringify(payload);
            let note = '📤 存档导出成功，可复制到其他设备。';
            if (canObfuscate) {
                fileJson = JSON.stringify({
                    format: SAVE_FORMAT_VERSION,
                    obfuscated: true,
                    data: encodeSavePayload(payload),
                    updatedAt: payload.updatedAt,
                });
                note = '📤 已导出混淆存档，可复制到其他设备。';
            }
            const blob = new Blob([fileJson], { type: 'application/octet-stream' });
            const iso = new Date(timestamp).toISOString().replace(/[:.]/g, '-');
            const filename = `civ-save-${iso}.${SAVE_FILE_EXTENSION}`;

            // 检测运行环境
            const isMobile = /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
            // 只有当运行在原生平台（iOS/Android）时才认为是 Native 环境
            // 在 Web 端（包括 PC 浏览器和移动端浏览器），即使引入了 Capacitor 也是 Web 平台，支持下载链接
            const isNative = window.Capacitor?.isNativePlatform() || false;
            console.log('[Export] Environment:', { isMobile, isNative, platform: window.Capacitor?.getPlatform() || 'web', userAgent: navigator.userAgent });

            // 方案0：原生 App 导出 (Capacitor Native)
            // 使用 Filesystem 写入缓存，然后用 Share 插件分享文件
            if (isNative) {
                try {
                    console.log('[Export] Trying Native Filesystem & Share...');
                    // 写入临时文件到缓存目录
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
                        dialogTitle: '保存或发送存档',
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
                    // 如果失败，继续执行后备方案（主要是剪贴板）
                }
            }

            // 方案1：Web Share API（支持分享文件的设备，仅限移动端 Web）
            // 在 PC 端尝试 Share API 可能会消耗用户手势，导致后续的下载被拦截，所以仅在移动端启用
            if (isMobile && navigator.share && navigator.canShare) {
                try {
                    const file = new File([blob], filename, { type: 'application/octet-stream' });
                    const shareData = { files: [file] };

                    if (navigator.canShare(shareData)) {
                        console.log('[Export] Trying Web Share API with file...');
                        await navigator.share(shareData);
                        addLogEntry('📤 存档已通过分享导出！');
                        return true;
                    }
                } catch (shareError) {
                    if (shareError.name === 'AbortError') {
                        addLogEntry('ℹ️ 已取消分享。');
                        return false;
                    }
                    console.warn('[Export] Share API with file failed:', shareError);
                }
            }

            // 方案2：桌面浏览器下载（非移动端/Web端）
            // 优先尝试下载文件，这是最符合用户预期的"导出到文件"的行为
            // 即使是 Capacitor Web 版（PC浏览器），isNative 也是 false，可以下载
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
                    addLogEntry('📋 存档数据已复制到剪贴板！请粘贴保存到备忘录或文本文件。');
                    return true;
                } catch (clipboardError) {
                    console.warn('[Export] Clipboard API failed:', clipboardError);
                }
            }

            // 方案4（最终保底）：弹窗提示用户手动复制
            console.log('[Export] Falling back to prompt...');
            // 缩短存档数据用于显示（太长会导致弹窗问题）
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
                    addLogEntry('📋 存档数据已复制到剪贴板！请粘贴保存到备忘录。');
                    alert('存档数据已复制到剪贴板！\n\n请打开备忘录或其他文本应用，粘贴保存。');
                    return true;
                }
            } catch (execError) {
                document.body.removeChild(textarea);
                console.warn('[Export] execCommand copy failed:', execError);
            }

            // 如果所有方案都失败，显示存档数据让用户手动复制
            addLogEntry('⚠️ 自动导出失败，请手动复制存档数据。');
            const userCopied = window.prompt(
                '自动导出失败。请手动长按下方文本全选复制，保存到备忘录：\n（文本很长，请确保全部复制）',
                fileJson
            );

            if (userCopied !== null) {
                addLogEntry('📋 请确保已复制完整存档数据。');
                return true;
            }

            return false;
        } catch (error) {
            console.error('Export save failed:', error);
            addLogEntry(`❌ 导出存档失败：${error.message}`);
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

            // 回退方案：使用 execCommand
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
            addLogEntry(`❌ 复制失败：${error.message}`);
            throw error;
        }
    };

    const importSaveFromBinary = async (fileOrBuffer) => {
        try {
            if (!fileOrBuffer) {
                throw new Error('请选择有效的存档文件');
            }
            if (!textDecoder) {
                throw new Error('当前环境不支持解析存档文件');
            }
            let buffer;
            if (fileOrBuffer instanceof ArrayBuffer) {
                buffer = fileOrBuffer;
            } else if (fileOrBuffer instanceof Uint8Array) {
                buffer = fileOrBuffer.buffer;
            } else if (typeof fileOrBuffer.arrayBuffer === 'function') {
                buffer = await fileOrBuffer.arrayBuffer();
            } else {
                throw new Error('无法解析的文件类型');
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
            localStorage.setItem(`${SAVE_SLOT_PREFIX}0`, JSON.stringify(normalized));
            applyLoadedGameState(normalized);
            addLogEntry('📥 已从备份文件导入存档！');
            return true;
        } catch (error) {
            console.error('Import save failed:', error);
            addLogEntry(`❌ 导入存档失败：${error.message}`);
            throw error;
        }
    };

    // 从文本/剪贴板导入存档
    const importSaveFromText = async (textInput = null) => {
        try {
            let jsonString = textInput;

            // 如果没有传入文本，尝试从剪贴板读取或弹窗让用户粘贴
            if (!jsonString) {
                // 方案1：尝试从剪贴板读取
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

                // 方案2：如果剪贴板读取失败或为空，弹窗让用户粘贴
                if (!jsonString || !jsonString.trim()) {
                    jsonString = window.prompt(
                        '请粘贴存档数据：\n（长按输入框，选择粘贴）',
                        ''
                    );
                    if (jsonString === null) {
                        addLogEntry('ℹ️ 已取消导入。');
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

            localStorage.setItem(`${SAVE_SLOT_PREFIX}0`, JSON.stringify(normalized));
            applyLoadedGameState(normalized);
            addLogEntry('📥 已从剪贴板导入存档！');
            return true;
        } catch (error) {
            console.error('Import from text failed:', error);
            if (error instanceof SyntaxError) {
                addLogEntry('❌ 导入失败：存档数据格式无效，请确保完整复制。');
            } else {
                addLogEntry(`❌ 导入存档失败：${error.message}`);
            }
            throw error;
        }
    };

    // 开始新游戏（不删除现有存档）
    const resetGame = (options = null) => {
        if (typeof window === 'undefined') {
            return;
        }
        const normalized = typeof options === 'string'
            ? { difficulty: options }
            : (options || {});
        // 标记为新游戏模式，启动时不加载任何存档
        localStorage.setItem('start_new_game', 'true');
        // 如果指定了难度，保存到 localStorage 以便新游戏启动时使用
        if (normalized.difficulty) {
            localStorage.setItem('new_game_difficulty', normalized.difficulty);
        }
        if (normalized.scenarioId) {
            localStorage.setItem('new_game_scenario', normalized.scenarioId);
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

        // 政令与外交
        nations,
        setNations,
        selectedTarget,
        setSelectedTarget,

        // 官员系统 (新增)
        officials,
        setOfficials,
        officialCandidates,
        setOfficialCandidates,
        lastSelectionDay,
        setLastSelectionDay,
        officialCapacity,
        setOfficialCapacity,
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
        exportSaveToBinary,
        exportSaveToClipboard,
        importSaveFromBinary,
        importSaveFromText,
        hasAutoSave,
        resetGame,
        eventConfirmationEnabled,
        setEventConfirmationEnabled,
        // 财政数据
        fiscalActual,
        setFiscalActual,
        dailyMilitaryExpense,
        setDailyMilitaryExpense,
    };
};
