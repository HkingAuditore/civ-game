// 游戏操作钩子
// 包含所有游戏操作函数，如建造建筑、研究科技、升级时代等

import { BUILDINGS, EPOCHS, RESOURCES, TECHS, MILITARY_ACTIONS, UNIT_TYPES, EVENTS, getRandomEvent, createWarDeclarationEvent, createGiftEvent, createPeaceRequestEvent, createEnemyPeaceRequestEvent, createPlayerPeaceProposalEvent, createBattleEvent } from '../config';
import { calculateArmyCapacityNeed, calculateArmyPopulation, simulateBattle, calculateBattlePower } from '../config';
import { calculateForeignPrice, calculateTradeStatus } from '../utils/foreignTrade';
import { generateSound, SOUND_TYPES } from '../config/sounds';
import { getEnemyUnitsForEpoch } from '../config/militaryActions';

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
    militaryQueue,
    setMilitaryQueue,
    setBattleResult,
    nations,
    setNations,
    setClassInfluenceShift,
    daysElapsed,
    currentEvent,
    setCurrentEvent,
    eventHistory,
    setEventHistory,
    classApproval,
    setClassApproval,
    stability,
    setStability,
    setPopulation,
    setMaxPop,
    setMaxPopBonus,
    tradeRoutes,
    setTradeRoutes,
    jobsAvailable,
    eventEffectSettings,
    setActiveEventEffects,
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
    
    // 检查银币成本
    const silverCost = Object.entries(nextEpoch.cost).reduce((sum, [resource, amount]) => {
      return sum + amount * getMarketPrice(resource);
    }, 0);
    if ((resources.silver || 0) < silverCost) return false;
    
    return true;
  };

  /**
   * 升级时代
   */
  const upgradeEpoch = () => {
    if (!canUpgradeEpoch()) return;
    
    const nextEpoch = EPOCHS[epoch + 1];
    const newRes = { ...resources };
    
    // 计算银币成本
    const silverCost = Object.entries(nextEpoch.cost).reduce((sum, [resource, amount]) => {
      return sum + amount * getMarketPrice(resource);
    }, 0);
    
    // 扣除成本和银币
    for (let k in nextEpoch.cost) {
      newRes[k] -= nextEpoch.cost[k];
    }
    newRes.silver = Math.max(0, (newRes.silver || 0) - silverCost);
    
    setResources(newRes);
    setEpoch(epoch + 1);
    addLog(`🎉 文明进入 ${nextEpoch.name}！`);
    
    // 播放升级音效
    try {
      const soundGenerator = generateSound(SOUND_TYPES.LEVEL_UP);
      if (soundGenerator) soundGenerator();
    } catch (e) {
      console.warn('Failed to play level up sound:', e);
    }
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
    
    // 播放建造音效
    try {
      const soundGenerator = generateSound(SOUND_TYPES.BUILD);
      if (soundGenerator) soundGenerator();
    } catch (e) {
      console.warn('Failed to play build sound:', e);
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
    
    // 计算银币成本
    const silverCost = Object.entries(tech.cost).reduce((sum, [resource, amount]) => {
      return sum + amount * getMarketPrice(resource);
    }, 0);

    // 检查银币是否足够
    if ((resources.silver || 0) < silverCost) {
      addLog('银币不足，无法支付研究费用');
      return;
    }
    
    // 扣除资源和银币
    const newRes = { ...resources };
    for (let resource in tech.cost) {
      newRes[resource] -= tech.cost[resource];
    }
    newRes.silver = Math.max(0, (newRes.silver || 0) - silverCost);
    
    setResources(newRes);
    setTechsUnlocked(prev => [...prev, id]);
    addLog(`✓ 研究完成：${tech.name}`);
    
    // 播放研究音效
    try {
      const soundGenerator = generateSound(SOUND_TYPES.RESEARCH);
      if (soundGenerator) soundGenerator();
    } catch (e) {
      console.warn('Failed to play research sound:', e);
    }
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

    // 扣除资源
    const newRes = { ...resources };
    for (let resource in unit.recruitCost) {
      newRes[resource] -= unit.recruitCost[resource];
    }
    newRes.silver = Math.max(0, (newRes.silver || 0) - silverCost);
    setResources(newRes);
    
    // 加入训练队列，状态为等待人员
    setMilitaryQueue(prev => [...prev, {
      unitId,
      status: 'waiting', // 等待人员填补岗位
      remainingTime: unit.trainingTime, // 保存训练时长，等开始训练时使用
      totalTime: unit.trainingTime
    }]);
    
    addLog(`开始招募 ${unit.name}，等待人员填补岗位...`);
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
   * 取消训练队列中的单位
   * @param {number} queueIndex - 队列索引
   */
  const cancelTraining = (queueIndex) => {
    setMilitaryQueue(prev => {
      if (queueIndex < 0 || queueIndex >= prev.length) {
        return prev;
      }
      
      const item = prev[queueIndex];
      const unit = UNIT_TYPES[item.unitId];
      
      // 移除该项
      const newQueue = prev.filter((_, idx) => idx !== queueIndex);
      
      // 如果是等待状态或训练状态，返还部分资源（50%）
      if (item.status === 'waiting' || item.status === 'training') {
        const refundResources = {};
        for (let resource in unit.recruitCost) {
          refundResources[resource] = Math.floor(unit.recruitCost[resource] * 0.5);
        }
        
        const silverCost = Object.entries(unit.recruitCost).reduce((sum, [resource, amount]) => {
          return sum + amount * getMarketPrice(resource);
        }, 0);
        const refundSilver = Math.floor(silverCost * 0.5);
        
        setResources(prev => {
          const newRes = { ...prev };
          for (let resource in refundResources) {
            newRes[resource] = (newRes[resource] || 0) + refundResources[resource];
          }
          newRes.silver = (newRes.silver || 0) + refundSilver;
          return newRes;
        });
        
        addLog(`取消训练 ${unit.name}，返还50%资源`);
      }
      
      return newQueue;
    });
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

    // 计算敌方时代（基于国家的出现和消失时代）
    const enemyEpoch = Math.max(targetNation.appearEpoch || 0, Math.min(epoch, targetNation.expireEpoch ?? epoch));
    
    // 计算敌方军事实力（受战争消耗影响）
    const militaryStrength = targetNation.militaryStrength ?? 1.0; // 1.0 = 满实力，随战争降低
    const wealthFactor = Math.max(0.3, Math.min(1.5, (targetNation.wealth || 500) / 800)); // 财富影响兵力
    const aggressionFactor = 1 + (targetNation.aggression || 0.2);
    const warScoreFactor = 1 + Math.max(-0.5, (targetNation.warScore || 0) / 120);
    
    // 综合实力系数：军事实力 × 财富 × 侵略性 × 战争分数
    const overallStrength = militaryStrength * wealthFactor * aggressionFactor * warScoreFactor;
    
    // 根据敌方时代和行动类型获取兵种池
    const unitScale = mission.unitScale || 'medium';
    const availableUnits = getEnemyUnitsForEpoch(enemyEpoch, unitScale);
    
    // 生成敌方军队
    const defenderArmy = {};
    const baseCount = mission.baseUnitCount || { min: 10, max: 15 };
    const totalUnitsBase = baseCount.min + Math.random() * (baseCount.max - baseCount.min);
    const enemyTotalUnits = Math.floor(totalUnitsBase * overallStrength);
    
    // 将总兵力分配到各兵种
    availableUnits.forEach((unitId, index) => {
      if (UNIT_TYPES[unitId]) {
        // 每个兵种分配一定比例的兵力，带有随机性
        const ratio = 0.5 + Math.random() * 0.8; // 0.5-1.3的随机比例
        const count = Math.floor((enemyTotalUnits / availableUnits.length) * ratio);
        if (count > 0) {
          defenderArmy[unitId] = count;
        }
      }
    });

    const defenderData = {
      army: defenderArmy,
      epoch: enemyEpoch,
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
      
      // Add battle result loot (from simulateBattle)
      mergeLoot(result.loot || {});
      
      // Calculate proportional loot based on lootConfig if available
      if (mission.lootConfig) {
        const enemyWealth = targetNation.wealth || 500;
        Object.entries(mission.lootConfig).forEach(([resource, config]) => {
          const playerAmount = resources?.[resource] || 0;
          
          // Base amount from enemy wealth percentage
          const enemyBaseLoot = Math.floor(enemyWealth * config.enemyPercent);
          
          // Scale based on player's own resources (late game scaling)
          // The more resources you have, the more you can capture and transport
          const playerScaledLoot = Math.floor(playerAmount * config.playerPercent);
          
          // Final loot is calculated considering both factors
          // Minimum is baseMin, max is enemyBaseLoot, scale up with player resources
          const baseMin = config.baseMin || 10;
          const scaledAmount = Math.max(baseMin, Math.min(enemyBaseLoot, Math.max(enemyBaseLoot * 0.5, playerScaledLoot)));
          
          // Add some randomness (±20%)
          const randomFactor = 0.8 + Math.random() * 0.4;
          const finalAmount = Math.floor(scaledAmount * randomFactor);
          
          if (finalAmount > 0) {
            combinedLoot[resource] = (combinedLoot[resource] || 0) + finalAmount;
          }
        });
      } else {
        // Fallback to legacy loot ranges
        Object.entries(mission.loot || {}).forEach(([resource, range]) => {
          if (!Array.isArray(range) || range.length < 2) return;
          const [min, max] = range;
          const amount = Math.floor(min + Math.random() * (max - min + 1));
          if (amount > 0) {
            combinedLoot[resource] = (combinedLoot[resource] || 0) + amount;
          }
        });
      }
      
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

    // 计算军事实力损失（基于伤亡和财富损失）
    const militaryStrengthDamage = result.victory
      ? Math.min(0.15, enemyLossCount * 0.005 + wealthDamage / 10000) // 每次胜利最多削弱15%
      : 0;
    
    // 计算人口损失（战争消耗）
    const populationLoss = result.victory
      ? Math.floor(enemyLossCount * 0.8) // 每个士兵损失对应0.8人口损失
      : 0;

    setNations(prev => prev.map(n => {
      if (n.id !== nationId) return n;
      const currentStrength = n.militaryStrength ?? 1.0;
      const newStrength = Math.max(0.2, currentStrength - militaryStrengthDamage); // 最低保持20%实力
      const currentPopulation = n.population ?? 1000;
      const newPopulation = Math.max(100, currentPopulation - populationLoss); // 最低保持100人口
      
      return {
        ...n,
        wealth: Math.max(0, (n.wealth || 0) - wealthDamage),
        warScore: (n.warScore || 0) + warScoreDelta,
        enemyLosses: (n.enemyLosses || 0) + enemyLossCount,
        militaryStrength: newStrength,
        population: newPopulation,
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
    
    // 播放战斗音效
    try {
      const soundGenerator = generateSound(result.victory ? SOUND_TYPES.VICTORY : SOUND_TYPES.BATTLE);
      if (soundGenerator) soundGenerator();
    } catch (e) {
      console.warn('Failed to play battle sound:', e);
    }
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
        // 检查和平协议是否仍然有效
        if (targetNation.peaceTreatyUntil && daysElapsed < targetNation.peaceTreatyUntil) {
          const remainingDays = targetNation.peaceTreatyUntil - daysElapsed;
          addLog(`无法宣战：与 ${targetNation.name} 的和平协议还有 ${remainingDays} 天有效期。`);
          return;
        }
        
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
                peaceTreatyUntil: undefined, // 清除和平协议
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
        
        // 触发玩家和平提议事件
        const peaceEvent = createPlayerPeaceProposalEvent(
          targetNation,
          warScore,
          warDuration,
          enemyLosses,
          (proposalType, amount) => {
            handlePlayerPeaceProposal(nationId, proposalType, amount);
          }
        );
        triggerDiplomaticEvent(peaceEvent);
        break;
      }

      default:
        break;
    }
  };

  // ========== 和平协议处理 ==========

  /**
   * 处理敌方和平请求被接受
   * @param {string} nationId - 国家ID
   * @param {string} proposalType - 提议类型
   * @param {number} amount - 金额或人口数量
   */
  const handleEnemyPeaceAccept = (nationId, proposalType, amount) => {
    const clampRelation = (value) => Math.max(0, Math.min(100, value));
    const targetNation = nations.find(n => n.id === nationId);
    if (!targetNation) return;
    
    const peaceTreatyUntil = daysElapsed + 365; // 和平协议持续一年
    
    if (proposalType === 'installment') {
      // 分期支付赔款
      setNations(prev => prev.map(n =>
        n.id === nationId
          ? {
              ...n,
              isAtWar: false,
              warScore: 0,
              warDuration: 0,
              enemyLosses: 0,
              isPeaceRequesting: false,
              relation: Math.max(35, n.relation || 0),
              peaceTreatyUntil,
              installmentPayment: {
                amount: amount, // 每天支付的金额
                remainingDays: 365,
                totalAmount: amount * 365,
                paidAmount: 0,
              },
            }
          : n
      ));
      addLog(`你接受了和平协议，${targetNation.name}将每天支付 ${amount} 银币，持续一年（共${amount * 365}银币）。`);
    } else if (proposalType === 'population') {
      // 提供人口
        setMaxPopBonus(prev => prev + amount);
        setPopulation(prev => prev + amount);
        setNations(prev => prev.map(n =>
            n.id === nationId
            ? {
                ...n,
                isAtWar: false,
                warScore: 0,
                warDuration: 0,
                enemyLosses: 0,
                isPeaceRequesting: false,
                population: Math.max(100, (n.population || 1000) - amount),
                relation: Math.max(35, n.relation || 0),
                peaceTreatyUntil,
                }
            : n
        ));
      addLog(`你接受了和平协议，${targetNation.name}提供了 ${amount} 人口。`);
    } else if (proposalType === 'open_market') {
      // 开放市场 - 战败国在N天内不限制贸易路线数量
      const openMarketUntil = daysElapsed + amount; // amount为天数
      const yearsCount = Math.round(amount / 365);
      setNations(prev => prev.map(n =>
        n.id === nationId
          ? {
              ...n,
              isAtWar: false,
              warScore: 0,
              warDuration: 0,
              enemyLosses: 0,
              isPeaceRequesting: false,
              relation: Math.max(35, n.relation || 0),
              peaceTreatyUntil,
              openMarketUntil, // 开放市场截止日期
            }
          : n
      ));
      addLog(`你接受了和平协议，${targetNation.name}将在${yearsCount}年内开放市场，不限制我方贸易路线数量。`);
    } else {
      // 标准赔款或更多赔款
      setResources(prev => ({ ...prev, silver: (prev.silver || 0) + amount }));
      setNations(prev => prev.map(n =>
        n.id === nationId
          ? {
              ...n,
              isAtWar: false,
              warScore: 0,
              warDuration: 0,
              enemyLosses: 0,
              isPeaceRequesting: false,
              wealth: Math.max(0, (n.wealth || 0) - amount),
              relation: Math.max(35, n.relation || 0),
              peaceTreatyUntil,
            }
          : n
      ));
      addLog(`你接受了和平协议，${targetNation.name}支付了 ${amount} 银币。`);
    }
  };

  /**
   * 处理敌方和平请求被拒绝
   * @param {string} nationId - 国家ID
   */
  const handleEnemyPeaceReject = (nationId) => {
    setNations(prev => prev.map(n =>
      n.id === nationId
        ? {
            ...n,
            isPeaceRequesting: false,
          }
        : n
    ));
    addLog(`你拒绝了${nations.find(n => n.id === nationId)?.name || '敌国'}的和平请求，战争继续。`);
  };

  /**
   * 处理玩家和平提议
   * @param {string} nationId - 国家ID
   * @param {string} proposalType - 提议类型
   * @param {number} amount - 金额
   */
  const handlePlayerPeaceProposal = (nationId, proposalType, amount) => {
    if (proposalType === 'cancel') {
      addLog('你取消了和平谈判。');
      return;
    }

    const targetNation = nations.find(n => n.id === nationId);
    if (!targetNation) return;

    const clampRelation = (value) => Math.max(0, Math.min(100, value));
    const warScore = targetNation.warScore || 0;
    const warDuration = targetNation.warDuration || 0;
    const enemyLosses = targetNation.enemyLosses || 0;
    const peaceTreatyUntil = daysElapsed + 365; // 和平协议持续一年

    // 根据提议类型处理
    if (proposalType === 'demand_high') {
      // 要求高额赔款，成功率较低
      const willingness = (warScore / 100) + Math.min(0.4, enemyLosses / 250) + Math.min(0.2, warDuration / 250);
      if (willingness > 0.7 || (targetNation.wealth || 0) <= 0) {
        setResources(prev => ({ ...prev, silver: (prev.silver || 0) + amount }));
        setNations(prev => prev.map(n =>
          n.id === nationId
            ? {
                ...n,
                wealth: Math.max(0, (n.wealth || 0) - amount),
                isAtWar: false,
                warScore: 0,
                warDuration: 0,
                enemyLosses: 0,
                relation: clampRelation((n.relation || 0) + 5),
                peaceTreatyUntil,
              }
            : n
        ));
        addLog(`${targetNation.name} 接受了你的高额赔款要求，支付 ${amount} 银币换取和平。`);
      } else {
        addLog(`${targetNation.name} 拒绝了你的高额赔款要求。`);
      }
    } else if (proposalType === 'demand_installment') {
      // 要求分期支付赔款
      const willingness = (warScore / 90) + Math.min(0.45, enemyLosses / 220) + Math.min(0.25, warDuration / 220);
      if (willingness > 0.65) {
        setNations(prev => prev.map(n =>
          n.id === nationId
            ? {
                ...n,
                isAtWar: false,
                warScore: 0,
                warDuration: 0,
                enemyLosses: 0,
                relation: clampRelation((n.relation || 0) + 8),
                peaceTreatyUntil,
                installmentPayment: {
                  amount: amount, // 每天支付的金额
                  remainingDays: 365,
                  totalAmount: amount * 365,
                  paidAmount: 0,
                },
              }
            : n
        ));
        addLog(`${targetNation.name} 接受了分期支付协议，将每天支付 ${amount} 银币，持续一年（共${amount * 365}银币）。`);
      } else {
        addLog(`${targetNation.name} 拒绝了分期支付要求。`);
      }
    } else if (proposalType === 'demand_population') {
      // 要求提供人口
      const willingness = (warScore / 95) + Math.min(0.42, enemyLosses / 230) + Math.min(0.23, warDuration / 230);
      if (willingness > 0.68) {
        setMaxPopBonus(prev => prev + amount);
        setPopulation(prev => prev + amount);
        setNations(prev => prev.map(n =>
          n.id === nationId
            ? {
                ...n,
                isAtWar: false,
                warScore: 0,
                warDuration: 0,
                enemyLosses: 0,
                population: Math.max(100, (n.population || 1000) - amount),
                relation: clampRelation((n.relation || 0) + 7),
                peaceTreatyUntil,
              }
            : n
        ));
        addLog(`${targetNation.name} 接受了和平协议，提供了 ${amount} 人口。`);
      } else {
        addLog(`${targetNation.name} 拒绝了提供人口的要求。`);
      }
    } else if (proposalType === 'demand_standard' || proposalType === 'demand_tribute') {
      // 要求标准赔款
      const willingness = (warScore / 80) + Math.min(0.5, enemyLosses / 200) + Math.min(0.3, warDuration / 200);
      if (willingness > 0.6 || (targetNation.wealth || 0) <= 0) {
        setResources(prev => ({ ...prev, silver: (prev.silver || 0) + amount }));
        setNations(prev => prev.map(n =>
          n.id === nationId
            ? {
                ...n,
                wealth: Math.max(0, (n.wealth || 0) - amount),
                isAtWar: false,
                warScore: 0,
                warDuration: 0,
                enemyLosses: 0,
                relation: clampRelation((n.relation || 0) + 10),
                peaceTreatyUntil,
              }
            : n
        ));
        addLog(`${targetNation.name} 接受了和平协议，支付 ${amount} 银币。`);
      } else {
        addLog(`${targetNation.name} 拒绝了你的赔款要求。`);
      }
    } else if (proposalType === 'peace_only') {
      // 无条件和平，成功率较高
      const willingness = Math.max(0.3, (warScore / 60) + Math.min(0.4, enemyLosses / 150));
      if (willingness > 0.5) {
        setNations(prev => prev.map(n =>
          n.id === nationId
            ? {
                ...n,
                isAtWar: false,
                warScore: 0,
                warDuration: 0,
                enemyLosses: 0,
                relation: clampRelation((n.relation || 0) + 15),
                peaceTreatyUntil,
              }
            : n
        ));
        addLog(`${targetNation.name} 接受了和平协议，战争结束。`);
      } else {
        addLog(`${targetNation.name} 拒绝了和平提议。`);
      }
    } else if (proposalType === 'demand_open_market') {
      // 要求开放市场 - 战败国在N天内不限制贸易路线数量
      const willingness = (warScore / 85) + Math.min(0.45, enemyLosses / 210) + Math.min(0.25, warDuration / 210);
      if (willingness > 0.6) {
        const openMarketUntil = daysElapsed + amount; // amount为天数
        const yearsCount = Math.round(amount / 365);
        setNations(prev => prev.map(n =>
          n.id === nationId
            ? {
                ...n,
                isAtWar: false,
                warScore: 0,
                warDuration: 0,
                enemyLosses: 0,
                relation: clampRelation((n.relation || 0) + 10),
                peaceTreatyUntil,
                openMarketUntil, // 开放市场截止日期
              }
            : n
        ));
        addLog(`${targetNation.name} 接受了和平协议，将在${yearsCount}年内开放市场，不限制我方贸易路线数量。`);
      } else {
        addLog(`${targetNation.name} 拒绝了开放市场的要求。`);
      }
    } else if (proposalType === 'pay_installment') {
      // 玩家分期支付赔款
      setNations(prev => prev.map(n =>
        n.id === nationId
          ? {
              ...n,
              isAtWar: false,
              warScore: 0,
              warDuration: 0,
              enemyLosses: 0,
              relation: clampRelation(28),
              peaceTreatyUntil,
            }
          : n
      ));
      // 设置玩家的分期支付
      gameState.setPlayerInstallmentPayment({
        nationId,
        amount: amount,
        remainingDays: 365,
        totalAmount: amount * 365,
        paidAmount: 0,
      });
      addLog(`你与 ${targetNation.name} 达成和平，将每天支付 ${amount} 银币，持续一年（共${amount * 365}银币）。`);
    } else if (proposalType === 'offer_population') {
      // 玩家提供人口
      if (population < amount) {
        addLog('人口不足，无法提供。');
        return;
      }
      setMaxPopBonus(prev => Math.max(-population + 1, prev - amount));
      setPopulation(prev => Math.max(1, prev - amount));
      setNations(prev => prev.map(n =>
        n.id === nationId
          ? {
              ...n,
              isAtWar: false,
              warScore: 0,
              warDuration: 0,
              enemyLosses: 0,
              population: (n.population || 1000) + amount,
              relation: clampRelation(27),
              peaceTreatyUntil,
            }
          : n
      ));
      addLog(`你提供 ${amount} 人口，与 ${targetNation.name} 达成和平。`);
    } else if (proposalType === 'pay_standard' || proposalType === 'pay_high') {
      // 玩家支付赔款求和
      if ((resources.silver || 0) < amount) {
        addLog('银币不足，无法支付赔款。');
        return;
      }
      setResources(prev => ({ ...prev, silver: (prev.silver || 0) - amount }));
      setNations(prev => prev.map(n =>
        n.id === nationId
          ? {
              ...n,
              isAtWar: false,
              warScore: 0,
              warDuration: 0,
              enemyLosses: 0,
              wealth: (n.wealth || 0) + amount,
              relation: clampRelation(proposalType === 'pay_high' ? 25 : 30),
              peaceTreatyUntil,
            }
          : n
      ));
      addLog(`你支付 ${amount} 银币，与 ${targetNation.name} 达成和平。`);
    }
  };

  // ========== 贸易路线系统 ==========

  /**
   * 处理贸易路线操作
   * @param {string} nationId - 目标国家ID
   * @param {string} action - 操作类型：'create' 或 'cancel'
   * @param {Object} payload - 操作参数 { resource, type: 'import'|'export' }
   */
  const handleTradeRouteAction = (nationId, action, payload = {}) => {
    const targetNation = nations.find(n => n.id === nationId);
    if (!targetNation) return;

    const { resource: resourceKey, type } = payload;
    if (!resourceKey || !type) return;

    // 检查资源是否有效
    if (!RESOURCES[resourceKey] || RESOURCES[resourceKey].type === 'virtual' || resourceKey === 'silver') {
      addLog('该资源无法创建贸易路线。');
      return;
    }

    // 检查资源是否已解锁
    const resourceDef = RESOURCES[resourceKey];
    if ((resourceDef.unlockEpoch ?? 0) > epoch) {
      addLog(`${resourceDef.name} 尚未解锁，无法创建贸易路线。`);
      return;
    }

    if (action === 'create') {
      // 检查贸易路线数量是否超过商人岗位上限（只有当有商人岗位时才检查）
      const merchantJobLimit = jobsAvailable?.merchant || 0;
      const currentRouteCount = tradeRoutes.routes.length;
      if (merchantJobLimit > 0 && currentRouteCount >= merchantJobLimit) {
        addLog(`贸易路线数量已达上限（${merchantJobLimit}），需要更多商人岗位。请建造更多贸易站。`);
        return;
      }

      // 检查是否处于战争
      if (targetNation.isAtWar) {
        addLog(`与 ${targetNation.name} 处于战争状态，无法创建贸易路线。`);
        return;
      }

      // Check if open market is active (defeated nation allows unlimited trade)
      const isOpenMarketActive = targetNation.openMarketUntil && daysElapsed < targetNation.openMarketUntil;
      
      // Check relation-based trade route limit (skip if open market is active)
      if (!isOpenMarketActive) {
        const nationRelation = targetNation.relation || 0;
        const getMaxTradeRoutesForRelation = (relation) => {
          if (relation >= 80) return 4; // Allied
          if (relation >= 60) return 3; // Friendly
          if (relation >= 40) return 2; // Neutral
          if (relation >= 20) return 1; // Cold
          return 0; // Hostile - no trade
        };
        const maxRoutesWithNation = getMaxTradeRoutesForRelation(nationRelation);
        const currentRoutesWithNation = tradeRoutes.routes.filter(r => r.nationId === nationId).length;
        
        if (maxRoutesWithNation === 0) {
          addLog(`与 ${targetNation.name} 关系敌对（${nationRelation}），无法建立贸易路线。请先改善关系至少达到20。`);
          return;
        }
        
        if (currentRoutesWithNation >= maxRoutesWithNation) {
          const relationLabels = { 0: '敌对', 1: '冷淡', 2: '中立', 3: '友好', 4: '盟友' };
          addLog(`与 ${targetNation.name} 的贸易路线已达关系上限（${currentRoutesWithNation}/${maxRoutesWithNation}条，关系${relationLabels[maxRoutesWithNation]}）。提升关系可增加贸易路线数量。`);
          return;
        }
      }

      // 检查是否已存在相同的贸易路线
      const exists = tradeRoutes.routes.some(
        route => route.nationId === nationId && route.resource === resourceKey && route.type === type
      );
      if (exists) {
        addLog(`已存在该贸易路线。`);
        return;
      }

      // 检查贸易条件
      const tradeStatus = calculateTradeStatus(resourceKey, targetNation, daysElapsed);
      if (type === 'export') {
        // 出口：对方需要有缺口
        if (!tradeStatus.isShortage || tradeStatus.shortageAmount <= 0) {
          addLog(`${targetNation.name} 对 ${resourceDef.name} 没有缺口，无法创建出口路线。`);
          return;
        }
      } else if (type === 'import') {
        // 进口：对方需要有盈余
        if (!tradeStatus.isSurplus || tradeStatus.surplusAmount <= 0) {
          addLog(`${targetNation.name} 对 ${resourceDef.name} 没有盈余，无法创建进口路线。`);
          return;
        }
      }

      // 创建贸易路线
      setTradeRoutes(prev => ({
        ...prev,
        routes: [
          ...prev.routes,
          {
            nationId,
            resource: resourceKey,
            type,
            createdAt: daysElapsed,
          }
        ]
      }));

      const typeText = type === 'export' ? '出口' : '进口';
      addLog(`✅ 已创建 ${resourceDef.name} 的${typeText}贸易路线至 ${targetNation.name}。`);

    } else if (action === 'cancel') {
      // 取消贸易路线
      const routeExists = tradeRoutes.routes.some(
        route => route.nationId === nationId && route.resource === resourceKey && route.type === type
      );
      if (!routeExists) {
        addLog(`该贸易路线不存在。`);
        return;
      }

      setTradeRoutes(prev => ({
        ...prev,
        routes: prev.routes.filter(
          route => !(route.nationId === nationId && route.resource === resourceKey && route.type === type)
        )
      }));

      const typeText = type === 'export' ? '出口' : '进口';
      addLog(`❌ 已取消 ${resourceDef.name} 的${typeText}贸易路线至 ${targetNation.name}。`);
    }
  };

  // ========== 事件系统 ==========

  /**
   * 触发随机事件
   */
  const triggerRandomEvent = () => {
    // 如果已经有事件在显示，不再触发新事件
    if (currentEvent) return;

    const event = getRandomEvent(gameState);
    if (event) {
      setCurrentEvent(event);
      addLog(`⚠️ 事件：${event.name}`);
      generateSound(SOUND_TYPES.EVENT);
      // 事件触发时暂停游戏
      gameState.setIsPaused(true);
    }
  };

  /**
   * 触发外交事件
   * @param {Object} diplomaticEvent - 外交事件对象
   */
  const triggerDiplomaticEvent = (diplomaticEvent) => {
    console.log('[TRIGGER EVENT] Called with event:', diplomaticEvent);
    console.log('[TRIGGER EVENT] Current event:', currentEvent);
    if (currentEvent) {
      console.log('[TRIGGER EVENT] Blocked: already have an event showing');
      return; // 如果已有事件在显示，不触发
    }
    
    console.log('[TRIGGER EVENT] Setting current event...');
    setCurrentEvent(diplomaticEvent);
    addLog(`⚠️ 外交事件：${diplomaticEvent.name}`);
    generateSound(SOUND_TYPES.EVENT);
    // 外交事件触发时暂停游戏
    gameState.setIsPaused(true);
    console.log('[TRIGGER EVENT] Event triggered successfully');
  };

  /**
   * 处理事件选项
   * @param {string} eventId - 事件ID
   * @param {Object} option - 选择的选项
   */
const handleEventOption = (eventId, option) => {
  // 尝试从EVENTS中查找，如果找不到则使用currentEvent（用于外交事件）
  let event = EVENTS.find(e => e.id === eventId);
  if (!event && currentEvent && currentEvent.id === eventId) {
    event = currentEvent;
  }
	if (!event) return;

	const approvalSettings = eventEffectSettings?.approval || {};
	const stabilitySettings = eventEffectSettings?.stability || {};
	const clampDecay = (value, fallback) => {
		if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
		return Math.min(0.95, Math.max(0, value));
	};

	const registerApprovalEffect = (changes = {}) => {
		if (!changes || typeof setActiveEventEffects !== 'function') return;
		const entries = Object.entries(changes).filter(([, value]) => typeof value === 'number' && value !== 0);
		if (!entries.length) return;
		const duration = Math.max(1, approvalSettings.duration || 30);
		const decayRate = clampDecay(approvalSettings.decayRate ?? 0.04, 0.04);
		const timestamp = Date.now();
		setActiveEventEffects(prev => {
			const next = {
				approval: [...(prev?.approval || [])],
				stability: [...(prev?.stability || [])],
			};
			entries.forEach(([stratum, value]) => {
				next.approval.push({
					id: `approval_${timestamp}_${stratum}_${Math.random()}`,
					stratum,
					currentValue: value,
					remainingDays: duration,
					decayRate,
				});
			});
			return next;
		});
	};

	const registerStabilityEffect = (value) => {
		if (typeof value !== 'number' || value === 0 || typeof setActiveEventEffects !== 'function') return;
		const duration = Math.max(1, stabilitySettings.duration || 30);
		const decayRate = clampDecay(stabilitySettings.decayRate ?? 0.04, 0.04);
		const timestamp = Date.now();
		setActiveEventEffects(prev => ({
			approval: [...(prev?.approval || [])],
			stability: [
				...(prev?.stability || []),
				{
					id: `stability_${timestamp}_${Math.random()}`,
					currentValue: value,
					remainingDays: duration,
					decayRate,
				},
			],
		}));
	};

	// Economic effect settings
	const resourceDemandSettings = eventEffectSettings?.resourceDemand || { duration: 60, decayRate: 0.02 };
	const stratumDemandSettings = eventEffectSettings?.stratumDemand || { duration: 60, decayRate: 0.02 };
	const buildingProductionSettings = eventEffectSettings?.buildingProduction || { duration: 45, decayRate: 0.025 };

	// Register resource demand modifier effect
	// resourceDemandMod: { resourceKey: percentModifier } e.g., { cloth: 0.2 } = +20% cloth demand
	const registerResourceDemandEffect = (mods = {}) => {
		if (!mods || typeof setActiveEventEffects !== 'function') return;
		const entries = Object.entries(mods).filter(([, value]) => typeof value === 'number' && value !== 0);
		if (!entries.length) return;
		const duration = Math.max(1, resourceDemandSettings.duration || 60);
		const decayRate = clampDecay(resourceDemandSettings.decayRate ?? 0.02, 0.02);
		const timestamp = Date.now();
		setActiveEventEffects(prev => ({
			...prev,
			resourceDemand: [
				...(prev?.resourceDemand || []),
				...entries.map(([target, value]) => ({
					id: `resourceDemand_${timestamp}_${target}_${Math.random()}`,
					target,
					currentValue: value,
					remainingDays: duration,
					decayRate,
				})),
			],
		}));
	};

	// Register stratum demand modifier effect
	// stratumDemandMod: { stratumKey: percentModifier } e.g., { noble: 0.15 } = +15% noble consumption
	const registerStratumDemandEffect = (mods = {}) => {
		if (!mods || typeof setActiveEventEffects !== 'function') return;
		const entries = Object.entries(mods).filter(([, value]) => typeof value === 'number' && value !== 0);
		if (!entries.length) return;
		const duration = Math.max(1, stratumDemandSettings.duration || 60);
		const decayRate = clampDecay(stratumDemandSettings.decayRate ?? 0.02, 0.02);
		const timestamp = Date.now();
		setActiveEventEffects(prev => ({
			...prev,
			stratumDemand: [
				...(prev?.stratumDemand || []),
				...entries.map(([target, value]) => ({
					id: `stratumDemand_${timestamp}_${target}_${Math.random()}`,
					target,
					currentValue: value,
					remainingDays: duration,
					decayRate,
				})),
			],
		}));
	};

	// Register building production modifier effect
	// buildingProductionMod: { buildingIdOrCat: percentModifier } e.g., { farm: 0.1, gather: -0.05 }
	const registerBuildingProductionEffect = (mods = {}) => {
		if (!mods || typeof setActiveEventEffects !== 'function') return;
		const entries = Object.entries(mods).filter(([, value]) => typeof value === 'number' && value !== 0);
		if (!entries.length) return;
		const duration = Math.max(1, buildingProductionSettings.duration || 45);
		const decayRate = clampDecay(buildingProductionSettings.decayRate ?? 0.025, 0.025);
		const timestamp = Date.now();
		setActiveEventEffects(prev => ({
			...prev,
			buildingProduction: [
				...(prev?.buildingProduction || []),
				...entries.map(([target, value]) => ({
					id: `buildingProduction_${timestamp}_${target}_${Math.random()}`,
					target,
					currentValue: value,
					remainingDays: duration,
					decayRate,
				})),
			],
		}));
	};

	// 通用效果应用函数
  const applyEffects = (effects = {}) => {
    // 资源（固定值）
    if (effects.resources) {
      setResources(prev => {
        const updated = { ...prev };
        Object.entries(effects.resources).forEach(([resource, value]) => {
          updated[resource] = Math.max(0, (updated[resource] || 0) + value);
        });
        return updated;
      });
    }

    // 资源（百分比变化）- resourcePercent: { food: -0.05 } 表示减少5%的食物
    if (effects.resourcePercent) {
      setResources(prev => {
        const updated = { ...prev };
        Object.entries(effects.resourcePercent).forEach(([resource, percent]) => {
          const currentValue = updated[resource] || 0;
          const change = Math.floor(currentValue * percent);
          updated[resource] = Math.max(0, currentValue + change);
        });
        return updated;
      });
    }

    // 人口（固定值）
    if (effects.population) {
      setPopulation(prev => Math.max(1, prev + effects.population));
    }

    // 人口（百分比变化）- populationPercent: -0.1 表示减少10%的人口
    if (effects.populationPercent) {
      setPopulation(prev => {
        const change = Math.floor(prev * effects.populationPercent);
        return Math.max(1, prev + change);
      });
    }

		// 稳定度
		if (effects.stability) {
			setStability(prev => Math.max(0, Math.min(100, prev + effects.stability)));
			registerStabilityEffect(effects.stability);
		}

    // 科技
    if (effects.science) {
      setResources(prev => ({
        ...prev,
        science: Math.max(0, (prev.science || 0) + effects.science),
      }));
    }

		// 阶层支持度
		if (effects.approval) {
			setClassApproval(prev => {
				const updated = { ...prev };
				Object.entries(effects.approval).forEach(([stratum, value]) => {
					updated[stratum] = Math.max(
						0,
						Math.min(100, (updated[stratum] || 50) + value),
					);
				});
				return updated;
			});
			registerApprovalEffect(effects.approval);
		}

		// Economic effects - timed modifiers that decay over time
		// Resource demand modifier: affects how much of a resource is consumed
		if (effects.resourceDemandMod) {
			registerResourceDemandEffect(effects.resourceDemandMod);
		}

		// Stratum demand modifier: affects how much a specific stratum consumes
		if (effects.stratumDemandMod) {
			registerStratumDemandEffect(effects.stratumDemandMod);
		}

		// Building production modifier: affects building output
		if (effects.buildingProductionMod) {
			registerBuildingProductionEffect(effects.buildingProductionMod);
		}

		// ========== Diplomatic Effects ==========
		// Helper function to resolve nation selector
		const resolveNationSelector = (selector) => {
			const visibleNations = nations.filter(n => n.visible !== false);
			if (!visibleNations.length) return [];
			
			switch (selector) {
				case 'random':
					return [visibleNations[Math.floor(Math.random() * visibleNations.length)]];
				case 'all':
					return visibleNations;
				case 'hostile':
					return visibleNations.filter(n => (n.relation || 50) < 30);
				case 'friendly':
					return visibleNations.filter(n => (n.relation || 50) >= 60);
				case 'strongest':
					return [visibleNations.reduce((a, b) => (a.wealth || 0) > (b.wealth || 0) ? a : b)];
				case 'weakest':
					return [visibleNations.reduce((a, b) => (a.wealth || 0) < (b.wealth || 0) ? a : b)];
				default:
					// Direct nation id
					const nation = visibleNations.find(n => n.id === selector);
					return nation ? [nation] : [];
			}
		};

		// Nation relation modifier: { nationId/selector: change }
		if (effects.nationRelation) {
			const excludeList = effects.nationRelation.exclude || [];
			setNations(prev => {
				const updated = [...prev];
				Object.entries(effects.nationRelation).forEach(([selector, change]) => {
					if (selector === 'exclude') return;
					const targets = resolveNationSelector(selector);
					targets.forEach(target => {
						if (excludeList.includes(target.id)) return;
						const idx = updated.findIndex(n => n.id === target.id);
						if (idx >= 0) {
							const oldRelation = updated[idx].relation || 50;
							updated[idx] = {
								...updated[idx],
								relation: Math.max(0, Math.min(100, oldRelation + change)),
							};
							addLog(`与 ${updated[idx].name} 的关系${change > 0 ? '改善' : '恶化'}了 ${Math.abs(change)} 点`);
						}
					});
				});
				return updated;
			});
		}

		// Nation aggression modifier: { nationId/selector: change }
		if (effects.nationAggression) {
			setNations(prev => {
				const updated = [...prev];
				Object.entries(effects.nationAggression).forEach(([selector, change]) => {
					const targets = resolveNationSelector(selector);
					targets.forEach(target => {
						const idx = updated.findIndex(n => n.id === target.id);
						if (idx >= 0) {
							const oldAggression = updated[idx].aggression || 0.5;
							updated[idx] = {
								...updated[idx],
								aggression: Math.max(0, Math.min(1, oldAggression + change)),
							};
						}
					});
				});
				return updated;
			});
		}

		// Nation wealth modifier: { nationId/selector: change }
		if (effects.nationWealth) {
			setNations(prev => {
				const updated = [...prev];
				Object.entries(effects.nationWealth).forEach(([selector, change]) => {
					const targets = resolveNationSelector(selector);
					targets.forEach(target => {
						const idx = updated.findIndex(n => n.id === target.id);
						if (idx >= 0) {
							const oldWealth = updated[idx].wealth || 1000;
							updated[idx] = {
								...updated[idx],
								wealth: Math.max(0, oldWealth + change),
							};
						}
					});
				});
				return updated;
			});
		}

		// Nation market volatility modifier: { nationId/selector: change }
		if (effects.nationMarketVolatility) {
			setNations(prev => {
				const updated = [...prev];
				Object.entries(effects.nationMarketVolatility).forEach(([selector, change]) => {
					const targets = resolveNationSelector(selector);
					targets.forEach(target => {
						const idx = updated.findIndex(n => n.id === target.id);
						if (idx >= 0) {
							const oldVolatility = updated[idx].marketVolatility || 0.3;
							updated[idx] = {
								...updated[idx],
								marketVolatility: Math.max(0.1, Math.min(0.8, oldVolatility + change)),
							};
						}
					});
				});
				return updated;
			});
		}

		// Trigger war with a nation
		if (effects.triggerWar) {
			const targets = resolveNationSelector(effects.triggerWar);
			if (targets.length > 0) {
				const target = targets[0];
				setNations(prev => prev.map(n =>
					n.id === target.id
						? {
								...n,
								relation: 0,
								isAtWar: true,
								warScore: 0,
								warStartDay: daysElapsed,
								warDuration: 0,
								enemyLosses: 0,
								peaceTreatyUntil: undefined,
							}
						: n
				));
				addLog(`⚔️ ${target.name} 向我方宣战！`);
			}
		}

		// Trigger peace with a nation
		if (effects.triggerPeace) {
			const targets = resolveNationSelector(effects.triggerPeace);
			if (targets.length > 0) {
				const target = targets[0];
				setNations(prev => prev.map(n =>
					n.id === target.id && n.isAtWar
						? {
								...n,
								isAtWar: false,
								warScore: 0,
								warDuration: 0,
								enemyLosses: 0,
								peaceTreatyUntil: daysElapsed + 365,
							}
						: n
				));
				addLog(`🕊️ 与 ${target.name} 的战争结束，签订和平协议`);
			}
		}
  };

  // 基础效果（必然发生）
  const baseEffects = option.effects || {};

  // 概率效果：randomEffects: [{ chance, effects }, ...]
  const randomEffects = Array.isArray(option.randomEffects)
    ? option.randomEffects
    : [];

  // 先应用基础效果
  applyEffects(baseEffects);

  // 再逐条按概率叠加 randomEffects
  randomEffects.forEach(re => {
    const chance = typeof re.chance === 'number' ? re.chance : 0;
    if (chance > 0 && Math.random() < chance) {
      applyEffects(re.effects || {});
    }
  });

  // 执行回调（用于外交事件）
  if (option.callback && typeof option.callback === 'function') {
    option.callback();
  }

  // 记录事件历史
  setEventHistory(prev => [
    {
      eventId,
      eventName: event.name,
      optionId: option.id,
      optionText: option.text,
      timestamp: Date.now(),
      day: daysElapsed,
    },
    ...prev,
  ].slice(0, 50));

  // 添加日志
  addLog(`你选择了「${option.text}」`);

  // 清除当前事件
  setCurrentEvent(null);
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
    cancelTraining,
    launchBattle,

    // 外交
    handleDiplomaticAction,
    handleEnemyPeaceAccept,
    handleEnemyPeaceReject,
    handlePlayerPeaceProposal,

    // 贸易路线
    handleTradeRouteAction,

    // 事件
    triggerRandomEvent,
    triggerDiplomaticEvent,
    handleEventOption,
    
    // 战斗结果
    setBattleResult,
  };
};
