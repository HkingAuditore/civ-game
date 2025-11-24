// 游戏状态管理钩子
// 集中管理所有游戏状态，避免App.jsx中状态定义过多

import { useEffect, useRef, useState } from 'react';
import { DECREES, COUNTRIES, RESOURCES, STRATA } from '../config';

const SAVE_KEY = 'civ_game_save_data_v1';
const AUTOSAVE_KEY = 'civ_game_autosave_v1';

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
  silver: 200, 
  science: 0, 
  culture: 0, 
  admin: 0 
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

const buildInitialNations = () => {
  return COUNTRIES.map(nation => {
    // 初始化库存：基于资源偏差
    const inventory = {};
    if (nation.economyTraits?.resourceBias) {
      Object.entries(nation.economyTraits.resourceBias).forEach(([resourceKey, bias]) => {
        if (bias > 1) {
          // 特产资源：高库存 (500-1000)
          inventory[resourceKey] = Math.floor(500 + Math.random() * 500);
        } else if (bias < 1) {
          // 稀缺资源：低库存 (0-100)
          inventory[resourceKey] = Math.floor(Math.random() * 100);
        } else {
          // 中性资源：中等库存 (100-300)
          inventory[resourceKey] = Math.floor(100 + Math.random() * 200);
        }
      });
    }
    
    // 初始化预算：基于财富
    const wealth = nation.wealth ?? 800;
    const budget = Math.floor(wealth * 0.5);
    
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

  // ========== 建筑与科技状态 ==========
  const [buildings, setBuildings] = useState({});
  const [techsUnlocked, setTechsUnlocked] = useState([]);
  const [epoch, setEpoch] = useState(0);

  // ========== 游戏控制状态 ==========
  const [activeTab, setActiveTab] = useState('build');
  const [gameSpeed, setGameSpeed] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
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
  const [populationDetailView, setPopulationDetailView] = useState(false);
  const [history, setHistory] = useState(buildInitialHistory());

  // ========== 行政管理状态 ==========
  const [adminStrain, setAdminStrain] = useState(0);
  const [adminCap, setAdminCap] = useState(50);

  // ========== 时间状态 ==========
  const [daysElapsed, setDaysElapsed] = useState(0);

  // ========== 军事系统状态 ==========
  const [army, setArmy] = useState({});
  const [militaryQueue, setMilitaryQueue] = useState([]);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [battleResult, setBattleResult] = useState(null);
  const [militaryWageRatio, setMilitaryWageRatio] = useState(1.5);

  // ========== 庆典系统状态 ==========
  const [festivalModal, setFestivalModal] = useState(null); // { options: [], year: number }
  const [activeFestivalEffects, setActiveFestivalEffects] = useState([]); // 激活的庆典效果
  const [lastFestivalYear, setLastFestivalYear] = useState(1); // 上次庆典的年份（从1开始，避免第1年触发）

  // ========== 商人交易状态 ==========
  const [merchantState, setMerchantState] = useState({ trades: {} }); // 商人交易状态：买入-持有-卖出周期

  // ========== 教程系统状态 ==========
  const [showTutorial, setShowTutorial] = useState(() => {
    // 检查是否已完成教程
    const completed = localStorage.getItem('tutorial_completed');
    return !completed; // 如果没有记录，则显示教程
  });

  // ========== UI状态 ==========
  const [logs, setLogs] = useState(["文明的黎明已至，第 1 年春季从这里开启，请分配你的人民工作吧。"]);
  const [clicks, setClicks] = useState([]);
  const [rates, setRates] = useState({});
  const [taxes, setTaxes] = useState({
    total: 0,
    breakdown: { headTax: 0, industryTax: 0, subsidy: 0 },
    efficiency: 1,
  });
  const [taxPolicies, setTaxPolicies] = useState({
    headTaxRates: buildDefaultHeadTaxRates(),
    resourceTaxRates: buildDefaultResourceTaxRates(),
  });
  const [jobFill, setJobFill] = useState({});
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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const autoRaw = localStorage.getItem(AUTOSAVE_KEY);
      if (!autoRaw) return;
      const manualRaw = localStorage.getItem(SAVE_KEY);
      if (!manualRaw) {
        addLogEntry('💡 检测到自动存档，可在设置中加载。');
        return;
      }
      const autoData = JSON.parse(autoRaw);
      const manualData = JSON.parse(manualRaw);
      if ((autoData?.updatedAt || 0) > (manualData?.updatedAt || 0)) {
        addLogEntry('💡 有更新的自动存档，可在设置中选择读取。');
      }
    } catch (error) {
      console.warn('Auto-save detection failed:', error);
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

  const saveGame = ({ source = 'manual' } = {}) => {
    try {
      const timestamp = Date.now();
      const nextLastAuto = source === 'auto' ? timestamp : lastAutoSaveTime;
      const saveData = {
        resources,
        population,
        popStructure,
        maxPop,
        buildings,
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
        populationDetailView,
        history,
        adminStrain,
        adminCap,
        daysElapsed,
        army,
        militaryQueue,
        selectedTarget,
        battleResult,
        militaryWageRatio,
        festivalModal,
        activeFestivalEffects,
        lastFestivalYear,
        showTutorial,
        logs,
        clicks,
        rates,
        taxes,
        taxPolicies,
        jobFill,
        market,
        merchantState,
        autoSaveInterval,
        isAutoSaveEnabled,
        lastAutoSaveTime: nextLastAuto,
        updatedAt: timestamp,
        saveSource: source,
      };
      const targetKey = source === 'auto' ? AUTOSAVE_KEY : SAVE_KEY;
      localStorage.setItem(targetKey, JSON.stringify(saveData));
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
      setResources(data.resources || INITIAL_RESOURCES);
      setPopulation(data.population ?? 5);
      setPopStructure(data.popStructure || {});
      setMaxPop(data.maxPop ?? 10);
      setBuildings(data.buildings || {});
      setTechsUnlocked(data.techsUnlocked || []);
      setEpoch(data.epoch ?? 0);
      setActiveTab(data.activeTab || 'build');
      setGameSpeed(data.gameSpeed ?? 1);
      setIsPaused(data.isPaused ?? false);
      setDecrees(data.decrees || DECREES);
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
      setPopulationDetailView(data.populationDetailView || false);
      setHistory(data.history || buildInitialHistory());
      setAdminStrain(data.adminStrain || 0);
      setAdminCap(data.adminCap || 50);
      setDaysElapsed(data.daysElapsed || 0);
      setArmy(data.army || {});
      setMilitaryQueue(data.militaryQueue || []);
      setSelectedTarget(data.selectedTarget || null);
      setBattleResult(data.battleResult || null);
      setMilitaryWageRatio(data.militaryWageRatio || 1.5);
      setFestivalModal(data.festivalModal || null);
      setActiveFestivalEffects(data.activeFestivalEffects || []);
      setLastFestivalYear(data.lastFestivalYear || 1);
      setShowTutorial(data.showTutorial ?? true);
      setLogs(data.logs || []);
      setClicks(data.clicks || []);
      setRates(data.rates || {});
      setTaxes(data.taxes || {
        total: 0,
        breakdown: { headTax: 0, industryTax: 0, subsidy: 0 },
        efficiency: 1,
      });
      setTaxPolicies(data.taxPolicies || {
        headTaxRates: buildDefaultHeadTaxRates(),
        resourceTaxRates: buildDefaultResourceTaxRates(),
      });
      setJobFill(data.jobFill || {});
      setMarket(data.market || buildInitialMarket());
      setMerchantState(data.merchantState || { trades: {} });
      setAutoSaveInterval(data.autoSaveInterval ?? 60);
      setIsAutoSaveEnabled(data.isAutoSaveEnabled ?? true);
      setLastAutoSaveTime(data.lastAutoSaveTime || Date.now());
      addLogEntry(source === 'auto' ? '📂 自动存档读取成功！' : '📂 读取存档成功！');
    } catch (error) {
      console.error('Load game failed:', error);
      addLogEntry(`❌ 读取存档失败：${error.message}`);
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
    
    // 建筑与科技
    buildings,
    setBuildings,
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
    populationDetailView,
    setPopulationDetailView,
    history,
    setHistory,
    
    // 行政管理
    adminStrain,
    setAdminStrain,
    adminCap,
    setAdminCap,
    
    // 军事系统
    army,
    setArmy,
    militaryQueue,
    setMilitaryQueue,
    battleResult,
    setBattleResult,
    militaryWageRatio,
    setMilitaryWageRatio,
    
    // 庆典系统
    festivalModal,
    setFestivalModal,
    activeFestivalEffects,
    setActiveFestivalEffects,
    lastFestivalYear,
    setLastFestivalYear,
    isPaused,
    setIsPaused,
    
    // 商人交易系统
    merchantState,
    setMerchantState,
    
    // 教程系统
    showTutorial,
    setShowTutorial,
    
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
    saveGame,
    loadGame,
    hasAutoSave,
    resetGame,
  };
};
