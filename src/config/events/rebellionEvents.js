// 叛乱事件系统
// 当阶层长期不满且拥有较大影响力时，可能发动叛乱

import { STRATA } from '../strata.js';

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
 * 检查某个阶层是否有军队（军人等）
 */
function isStratumMilitary(stratumKey) {
    return ['soldier'].includes(stratumKey);
}

/**
 * 创建叛乱思潮事件
 * @param {string} stratumKey - 阶层键
 * @param {Object} rebellionState - 叛乱状态
 * @param {boolean} hasMilitary - 玩家是否有军队
 * @param {boolean} isMilitaryRebelling - 军队自身是否在叛乱
 * @param {Function} callback - 回调函数
 */

/**
 * 计算阶层单人每日需求成本
 * @param {string} stratumKey - 阶层键
 * @param {Object} marketPrices - 市场价格
 */
function calculateDailyNeedsCost(stratumKey, marketPrices = {}) {
    const stratum = STRATA[stratumKey];
    if (!stratum || !stratum.needs) return 0;

    let dailyCost = 0;
    // 遍历基础需求
    for (const [resource, amount] of Object.entries(stratum.needs)) {
        const price = marketPrices[resource] || 1; // 默认价格为1
        dailyCost += amount * price;
    }
    
    // 简单的保底，避免成本过低
    return Math.max(0.5, dailyCost);
}

/**
 * 创建叛乱思潮事件
 * @param {string} stratumKey - 阶层键
 * @param {Object} rebellionState - 叛乱状态
 * @param {boolean} hasMilitary - 玩家是否有军队
 * @param {boolean} isMilitaryRebelling - 军队自身是否在叛乱
 * @param {number} currentWealth - 当前银币（用于旧版兼容，新版主要用pop和market计算）
 * @param {Function} callback - 回调函数
 * @param {number} stratumPopulation - 阶层人口（新版参数）
 * @param {Object} marketPrices - 市场价格（新版参数）
 */
export function createBrewingEvent(stratumKey, rebellionState, hasMilitary, isMilitaryRebelling, currentWealth = 0, callback, stratumPopulation = 100, marketPrices = {}) {
    const stratumName = getStratumName(stratumKey);
    const options = [];

    // 计算动态成本 (Needs-Based)
    // 补贴：提供30天的生活保障
    const dailyCost = calculateDailyNeedsCost(stratumKey, marketPrices);
    const population = Math.max(10, stratumPopulation); // 保底人口防止为0
    const subsidyCost = Math.ceil(population * dailyCost * 30);

    options.push({
        id: 'subsidize',
        text: '发放临时补贴',
        description: `消耗 ${subsidyCost} 银币向${stratumName}发放补贴（约30天生活费），提升满意度`,
        effects: {
            resources: { silver: -subsidyCost },
            classWealth: { [stratumKey]: subsidyCost },
            approval: { [stratumKey]: 15 },
            stability: 3,
        },
    });

    // 选项2：公开表态支持（无成本，小幅提升满意度，但可能得罪对立阶层）
    options.push({
        id: 'public_statement',
        text: '公开表态关注',
        description: `发表声明表示将重视${stratumName}的诉求，但可能引起其他阶层不满`,
        effects: {
            approval: { [stratumKey]: 8 },
            stability: -2,
        },
    });

    // 选项3：加强监视（无成本但可能恶化关系）
    options.push({
        id: 'surveillance',
        text: '加强监视',
        description: '派密探监视不满分子的动向，但如被发现会激化矛盾',
        effects: {
            approval: { [stratumKey]: -5 },
            stability: 5,
        },
        randomEffects: [
            {
                chance: 0.3,
                description: '监视行动被发现',
                effects: {
                    approval: { [stratumKey]: -15 },
                    stability: -8,
                },
            },
        ],
    });

    // 选项4：暂时观望（无效果）
    options.push({
        id: 'ignore',
        text: '暂时观望',
        description: '不采取任何行动，继续观察局势发展',
        effects: {},
    });

    return {
        id: `rebellion_brewing_${stratumKey}_${Date.now()}`,
        name: `${stratumName}阶层出现不满`,
        icon: 'AlertTriangle',
        image: null,
        description: `密探来报：${stratumName}阶层近来对朝廷颇有微词，私下议论纷纷。这种不满情绪正在蔓延，如不加以重视，可能会演变成更严重的问题。\n\n当前该阶层组织度已达30%，影响力占比${(rebellionState.influenceShare * 100).toFixed(1)}%。\n\n💡提示：可在阶层详情面板中使用策略行动进行长期应对。`,
        isRebellionEvent: true,
        rebellionPhase: REBELLION_PHASE.BREWING,
        rebellionStratum: stratumKey,
        options,
    };
}

/**
 * 创建密谋叛乱事件（70%阈值）
 */
export function createPlottingEvent(stratumKey, rebellionState, hasMilitary, isMilitaryRebelling, currentWealth = 0, callback, stratumPopulation = 100, marketPrices = {}) {
    const stratumName = getStratumName(stratumKey);
    const options = [];

    // 计算动态成本 (Needs-Based)
    const dailyCost = calculateDailyNeedsCost(stratumKey, marketPrices);
    const population = Math.max(10, stratumPopulation);
    
    // 重大让步：180天生活费
    const concessionCost = Math.ceil(population * dailyCost * 180);
    
    // 谈判：60天生活费（作为行政/活动经费）
    const negotiateCost = Math.ceil(population * dailyCost * 60);

    // 选项1：大规模让利（高成本，显著提升满意度）
    options.push({
        id: 'major_concession',
        text: '重大让步',
        description: `消耗 ${concessionCost} 银币向${stratumName}做出实质性让步（约半年生活费），大幅提升满意度`,
        effects: {
            resources: { silver: -concessionCost },
            classWealth: { [stratumKey]: concessionCost },
            approval: { [stratumKey]: 30 },
            stability: 10,
        },
    });

    // 选项2：对话谈判（中等成本）
    options.push({
        id: 'negotiate',
        text: '开启对话',
        description: `花费 ${negotiateCost} 银币派代表与${stratumName}领袖进行对话（约60天生活费），寻求缓和`,
        effects: {
            resources: { silver: -negotiateCost },
            classWealth: { [stratumKey]: negotiateCost },
            approval: { [stratumKey]: 15 },
            stability: 3,
        },
    });

    // 选项3：如果有军队，可以威慑
    if (hasMilitary && !isMilitaryRebelling) {
        options.push({
            id: 'show_force',
            text: '展示武力威慑',
            description: '调动军队进行演习，威慑不满分子',
            effects: {
                approval: { [stratumKey]: -10, soldier: 5 },
                stability: 8,
            },
            randomEffects: [
                {
                    chance: 0.25,
                    description: '威慑适得其反',
                    effects: {
                        approval: { [stratumKey]: -20 },
                        stability: -15,
                    },
                },
            ],
        });
    }

    // 选项4：尝试分化
    options.push({
        id: 'divide',
        text: '分化瓦解',
        description: '散布谣言制造内部矛盾，成功率不高但无直接成本',
        effects: {
            stability: -3,
        },
        randomEffects: [
            {
                chance: 0.4,
                description: '分化成功',
                effects: {
                    approval: { [stratumKey]: 10 },
                    stability: 5,
                },
            },
            {
                chance: 0.3,
                description: '阴谋被识破',
                effects: {
                    approval: { [stratumKey]: -20 },
                    stability: -10,
                },
            },
        ],
    });

    // 选项5：静观其变
    options.push({
        id: 'ignore',
        text: '静观其变',
        description: '冒险不采取行动，但叛乱可能很快爆发',
        effects: {
            stability: -5,
        },
    });

    return {
        id: `rebellion_plotting_${stratumKey}_${Date.now()}`,
        name: `${stratumName}阶层密谋起事！`,
        icon: 'Flame',
        image: null,
        description: `密探紧急来报：${stratumName}阶层的不满者已组织起来，正在秘密策划行动！他们已推选出领袖，正在联络同党。形势危急！\n\n当前该阶层组织度已达70%，影响力占比${(rebellionState.influenceShare * 100).toFixed(1)}%。\n\n⚠️警告：如不尽快处理，叛乱即将爆发！\n💡提示：可在阶层详情面板中使用策略行动进行应对。`,
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
            description: `出动忠诚军队迅速扑灭叛乱：成功时可重创叛军并压低组织度，失败则军队折损、局势更加动荡`,
            effects: {
                stability: -5,
                approval: { [stratumKey]: -10 },
            },
            callback: () => callback('suppress', stratumKey),
        });
    }

    options.push({
        id: 'accept_war',
        text: '应战',
        description: `承认叛军为敌对势力，放弃短期内快速镇压，转为通过一场全面内战来解决问题`,
        effects: {
            stability: -3,
        },
        callback: () => callback('accept_war', stratumKey, rebelNation),
    });

    return {
        id: `rebellion_active_${stratumKey}_${Date.now()}`,
        name: `${stratumName}阶层发动叛乱！`,
        icon: 'Skull',
        image: null,
        description: `最坏的情况发生了！${stratumName}阶层已经公开举起反旗，宣布成立"${rebelNation.name}"，不再服从你的治理！\n\n叛军已经控制了相当一部分领土和资源，你的${stratumName}人口已经加入叛军阵营。这是一场生死存亡的较量，你必须做出抉择！\n\n叛军实力：约${rebelNation.population}人\n叛军财富：${rebelNation.wealth}银币`,
        isRebellionEvent: true,
        rebellionPhase: REBELLION_PHASE.ACTIVE,
        rebellionStratum: stratumKey,
        options,
    };
}

/**
 * 创建官僚政变事件
 */
export function createOfficialCoupEvent(official, hasMilitary, isMilitaryRebelling, rebelNation, callback) {
    const options = [];

    if (hasMilitary && !isMilitaryRebelling) {
        options.push({
            id: 'suppress',
            text: '立即镇压',
            description: `出动忠诚军队粉碎官僚政变：成功可重创叛军并压低组织度，失败则军队折损、局势更糟`,
            effects: {
                stability: -6,
                approval: { official: -15 },
            },
            callback: () => callback('suppress', 'official'),
        });
    }

    options.push({
        id: 'accept_war',
        text: '应战',
        description: `承认叛军为敌对势力，转为通过全面内战解决政变危机`,
        effects: {
            stability: -4,
        },
        callback: () => callback('accept_war', 'official', rebelNation),
    });

    return {
        id: `bureaucratic_coup_${official?.id || 'official'}_${Date.now()}`,
        name: `${official?.name || '官僚集团'}发动政变！`,
        icon: 'Skull',
        image: null,
        description: `官僚体系发生剧烈动荡！${official?.name || '一名官员'}携带其资产叛逃，宣布成立"${rebelNation.name}"，并带走其控制的产业与人员。\n\n叛军实力：约${rebelNation.population}人\n叛军财富：${rebelNation.wealth}银币`,
        isRebellionEvent: true,
        rebellionPhase: REBELLION_PHASE.ACTIVE,
        rebellionStratum: 'official',
        options,
    };
}

/**
 * 创建官僚政变政府国家对象
 */
export function createOfficialCoupNation(official, assets = {}, rebelPopulation = 0) {
    const rebelId = `bureaucratic_coup_${official?.id || 'official'}_${Date.now()}`;
    const baseWealth = Math.floor((official?.wealth || 0) + (assets.propertyValue || 0));
    const wealth = Math.max(REBELLION_CONFIG.REBEL_NATION_BASE_WEALTH, baseWealth);
    const population = Math.max(10, Math.floor(rebelPopulation || 0));
    const militaryStrength = Math.min(1.6, 0.6 + Math.log10(wealth + 1) * 0.15);

    return {
        id: rebelId,
        name: `${official?.name || '官僚'}政变政府`,
        desc: `由官僚体系分裂而成的叛乱政府`,
        color: '#7a1111',
        icon: 'Flame',
        wealth,
        population,
        aggression: REBELLION_CONFIG.REBEL_NATION_BASE_AGGRESSION,
        relation: 0,
        isAtWar: true,
        warScore: 0,
        militaryStrength,
        isRebelNation: true,
        rebellionStratum: 'official',
        visible: true,
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
        warStartDay: 0,
        foreignWars: {},
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
 * @param {string} stratumKey - 阶层键
 * @param {number} stratumPop - 阶层人口
 * @param {number} stratumWealth - 阶层财富
 * @param {number} stratumInfluence - 阶层影响力占比 (0-1)
 * @param {number|null} rebelPopulationOverride - 可选的叛军人口覆盖值
 * @param {Object} resourceLoot - 可选的资源掠夺数据 { resources: {}, marketPrices: {} }
 */
export function createRebelNation(stratumKey, stratumPop, stratumWealth, stratumInfluence, rebelPopulationOverride = null, resourceLoot = null) {
    const stratumName = getStratumName(stratumKey);
    const rebelId = `rebel_${stratumKey}_${Date.now()}`;

    // 叛军实力基于该阶层的人口、财富和影响力（默认带走80%，可使用覆盖值）
    const population = rebelPopulationOverride ?? Math.max(10, Math.floor(stratumPop * 0.8));

    // 基础财富：阶层财富的50%
    let baseWealth = Math.floor(stratumWealth * 0.5);

    // 资源掠夺：按影响力占比从国内市场掠夺资源并折算成财富
    let lootedResourcesValue = 0;
    const lootedResources = {};

    if (resourceLoot && resourceLoot.resources && resourceLoot.marketPrices) {
        const { resources, marketPrices } = resourceLoot;
        // 按影响力占比掠夺资源（最高30%的资源，受影响力影响）
        const lootRatio = Math.min(0.3, stratumInfluence * 0.5); // 影响力50%时掠夺15%资源

        Object.keys(resources).forEach(resKey => {
            // 跳过虚拟资源和银币
            if (resKey === 'silver' || resKey === 'science' || resKey === 'culture') return;
            const amount = resources[resKey] || 0;
            if (amount <= 0) return;

            const lootAmount = Math.floor(amount * lootRatio);
            if (lootAmount > 0) {
                const price = marketPrices[resKey] || 1;
                lootedResourcesValue += lootAmount * price;
                lootedResources[resKey] = lootAmount;
            }
        });
    }

    // 最终财富 = 基础财富 + 掠夺资源价值，至少为基础值300
    const wealth = Math.max(REBELLION_CONFIG.REBEL_NATION_BASE_WEALTH, baseWealth + lootedResourcesValue);

    const rebelNationData = {
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
        warStartDay: 0, // 初始化为0，会在添加到nations时由useGameLoop设置为当前tick
        foreignWars: {},
    };

    // 返回叛军政府和被掠夺的资源信息
    return {
        nation: rebelNationData,
        lootedResources, // 被掠夺的资源 { resourceKey: amount }
        lootedValue: lootedResourcesValue, // 被掠夺资源的总价值
    };
}

/**
 * 创建叛乱结束（停战后清理）事件
 */
export function createRebellionEndEvent(rebelNation, victory, currentWealth = 0, callback) {
    const isPlayerVictory = victory;

    if (isPlayerVictory) {
        // 庆祝成本：5% 当前银币，最低 200
        const celebrateCost = Math.max(200, Math.floor(currentWealth * 0.05));

        return {
            id: `rebellion_end_victory_${Date.now()}`,
            name: `叛乱平定`,
            icon: 'Trophy',
            description: `经过艰苦的战斗，${rebelNation.name}终于被彻底击败！叛军残余或被消灭，或已投降。国家重归统一，但战争的创伤需要时间来愈合。\n\n被叛军占领的人口将逐渐回归，但他们可能需要一段时间才能恢复对朝廷的信任。`,
            isRebellionEvent: true,
            options: [{
                id: 'celebrate',
                text: '庆祝胜利',
                description: `花费 ${celebrateCost} 银币举行盛大庆典，大幅提振民心士气`,
                effects: {
                    stability: 15,
                    resources: { silver: -celebrateCost, culture: 80 },
                },
                callback: () => callback('end_celebrate', rebelNation),
            }, {
                id: 'rebuild',
                text: '着手重建',
                description: '低调处理，缴获叛军财物，专注恢复生产',
                effects: {
                    stability: 8,
                    resources: { silver: 150 },
                    buildingProductionMod: { all: 0.1 }, // 全局建筑产出+10%
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
                description: '水能载舟，亦能覆舟……',
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
    createOfficialCoupEvent,
    createOfficialCoupNation,
    createInvestigationResultEvent,
    createArrestResultEvent,
    createSuppressionResultEvent,
    createRebelNation,
    createRebellionEndEvent,
};
