// 游戏状态管理钩子
// 集中管理所有游戏状态，避免App.jsx中状态定义过多

import { useState } from 'react';
import { DECREES, COUNTRIES, RESOURCES, STRATA } from '../config';

const INITIAL_RESOURCES = { 
  food: 200, 
  wood: 200, 
  stone: 200, 
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
  return COUNTRIES.map(nation => ({
    ...nation,
    relation: 50,
    warScore: nation.warScore ?? 0,
    isAtWar: nation.isAtWar ?? false,
    wealth: nation.wealth ?? 800,
    enemyLosses: 0,
    warDuration: 0,
    warStartDay: null,
  }));
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

  // ========== 政令与外交状态 ==========
  const [decrees, setDecrees] = useState(DECREES);
  const [nations, setNations] = useState(buildInitialNations()); 

  // ========== 社会阶层状态 ==========
  const [classApproval, setClassApproval] = useState({});
  const [classInfluence, setClassInfluence] = useState({});
  const [classWealth, setClassWealth] = useState(buildInitialWealth());
  const [classWealthDelta, setClassWealthDelta] = useState({});
  const [classWealthHistory, setClassWealthHistory] = useState(buildInitialWealthHistory());
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
  const [adminCap, setAdminCap] = useState(20);

  // ========== 时间状态 ==========
  const [daysElapsed, setDaysElapsed] = useState(0);

  // ========== 军事系统状态 ==========
  const [army, setArmy] = useState({});
  const [militaryQueue, setMilitaryQueue] = useState([]);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [battleResult, setBattleResult] = useState(null);
  const [militaryWageRatio, setMilitaryWageRatio] = useState(1.5);

  // ========== UI状态 ==========
  const [logs, setLogs] = useState(["文明的黎明已至，第 1 年春季从这里开启，请分配你的人民工作吧。"]);
  const [clicks, setClicks] = useState([]);
  const [rates, setRates] = useState({});
  const [taxes, setTaxes] = useState({
    total: 0,
    breakdown: { headTax: 0, industryTax: 0 },
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
