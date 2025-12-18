// 游戏状态管理钩子
// 集中管理所有游戏状态，避免App.jsx中状态定义过多

import { useEffect, useRef, useState } from 'react';
import { DECREES, COUNTRIES, RESOURCES, STRATA } from '../config';

const SAVE_KEY = 'civ_game_save_data_v1';
const AUTOSAVE_KEY = 'civ_game_autosave_v1';
const SAVE_FORMAT_VERSION = 1;
const SAVE_FILE_EXTENSION = 'cgsave';
const SAVE_OBFUSCATION_KEY = 'civ_game_simple_mask_v1';

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
});

const DEFAULT_EVENT_EFFECT_SETTINGS = {
    approval: { duration: 30, decayRate: 0.04 },
    stability: { duration: 30, decayRate: 0.04 },
    // Economic effect settings - longer duration, slower decay
    resourceDemand: { duration: 60, decayRate: 0.02 },      // Resource demand modifier
    stratumDemand: { duration: 60, decayRate: 0.02 },       // Stratum consumption modifier
    buildingProduction: { duration: 45, decayRate: 0.025 }, // Building production modifier
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

// 合并存档中的政令数据与最新配置
// 保留存档的active状态，但使用最新配置中的其他字段（如modifiers、effects、drawbacks等）
const mergeDecreesWithConfig = (savedDecrees) => {
    if (!savedDecrees || !Array.isArray(savedDecrees)) {
        return DECREES;
    }

    // 创建存档政令的active状态映射
    const savedActiveMap = {};
    savedDecrees.forEach(d => {
        savedActiveMap[d.id] = d.active;
    });

    // 使用最新的配置，但保留存档的active状态
    return DECREES.map(configDecree => ({
        ...configDecree,
        active: savedActiveMap[configDecree.id] ?? configDecree.active,
    }));
};

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

        return {
            ...nation,
            relation: 50,
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

/**
 * 游戏状态管理钩子
 * 集中管理所有游戏状态
 * @returns {Object} 包含所有状态和状态更新函数的对象
 */
export const useGameState = () => {
    // ========== 基础资源状态 ==========
    const [resources, setResources] = useState(INITIAL_RESOURCES);

    // ========== 人口与社会状态 ==========
    const [population, setPopulation] = useState(5);
    const [popStructure, setPopStructure] = useState({});
    const [maxPop, setMaxPop] = useState(10);
    const [birthAccumulator, setBirthAccumulator] = useState(0);
    // 额外人口上限加成（如通过割地获得），不会被每日模拟覆盖
    const [maxPopBonus, setMaxPopBonus] = useState(0);

    // ========== 建筑与科技状态 ==========
    const [buildings, setBuildings] = useState({});
    const [buildingUpgrades, setBuildingUpgrades] = useState({}); // 建筑升级等级 { buildingId: { instanceIndex: level } }
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
    const [isSaving, setIsSaving] = useState(false); // UI保存状态指示
    const savingIndicatorTimer = useRef(null);

    // ========== 政令与外交状态 ==========
    const [decrees, setDecrees] = useState(DECREES);
    const [nations, setNations] = useState(buildInitialNations());

    // ========== 社会阶层状态 ==========
    const [classApproval, setClassApproval] = useState({});
    const [classInfluence, setClassInfluence] = useState({});
    const [classWealth, setClassWealth] = useState(buildInitialWealth());
    const [classWealthDelta, setClassWealthDelta] = useState({});
    const [classIncome, setClassIncome] = useState({});
    const [classExpense, setClassExpense] = useState({});
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
    const [populationDetailView, setPopulationDetailView] = useState(false);
    const [history, setHistory] = useState(buildInitialHistory());
    const [eventEffectSettings, setEventEffectSettings] = useState(DEFAULT_EVENT_EFFECT_SETTINGS);
    const [activeEventEffects, setActiveEventEffects] = useState(buildInitialEventEffects());

    // ========== 时间状态 ==========
    const [daysElapsed, setDaysElapsed] = useState(0);

    // ========== 军事系统状态 ==========
    const [army, setArmy] = useState({});
    const [militaryQueue, setMilitaryQueue] = useState([]);
    const [selectedTarget, setSelectedTarget] = useState(null);
    const [battleResult, setBattleResult] = useState(null);
    const [battleNotifications, setBattleNotifications] = useState([]); // 战斗通知队列
    const [militaryWageRatio, setMilitaryWageRatio] = useState(1.5);
    const [autoRecruitEnabled, setAutoRecruitEnabled] = useState(false);  // 自动补兵开关
    const [targetArmyComposition, setTargetArmyComposition] = useState({});  // 目标军队编制

    // ========== 庆典系统状态 ==========
    const [festivalModal, setFestivalModal] = useState(null); // { options: [], year: number }
    const [activeFestivalEffects, setActiveFestivalEffects] = useState([]); // 激活的庆典效果
    const [lastFestivalYear, setLastFestivalYear] = useState(1); // 上次庆典的年份（从1开始，避免第1年触发）

    // ========== 商人交易状态 ==========
    const [merchantState, setMerchantState] = useState(buildInitialMerchantState); // 商人交易状态：买入-持有-卖出周期

    // ========== 贸易路线状态 ==========
    const [tradeRoutes, setTradeRoutes] = useState(buildInitialTradeRoutes); // 玩家创建的贸易路线
    const [tradeStats, setTradeStats] = useState({ tradeTax: 0 }); // 每日贸易路线税收

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

    // ========== 教程系统状态 ==========
    const [showTutorial, setShowTutorial] = useState(() => {
        // 检查是否已完成教程
        const completed = localStorage.getItem('tutorial_completed');
        return !completed; // 如果没有记录，则显示教程
    });

    // ========== 事件系统状态 ==========
    const [currentEvent, setCurrentEvent] = useState(null); // 当前显示的事件
    const [eventHistory, setEventHistory] = useState([]); // 事件历史记录

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
    });
    const [jobFill, setJobFill] = useState({});
    const [jobsAvailable, setJobsAvailable] = useState({}); // 各阶层可用岗位数量
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

    // Auto-load the most recent save on startup
    const hasInitializedRef = useRef(false);
    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (hasInitializedRef.current) return;
        hasInitializedRef.current = true;

        try {
            const autoRaw = localStorage.getItem(AUTOSAVE_KEY);
            const manualRaw = localStorage.getItem(SAVE_KEY);

            if (!autoRaw && !manualRaw) {
                // No saves found, start fresh
                return;
            }

            let autoTime = 0;
            let manualTime = 0;

            if (autoRaw) {
                try {
                    const autoData = JSON.parse(autoRaw);
                    autoTime = autoData?.updatedAt || 0;
                } catch (e) {
                    console.warn('Failed to parse auto-save:', e);
                }
            }

            if (manualRaw) {
                try {
                    const manualData = JSON.parse(manualRaw);
                    manualTime = manualData?.updatedAt || 0;
                } catch (e) {
                    console.warn('Failed to parse manual save:', e);
                }
            }

            // Load the most recent save
            if (autoTime > 0 || manualTime > 0) {
                const loadSource = autoTime > manualTime ? 'auto' : 'manual';
                // Use setTimeout to ensure loadGame has access to addLogEntry
                setTimeout(() => {
                    loadGame({ source: loadSource });
                }, 0);
            }
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
                decrees,
                nations,
                classApproval,
                classInfluence,
                classWealth,
                classWealthDelta,
                classIncome,
                classExpense,
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
                eventEffectSettings,
                activeEventEffects,
                rebellionStates,
                actionCooldowns,
                actionUsage,
                promiseTasks,
                autoSaveInterval,
                isAutoSaveEnabled,
                lastAutoSaveTime: nextLastAuto,
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
        setResources(data.resources || INITIAL_RESOURCES);
        setPopulation(data.population ?? 5);
        setPopStructure(data.popStructure || {});
        setMaxPop(data.maxPop ?? 10);
        setMaxPopBonus(data.maxPopBonus || 0);
        setBirthAccumulator(data.birthAccumulator || 0);
        setBuildings(data.buildings || {});
        setBuildingUpgrades(data.buildingUpgrades || {});
        setTechsUnlocked(data.techsUnlocked || []);
        setEpoch(data.epoch ?? 0);
        setActiveTab(data.activeTab || 'build');
        setGameSpeed(data.gameSpeed ?? 1);
        setIsPaused(data.isPaused ?? false);
        setDecrees(mergeDecreesWithConfig(data.decrees));
        setNations(data.nations || buildInitialNations());
        setClassApproval(data.classApproval || {});
        setClassInfluence(data.classInfluence || {});
        setClassWealth(data.classWealth || buildInitialWealth());
        setClassWealthDelta(data.classWealthDelta || {});
        setClassIncome(data.classIncome || {});
        setClassExpense(data.classExpense || {});
        setClassWealthHistory(data.classWealthHistory || buildInitialWealthHistory());
        setClassNeedsHistory(data.classNeedsHistory || buildInitialNeedsHistory());
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
        setPopulationDetailView(data.populationDetailView || false);
        setHistory(data.history || buildInitialHistory());
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
        setEventHistory(data.eventHistory || []);
        setLogs(Array.isArray(data.logs) ? data.logs : []);
        setClicks(Array.isArray(data.clicks) ? data.clicks : []);
        setRates(data.rates || {});
        setTaxes(data.taxes || {
            total: 0,
            breakdown: { headTax: 0, industryTax: 0, subsidy: 0, policyIncome: 0, policyExpense: 0 },
            efficiency: 1,
        });
        setTaxPolicies(data.taxPolicies || {
            headTaxRates: buildDefaultHeadTaxRates(),
            resourceTaxRates: buildDefaultResourceTaxRates(),
            businessTaxRates: buildDefaultBusinessTaxRates(),
        });
        setJobFill(data.jobFill || {});
        setMarket(data.market || buildInitialMarket());
        setMerchantState(data.merchantState || buildInitialMerchantState());
        setTradeRoutes(data.tradeRoutes || buildInitialTradeRoutes());
        setTradeStats(data.tradeStats || { tradeTax: 0 });
        setAutoSaveInterval(data.autoSaveInterval ?? 60);
        setIsAutoSaveEnabled(data.isAutoSaveEnabled ?? true);
        setLastAutoSaveTime(data.lastAutoSaveTime || Date.now());
        setEventEffectSettings(data.eventEffectSettings || DEFAULT_EVENT_EFFECT_SETTINGS);
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
        setActionCooldowns(data.actionCooldowns || {});
        setActionUsage(data.actionUsage || {});
        setPromiseTasks(data.promiseTasks || []);
    };

    const saveGame = ({ source = 'manual' } = {}) => {
        try {
            const timestamp = Date.now();
            const { payload } = buildSavePayload({ source, timestamp });
            const targetKey = source === 'auto' ? AUTOSAVE_KEY : SAVE_KEY;
            localStorage.setItem(targetKey, JSON.stringify(payload));
            triggerSavingIndicator();
            if (source === 'auto') {
                setLastAutoSaveTime(timestamp);
            } else {
                addLogEntry('💾 游戏已成功保存！');
            }
        } catch (error) {
            console.error(`${source === 'auto' ? 'Auto' : 'Manual'} save failed:`, error);
            if (source === 'auto') {
                addLogEntry(`❌ 自动存档失败：${error.message}`);
            } else {
                addLogEntry(`❌ 存档失败：${error.message}`);
            }
            setIsSaving(false);
        }
    };

    const loadGame = ({ source = 'manual' } = {}) => {
        try {
            const targetKey = source === 'auto' ? AUTOSAVE_KEY : SAVE_KEY;
            const friendly = source === 'auto' ? '自动' : '手动';
            const rawData = localStorage.getItem(targetKey);
            if (!rawData) {
                addLogEntry(`⚠️ 未找到任何${friendly}存档数据。`);
                return;
            }
            const data = JSON.parse(rawData);
            applyLoadedGameState(data);
            addLogEntry(source === 'auto' ? '📂 自动存档读取成功！' : '📂 读取存档成功！');
        } catch (error) {
            console.error('Load game failed:', error);
            addLogEntry(`❌ 读取存档失败：${error.message}`);
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
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            addLogEntry(note);
            return true;
        } catch (error) {
            console.error('Export save failed:', error);
            addLogEntry(`❌ 导出存档失败：${error.message}`);
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
            localStorage.setItem(SAVE_KEY, JSON.stringify(normalized));
            applyLoadedGameState(normalized);
            addLogEntry('📥 已从备份文件导入存档！');
            return true;
        } catch (error) {
            console.error('Import save failed:', error);
            addLogEntry(`❌ 导入存档失败：${error.message}`);
            throw error;
        }
    };

    const resetGame = () => {
        if (typeof window === 'undefined') {
            return;
        }
        const confirmed = window.confirm('确认要重置游戏并清除存档吗？该操作不可撤销。');
        if (!confirmed) return;
        localStorage.removeItem(SAVE_KEY);
        localStorage.removeItem(AUTOSAVE_KEY);
        window.location.reload();
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

        // 政令与外交
        decrees,
        setDecrees,
        nations,
        setNations,
        selectedTarget,
        setSelectedTarget,

        // 社会阶层
        classApproval,
        setClassApproval,
        classInfluence,
        setClassInfluence,
        classWealth,
        setClassWealth,
        classWealthDelta,
        setClassWealthDelta,
        classIncome,
        setClassIncome,
        classExpense,
        setClassExpense,
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
        populationDetailView,
        setPopulationDetailView,
        history,
        setHistory,
        eventEffectSettings,
        setEventEffectSettings,
        activeEventEffects,
        setActiveEventEffects,

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

        // 和平协议
        playerInstallmentPayment,
        setPlayerInstallmentPayment,

        // 叛乱系统
        rebellionStates,
        setRebellionStates,

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
        saveGame,
        loadGame,
        exportSaveToBinary,
        importSaveFromBinary,
        hasAutoSave,
        resetGame,
    };
};
