/**
 * 渐进式国家发现系统
 * 控制时代升级时的部分解锁和后续逐步发现机制
 */

import { DISCOVERY_CONFIG } from '../../config/gameConstants.js';

/**
 * 时代升级时随机部分解锁国家
 * @param {Object} params
 * @param {Array} params.nations - 所有国家数组（可变）
 * @param {number} params.newEpoch - 新时代ID
 * @param {Array} params.logs - 日志数组
 * @param {string} [params.discoverer='player'] - 发现者ID（'player' 或 AI 国家 ID）
 * @returns {{ discoveredNations: Array }} 新发现的国家列表
 */
export const discoverNationsOnEpochChange = ({
    nations,
    newEpoch,
    logs = [],
    discoverer = 'player',
}) => {
    const config = DISCOVERY_CONFIG;
    const discoveredNations = [];

    // 筛选该时代可解锁但尚未被发现者发现的国家
    const undiscoveredPool = nations.filter(n => {
        const appearEpoch = n.appearEpoch ?? 0;
        if (appearEpoch !== newEpoch) return false;
        if (n.isAnnexed || n.isDefeated) return false;
        // Safety: skip nations with zero population (destroyed)
        if ((n.population || 0) <= 0) return false;

        if (discoverer === 'player') {
            return n.discovered !== true;
        } else {
            // AI 发现者：检查该 AI 是否已发现此国家
            const foreignDiscovery = n._discoveredBy || {};
            return !foreignDiscovery[discoverer];
        }
    });

    if (undiscoveredPool.length === 0) return { discoveredNations };

    // alwaysDiscover 标记的国家必定解锁
    const alwaysDiscoverNations = undiscoveredPool.filter(n => n.alwaysDiscover === true);
    const normalPool = undiscoveredPool.filter(n => n.alwaysDiscover !== true);

    // 计算解锁数量
    const targetCount = Math.max(
        config.MIN_UNLOCK_COUNT,
        Math.min(
            config.MAX_UNLOCK_COUNT,
            Math.ceil(normalPool.length * config.EPOCH_UNLOCK_RATIO)
        )
    );

    let toDiscover;
    if (normalPool.length <= config.MIN_UNLOCK_COUNT) {
        // 可解锁数 ≤ 最小解锁数，全部解锁
        toDiscover = [...normalPool];
    } else {
        // 随机选取
        const shuffled = [...normalPool].sort(() => Math.random() - 0.5);
        toDiscover = shuffled.slice(0, targetCount);
    }

    // 合并必定解锁的国家（去重）
    const toDiscoverIds = new Set(toDiscover.map(n => n.id));
    alwaysDiscoverNations.forEach(n => {
        if (!toDiscoverIds.has(n.id)) {
            toDiscover.push(n);
        }
    });

    // 标记为已发现
    toDiscover.forEach(nation => {
        if (discoverer === 'player') {
            nation.discovered = true;
            discoveredNations.push(nation);
            logs.push(`🌍 我们的探险家发现了新的文明：${nation.name}！`);
        } else {
            if (!nation._discoveredBy) nation._discoveredBy = {};
            nation._discoveredBy[discoverer] = true;
            discoveredNations.push(nation);
        }
    });

    return { discoveredNations };
};

/**
 * 逐步发现机制（tick 驱动）
 * 每隔一定 tick 间隔，以概率从未发现国家池中发现一个新国家
 * @param {Object} params
 * @param {Array} params.nations - 所有国家数组（可变）
 * @param {number} params.tick - 当前 tick
 * @param {number} params.epoch - 当前时代
 * @param {number} [params.navigatorPop=0] - 航海家阶层人口
 * @param {Array} params.logs - 日志数组
 * @returns {{ discoveredNation: Object|null }} 新发现的国家（如有）
 */
export const processGradualDiscovery = ({
    nations,
    tick,
    epoch,
    navigatorPop = 0,
    logs = [],
}) => {
    const config = DISCOVERY_CONFIG;

    // 检查 tick 间隔
    if (tick % config.GRADUAL_DISCOVERY_TICK_INTERVAL !== 0) {
        return { discoveredNation: null };
    }

    // 筛选当前时代及之前时代中尚未被玩家发现的国家
    const undiscoveredPool = nations.filter(n => {
        const appearEpoch = n.appearEpoch ?? 0;
        if (appearEpoch > epoch) return false; // 未来时代的国家不可发现
        if (n.expireEpoch != null && epoch > n.expireEpoch) return false;
        if (n.isAnnexed || n.isDefeated) return false;
        // Safety: skip nations with zero population (destroyed)
        if ((n.population || 0) <= 0) return false;
        return n.discovered !== true;
    });

    if (undiscoveredPool.length === 0) {
        return { discoveredNation: null };
    }

    // 计算发现概率
    let chance = config.BASE_DISCOVERY_CHANCE;

    // 航海家人口加成
    if (navigatorPop > 0) {
        const navigatorBonus = Math.min(
            config.NAVIGATOR_BONUS_CAP,
            (navigatorPop / 100) * config.NAVIGATOR_POP_BONUS_PER_100
        );
        chance += navigatorBonus;
    }

    // 时代加成
    chance += epoch * config.EPOCH_DISCOVERY_BONUS;

    // 探索时代（Epoch 4）及以上额外加成
    if (epoch >= 4) {
        chance += config.EXPLORATION_ERA_BONUS;
    }

    // 概率检查
    if (Math.random() >= chance) {
        return { discoveredNation: null };
    }

    // 随机选择一个国家发现
    const chosen = undiscoveredPool[Math.floor(Math.random() * undiscoveredPool.length)];
    chosen.discovered = true;

    logs.push(`🌍 探险家发现了新的文明：${chosen.name}！`);

    return { discoveredNation: chosen };
};

/**
 * AI 国家间的逐步发现（每 tick 调用）
 * @param {Object} params
 * @param {Object} params.nation - AI 国家对象（可变）
 * @param {Array} params.allNations - 所有国家数组
 * @param {number} params.tick - 当前 tick
 * @param {number} params.epoch - 全局可见时代
 */
export const processAINationDiscovery = ({
    nation,
    allNations,
    tick,
    epoch,
}) => {
    const config = DISCOVERY_CONFIG;

    // 每隔一定 tick 检查
    if (tick % config.GRADUAL_DISCOVERY_TICK_INTERVAL !== 0) return;

    const nationEpoch = nation.epoch ?? (nation.appearEpoch ?? 0);
    if (!nation._discoveredBy) nation._discoveredBy = {};

    // 筛选该 AI 尚未发现的国家
    const undiscovered = allNations.filter(other => {
        if (other.id === nation.id) return false;
        if (other.isAnnexed || other.isDefeated) return false;
        // Safety: skip nations with zero population (destroyed)
        if ((other.population || 0) <= 0) return false;
        const otherAppearEpoch = other.appearEpoch ?? 0;
        if (otherAppearEpoch > epoch) return false;
        if (other.expireEpoch != null && epoch > other.expireEpoch) return false;
        return !nation._discoveredBy[other.id];
    });

    if (undiscovered.length === 0) return;

    let chance = config.AI_DISCOVERY_CHANCE_BASE;

    // 相邻时代加成
    undiscovered.forEach(other => {
        const otherEpoch = other.epoch ?? (other.appearEpoch ?? 0);
        const epochDiff = Math.abs(nationEpoch - otherEpoch);
        let localChance = chance;
        if (epochDiff <= 1) {
            localChance += config.AI_ADJACENT_EPOCH_BONUS;
        }

        if (Math.random() < localChance) {
            nation._discoveredBy[other.id] = true;
            // 双向发现
            if (!other._discoveredBy) other._discoveredBy = {};
            other._discoveredBy[nation.id] = true;
        }
    });
};

/**
 * 战争触发自动发现（AI 之间或 AI 与玩家之间）
 * @param {Object} attacker - 攻击方国家对象
 * @param {Object} defender - 防守方国家对象
 */
export const discoverOnWar = (attacker, defender) => {
    // 玩家发现
    if (attacker.id === 'player' || defender.id === 'player') {
        const aiNation = attacker.id === 'player' ? defender : attacker;
        aiNation.discovered = true;
    }

    // AI 之间互相发现
    if (!attacker._discoveredBy) attacker._discoveredBy = {};
    if (!defender._discoveredBy) defender._discoveredBy = {};
    attacker._discoveredBy[defender.id] = true;
    defender._discoveredBy[attacker.id] = true;
};

/**
 * 获取当前时代未发现国家数量（用于 UI 提示）
 * @param {Array} nations - 所有国家数组
 * @param {number} epoch - 当前时代
 * @returns {number} 未发现国家数量
 */
export const getUndiscoveredCount = (nations, epoch) => {
    return nations.filter(n => {
        const appearEpoch = n.appearEpoch ?? 0;
        if (appearEpoch > epoch) return false;
        if (n.expireEpoch != null && epoch > n.expireEpoch) return false;
        if (n.isAnnexed || n.isDefeated) return false;
        if ((n.population || 0) <= 0) return false;
        return n.discovered !== true;
    }).length;
};
