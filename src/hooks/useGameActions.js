// 游戏操作钩子
// 包含所有游戏操作函数，如建造建筑、研究科技、升级时代等

import { BUILDINGS, EPOCHS, TECHS } from '../config/gameData';
import { UNIT_TYPES } from '../config/militaryUnits';
import { calculateArmyAdminCost, calculateArmyPopulation, simulateBattle } from '../config/militaryUnits';
import { isMarketResource, getResourcePrice } from '../utils/economy';

const TRADE_ROUTE_ADMIN_COST = 5;

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
    market,
    setMarket,
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
    setClassWealth,
    tradeRoutes,
    setTradeRoutes,
  } = gameState;

  const mergePayments = (target, addition = {}) => {
    const next = { ...target };
    Object.entries(addition).forEach(([owner, amount]) => {
      next[owner] = (next[owner] || 0) + amount;
    });
    return next;
  };

  const distributePayments = (payments = {}) => {
    if (!payments || Object.keys(payments).length === 0) return;
    setClassWealth(prev => {
      const updated = { ...prev };
      Object.entries(payments).forEach(([owner, amount]) => {
        if (updated[owner] === undefined) return;
        updated[owner] += amount;
      });
      return updated;
    });
  };

  const settleMarketWithdrawal = (resource, amount) => {
    if (!isMarketResource(resource) || amount <= 0) {
      return { payments: {}, bucket: market.ownership?.[resource] || {} };
    }
    const price = getResourcePrice(resource, market);
    const bucket = { ...(market.ownership?.[resource] || {}) };
    let remaining = amount;
    const payments = {};
    for (const owner of Object.keys(bucket)) {
      if (remaining <= 0) break;
      const owned = bucket[owner] || 0;
      if (owned <= 0) continue;
      const sold = Math.min(owned, remaining);
      bucket[owner] = owned - sold;
      payments[owner] = (payments[owner] || 0) + sold * price;
      remaining -= sold;
    }
    return { payments, bucket };
  };

  const addMarketSupply = (resource, amount, ownerKey) => {
    if (!isMarketResource(resource) || amount <= 0) return;
    setMarket(prev => {
      const ownership = { ...prev.ownership };
      ownership[resource] = { ...(ownership[resource] || {}) };
      ownership[resource][ownerKey] = (ownership[resource][ownerKey] || 0) + amount;
      return { ...prev, ownership };
    });
  };

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
    
    // 检查库存和市场价格
    let silverCost = 0;
    let hasMaterials = true;
    Object.entries(cost).forEach(([resource, amount]) => {
      if ((resources[resource] || 0) < amount) {
        hasMaterials = false;
      }
      silverCost += amount * getResourcePrice(resource, market);
    });

    if (!hasMaterials) {
      addLog(`市场缺少建造 ${b.name} 所需的材料`);
      return;
    }

    if ((resources.silver || 0) < silverCost) {
      addLog('银币不足，无法采购建筑材料。');
      return;
    }

    const newRes = { ...resources, silver: (resources.silver || 0) - silverCost };
    const ownershipUpdates = {};
    let paymentLedger = {};

    Object.entries(cost).forEach(([resource, amount]) => {
      newRes[resource] = Math.max(0, (newRes[resource] || 0) - amount);
      if (isMarketResource(resource)) {
        const { payments, bucket } = settleMarketWithdrawal(resource, amount);
        ownershipUpdates[resource] = bucket;
        paymentLedger = mergePayments(paymentLedger, payments);
      }
    });

    setMarket(prev => {
      const ownership = { ...(prev.ownership || {}) };
      Object.entries(ownershipUpdates).forEach(([key, bucket]) => {
        ownership[key] = bucket;
      });
      return { ...prev, ownership };
    });
    distributePayments(paymentLedger);
    setResources(newRes);
    setBuildings(prev => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
    addLog(`建造了 ${b.name}`);
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
    addMarketSupply('food', 1, 'peasant');
    addMarketSupply('wood', 1, 'lumberjack');
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

    const totalUnits = Object.values(army).reduce((sum, count) => sum + count, 0);
    if (totalUnits === 0) {
      addLog('没有可用的军队');
      return;
    }

    // 准备攻击方数据
    const attackerData = {
      army: army,
      epoch: epoch,
      militaryBuffs: 0, // 可以在此基础上扩展
    };

    // 基于目标国家类型生成防御方数据
    const defenderEpoch = Math.max(0, epoch + Math.floor(Math.random() * 3) - 1);
    let defenderArmy = {};
    let defenderWealth = 1000;

    switch (selectedTarget.type) {
      case '军事专制':
        defenderWealth = 800 + Math.random() * 400;
        defenderArmy = { // 偏向步兵和骑兵
          [Object.keys(UNIT_TYPES).find(u => u.includes('infantry') && UNIT_TYPES[u].epoch <= defenderEpoch) || 'militia']: Math.floor(20 + Math.random() * 20),
          [Object.keys(UNIT_TYPES).find(u => u.includes('cavalry') && UNIT_TYPES[u].epoch <= defenderEpoch) || 'spearman']: Math.floor(10 + Math.random() * 10),
        };
        break;
      case '商业共和':
        defenderWealth = 1500 + Math.random() * 800;
        defenderArmy = { // 军队较弱但有钱
          [Object.keys(UNIT_TYPES).find(u => u.includes('infantry') && UNIT_TYPES[u].epoch <= defenderEpoch) || 'militia']: Math.floor(10 + Math.random() * 10),
        };
        break;
      case '神权政治':
        defenderWealth = 1200 + Math.random() * 600;
        defenderArmy = { // 偏向防御性单位
          [Object.keys(UNIT_TYPES).find(u => u.includes('spearman') && UNIT_TYPES[u].epoch <= defenderEpoch) || 'militia']: Math.floor(15 + Math.random() * 15),
          [Object.keys(UNIT_TYPES).find(u => u.includes('archer') && UNIT_TYPES[u].epoch <= defenderEpoch) || 'slinger']: Math.floor(10 + Math.random() * 10),
        };
        break;
      default:
        defenderArmy = { 'militia': Math.floor(10 + Math.random() * 10) };
    }
    
    const defenderData = {
      army: defenderArmy,
      epoch: defenderEpoch,
      militaryBuffs: 0,
      wealth: defenderWealth,
    };
    
    const result = simulateBattle(attackerData, defenderData);

    if (result.victory) {
      const newRes = { ...resources };
      Object.entries(result.loot).forEach(([resource, amount]) => {
        if (amount > 0) {
          newRes[resource] = (newRes[resource] || 0) + amount;
        }
      });
      setResources(newRes);
      
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

    const newArmy = { ...army };
    Object.entries(result.attackerLosses).forEach(([unitId, lossCount]) => {
      newArmy[unitId] = Math.max(0, (newArmy[unitId] || 0) - lossCount);
    });
    setArmy(newArmy);

    setBattleResult(result);
    addLog(result.victory ? '⚔️ 战斗胜利！' : '💀 战斗失败...');
  };

  // ========== 贸易路线管理 ==========

  const createTradeRoute = ({ targetNationId, resource, type, volume = 1 }) => {
    if (!targetNationId || !resource || !type) {
      addLog('贸易路线参数不完整。');
      return false;
    }
    if (!isMarketResource(resource)) {
      addLog('该资源无法用于对外贸易。');
      return false;
    }
    const nation = nations.find(n => n.id === targetNationId);
    if (!nation) {
      addLog('目标国家不存在。');
      return false;
    }
    if ((resources.admin || 0) < TRADE_ROUTE_ADMIN_COST) {
      addLog('行政力不足，无法建立新的商队。');
      return false;
    }
    const normalizedVolume = Math.max(0.25, volume);
    setResources(prev => ({
      ...prev,
      admin: Math.max(0, (prev.admin || 0) - TRADE_ROUTE_ADMIN_COST),
    }));
    const route = {
      id: Date.now(),
      targetNationId,
      resource,
      type,
      volume: normalizedVolume,
    };
    setTradeRoutes(prev => [...prev, route]);
    addLog(`📦 已与 ${nation.name} 建立${type === 'export' ? '出口' : '进口'}路线（${resource}）`);
    return true;
  };

  const cancelTradeRoute = (routeId) => {
    const targetRoute = tradeRoutes.find(r => r.id === routeId);
    if (!targetRoute) {
      addLog('未找到该贸易路线。');
      return;
    }
    const nation = nations.find(n => n.id === targetRoute.targetNationId);
    setTradeRoutes(prev => prev.filter(r => r.id !== routeId));
    addLog(`✂️ 已终止与 ${nation?.name || targetRoute.targetNationId} 的${targetRoute.type === 'export' ? '出口' : '进口'}路线`);
  };

  // ========== 外交系统 ==========

  /**
   * 处理外交行动
   * @param {string} nationId - 国家ID
   * @param {string} action - 外交行动 (gift/trade/war)
   */
  const handleDiplomaticAction = (nationId, action) => {
    const targetNation = nations.find(n => n.id === nationId);
    if (!targetNation) return;

    switch (action) {
      case 'gift':
        if ((resources.silver || 0) >= 500) {
          setResources(prev => ({ ...prev, silver: prev.silver - 500 }));
          setNations(prev => prev.map(n =>
            n.id === nationId
              ? { ...n, relation: Math.min(100, n.relation + 10) }
              : n
          ));
          addLog(`你向 ${targetNation.name} 赠送了礼物，关系提升了。`);
        } else {
          addLog('银币不足，无法赠送礼物。');
        }
        break;

      case 'trade':
        if ((resources.silver || 0) >= 1000) {
          setResources(prev => ({ ...prev, silver: prev.silver - 1000 }));
          setNations(prev => prev.map(n =>
            n.id === nationId
              ? { ...n, relation: Math.min(100, n.relation + 5) }
              : n
          ));
          // 未来可以加入贸易buff
          addLog(`你与 ${targetNation.name} 达成了贸易协定。`);
        } else {
          addLog('银币不足，无法达成贸易协定。');
        }
        break;

      case 'war':
        setNations(prev => prev.map(n =>
          n.id === nationId ? { ...n, relation: 0 } : n
        ));
        addLog(`你向 ${targetNation.name} 宣战了！`);
        break;

      default:
        break;
    }
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

    // 贸易
    createTradeRoute,
    cancelTradeRoute,

    // 外交
    handleDiplomaticAction,
  };
};
