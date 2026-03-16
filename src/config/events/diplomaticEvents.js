// Diplomatic Events - Functions to create dynamic diplomatic events
// These events are generated dynamically based on game state

import { calculatePeacePayment, calculateInstallmentPlan, calculateAllyMaintenanceCost, INSTALLMENT_CONFIG } from '../../utils/diplomaticUtils.js';
import { formatNumberShortCN } from '../../utils/numberFormat.js';
import { STRATA } from '../strata.js';
import { VASSAL_TYPE_CONFIGS, TREATY_TYPE_LABELS } from '../diplomacy.js';

export const REBEL_DEMAND_SURRENDER_TYPE = {
    REFORM: 'reform',
    CONCESSION: 'concession',
    MASSACRE: 'massacre'
};

/**
 * Creates a rebel surrender demand event with multiple options
 * @param {Object} nation - The rebel nation
 * @param {Object} eventData - Data about the demands (massacreAmount, concessionAmount, reformAmount)
 * @param {Function} callback - Callback function for handling player choice
 * @returns {Object} Event object
 */
export function createRebelDemandSurrenderEvent(nation, eventData, callback) {
    const stratumName = STRATA[eventData.rebellionStratum]?.name || '起义阶层';
    const stratumKey = eventData.rebellionStratum;
    const warAdvantage = eventData.warAdvantage || 100;

    // 检测是否是联盟叛乱
    const coalitionStrata = eventData.coalitionStrata || [stratumKey];
    const isCoalition = coalitionStrata.length > 1;
    const coalitionNames = isCoalition
        ? coalitionStrata.map(k => STRATA[k]?.name || k).join('、')
        : stratumName;

    // 从新格式读取金额，兼容旧格式
    const massacreAmount = eventData.massacreAmount || eventData.demandAmount || 10;
    const reformAmount = eventData.reformAmount || Math.max(100, massacreAmount * 10);
    // 强制补贴：总金额为改革的3倍，分365天按日支付
    const subsidyTotalAmount = eventData.subsidyTotalAmount || reformAmount * 3;
    const subsidyDailyAmount = eventData.subsidyDailyAmount || Math.ceil(subsidyTotalAmount / 365);

    let title = `${nation.name} 的最后通牒`;
    let icon = 'AlertTriangle';

    // 根据战争优势调整描述的严重程度
    let description = `${nation.name} 在战争中占据优势，向你发出最后通牒！\n\n`;
    if (warAdvantage > 200) {
        description += `叛军已经取得了压倒性的胜利，他们傲慢地提出了苛刻的条件。由于之前的血腥镇压，激进派甚至扬言要进行报复性的清洗！\n\n`;
        icon = 'Skull';
    } else if (warAdvantage > 100) {
        description += `叛军占据明显优势，他们要求朝廷做出重大让步，满足${coalitionNames}的核心诉求。\n\n`;
    } else {
        description += `虽然叛军稍占上风，但局势仍有转圜余地。他们提出以下条件供你考虑：\n\n`;
    }

    description += `你可以选择接受以下任一条件来结束这场叛乱：`;

    // 补贴和改革的描述 - 如果是联盟，说明按比例分配
    const subsidyDesc = isCoalition
        ? `接受向${coalitionNames}支付为期一年的强制补贴（按比例分配）。每日支付 ${formatNumberShortCN(subsidyDailyAmount, { decimals: 1 })} 银币，共 ${formatNumberShortCN(subsidyTotalAmount, { decimals: 1 })} 银币。`
        : `接受向${stratumName}支付为期一年的强制补贴。每日支付 ${formatNumberShortCN(subsidyDailyAmount, { decimals: 1 })} 银币，共 ${formatNumberShortCN(subsidyTotalAmount, { decimals: 1 })} 银币。`;

    const reformDesc = isCoalition
        ? `一次性支付 ${formatNumberShortCN(reformAmount, { decimals: 1 })} 银币进行改革（按比例分配给${coalitionNames}）。`
        : `一次性支付 ${formatNumberShortCN(reformAmount, { decimals: 1 })} 银币进行改革，这笔钱将直接转入${stratumName}的财富。`;

    const options = [
        {
            id: 'accept_massacre',
            text: `清洗敌对势力`,
            description: `让叛军泄愤，在国内开展血腥清洗。失去 ${massacreAmount} 人口和相应的人口上限。`,
            effects: {},
            callback: () => callback('accept', nation, { ...eventData, demandType: 'massacre', demandAmount: massacreAmount, coalitionStrata })
        },
        {
            id: 'accept_subsidy',
            text: `强制补贴`,
            description: subsidyDesc,
            effects: {},
            callback: () => callback('accept', nation, {
                ...eventData,
                demandType: 'subsidy',
                demandAmount: subsidyTotalAmount,
                subsidyDailyAmount,
                subsidyStratum: stratumKey,
                coalitionStrata
            })
        },
        {
            id: 'accept_reform',
            text: `改革妥协`,
            description: reformDesc,
            effects: {},
            callback: () => callback('accept', nation, {
                ...eventData,
                demandType: 'reform',
                demandAmount: reformAmount,
                reformStratum: stratumKey,
                coalitionStrata
            })
        },
        {
            id: 'reject',
            text: '拒绝一切条件',
            description: '拒绝叛军的所有要求，战争将继续。叛军可能会发动更猛烈的攻击。',
            effects: {},
            callback: () => callback('reject', nation, eventData)
        }
    ];

    return {
        id: `rebel_demand_${nation.id}_${Date.now()}`,
        name: title,
        title: title,
        icon: icon,
        description: description,
        nation: nation,
        isDiplomaticEvent: true,
        options
    };
}

// 割地人口上限(战争求和时最多割让/获得的人口数)
const MAX_TERRITORY_POPULATION = 5000;

// 开放市场持续时间(天数)
const OPEN_MARKET_DURATION_YEARS = 3; // 3年
const OPEN_MARKET_DURATION_DAYS = OPEN_MARKET_DURATION_YEARS * 365; // 1095天

const MIN_PEACE_WEALTH_BASELINE = 50000;
const getPeaceWealthBaseline = (nation = {}) => {
    const templateWealth = nation.wealthTemplate || 0;
    const foreignRating = nation.foreignPower?.wealthFactor
        ? nation.foreignPower.wealthFactor * 50000
        : 0;
    return Math.max(
        MIN_PEACE_WEALTH_BASELINE,
        nation.wealth || 0,
        Math.floor(templateWealth * 0.5),
        Math.floor(foreignRating)
    );
};

const formatNumber = (value) => (typeof value === 'number' ? formatNumberShortCN(value, { decimals: 1 }) : value);

/**
 * 创建外交事件 - 敌国宣战
 * @param {Object} nation - 宣战的国家
 * @param {Function} onAccept - 确认的回调
 * @param {Object} warData - 可选的战争数据 { reason, vassalName, ... }
 * @returns {Object} - 外交事件对象
 */
export function createWarDeclarationEvent(nation, onAccept, warData = {}) {
    let description;
    let title;

    if (warData.reason === 'vassal_protection') {
        // 因攻击玩家附庸而触发的战争
        title = `${nation.name}入侵附庸`;
        description = `${nation.name}入侵了你的附庸国${warData.vassalName || ''}！根据宗主国保护义务，你自动与其进入战争状态。\n\n敌军正在向你的附庸领土推进，你必须做好应战准备，保护你的附庸国。`;
    } else if (warData.reason === 'wealth') {
        title = `${nation.name}宣战`;
        description = `${nation.name}觊觎你的财富，对你的国家发动了战争！他们的军队正在集结，边境局势十分紧张。`;
    } else {
        title = `${nation.name}宣战`;
        description = `${nation.name}对你的国家发动了战争！他们的军队正在集结，边境局势十分紧张。这是一场不可避免的冲突，你必须做好应战准备。`;
    }

    return {
        id: `war_declaration_${nation.id}_${Date.now()}`,
        name: title,
        icon: 'Swords',
        image: null,
        description: description,
        isDiplomaticEvent: true,
        options: [
            {
                id: 'acknowledge',
                text: '应战',
                description: '接受战争状态，动员全国进入战时体制(稳定度-5)',
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
        description: `${nation.name}派遣使节前来,带来了价值${giftAmount}银币的珍贵礼物。这是他们表达善意和改善关系的诚意之举。`,
        isDiplomaticEvent: true,
        options: [
            {
                id: 'accept',
                text: '接受礼物',
                description: `收下礼物,获得${giftAmount}银币`,
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
 * 创建外交事件 - 敌国请求和平(根据战争分数提供不同选项)
 * @param {Object} nation - 请求和平的国家
 * @param {number} tribute - 基础赔款金额
 * @param {number} warScore - 战争分数
 * @param {Function} callback - 回调函数,接收accepted参数
 * @returns {Object} - 外交事件对象
 */
export function createEnemyPeaceRequestEvent(nation, tribute, warScore, callback, epoch = 0) {
    const options = [];
    const wealthBaseline = getPeaceWealthBaseline(nation);
    const enemyLosses = nation.enemyLosses || 0;
    const warDuration = nation.warDuration || 0;
    // 敌人求和时，玩家处于优势，使用demanding模式计算赔款（与玩家主动求和时的算法一致）
    const paymentSet = calculatePeacePayment(Math.max(0, warScore), enemyLosses, warDuration, wealthBaseline, 'demanding');
    const baseTribute = tribute && tribute > 0 ? tribute : paymentSet.standard;
    const estimatedPopulation = nation.population || nation.basePopulation || 1000;
    // 检查是否解锁附庸系统（封建时代 epoch >= 3）
    const vassalUnlocked = epoch >= 3;

    // 根据战争分数提供不同选项
    if (warScore > 500) {
        const highTribute = Math.max(baseTribute * 2, paymentSet.high);
        const installmentPlan = calculateInstallmentPlan(highTribute);
        const installmentAmount = installmentPlan.dailyAmount;
        const populationDemand = Math.min(MAX_TERRITORY_POPULATION, Math.max(20, Math.floor(estimatedPopulation * 0.20)));
        // [FIX] Use actual population instead of estimated to prevent over-annexation
        const annexPopulation = nation.population || 1000;

        options.push({
            id: 'annex',
            text: '全面吞并',
            description: `要求${nation.name}无条件解散政权，直接吞并全国并吸收约${formatNumber(Math.round(annexPopulation))}人口。`,
            effects: {},
            callback: () => callback(true, 'annex', annexPopulation),
        });
        if (vassalUnlocked) {
            options.push({
                id: 'demand_vassal',
                text: '要求成为附庸国',
                description: `要求${nation.name}成为附庸国，定期朝贡并服从宗主国的外交政策。`,
                effects: {},
                callback: () => callback(true, 'vassal', 0),
            });
        } else {
            options.push({
                id: 'demand_vassal_locked',
                text: '🔒 要求成为附庸国',
                description: `附庸制度尚未解锁。需要进入封建时代（时代 ≥ 3）才能收附庸。`,
                effects: {},
                disabled: true,
                callback: () => { },
            });
        }
        options.push({
            id: 'demand_more',
            text: '索要巨额赔款',
            description: `一次性支付${formatNumber(highTribute)}银币，赔款额翻倍。`,
            effects: {
                resources: {
                    silver: highTribute,
                },
            },
            callback: () => callback(true, 'demand_more', highTribute),
        });
        options.push({
            id: 'demand_population',
            text: '割让人口',
            description: `割让${formatNumber(populationDemand)}人口及其土地归我方统治。`,
            effects: {},
            callback: () => callback(true, 'population', populationDemand),
        });
        options.push({
            id: 'demand_installment',
            text: '签署分期赔款',
            description: `允许他们在${INSTALLMENT_CONFIG.DURATION_DAYS}天内每日支付${formatNumber(installmentAmount)}银币，共计${formatNumber(installmentPlan.totalAmount)}银币。`,
            effects: {},
            callback: () => callback(true, 'installment', installmentAmount),
        });
        options.push({
            id: 'accept_standard',
            text: '接受常规赔款',
            description: `收取${formatNumber(baseTribute)}银币后立即停战。`,
            effects: {
                resources: {
                    silver: baseTribute,
                },
            },
            callback: () => callback(true, 'standard', baseTribute),
        });
    } else if (warScore > 150) {
        const highTribute = Math.max(baseTribute * 1.5, paymentSet.high);
        const installmentPlan = calculateInstallmentPlan(highTribute);
        const installmentAmount = installmentPlan.dailyAmount;
        const populationDemand = Math.min(MAX_TERRITORY_POPULATION, Math.max(15, Math.floor(estimatedPopulation * 0.12)));

        if (vassalUnlocked) {
            options.push({
                id: 'demand_vassal',
                text: '要求成为附庸国',
                description: `要求${nation.name}成为附庸国，定期朝贡并服从宗主国的外交政策。`,
                effects: {},
                callback: () => callback(true, 'vassal', 0),
            });
        } else {
            options.push({
                id: 'demand_vassal_locked',
                text: '🔒 要求成为附庸国',
                description: `附庸制度尚未解锁。需要进入封建时代（时代 ≥ 3）才能收附庸。`,
                effects: {},
                disabled: true,
                callback: () => { },
            });
        }
        options.push({
            id: 'demand_more',
            text: '索要高额赔款',
            description: `一次性支付${formatNumber(highTribute)}银币，额外增加50%的赔偿。`,
            effects: {
                resources: {
                    silver: highTribute,
                },
            },
            callback: () => callback(true, 'demand_more', highTribute),
        });
        options.push({
            id: 'demand_installment',
            text: '签署分期赔款',
            description: `在${INSTALLMENT_CONFIG.DURATION_DAYS}天内每日支付${formatNumber(installmentAmount)}银币，共计${formatNumber(installmentPlan.totalAmount)}银币。`,
            effects: {},
            callback: () => callback(true, 'installment', installmentAmount),
        });
        options.push({
            id: 'demand_population',
            text: '割让人口',
            description: `割出${formatNumber(populationDemand)}人口迁往我方。`,
            effects: {},
            callback: () => callback(true, 'population', populationDemand),
        });
        options.push({
            id: 'demand_open_market',
            text: '强制开放市场',
            description: `要求${nation.name}在${OPEN_MARKET_DURATION_YEARS}年内对我方商人开放市场与航线。`,
            effects: {},
            callback: () => callback(true, 'open_market', OPEN_MARKET_DURATION_DAYS),
        });
        options.push({
            id: 'accept_standard',
            text: '接受常规赔款',
            description: `收取${formatNumber(baseTribute)}银币后结束战争。`,
            effects: {
                resources: {
                    silver: baseTribute,
                },
            },
            callback: () => callback(true, 'standard', baseTribute),
        });
    } else if (warScore > 50) {
        const standardTribute = Math.max(baseTribute, paymentSet.standard);
        const installmentPlan = calculateInstallmentPlan(Math.max(standardTribute, paymentSet.low));
        const installmentAmount = installmentPlan.dailyAmount;
        const populationDemand = Math.min(MAX_TERRITORY_POPULATION, Math.max(10, Math.floor(estimatedPopulation * 0.08)));

        options.push({
            id: 'accept',
            text: '接受赔款',
            description: `一次性交付${formatNumber(standardTribute)}银币。`,
            effects: {
                resources: {
                    silver: standardTribute,
                },
            },
            callback: () => callback(true, 'standard', standardTribute),
        });
        options.push({
            id: 'demand_installment',
            text: '允许分期赔款',
            description: `在${INSTALLMENT_CONFIG.DURATION_DAYS}天内每日支付${formatNumber(installmentAmount)}银币，共计${formatNumber(installmentPlan.totalAmount)}银币。`,
            effects: {},
            callback: () => callback(true, 'installment', installmentAmount),
        });
        options.push({
            id: 'demand_population',
            text: '割让部分人口',
            description: `交出${formatNumber(populationDemand)}人口作为战败补偿。`,
            effects: {},
            callback: () => callback(true, 'population', populationDemand),
        });
    } else {
        const standardTribute = Math.max(baseTribute, paymentSet.low);
        options.push({
            id: 'accept',
            text: '接受象征性赔款',
            description: `象征性收取${formatNumber(standardTribute)}银币。`,
            effects: {
                resources: {
                    silver: standardTribute,
                },
            },
            callback: () => callback(true, 'standard', standardTribute),
        });
    }

    options.push({
        id: 'reject',
        text: '拒绝和谈',
        description: '拒绝所有条件,继续以武力解决。',
        effects: {},
        callback: () => callback(false),
    });

    let description = '';
    if (warScore > 450) {
        description = `${nation.name}的政权濒临崩溃,使节带着投降书恳求无条件和平。`;
    } else if (warScore > 200) {
        description = `${nation.name}在连番败仗后愿意支付沉重赔偿以换取停火。`;
    } else if (warScore > 50) {
        description = `${nation.name}承认战局不利,提出以高额赔款换取停火。`;
    } else {
        description = `${nation.name}只能拿出少量赔款,祈求暂时的喘息。`;
    }

    return {
        id: `enemy_peace_request_${nation.id}_${Date.now()}`,
        name: warScore > 450 ? `${nation.name}的投降书` : `${nation.name}的和谈请求`,
        icon: warScore > 450 ? 'Flag' : 'HandHeart',
        image: null,
        description,
        isDiplomaticEvent: true,
        options,
    };
}

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
    const wealthBaseline = getPeaceWealthBaseline(nation);
    const effectiveLosses = enemyLosses || nation.enemyLosses || 0;
    const effectiveDuration = warDuration || nation.warDuration || 0;
    const demandingPayments = calculatePeacePayment(Math.max(warScore, 0), effectiveLosses, effectiveDuration, wealthBaseline, 'demanding');
    const offeringPayments = calculatePeacePayment(Math.abs(Math.min(warScore, 0)), effectiveLosses, effectiveDuration, wealthBaseline, 'offering');
    // 检查是否解锁附庸系统（封建时代 epoch >= 3）
    const epoch = playerState.epoch || 0;
    const vassalUnlocked = epoch >= 3;

    const calculateTerritoryOffer = (maxPercent, severityDivisor) => {
        const warPressure = Math.abs(Math.min(warScore, 0)) / severityDivisor;
        const durationPressure = Math.max(0, warDuration || 0) / 4000;
        const severity = Math.min(maxPercent, Math.max(0.012, warPressure + durationPressure));
        const capped = Math.floor(playerPopulationBase * severity);
        const hardCap = Math.floor(playerPopulationBase * maxPercent);
        return Math.min(MAX_TERRITORY_POPULATION, Math.max(3, Math.min(hardCap, capped)));
    };

    if (warScore > 500) {
        const highTribute = Math.ceil(demandingPayments.high * 1.4);
        const populationDemand = Math.min(MAX_TERRITORY_POPULATION, Math.max(25, Math.floor((nation.population || nation.basePopulation || 1000) * 0.25)));
        const annexPopulation = nation.population || nation.basePopulation || 1000;

        options.push({
            id: 'demand_annex',
            text: '提出吞并要求',
            description: `迫使${nation.name}交出全部领土,吞并约${formatNumber(Math.round(annexPopulation))}人口。`,
            effects: {},
            callback: () => callback('demand_annex', annexPopulation),
        });
        options.push({
            id: 'demand_high',
            text: '索要巨额赔款',
            description: `勒索${formatNumber(highTribute)}银币。`,
            effects: {},
            callback: () => callback('demand_high', highTribute),
        });
        options.push({
            id: 'demand_population',
            text: '割让人口',
            description: `要求交出${formatNumber(populationDemand)}人口与土地。`,
            effects: {},
            callback: () => callback('demand_population', populationDemand),
        });
        options.push({
            id: 'demand_open_market',
            text: '强制开放市场',
            description: `要求${nation.name}在${OPEN_MARKET_DURATION_YEARS}年内开放市场,允许我方商队自由进出。`,
            effects: {},
            callback: () => callback('demand_open_market', OPEN_MARKET_DURATION_DAYS),
        });
        // 附庸选项（需要更高战争分数且已解锁附庸系统）
        if (warScore > 300 && vassalUnlocked) {
            options.push({
                id: 'demand_vassal',
                text: '🏴 要求成为附庸国',
                description: `迫使${nation.name}成为你的附庸国,确立宗主权与朝贡关系。`,
                effects: {},
                callback: () => callback('demand_vassal', 'vassal'),
            });
        } else if (warScore > 300 && !vassalUnlocked) {
            options.push({
                id: 'demand_vassal_locked',
                text: '🔒 要求成为附庸国',
                description: `附庸制度尚未解锁。需要进入封建时代（时代 ≥ 3）才能收附庸。`,
                effects: {},
                disabled: true,
                callback: () => { },
            });
        }
        options.push({
            id: 'peace_only',
            text: '只接受停战',
            description: '不再提出额外条件,立即停战。',
            effects: {},
            callback: () => callback('peace_only', 0),
        });
    } else if (warScore > 150) {
        const highTribute = Math.max(demandingPayments.high, demandingPayments.standard * 1.3);
        const installmentPlan = calculateInstallmentPlan(highTribute);
        const populationDemand = Math.min(MAX_TERRITORY_POPULATION, Math.max(15, Math.floor((nation.population || nation.basePopulation || 1000) * 0.12)));

        options.push({
            id: 'demand_high',
            text: '提出苛刻赔款',
            description: `立即支付${formatNumber(highTribute)}银币。`,
            effects: {},
            callback: () => callback('demand_high', highTribute),
        });
        options.push({
            id: 'demand_installment',
            text: '强制分期赔款',
            description: `在${INSTALLMENT_CONFIG.DURATION_DAYS}天内每日支付${formatNumber(installmentPlan.dailyAmount)}银币,共计${formatNumber(installmentPlan.totalAmount)}银币。`,
            effects: {},
            callback: () => callback('demand_installment', installmentPlan.dailyAmount),
        });
        options.push({
            id: 'demand_population',
            text: '索要人口',
            description: `转交${formatNumber(populationDemand)}人口与其土地。`,
            effects: {},
            callback: () => callback('demand_population', populationDemand),
        });
        options.push({
            id: 'demand_open_market',
            text: '强制开放市场',
            description: `要求${nation.name}在${OPEN_MARKET_DURATION_YEARS}年内开放市场,允许我方商队自由进出。`,
            effects: {},
            callback: () => callback('demand_open_market', OPEN_MARKET_DURATION_DAYS),
        });
        // 附庸选项（需要已解锁附庸系统）
        if (vassalUnlocked) {
            options.push({
                id: 'demand_vassal',
                text: '🏴 要求成为附庸国',
                description: `迫使${nation.name}成为你的附庸国,确立宗主权与朝贡关系。`,
                effects: {},
                callback: () => callback('demand_vassal', 'vassal'),
            });
        } else {
            options.push({
                id: 'demand_vassal_locked',
                text: '🔒 要求成为附庸国',
                description: `附庸制度尚未解锁。需要进入封建时代（时代 ≥ 3）才能收附庸。`,
                effects: {},
                disabled: true,
                callback: () => { },
            });
        }
    } else if (warScore > 50) {
        const standardTribute = Math.max(demandingPayments.standard, demandingPayments.low);
        const installmentPlan = calculateInstallmentPlan(standardTribute);
        const populationDemand = Math.min(MAX_TERRITORY_POPULATION, Math.max(10, Math.floor((nation.population || nation.basePopulation || 1000) * 0.08)));

        options.push({
            id: 'demand_standard',
            text: '索要赔款',
            description: `支付${formatNumber(standardTribute)}银币即可停战。`,
            effects: {},
            callback: () => callback('demand_standard', standardTribute),
        });
        options.push({
            id: 'demand_installment',
            text: '允许分期赔款',
            description: `在${INSTALLMENT_CONFIG.DURATION_DAYS}天内每日支付${formatNumber(installmentPlan.dailyAmount)}银币,共计${formatNumber(installmentPlan.totalAmount)}银币。`,
            effects: {},
            callback: () => callback('demand_installment', installmentPlan.dailyAmount),
        });
        options.push({
            id: 'demand_population',
            text: '割让人口',
            description: `交出${formatNumber(populationDemand)}人口作为附加条件。`,
            effects: {},
            callback: () => callback('demand_population', populationDemand),
        });
        // 附庸选项（需要已解锁附庸系统）
        if (vassalUnlocked) {
            options.push({
                id: 'demand_vassal',
                text: '🏴 要求成为附庸国',
                description: `迫使${nation.name}成为你的附庸国,确立宗主权与朝贡关系。`,
                effects: {},
                callback: () => callback('demand_vassal', 'vassal'),
            });
        } else {
            options.push({
                id: 'demand_vassal_locked',
                text: '🔒 要求成为附庸国',
                description: `附庸制度尚未解锁。需要进入封建时代（时代 ≥ 3）才能收附庸。`,
                effects: {},
                disabled: true,
                callback: () => { },
            });
        }
    } else if (warScore > -50) {
        const payment = Math.max(offeringPayments.high, offeringPayments.standard);
        const installmentPlan = calculateInstallmentPlan(payment);
        const populationOffer = calculateTerritoryOffer(0.15, 200);

        options.push({
            id: 'pay_high',
            text: '支付巨额赔款',
            description: `一次性奉上${formatNumber(payment)}银币以换取和平。`,
            effects: {},
            callback: () => callback('pay_high', payment),
        });
        options.push({
            id: 'pay_installment',
            text: '请求分期赔款',
            description: `在${INSTALLMENT_CONFIG.DURATION_DAYS}天内每日支付${formatNumber(installmentPlan.dailyAmount)}银币,共计${formatNumber(installmentPlan.totalAmount)}银币。`,
            effects: {},
            callback: () => callback('pay_installment', installmentPlan.dailyAmount),
        });
        options.push({
            id: 'offer_population',
            text: '割地求和',
            description: `割让${formatNumber(populationOffer)}人口对应的土地,以换取对方停战。`,
            effects: {},
            callback: () => callback('offer_population', populationOffer),
        });
    } else if (warScore < -50) {
        const payment = Math.max(offeringPayments.standard, offeringPayments.low);
        const installmentPlan = calculateInstallmentPlan(payment);
        const populationOffer = calculateTerritoryOffer(0.10, 280);

        options.push({
            id: 'pay_standard',
            text: '支付赔款',
            description: `拿出${formatNumber(payment)}银币平息战火。`,
            effects: {},
            callback: () => callback('pay_standard', payment),
        });
        options.push({
            id: 'pay_installment',
            text: '请求分期赔款',
            description: `在${INSTALLMENT_CONFIG.DURATION_DAYS}天内每日支付${formatNumber(installmentPlan.dailyAmount)}银币,共计${formatNumber(installmentPlan.totalAmount)}银币。`,
            effects: {},
            callback: () => callback('pay_installment', installmentPlan.dailyAmount),
        });
        options.push({
            id: 'offer_population',
            text: '割地求和',
            description: `交出${formatNumber(populationOffer)}人口换取停火。`,
            effects: {},
            callback: () => callback('offer_population', populationOffer),
        });
    } else {
        const payment = Math.max(50, offeringPayments.low);
        const installmentPlan = calculateInstallmentPlan(payment);

        options.push({
            id: 'pay_moderate',
            text: '支付象征性赔款',
            description: `投入${formatNumber(payment)}银币作为诚意。`,
            effects: {},
            callback: () => callback('pay_moderate', payment),
        });
        options.push({
            id: 'pay_installment_moderate',
            text: '提出分期方案',
            description: `在${INSTALLMENT_CONFIG.DURATION_DAYS}天内每日支付${formatNumber(installmentPlan.dailyAmount)}银币,共计${formatNumber(installmentPlan.totalAmount)}银币。`,
            effects: {},
            callback: () => callback('pay_installment_moderate', installmentPlan.dailyAmount),
        });
        options.push({
            id: 'peace_only',
            text: '仅请求停战',
            description: '尝试在不赔款的情况下结束战争。',
            effects: {},
            callback: () => callback('peace_only', 0),
        });
    }

    options.push({
        id: 'cancel',
        text: '取消',
        description: '暂不提出条件。',
        effects: {},
        callback: () => callback('cancel', 0),
    });

    let description = '';
    if (warScore > 450) {
        description = `我们对${nation.name}拥有碾压优势,可以提出吞并等极端条件。`;
    } else if (warScore > 200) {
        description = `我们掌握主动权,可要求高额赔款或贸易让步。`;
    } else if (warScore > 50) {
        description = `我们略占上风,可以索要赔款或局部割地。`;
    } else if (warScore < -200) {
        description = `${nation.name}占尽上风,只有巨额赔款或割地才能换得喘息。`;
    } else if (warScore < -50) {
        description = `战局不利,也许必须拿出赔偿条件才能说服${nation.name}。`;
    } else {
        description = `战事胶着,可以尝试以务实条件与${nation.name}谈判。`;
    }

    return {
        id: `player_peace_proposal_${nation.id}_${Date.now()}`,
        name: `向${nation.name}提出和谈`,
        icon: 'HandHeart',
        image: null,
        description,
        isDiplomaticEvent: true,
        options,
    };
}

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
        description = `${nation.name}趁你不备发动了突袭!他们掠夺了你的资源并造成了人员伤亡。`;
        description += `\n\n突袭损失:`;
        if (battleResult.foodLoss) description += `\n粮食:${battleResult.foodLoss}`;
        if (battleResult.silverLoss) description += `\n银币:${battleResult.silverLoss}`;
        if (battleResult.playerLosses) description += `\n人口:${battleResult.playerLosses}`;
    } else {
        // 正常战斗
        description = isVictory
            ? `${nation.name}的军队向你发起了进攻,但在你的英勇抵抗下被击退了!敌军损失惨重,士气低落。`
            : `${nation.name}的军队向你发起了猛烈进攻!你的军队遭受了重大损失,局势十分危急。`;

        description += `\n\n战斗结果:\n我方损失:${battleResult.playerLosses || 0}人\n敌方损失:${battleResult.enemyLosses || 0}人`;
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
        description: `${nation.name}派遣使节前来,表示他们目前急需${resourceName}。他们希望你能慷慨解囊,提供${amount}${resourceName}。如果拒绝,可能会影响两国关系。`,
        isDiplomaticEvent: true,
        options: [
            {
                id: 'accept',
                text: '同意给予',
                description: `失去${amount}${resourceName},关系提升`,
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
                description: '保留资源,但关系会下降',
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
        description: `${nation.name}派遣特使前来,表达了缔结同盟的意愿。他们希望与你建立军事同盟,互相保护,共同抵御外敌。\n\n结盟后:\n• 双方不可互相宣战\n• 一方被攻击时,另一方有义务参战\n• 可以建立更多贸易路线\n• 关系将保持稳定`,
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
                description: '拒绝结盟,关系会略微下降',
                effects: {},
                callback: () => callback(false),
            },
        ],
    };
}

/**
 * 创建外交事件 - AI邀请加入国际组织
 * @param {Object} nation - 邀请方国家
 * @param {Object} organization - 组织对象
 * @param {Function} callback - 回调 (accepted: boolean) => void
 * @returns {Object} - 外交事件对象
 */
export function createOrganizationInviteEvent(nation, organization, callback) {
    const orgName = organization?.name || '国际组织';
    const orgType = organization?.type || 'unknown';
    const memberCount = organization?.members?.length || 0;

    // 根据组织类型设置描述
    let benefits = '';
    if (orgType === 'military_alliance') {
        benefits = '\n\n加入后的效益:\n• 与成员国共同防御\n• 成员间关系加成 +5\n• 军事力量加成 +10%';
    } else if (orgType === 'economic_bloc') {
        benefits = '\n\n加入后的效益:\n• 成员间关税减免 30%\n• 成员间关系加成 +5\n• 贸易效率加成 +20%';
    } else if (orgType === 'free_trade_zone') {
        benefits = '\n\n加入后的效益:\n• 成员间关税全免\n• 贸易效率大幅提升';
    }

    return {
        id: `organization_invite_${nation.id}_${Date.now()}`,
        name: `${nation.name}的组织邀请`,
        icon: orgType === 'military_alliance' ? 'Shield' : orgType === 'economic_bloc' ? 'TrendingUp' : 'Users',
        image: null,
        description: `${nation.name}派遣使节前来,邀请你加入"${orgName}"。\n\n该组织目前有${memberCount}个成员国。${benefits}\n\n接受邀请将与${nation.name}以及其他成员国建立更紧密的关系。`,
        isDiplomaticEvent: true,
        options: [
            {
                id: 'accept',
                text: '接受邀请',
                description: `加入"${orgName}"`,
                effects: {},
                callback: () => callback(true),
            },
            {
                id: 'reject',
                text: '婉言谢绝',
                description: '拒绝加入,关系会略微下降',
                effects: {},
                callback: () => callback(false),
            },
        ],
    };
}

/**
 * Treaty 2.0: 创建外交事件 - AI提出条约
 * @param {Object} nation - 提案国家
 * @param {Object} treaty - 条约提案（最小字段：type, durationDays, maintenancePerDay）
 * @param {Function} callback - 回调 (accepted: boolean) => void
 */
export function createTreatyProposalEvent(nation, treaty, callback) {
    const typeLabel = TREATY_TYPE_LABELS[treaty?.type] || (treaty?.type || '条约');
    const durationDays = Math.max(1, Math.floor(Number(treaty?.durationDays) || 365));
    const maintenancePerDay = Math.max(0, Math.floor(Number(treaty?.maintenancePerDay) || 0));

    const descriptionLines = [
        `${nation.name}派遣使节前来,提出签署《${typeLabel}条约》的请求。`,
        '',
        '条约主要条款:',
        `• 类型: ${typeLabel}`,
        `• 期限: ${durationDays}天`,
        maintenancePerDay > 0 ? `• 维护费: 每日${maintenancePerDay}银币` : '• 维护费: 无',
        '',
        '你可以选择接受或拒绝。拒绝可能影响两国关系。',
    ];

    return {
        id: `treaty_proposal_${nation.id}_${Date.now()}`,
        name: `${nation.name}提出条约：${typeLabel}`,
        icon: treaty?.type === 'academic_exchange' ? 'BookOpen'
            : (treaty?.type === 'open_market' || treaty?.type === 'trade_agreement' || treaty?.type === 'free_trade') ? 'Store'
                : (treaty?.type === 'non_aggression' || treaty?.type === 'peace_treaty') ? 'Shield'
                    : 'Users',
        image: null,
        description: descriptionLines.join('\n'),
        isDiplomaticEvent: true,
        options: [
            {
                id: 'accept',
                text: '签署条约',
                description: '接受提案并立刻生效',
                effects: {},
                callback: () => callback(true),
            },
            {
                id: 'reject',
                text: '拒绝',
                description: '拒绝提案,关系会下降',
                effects: {},
                callback: () => callback(false),
            },
        ],
    };
}

/**
 * Treaty 2.0: 创建外交事件 - 玩家提出条约的结果
 * @param {Object} nation - 目标国家
 * @param {Object} treaty - 条约提案
 * @param {boolean} accepted - 是否接受
 * @param {Function} callback - 确认回调
 */
export function createTreatyProposalResultEvent(nation, treaty, accepted, callback) {
    const typeLabel = TREATY_TYPE_LABELS[treaty?.type] || (treaty?.type || '条约');

    if (accepted) {
        return {
            id: `treaty_accepted_${nation.id}_${Date.now()}`,
            name: `${nation.name}同意签署：${typeLabel}`,
            icon: 'FileCheck',
            image: null,
            description: `${nation.name}同意了你的条约提案。\n\n《${typeLabel}条约》已生效。`,
            isDiplomaticEvent: true,
            options: [
                {
                    id: 'acknowledge',
                    text: '确认',
                    description: '条约生效',
                    effects: {},
                    callback: callback,
                },
            ],
        };
    }

    return {
        id: `treaty_rejected_${nation.id}_${Date.now()}`,
        name: `${nation.name}拒绝条约：${typeLabel}`,
        icon: 'FileX',
        image: null,
        description: `${nation.name}拒绝了你的条约提案。你可以继续改善关系,或更换条约条款再尝试。`,
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
 * Treaty 2.0: 创建外交事件 - 条约撕毁通知
 * @param {Object} nation - 条约撕毁方
 * @param {Object} breachPenalty - 违约惩罚 { relationPenalty: number }
 * @param {Function} callback - 确认回调
 * @returns {Object} - 外交事件对象
 */
export function createTreatyBreachEvent(nation, breachPenalty, callback) {
    const penalty = breachPenalty?.relationPenalty ?? 0;
    return {
        id: `treaty_breach_${nation.id}_${Date.now()}`,
        name: `${nation.name}撕毁条约`,
        icon: 'AlertTriangle',
        image: null,
        description: `${nation.name}突然撕毁了与你的和平条约，双方关系急剧恶化（-${penalty}）。你的外交信誉受到冲击。`,
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
            description: `${nation.name}接受了你的结盟请求!从今天起,你们正式成为盟友。双方将共同抵御外敌,互相支持。`,
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
            description: `${nation.name}婉言拒绝了你的结盟请求。他们表示目前还不是建立同盟的好时机。继续改善关系,以后再试试吧。`,
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
        description: `${reasonText},你与${nation.name}的同盟关系已经解除。你们不再有共同防御的义务,贸易路线限制也恢复正常。`,
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
        description = `经过艰苦的战争,${nation.name}终于臣服于你的统治!他们的领土、人民和资源现在都归你所有。

🎉 吞并成果:
• 获得人口:${formatNumberShortCN(Math.round(populationGained), { decimals: 0 })}人
• 获得人口上限:+${formatNumberShortCN(Math.round(maxPopGained), { decimals: 0 })}

${nation.name}的旗帜已经降下,取而代之的是你的王旗。这是一次伟大的征服!`;
    } else {
        // 因人口归零而消亡
        title = `💀 ${nation.name}已经灭亡`;
        description = `${nation.name}在连年战争中损失惨重,人口凋零,国力衰竭。最终,这个曾经的国家彻底消亡了。

残存的人民(${formatNumberShortCN(Math.round(populationGained), { decimals: 0 })}人)逃入你的领土,成为你的臣民。

• 获得人口:${formatNumberShortCN(Math.round(populationGained), { decimals: 0 })}人
• 获得人口上限:+${formatNumberShortCN(Math.round(maxPopGained), { decimals: 0 })}

历史将记住这个国家,但它的辉煌已成过去。`;
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
                text: isWarAnnex ? '荣耀永存!' : '了解',
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
    // 使用动态成本计算:基于盟友财富的3%,范围80-300000
    const giftCost = calculateAllyMaintenanceCost(nation.wealth || 500, nation.wealth || 500);

    return {
        id: `ally_cold_${nation.id}_${Date.now()}`,
        name: `与${nation.name}的关系冷淡`,
        icon: 'HeartCrack',
        image: null,
        description: `你与盟友${nation.name}的关系已降至${Math.round(currentRelation)},双方的同盟关系出现了裂痕。他们的使节暗示,如果你能送上一份诚意礼物,或许能修复这段关系。否则,同盟可能会进一步恶化。`,
        isDiplomaticEvent: true,
        options: [
            {
                id: 'gift',
                text: `送礼维护(${giftCost}银币)`,
                description: '赠送礼物以改善关系(关系+15)',
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
                description: '关系将继续下降,解盟风险增加',
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
        name: `盟友${ally.name}求援!`,
        icon: 'AlertTriangle',
        image: null,
        description: `紧急!你的盟友${ally.name}遭到${attacker.name}的攻击!他们派遣使节前来请求军事援助。

作为盟友,你有义务伸出援手。但如果你选择袖手旁观,将会:
• 与${ally.name}的关系大幅下降(-40)
• 同盟关系解除
• 与所有国家的关系下降(-10)
• "背叛盟友"的名声将影响未来的外交

你的选择?`,
        isDiplomaticEvent: true,
        options: [
            {
                id: 'intervene',
                text: '履行盟约,参战!',
                description: `与${attacker.name}进入战争状态`,
                effects: {
                    stability: -5,
                },
                callback: () => callback(true),
            },
            {
                id: 'abandon',
                text: '袖手旁观',
                description: '背叛盟友,承受声誉损失',
                effects: {},
                callback: () => callback(false),
            },
        ],
    };
}

/**
 * 创建外交事件 - AI要求玩家投降
 * @param {Object} nation - 要求投降的国家
 * @param {number} warScore - 战争分数(负数表示AI占优)
 * @param {Object} demands - 要求内容 { type: 'tribute' | 'territory' | 'open_market', amount: number }
 * @param {Function} callback - 回调 (accept: boolean) => void
 * @returns {Object} - 外交事件对象
 */
/**
 * 创建外交事件 - AI要求玩家投降
 * 复用玩家主动求和时的选项生成逻辑，只是事件名称和描述不同
 * @param {Object} nation - 要求投降的国家
 * @param {number} warScore - 战争分数(负数表示AI占优)
 * @param {Object} demands - 要求内容 { type: 'tribute' | 'territory' | 'open_market', amount: number } (保留兼容)
 * @param {Object} playerState - 玩家状态 { population, maxPopulation, wealth }（或旧的callback兼容）
 * @param {Function} callback - 回调 (actionType: string, amount: number) => void
 * @returns {Object} - 外交事件对象
 */
export function createAIDemandSurrenderEvent(nation, warScore, demands, playerStateOrCallback, callbackArg) {
    // 兼容旧的调用方式: createAIDemandSurrenderEvent(nation, warScore, demands, callback)
    let playerState = {};
    let callback = callbackArg;
    if (typeof playerStateOrCallback === 'function') {
        // 旧的调用方式，只有4个参数
        callback = playerStateOrCallback;
        playerState = {};
    } else {
        playerState = playerStateOrCallback || {};
    }

    const options = [];
    const playerPopulationBase = Math.max(
        200,
        playerState.population || playerState.maxPopulation || 1000
    );
    const playerWealth = playerState.wealth || 10000;

    // 使用与玩家主动投降相同的计算逻辑
    const aiWarScore = Math.abs(warScore); // AI的优势分数（正数）
    const wealthBaseline = playerWealth; // 使用玩家财富作为基准
    const effectiveDuration = nation.warDuration || 0;

    // 计算赔款选项 - 使用 offering 模式（玩家支付）
    const offeringPayments = calculatePeacePayment(aiWarScore, 0, effectiveDuration, wealthBaseline, 'offering');

    // 计算割地选项
    const calculateTerritoryOffer = (maxPercent, severityDivisor) => {
        const warPressure = aiWarScore / severityDivisor;
        const durationPressure = Math.max(0, effectiveDuration) / 4000;
        const severity = Math.min(maxPercent, Math.max(0.012, warPressure + durationPressure));
        const capped = Math.floor(playerPopulationBase * severity);
        const hardCap = Math.floor(playerPopulationBase * maxPercent);
        return Math.min(MAX_TERRITORY_POPULATION, Math.max(3, Math.min(hardCap, capped)));
    };

    // 根据AI优势程度生成不同的选项（与玩家主动投降时相同的分档逻辑）
    if (aiWarScore > 200) {
        // AI大优势 - 要求更苛刻
        const payment = Math.max(offeringPayments.high, offeringPayments.standard);
        const installmentPlan = calculateInstallmentPlan(payment);
        const populationOffer = calculateTerritoryOffer(0.15, 200);

        options.push({
            id: 'pay_high',
            text: '支付赔款',
            description: `拿出${formatNumber(payment)}银币平息战火。`,
            effects: {},
            callback: () => callback('pay_high', payment),
        });
        options.push({
            id: 'pay_installment',
            text: '请求分期赔款',
            description: `在${INSTALLMENT_CONFIG.DURATION_DAYS}天内每日支付${formatNumber(installmentPlan.dailyAmount)}银币,共计${formatNumber(installmentPlan.totalAmount)}银币。`,
            effects: {},
            callback: () => callback('pay_installment', installmentPlan.dailyAmount),
        });
        options.push({
            id: 'offer_population',
            text: '割地求和',
            description: `交出${formatNumber(populationOffer)}人口换取停火。`,
            effects: {},
            callback: () => callback('offer_population', populationOffer),
        });
    } else if (aiWarScore > 50) {
        // AI有优势
        const payment = Math.max(offeringPayments.standard, offeringPayments.low);
        const installmentPlan = calculateInstallmentPlan(payment);
        const populationOffer = calculateTerritoryOffer(0.10, 280);

        options.push({
            id: 'pay_standard',
            text: '支付赔款',
            description: `拿出${formatNumber(payment)}银币平息战火。`,
            effects: {},
            callback: () => callback('pay_standard', payment),
        });
        options.push({
            id: 'pay_installment',
            text: '请求分期赔款',
            description: `在${INSTALLMENT_CONFIG.DURATION_DAYS}天内每日支付${formatNumber(installmentPlan.dailyAmount)}银币,共计${formatNumber(installmentPlan.totalAmount)}银币。`,
            effects: {},
            callback: () => callback('pay_installment', installmentPlan.dailyAmount),
        });
        options.push({
            id: 'offer_population',
            text: '割地求和',
            description: `交出${formatNumber(populationOffer)}人口换取停火。`,
            effects: {},
            callback: () => callback('offer_population', populationOffer),
        });
    } else {
        // AI优势较小
        const payment = Math.max(50, offeringPayments.low);
        const installmentPlan = calculateInstallmentPlan(payment);

        options.push({
            id: 'pay_moderate',
            text: '支付赔款',
            description: `拿出${formatNumber(payment)}银币作为诚意。`,
            effects: {},
            callback: () => callback('pay_moderate', payment),
        });
        options.push({
            id: 'pay_installment',
            text: '请求分期赔款',
            description: `在${INSTALLMENT_CONFIG.DURATION_DAYS}天内每日支付${formatNumber(installmentPlan.dailyAmount)}银币,共计${formatNumber(installmentPlan.totalAmount)}银币。`,
            effects: {},
            callback: () => callback('pay_installment', installmentPlan.dailyAmount),
        });
    }

    // 添加拒绝选项
    options.push({
        id: 'reject',
        text: '拒绝!继续战斗!',
        description: '战争将继续进行',
        effects: {},
        callback: () => callback('reject', 0),
    });

    // 根据AI优势程度生成不同的描述
    let description = '';
    if (aiWarScore > 200) {
        description = `${nation.name}的使节带着傲慢的姿态前来。他们在战争中占据压倒性优势(战争分数:${Math.round(aiWarScore)}),并要求你接受苛刻的条件。如果拒绝,战争将继续进行。`;
    } else if (aiWarScore > 50) {
        description = `${nation.name}的使节带着傲慢的姿态前来。他们在战争中占据优势(战争分数:${Math.round(aiWarScore)}),并要求你接受他们的条件。如果拒绝,战争将继续进行。`;
    } else {
        description = `${nation.name}的使节前来谈判。虽然他们在战争中略占上风(战争分数:${Math.round(aiWarScore)}),但条件相对温和。如果拒绝,战争将继续进行。`;
    }

    return {
        id: `ai_demand_surrender_${nation.id}_${Date.now()}`,
        name: `${nation.name}要求投降`,
        icon: 'Swords',
        image: null,
        description,
        isDiplomaticEvent: true,
        options,
    };
}

/**
 * 创建外交事件 - 附庸国发动独立战争
 * @param {Object} nation - 发动独立战争的附庸国
 * @param {Object} vassalInfo - 附庸信息 { vassalType, independencePressure, tributeRate }
 * @param {Function} callback - 回调 (action: 'negotiate' | 'crush' | 'release') => void
 * @returns {Object} - 外交事件对象
 */
export function createIndependenceWarEvent(nation, vassalInfo, callback) {
    const vassalTypeNames = {
        protectorate: '保护国',
        tributary: '朝贡国',
        puppet: '傀儡国',
        colony: '殖民地',
    };
    const vassalTypeName = vassalTypeNames[vassalInfo?.vassalType] || '附庸国';
    const independencePressure = vassalInfo?.independencePressure || 0;

    let description = `⚠️ 紧急！你的${vassalTypeName}${nation.name}发动了独立战争！\n\n`;

    if (independencePressure > 80) {
        description += `长期的高压统治和剥削积累了巨大的不满。${nation.name}的人民决心不惜一切代价争取独立！\n\n`;
    } else if (independencePressure > 60) {
        description += `${nation.name}的民族主义情绪高涨，他们认为时机已到，决定挑战宗主国的权威。\n\n`;
    } else {
        description += `${nation.name}趁你的注意力被其他事务分散，发动了突然的叛乱。\n\n`;
    }

    description += `当前形势：\n`;
    description += `• 独立倾向：${Math.round(independencePressure)}%\n`;
    description += `• 朝贡率：${Math.round((vassalInfo?.tributeRate || 0) * 100)}%\n\n`;
    description += `你必须做出决定：是动用武力镇压叛乱，还是寻求和平解决？`;

    return {
        id: `independence_war_${nation.id}_${Date.now()}`,
        name: `${nation.name}发动独立战争！`,
        icon: 'Flag',
        image: null,
        description,
        isDiplomaticEvent: true,
        options: [
            {
                id: 'crush',
                text: '出兵镇压！',
                description: `调动军队镇压叛乱，维护帝国统一（稳定度-10，进入战争状态）`,
                effects: {
                    stability: -10,
                },
                callback: () => callback('crush'),
            },
            // {
            //     id: 'negotiate',
            //     text: '谈判解决',
            //     description: '通过外交谈判平息叛乱（取消战争，朝贡率减半，独立倾向-10）',
            //     effects: {},
            //     callback: () => callback('negotiate'),
            // },
            {
                id: 'release',
                text: '承认独立',
                description: `和平释放${nation.name}，避免战争消耗（关系大幅提升，但失去该附庸）`,
                effects: {},
                callback: () => callback('release'),
            },
        ],
    };
}


/**
 * 创建外交事件 - AI国家请求成为附庸（在战败或关系良好时）
 * @param {Object} nation - 请求成为附庸的国家
 * @param {string} vassalType - 请求的附庸类型
 * @param {string} reason - 原因 ('war_defeat' | 'diplomatic' | 'protection')
 * @param {Function} callback - 回调 (accepted: boolean, vassalType?: string) => void
 * @returns {Object} - 外交事件对象
 */
export function createVassalRequestEvent(nation, vassalType, reason, callback) {
    const vassalTypeNames = {
        protectorate: '保护国',
        tributary: '朝贡国',
        puppet: '傀儡国',
    };
    const vassalTypeName = vassalTypeNames[vassalType] || '附庸国';

    let description = '';
    let title = '';

    switch (reason) {
        case 'war_defeat':
            title = `${nation.name}请求臣服`;
            description = `在战争中遭受重创后，${nation.name}的统治者派遣使节前来，表示愿意接受附庸地位以换取和平。

他们愿意成为你的${vassalTypeName}，定期朝贡并接受你的保护。这将为你带来：
• 定期朝贡收入
• 贸易优惠
• 军事通行权`;
            break;
        case 'protection':
            title = `${nation.name}寻求保护`;
            description = `${nation.name}正面临强敌威胁，他们希望成为你的${vassalTypeName}以换取军事保护。

作为回报，他们将：
• 定期缴纳朝贡
• 开放市场给你的商人
• 在军事上配合你的行动`;
            break;
        default:
            title = `${nation.name}提议建立附庸关系`;
            description = `${nation.name}对你的国力印象深刻，主动提议成为你的${vassalTypeName}。

这是一个和平扩大影响力的机会：
• 无需战争即可获得附庸
• 立即开始获得朝贡收入
• 扩大你的外交影响力`;
    }

    return {
        id: `vassal_request_${nation.id}_${Date.now()}`,
        name: title,
        icon: 'Crown',
        image: null,
        description,
        isDiplomaticEvent: true,
        options: [
            {
                id: 'accept',
                text: `接受，建立${vassalTypeName}关系`,
                description: `${nation.name}将成为你的${vassalTypeName}`,
                effects: {},
                callback: () => callback(true, vassalType),
            },
            {
                id: 'reject',
                text: '拒绝',
                description: '保持现有关系',
                effects: {},
                callback: () => callback(false),
            },
        ],
    };
}

/**
 * 创建外交事件 - 海外投资机会
 * 当附庸国有特殊投资机会时触发
 * @param {Object} nation - 附庸国
 * @param {Object} opportunity - 投资机会详情
 * @param {Function} callback - 回调 (accept: boolean, investmentDetails?: Object) => void
 * @returns {Object} - 外交事件对象
 */
export function createOverseasInvestmentOpportunityEvent(nation, opportunity, callback) {
    const { buildingType, potentialProfit, requiredInvestment, ownerStratum } = opportunity;
    const stratumNames = { capitalist: '资本家', merchant: '商人', landowner: '地主' };
    const stratumName = stratumNames[ownerStratum] || '投资者';

    return {
        id: `overseas_investment_${nation.id}_${Date.now()}`,
        name: `${nation.name}的投资机会`,
        icon: 'Building2',
        image: null,
        description: `${nation.name}的使节带来消息：当地发现了一个极佳的投资机会！

${stratumName}阶层的商人对在该国建设${buildingType}表现出浓厚兴趣。

预计投资额：${formatNumberShortCN(requiredInvestment)} 银币
预期月收益：${formatNumberShortCN(potentialProfit)} 银币

是否批准这项投资？`,
        isDiplomaticEvent: true,
        options: [
            {
                id: 'accept_local',
                text: '批准投资（当地运营）',
                description: `利润留在当地再投资，长期收益更高`,
                effects: {},
                callback: () => callback(true, { ...opportunity, operatingMode: 'local' }),
            },
            {
                id: 'accept_buyback',
                text: '批准投资（回购模式）',
                description: `产品运回本国销售，立即获得收益`,
                effects: {},
                callback: () => callback(true, { ...opportunity, operatingMode: 'buyback' }),
            },
            {
                id: 'reject',
                text: '暂不投资',
                description: '保持观望',
                effects: {},
                callback: () => callback(false),
            },
        ],
    };
}

/**
 * 创建外交事件 - 外资国有化警告
 * 当附庸国的独立倾向过高时，可能国有化外资
 * @param {Object} nation - 附庸国
 * @param {Object} investment - 被威胁的投资
 * @param {Function} callback - 回调 (action: string) => void
 * @returns {Object} - 外交事件对象
 */
export function createNationalizationThreatEvent(nation, investment, callback) {
    const investmentValue = investment.investmentAmount || 0;
    const compensationRate = 0.3; // 国有化补偿率
    const compensation = Math.floor(investmentValue * compensationRate);

    return {
        id: `nationalization_threat_${nation.id}_${Date.now()}`,
        name: `${nation.name}威胁国有化`,
        icon: 'AlertTriangle',
        image: null,
        description: `${nation.name}政府宣布正在考虑国有化外资企业！

你在该国的投资（价值 ${formatNumberShortCN(investmentValue)} 银币）正面临被没收的风险。

政府表示愿意提供 ${formatNumberShortCN(compensation)} 银币的补偿，但这远低于实际价值。

你需要做出回应：`,
        isDiplomaticEvent: true,
        options: [
            {
                id: 'accept_compensation',
                text: '接受补偿',
                description: `获得 ${formatNumberShortCN(compensation)} 银币，放弃投资`,
                effects: {},
                callback: () => callback('accept_compensation', { compensation }),
            },
            {
                id: 'negotiate',
                text: '外交谈判',
                description: '尝试通过谈判阻止国有化（关系-10）',
                effects: {},
                callback: () => callback('negotiate'),
            },
            {
                id: 'threaten',
                text: '发出警告',
                description: '威胁采取报复措施（可能引发外交危机）',
                effects: {},
                callback: () => callback('threaten'),
            },
        ],
    };
}

/**
 * 创建外交事件 - 贸易争端
 * 当国际组织成员间发生贸易摩擦时触发
 * @param {Object} nation1 - 争端一方
 * @param {Object} nation2 - 争端另一方
 * @param {string} disputeType - 争端类型
 * @param {Function} callback - 回调 (decision: string) => void
 * @returns {Object} - 外交事件对象
 */
export function createTradeDisputeEvent(nation1, nation2, disputeType, callback) {
    const disputeDescriptions = {
        tariff: `${nation1.name}单方面提高了对${nation2.name}商品的关税，引发了贸易争端。`,
        dumping: `${nation1.name}指控${nation2.name}在其市场上倾销商品，要求采取保护措施。`,
        subsidy: `${nation2.name}对本国产业的补贴政策引发了${nation1.name}的不满。`,
    };

    return {
        id: `trade_dispute_${Date.now()}`,
        name: '国际贸易争端',
        icon: 'Scale',
        image: null,
        description: `${disputeDescriptions[disputeType] || '两国之间爆发了贸易争端。'}

作为地区大国，双方都希望你能够介入调停。你的决定将影响与两国的关系。`,
        isDiplomaticEvent: true,
        options: [
            {
                id: 'support_nation1',
                text: `支持${nation1.name}`,
                description: `与${nation1.name}关系+10，与${nation2.name}关系-15`,
                effects: {},
                callback: () => callback('support_nation1'),
            },
            {
                id: 'support_nation2',
                text: `支持${nation2.name}`,
                description: `与${nation2.name}关系+10，与${nation1.name}关系-15`,
                effects: {},
                callback: () => callback('support_nation2'),
            },
            {
                id: 'mediate',
                text: '公正调停',
                description: '尝试达成双方都能接受的解决方案（双方关系各+5）',
                effects: {},
                callback: () => callback('mediate'),
            },
            {
                id: 'ignore',
                text: '不介入',
                description: '这不是我们的事务',
                effects: {},
                callback: () => callback('ignore'),
            },
        ],
    };
}

/**
 * 创建外交事件 - 军事同盟邀请
 * AI国家邀请玩家加入针对第三方的军事同盟
 * @param {Object} inviter - 邀请国
 * @param {Object} target - 目标国（被针对的国家）
 * @param {string} reason - 邀请原因
 * @param {Function} callback - 回调 (accepted: boolean) => void
 * @returns {Object} - 外交事件对象
 */
export function createMilitaryAllianceInviteEvent(inviter, target, reason, callback) {
    const reasonDescriptions = {
        containment: `${inviter.name}认为${target.name}的扩张威胁到了地区稳定，希望联合其他国家进行遏制。`,
        revenge: `${inviter.name}与${target.name}有宿怨，正在寻找盟友准备复仇。`,
        preemptive: `${inviter.name}的情报显示${target.name}正在秘密备战，希望先发制人。`,
    };

    return {
        id: `military_alliance_invite_${Date.now()}`,
        name: `${inviter.name}的军事同盟邀请`,
        icon: 'Shield',
        image: null,
        description: `${inviter.name}的特使秘密到访，提出建立针对${target.name}的军事同盟。

${reasonDescriptions[reason] || `${inviter.name}希望与我们建立更紧密的军事合作。`}

加入同盟意味着：
• 与${inviter.name}建立军事同盟
• 承诺在战时提供军事支援
• 可能与${target.name}关系恶化`,
        isDiplomaticEvent: true,
        options: [
            {
                id: 'accept',
                text: '加入同盟',
                description: `与${inviter.name}建立军事同盟，与${target.name}关系-20`,
                effects: {},
                callback: () => callback(true),
            },
            {
                id: 'reject_friendly',
                text: '婉拒',
                description: '表示目前不便加入，但保持友好关系',
                effects: {},
                callback: () => callback(false, 'friendly'),
            },
            {
                id: 'reject_warn_target',
                text: '拒绝并警告目标国',
                description: `向${target.name}通报此事（与${target.name}关系+15，与${inviter.name}关系-25）`,
                effects: {},
                callback: () => callback(false, 'warn_target'),
            },
        ],
    };
}

/**
 * 创建外交事件 - 边境冲突
 * 与邻国发生边境摩擦
 * @param {Object} nation - 发生冲突的国家
 * @param {Object} incidentDetails - 冲突详情
 * @param {Function} callback - 回调 (response: string) => void
 * @returns {Object} - 外交事件对象
 */
export function createBorderIncidentEvent(nation, incidentDetails, callback) {
    const { casualties, isOurFault } = incidentDetails;

    let description = '';
    if (isOurFault) {
        description = `我方边境巡逻队在争议地区与${nation.name}的部队发生冲突，造成对方${casualties}人伤亡。

${nation.name}政府强烈抗议，要求赔偿并保证不再发生类似事件。`;
    } else {
        description = `${nation.name}的军队越过边境，与我方巡逻队发生冲突，造成我方${casualties}人伤亡。

我们需要对这一挑衅行为做出回应。`;
    }

    const options = isOurFault ? [
        {
            id: 'apologize',
            text: '道歉并赔偿',
            description: `支付赔偿金，关系恢复（-500银币）`,
            effects: {},
            callback: () => callback('apologize'),
        },
        {
            id: 'deny',
            text: '否认责任',
            description: '坚称这是对方的责任（关系-15）',
            effects: {},
            callback: () => callback('deny'),
        },
    ] : [
        {
            id: 'demand_apology',
            text: '要求道歉',
            description: '通过外交渠道要求对方道歉',
            effects: {},
            callback: () => callback('demand_apology'),
        },
        {
            id: 'retaliate',
            text: '军事报复',
            description: '派兵进行报复性打击（关系-30，可能引发战争）',
            effects: {},
            callback: () => callback('retaliate'),
        },
        {
            id: 'protest',
            text: '外交抗议',
            description: '提出正式抗议但不采取进一步行动',
            effects: {},
            callback: () => callback('protest'),
        },
    ];

    return {
        id: `border_incident_${nation.id}_${Date.now()}`,
        name: '边境冲突',
        icon: 'Swords',
        image: null,
        description,
        isDiplomaticEvent: true,
        options,
    };
}

/**
 * 将领会战提议事件
 * 将军根据战场态势主动提议发起会战，玩家选择批准/暂缓/否决
 * @param {Object} params
 * @param {Function} callback - (choice: 'approve'|'delay'|'reject') => void
 * @returns {Object} Event object
 */
export function createBattleProposalEvent({ general, corps, front, proposal, callback }) {
    const generalName = general?.name || '将军';
    const corpsName = corps?.name || '军团';
    const engagementNames = { probe: '试探接敌', assault: '主力决战', siege: '攻坚围城' };
    const engagementName = engagementNames[proposal?.engagementType] || '会战';
    const riskLabels = { low: '低', medium: '中', high: '高', extreme: '极高' };
    const riskLabel = riskLabels[proposal?.riskLevel] || '中';
    const riskColors = { low: '', medium: '⚠️', high: '⚠️⚠️', extreme: '🔴' };
    const riskIcon = riskColors[proposal?.riskLevel] || '';
    const confidence = proposal?.confidence ?? 0;
    const confidenceText = confidence > 0.6 ? '强烈建议' : '建议';
    const forceRatioText = proposal?.forceRatio ? `${proposal.forceRatio.toFixed(1)}:1` : '未知';
    const supplyRatioText = proposal?.supplyRatio ? `${Math.round(proposal.supplyRatio * 100)}%` : '未知';

    const description = `${generalName}将军${confidenceText}率领「${corpsName}」发起${engagementName}。\n\n` +
        `📊 兵力比：${forceRatioText}\n` +
        `📦 补给率：${supplyRatioText}\n` +
        `${riskIcon} 风险评级：${riskLabel}\n\n` +
        `${proposal?.reason || '将军认为时机成熟。'}\n\n` +
        `⚔️ 战术将由将军自行决定，无需手动选择。`;

    const options = [
        {
            id: 'approve',
            text: '准许出战',
            description: `批准${generalName}将军发起${engagementName}，将军士气+5`,
            effects: {},
            callback: () => callback('approve'),
        },
        {
            id: 'delay',
            text: '暂缓观望',
            description: '不做处置，48天内该将军不会再次提议',
            effects: {},
            callback: () => callback('delay'),
        },
        {
            id: 'reject',
            text: '否决提议',
            description: `否决出战请求，将军士气-8，30天内不再提议`,
            effects: {},
            callback: () => callback('reject'),
        },
    ];

    return {
        id: `battle_proposal_${general?.id}_${Date.now()}`,
        name: '将领请战',
        icon: 'Swords',
        image: null,
        description,
        isDiplomaticEvent: true,
        options,
    };
}
