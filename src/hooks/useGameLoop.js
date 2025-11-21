// 游戏循环钩子
// 处理游戏的核心循环逻辑，包括资源生产、人口增长等

import { useEffect, useRef } from 'react';
import { simulateTick } from '../logic/simulation';
import { calculateArmyMaintenance } from '../config/militaryUnits';
import { UNIT_TYPES } from '../config/militaryUnits';
import { RESOURCES } from '../config/gameData';

const isTradableResource = (resource) => {
  if (resource === 'silver') return false;
  const def = RESOURCES[resource];
  if (!def) return false;
  return !def.type || def.type !== 'virtual';
};

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
    setPopStructure,
    setMaxPop,
    setAdminCap,
    setAdminStrain,
    setRates,
    setTaxes,
    setClassApproval,
    setClassInfluence,
    setClassWealth,
    setClassWealthDelta,
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
    tradeRoutes,
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
    jobFill,
    activeBuffs,
    taxPolicies,
    activeDebuffs,
    tradeRoutes,
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
      jobFill,
      activeBuffs,
      taxPolicies,
      activeDebuffs,
      tradeRoutes,
    };
  }, [resources, market, buildings, population, epoch, techsUnlocked, decrees, gameSpeed, nations, classWealth, activeBuffs, activeDebuffs, taxPolicies, tradeRoutes]);

  // 游戏核心循环
  useEffect(() => {
    const timer = setInterval(() => {
      const current = stateRef.current;
      
      // 执行游戏模拟
      const result = simulateTick(current);

      const maintenance = calculateArmyMaintenance(army);
      const adjustedResources = { ...result.resources };
      const ownershipBuckets = {};
      Object.entries(result.market?.ownership || {}).forEach(([key, bucket]) => {
        ownershipBuckets[key] = { ...bucket };
      });
      let maintenancePayments = {};

      Object.entries(maintenance).forEach(([resource, cost]) => {
        const amount = cost * gameSpeed;
        if (amount <= 0) return;
        adjustedResources[resource] = Math.max(0, (adjustedResources[resource] || 0) - amount);
        if (!isTradableResource(resource)) return;
        const price = (result.market.prices?.[resource]) || RESOURCES[resource]?.basePrice || 1;
        const bucket = ownershipBuckets[resource] || {};
        let remaining = amount;
        for (const owner of Object.keys(bucket)) {
          if (remaining <= 0) break;
          const owned = bucket[owner] || 0;
          if (owned <= 0) continue;
          const sold = Math.min(owned, remaining);
          bucket[owner] = owned - sold;
          maintenancePayments[owner] = (maintenancePayments[owner] || 0) + sold * price;
          remaining -= sold;
        }
        ownershipBuckets[resource] = bucket;
      });

      const adjustedClassWealth = { ...result.classWealth };
      Object.entries(maintenancePayments).forEach(([owner, amount]) => {
        if (adjustedClassWealth[owner] === undefined) return;
        adjustedClassWealth[owner] += amount;
      });
      const adjustedTotalWealth = Object.values(adjustedClassWealth).reduce((sum, val) => sum + val, 0);
      const adjustedMarket = {
        ...(result.market || {}),
        ownership: ownershipBuckets,
      };

      // 更新所有状态
      setPopStructure(result.popStructure);
      setMaxPop(result.maxPop);
      setAdminCap(result.adminCap);
      setAdminStrain(result.adminStrain);
      setResources(adjustedResources);
      setRates(result.rates);
      setClassApproval(result.classApproval);
      setClassInfluence(result.classInfluence);
      const wealthDelta = {};
      Object.keys(adjustedClassWealth).forEach(key => {
        const prevWealth = current.classWealth?.[key] || 0;
        wealthDelta[key] = adjustedClassWealth[key] - prevWealth;
      });
      setClassWealth(adjustedClassWealth);
      setClassWealthDelta(wealthDelta);
      setTotalInfluence(result.totalInfluence);
      setTotalWealth(adjustedTotalWealth);
      setActiveBuffs(result.activeBuffs);
      setActiveDebuffs(result.activeDebuffs);
      setStability(result.stability);
      setTaxes(result.taxes || { total: 0, breakdown: { headTax: 0, industryTax: 0 }, efficiency: 1 });
      setMarket(adjustedMarket);
      setClassShortages(result.needsShortages || {});
      if (result.jobFill) {
        setJobFill(result.jobFill);
      }

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
