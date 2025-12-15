// Diplomatic Events - Functions to create dynamic diplomatic events
// These events are generated dynamically based on game state

import { calculatePeacePayment, calculateInstallmentPlan, calculateAllyMaintenanceCost, INSTALLMENT_CONFIG } from '../../utils/diplomaticUtils';

// 割地人口上限（战争求和时最多割让/获得的人口数）
const MAX_TERRITORY_POPULATION = 2000;

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
                description: '接受战争状态，动员全国进入战时体制（稳定度-5）',
                effects: {
                    stability: -5,
                },
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
    if (warScore > 450) {
        // 压倒性胜利：可以直接吞并敌国
        const highTribute = Math.floor(tribute * 2);
        const highInstallmentTotal = Math.ceil(highTribute * INSTALLMENT_CONFIG.TOTAL_MULTIPLIER);
        const installmentAmount = Math.ceil(highInstallmentTotal / INSTALLMENT_CONFIG.DURATION_DAYS);
        const estimatedPopulation = nation.population || 1000;
        const populationDemand = Math.min(MAX_TERRITORY_POPULATION, Math.max(10, Math.floor(estimatedPopulation * 0.08)));
        const annexPopulation = nation.population || 1000;

        options.push({
            id: 'annex',
            text: '🏴 吞并敌国',
            description: `彻底征服${nation.name}，获得其全部人口（${Math.round(annexPopulation)}人）和人口上限`,
            effects: {},
            callback: () => callback(true, 'annex', annexPopulation),
        });
        options.push({
            id: 'demand_more',
            text: '要求高额赔款',
            description: `要求${highTribute}银币赔款（比原提议多100%）`,
            effects: {
                resources: {
                    silver: highTribute,
                },
            },
            callback: () => callback(true, 'demand_more', highTribute),
        });
        options.push({
            id: 'demand_population',
            text: '要求大量割地',
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
    } else if (warScore > 200) {
        // 大胜：可以要求更多赔款或领土
        const highTribute = Math.floor(tribute * 1.5);
        const highInstallmentTotal = Math.ceil(highTribute * INSTALLMENT_CONFIG.TOTAL_MULTIPLIER);
        const installmentAmount = Math.ceil(highInstallmentTotal / 365);
        const estimatedPopulation = nation.population || 1000;
        const populationDemand = Math.min(MAX_TERRITORY_POPULATION, Math.max(6, Math.floor(estimatedPopulation * 0.04)));

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
            id: 'demand_open_market',
            text: '要求开放市场',
            description: `要求${nation.name}在${OPEN_MARKET_DURATION_YEARS}年内开放市场，不限制我方贸易路线数量`,
            effects: {},
            callback: () => callback(true, 'open_market', OPEN_MARKET_DURATION_DAYS),
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
    } else if (warScore > 50) {
        // 小胜：标准和平条款 + 分期支付选项
        const installmentTotal = Math.ceil(tribute * INSTALLMENT_CONFIG.TOTAL_MULTIPLIER);
        const installmentAmount = Math.ceil(installmentTotal / 365); // 每天支付
        // 使用财富估算人口（假设每100财富对应约50人口）
        const estimatedPopulation = nation.population;
        const populationDemand = Math.min(MAX_TERRITORY_POPULATION, Math.max(4, Math.floor(estimatedPopulation * 0.02))); // 要求2%人口，至少4人

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
    if (warScore > 450) {
        description = `${nation.name}在战争中被彻底击溃，他们的抵抗意志已经完全崩溃。使节团跪地恳求，愿意接受任何条件。你甚至可以选择直接吞并这个国家！`;
    } else if (warScore > 200) {
        description = `${nation.name}在战争中遭受惨重损失，他们派遣使节前来恳求和平。作为和平的代价，他们愿意支付${tribute}银币的赔款。鉴于你的巨大优势，你可以要求更多。`;
    } else if (warScore > 50) {
        description = `${nation.name}在战争中处于劣势，他们派遣使节前来请求和平。作为和平的代价，他们愿意支付${tribute}银币的赔款。`;
    } else {
        description = `${nation.name}派遣使节前来请求和平。虽然战局尚未明朗，但他们愿意支付${tribute}银币作为和平的诚意。`;
    }

    return {
        id: `enemy_peace_request_${nation.id}_${Date.now()}`,
        name: warScore > 450 ? `${nation.name}无条件投降` : `${nation.name}请求和平`,
        icon: warScore > 450 ? 'Flag' : 'HandHeart',
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
        return Math.min(MAX_TERRITORY_POPULATION, Math.max(3, Math.min(hardCap, capped))); // 最多割让人口
    };

    if (warScore > 350) {
        // 压倒性胜利：可以直接吞并敌国
        const highTribute = Math.min(nation.wealth || 0, Math.ceil(warScore * 60 + enemyLosses * 4));
        const estimatedPopulation = nation.population || 1000;
        const populationDemand = Math.min(MAX_TERRITORY_POPULATION, Math.max(10, Math.floor(estimatedPopulation * 0.08)));
        const annexPopulation = nation.population || 1000;

        options.push({
            id: 'demand_annex',
            text: '🏴 吞并敌国',
            description: `彻底征服${nation.name}，获得其全部人口（${Math.round(annexPopulation)}人）和人口上限`,
            effects: {},
            callback: () => callback('demand_annex', annexPopulation),
        });
        options.push({
            id: 'demand_high',
            text: '要求高额赔款',
            description: `要求${highTribute}银币赔款`,
            effects: {},
            callback: () => callback('demand_high', highTribute),
        });
        options.push({
            id: 'demand_population',
            text: '要求大量割地',
            description: `要求割让人口上限 ${populationDemand}（附带等量人口）`,
            effects: {},
            callback: () => callback('demand_population', populationDemand),
        });
        options.push({
            id: 'peace_only',
            text: '无条件和平',
            description: '不要求赔款，直接结束战争',
            effects: {},
            callback: () => callback('peace_only', 0),
        });
    } else if (warScore > 150) {
        // 大胜：可以要求赔款
        const highTribute = Math.min(nation.wealth || 0, Math.ceil(warScore * 50 + enemyLosses * 3));
        const standardTribute = Math.min(nation.wealth || 0, Math.ceil(warScore * 40 + enemyLosses * 2));
        const highInstallmentTotal = Math.ceil(highTribute * INSTALLMENT_CONFIG.TOTAL_MULTIPLIER);
        const installmentAmount = Math.ceil(highInstallmentTotal / 365);
        const estimatedPopulation = nation.population || 1000;
        const populationDemand = Math.min(MAX_TERRITORY_POPULATION, Math.max(5, Math.floor(estimatedPopulation * 0.03)));

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
    } else if (warScore > 50) {
        // 小胜：可以要求少量赔款或无条件和平
        const tribute = Math.min(nation.wealth || 0, Math.ceil(warScore * 40 + enemyLosses * 2));
        const installmentTotal = Math.ceil(tribute * INSTALLMENT_CONFIG.TOTAL_MULTIPLIER);
        const installmentAmount = Math.ceil(installmentTotal / 365);
        const estimatedPopulation = nation.population;
        const populationDemand = Math.min(MAX_TERRITORY_POPULATION, Math.max(5, Math.floor(estimatedPopulation * 0.01))); // 要求1%人口，至少5人

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
    } else if (warScore < -150) {
        // Major defeat: player must offer substantial reparations
        const payment = Math.max(150, Math.ceil(Math.abs(warScore) * 35 + warDuration * 6));
        const highInstallmentTotal = Math.ceil(payment * INSTALLMENT_CONFIG.TOTAL_MULTIPLIER);
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
    } else if (warScore < -50) {
        // 小败：需要支付赔款
        const payment = Math.max(100, Math.ceil(Math.abs(warScore) * 30 + warDuration * 5));
        const installmentTotal = Math.ceil(payment * INSTALLMENT_CONFIG.TOTAL_MULTIPLIER);
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
        // 僵持：无条件和平或赔款
        const payment = Math.max(50, Math.ceil(Math.abs(warScore) * 20 + warDuration * 3));
        const installmentTotal = Math.ceil(payment * INSTALLMENT_CONFIG.TOTAL_MULTIPLIER);
        const installmentAmount = Math.ceil(installmentTotal / 365);

        options.push({
            id: 'pay_moderate',
            text: `支付${payment}银币求和`,
            description: '支付赔款以结束战争，显示和平诚意',
            effects: {},
            callback: () => callback('pay_moderate', payment),
        });
        options.push({
            id: 'pay_installment_moderate',
            text: `分期支付赔款`,
            description: `每天支付${installmentAmount}银币，持续一年（共${installmentAmount * 365}银币）`,
            effects: {},
            callback: () => callback('pay_installment_moderate', installmentAmount),
        });
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
    if (warScore > 450) {
        description = `你在与${nation.name}的战争中取得了压倒性的胜利！敌人已经彻底崩溃，你可以选择直接吞并这个国家，将其纳入版图！`;
    } else if (warScore > 200) {
        description = `你在与${nation.name}的战争中占据压倒性优势。现在是提出和平条款的好时机，你可以要求丰厚的赔款。`;
    } else if (warScore > 50) {
        description = `你在与${nation.name}的战争中略占上风。你可以提出和平，并要求一定的赔款作为补偿。`;
    } else if (warScore < -200) {
        description = `你在与${nation.name}的战争中处于极大劣势。如果想要和平，可能需要支付高额赔款。`;
    } else if (warScore < -50) {
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

/**
 * 创建外交事件 - AI国家索要资源/银币
 * @param {Object} nation - 索要的国家
 * @param {string} resourceKey - 索要的资源类型 (silver, food, etc.)
 * @param {string} resourceName - 资源名称
 * @param {number} amount - 索要数量
 * @param {Function} callback - 回调 (accepted: boolean) => void
 */
export function createAIRequestEvent(nation, resourceKey, resourceName, amount, callback) {
    return {
        id: `ai_request_${nation.id}_${Date.now()}`,
        name: `${nation.name}的索求`,
        icon: 'HandCoins', // 使用HandCoins图标表示索要
        image: null,
        description: `${nation.name}派遣使节前来，表示他们目前急需${resourceName}。他们希望你能慷慨解囊，提供${amount}${resourceName}。如果拒绝，可能会影响两国关系。`,
        isDiplomaticEvent: true,
        options: [
            {
                id: 'accept',
                text: '同意给予',
                description: `失去${amount}${resourceName}，关系提升`,
                effects: {
                    resources: {
                        [resourceKey]: -amount,
                    },
                },
                callback: () => callback(true),
            },
            {
                id: 'reject',
                text: '拒绝索求',
                description: '保留资源，但关系会下降',
                effects: {},
                callback: () => callback(false),
            },
        ],
    };
}

/**
 * 创建外交事件 - AI国家请求结盟
 * @param {Object} nation - 请求结盟的国家
 * @param {Function} callback - 回调 (accepted: boolean) => void
 * @returns {Object} - 外交事件对象
 */
export function createAllianceRequestEvent(nation, callback) {
    return {
        id: `alliance_request_${nation.id}_${Date.now()}`,
        name: `${nation.name}的结盟邀请`,
        icon: 'Users',
        image: null,
        description: `${nation.name}派遣特使前来，表达了缔结同盟的意愿。他们希望与你建立军事同盟，互相保护，共同抵御外敌。\n\n结盟后：\n• 双方不可互相宣战\n• 一方被攻击时，另一方有义务参战\n• 可以建立更多贸易路线\n• 关系将保持稳定`,
        isDiplomaticEvent: true,
        options: [
            {
                id: 'accept',
                text: '接受结盟',
                description: '与该国建立正式同盟关系',
                effects: {},
                callback: () => callback(true),
            },
            {
                id: 'reject',
                text: '婉言谢绝',
                description: '拒绝结盟，关系会略微下降',
                effects: {},
                callback: () => callback(false),
            },
        ],
    };
}

/**
 * 创建外交事件 - 玩家请求结盟的结果
 * @param {Object} nation - 目标国家
 * @param {boolean} accepted - 是否接受
 * @param {Function} callback - 确认回调
 * @returns {Object} - 外交事件对象
 */
export function createAllianceProposalResultEvent(nation, accepted, callback) {
    if (accepted) {
        return {
            id: `alliance_accepted_${nation.id}_${Date.now()}`,
            name: `${nation.name}接受结盟`,
            icon: 'UserCheck',
            image: null,
            description: `${nation.name}接受了你的结盟请求！从今天起，你们正式成为盟友。双方将共同抵御外敌，互相支持。`,
            isDiplomaticEvent: true,
            options: [
                {
                    id: 'acknowledge',
                    text: '很好',
                    description: '确认同盟建立',
                    effects: {},
                    callback: callback,
                },
            ],
        };
    } else {
        return {
            id: `alliance_rejected_${nation.id}_${Date.now()}`,
            name: `${nation.name}拒绝结盟`,
            icon: 'UserX',
            image: null,
            description: `${nation.name}婉言拒绝了你的结盟请求。他们表示目前还不是建立同盟的好时机。继续改善关系，以后再试试吧。`,
            isDiplomaticEvent: true,
            options: [
                {
                    id: 'acknowledge',
                    text: '了解',
                    description: '确认',
                    effects: {},
                    callback: callback,
                },
            ],
        };
    }
}

/**
 * 创建外交事件 - 同盟解除通知
 * @param {Object} nation - 解除同盟的国家
 * @param {string} reason - 解除原因
 * @param {Function} callback - 确认回调
 * @returns {Object} - 外交事件对象
 */
export function createAllianceBreakEvent(nation, reason, callback) {
    const reasonTexts = {
        relation_low: '由于双方关系恶化',
        player_break: '你已主动解除同盟',
        ai_break: `${nation.name}决定解除同盟`,
        war_conflict: '由于战争冲突导致',
    };
    const reasonText = reasonTexts[reason] || reason;

    return {
        id: `alliance_break_${nation.id}_${Date.now()}`,
        name: `与${nation.name}的同盟解除`,
        icon: 'UserMinus',
        image: null,
        description: `${reasonText}，你与${nation.name}的同盟关系已经解除。你们不再有共同防御的义务，贸易路线限制也恢复正常。`,
        isDiplomaticEvent: true,
        options: [
            {
                id: 'acknowledge',
                text: '了解',
                description: '确认',
                effects: {},
                callback: callback,
            },
        ],
    };
}

/**
 * 创建外交事件 - 国家被吞并通知
 * @param {Object} nation - 被吞并的国家
 * @param {number} populationGained - 获得的人口
 * @param {number} maxPopGained - 获得的人口上限
 * @param {string} reason - 吞并原因 ('war_annex' 战争吞并, 'population_zero' 人口归零)
 * @param {Function} callback - 确认回调
 * @returns {Object} - 外交事件对象
 */
export function createNationAnnexedEvent(nation, populationGained, maxPopGained, reason, callback) {
    const isWarAnnex = reason === 'war_annex';

    let description = '';
    let title = '';

    if (isWarAnnex) {
        title = `🏴 ${nation.name}已被吞并`;
        description = `经过艰苦的战争，${nation.name}终于臣服于你的统治！他们的领土、人民和资源现在都归你所有。

🎉 吞并成果：
• 获得人口：${populationGained.toLocaleString()}人
• 获得人口上限：+${maxPopGained.toLocaleString()}

${nation.name}的旗帜已经降下，取而代之的是你的王旗。这是一次伟大的征服！`;
    } else {
        // 因人口归零而消亡
        title = `💀 ${nation.name}已经灭亡`;
        description = `${nation.name}在连年战争中损失惨重，人口凋零，国力衰竭。最终，这个曾经的国家彻底消亡了。

残存的人民（${populationGained.toLocaleString()}人）逃入你的领土，成为你的臣民。

• 获得人口：${populationGained.toLocaleString()}人
• 获得人口上限：+${maxPopGained.toLocaleString()}

历史将记住这个国家，但它的辉煌已成过去。`;
    }

    return {
        id: `nation_annexed_${nation.id}_${Date.now()}`,
        name: title,
        icon: isWarAnnex ? 'Crown' : 'Skull',
        image: null,
        description,
        isDiplomaticEvent: true,
        options: [
            {
                id: 'acknowledge',
                text: isWarAnnex ? '荣耀永存！' : '了解',
                description: isWarAnnex ? '庆祝这次伟大的征服' : '确认',
                effects: {},
                callback: callback,
            },
        ],
    };
}

/**
 * 创建外交事件 - 盟友关系冷淡
 * @param {Object} nation - 盟友国家
 * @param {number} currentRelation - 当前关系值
 * @param {Function} callback - 回调 (action: 'gift' | 'ignore', amount?: number) => void
 * @returns {Object} - 外交事件对象
 */
export function createAllyColdEvent(nation, currentRelation, callback) {
    // 使用动态成本计算：基于盟友财富的3%，范围80-300000
    const giftCost = calculateAllyMaintenanceCost(nation.wealth || 500, nation.wealth || 500);

    return {
        id: `ally_cold_${nation.id}_${Date.now()}`,
        name: `与${nation.name}的关系冷淡`,
        icon: 'HeartCrack',
        image: null,
        description: `你与盟友${nation.name}的关系已降至${Math.round(currentRelation)}，双方的同盟关系出现了裂痕。他们的使节暗示，如果你能送上一份诚意礼物，或许能修复这段关系。否则，同盟可能会进一步恶化。`,
        isDiplomaticEvent: true,
        options: [
            {
                id: 'gift',
                text: `送礼维护（${giftCost}银币）`,
                description: '赠送礼物以改善关系（关系+15）',
                effects: {
                    resources: {
                        silver: -giftCost,
                    },
                },
                callback: () => callback('gift', giftCost),
            },
            {
                id: 'ignore',
                text: '不予理会',
                description: '关系将继续下降，解盟风险增加',
                effects: {},
                callback: () => callback('ignore'),
            },
        ],
    };
}

/**
 * 创建外交事件 - 盟友被攻击求援
 * @param {Object} ally - 被攻击的盟友
 * @param {Object} attacker - 攻击者
 * @param {Function} callback - 回调 (intervene: boolean) => void
 * @returns {Object} - 外交事件对象
 */
export function createAllyAttackedEvent(ally, attacker, callback) {
    return {
        id: `ally_attacked_${ally.id}_${Date.now()}`,
        name: `盟友${ally.name}求援！`,
        icon: 'AlertTriangle',
        image: null,
        description: `紧急！你的盟友${ally.name}遭到${attacker.name}的攻击！他们派遣使节前来请求军事援助。

作为盟友，你有义务伸出援手。但如果你选择袖手旁观，将会：
• 与${ally.name}的关系大幅下降（-40）
• 同盟关系解除
• 与所有国家的关系下降（-10）
• "背叛盟友"的名声将影响未来的外交

你的选择？`,
        isDiplomaticEvent: true,
        options: [
            {
                id: 'intervene',
                text: '履行盟约，参战！',
                description: `与${attacker.name}进入战争状态`,
                effects: {
                    stability: -5,
                },
                callback: () => callback(true),
            },
            {
                id: 'abandon',
                text: '袖手旁观',
                description: '背叛盟友，承受声誉损失',
                effects: {},
                callback: () => callback(false),
            },
        ],
    };
}

/**
 * 创建外交事件 - AI要求玩家投降
 * @param {Object} nation - 要求投降的国家
 * @param {number} warScore - 战争分数（负数表示AI占优）
 * @param {Object} demands - 要求内容 { type: 'tribute' | 'territory' | 'open_market', amount: number }
 * @param {Function} callback - 回调 (accept: boolean) => void
 * @returns {Object} - 外交事件对象
 */
export function createAIDemandSurrenderEvent(nation, warScore, demands, callback) {
    const demandDescriptions = {
        tribute: `支付${demands.amount}银币作为赔款`,
        territory: `割让${demands.amount}人口作为领土`,
        open_market: `在${Math.round(demands.amount / 365)}年内开放市场`,
    };

    const demandText = demandDescriptions[demands.type] || '接受他们的条件';

    return {
        id: `ai_demand_surrender_${nation.id}_${Date.now()}`,
        name: `${nation.name}要求投降`,
        icon: 'Swords',
        image: null,
        description: `${nation.name}的使节带着傲慢的姿态前来。他们在战争中占据优势（战争分数：${Math.abs(Math.round(warScore))}），并要求你接受他们的条件。

他们的要求：${demandText}

如果拒绝，战争将继续进行。`,
        isDiplomaticEvent: true,
        options: [
            {
                id: 'accept',
                text: '接受条件',
                description: demandText,
                effects: {},
                callback: () => callback(true),
            },
            {
                id: 'reject',
                text: '拒绝！继续战斗！',
                description: '战争将继续进行',
                effects: {},
                callback: () => callback(false),
            },
        ],
    };
}

