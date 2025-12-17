// Diplomatic Events - Functions to create dynamic diplomatic events
// These events are generated dynamically based on game state

import { calculatePeacePayment, calculateInstallmentPlan, calculateAllyMaintenanceCost, INSTALLMENT_CONFIG } from '../../utils/diplomaticUtils';
import { STRATA } from '../strata';

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
        ? `接受向${coalitionNames}支付为期一年的强制补贴（按比例分配）。每日支付 ${subsidyDailyAmount.toLocaleString()} 银币，共 ${subsidyTotalAmount.toLocaleString()} 银币。`
        : `接受向${stratumName}支付为期一年的强制补贴。每日支付 ${subsidyDailyAmount.toLocaleString()} 银币，共 ${subsidyTotalAmount.toLocaleString()} 银币。`;
    
    const reformDesc = isCoalition
        ? `一次性支付 ${reformAmount.toLocaleString()} 银币进行改革（按比例分配给${coalitionNames}）。`
        : `一次性支付 ${reformAmount.toLocaleString()} 银币进行改革，这笔钱将直接转入${stratumName}的财富。`;

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

const formatNumber = (value) => (typeof value === 'number' ? value.toLocaleString() : value);

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
        description: `${nation.name}对你的国家发动了战争!他们的军队正在集结,边境局势十分紧张。这是一场不可避免的冲突,你必须做好应战准备。`,
        isDiplomaticEvent: true,
        options: [
            {
                id: 'acknowledge',
                text: '应战',
                description: '接受战争状态,动员全国进入战时体制(稳定度-5)',
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
export function createEnemyPeaceRequestEvent(nation, tribute, warScore, callback) {
    const options = [];
    const wealthBaseline = getPeaceWealthBaseline(nation);
    const enemyLosses = nation.enemyLosses || 0;
    const warDuration = nation.warDuration || 0;
    // 敌人求和时，玩家处于优势，使用demanding模式计算赔款（与玩家主动求和时的算法一致）
    const paymentSet = calculatePeacePayment(Math.max(0, warScore), enemyLosses, warDuration, wealthBaseline, 'demanding');
    const baseTribute = tribute && tribute > 0 ? tribute : paymentSet.standard;
    const estimatedPopulation = nation.population || nation.basePopulation || 1000;

    if (warScore > 450) {
        const highTribute = Math.max(baseTribute * 2, Math.ceil(paymentSet.high * 1.5));
        const installmentPlan = calculateInstallmentPlan(highTribute);
        const installmentAmount = installmentPlan.dailyAmount;
const populationDemand = Math.min(MAX_TERRITORY_POPULATION, Math.max(20, Math.floor(estimatedPopulation * 0.20)));
        const annexPopulation = Math.max(estimatedPopulation, nation.population || 1000);

        options.push({
            id: 'annex',
            text: '全面吞并',
            description: `要求${nation.name}无条件解散政权，直接吞并全国并吸收约${formatNumber(Math.round(annexPopulation))}人口。`,
            effects: {},
            callback: () => callback(true, 'annex', annexPopulation),
        });
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
    } else if (warScore > 200) {
        const highTribute = Math.max(baseTribute * 1.5, paymentSet.high);
        const installmentPlan = calculateInstallmentPlan(highTribute);
        const installmentAmount = installmentPlan.dailyAmount;
const populationDemand = Math.min(MAX_TERRITORY_POPULATION, Math.max(15, Math.floor(estimatedPopulation * 0.12)));

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

    const calculateTerritoryOffer = (maxPercent, severityDivisor) => {
        const warPressure = Math.abs(Math.min(warScore, 0)) / severityDivisor;
        const durationPressure = Math.max(0, warDuration || 0) / 4000;
        const severity = Math.min(maxPercent, Math.max(0.012, warPressure + durationPressure));
        const capped = Math.floor(playerPopulationBase * severity);
        const hardCap = Math.floor(playerPopulationBase * maxPercent);
        return Math.min(MAX_TERRITORY_POPULATION, Math.max(3, Math.min(hardCap, capped)));
    };

    if (warScore > 350) {
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
    } else if (warScore < -200) {
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
• 获得人口:${populationGained.toLocaleString()}人
• 获得人口上限:+${maxPopGained.toLocaleString()}

${nation.name}的旗帜已经降下,取而代之的是你的王旗。这是一次伟大的征服!`;
    } else {
        // 因人口归零而消亡
        title = `💀 ${nation.name}已经灭亡`;
        description = `${nation.name}在连年战争中损失惨重,人口凋零,国力衰竭。最终,这个曾经的国家彻底消亡了。

残存的人民(${populationGained.toLocaleString()}人)逃入你的领土,成为你的臣民。

• 获得人口:${populationGained.toLocaleString()}人
• 获得人口上限:+${maxPopGained.toLocaleString()}

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
        description: `${nation.name}的使节带着傲慢的姿态前来。他们在战争中占据优势(战争分数:${Math.abs(Math.round(warScore))}),并要求你接受他们的条件。

他们的要求:${demandText}

如果拒绝,战争将继续进行。`,
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
                text: '拒绝!继续战斗!',
                description: '战争将继续进行',
                effects: {},
                callback: () => callback(false),
            },
        ],
    };
}
