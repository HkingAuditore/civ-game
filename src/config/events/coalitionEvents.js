// Coalition Events - 执政联盟相关事件
// 处理在野阶层要求加入执政联盟等政治诉求

import { STRATA } from '../strata.js';

/**
 * 获取阶层名称
 * @param {string} key - 阶层键
 * @returns {string} 阶层名称
 */
const getStratumName = (key) => {
    return STRATA[key]?.name || key;
};

/**
 * 检查是否有在野阶层影响力超过阈值
 * @param {Object} gameState - 游戏状态
 * @param {number} threshold - 影响力阈值 (0-1)
 * @returns {Object|null} 符合条件的阶层信息，或 null
 */
export function checkCoalitionDemandCondition(gameState, threshold = 0.20) {
    const {
        rulingCoalition = [],
        classInfluence = {},
        totalInfluence = 0,
        popStructure = {},
    } = gameState;

    if (totalInfluence <= 0) return null;

    // 不可参与政治的阶层
    const ineligible = new Set(['unemployed', 'slave']);

    // 查找影响力超过阈值的在野阶层
    const eligibleStrata = Object.entries(classInfluence)
        .filter(([key, value]) => {
            // 排除已在联盟中的阶层
            if (rulingCoalition.includes(key)) return false;
            // 排除不可参与政治的阶层
            if (ineligible.has(key)) return false;
            // 排除没有人口的阶层
            if ((popStructure[key] || 0) <= 0) return false;
            // 检查影响力是否超过阈值
            const share = value / totalInfluence;
            return share >= threshold;
        })
        .map(([key, value]) => ({
            key,
            influence: value,
            share: value / totalInfluence,
            name: getStratumName(key),
        }))
        .sort((a, b) => b.share - a.share);

    if (eligibleStrata.length === 0) return null;

    // 返回影响力最高的在野阶层
    return eligibleStrata[0];
}

/**
 * 生成在野阶层要求加入执政联盟的事件
 * @param {string} stratumKey - 阶层键
 * @param {Object} gameState - 游戏状态
 * @returns {Object} 事件对象
 */
export function createCoalitionDemandEvent(stratumKey, gameState) {
    const stratumName = getStratumName(stratumKey);
    const classInfluence = gameState.classInfluence || {};
    const totalInfluence = gameState.totalInfluence || 1;
    const influenceShare = ((classInfluence[stratumKey] || 0) / totalInfluence * 100).toFixed(1);

    // 计算补偿金额 = 阶层人数 × 每日花销 × 30天
    const popStructure = gameState.popStructure || {};
    const classExpense = gameState.classExpense || {};
    const stratumPop = popStructure[stratumKey] || 0;
    // classExpense 是该阶层的总每日支出，除以人口得到人均支出
    const totalDailyExpense = classExpense[stratumKey] || 0;
    const perCapitaDailyExpense = stratumPop > 0 ? totalDailyExpense / stratumPop : 10;
    // 补偿金 = 人数 × 人均日支出 × 30天
    const compensationAmount = Math.ceil(stratumPop * perCapitaDailyExpense * 30);

    return {
        id: `coalition_demand_${stratumKey}_${Date.now()}`,
        name: `${stratumName}的政治诉求`,
        icon: 'Users',
        image: null,
        description: `${stratumName}阶层的政治影响力已达到 ${influenceShare}%，他们对自己被排斥在执政联盟之外感到不满。代表们聚集在宫殿门前，要求获得政治参与权。"我们为这个国家贡献了如此之多，"他们的领袖在请愿书中写道，"却在重大决策中毫无发言权。这种状况必须改变。"`,
        isDynamic: true,
        targetStratum: stratumKey,
        compensationAmount, // 存储补偿金额供显示使用
        options: [
            {
                id: 'accept_join',
                text: '同意他们加入执政联盟',
                description: `允许${stratumName}参与国家决策，换取他们的支持`,
                effects: {
                    stability: 5,
                    approval: {
                        [stratumKey]: 15,
                    },
                    modifyCoalition: {
                        addToCoalition: stratumKey,
                    },
                },
            },
            {
                id: 'refuse_politely',
                text: `花费 ${compensationAmount} 银币安抚他们`,
                description: `用金钱补偿来平息不满，承诺日后再议（相当于该阶层30天的生活费用）`,
                effects: {
                    stability: -3,
                    approval: {
                        [stratumKey]: -5, // 比断然拒绝温和
                    },
                    resources: {
                        silver: -(compensationAmount), // 从国库扣除固定金额
                    },
                    classWealth: {
                        [stratumKey]: compensationAmount, // 转给该阶层
                    },
                },
            },
            {
                id: 'refuse_firmly',
                text: '断然拒绝',
                description: '明确表示他们不配参与执政，强硬维护现有权力结构',
                effects: {
                    stability: -8,
                    approval: {
                        [stratumKey]: -25,
                    },
                },
            },
        ],
    };
}

/**
 * 联盟事件冷却追踪 - 每个阶层的冷却时间
 */
const coalitionEventCooldowns = {};

/**
 * 检查并生成联盟诉求事件（用于游戏循环调用）
 * @param {Object} gameState - 游戏状态
 * @param {number} minDaysBetweenEvents - 同一阶层事件的最小间隔天数
 * @returns {Object|null} 事件对象，或 null
 */
export function checkAndCreateCoalitionDemandEvent(gameState, minDaysBetweenEvents = 60) {
    const daysElapsed = gameState.daysElapsed || 0;

    // 检查是否有符合条件的阶层
    const eligibleStratum = checkCoalitionDemandCondition(gameState, 0.20);
    if (!eligibleStratum) return null;

    const { key: stratumKey } = eligibleStratum;

    // 检查冷却时间
    const lastEventDay = coalitionEventCooldowns[stratumKey] || 0;
    if (daysElapsed - lastEventDay < minDaysBetweenEvents) {
        return null;
    }

    // 更新冷却时间
    coalitionEventCooldowns[stratumKey] = daysElapsed;

    // 生成事件
    return createCoalitionDemandEvent(stratumKey, gameState);
}

// 用于重置冷却（例如加载存档时）
export function resetCoalitionEventCooldowns() {
    Object.keys(coalitionEventCooldowns).forEach(key => {
        delete coalitionEventCooldowns[key];
    });
}
