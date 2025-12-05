// Diplomatic Events - Functions to create dynamic diplomatic events
// These events are generated dynamically based on game state

// 分期赔款总额相对一次性赔款的倍率（保证总额更高）
const INSTALLMENT_TOTAL_MULTIPLIER = 3;

// 开放市场持续时间（天数）
const OPEN_MARKET_DURATION_YEARS = 3; // 3年
const OPEN_MARKET_DURATION_DAYS = OPEN_MARKET_DURATION_YEARS * 365; // 1095天

/**
 * 创建外交事件 - 敌国宣战
 * @param {Object} nation - 宣战的国家
 * @param {Function} onAccept - 确认的回调
 * @returns {Object} - 外交事件对象
 */
export function createWarDeclarationEvent(nation, onAccept) {
  return {
    id: `war_declaration_${nation.id}_${Date.now()}`,
    name: `${nation.name}宣战`,
    icon: 'Swords',
    image: null,
    description: `${nation.name}对你的国家发动了战争！他们的军队正在集结，边境局势十分紧张。这是一场不可避免的冲突，你必须做好应战准备。`,
    isDiplomaticEvent: true,
    options: [
      {
        id: 'acknowledge',
        text: '应战',
        description: '接受战争状态，准备迎战',
        effects: {},
        callback: onAccept,
      },
    ],
  };
}

/**
 * 创建外交事件 - 敌国送礼
 * @param {Object} nation - 送礼的国家
 * @param {number} giftAmount - 礼物金额
 * @param {Function} onAccept - 接受礼物的回调
 * @returns {Object} - 外交事件对象
 */
export function createGiftEvent(nation, giftAmount, onAccept) {
  return {
    id: `gift_${nation.id}_${Date.now()}`,
    name: `${nation.name}的礼物`,
    icon: 'Gift',
    image: null,
    description: `${nation.name}派遣使节前来，带来了价值${giftAmount}银币的珍贵礼物。这是他们表达善意和改善关系的诚意之举。`,
    isDiplomaticEvent: true,
    options: [
      {
        id: 'accept',
        text: '接受礼物',
        description: `收下礼物，获得${giftAmount}银币`,
        effects: {
          resources: {
            silver: giftAmount,
          },
        },
        callback: onAccept,
      },
    ],
  };
}

/**
 * 创建外交事件 - 敌国请求和平（根据战争分数提供不同选项）
 * @param {Object} nation - 请求和平的国家
 * @param {number} tribute - 基础赔款金额
 * @param {number} warScore - 战争分数
 * @param {Function} callback - 回调函数，接收accepted参数
 * @returns {Object} - 外交事件对象
 */
export function createEnemyPeaceRequestEvent(nation, tribute, warScore, callback) {
  const options = [];
  
  // 根据战争分数提供不同的和平选项
  if (warScore > 20) {
    // 大胜：可以要求更多赔款或领土
    const highTribute = Math.floor(tribute * 1.5);
    const highInstallmentTotal = Math.ceil(highTribute * INSTALLMENT_TOTAL_MULTIPLIER);
    const installmentAmount = Math.ceil(highInstallmentTotal / 365); // 每天支付
    // 使用财富估算人口（假设每100财富对应约50人口）
    const estimatedPopulation = Math.floor((nation.wealth || 800) / 100 * 50);
    const populationDemand = Math.max(6, Math.floor(estimatedPopulation * 0.04)); // 要求4%人口，至少4人
    
    options.push({
      id: 'demand_more',
      text: '要求更多赔款',
      description: `要求${highTribute}银币赔款（比原提议多50%）`,
      effects: {
        resources: {
          silver: highTribute,
        },
      },
      callback: () => callback(true, 'demand_more', highTribute),
    });
    options.push({
      id: 'demand_installment',
      text: '要求分期支付',
      description: `要求每天支付${installmentAmount}银币，持续一年（共${installmentAmount * 365}银币）`,
      effects: {},
      callback: () => callback(true, 'installment', installmentAmount),
    });
    options.push({
      id: 'demand_population',
      text: '要求割地',
      description: `要求割让人口上限 ${populationDemand}（附带等量人口）`,
      effects: {},
      callback: () => callback(true, 'population', populationDemand),
    });
    options.push({
      id: 'accept_standard',
      text: '接受标准和平',
      description: `接受${tribute}银币赔款，快速结束战争`,
      effects: {
        resources: {
          silver: tribute,
        },
      },
      callback: () => callback(true, 'standard', tribute),
    });
  } else if (warScore > 10) {
    // 小胜：标准和平条款 + 分期支付选项
    const installmentTotal = Math.ceil(tribute * INSTALLMENT_TOTAL_MULTIPLIER);
    const installmentAmount = Math.ceil(installmentTotal / 365); // 每天支付
    // 使用财富估算人口（假设每100财富对应约50人口）
    const estimatedPopulation = Math.floor((nation.wealth || 800) / 100 * 50);
    const populationDemand = Math.max(4, Math.floor(estimatedPopulation * 0.02)); // 要求2%人口，至少2人
    
    options.push({
      id: 'accept',
      text: '接受和平',
      description: `结束战争，获得${tribute}银币赔款`,
      effects: {
        resources: {
          silver: tribute,
        },
      },
      callback: () => callback(true, 'standard', tribute),
    });
    options.push({
      id: 'demand_installment',
      text: '要求分期支付',
      description: `要求每天支付${installmentAmount}银币，持续一年（共${installmentAmount * 365}银币）`,
      effects: {},
      callback: () => callback(true, 'installment', installmentAmount),
    });
    options.push({
      id: 'demand_population',
      text: '要求割地',
      description: `要求割让人口上限 ${populationDemand}（附带等量人口）`,
      effects: {},
      callback: () => callback(true, 'population', populationDemand),
    });
    options.push({
      id: 'demand_open_market',
      text: '要求开放市场',
      description: `要求${nation.name}在${OPEN_MARKET_DURATION_YEARS}年内开放市场，不限制我方贸易路线数量`,
      effects: {},
      callback: () => callback(true, 'open_market', OPEN_MARKET_DURATION_DAYS),
    });
  } else {
    // 僵持：可以接受或继续战争
    options.push({
      id: 'accept',
      text: '接受和平',
      description: `结束战争，获得${tribute}银币赔款`,
      effects: {
        resources: {
          silver: tribute,
        },
      },
      callback: () => callback(true, 'standard', tribute),
    });
  }
  
  // 总是可以拒绝和平
  options.push({
    id: 'reject',
    text: '拒绝和平',
    description: '继续战争，追求更大的胜利',
    effects: {},
    callback: () => callback(false),
  });
  
  // 根据战争分数生成不同的描述
  let description = '';
  if (warScore > 20) {
    description = `${nation.name}在战争中遭受惨重损失，他们派遣使节前来恳求和平。作为和平的代价，他们愿意支付${tribute}银币的赔款。鉴于你的巨大优势，你可以要求更多。`;
  } else if (warScore > 10) {
    description = `${nation.name}在战争中处于劣势，他们派遣使节前来请求和平。作为和平的代价，他们愿意支付${tribute}银币的赔款。`;
  } else {
    description = `${nation.name}派遣使节前来请求和平。虽然战局尚未明朗，但他们愿意支付${tribute}银币作为和平的诚意。`;
  }
  
  return {
    id: `enemy_peace_request_${nation.id}_${Date.now()}`,
    name: `${nation.name}请求和平`,
    icon: 'HandHeart',
    image: null,
    description,
    isDiplomaticEvent: true,
    options,
  };
}

/**
 * 创建外交事件 - 玩家提出和平（根据战争分数提供不同选项）
 * @param {Object} nation - 目标国家
 * @param {number} warScore - 战争分数（正数表示玩家优势，负数表示劣势）
 * @param {number} warDuration - 战争持续时间
 * @param {number} enemyLosses - 敌方损失
 * @param {Function} callback - 回调函数
 * @returns {Object} - 外交事件对象
 */
export function createPlayerPeaceProposalEvent(
  nation,
  warScore,
  warDuration,
  enemyLosses,
  playerState = {},
  callback
) {
  const options = [];
  const playerPopulationBase = Math.max(
    200,
    playerState.population || playerState.maxPopulation || 1000
  );
  const calculateTerritoryOffer = (maxPercent, severityDivisor) => {
    const warPressure = Math.abs(Math.min(warScore, 0)) / severityDivisor;
    const durationPressure = Math.max(0, warDuration || 0) / 4000;
    const severity = Math.min(maxPercent, Math.max(0.012, warPressure + durationPressure));
    const capped = Math.floor(playerPopulationBase * severity);
    const hardCap = Math.floor(playerPopulationBase * maxPercent);
    return Math.max(3, Math.min(hardCap, capped));
  };
  
  if (warScore > 15) {
    // 大胜：可以要求赔款
    const highTribute = Math.min(nation.wealth || 0, Math.ceil(warScore * 50 + enemyLosses * 3));
    const standardTribute = Math.min(nation.wealth || 0, Math.ceil(warScore * 40 + enemyLosses * 2));
    const highInstallmentTotal = Math.ceil(highTribute * INSTALLMENT_TOTAL_MULTIPLIER);
    const installmentAmount = Math.ceil(highInstallmentTotal / 365);
    const estimatedPopulation = Math.floor((nation.wealth || 800) / 100 * 50);
    const populationDemand = Math.max(5, Math.floor(estimatedPopulation * 0.03)); // 或 0.03
    
    options.push({
      id: 'demand_high',
      text: '要求高额赔款',
      description: `要求${highTribute}银币赔款（可能被拒绝）`,
      effects: {},
      callback: () => callback('demand_high', highTribute),
    });
    options.push({
      id: 'demand_installment',
      text: '要求分期支付',
      description: `要求每天支付${installmentAmount}银币，持续一年（共${installmentAmount * 365}银币）`,
      effects: {},
      callback: () => callback('demand_installment', installmentAmount),
    });
    options.push({
      id: 'demand_population',
      text: '要求割地',
      description: `要求割让人口上限 ${populationDemand}（附带等量人口）`,
      effects: {},
      callback: () => callback('demand_population', populationDemand),
    });
    options.push({
      id: 'demand_open_market',
      text: '要求开放市场',
      description: `要求${nation.name}在${OPEN_MARKET_DURATION_YEARS}年内开放市场，不限制我方贸易路线数量`,
      effects: {},
      callback: () => callback('demand_open_market', OPEN_MARKET_DURATION_DAYS),
    });
    options.push({
      id: 'demand_standard',
      text: '要求标准赔款',
      description: `要求${standardTribute}银币赔款（较易接受）`,
      effects: {},
      callback: () => callback('demand_standard', standardTribute),
    });
    options.push({
      id: 'peace_only',
      text: '无条件和平',
      description: '不要求赔款，直接结束战争',
      effects: {},
      callback: () => callback('peace_only', 0),
    });
  } else if (warScore > 0) {
    // 小胜：可以要求少量赔款或无条件和平
    const tribute = Math.min(nation.wealth || 0, Math.ceil(warScore * 40 + enemyLosses * 2));
    const installmentTotal = Math.ceil(tribute * INSTALLMENT_TOTAL_MULTIPLIER);
    const installmentAmount = Math.ceil(installmentTotal / 365);
    const estimatedPopulation = Math.floor((nation.wealth || 800) / 100 * 50);
    const populationDemand = Math.max(5, Math.floor(estimatedPopulation * 0.01)); // 或 0.03
    
    options.push({
      id: 'demand_tribute',
      text: '要求赔款',
      description: `要求${tribute}银币赔款`,
      effects: {},
      callback: () => callback('demand_tribute', tribute),
    });
    options.push({
      id: 'demand_installment',
      text: '要求分期支付',
      description: `要求每天支付${installmentAmount}银币，持续一年（共${installmentAmount * 365}银币）`,
      effects: {},
      callback: () => callback('demand_installment', installmentAmount),
    });
    options.push({
      id: 'demand_population',
      text: '要求割地',
      description: `要求割让人口上限 ${populationDemand}（附带等量人口）`,
      effects: {},
      callback: () => callback('demand_population', populationDemand),
    });
    // 只有在大胜时才可要求开放市场
    options.push({
      id: 'peace_only',
      text: '无条件和平',
      description: '不要求赔款，直接结束战争',
      effects: {},
      callback: () => callback('peace_only', 0),
    });
  } else if (warScore < -10) {
    // Major defeat: player must offer substantial reparations
    const payment = Math.max(150, Math.ceil(Math.abs(warScore) * 35 + warDuration * 6));
    const highInstallmentTotal = Math.ceil(payment * INSTALLMENT_TOTAL_MULTIPLIER);
    const installmentAmount = Math.ceil(highInstallmentTotal / 365);
    const populationOffer = calculateTerritoryOffer(0.05, 320);
    
    options.push({
      id: 'pay_high',
      text: `支付${payment}银币求和`,
      description: '支付高额赔款以结束战争',
      effects: {},
      callback: () => callback('pay_high', payment),
    });
    options.push({
      id: 'pay_installment',
      text: `分期支付赔款`,
      description: `每天支付${installmentAmount}银币，持续一年（共${installmentAmount * 365}银币）`,
      effects: {},
      callback: () => callback('pay_installment', installmentAmount),
    });
    options.push({
      id: 'offer_population',
      text: `割让人口上限 ${populationOffer}`,
      description: '割让领土（减少人口上限和人口）以结束战争',
      effects: {},
      callback: () => callback('offer_population', populationOffer),
    });
  } else if (warScore < 0) {
    // 小败：需要支付赔款
    const payment = Math.max(100, Math.ceil(Math.abs(warScore) * 30 + warDuration * 5));
    const installmentTotal = Math.ceil(payment * INSTALLMENT_TOTAL_MULTIPLIER);
    const installmentAmount = Math.ceil(installmentTotal / 365);
    const populationOffer = calculateTerritoryOffer(0.03, 480);
    
    options.push({
      id: 'pay_standard',
      text: `支付${payment}银币求和`,
      description: '支付赔款以结束战争',
      effects: {},
      callback: () => callback('pay_standard', payment),
    });
    options.push({
      id: 'pay_installment',
      text: `分期支付赔款`,
      description: `每天支付${installmentAmount}银币，持续一年（共${installmentAmount * 365}银币）`,
      effects: {},
      callback: () => callback('pay_installment', installmentAmount),
    });
    options.push({
      id: 'offer_population',
      text: `割让人口上限 ${populationOffer}`,
      description: '割让领土（减少人口上限和人口）以结束战争',
      effects: {},
      callback: () => callback('offer_population', populationOffer),
    });
  } else {
    // 僵持：无条件和平
    options.push({
      id: 'peace_only',
      text: '提议和平',
      description: '提议无条件停战',
      effects: {},
      callback: () => callback('peace_only', 0),
    });
  }
  
  // 总是可以取消
  options.push({
    id: 'cancel',
    text: '取消',
    description: '放弃和平谈判',
    effects: {},
    callback: () => callback('cancel', 0),
  });
  
  // 根据战争分数生成描述
  let description = '';
  if (warScore > 15) {
    description = `你在与${nation.name}的战争中占据压倒性优势。现在是提出和平条款的好时机，你可以要求丰厚的赔款。`;
  } else if (warScore > 0) {
    description = `你在与${nation.name}的战争中略占上风。你可以提出和平，并要求一定的赔款作为补偿。`;
  } else if (warScore < -10) {
    description = `你在与${nation.name}的战争中处于极大劣势。如果想要和平，可能需要支付高额赔款。`;
  } else if (warScore < 0) {
    description = `你在与${nation.name}的战争中处于劣势。如果想要和平，需要支付一定的赔款。`;
  } else {
    description = `你与${nation.name}的战争陷入僵持。双方都没有明显优势，可以提议无条件停战。`;
  }
  
  return {
    id: `player_peace_proposal_${nation.id}_${Date.now()}`,
    name: `向${nation.name}提出和平`,
    icon: 'HandHeart',
    image: null,
    description,
    isDiplomaticEvent: true,
    options,
  };
}

// 保留旧函数名以兼容
export function createPeaceRequestEvent(nation, tribute, onAccept) {
  return createEnemyPeaceRequestEvent(nation, tribute, 0, (accepted) => {
    if (accepted) onAccept();
  });
}

/**
 * 创建外交事件 - 敌国发起战斗
 * @param {Object} nation - 发起战斗的国家
 * @param {Object} battleResult - 战斗结果
 * @param {Function} onAcknowledge - 确认的回调
 * @returns {Object} - 外交事件对象
 */
export function createBattleEvent(nation, battleResult, onAcknowledge) {
  const isVictory = battleResult.victory;
  const isRaid = battleResult.foodLoss !== undefined || battleResult.silverLoss !== undefined;
  
  let description = '';
  if (isRaid) {
    // 突袭事件
    description = `${nation.name}趁你不备发动了突袭！他们掠夺了你的资源并造成了人员伤亡。`;
    description += `\n\n突袭损失：`;
    if (battleResult.foodLoss) description += `\n粮食：${battleResult.foodLoss}`;
    if (battleResult.silverLoss) description += `\n银币：${battleResult.silverLoss}`;
    if (battleResult.playerLosses) description += `\n人口：${battleResult.playerLosses}`;
  } else {
    // 正常战斗
    description = isVictory
      ? `${nation.name}的军队向你发起了进攻，但在你的英勇抵抗下被击退了！敌军损失惨重，士气低落。`
      : `${nation.name}的军队向你发起了猛烈进攻！你的军队遭受了重大损失，局势十分危急。`;
    
    description += `\n\n战斗结果：\n我方损失：${battleResult.playerLosses || 0}人\n敌方损失：${battleResult.enemyLosses || 0}人`;
  }
  
  return {
    id: `battle_${nation.id}_${Date.now()}`,
    name: isRaid ? `${nation.name}的突袭` : `${nation.name}的进攻`,
    icon: isVictory ? 'Shield' : 'AlertTriangle',
    image: null,
    description,
    isDiplomaticEvent: true,
    options: [
      {
        id: 'acknowledge',
        text: '了解',
        description: '查看详情',
        effects: {},
        callback: onAcknowledge,
      },
    ],
  };
}
