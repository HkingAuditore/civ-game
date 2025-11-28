// 游戏循环钩子
// 处理游戏的核心循环逻辑，包括资源生产、人口增长等

import { useEffect, useRef } from 'react';
import { simulateTick } from '../logic/simulation';
import { calculateArmyMaintenance, UNIT_TYPES, STRATA } from '../config';
import { getRandomFestivalEffects } from '../config/festivalEffects'; 
import { initCheatCodes } from './cheatCodes';
import { getCalendarInfo } from '../utils/calendar';

/**
 * 游戏循环钩子
 * 处理游戏的核心循环逻辑
 * @param {Object} gameState - 游戏状态对象
 * @param {Function} addLog - 添加日志函数
 */
export const useGameLoop = (gameState, addLog) => {
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
    setAdminCap,
    setAdminStrain,
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
  } = gameState;

  // 使用ref保存最新状态，避免闭包问题
  const stateRef = useRef({
    resources,
    market,
    buildings,
    population,
    popStructure,
    epoch,
    techsUnlocked,
    decrees,
    gameSpeed,
    nations,
    classWealth,
    army,
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
      techsUnlocked,
      decrees,
      gameSpeed,
      nations,
      classWealth,
      army,
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
    };
  }, [resources, market, buildings, population, popStructure, epoch, techsUnlocked, decrees, gameSpeed, nations, classWealth, army, jobFill, jobsAvailable, activeBuffs, activeDebuffs, taxPolicies, classWealthHistory, classNeedsHistory, militaryWageRatio, classApproval, daysElapsed, activeFestivalEffects, lastFestivalYear, isPaused, autoSaveInterval, isAutoSaveEnabled, lastAutoSaveTime, merchantState]);

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
      const result = simulateTick({
        ...current,
        tick: current.daysElapsed || 0,
        gameSpeed: 1, // 强制归一化为 1，防止倍率叠加
        activeFestivalEffects: current.activeFestivalEffects || [],
      });

      const maintenance = calculateArmyMaintenance(army);
      const adjustedResources = { ...result.resources };
      Object.entries(maintenance).forEach(([resource, cost]) => {
        // 每次 Tick 计算 1 天的维护费用（不再乘以 gameSpeed）
        const amount = cost;
        if (amount <= 0) return;
        adjustedResources[resource] = Math.max(0, (adjustedResources[resource] || 0) - amount);
      });

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
      setAdminCap(result.adminCap);
      setAdminStrain(result.adminStrain);
      setResources(adjustedResources);
      // 由于现在每次 Tick 都是 1 天的产出，rates 已经是每天的速率，无需再除以 gameSpeed
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
      setTaxes(result.taxes || { total: 0, breakdown: { headTax: 0, industryTax: 0, subsidy: 0 }, efficiency: 1 });
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
      }
      
      // 处理训练队列
      setMilitaryQueue(prev => {
        const updated = prev.map(item => ({
          ...item,
          remainingTime: item.remainingTime - 1
        }));
        
        // 找出已完成的训练
        const completed = updated.filter(item => item.remainingTime <= 0);
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
        
        // 返回未完成的训练
        return updated.filter(item => item.remainingTime > 0);
      });
    }, tickInterval); // 根据游戏速度动态调整执行频率

    return () => clearInterval(timer);
  }, [gameSpeed, isPaused, army, activeFestivalEffects, setFestivalModal, setActiveFestivalEffects, setLastFestivalYear, lastFestivalYear, setIsPaused]); // 依赖游戏速度、暂停状态、军队状态和庆典相关状态
};
