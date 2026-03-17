/**
 * 理念涌现抽取与三选一机制
 * 使用加权随机算法从可用理念池中抽取3个候选理念
 */

import { IDEOLOGIES, IDEOLOGY_MAP } from '../../config/ideologies';

/**
 * 从可用理念池中加权随机抽取3个候选理念
 * @param {Object} gameState - 游戏状态
 * @param {Array} ideologyCollection - 已拥有的理念库 [{ id, level }]
 * @param {number} rarityBonus - 跳过累积的稀有度加成（0~3，每次跳过+1）
 * @returns {Array} 3个候选理念对象 [{ ...ideologyConfig, isUpgrade: boolean, currentLevel: number }]
 */
export function generateEmergenceCandidates(gameState, ideologyCollection = [], rarityBonus = 0) {
    const { epoch = 0, techsUnlocked = [], rulingCoalition = [] } = gameState;

    // 构建已拥有理念的等级映射
    const ownedMap = {};
    for (const entry of ideologyCollection) {
        ownedMap[entry.id] = entry.level || 1;
    }

    // 过滤可用理念池（排除已满级的）
    const availablePool = IDEOLOGIES.filter(ideology => {
        // 时代限制
        if (ideology.unlockEpoch > epoch) return false;
        // 已满级（3级）排除
        if (ownedMap[ideology.id] >= 3) return false;
        return true;
    });

    // 如果池子不足3个，返回所有可用的
    if (availablePool.length === 0) return [];
    if (availablePool.length <= 3) {
        return availablePool.map(ideology => _enrichCandidate(ideology, ownedMap));
    }

    // 计算每个理念的权重
    const weightedPool = availablePool.map(ideology => {
        let weight = 10; // 基础权重

        // 稀有度调整
        if (ideology.rarity === 'legendary') weight *= 0.25;
        else if (ideology.rarity === 'rare') weight *= 0.5;
        else if (ideology.rarity === 'uncommon') weight *= 0.75;

        // 跳过累积的稀有度加成：每次跳过提升高稀有度理念的权重
        // rarityBonus 上限为3，legendary最多提升到与common相当（0.25 * 4 = 1.0）
        if (rarityBonus > 0) {
            const bonus = Math.min(rarityBonus, 3);
            if (ideology.rarity === 'legendary') weight *= (1 + bonus * 1.25); // 最多 *4.75
            else if (ideology.rarity === 'rare')  weight *= (1 + bonus * 0.5);  // 最多 *2.5
            else if (ideology.rarity === 'uncommon') weight *= (1 + bonus * 0.2); // 最多 *1.6
        }

        // 时代匹配加成
        if (ideology.unlockEpoch === epoch) weight *= 2.0;
        else if (ideology.unlockEpoch === epoch - 1) weight *= 1.3;

        // 阶层关联（执政联盟相关）
        if (rulingCoalition && rulingCoalition.length > 0) {
            // 军事类理念在有军人联盟时加权
            if (ideology.category === 'military' && rulingCoalition.includes('soldier')) weight *= 1.3;
            if (ideology.category === 'economy' && rulingCoalition.includes('merchant')) weight *= 1.3;
            if (ideology.category === 'social' && rulingCoalition.includes('worker')) weight *= 1.3;
        }

        // weightModifiers 中的条件检查
        if (ideology.weightModifiers) {
            for (const mod of ideology.weightModifiers) {
                if (_checkWeightCondition(mod.condition, gameState)) {
                    weight *= mod.multiplier;
                }
            }
        }

        // 已拥有但未满级的理念有适度权重（鼓励强化但不过度）
        if (ownedMap[ideology.id]) {
            weight *= 0.8;
        }

        return { ideology, weight: Math.max(weight, 0.1) };
    });

    // 加权随机抽取3个（不重复）
    const selected = [];
    const pool = [...weightedPool];

    for (let i = 0; i < 3 && pool.length > 0; i++) {
        const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
        let rand = Math.random() * totalWeight;
        let selectedIndex = 0;

        for (let j = 0; j < pool.length; j++) {
            rand -= pool[j].weight;
            if (rand <= 0) {
                selectedIndex = j;
                break;
            }
        }

        selected.push(pool[selectedIndex].ideology);
        pool.splice(selectedIndex, 1);
    }

    // 保证至少1个可选（未拥有或未满级）
    const hasSelectable = selected.some(s => !ownedMap[s.id] || ownedMap[s.id] < 3);
    if (!hasSelectable && availablePool.length > selected.length) {
        // 强制替换第一个为可选的
        const replacement = availablePool.find(a => !selected.includes(a) && (!ownedMap[a.id] || ownedMap[a.id] < 3));
        if (replacement) selected[0] = replacement;
    }

    return selected.map(ideology => _enrichCandidate(ideology, ownedMap));
}

/**
 * 处理玩家选择：新增或升级理念
 * @param {string} ideologyId - 选择的理念ID
 * @param {Array} ideologyCollection - 当前理念库
 * @returns {{ updatedCollection: Array, isUpgrade: boolean, newLevel: number }}
 */
export function selectIdeology(ideologyId, ideologyCollection = []) {
    const existing = ideologyCollection.find(entry => entry.id === ideologyId);

    if (existing) {
        // 升级现有理念（最高3级）
        const newLevel = Math.min((existing.level || 1) + 1, 3);
        const updatedCollection = ideologyCollection.map(entry =>
            entry.id === ideologyId ? { ...entry, level: newLevel } : entry
        );
        return { updatedCollection, isUpgrade: true, newLevel };
    } else {
        // 新增理念
        const updatedCollection = [...ideologyCollection, { id: ideologyId, level: 1 }];
        return { updatedCollection, isUpgrade: false, newLevel: 1 };
    }
}

/**
 * 检查权重条件
 */
function _checkWeightCondition(condition, gameState) {
    if (!condition) return false;

    // 阶层人口条件
    if (condition.stratum && condition.minPop) {
        const pop = gameState.popStructure?.[condition.stratum] || 0;
        return pop >= condition.minPop;
    }

    // 最低科技数条件
    if (condition.minTechs) {
        return (gameState.techsUnlocked?.length || 0) >= condition.minTechs;
    }

    // 最低时代条件
    if (condition.minEpoch) {
        return (gameState.epoch || 0) >= condition.minEpoch;
    }

    // 低稳定度条件
    if (condition.stabilityBelow) {
        const stability = gameState.stability || gameState.currentStability || 50;
        return stability < condition.stabilityBelow;
    }

    // 近期战争条件
    if (condition.recentWar !== undefined) {
        // TODO: 接入战争状态检查
        return false;
    }

    return false;
}

/**
 * 丰富候选理念信息（标记是否为升级选项）
 */
function _enrichCandidate(ideology, ownedMap) {
    const currentLevel = ownedMap[ideology.id] || 0;
    return {
        ...ideology,
        isUpgrade: currentLevel > 0,
        currentLevel,
        nextLevel: currentLevel > 0 ? Math.min(currentLevel + 1, 3) : 1,
    };
}
