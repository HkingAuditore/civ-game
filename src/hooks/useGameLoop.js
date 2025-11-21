// 游戏循环钩子
// 处理游戏的核心循环逻辑，包括资源生产、人口增长等

import { useEffect, useRef } from 'react';
import { simulateTick } from '../logic/simulation';
import { calculateArmyMaintenance } from '../config/militaryUnits';
import { UNIT_TYPES } from '../config/militaryUnits';

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
    setClassApproval,
    setClassInfluence,
    setClassWealth,
    setTotalInfluence,
    setTotalWealth,
    setActiveBuffs,
    setActiveDebuffs,
    setStability,
    setLogs,
    army,
    setArmy,
    militaryQueue,
    setMilitaryQueue,
  } = gameState;

  // 使用ref保存最新状态，避免闭包问题
  const stateRef = useRef({ 
    resources, 
    buildings, 
    population, 
    epoch, 
    techsUnlocked, 
    decrees, 
    gameSpeed, 
    nations 
  });

  useEffect(() => {
    stateRef.current = { 
      resources, 
      buildings, 
      population, 
      epoch, 
      techsUnlocked, 
      decrees, 
      gameSpeed, 
      nations 
    };
  }, [resources, buildings, population, epoch, techsUnlocked, decrees, gameSpeed, nations]);

  // 游戏核心循环
  useEffect(() => {
    const timer = setInterval(() => {
      const current = stateRef.current;
      
      // 执行游戏模拟
      const result = simulateTick(current);

      // 更新所有状态
      setPopStructure(result.popStructure);
      setMaxPop(result.maxPop);
      setAdminCap(result.adminCap);
      setAdminStrain(result.adminStrain);
      setResources(result.resources);
      setRates(result.rates);
      setClassApproval(result.classApproval);
      setClassInfluence(result.classInfluence);
      setClassWealth(result.classWealth);
      setTotalInfluence(result.totalInfluence);
      setTotalWealth(result.totalWealth);
      setActiveBuffs(result.activeBuffs);
      setActiveDebuffs(result.activeDebuffs);
      setStability(result.stability);

      // 更新人口（如果有变化）
      if (result.population !== current.population) {
        setPopulation(result.population);
      }

      // 添加新日志
      if (result.logs.length) {
        setLogs(prev => [...result.logs, ...prev].slice(0, 8));
      }
      
      // 军事系统：扣除军队维护成本
      const maintenance = calculateArmyMaintenance(army);
      const newRes = { ...result.resources };
      Object.entries(maintenance).forEach(([resource, cost]) => {
        newRes[resource] = Math.max(0, (newRes[resource] || 0) - cost * gameSpeed);
      });
      setResources(newRes);
      
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
