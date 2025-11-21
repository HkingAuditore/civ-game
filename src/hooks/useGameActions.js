// 游戏操作钩子
// 包含所有游戏操作函数，如建造建筑、研究科技、升级时代等

import { BUILDINGS, EPOCHS, TECHS } from '../config/gameData';
import { UNIT_TYPES } from '../config/militaryUnits';
import { calculateArmyAdminCost, calculateArmyPopulation, simulateBattle } from '../config/militaryUnits';

/**
 * 游戏操作钩子
 * 提供所有游戏操作函数
 * @param {Object} gameState - 游戏状态对象
 * @param {Function} addLog - 添加日志函数
 * @returns {Object} 包含所有操作函数的对象
 */
export const useGameActions = (gameState, addLog) => {
  const {
    resources,
    setResources,
    buildings,
    setBuildings,
    epoch,
    setEpoch,
    population,
    techsUnlocked,
    setTechsUnlocked,
    decrees,
    setDecrees,
    setClicks,
    army,
    setArmy,
    militaryQueue,
    setMilitaryQueue,
    adminCap,
    selectedTarget,
    setSelectedTarget,
    setBattleResult,
    nations,
    setNations,
  } = gameState;

  // ========== 时代升级 ==========
  
  /**
   * 检查是否可以升级时代
   * @returns {boolean}
   */
  const canUpgradeEpoch = () => {
    if (epoch >= EPOCHS.length - 1) return false;
    const nextEpoch = EPOCHS[epoch + 1];
    
    // 检查升级要求
    if (nextEpoch.req.science && resources.science < nextEpoch.req.science) return false;
    if (nextEpoch.req.population && population < nextEpoch.req.population) return false;
    if (nextEpoch.req.culture && resources.culture < nextEpoch.req.culture) return false;
    
    // 检查升级成本
    for (let k in nextEpoch.cost) {
      if ((resources[k] || 0) < nextEpoch.cost[k]) return false;
    }
    
    return true;
  };

  /**
   * 升级时代
   */
  const upgradeEpoch = () => {
    if (!canUpgradeEpoch()) return;
    
    const nextEpoch = EPOCHS[epoch + 1];
    const newRes = { ...resources };
    
    // 扣除成本
    for (let k in nextEpoch.cost) {
      newRes[k] -= nextEpoch.cost[k];
    }
    
    setResources(newRes);
    setEpoch(epoch + 1);
    addLog(`🎉 文明进入 ${nextEpoch.name}！`);
  };

  // ========== 建筑管理 ==========
  
  /**
   * 购买建筑
   * @param {string} id - 建筑ID
   */
  const buyBuilding = (id) => {
    const b = BUILDINGS.find(x => x.id === id);
    const count = buildings[id] || 0;
    
    // 计算成本（随数量递增）
    const cost = {};
    for (let k in b.baseCost) {
      cost[k] = b.baseCost[k] * Math.pow(1.15, count);
    }
    
    // 检查是否能负担
    let canAfford = true;
    for (let k in cost) {
      if ((resources[k] || 0) < cost[k]) canAfford = false;
    }

    if (canAfford) {
      const newRes = { ...resources };
      for (let k in cost) newRes[k] -= cost[k];
      setResources(newRes);
      setBuildings(prev => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
      addLog(`建造了 ${b.name}`);
    }
  };

  /**
   * 出售建筑
   * @param {string} id - 建筑ID
   */
  const sellBuilding = (id) => {
    if ((buildings[id] || 0) > 0) {
      setBuildings(prev => ({ ...prev, [id]: prev[id] - 1 }));
      addLog(`拆除了 ${BUILDINGS.find(b => b.id === id).name}`);
    }
  };

  // ========== 科技研究 ==========
  
  /**
   * 研究科技
   * @param {string} id - 科技ID
   */
  const researchTech = (id) => {
    const tech = TECHS.find(t => t.id === id);
    if (!tech) return;
    
    // 检查是否已研究
    if (techsUnlocked.includes(id)) {
      addLog(`已经研究过 ${tech.name}`);
      return;
    }
    
    // 检查时代要求
    if (tech.epoch > epoch) {
      addLog(`需要升级到 ${EPOCHS[tech.epoch].name} 才能研究 ${tech.name}`);
      return;
    }
    
    // 检查资源
    let canAfford = true;
    for (let resource in tech.cost) {
      if ((resources[resource] || 0) < tech.cost[resource]) {
        canAfford = false;
        break;
      }
    }
    
    if (!canAfford) {
      addLog(`资源不足，无法研究 ${tech.name}`);
      return;
    }
    
    // 扣除资源
    const newRes = { ...resources };
    for (let resource in tech.cost) {
      newRes[resource] -= tech.cost[resource];
    }
    
    setResources(newRes);
    setTechsUnlocked(prev => [...prev, id]);
    addLog(`✓ 研究完成：${tech.name}`);
  };

  // ========== 政令管理 ==========
  
  /**
   * 切换政令状态
   * @param {string} id - 政令ID
   */
  const toggleDecree = (id) => {
    setDecrees(prev => prev.map(d => 
      d.id === id ? { ...d, active: !d.active } : d
    ));
  };

  // ========== 手动采集 ==========
  
  /**
   * 手动采集资源
   * @param {Event} e - 鼠标事件
   */
  const manualGather = (e) => {
    setClicks(prev => [...prev, { 
      id: Date.now(), 
      x: e.clientX, 
      y: e.clientY, 
      text: "+1", 
      color: "text-white" 
    }]);
    setResources(prev => ({ 
      ...prev, 
      food: prev.food + 1, 
      wood: prev.wood + 1 
    }));
  };

  // ========== 军事系统 ==========
  
  /**
   * 招募单位
   * @param {string} unitId - 单位ID
   */
  const recruitUnit = (unitId) => {
    const unit = UNIT_TYPES[unitId];
    if (!unit) return;
    
    // 检查时代
    if (unit.epoch > epoch) {
      addLog(`需要升级到 ${EPOCHS[unit.epoch].name} 才能训练 ${unit.name}`);
      return;
    }
    
    // 检查资源
    let canAfford = true;
    for (let resource in unit.recruitCost) {
      if ((resources[resource] || 0) < unit.recruitCost[resource]) {
        canAfford = false;
        break;
      }
    }
    
    if (!canAfford) {
      addLog(`资源不足，无法训练 ${unit.name}`);
      return;
    }
    
    // 检查行政力
    const currentArmyAdmin = calculateArmyAdminCost(army);
    if (currentArmyAdmin + unit.adminCost > adminCap) {
      addLog(`行政力不足，无法维持更多军队`);
      return;
    }
    
    // 检查人口
    const currentArmyPop = calculateArmyPopulation(army);
    const maxArmyPop = Math.floor(population * 0.3); // 最多30%人口当兵
    if (currentArmyPop + unit.populationCost > maxArmyPop) {
      addLog(`军队规模已达人口上限（${maxArmyPop}人）`);
      return;
    }
    
    // 扣除资源
    const newRes = { ...resources };
    for (let resource in unit.recruitCost) {
      newRes[resource] -= unit.recruitCost[resource];
    }
    setResources(newRes);
    
    // 加入训练队列
    setMilitaryQueue(prev => [...prev, {
      unitId,
      remainingTime: unit.trainingTime
    }]);
    
    addLog(`开始训练 ${unit.name}，需要 ${unit.trainingTime} 秒`);
  };

  /**
   * 解散单位
   * @param {string} unitId - 单位ID
   */
  const disbandUnit = (unitId) => {
    if ((army[unitId] || 0) > 0) {
      setArmy(prev => ({
        ...prev,
        [unitId]: prev[unitId] - 1
      }));
      addLog(`解散了 ${UNIT_TYPES[unitId].name}`);
    }
  };

  /**
   * 发起战斗
   * @param {string} actionType - 行动类型（raid/conquer/defend/scout）
   */
  const launchBattle = (actionType) => {
    if (!selectedTarget) {
      addLog('请先选择目标国家');
      return;
    }
    
    // 检查是否有军队
    const totalUnits = Object.values(army).reduce((sum, count) => sum + count, 0);
    if (totalUnits === 0) {
      addLog('没有可用的军队');
      return;
    }
    
    // 模拟战斗
    const result = simulateBattle(army, selectedTarget, actionType, epoch);
    
    // 应用战斗结果
    if (result.victory) {
      // 获得资源
      const newRes = { ...resources };
      Object.entries(result.resourcesGained).forEach(([resource, amount]) => {
        newRes[resource] = (newRes[resource] || 0) + amount;
      });
      setResources(newRes);
      
      // 提升关系（如果是防御）或降低关系
      if (actionType === 'defend') {
        setNations(prev => prev.map(n => 
          n.id === selectedTarget.id 
            ? { ...n, relation: Math.min(100, n.relation + 10) }
            : n
        ));
      } else {
        setNations(prev => prev.map(n => 
          n.id === selectedTarget.id 
            ? { ...n, relation: Math.max(0, n.relation - 20) }
            : n
        ));
      }
    }
    
    // 应用损失
    const newArmy = { ...army };
    Object.entries(result.losses).forEach(([unitId, lossCount]) => {
      newArmy[unitId] = Math.max(0, (newArmy[unitId] || 0) - lossCount);
    });
    setArmy(newArmy);
    
    // 显示战斗结果
    setBattleResult(result);
    addLog(result.victory ? '⚔️ 战斗胜利！' : '💀 战斗失败...');
  };

  // 返回所有操作函数
  return {
    // 时代
    canUpgradeEpoch,
    upgradeEpoch,
    
    // 建筑
    buyBuilding,
    sellBuilding,
    
    // 科技
    researchTech,
    
    // 政令
    toggleDecree,
    
    // 采集
    manualGather,
    
    // 军事
    recruitUnit,
    disbandUnit,
    launchBattle,
  };
};
