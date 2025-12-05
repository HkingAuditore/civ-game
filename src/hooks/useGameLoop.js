// 游戏循环钩子
// 处理游戏的核心循环逻辑，包括资源生产、人口增长等

import { useEffect, useRef } from 'react';
import { simulateTick } from '../logic/simulation';
import { calculateArmyMaintenance, UNIT_TYPES, STRATA, RESOURCES } from '../config';
import { getRandomFestivalEffects } from '../config/festivalEffects'; 
import { initCheatCodes } from './cheatCodes';
import { getCalendarInfo } from '../utils/calendar';
import { calculateForeignPrice, calculateTradeStatus } from '../utils/foreignTrade';
import { createEnemyPeaceRequestEvent } from '../config/events';

/**
 * 处理贸易路线的自动执行
 * @param {Object} current - 当前游戏状态
 * @param {Object} result - simulateTick的结果
 * @param {Function} addLog - 添加日志函数
 * @param {Function} setResources - 设置资源函数
 * @param {Function} setNations - 设置国家函数
 * @param {Function} setTradeRoutes - 设置贸易路线函数
 */
const processTradeRoutes = (current, result, addLog, setResources, setNations, setTradeRoutes) => {
  const { tradeRoutes, nations, resources, daysElapsed, market, popStructure, taxPolicies } = current;
  const routes = tradeRoutes.routes || [];

  // 贸易路线配置
  const TRADE_SPEED = 0.05; // 每天传输盈余/缺口的5%
  const MIN_TRADE_AMOUNT = 0.1; // 最小贸易量

  // 获取在岗商人数量，决定有多少条贸易路线有效
  const merchantCount = popStructure?.merchant || 0;
  
  const routesToRemove = [];
  const tradeLog = [];
  let totalTradeTax = 0; // 玩家获得的贸易税

  // 只处理前 merchantCount 条贸易路线（有多少个商人在岗就让多少条贸易路线有用）
  routes.forEach((route, index) => {
    // 如果超过商人数量，则跳过该贸易路线
    if (index >= merchantCount) {
      return;
    }
    const { nationId, resource, type } = route;
    const nation = nations.find(n => n.id === nationId);
    
    if (!nation) {
      routesToRemove.push(route);
      return;
    }
    
    // 检查是否处于战争，如果是则暂停贸易路线
    if (nation.isAtWar) {
      return; // 不移除路线，只是暂停
    }
    
    // 获取贸易状态
    const tradeStatus = calculateTradeStatus(resource, nation, daysElapsed);
    const localPrice = market?.prices?.[resource] ?? (RESOURCES[resource]?.basePrice || 1);
    const foreignPrice = calculateForeignPrice(resource, nation, daysElapsed);
    
    if (type === 'export') {
      // 出口：商人在国内以国内价购买，在国外以国外价卖出
      // 玩家只赚取商人在国内购买时的交易税
      if (!tradeStatus.isShortage || tradeStatus.shortageAmount <= 0) {
        return; // 对方没有缺口，暂停贸易但保留路线
      }
      
      // 计算我方盈余
      const myInventory = resources[resource] || 0;
      const myTarget = 500; // 简化：使用固定目标库存
      const mySurplus = Math.max(0, myInventory - myTarget);
      
      if (mySurplus <= MIN_TRADE_AMOUNT) {
        return; // 我方没有盈余，暂停贸易但保留路线
      }
      
      // 计算本次出口量：取我方盈余和对方缺口的较小值，再乘以速度
      const exportAmount = Math.min(mySurplus, tradeStatus.shortageAmount) * TRADE_SPEED;
      
      if (exportAmount < MIN_TRADE_AMOUNT) {
        return;
      }
      
      // 商人在国内购买资源
      const domesticPurchaseCost = localPrice * exportAmount;  // 商人在国内的购买成本
      const taxRate = taxPolicies?.resourceTaxRates?.[resource] || 0; // 获取该资源的交易税率
      const tariffMultiplier = Math.max(0, taxPolicies?.resourceTariffMultipliers?.[resource] ?? 1);
      const effectiveTaxRate = taxRate * tariffMultiplier;
      const tradeTax = domesticPurchaseCost * effectiveTaxRate; // 玩家获得的交易税

      // 商人在国外销售
      const foreignSaleRevenue = foreignPrice * exportAmount;  // 商人在国外的销售收入
      const merchantProfit = foreignSaleRevenue - domesticPurchaseCost - tradeTax; // 商人获得的利润（含关税成本）

      if (merchantProfit <= 0) {
        return;
      }
      
      // 更新玩家资源：扣除出口的资源，获得交易税
      setResources(prev => ({
        ...prev,
        silver: (prev.silver || 0) + tradeTax,
        [resource]: Math.max(0, (prev[resource] || 0) - exportAmount),
      }));
      totalTradeTax += tradeTax;

      // 更新外国：支付给商人，获得资源
      setNations(prev => prev.map(n =>
        n.id === nationId
          ? {
              ...n,
              budget: Math.max(0, (n.budget || 0) - foreignSaleRevenue),
              inventory: {
                ...n.inventory,
                [resource]: ((n.inventory || {})[resource] || 0) + exportAmount,
              },
            }
          : n
      ));
      
      if (exportAmount >= 1) {
        tradeLog.push(`🚢 出口 ${exportAmount.toFixed(1)} ${RESOURCES[resource]?.name || resource} 至 ${nation.name}：商人国内购 ${domesticPurchaseCost.toFixed(1)} 银币（税 ${tradeTax.toFixed(1)}），国外售 ${foreignSaleRevenue.toFixed(1)} 银币，商人赚 ${merchantProfit.toFixed(1)} 银币。`);
      }
      
    } else if (type === 'import') {
      // 进口：商人在国外以国外价购买，在国内以国内价卖出
      // 玩家只赚取商人在国内销售时的交易税
      if (!tradeStatus.isSurplus || tradeStatus.surplusAmount <= 0) {
        return; // 对方没有盈余，暂停贸易但保留路线
      }
      
      // 计算本次进口量：对方盈余的一定比例
      const importAmount = tradeStatus.surplusAmount * TRADE_SPEED;
      
      if (importAmount < MIN_TRADE_AMOUNT) {
        return;
      }
      
      // 商人在国外购买资源
      const foreignPurchaseCost = foreignPrice * importAmount;  // 商人在国外的购买成本
      
      // 商人在国内销售
      const domesticSaleRevenue = localPrice * importAmount;  // 商人在国内的销售收入
      const taxRate = taxPolicies?.resourceTaxRates?.[resource] || 0; // 获取该资源的交易税率
      const tariffMultiplier = Math.max(0, taxPolicies?.resourceTariffMultipliers?.[resource] ?? 1);
      const effectiveTaxRate = taxRate * tariffMultiplier;
      const tradeTax = domesticSaleRevenue * effectiveTaxRate; // 玩家获得的交易税
      const merchantProfit = domesticSaleRevenue - foreignPurchaseCost - tradeTax; // 商人获得的利润（含关税成本）

      if (merchantProfit <= 0) {
        return;
      }
      
      // 商人需要有足够资金从国外购买（这里简化处理，假设商人总有足够资金）
      // 实际上商人的资金来自于之前的交易利润，这里不做详细模拟
      
      // 更新玩家资源：增加进口的资源，获得交易税
      setResources(prev => ({
        ...prev,
        silver: (prev.silver || 0) + tradeTax,
        [resource]: (prev[resource] || 0) + importAmount,
      }));
      totalTradeTax += tradeTax;

      // 更新外国：收到商人支付，失去资源
      setNations(prev => prev.map(n =>
        n.id === nationId
          ? {
              ...n,
              budget: (n.budget || 0) + foreignPurchaseCost,
              inventory: {
                ...n.inventory,
                [resource]: Math.max(0, ((n.inventory || {})[resource] || 0) - importAmount),
              },
            }
          : n
      ));
      
      if (importAmount >= 1) {
        tradeLog.push(`🚢 进口 ${importAmount.toFixed(1)} ${RESOURCES[resource]?.name || resource} 从 ${nation.name}：商人国外购 ${foreignPurchaseCost.toFixed(1)} 银币，国内售 ${domesticSaleRevenue.toFixed(1)} 银币（税 ${tradeTax.toFixed(1)}），商人赚 ${merchantProfit.toFixed(1)} 银币。`);
      }
    }
  });
  
  // 移除无效的贸易路线
  if (routesToRemove.length > 0) {
    setTradeRoutes(prev => ({
      ...prev,
      routes: prev.routes.filter(route => 
        !routesToRemove.some(r => 
          r.nationId === route.nationId && 
          r.resource === route.resource && 
          r.type === route.type
        )
      )
    }));
  }
  
  // 添加日志
  tradeLog.forEach(log => addLog(log));
  return { tradeTax: totalTradeTax };
};

const processTimedEventEffects = (effectState = {}, settings = {}) => {
  const approvalEffects = Array.isArray(effectState.approval) ? effectState.approval : [];
  const stabilityEffects = Array.isArray(effectState.stability) ? effectState.stability : [];
  const resourceDemandEffects = Array.isArray(effectState.resourceDemand) ? effectState.resourceDemand : [];
  const stratumDemandEffects = Array.isArray(effectState.stratumDemand) ? effectState.stratumDemand : [];
  const buildingProductionEffects = Array.isArray(effectState.buildingProduction) ? effectState.buildingProduction : [];
  
  const approvalModifiers = {};
  let stabilityModifier = 0;
  const resourceDemandModifiers = {};   // { resourceKey: totalModifier }
  const stratumDemandModifiers = {};    // { stratumKey: totalModifier }
  const buildingProductionModifiers = {}; // { buildingIdOrCat: totalModifier }
  
  const nextApprovalEffects = [];
  const nextStabilityEffects = [];
  const nextResourceDemandEffects = [];
  const nextStratumDemandEffects = [];
  const nextBuildingProductionEffects = [];

  const clampDecay = (value, fallback) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
    return Math.min(0.95, Math.max(0, value));
  };

  const approvalDurationDefault = Math.max(1, settings?.approval?.duration || 30);
  const approvalDecayDefault = clampDecay(settings?.approval?.decayRate ?? 0.04, 0.04);
  const stabilityDurationDefault = Math.max(1, settings?.stability?.duration || 30);
  const stabilityDecayDefault = clampDecay(settings?.stability?.decayRate ?? 0.04, 0.04);
  const resourceDemandDurationDefault = Math.max(1, settings?.resourceDemand?.duration || 60);
  const resourceDemandDecayDefault = clampDecay(settings?.resourceDemand?.decayRate ?? 0.02, 0.02);
  const stratumDemandDurationDefault = Math.max(1, settings?.stratumDemand?.duration || 60);
  const stratumDemandDecayDefault = clampDecay(settings?.stratumDemand?.decayRate ?? 0.02, 0.02);
  const buildingProductionDurationDefault = Math.max(1, settings?.buildingProduction?.duration || 45);
  const buildingProductionDecayDefault = clampDecay(settings?.buildingProduction?.decayRate ?? 0.025, 0.025);

  // Process approval effects
  approvalEffects.forEach(effect => {
    const currentValue = typeof effect.currentValue === 'number' ? effect.currentValue : 0;
    const remainingDays = effect.remainingDays ?? approvalDurationDefault;
    if (remainingDays <= 0 || Math.abs(currentValue) < 0.001) {
      return;
    }
    const stratum = effect.stratum;
    if (!stratum) {
      return;
    }
    approvalModifiers[stratum] = (approvalModifiers[stratum] || 0) + currentValue;
    const decayRate = clampDecay(effect.decayRate, approvalDecayDefault);
    const nextValue = currentValue * (1 - decayRate);
    const nextRemaining = remainingDays - 1;
    if (nextRemaining > 0 && Math.abs(nextValue) >= 0.001) {
      nextApprovalEffects.push({
        ...effect,
        currentValue: nextValue,
        remainingDays: nextRemaining,
      });
    }
  });

  // Process stability effects
  stabilityEffects.forEach(effect => {
    const currentValue = typeof effect.currentValue === 'number' ? effect.currentValue : 0;
    const remainingDays = effect.remainingDays ?? stabilityDurationDefault;
    if (remainingDays <= 0 || Math.abs(currentValue) < 0.001) {
      return;
    }
    stabilityModifier += currentValue;
    const decayRate = clampDecay(effect.decayRate, stabilityDecayDefault);
    const nextValue = currentValue * (1 - decayRate);
    const nextRemaining = remainingDays - 1;
    if (nextRemaining > 0 && Math.abs(nextValue) >= 0.001) {
      nextStabilityEffects.push({
        ...effect,
        currentValue: nextValue,
        remainingDays: nextRemaining,
      });
    }
  });

  // Process resource demand effects
  resourceDemandEffects.forEach(effect => {
    const currentValue = typeof effect.currentValue === 'number' ? effect.currentValue : 0;
    const remainingDays = effect.remainingDays ?? resourceDemandDurationDefault;
    if (remainingDays <= 0 || Math.abs(currentValue) < 0.001) {
      return;
    }
    const target = effect.target;
    if (!target) return;
    resourceDemandModifiers[target] = (resourceDemandModifiers[target] || 0) + currentValue;
    const decayRate = clampDecay(effect.decayRate, resourceDemandDecayDefault);
    const nextValue = currentValue * (1 - decayRate);
    const nextRemaining = remainingDays - 1;
    if (nextRemaining > 0 && Math.abs(nextValue) >= 0.001) {
      nextResourceDemandEffects.push({
        ...effect,
        currentValue: nextValue,
        remainingDays: nextRemaining,
      });
    }
  });

  // Process stratum demand effects
  stratumDemandEffects.forEach(effect => {
    const currentValue = typeof effect.currentValue === 'number' ? effect.currentValue : 0;
    const remainingDays = effect.remainingDays ?? stratumDemandDurationDefault;
    if (remainingDays <= 0 || Math.abs(currentValue) < 0.001) {
      return;
    }
    const target = effect.target;
    if (!target) return;
    stratumDemandModifiers[target] = (stratumDemandModifiers[target] || 0) + currentValue;
    const decayRate = clampDecay(effect.decayRate, stratumDemandDecayDefault);
    const nextValue = currentValue * (1 - decayRate);
    const nextRemaining = remainingDays - 1;
    if (nextRemaining > 0 && Math.abs(nextValue) >= 0.001) {
      nextStratumDemandEffects.push({
        ...effect,
        currentValue: nextValue,
        remainingDays: nextRemaining,
      });
    }
  });

  // Process building production effects
  buildingProductionEffects.forEach(effect => {
    const currentValue = typeof effect.currentValue === 'number' ? effect.currentValue : 0;
    const remainingDays = effect.remainingDays ?? buildingProductionDurationDefault;
    if (remainingDays <= 0 || Math.abs(currentValue) < 0.001) {
      return;
    }
    const target = effect.target;
    if (!target) return;
    buildingProductionModifiers[target] = (buildingProductionModifiers[target] || 0) + currentValue;
    const decayRate = clampDecay(effect.decayRate, buildingProductionDecayDefault);
    const nextValue = currentValue * (1 - decayRate);
    const nextRemaining = remainingDays - 1;
    if (nextRemaining > 0 && Math.abs(nextValue) >= 0.001) {
      nextBuildingProductionEffects.push({
        ...effect,
        currentValue: nextValue,
        remainingDays: nextRemaining,
      });
    }
  });

  return {
    approvalModifiers,
    stabilityModifier,
    resourceDemandModifiers,
    stratumDemandModifiers,
    buildingProductionModifiers,
    nextEffects: {
      approval: nextApprovalEffects,
      stability: nextStabilityEffects,
      resourceDemand: nextResourceDemandEffects,
      stratumDemand: nextStratumDemandEffects,
      buildingProduction: nextBuildingProductionEffects,
    },
  };
};

/**
 * 游戏循环钩子
 * 处理游戏的核心循环逻辑
 * @param {Object} gameState - 游戏状态对象
 * @param {Function} addLog - 添加日志函数
 * @param {Object} actions - 游戏操作函数集
 */
export const useGameLoop = (gameState, addLog, actions) => {
  const {
    resources,
    setResources,
    market,
    setMarket,
    buildings,
    population,
    popStructure,
    setPopulation,
    epoch,
    techsUnlocked,
    decrees,
    gameSpeed,
    isPaused,
    setIsPaused,
    nations,
    setNations,
    setPopStructure,
    setMaxPop,
    maxPopBonus,
    setRates,
    setTaxes,
    setClassApproval,
    classApproval,
    setClassInfluence,
    setClassWealth,
    setClassWealthDelta,
    setClassIncome,
    setClassExpense,
    classWealthHistory,
    setClassWealthHistory,
    classNeedsHistory,
    setClassNeedsHistory,
    setTotalInfluence,
    setTotalWealth,
    setActiveBuffs,
    setActiveDebuffs,
    setStability,
    setLogs,
    taxPolicies,
    classWealth,
    setClassShortages,
    activeBuffs,
    activeDebuffs,
    army,
    setArmy,
    militaryQueue,
    setMilitaryQueue,
    jobFill,
    setJobFill,
    jobsAvailable,
    setJobsAvailable,
    setDaysElapsed,
    daysElapsed,
    militaryWageRatio,
    classInfluenceShift,
    setClassInfluenceShift,
    setFestivalModal,
    activeFestivalEffects,
    setActiveFestivalEffects,
    lastFestivalYear,
    setLastFestivalYear,
    setHistory,
    autoSaveInterval,
    isAutoSaveEnabled,
    lastAutoSaveTime,
    saveGame,
    merchantState,
    setMerchantState,
    tradeRoutes,
    setTradeRoutes,
    tradeStats,
    setTradeStats,
    activeEventEffects,
    setActiveEventEffects,
    eventEffectSettings,
  } = gameState;

  // 使用ref保存最新状态，避免闭包问题
  const stateRef = useRef({
    resources,
    market,
    buildings,
    population,
    popStructure,
    maxPopBonus,
    epoch,
    techsUnlocked,
    decrees,
    gameSpeed,
    nations,
    classWealth,
    army,
    militaryQueue,
    jobFill,
    jobsAvailable,
    activeBuffs,
    activeDebuffs,
    taxPolicies,
    classWealthHistory,
    classNeedsHistory,
    militaryWageRatio,
    classApproval,
    daysElapsed,
    activeFestivalEffects,
    lastFestivalYear,
    isPaused,
    autoSaveInterval,
    isAutoSaveEnabled,
    lastAutoSaveTime,
    merchantState,
    tradeRoutes,
    actions,
    tradeStats,
    activeEventEffects,
    eventEffectSettings,
  });

  const saveGameRef = useRef(gameState.saveGame);

  useEffect(() => {
    saveGameRef.current = gameState.saveGame;
  }, [gameState.saveGame]);

  useEffect(() => {
    stateRef.current = {
      resources,
      market,
      buildings,
      population,
      epoch,
      popStructure,
      maxPopBonus,
      techsUnlocked,
      decrees,
      gameSpeed,
      nations,
      classWealth,
      army,
      militaryQueue,
      jobFill,
      activeBuffs,
      activeDebuffs,
      taxPolicies,
      classWealthHistory,
      classNeedsHistory,
      militaryWageRatio,
      classApproval,
      daysElapsed,
      activeFestivalEffects,
      lastFestivalYear,
      isPaused,
      autoSaveInterval,
      isAutoSaveEnabled,
      lastAutoSaveTime,
      merchantState,
      tradeRoutes,
      actions,
      tradeStats,
      activeEventEffects,
      eventEffectSettings,
    };
  }, [resources, market, buildings, population, popStructure, maxPopBonus, epoch, techsUnlocked, decrees, gameSpeed, nations, classWealth, army, militaryQueue, jobFill, jobsAvailable, activeBuffs, activeDebuffs, taxPolicies, classWealthHistory, classNeedsHistory, militaryWageRatio, classApproval, daysElapsed, activeFestivalEffects, lastFestivalYear, isPaused, autoSaveInterval, isAutoSaveEnabled, lastAutoSaveTime, merchantState, tradeRoutes, tradeStats, actions, activeEventEffects, eventEffectSettings]);

  // 游戏核心循环
  useEffect(() => {
    // 初始化作弊码系统
    if (process.env.NODE_ENV !== 'production') {
      initCheatCodes(gameState, addLog);
    }

    // 暂停时不设置游戏循环定时器，但自动保存定时器需要单独处理
    if (isPaused) {
      // 设置独立的自动保存定时器
      const autoSaveTimer = setInterval(() => {
        const current = stateRef.current;
        if (current.isAutoSaveEnabled) {
          const intervalSeconds = Math.max(5, current.autoSaveInterval || 60);
          const elapsed = Date.now() - (current.lastAutoSaveTime || 0);
          if (elapsed >= intervalSeconds * 1000 && saveGameRef.current) {
            saveGameRef.current({ source: 'auto' });
            stateRef.current.lastAutoSaveTime = Date.now();
          }
        }
      }, 1000);
      
      return () => clearInterval(autoSaveTimer);
    }

    // 计算 Tick 间隔：基于游戏速度动态调整
    // 1倍速 = 1000ms，2倍速 = 500ms，5倍速 = 200ms
    const tickInterval = 1000 / Math.max(1, gameSpeed);

    const timer = setInterval(() => {
      const current = stateRef.current;

      // 自动存档检测：即使暂停也照常运行，避免长时间停留丢进度
      if (current.isAutoSaveEnabled) {
        const intervalSeconds = Math.max(5, current.autoSaveInterval || 60);
        const elapsed = Date.now() - (current.lastAutoSaveTime || 0);
        if (elapsed >= intervalSeconds * 1000 && saveGameRef.current) {
          saveGameRef.current({ source: 'auto' });
          stateRef.current.lastAutoSaveTime = Date.now();
        }
      }
      
      // 检查是否需要触发年度庆典
      // 修复：检测年份变化而非特定日期，避免加速模式下跳过触发点
      const currentCalendar = getCalendarInfo(current.daysElapsed || 0);
      // 注意：这里使用 1 而非 current.gameSpeed，因为现在每次 Tick 只推进 1 天
      const nextCalendar = getCalendarInfo((current.daysElapsed || 0) + 1);
      
      // 如果当前年份大于上次庆典年份，且即将跨越或已经跨越新年
      if (currentCalendar.year > (current.lastFestivalYear || 0)) {
        // 新的一年开始，触发庆典
        const festivalOptions = getRandomFestivalEffects(current.epoch);
        if (festivalOptions.length > 0) {
          setFestivalModal({
            options: festivalOptions,
            year: currentCalendar.year
          });
          setLastFestivalYear(currentCalendar.year);
          setIsPaused(true);
        }
      }
      
      // 执行游戏模拟
      // 【关键】强制将 gameSpeed 设为 1，确保单次 Tick 只计算 1 个单位时间的产出
      // 原因：我们已经通过调整 setInterval 的频率来实现加速（时间流）
      // 如果这里不归一化，simulateTick 内部会再次乘以 gameSpeed，导致倍率叠加
      // 例如：5倍速时，频率已经是 5 倍（200ms/次），如果再传 gameSpeed=5，
      // 实际速度会变成 25 倍（5×5），这是错误的
      const { 
        approvalModifiers, 
        stabilityModifier, 
        resourceDemandModifiers,
        stratumDemandModifiers,
        buildingProductionModifiers,
        nextEffects 
      } = processTimedEventEffects(
        current.activeEventEffects,
        current.eventEffectSettings,
      );
      const result = simulateTick({
        ...current,
        tick: current.daysElapsed || 0,
        gameSpeed: 1, // 强制归一化为 1，防止倍率叠加
        activeFestivalEffects: current.activeFestivalEffects || [],
        eventApprovalModifiers: approvalModifiers,
        eventStabilityModifier: stabilityModifier,
        // Economic modifiers from events
        eventResourceDemandModifiers: resourceDemandModifiers,
        eventStratumDemandModifiers: stratumDemandModifiers,
        eventBuildingProductionModifiers: buildingProductionModifiers,
      });

      const hadActiveEffects =
        (current.activeEventEffects?.approval?.length || 0) > 0 ||
        (current.activeEventEffects?.stability?.length || 0) > 0;

      const maintenance = calculateArmyMaintenance(army);
      const adjustedResources = { ...result.resources };
      Object.entries(maintenance).forEach(([resource, cost]) => {
        // 每次 Tick 计算 1 天的维护费用（不再乘以 gameSpeed）
        const amount = cost;
        if (amount <= 0) return;
        adjustedResources[resource] = Math.max(0, (adjustedResources[resource] || 0) - amount);
      });
      setResources(adjustedResources);

      if (hadActiveEffects) {
        setActiveEventEffects(nextEffects);
      }

      const adjustedClassWealth = { ...result.classWealth };
      const adjustedTotalWealth = Object.values(adjustedClassWealth).reduce((sum, val) => sum + val, 0);

      // --- 市场数据历史记录更新 ---
      const previousPriceHistory = current.market?.priceHistory || {};
      const priceHistory = { ...previousPriceHistory };

      const previousSupplyHistory = current.market?.supplyHistory || {};
      const supplyHistory = { ...previousSupplyHistory };

      const previousDemandHistory = current.market?.demandHistory || {};
      const demandHistory = { ...previousDemandHistory };

      const MAX_MARKET_HISTORY_POINTS = 60;

      Object.keys(result.market?.prices || {}).forEach(resource => {
        const price = result.market?.prices?.[resource];

        if (!priceHistory[resource]) priceHistory[resource] = [];
        priceHistory[resource] = [...priceHistory[resource], price];
        if (priceHistory[resource].length > MAX_MARKET_HISTORY_POINTS) {
          priceHistory[resource].shift();
        }

        if (!supplyHistory[resource]) supplyHistory[resource] = [];
        supplyHistory[resource] = [
          ...supplyHistory[resource],
          result.market?.supply?.[resource] || 0,
        ];
        if (supplyHistory[resource].length > MAX_MARKET_HISTORY_POINTS) {
          supplyHistory[resource].shift();
        }

        if (!demandHistory[resource]) demandHistory[resource] = [];
        demandHistory[resource] = [
          ...demandHistory[resource],
          result.market?.demand?.[resource] || 0,
        ];
        if (demandHistory[resource].length > MAX_MARKET_HISTORY_POINTS) {
          demandHistory[resource].shift();
        }
      });

      const previousWealthHistory = current.classWealthHistory || {};
      const wealthHistory = { ...previousWealthHistory };
      const MAX_WEALTH_POINTS = 120;
      Object.entries(result.classWealth || {}).forEach(([key, value]) => {
        const series = wealthHistory[key] ? [...wealthHistory[key]] : [];
        series.push(value);
        if (series.length > MAX_WEALTH_POINTS) {
          series.shift();
        }
        wealthHistory[key] = series;
      });

      const previousNeedsHistory = current.classNeedsHistory || {};
      const needsHistory = { ...previousNeedsHistory };
      const MAX_NEEDS_POINTS = 120;
      Object.entries(result.needsReport || {}).forEach(([key, report]) => {
        const series = needsHistory[key] ? [...needsHistory[key]] : [];
        series.push(report.satisfactionRatio);
        if (series.length > MAX_NEEDS_POINTS) {
          series.shift();
        }
        needsHistory[key] = series;
      });

      const adjustedMarket = {
        ...(result.market || {}),
        priceHistory,
        supplyHistory,
        demandHistory,
      };

      const MAX_HISTORY_POINTS = 90;
      setHistory(prevHistory => {
        const appendValue = (series = [], value) => {
          const nextSeries = [...series, value];
          if (nextSeries.length > MAX_HISTORY_POINTS) {
            nextSeries.shift();
          }
          return nextSeries;
        };

        const safeHistory = prevHistory || {};
        const nextHistory = {
          ...safeHistory,
          treasury: appendValue(safeHistory.treasury, result.resources?.silver || 0),
          tax: appendValue(safeHistory.tax, result.taxes?.total || 0),
          population: appendValue(safeHistory.population, result.population || 0),
        };

        const previousClassHistory = safeHistory.class || {};
        const classHistory = { ...previousClassHistory };
        Object.keys(STRATA).forEach(key => {
          const entry = previousClassHistory[key] || { pop: [], income: [], expense: [] };
          classHistory[key] = {
            pop: appendValue(entry.pop, result.popStructure?.[key] || 0),
            income: appendValue(entry.income, result.classIncome?.[key] || 0),
            expense: appendValue(entry.expense, result.classExpense?.[key] || 0),
          };
        });
        nextHistory.class = classHistory;
        return nextHistory;
      });

      // 更新所有状态
      setPopStructure(result.popStructure);
      setMaxPop(result.maxPop);
      setRates(result.rates);      // 由于现在每次 Tick 都是 1 天的产出，rates 已经是每天的速率，无需再除以 gameSpeed
      setRates(result.rates || {});
      setClassApproval(result.classApproval);
      const adjustedInfluence = { ...(result.classInfluence || {}) };
      Object.entries(classInfluenceShift || {}).forEach(([key, delta]) => {
        if (!delta) return;
        adjustedInfluence[key] = (adjustedInfluence[key] || 0) + delta;
      });
      setClassInfluence(adjustedInfluence);
      const wealthDelta = {};
      Object.keys(adjustedClassWealth).forEach(key => {
        const prevWealth = current.classWealth?.[key] || 0;
        wealthDelta[key] = adjustedClassWealth[key] - prevWealth;
      });
      setClassWealth(adjustedClassWealth);
      setClassWealthDelta(wealthDelta);
      setClassIncome(result.classIncome || {});
      setClassExpense(result.classExpense || {});
      setClassWealthHistory(wealthHistory);
      setClassNeedsHistory(needsHistory);
      setTotalInfluence(result.totalInfluence);
      setTotalWealth(adjustedTotalWealth);
      setActiveBuffs(result.activeBuffs);
      setActiveDebuffs(result.activeDebuffs);
      setStability(result.stability);
      setTaxes(result.taxes || {
        total: 0,
        breakdown: { headTax: 0, industryTax: 0, subsidy: 0, policyIncome: 0, policyExpense: 0 },
        efficiency: 1,
      });
      setMarket(adjustedMarket);
      setClassShortages(result.needsShortages || {});
      setMerchantState(prev => {
        const nextState = result.merchantState || current.merchantState || { pendingTrades: [], lastTradeTime: 0 };
        if (prev === nextState) {
          return prev;
        }
        return nextState;
      });
      if (result.nations) {
        setNations(result.nations);
      }
      if (result.jobFill) {
        setJobFill(result.jobFill);
      }
      if (result.jobsAvailable) {
        setJobsAvailable(result.jobsAvailable);
      }
      // 每次 Tick 推进 1 天（而非 gameSpeed 天）
      // 加速效果通过增加 Tick 频率实现，而非增加每次推进的天数
      setDaysElapsed(prev => prev + 1);
      
      // 处理贸易路线并记录贸易税收入
      let tradeTax = 0;
      if (current.tradeRoutes && current.tradeRoutes.routes && current.tradeRoutes.routes.length > 0) {
        const summary = processTradeRoutes(current, result, addLog, setResources, setNations, setTradeRoutes);
        if (summary) {
          tradeTax = summary.tradeTax || 0;
        }
      }
      setTradeStats({ tradeTax });
      
      // 处理玩家的分期支付
      if (gameState.playerInstallmentPayment && gameState.playerInstallmentPayment.remainingDays > 0) {
        const payment = gameState.playerInstallmentPayment;
        const paymentAmount = payment.amount;
        
        if ((current.resources.silver || 0) >= paymentAmount) {
          setResources(prev => ({
            ...prev,
            silver: (prev.silver || 0) - paymentAmount
          }));
          
          gameState.setPlayerInstallmentPayment(prev => ({
            ...prev,
            paidAmount: prev.paidAmount + paymentAmount,
            remainingDays: prev.remainingDays - 1
          }));
          
          if (payment.remainingDays === 1) {
            addLog(`💰 你完成了所有分期赔款支付（共${payment.totalAmount}银币）。`);
            gameState.setPlayerInstallmentPayment(null);
          }
        } else {
          // 银币不足，违约
          addLog(`⚠️ 银币不足，无法支付分期赔款！和平协议被破坏。`);
          setNations(prev => prev.map(n =>
            n.id === payment.nationId
              ? {
                  ...n,
                  isAtWar: true,
                  warStartDay: current.daysElapsed || 0,
                  warDuration: 0,
                  relation: Math.max(0, (n.relation || 0) - 50),
                  peaceTreatyUntil: undefined,
                }
              : n
          ));
          gameState.setPlayerInstallmentPayment(null);
        }
      }
      
      // 更新庆典效果，移除过期的短期效果
      if (activeFestivalEffects.length > 0) {
        const updatedEffects = activeFestivalEffects.filter(effect => {
          if (effect.type === 'permanent') return true;
          const elapsedSinceActivation = (current.daysElapsed || 0) - (effect.activatedAt || 0);
          return elapsedSinceActivation < (effect.duration || 360);
        });
        if (updatedEffects.length !== activeFestivalEffects.length) {
          setActiveFestivalEffects(updatedEffects);
        }
      }

      setClassInfluenceShift(prev => {
        if (!prev || Object.keys(prev).length === 0) return prev || {};
        const next = {};
        Object.entries(prev).forEach(([key, value]) => {
          const decayed = value * 0.9;
          if (Math.abs(decayed) >= 0.1) {
            next[key] = decayed;
          }
        });
        return Object.keys(next).length > 0 ? next : {};
      });

      // 更新人口（如果有变化）
      if (result.population !== current.population) {
        setPopulation(result.population);
      }

      // 添加新日志
      if (result.logs.length) {
        setLogs(prev => [...result.logs, ...prev].slice(0, 8));
        
        // 检测外交事件并触发事件系统
        const currentActions = current.actions;
        console.log('[EVENT DEBUG] actions:', !!currentActions, 'triggerDiplomaticEvent:', !!currentActions?.triggerDiplomaticEvent);
        if (currentActions && currentActions.triggerDiplomaticEvent) {
          console.log('[EVENT DEBUG] Checking logs:', result.logs);
          console.log('[EVENT DEBUG] Total logs count:', result.logs.length);

          // 先解析突袭事件日志，触发战斗结果弹窗
          const raidLogEntry = Array.isArray(result.logs)
            ? result.logs.find((log) => typeof log === 'string' && log.includes('RAID_EVENT'))
            : null;
          if (raidLogEntry && currentActions.setBattleResult) {
            try {
              const jsonStart = raidLogEntry.indexOf('{');
              if (jsonStart !== -1) {
                const raidJson = raidLogEntry.slice(jsonStart);
                const raidData = JSON.parse(raidJson);

                let description = `${raidData.nationName}发动了突袭！\n\n`;
                if (raidData.victory) {
                  description += '你的军队成功击退了突袭！\n\n';
                  description += '战斗力对比：\n';
                  description += `我方：${raidData.ourPower || 0}\n`;
                  description += `敌方：${raidData.enemyPower || 0}\n`;
                  if (raidData.battleReport && raidData.battleReport.length > 0) {
                    description += '\n' + raidData.battleReport.join('\n');
                  }
                } else {
                  if (!raidData.ourPower) {
                    description += '你没有军队防御，突袭成功！\n\n';
                  } else {
                    description += '你的军队未能阻止突袭！\n\n';
                    description += '战斗力对比：\n';
                    description += `我方：${raidData.ourPower || 0}\n`;
                    description += `敌方：${raidData.enemyPower || 0}\n`;
                    if (raidData.battleReport && raidData.battleReport.length > 0) {
                      description += '\n' + raidData.battleReport.join('\n');
                    }
                  }
                  description += '\n突袭损失：\n';
                  if (raidData.foodLoss > 0) description += `粮食：${raidData.foodLoss}\n`;
                  if (raidData.silverLoss > 0) description += `银币：${raidData.silverLoss}\n`;
                  if (raidData.popLoss > 0) description += `人口：${raidData.popLoss}\n`;
                }

                const battleResult = {
                  victory: !!raidData.victory,
                  missionName: `${raidData.nationName}的突袭`,
                  missionDesc: raidData.victory
                    ? '你成功击退了敌方的突袭！'
                    : '敌方趁你不备发动了突袭！',
                  nationName: raidData.nationName,
                  ourPower: raidData.ourPower || 0,
                  enemyPower: raidData.enemyPower || 0,
                  powerRatio:
                    (raidData.enemyPower || 0) > 0
                      ? (raidData.ourPower || 0) / raidData.enemyPower
                      : 0,
                  score: 0,
                  losses: raidData.defenderLosses || {},
                  attackerLosses: raidData.attackerLosses || {},
                  enemyLosses: raidData.attackerLosses || {},
                  defenderLosses: raidData.defenderLosses || {},
                  resourcesGained: {},
                  description,
                  foodLoss: raidData.foodLoss || 0,
                  silverLoss: raidData.silverLoss || 0,
                  popLoss: raidData.popLoss || 0,
                  isRaid: true,
                };

                console.log('[EVENT DEBUG] Raid battle result created (pre-loop):', battleResult);
                currentActions.setBattleResult(battleResult);
              }
            } catch (e) {
              console.error('[EVENT DEBUG] Failed to parse raid event log:', e);
            }
          }

          result.logs.forEach((log, index) => {
            console.log(`[EVENT DEBUG] Log ${index}:`, log);
            console.log(`[EVENT DEBUG] Log ${index} includes RAID_EVENT:`, log.includes('❗RAID_EVENT❗'));
            // 检测宣战事件
            if (log.includes('对你发动了战争')) {
              const match = log.match(/⚠️ (.+) 对你发动了战争/);
              if (match) {
                const nationName = match[1];
                const nation = result.nations?.find(n => n.name === nationName);
                if (nation) {
                  const { createWarDeclarationEvent } = require('../config/events');
                  const event = createWarDeclarationEvent(nation, () => {
                    // 宣战事件只需要确认，不需要额外操作
                  });
                  currentActions.triggerDiplomaticEvent(event);
                }
              }
            }
            
            // 检测和平请求事件
            if (log.includes('请求和平')) {
              console.log('[EVENT DEBUG] Peace request detected in log:', log);
              const match = log.match(/🤝 (.+) 请求和平，愿意支付 (\d+) 银币作为赔款/);
              console.log('[EVENT DEBUG] Regex match result:', match);
              if (match) {
                const nationName = match[1];
                const tribute = parseInt(match[2], 10);
                console.log('[EVENT DEBUG] Looking for nation:', nationName);
                console.log('[EVENT DEBUG] result.nations:', result.nations?.map(n => ({ name: n.name, isPeaceRequesting: n.isPeaceRequesting })));
                const nation = result.nations?.find(n => n.name === nationName);
                console.log('[EVENT DEBUG] Found nation:', nation?.name, 'isPeaceRequesting:', nation?.isPeaceRequesting);
                if (nation && nation.isPeaceRequesting) {
                  console.log('[EVENT DEBUG] Creating peace request event...');
                  console.log('[EVENT DEBUG] Parameters:', { 
                    nation: nation.name, 
                    nationId: nation.id,
                    tribute, 
                    warScore: nation.warScore || 0,
                    population: nation.population 
                  });
                  try {
                    const event = createEnemyPeaceRequestEvent(
                      nation, 
                      tribute,
                      nation.warScore || 0,
                      (accepted, proposalType, amount) => {
                        // 处理和平请求的回调
                        if (accepted) {
                          currentActions.handleEnemyPeaceAccept(nation.id, proposalType, amount || tribute);
                        } else {
                          currentActions.handleEnemyPeaceReject(nation.id);
                        }
                      }
                    );
                    console.log('[EVENT DEBUG] Event created:', event);
                    console.log('[EVENT DEBUG] Calling triggerDiplomaticEvent...');
                    currentActions.triggerDiplomaticEvent(event);
                    console.log('[EVENT DEBUG] triggerDiplomaticEvent called');
                  } catch (error) {
                    console.error('[EVENT DEBUG] Error creating or triggering event:', error);
                  }
                  // 清除和平请求标志，避免重复触发
                  setNations(prev => prev.map(n => 
                    n.id === nation.id ? { ...n, isPeaceRequesting: false } : n
                  ));
                }
              }
            }
            
            // 检测突袭事件（使用BattleResultModal显示）
            if (log.includes('❗RAID_EVENT❗')) {
              console.log('[EVENT DEBUG] Raid detected in log:', log);
              try {
                // 解析JSON格式的突袭数据
                const jsonStr = log.replace('❗RAID_EVENT❗', '');
                const raidData = JSON.parse(jsonStr);
                console.log('[EVENT DEBUG] Parsed raid data:', raidData);
                
                const nation = result.nations?.find(n => n.name === raidData.nationName);
                console.log('[EVENT DEBUG] Found nation for raid:', nation?.name);
                
                if (nation && currentActions.setBattleResult) {
                  console.log('[EVENT DEBUG] Creating raid battle result...');
                  
                  // 构造战斗描述
                  let description = `${raidData.nationName}发动了突袭！\n\n`;
                  
                  if (raidData.victory) {
                    // 玩家胜利
                    description += '✓ 你的军队成功击退了突袭！\n\n';
                    description += `战斗力对比：\n`;
                    description += `我方：${raidData.ourPower}\n`;
                    description += `敌方：${raidData.enemyPower}\n\n`;
                    
                    if (raidData.battleReport && raidData.battleReport.length > 0) {
                      description += raidData.battleReport.join('\n');
                    }
                  } else {
                    // 玩家失败
                    if (raidData.ourPower === 0) {
                      description += '✗ 你没有军队防御，突袭成功！\n\n';
                    } else {
                      description += '✗ 你的军队未能阻止突袭！\n\n';
                      description += `战斗力对比：\n`;
                      description += `我方：${raidData.ourPower}\n`;
                      description += `敌方：${raidData.enemyPower}\n\n`;
                      
                      if (raidData.battleReport && raidData.battleReport.length > 0) {
                        description += raidData.battleReport.join('\n') + '\n\n';
                      }
                    }
                    
                    description += `突袭损失：\n`;
                    if (raidData.foodLoss > 0) description += `粮食：-${raidData.foodLoss}\n`;
                    if (raidData.silverLoss > 0) description += `银币：-${raidData.silverLoss}\n`;
                    if (raidData.popLoss > 0) description += `人口：-${raidData.popLoss}\n`;
                  }
                  
                  // 构造符合BattleResultModal要求的battleResult对象
                  const battleResult = {
                    victory: raidData.victory,
                    missionName: `${raidData.nationName}的突袭`,
                    missionDesc: raidData.victory ? '你成功击退了敌方的突袭！' : '敌方趁你不备发动了突袭！',
                    nationName: raidData.nationName,
                    ourPower: raidData.ourPower || 0,
                    enemyPower: raidData.enemyPower || 0,
                    powerRatio: raidData.enemyPower > 0 ? raidData.ourPower / raidData.enemyPower : 0,
                    score: 0,
                    losses: raidData.defenderLosses || {},
                    attackerLosses: raidData.attackerLosses || {},
                    enemyLosses: raidData.attackerLosses || {},
                    defenderLosses: raidData.defenderLosses || {},
                    resourcesGained: {}, // 突袭防御成功也没有战利品
                    description,
                    // 添加突袭特有的损失信息
                    foodLoss: raidData.foodLoss || 0,
                    silverLoss: raidData.silverLoss || 0,
                    popLoss: raidData.popLoss || 0,
                    isRaid: true, // 标记这是突袭事件
                  };
                  
                  console.log('[EVENT DEBUG] Raid battle result created:', battleResult);
                  currentActions.setBattleResult(battleResult);
                  console.log('[EVENT DEBUG] setBattleResult called');
                }
              } catch (error) {
                console.error('[EVENT DEBUG] Error parsing or processing raid event:', error);
              }
            }
          });
        }
      }
      
      // 处理训练队列
      setMilitaryQueue(prev => {
        // 检查当前soldier岗位的填补情况
        const currentSoldierPop = result.popStructure?.soldier || 0;
        const currentArmyCount = Object.values(current.army).reduce((sum, count) => sum + count, 0);
        
        // 计算有多少岗位可以用于新训练
        // 只计算已有军队和正在训练的，waiting状态的就是等待转为training的
        const waitingCount = prev.filter(item => item.status === 'waiting').length;
        const trainingCount = prev.filter(item => item.status === 'training').length;
        const occupiedJobs = currentArmyCount + trainingCount;
        const availableJobsForNewTraining = Math.max(0, currentSoldierPop - occupiedJobs);
        
        console.log('[TRAINING QUEUE] currentSoldierPop:', currentSoldierPop, 'currentArmyCount:', currentArmyCount, 'waitingCount:', waitingCount, 'trainingCount:', trainingCount, 'occupiedJobs:', occupiedJobs, 'availableJobsForNewTraining:', availableJobsForNewTraining);
        
        // 将等待中的项转为训练中（如果有可用岗位）
        let jobsToFill = availableJobsForNewTraining;
        const updated = prev.map(item => {
          if (item.status === 'waiting' && jobsToFill > 0) {
            jobsToFill--;
            addLog(`✓ ${UNIT_TYPES[item.unitId].name} 开始训练，需要 ${item.totalTime} 秒`);
            return {
              ...item,
              status: 'training',
              remainingTime: item.totalTime
            };
          }
          // 只对训练中的项进行倒计时
          if (item.status === 'training') {
            return {
              ...item,
              remainingTime: item.remainingTime - 1
            };
          }
          return item;
        });
        
        // 找出已完成的训练
        const completed = updated.filter(item => item.status === 'training' && item.remainingTime <= 0);
        if (completed.length > 0) {
          // 将完成的单位加入军队
          setArmy(prevArmy => {
            const newArmy = { ...prevArmy };
            completed.forEach(item => {
              newArmy[item.unitId] = (newArmy[item.unitId] || 0) + 1;
            });
            return newArmy;
          });
          
          // 添加完成日志
          completed.forEach(item => {
            addLog(`✓ ${UNIT_TYPES[item.unitId].name} 训练完成！`);
          });
        }
        
        // 返回未完成的训练（排除已完成的）
        return updated.filter(item => !(item.status === 'training' && item.remainingTime <= 0));
      });
    }, tickInterval); // 根据游戏速度动态调整执行频率

    return () => clearInterval(timer);
  }, [gameSpeed, isPaused, army, activeFestivalEffects, setFestivalModal, setActiveFestivalEffects, setLastFestivalYear, lastFestivalYear, setIsPaused]); // 依赖游戏速度、暂停状态、军队状态和庆典相关状态
};
