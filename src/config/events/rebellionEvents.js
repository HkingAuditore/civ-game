// 叛乱事件系统
// 当阶层长期不满且拥有较大影响力时，可能发动叛乱

import { STRATA } from '../strata';

// 叛乱阶段枚举
export const REBELLION_PHASE = {
  NONE: 'none',           // 无叛乱
  BREWING: 'brewing',     // 酝酿思潮
  PLOTTING: 'plotting',   // 密谋叛乱
  ACTIVE: 'active',       // 正在叛乱
};

// 叛乱配置常量
export const REBELLION_CONFIG = {
  // 触发条件
  MIN_DISSATISFACTION_DAYS: 180,    // 最低不满天数（约半年）
  MIN_INFLUENCE_SHARE: 0.15,        // 最低影响力占比（15%）
  MAX_APPROVAL_THRESHOLD: 35,       // 好感度阈值（低于此值视为不满）
  
  // [已废弃] 阶段进展概率 - 现由组织度阈值确定性触发
  // 保留以兼容旧存档，但不再使用
  // BREWING_CHANCE: 0.005,            // 进入酝酿思潮的每日概率（0.5%）
  // PLOTTING_CHANCE: 0.01,            // 从酝酿进入密谋的每日概率（1%）
  // ACTIVE_CHANCE: 0.02,              // 从密谋进入叛乱的每日概率（2%）
  
  // 干预成功率
  INVESTIGATE_SUCCESS_BASE: 0.6,    // 调查基础成功率
  ARREST_SUCCESS_BASE: 0.4,         // 拘捕基础成功率
  SUPPRESS_SUCCESS_BASE: 0.5,       // 镇压基础成功率
  
  // 叛乱政府属性
  REBEL_NATION_BASE_WEALTH: 300,
  REBEL_NATION_BASE_AGGRESSION: 0.7,
};

/**
 * 获取阶层中文名称
 */
function getStratumName(stratumKey) {
  return STRATA[stratumKey]?.name || stratumKey;
}

/**
 * 检查某个阶层是否有军队（军人、骑士等）
 */
function isStratumMilitary(stratumKey) {
  return ['soldier', 'knight'].includes(stratumKey);
}

/**
 * 创建叛乱思潮事件
 * @param {string} stratumKey - 阶层键
 * @param {Object} rebellionState - 叛乱状态
 * @param {boolean} hasMilitary - 玩家是否有军队
 * @param {boolean} isMilitaryRebelling - 军队自身是否在叛乱
 * @param {Function} callback - 回调函数
 */
export function createBrewingEvent(stratumKey, rebellionState, hasMilitary, isMilitaryRebelling, callback) {
  const stratumName = getStratumName(stratumKey);
  const options = [];
  
  // 如果有军队且军队不是叛乱者，可以调查
  if (hasMilitary && !isMilitaryRebelling) {
    options.push({
      id: 'investigate',
      text: '派遣军队调查',
      description: `派军队深入调查${stratumName}的动向，可能发现更多线索`,
      effects: {},
      callback: () => callback('investigate', stratumKey),
    });
  }
  
  options.push({
    id: 'appease',
    text: '尝试安抚',
    description: `向${stratumName}示好，暂时缓解紧张关系`,
    effects: {
      classApproval: { [stratumKey]: 10 },
    },
    callback: () => callback('appease', stratumKey),
  });
  
  options.push({
    id: 'ignore',
    text: '暂时观望',
    description: '不采取行动，继续观察局势发展',
    effects: {},
    callback: () => callback('ignore', stratumKey),
  });
  
  return {
    id: `rebellion_brewing_${stratumKey}_${Date.now()}`,
    name: `${stratumName}阶层出现叛乱思潮`,
    icon: 'AlertTriangle',
    image: null,
    description: `密探来报：${stratumName}阶层近来对朝廷极为不满，私下议论纷纷，有人甚至暗示应该"换个统治者"。这种危险的思潮正在蔓延，如果不加以控制，可能会演变成更严重的问题。\n\n当前该阶层的不满已持续${rebellionState.dissatisfactionDays}天，影响力占比${(rebellionState.influenceShare * 100).toFixed(1)}%。`,
    isRebellionEvent: true,
    rebellionPhase: REBELLION_PHASE.BREWING,
    rebellionStratum: stratumKey,
    options,
  };
}

/**
 * 创建密谋叛乱事件
 */
export function createPlottingEvent(stratumKey, rebellionState, hasMilitary, isMilitaryRebelling, callback) {
  const stratumName = getStratumName(stratumKey);
  const options = [];
  
  // 如果有军队且军队不是叛乱者，可以尝试拘捕
  if (hasMilitary && !isMilitaryRebelling) {
    options.push({
      id: 'arrest',
      text: '派军队拘捕首领',
      description: `派军队突袭并拘捕叛乱首领，有一定成功率`,
      effects: {},
      callback: () => callback('arrest', stratumKey),
    });
  }
  
  options.push({
    id: 'negotiate',
    text: '派人谈判',
    description: `尝试与叛乱者谈判，承诺改善待遇`,
    effects: {
      classApproval: { [stratumKey]: 15 },
      resources: { silver: -100 },
    },
    callback: () => callback('negotiate', stratumKey),
  });
  
  options.push({
    id: 'bribe',
    text: '收买内奸',
    description: '花费银币收买叛乱组织中的内奸，削弱其力量',
    effects: {
      resources: { silver: -200 },
    },
    callback: () => callback('bribe', stratumKey),
  });
  
  options.push({
    id: 'ignore',
    text: '静观其变',
    description: '不采取行动，但叛乱可能很快爆发',
    effects: {},
    callback: () => callback('ignore', stratumKey),
  });
  
  return {
    id: `rebellion_plotting_${stratumKey}_${Date.now()}`,
    name: `${stratumName}阶层密谋叛乱！`,
    icon: 'Flame',
    image: null,
    description: `密探紧急来报：${stratumName}阶层的不满者已经组织起来，正在秘密策划一场叛乱！他们已经推选出领袖，正在联络同党、囤积武器。如果不尽快阻止，叛乱将一触即发！\n\n他们控制着国家${(rebellionState.influenceShare * 100).toFixed(1)}%的影响力，一旦叛乱将造成严重后果。`,
    isRebellionEvent: true,
    rebellionPhase: REBELLION_PHASE.PLOTTING,
    rebellionStratum: stratumKey,
    options,
  };
}

/**
 * 创建正在叛乱事件
 */
export function createActiveRebellionEvent(stratumKey, rebellionState, hasMilitary, isMilitaryRebelling, rebelNation, callback) {
  const stratumName = getStratumName(stratumKey);
  const options = [];
  
  // 如果有军队且军队不是叛乱者，可以镇压
  if (hasMilitary && !isMilitaryRebelling) {
    options.push({
      id: 'suppress',
      text: '调动军队镇压',
      description: `出动忠诚的军队镇压叛乱，可能成功也可能失败`,
      effects: {},
      callback: () => callback('suppress', stratumKey),
    });
  }
  
  options.push({
    id: 'accept_war',
    text: '应战',
    description: `承认叛军为敌对势力，进入全面战争状态`,
    effects: {},
    callback: () => callback('accept_war', stratumKey, rebelNation),
  });
  
  return {
    id: `rebellion_active_${stratumKey}_${Date.now()}`,
    name: `${stratumName}阶层发动叛乱！`,
    icon: 'Skull',
    image: null,
    description: `最坏的情况发生了！${stratumName}阶层已经公开举起反旗，宣布成立"${rebelNation.name}"，不再服从你的统治！\n\n叛军已经控制了相当一部分领土和资源，你的${stratumName}人口已经加入叛军阵营。这是一场生死存亡的较量，你必须做出抉择！\n\n叛军实力：约${rebelNation.population}人\n叛军财富：${rebelNation.wealth}银币`,
    isRebellionEvent: true,
    rebellionPhase: REBELLION_PHASE.ACTIVE,
    rebellionStratum: stratumKey,
    options,
  };
}

/**
 * 创建调查结果事件
 */
export function createInvestigationResultEvent(stratumKey, success, discoveredInfo, callback) {
  const stratumName = getStratumName(stratumKey);
  
  if (success) {
    return {
      id: `rebellion_investigation_success_${stratumKey}_${Date.now()}`,
      name: `调查成功`,
      icon: 'Search',
      description: `军队的调查取得了成果！我们发现${stratumName}中确实有人在暗中煽动不满情绪。${discoveredInfo || '目前他们还只是在散布言论，尚未形成有组织的力量。'}\n\n叛乱思潮已被暂时压制，但如果不改善该阶层的处境，问题可能卷土重来。`,
      isRebellionEvent: true,
      options: [{
        id: 'ok',
        text: '知道了',
        effects: {},
        callback: () => callback('investigation_success', stratumKey),
      }],
    };
  } else {
    return {
      id: `rebellion_investigation_fail_${stratumKey}_${Date.now()}`,
      name: `调查无果`,
      icon: 'XCircle',
      description: `军队的调查没有发现任何实质性证据。可能是叛乱者隐藏得很好，也可能是情报有误。但${stratumName}阶层的不满情绪依然存在，需要继续关注。`,
      isRebellionEvent: true,
      options: [{
        id: 'ok',
        text: '继续观察',
        effects: {},
        callback: () => callback('investigation_fail', stratumKey),
      }],
    };
  }
}

/**
 * 创建拘捕结果事件
 */
export function createArrestResultEvent(stratumKey, success, callback) {
  const stratumName = getStratumName(stratumKey);
  
  if (success) {
    return {
      id: `rebellion_arrest_success_${stratumKey}_${Date.now()}`,
      name: `拘捕成功`,
      icon: 'Shield',
      description: `军队成功突袭了叛乱者的秘密据点，抓获了叛乱首领和核心成员！没有了领袖的组织很快就土崩瓦解，叛乱阴谋被扼杀在摇篮中。\n\n${stratumName}阶层中的激进分子受到震慑，短期内不敢轻举妄动。但要彻底解决问题，还需要改善他们的生活条件。`,
      isRebellionEvent: true,
      options: [{
        id: 'execute',
        text: '公开处决首领',
        description: '杀一儆百，但可能激化矛盾',
        effects: {
          stability: 5,
          classApproval: { [stratumKey]: -15 },
        },
        callback: () => callback('arrest_execute', stratumKey),
      }, {
        id: 'imprison',
        text: '秘密关押',
        description: '低调处理，减少影响',
        effects: {},
        callback: () => callback('arrest_imprison', stratumKey),
      }, {
        id: 'exile',
        text: '流放边疆',
        description: '眼不见心不烦',
        effects: {
          classApproval: { [stratumKey]: -5 },
        },
        callback: () => callback('arrest_exile', stratumKey),
      }],
    };
  } else {
    return {
      id: `rebellion_arrest_fail_${stratumKey}_${Date.now()}`,
      name: `拘捕失败`,
      icon: 'AlertTriangle',
      description: `拘捕行动失败了！叛乱首领提前得到消息逃脱了，我们的军队还折损了一些人手。这次失败的行动反而让叛乱者更加警觉，他们的行动可能会加速。`,
      isRebellionEvent: true,
      options: [{
        id: 'ok',
        text: '该死！',
        effects: {},
        callback: () => callback('arrest_fail', stratumKey),
      }],
    };
  }
}

/**
 * 创建镇压结果事件
 */
export function createSuppressionResultEvent(stratumKey, success, playerLosses, rebelLosses, callback) {
  const stratumName = getStratumName(stratumKey);
  
  if (success) {
    return {
      id: `rebellion_suppress_success_${stratumKey}_${Date.now()}`,
      name: `镇压成功`,
      icon: 'Trophy',
      description: `经过激烈的战斗，忠诚的军队成功镇压了${stratumName}叛乱！叛军被击溃，残余势力四散奔逃。\n\n我军损失：${playerLosses}人\n叛军损失：${rebelLosses}人\n\n战后，被叛军裹挟的平民大多回归了正常生活。但这场叛乱提醒你，民心不可失。`,
      isRebellionEvent: true,
      options: [{
        id: 'mercy',
        text: '宽大处理残余',
        description: '彰显仁德，有助于收拢人心',
        effects: {
          classApproval: { [stratumKey]: 10 },
        },
        callback: () => callback('suppress_mercy', stratumKey),
      }, {
        id: 'strict',
        text: '严厉追究',
        description: '秋后算账，杀一儆百',
        effects: {
          stability: 10,
          classApproval: { [stratumKey]: -20 },
        },
        callback: () => callback('suppress_strict', stratumKey),
      }],
    };
  } else {
    return {
      id: `rebellion_suppress_fail_${stratumKey}_${Date.now()}`,
      name: `镇压失败`,
      icon: 'Skull',
      description: `镇压行动遭遇了挫折！叛军比预想的更加顽强，我军在战斗中损失惨重，被迫撤退。\n\n我军损失：${playerLosses}人\n叛军损失：${rebelLosses}人\n\n叛军士气大振，控制了更多地区。你必须尽快做出应对！`,
      isRebellionEvent: true,
      options: [{
        id: 'ok',
        text: '继续战斗',
        effects: {},
        callback: () => callback('suppress_fail', stratumKey),
      }],
    };
  }
}

/**
 * 创建叛乱政府国家对象
 */
export function createRebelNation(stratumKey, stratumPop, stratumWealth, stratumInfluence) {
  const stratumName = getStratumName(stratumKey);
  const rebelId = `rebel_${stratumKey}_${Date.now()}`;
  
  // 叛军实力基于该阶层的人口、财富和影响力
  const population = Math.max(10, Math.floor(stratumPop * 0.8)); // 80%的阶层人口加入叛军
  const wealth = Math.max(REBELLION_CONFIG.REBEL_NATION_BASE_WEALTH, Math.floor(stratumWealth * 0.5));
  
  return {
    id: rebelId,
    name: `${stratumName}叛乱政府`,
    desc: `由不满的${stratumName}阶层组建的叛乱政府`,
    // 外观设置
    color: '#8B0000', // 深红色
    icon: 'Flame',
    // 属性
    wealth,
    population,
    aggression: REBELLION_CONFIG.REBEL_NATION_BASE_AGGRESSION,
    relation: 0, // 与玩家关系为0
    isAtWar: true, // 直接进入战争状态
    warScore: 0,
    militaryStrength: Math.min(1.5, 0.5 + stratumInfluence * 2), // 军事实力受影响力影响
    // 标记
    isRebelNation: true,
    rebellionStratum: stratumKey,
    visible: true,
    // 经济特征
    economyTraits: {
      resourceBias: {},
      baseWealth: wealth,
      basePopulation: population,
    },
    foreignPower: {
      baseRating: 0.5,
      volatility: 0.5,
      appearEpoch: 0,
      populationFactor: 1,
      wealthFactor: 1,
    },
    inventory: {},
    budget: Math.floor(wealth * 0.3),
    enemyLosses: 0,
    warDuration: 0,
    warStartDay: null,
    foreignWars: {},
  };
}

/**
 * 创建叛乱结束（停战后清理）事件
 */
export function createRebellionEndEvent(rebelNation, victory, callback) {
  const isPlayerVictory = victory;
  
  if (isPlayerVictory) {
    return {
      id: `rebellion_end_victory_${Date.now()}`,
      name: `叛乱平定`,
      icon: 'Trophy',
      description: `经过艰苦的战斗，${rebelNation.name}终于被彻底击败！叛军残余或被消灭，或已投降。国家重归统一，但战争的创伤需要时间来愈合。\n\n被叛军占领的人口将逐渐回归，但他们可能需要一段时间才能恢复对朝廷的信任。`,
      isRebellionEvent: true,
      options: [{
        id: 'celebrate',
        text: '庆祝胜利',
        description: '举行盛大庆典，提振民心',
        effects: {
          stability: 15,
          resources: { culture: 50 },
        },
        callback: () => callback('end_celebrate', rebelNation),
      }, {
        id: 'rebuild',
        text: '着手重建',
        description: '低调处理，专注于恢复生产',
        effects: {
          stability: 5,
        },
        callback: () => callback('end_rebuild', rebelNation),
      }],
    };
  } else {
    return {
      id: `rebellion_end_defeat_${Date.now()}`,
      name: `屈辱的和平`,
      icon: 'Frown',
      description: `你被迫与${rebelNation.name}议和。虽然叛乱势力同意解散，但你的权威已经受到严重损害。其他阶层可能会认为反抗是有效的...`,
      isRebellionEvent: true,
      options: [{
        id: 'accept',
        text: '忍辱接受',
        effects: {
          stability: -20,
        },
        callback: () => callback('end_defeat', rebelNation),
      }],
    };
  }
}

export default {
  REBELLION_PHASE,
  REBELLION_CONFIG,
  createBrewingEvent,
  createPlottingEvent,
  createActiveRebellionEvent,
  createInvestigationResultEvent,
  createArrestResultEvent,
  createSuppressionResultEvent,
  createRebelNation,
  createRebellionEndEvent,
};
