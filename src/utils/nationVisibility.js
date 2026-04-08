/**
 * 统一的国家可见性工具函数
 * 封装 discovered + appearEpoch + expireEpoch + isAnnexed + 附庸豁免 等判断逻辑
 * 所有 UI 和逻辑层的可见性过滤统一调用此模块
 */

/**
 * 判断一个国家是否对玩家可见（已发现且在时代范围内）
 * @param {Object} nation - 国家对象
 * @param {number} epoch - 当前时代
 * @returns {boolean}
 */
export const isNationVisible = (nation, epoch) => {
    if (!nation) return false;
    if (nation.isAnnexed) return false;

    const appearEpoch = nation.appearEpoch ?? 0;
    const expireEpoch = nation.expireEpoch;

    // 时代范围检查
    if (epoch < appearEpoch) return false;
    if (expireEpoch != null && epoch > expireEpoch) return false;

    // 附庸豁免：玩家的附庸始终可见
    if (nation.vassalOf === 'player') return true;

    // 发现状态检查
    if (nation.discovered !== true) return false;

    // 显式隐藏标记
    if (nation.visible === false) return false;

    return true;
};

/**
 * 获取所有对玩家可见的国家列表
 * @param {Array} nations - 所有国家数组
 * @param {number} epoch - 当前时代
 * @returns {Array} 可见国家列表
 */
export const getVisibleNations = (nations, epoch) => {
    if (!Array.isArray(nations)) return [];
    return nations.filter(n => isNationVisible(n, epoch));
};

/**
 * 判断两个 AI 国家之间是否互相可见
 * @param {Object} nationA - 国家 A
 * @param {Object} nationB - 国家 B
 * @param {number} epoch - 当前时代
 * @returns {boolean}
 */
export const areNationsMutuallyVisible = (nationA, nationB, epoch) => {
    if (!nationA || !nationB) return false;
    if (nationA.isAnnexed || nationB.isAnnexed) return false;

    // 时代范围检查
    const aAppear = nationA.appearEpoch ?? 0;
    const bAppear = nationB.appearEpoch ?? 0;
    if (epoch < aAppear || epoch < bAppear) return false;
    if (nationA.expireEpoch != null && epoch > nationA.expireEpoch) return false;
    if (nationB.expireEpoch != null && epoch > nationB.expireEpoch) return false;

    // 互相发现检查
    const aDiscoveredB = nationA._discoveredBy?.[nationB.id] === true;
    const bDiscoveredA = nationB._discoveredBy?.[nationA.id] === true;

    return aDiscoveredB || bDiscoveredA;
};

/**
 * 判断一个国家是否已出现但尚未被玩家发现（用于后台最小化模拟）
 * @param {Object} nation - 国家对象
 * @param {number} epoch - 当前时代
 * @returns {boolean}
 */
export const isAppearedButUndiscovered = (nation, epoch) => {
    if (!nation) return false;
    if (nation.isAnnexed) return false;

    const appearEpoch = nation.appearEpoch ?? 0;
    if (epoch < appearEpoch) return false;
    if (nation.expireEpoch != null && epoch > nation.expireEpoch) return false;

    // 附庸始终视为已发现
    if (nation.vassalOf === 'player') return false;

    return nation.discovered !== true;
};
