// Event utility functions
// Helper functions for event triggering and selection

/**
 * 检查事件是否可以触发
 * @param {Object} event - 事件对象
 * @param {Object} gameState - 游戏状态
 * @returns {boolean} - 是否可以触发
 */
export function canTriggerEvent(event, gameState) {
  if (!event.triggerConditions) return true;
  
  const conditions = event.triggerConditions;
  
  // 检查人口条件
  if (conditions.minPopulation && gameState.population < conditions.minPopulation) {
    return false;
  }
  
  // 检查时代条件
  if ((conditions.minEpoch !== undefined && gameState.epoch < conditions.minEpoch) || (conditions.maxEpoch !== undefined && gameState.epoch > conditions.maxEpoch)) {
    return false;
  }
  
  // 检查科技条件
  if (conditions.minScience && gameState.resources.science < conditions.minScience) {
    return false;
  }
  
  // 检查阶层相关条件（人口、好感度、影响力占比、收入与财富变动）
  if (conditions.classConditions) {
    const popStructure = gameState.popStructure || {};
    const classApproval = gameState.classApproval || {};
    const classInfluence = gameState.classInfluence || {};
    const classWealth = gameState.classWealth || {};
    const classWealthDelta = gameState.classWealthDelta || {};
    const classIncome = gameState.classIncome || {};

    let totalInfluence = gameState.totalInfluence;
    if (!totalInfluence || totalInfluence <= 0) {
      totalInfluence = Object.values(classInfluence).reduce((sum, val) => sum + (val || 0), 0);
    }

    let totalWealth = gameState.totalWealth;
    if (!totalWealth || totalWealth <= 0) {
      totalWealth = Object.values(classWealth).reduce((sum, val) => sum + (val || 0), 0);
    }

    for (const key in conditions.classConditions) {
      const cond = conditions.classConditions[key];
      if (!cond) continue;

      const pop = popStructure[key] || 0;
      const approval = classApproval[key] ?? 50;
      const influenceValue = classInfluence[key] || 0;
      const wealthValue = classWealth[key] || 0;
      const wealthDelta = classWealthDelta[key] || 0;
      const income = classIncome[key] || 0;

      const influenceShare = totalInfluence > 0 ? influenceValue / totalInfluence : 0;
      const wealthShare = totalWealth > 0 ? wealthValue / totalWealth : 0;

      if (cond.minPop !== undefined && pop < cond.minPop) return false;
      if (cond.maxPop !== undefined && pop > cond.maxPop) return false;

      if (cond.minApproval !== undefined && approval < cond.minApproval) return false;
      if (cond.maxApproval !== undefined && approval > cond.maxApproval) return false;

      if (cond.minInfluenceShare !== undefined && influenceShare < cond.minInfluenceShare) return false;
      if (cond.maxInfluenceShare !== undefined && influenceShare > cond.maxInfluenceShare) return false;

      if (cond.minWealth !== undefined && wealthValue < cond.minWealth) return false;
      if (cond.maxWealth !== undefined && wealthValue > cond.maxWealth) return false;

      if (cond.minWealthShare !== undefined && wealthShare < cond.minWealthShare) return false;
      if (cond.maxWealthShare !== undefined && wealthShare > cond.maxWealthShare) return false;

      if (cond.minWealthDelta !== undefined && wealthDelta < cond.minWealthDelta) return false;
      if (cond.maxWealthDelta !== undefined && wealthDelta > cond.maxWealthDelta) return false;

      if (cond.minIncome !== undefined && income < cond.minIncome) return false;
      if (cond.maxIncome !== undefined && income > cond.maxIncome) return false;
    }
  }
  
  return true;
}

/**
 * 获取可触发的随机事件
 * @param {Object} gameState - 游戏状态
 * @param {Array} events - 事件数组
 * @returns {Object|null} - 随机事件或null
 */
export function getRandomEvent(gameState, events) {
  const availableEvents = events.filter(event => canTriggerEvent(event, gameState));
  
  if (availableEvents.length === 0) return null;
  
  const randomIndex = Math.floor(Math.random() * availableEvents.length);
  return availableEvents[randomIndex];
}
