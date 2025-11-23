// 游戏操作钩子
// 包含所有游戏操作函数，如建造建筑、研究科技、升级时代等

import { BUILDINGS, EPOCHS, RESOURCES, TECHS, MILITARY_ACTIONS, UNIT_TYPES } from '../config';
import { calculateArmyAdminCost, calculateArmyPopulation, simulateBattle, calculateBattlePower } from '../config';
import { calculateForeignPrice, calculateTradeStatus } from '../utils/foreignTrade';

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
    buildings,
    setBuildings,
    epoch,
    setEpoch,
    population,
    techsUnlocked,
    setTechsUnlocked,
    setDecrees,
    setClicks,
    army,
    setArmy,
    setMilitaryQueue,
    adminCap,
    setBattleResult,
    nations,
    setNations,
    setClassInfluenceShift,
    daysElapsed,
  } = gameState;

  const getMarketPrice = (resource) => {
    if (!resource) return 1;
    const base = RESOURCES[resource]?.basePrice || 1;
    return market?.prices?.[resource] ?? base;
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
    
    const hasMaterials = Object.entries(cost).every(([resource, amount]) => (resources[resource] || 0) >= amount);
    if (!hasMaterials) {
      addLog(`资源不足，无法建造 ${b.name}`);
      return;
    }

    const silverCost = Object.entries(cost).reduce((sum, [resource, amount]) => {
      return sum + amount * getMarketPrice(resource);
    }, 0);

    if ((resources.silver || 0) < silverCost) {
      addLog('银币不足，无法支付建造费用');
      return;
    }

    const newRes = { ...resources };
    Object.entries(cost).forEach(([resource, amount]) => {
      newRes[resource] = Math.max(0, (newRes[resource] || 0) - amount);
    });
    newRes.silver = Math.max(0, (newRes.silver || 0) - silverCost);

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
    let blockedEpoch = null;
    let blockedName = '';
    setDecrees(prev => prev.map(d => {
      if (d.id !== id) return d;
      const requiredEpoch = d.unlockEpoch ?? 0;
      if (requiredEpoch > epoch) {
        blockedEpoch = requiredEpoch;
        blockedName = d.name || '';
        return d;
      }
      return { ...d, active: !d.active };
    }));
    if (blockedEpoch !== null && addLog) {
      const epochName = EPOCHS[blockedEpoch]?.name || `第 ${blockedEpoch + 1} 个时代`;
      addLog(`需要达到${epochName}才能颁布「${blockedName || '该政令'}」。`);
    }
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
    
    const silverCost = Object.entries(unit.recruitCost).reduce((sum, [resource, amount]) => {
      return sum + amount * getMarketPrice(resource);
    }, 0);

    if ((resources.silver || 0) < silverCost) {
      addLog('银币不足，无法支付征兵物资费用。');
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
    newRes.silver = Math.max(0, (newRes.silver || 0) - silverCost);
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
   * @param {string} missionId - 行动类型
   * @param {string} nationId - 目标国家
   */
  const launchBattle = (missionId, nationId) => {
    const mission = MILITARY_ACTIONS.find(action => action.id === missionId);
    if (!mission) {
      addLog('未找到对应的军事行动。');
      return;
    }

    const targetNation = nations.find(n => n.id === nationId);
    if (!targetNation) {
      addLog('请先选择一个目标国家。');
      return;
    }
    if (!targetNation.isAtWar) {
      addLog(`${targetNation.name} 当前与你处于和平状态。`);
      return;
    }

    const totalUnits = Object.values(army).reduce((sum, count) => sum + count, 0);
    if (totalUnits === 0) {
      addLog('没有可用的军队');
      return;
    }

    const attackerData = {
      army,
      epoch,
      militaryBuffs: 0,
    };

    const aggressionFactor = 1 + (targetNation.aggression || 0.2);
    const warScoreFactor = 1 + Math.max(-0.5, (targetNation.warScore || 0) / 120);
    const defenderArmy = {};
    (mission.enemyUnits || []).forEach(enemy => {
      const min = Math.max(0, enemy.min || 0);
      const max = Math.max(min, enemy.max || min);
      const baseCount = min + Math.random() * (max - min + 1);
      const scaled = Math.floor(baseCount * aggressionFactor * warScoreFactor);
      if (scaled > 0) {
        defenderArmy[enemy.unit] = (defenderArmy[enemy.unit] || 0) + scaled;
      }
    });

    const defenderData = {
      army: defenderArmy,
      epoch: Math.max(targetNation.appearEpoch || 0, Math.min(epoch, targetNation.expireEpoch ?? epoch)),
      militaryBuffs: mission.enemyBuff || 0,
      wealth: targetNation.wealth || 500,
    };

    const result = simulateBattle(attackerData, defenderData);
    let resourcesGained = {};
    if (result.victory) {
      const combinedLoot = {};
      const mergeLoot = (source) => {
        Object.entries(source || {}).forEach(([resource, amount]) => {
          if (amount > 0) {
            combinedLoot[resource] = (combinedLoot[resource] || 0) + Math.floor(amount);
          }
        });
      };
      mergeLoot(result.loot || {});
      Object.entries(mission.loot || {}).forEach(([resource, range]) => {
        if (!Array.isArray(range) || range.length < 2) return;
        const [min, max] = range;
        const amount = Math.floor(min + Math.random() * (max - min + 1));
        if (amount > 0) {
          combinedLoot[resource] = (combinedLoot[resource] || 0) + amount;
        }
      });
      resourcesGained = combinedLoot;

      if (Object.keys(combinedLoot).length > 0) {
        setResources(prev => {
          const updated = { ...prev };
          Object.entries(combinedLoot).forEach(([resource, amount]) => {
            updated[resource] = (updated[resource] || 0) + amount;
          });
          return updated;
        });
      }
    }

    setArmy(prevArmy => {
      const updated = { ...prevArmy };
      Object.entries(result.attackerLosses || {}).forEach(([unitId, lossCount]) => {
        updated[unitId] = Math.max(0, (updated[unitId] || 0) - lossCount);
      });
      return updated;
    });

    const influenceChange = result.victory
      ? mission.influence?.win || 0
      : mission.influence?.lose || 0;
    if (influenceChange !== 0) {
      setClassInfluenceShift(prev => ({
        ...prev,
        soldier: (prev?.soldier || 0) + influenceChange,
      }));
    }

    const enemyLossCount = Object.values(result.defenderLosses || {}).reduce((sum, val) => sum + val, 0);
    const wealthDamagePerUnit = mission.wealthDamage || 20;
    const wealthDamage = result.victory
      ? Math.min(targetNation.wealth || 0, Math.max(50, enemyLossCount * wealthDamagePerUnit))
      : 0;
    const warScoreDelta = result.victory
      ? (mission.winScore || 10)
      : -(mission.loseScore || 8);

    setNations(prev => prev.map(n => {
      if (n.id !== nationId) return n;
      return {
        ...n,
        wealth: Math.max(0, (n.wealth || 0) - wealthDamage),
        warScore: (n.warScore || 0) + warScoreDelta,
        enemyLosses: (n.enemyLosses || 0) + enemyLossCount,
      };
    }));

    setBattleResult({
      victory: result.victory,
      actionType: mission.id,
      missionName: mission.name,
      missionDesc: mission.desc,
      missionDifficulty: mission.difficulty,
      ourPower: result.attackerPower,
      enemyPower: result.defenderPower,
      powerRatio: result.defenderPower > 0 ? result.attackerPower / result.defenderPower : result.attackerPower,
      score: Number(result.attackerAdvantage || 0),
      losses: result.attackerLosses || {},
      enemyLosses: result.defenderLosses || {},
      resourcesGained,
      nationName: targetNation.name,
      description: (result.battleReport || []).join('\n'),
    });

    addLog(result.victory ? `⚔️ 针对 ${targetNation.name} 的行动取得胜利！` : `💀 对 ${targetNation.name} 的进攻受挫。`);
  };

  // ========== 外交系统 ==========

  /**
   * 处理外交行动
   * @param {string} nationId - 国家ID
   * @param {string} action - 外交行动类型
   * @param {Object} payload - 附加参数
   */
  const handleDiplomaticAction = (nationId, action, payload = {}) => {
    const targetNation = nations.find(n => n.id === nationId);
    if (!targetNation) return;
    const clampRelation = (value) => Math.max(0, Math.min(100, value));

    if (targetNation.isAtWar && (action === 'gift' || action === 'trade' || action === 'import' || action === 'demand')) {
      addLog(`${targetNation.name} 与你正处于战争状态，无法进行此外交行动。`);
      return;
    }

    switch (action) {
      case 'gift': {
        const giftCost = payload.amount || 500;
        if ((resources.silver || 0) < giftCost) {
          addLog('银币不足，无法赠送礼物。');
          return;
        }
        setResources(prev => ({ ...prev, silver: prev.silver - giftCost }));
        setNations(prev => prev.map(n =>
          n.id === nationId
            ? { ...n, relation: clampRelation((n.relation || 0) + 10), wealth: (n.wealth || 0) + giftCost }
            : n
        ));
        addLog(`你向 ${targetNation.name} 赠送了礼物，关系提升了。`);
        break;
      }

      case 'trade': {
        const resourceKey = payload.resource;
        const amount = Math.max(1, Math.floor(payload.amount || 5));
        if (!resourceKey || !RESOURCES[resourceKey] || RESOURCES[resourceKey].type === 'virtual' || resourceKey === 'silver') {
          addLog('该资源无法进行套利贸易。');
          return;
        }
        if ((resources[resourceKey] || 0) < amount) {
          addLog('库存不足，无法出口。');
          return;
        }
        
        // 检查目标国家是否有缺口（库存低于目标值的50%）
        const tradeStatus = calculateTradeStatus(resourceKey, targetNation, daysElapsed);
        const shortageCapacity = Math.floor(tradeStatus.shortageAmount);
        
        if (!tradeStatus.isShortage || shortageCapacity <= 0) {
          addLog(`${targetNation.name} 对 ${RESOURCES[resourceKey].name} 没有缺口，无法出口。`);
          return;
        }
        
        // 检查是否超过缺口限制
        if (amount > shortageCapacity) {
          addLog(`${targetNation.name} 对 ${RESOURCES[resourceKey].name} 的缺口只有 ${shortageCapacity} 单位，已调整出口数量（原计划 ${amount}）。`);
          // 调整交易数量为缺口的最大值
          payload.amount = shortageCapacity;
          return handleDiplomaticAction(nationId, action, payload); // 递归调用，使用调整后的数量
        }
        
        const localPrice = getMarketPrice(resourceKey);
        const foreignPrice = calculateForeignPrice(resourceKey, targetNation, daysElapsed);
        const totalCost = foreignPrice * amount;
        
        const payout = totalCost;
        const profitPerUnit = foreignPrice - localPrice;
        
        // 执行交易
        setResources(prev => ({
          ...prev,
          silver: prev.silver + payout,
          [resourceKey]: Math.max(0, (prev[resourceKey] || 0) - amount),
        }));
        
        setNations(prev => prev.map(n =>
          n.id === nationId
            ? {
                ...n,
                budget: Math.max(0, (n.budget || 0) - payout), // 扣除预算
                inventory: {
                  ...n.inventory,
                  [resourceKey]: ((n.inventory || {})[resourceKey] || 0) + amount, // 增加库存
                },
                relation: clampRelation((n.relation || 0) + (profitPerUnit > 0 ? 2 : 0)),
              }
            : n
        ));
        
        addLog(`向 ${targetNation.name} 出口 ${amount}${RESOURCES[resourceKey].name}，收入 ${payout.toFixed(1)} 银币（单价差 ${profitPerUnit >= 0 ? '+' : ''}${profitPerUnit.toFixed(2)}）。`);
        break;
      }

      case 'import': {
        const resourceKey = payload.resource;
        const amount = Math.max(1, Math.floor(payload.amount || 5));
        if (!resourceKey || !RESOURCES[resourceKey] || RESOURCES[resourceKey].type === 'virtual' || resourceKey === 'silver') {
          addLog('该资源无法进行套利贸易。');
          return;
        }
        
        // 检查目标国家是否有盈余（库存高于目标值的150%）
        const tradeStatus = calculateTradeStatus(resourceKey, targetNation, daysElapsed);
        const surplusCapacity = Math.floor(tradeStatus.surplusAmount);
        
        if (!tradeStatus.isSurplus || surplusCapacity <= 0) {
          addLog(`${targetNation.name} 对 ${RESOURCES[resourceKey].name} 没有盈余，无法进口。`);
          return;
        }
        
        // 检查是否超过盈余限制
        if (amount > surplusCapacity) {
          addLog(`${targetNation.name} 对 ${RESOURCES[resourceKey].name} 的盈余只有 ${surplusCapacity} 单位，已调整进口数量（原计划 ${amount}）。`);
          // 调整交易数量为盈余的最大值
          payload.amount = surplusCapacity;
          return handleDiplomaticAction(nationId, action, payload); // 递归调用，使用调整后的数量
        }
        
        const localPrice = getMarketPrice(resourceKey);
        const foreignPrice = calculateForeignPrice(resourceKey, targetNation, daysElapsed);
        const cost = foreignPrice * amount;
        
        if ((resources.silver || 0) < cost) {
          addLog('银币不足，无法从外国进口。');
          return;
        }
        
        const profitPerUnit = localPrice - foreignPrice;
        
        // 执行交易
        setResources(prev => ({
          ...prev,
          silver: prev.silver - cost,
          [resourceKey]: (prev[resourceKey] || 0) + amount,
        }));
        
        setNations(prev => prev.map(n =>
          n.id === nationId
            ? {
                ...n,
                budget: (n.budget || 0) + cost, // 增加预算
                inventory: {
                  ...n.inventory,
                  [resourceKey]: Math.max(0, ((n.inventory || {})[resourceKey] || 0) - amount), // 减少库存
                },
                relation: clampRelation((n.relation || 0) + (profitPerUnit > 0 ? 2 : 0)),
              }
            : n
        ));
        
        addLog(`从 ${targetNation.name} 进口 ${amount}${RESOURCES[resourceKey].name}，支出 ${cost.toFixed(1)} 银币（单价差 ${profitPerUnit >= 0 ? '+' : ''}${profitPerUnit.toFixed(2)}）。`);
        break;
      }

      case 'demand': {
        const armyPower = calculateBattlePower(army, epoch);
        const successChance = Math.max(0.1, (armyPower / (armyPower + 200)) * 0.6 + (targetNation.relation || 0) / 300);
        if (Math.random() < successChance) {
          const tribute = Math.min(targetNation.wealth || 0, Math.ceil(150 + armyPower * 0.25));
          setResources(prev => ({ ...prev, silver: prev.silver + tribute }));
          setNations(prev => prev.map(n =>
            n.id === nationId
              ? {
                  ...n,
                  wealth: Math.max(0, (n.wealth || 0) - tribute),
                  relation: clampRelation((n.relation || 0) - 30),
                }
              : n
          ));
          addLog(`${targetNation.name} 被迫缴纳 ${tribute} 银币。`);
        } else {
          const escalate = Math.random() < (0.4 + (targetNation.aggression || 0) * 0.4);
          setNations(prev => prev.map(n =>
            n.id === nationId
              ? {
                  ...n,
                  relation: clampRelation((n.relation || 0) - 40),
                  isAtWar: escalate ? true : n.isAtWar,
                  warStartDay: escalate ? daysElapsed : n.warStartDay,
                  warDuration: escalate ? 0 : n.warDuration,
                }
              : n
          ));
          addLog(`${targetNation.name} 拒绝了你的勒索${escalate ? '，并向你宣战！' : '。'}`);
        }
        break;
      }

      case 'declare_war':
        setNations(prev => prev.map(n =>
          n.id === nationId
            ? {
                ...n,
                relation: 0,
                isAtWar: true,
                warScore: 0,
                warStartDay: daysElapsed,
                warDuration: 0,
                enemyLosses: 0,
              }
            : n
        ));
        addLog(`你向 ${targetNation.name} 宣战了！`);
        break;

      case 'peace': {
        if (!targetNation.isAtWar) {
          addLog('当前并未与该国交战。');
          return;
        }
        const warScore = targetNation.warScore || 0;
        const warDuration = targetNation.warDuration || 0;
        const enemyLosses = targetNation.enemyLosses || 0;
        if (warScore < 0) {
          const payment = Math.max(100, Math.ceil(Math.abs(warScore) * 30 + warDuration * 5));
          if ((resources.silver || 0) < payment) {
            addLog('银币不足，无法支付赔款。');
            return;
          }
          setResources(prev => ({ ...prev, silver: prev.silver - payment }));
          setNations(prev => prev.map(n =>
            n.id === nationId
              ? {
                  ...n,
                  isAtWar: false,
                  warScore: 0,
                  warDuration: 0,
                  enemyLosses: 0,
                  wealth: (n.wealth || 0) + payment,
                  relation: 30,
                }
              : n
          ));
          addLog(`你支付 ${payment} 银币，与 ${targetNation.name} 达成和平。`);
        } else if (warScore > 0) {
          const willingness = (warScore / 80) + Math.min(0.5, enemyLosses / 200) + Math.min(0.3, warDuration / 200);
          if (willingness > 0.8 || (targetNation.wealth || 0) <= 0) {
            const tribute = Math.min(targetNation.wealth || 0, Math.ceil(warScore * 40 + enemyLosses * 2));
            setResources(prev => ({ ...prev, silver: prev.silver + tribute }));
            setNations(prev => prev.map(n =>
              n.id === nationId
                ? {
                    ...n,
                    wealth: Math.max(0, (n.wealth || 0) - tribute),
                    isAtWar: false,
                    warScore: 0,
                    warDuration: 0,
                    enemyLosses: 0,
                    relation: clampRelation((n.relation || 0) + 10),
                  }
                : n
            ));
            addLog(`${targetNation.name} 支付 ${tribute} 银币换取和平。`);
          } else {
            addLog(`${targetNation.name} 拒绝了当前的停战条件。`);
          }
        } else {
          addLog('战局尚未出现明显胜负，对方拒绝和平。');
        }
        break;
      }

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

    // 外交
    handleDiplomaticAction,
  };
};
