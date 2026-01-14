// 联合叛乱系统 (Coalition Rebellion System)
// 当多个阶层同时处于高组织度状态时，可以联合发动叛乱

import { STRATA } from '../strata.js';
import { REBELLION_PHASE, REBELLION_CONFIG } from './rebellionEvents.js';

/**
 * 获取阶层中文名称
 */
function getStratumName(stratumKey) {
    return STRATA[stratumKey]?.name || stratumKey;
}

/**
 * 创建联合叛乱政府国家对象
 * 当多个阶层联合叛乱时使用
 * @param {string[]} coalitionStrata - 参与联合的阶层键数组
 * @param {Object} popStructure - 人口结构
 * @param {Object} classWealth - 阶层财富
 * @param {Object} classInfluence - 阶层影响力
 * @param {number} totalInfluence - 总影响力
 * @param {number} coalitionBonus - 联合加成比例 (默认 0.1 = 10%)
 */
export function createCoalitionRebelNation(
    coalitionStrata,
    popStructure,
    classWealth,
    classInfluence,
    totalInfluence,
    coalitionBonus = 0.1
) {
    const strataNames = coalitionStrata.map(key => getStratumName(key));

    // 生成联合政府名称
    let coalitionName;
    if (coalitionStrata.length === 2) {
        coalitionName = `${strataNames[0]}与${strataNames[1]}联合政府`;
    } else if (coalitionStrata.length === 3) {
        coalitionName = `${strataNames[0]}、${strataNames[1]}与${strataNames[2]}联合政府`;
    } else {
        coalitionName = `人民联合革命政府`;
    }

    const rebelId = `coalition_rebel_${Date.now()}`;

    // 计算总人口、财富、影响力
    let totalPop = 0;
    let totalWealth = 0;
    let totalCoalitionInfluence = 0;

    coalitionStrata.forEach(stratumKey => {
        const pop = popStructure[stratumKey] || 0;
        const wealth = classWealth[stratumKey] || 0;
        const influence = classInfluence[stratumKey] || 0;

        // 每个阶层贡献70%人口和50%财富
        totalPop += Math.floor(pop * 0.7);
        totalWealth += Math.floor(wealth * 0.5);
        totalCoalitionInfluence += influence;
    });

    // 应用联合加成 (团结奖励)
    const bonusMultiplier = 1 + coalitionBonus;
    const population = Math.max(20, Math.floor(totalPop * bonusMultiplier));
    const wealth = Math.max(REBELLION_CONFIG.REBEL_NATION_BASE_WEALTH * 2, Math.floor(totalWealth * bonusMultiplier));

    const influenceShare = totalInfluence > 0 ? totalCoalitionInfluence / totalInfluence : 0;
    // 联合叛军军事实力更强
    const militaryStrength = Math.min(2.0, 0.6 + influenceShare * 2.5);

    console.log(`[COALITION] Creating coalition rebel nation: ${coalitionName}`);
    console.log(`[COALITION] Population: ${totalPop} -> ${population} (with bonus)`);
    console.log(`[COALITION] Wealth: ${totalWealth} -> ${wealth} (with bonus)`);
    console.log(`[COALITION] Military Strength: ${militaryStrength.toFixed(2)}`);

    return {
        id: rebelId,
        name: coalitionName,
        desc: `由${strataNames.join('、')}等阶层联合组建的叛乱政府`,
        color: '#4B0000',
        icon: 'Users',
        wealth,
        population,
        aggression: Math.min(1.0, REBELLION_CONFIG.REBEL_NATION_BASE_AGGRESSION + 0.1),
        relation: 0,
        isAtWar: true,
        warScore: 0,
        militaryStrength,
        isRebelNation: true,
        isCoalitionRebellion: true,
        coalitionStrata,
        rebellionStratum: coalitionStrata[0],
        visible: true,
        economyTraits: {
            resourceBias: {},
            baseWealth: wealth,
            basePopulation: population,
        },
        foreignPower: {
            baseRating: 0.6 + coalitionStrata.length * 0.1,
            volatility: 0.4,
            appearEpoch: 0,
            populationFactor: 1.2,
            wealthFactor: 1.2,
        },
        inventory: {},
        budget: Math.floor(wealth * 0.4),
        enemyLosses: 0,
        warDuration: 0,
        warStartDay: null,
        foreignWars: {},
    };
}

/**
 * 创建联合叛乱事件
 */
export function createCoalitionRebellionEvent(
    coalitionStrata,
    rebelNation,
    hasMilitary,
    isMilitaryRebelling,
    popLossDetails,
    callback
) {
    const strataNames = coalitionStrata.map(key => getStratumName(key));
    const strataList = strataNames.join('、');
    const options = [];

    if (hasMilitary && !isMilitaryRebelling) {
        options.push({
            id: 'suppress',
            text: '调动军队镇压',
            description: '出动忠诚军队强行镇压多阶层联合叛乱：成功时可重创叛军并压低组织度，失败则军队损失惨重、局势进一步恶化',
            effects: {
                stability: -5,
                approval: { [coalitionStrata[0]]: -10 },
            },
            callback: () => callback('suppress', coalitionStrata[0]),
        });
    }

    options.push({
        id: 'accept_war',
        text: '应战',
        description: '承认联合叛军为敌对势力，放弃短期内快速镇压，转为打一场长期的联合内战',
        effects: {
            stability: -3,
        },
        callback: () => callback('accept_war', coalitionStrata[0], rebelNation),
    });

    const popLossText = popLossDetails
        .map(({ stratumName, loss }) => `${stratumName}：${loss}人`)
        .join('、');

    return {
        id: `coalition_rebellion_${Date.now()}`,
        name: '多阶层联合叛乱爆发！',
        icon: 'Users',
        image: null,
        description: `最危险的情况发生了！${strataList}等多个阶层联合起来发动叛乱，宣布成立"${rebelNation.name}"！\n\n这是一场规模空前的联合起义，多个阶层的不满者团结一致，势力远超单一阶层的叛乱。你必须立即做出应对！\n\n💀 叛军实力：\n• 总人口：约${rebelNation.population}人\n• 总财富：${rebelNation.wealth}银币\n• 军事实力：${(rebelNation.militaryStrength * 100).toFixed(0)}%\n\n📉 人口损失：\n${popLossText}`,
        isRebellionEvent: true,
        rebellionPhase: REBELLION_PHASE.ACTIVE,
        isCoalitionRebellion: true,
        coalitionStrata,
        rebellionStratum: coalitionStrata[0],
        options,
    };
}

/**
 * 计算联合叛乱时各阶层的人口损失
 * @param {string[]} coalitionStrata - 参与阶层
 * @param {Object} popStructure - 人口结构
 * @returns {Object} { details: Array, totalLoss: number }
 */
export function calculateCoalitionPopLoss(coalitionStrata, popStructure) {
    const details = [];
    let totalLoss = 0;

    coalitionStrata.forEach(stratumKey => {
        const pop = popStructure[stratumKey] || 0;
        const loss = Math.floor(pop * 0.7); // 70%人口加入叛军
        if (loss > 0) {
            details.push({
                stratumKey,
                stratumName: getStratumName(stratumKey),
                loss,
            });
            totalLoss += loss;
        }
    });

    return { details, totalLoss };
}

export default {
    createCoalitionRebelNation,
    createCoalitionRebellionEvent,
    calculateCoalitionPopLoss,
};
