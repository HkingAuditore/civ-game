// 游戏状态管理钩子
// 集中管理所有游戏状态，避免App.jsx中状态定义过多

import { useState } from 'react';
import { DECREES, COUNTRIES, RESOURCES, STRATA } from '../config';

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

  // ========== 政令与外交状态 ==========
  const [decrees, setDecrees] = useState(DECREES);
  const [nations, setNations] = useState(buildInitialNations()); 

  // ========== 社会阶层状态 ==========
  const [classApproval, setClassApproval] = useState({});
  const [classInfluence, setClassInfluence] = useState({});
  const [classWealth, setClassWealth] = useState(buildInitialWealth());
  const [classWealthDelta, setClassWealthDelta] = useState({});
  const [classWealthHistory, setClassWealthHistory] = useState(buildInitialWealthHistory());
  const [classNeedsHistory, setClassNeedsHistory] = useState(buildInitialNeedsHistory());
  const [totalInfluence, setTotalInfluence] = useState(0);
  const [totalWealth, setTotalWealth] = useState(0);
  const [activeBuffs, setActiveBuffs] = useState([]);
  const [activeDebuffs, setActiveDebuffs] = useState([]);
  const [classInfluenceShift, setClassInfluenceShift] = useState({});
  const [stability, setStability] = useState(50);
  const [stratumDetailView, setStratumDetailView] = useState(null);
  const [classShortages, setClassShortages] = useState({});

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
    classShortages,
    setClassShortages,
    
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
  };
};
