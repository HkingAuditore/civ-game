// 游戏循环钩子
// 处理游戏的核心循环逻辑，包括资源生产、人口增长等

import { useEffect, useRef } from 'react';
import { simulateTick } from '../logic/simulation';
import { calculateArmyMaintenance, UNIT_TYPES } from '../config';

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
    setPopulation,
    epoch,
    techsUnlocked,
    decrees,
    gameSpeed,
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
    classWealthHistory,
    setClassWealthHistory,
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
    setDaysElapsed,
    daysElapsed,
    militaryWageRatio,
    classInfluenceShift,
    setClassInfluenceShift,
  } = gameState;

  // 使用ref保存最新状态，避免闭包问题
  const stateRef = useRef({ 
    resources,
    market,
    buildings, 
    population, 
    epoch, 
    techsUnlocked, 
    decrees, 
    gameSpeed, 
    nations,
    classWealth,
    army,
    jobFill,
    activeBuffs,
    taxPolicies,
    activeDebuffs,
    classWealthHistory,
    militaryWageRatio,
    classApproval,
    nations,
    daysElapsed,
  });

  useEffect(() => {
    stateRef.current = { 
      resources, 
      market,
      buildings, 
      population, 
      epoch, 
      techsUnlocked, 
      decrees, 
      gameSpeed,
      nations,
      classWealth,
      army,
      jobFill,
      activeBuffs,
      taxPolicies,
      activeDebuffs,
      classWealthHistory,
      militaryWageRatio,
      classApproval,
      nations,
      daysElapsed,
    };
  }, [resources, market, buildings, population, epoch, techsUnlocked, decrees, gameSpeed, nations, classWealth, army, activeBuffs, activeDebuffs, taxPolicies, classWealthHistory, militaryWageRatio, classApproval, daysElapsed]);

  // 游戏核心循环
  useEffect(() => {
    const timer = setInterval(() => {
      const current = stateRef.current;
      
      // 执行游戏模拟
      const result = simulateTick({
        ...current,
        tick: current.daysElapsed || 0,
      });

      const maintenance = calculateArmyMaintenance(army);
      const adjustedResources = { ...result.resources };
      Object.entries(maintenance).forEach(([resource, cost]) => {
        const amount = cost * gameSpeed;
        if (amount <= 0) return;
        adjustedResources[resource] = Math.max(0, (adjustedResources[resource] || 0) - amount);
      });

      const adjustedClassWealth = { ...result.classWealth };
      const adjustedTotalWealth = Object.values(adjustedClassWealth).reduce((sum, val) => sum + val, 0);
      const previousHistory = current.market?.priceHistory || {};
      const priceHistory = { ...previousHistory };
      const MAX_HISTORY_POINTS = 60;
      Object.entries(result.market?.prices || {}).forEach(([resource, price]) => {
        if (!priceHistory[resource]) priceHistory[resource] = [];
        priceHistory[resource] = [...priceHistory[resource], price];
        if (priceHistory[resource].length > MAX_HISTORY_POINTS) {
          priceHistory[resource].shift();
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
      const adjustedMarket = {
        ...(result.market || {}),
        priceHistory,
      };

      // 更新所有状态
      setPopStructure(result.popStructure);
      setMaxPop(result.maxPop);
      setAdminCap(result.adminCap);
      setAdminStrain(result.adminStrain);
      setResources(adjustedResources);
      const dayScale = Math.max(gameSpeed, 0.0001);
      const perDayRates = {};
      Object.entries(result.rates || {}).forEach(([key, value]) => {
        perDayRates[key] = value / dayScale;
      });
      setRates(perDayRates);
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
      setClassWealthHistory(wealthHistory);
      setTotalInfluence(result.totalInfluence);
      setTotalWealth(adjustedTotalWealth);
      setActiveBuffs(result.activeBuffs);
      setActiveDebuffs(result.activeDebuffs);
      setStability(result.stability);
      setTaxes(result.taxes || { total: 0, breakdown: { headTax: 0, industryTax: 0 }, efficiency: 1 });
      setMarket(adjustedMarket);
      setClassShortages(result.needsShortages || {});
      if (result.nations) {
        setNations(result.nations);
      }
      if (result.jobFill) {
        setJobFill(result.jobFill);
      }
      setDaysElapsed(prev => prev + gameSpeed);

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
    }, 1000); // 每秒执行一次

    return () => clearInterval(timer);
  }, [gameSpeed, army]); // 依赖游戏速度和军队状态
};
