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
 * 预解析事件中的随机国家选择器
 * 在事件生成时就确定具体是哪个随机国家，并存储到事件对象中
 * @param {Object} event - 事件对象
 * @param {Array} nations - 国家数组
 * @param {number} epoch - 当前时代 (可选，默认0)
 * @returns {Object} - 预解析后的事件对象（深拷贝）
 */
function resolveRandomNationInEvent(event, nations, epoch = 0) {
    if (!nations || nations.length === 0) return event;

    // 过滤可见且在当前时代存在的国家
    const visibleNations = nations.filter(n => {
        // 基础可见性检查
        if (n.visible === false) return false;

        // 时代检查
        const appearEpoch = n.appearEpoch ?? 0;
        const expireEpoch = n.expireEpoch;

        if (epoch < appearEpoch) return false;
        if (expireEpoch != null && epoch > expireEpoch) return false;

        return true;
    });

    if (visibleNations.length === 0) return event;

    // 深拷贝事件对象，避免修改原始配置
    const resolvedEvent = JSON.parse(JSON.stringify(event));

    // 为整个事件选择一个随机国家（同一事件中的 'random' 都指向同一个国家）
    const randomNation = visibleNations[Math.floor(Math.random() * visibleNations.length)];

    // 存储预解析的随机国家信息到事件对象中
    resolvedEvent._resolvedRandomNation = randomNation ? {
        id: randomNation.id,
        name: randomNation.name,
    } : null;

    // 遍历所有选项，替换 'random' 选择器为具体的国家ID
    if (resolvedEvent.options) {
        resolvedEvent.options = resolvedEvent.options.map(option => {
            const newOption = { ...option };
            if (newOption.effects) {
                newOption.effects = resolveRandomSelectorsInEffects(newOption.effects, randomNation);
            }
            if (newOption.randomEffects) {
                newOption.randomEffects = newOption.randomEffects.map(re => ({
                    ...re,
                    effects: resolveRandomSelectorsInEffects(re.effects, randomNation),
                }));
            }
            return newOption;
        });
    }

    return resolvedEvent;
}

/**
 * 替换效果对象中的 'random' 选择器为具体的国家ID
 */
function resolveRandomSelectorsInEffects(effects, randomNation) {
    if (!effects || !randomNation) return effects;

    const newEffects = { ...effects };

    // 处理外交效果中的 random 选择器
    const diplomaticKeys = ['nationRelation', 'nationAggression', 'nationWealth', 'nationMarketVolatility'];
    diplomaticKeys.forEach(key => {
        if (newEffects[key] && typeof newEffects[key] === 'object') {
            const newObj = { ...newEffects[key] };
            if ('random' in newObj) {
                newObj[randomNation.id] = newObj.random;
                newObj._originalRandom = randomNation.id; // 标记这是从random解析来的
                delete newObj.random;
            }
            newEffects[key] = newObj;
        }
    });

    // 处理 triggerWar 和 triggerPeace
    if (newEffects.triggerWar === 'random') {
        newEffects.triggerWar = randomNation.id;
        newEffects._triggerWarFromRandom = true;
    }
    if (newEffects.triggerPeace === 'random') {
        newEffects.triggerPeace = randomNation.id;
        newEffects._triggerPeaceFromRandom = true;
    }

    return newEffects;
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
    const selectedEvent = availableEvents[randomIndex];

    // 预解析随机国家，使同一事件中的所有 'random' 指向同一个国家
    const nations = gameState.nations || [];
    const epoch = gameState.epoch || 0;
    return resolveRandomNationInEvent(selectedEvent, nations, epoch);
}
