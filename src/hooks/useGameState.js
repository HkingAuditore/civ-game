// 游戏状态管理钩子
// 集中管理所有游戏状态，避免App.jsx中状态定义过多

import { useState } from 'react';
import { DECREES, COUNTRIES } from '../config/gameData';

/**
 * 游戏状态管理钩子
 * 集中管理所有游戏状态
 * @returns {Object} 包含所有状态和状态更新函数的对象
 */
export const useGameState = () => {
  // ========== 基础资源状态 ==========
  const [resources, setResources] = useState({ 
    food: 100, 
    wood: 100, 
    stone: 0, 
    plank: 0, 
    brick: 0, 
    iron: 0, 
    tools: 0, 
    gold: 0, 
    science: 0, 
    culture: 0, 
    admin: 0 
  });

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
  const [nations, setNations] = useState(COUNTRIES.map(c => ({ ...c, relation: 50 })));

  // ========== 社会阶层状态 ==========
  const [classApproval, setClassApproval] = useState({});
  const [classInfluence, setClassInfluence] = useState({});
  const [classWealth, setClassWealth] = useState({});
  const [totalInfluence, setTotalInfluence] = useState(0);
  const [totalWealth, setTotalWealth] = useState(0);
  const [activeBuffs, setActiveBuffs] = useState([]);
  const [activeDebuffs, setActiveDebuffs] = useState([]);
  const [stability, setStability] = useState(50);
  const [stratumDetailView, setStratumDetailView] = useState(null);

  // ========== 行政管理状态 ==========
  const [adminStrain, setAdminStrain] = useState(0);
  const [adminCap, setAdminCap] = useState(20);

  // ========== 军事系统状态 ==========
  const [army, setArmy] = useState({});
  const [militaryQueue, setMilitaryQueue] = useState([]);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [battleResult, setBattleResult] = useState(null);

  // ========== UI状态 ==========
  const [logs, setLogs] = useState(["文明的黎明已至，分配你的人民工作吧。"]);
  const [clicks, setClicks] = useState([]);
  const [rates, setRates] = useState({});

  // 返回所有状态和更新函数
  return {
    // 资源
    resources,
    setResources,
    
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
    
    // 社会阶层
    classApproval,
    setClassApproval,
    classInfluence,
    setClassInfluence,
    classWealth,
    setClassWealth,
    totalInfluence,
    setTotalInfluence,
    totalWealth,
    setTotalWealth,
    activeBuffs,
    setActiveBuffs,
    activeDebuffs,
    setActiveDebuffs,
    stability,
    setStability,
    stratumDetailView,
    setStratumDetailView,
    
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
    selectedTarget,
    setSelectedTarget,
    battleResult,
    setBattleResult,
    
    // UI
    logs,
    setLogs,
    clicks,
    setClicks,
    rates,
    setRates,
  };
};
