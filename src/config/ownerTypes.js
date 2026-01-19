/**
 * 建筑业主类型配置
 * 用于统一管理建筑的所有权类型
 */

/**
 * 业主类型枚举
 */
export const OWNER_TYPES = {
    STRATUM: 'stratum',    // 本国阶层业主（提供业主岗位）
    OFFICIAL: 'official',  // 官员私产（不提供业主岗位）
    FOREIGN: 'foreign',    // 外资（不提供业主岗位）
    STATE: 'state',        // 国有（不提供业主岗位）
};

/**
 * 业主类型显示名称
 */
export const OWNER_TYPE_LABELS = {
    [OWNER_TYPES.STRATUM]: '本国人民',
    [OWNER_TYPES.OFFICIAL]: '官员私产',
    [OWNER_TYPES.FOREIGN]: '外国资本',
    [OWNER_TYPES.STATE]: '国有企业',
};

/**
 * 判断业主类型是否提供业主岗位
 * 只有本国阶层业主才提供业主岗位
 * @param {string} ownerType - 业主类型
 * @returns {boolean} 是否提供业主岗位
 */
export function providesOwnerJobs(ownerType) {
    return ownerType === OWNER_TYPES.STRATUM;
}

/**
 * 从业主实例列表中计算实际提供的岗位
 * @param {Object} building - 建筑配置（包含 owner 和 jobs）
 * @param {Array} ownershipList - 该建筑的业主实例列表
 * @returns {Object} 实际岗位数 { role: count }
 */
export function calculateEffectiveJobs(building, ownershipList) {
    if (!building || !building.jobs) return {};
    
    const ownerRole = building.owner;
    const baseJobs = building.jobs || {};
    
    // 统计各类型业主的建筑数量
    let stratumCount = 0;
    let nonStratumCount = 0;
    
    (ownershipList || []).forEach(ownership => {
        const count = ownership.count || 0;
        if (providesOwnerJobs(ownership.ownerType)) {
            stratumCount += count;
        } else {
            nonStratumCount += count;
        }
    });
    
    const totalCount = stratumCount + nonStratumCount;
    const effectiveJobs = {};
    
    Object.entries(baseJobs).forEach(([role, slotsPerBuilding]) => {
        if (role === ownerRole) {
            // 业主岗位：只有阶层业主才提供，非阶层业主完全不提供
            effectiveJobs[role] = stratumCount * slotsPerBuilding;
        } else {
            // 非业主岗位：所有建筑都正常提供
            effectiveJobs[role] = totalCount * slotsPerBuilding;
        }
    });
    
    return effectiveJobs;
}

/**
 * 从现有数据结构构建业主实例列表
 * 用于向后兼容，从分散的数据源聚合业主信息
 * @param {string} buildingId - 建筑ID
 * @param {number} totalCount - 建筑总数
 * @param {Array} officials - 官员列表
 * @param {Array} foreignInvestments - 外资投资列表
 * @param {Object} building - 建筑配置（用于获取业主阶层）
 * @returns {Array} 业主实例列表
 */
export function buildOwnershipListFromLegacy(buildingId, totalCount, officials, foreignInvestments, building) {
    const ownershipList = [];
    
    // 1. 统计官员私产数量
    let officialCount = 0;
    const officialOwners = {}; // { officialId: count }
    (officials || []).forEach(official => {
        (official.ownedProperties || []).forEach(prop => {
            if (prop.buildingId === buildingId) {
                officialCount += 1;
                const ownerId = official.id || official.name || 'unknown';
                officialOwners[ownerId] = (officialOwners[ownerId] || 0) + 1;
            }
        });
    });
    
    if (officialCount > 0) {
        ownershipList.push({
            ownerType: OWNER_TYPES.OFFICIAL,
            count: officialCount,
            details: officialOwners, // 详细信息：哪个官员持有多少
        });
    }
    
    // 2. 统计外资数量
    let foreignCount = 0;
    const foreignOwners = {}; // { nationId: count }
    (foreignInvestments || []).forEach(inv => {
        if (inv.buildingId === buildingId && inv.status === 'operating') {
            foreignCount += 1;
            const nationId = inv.ownerNationId || 'unknown';
            foreignOwners[nationId] = (foreignOwners[nationId] || 0) + 1;
        }
    });
    
    if (foreignCount > 0) {
        ownershipList.push({
            ownerType: OWNER_TYPES.FOREIGN,
            count: foreignCount,
            details: foreignOwners, // 详细信息：哪个国家持有多少
        });
    }
    
    // 3. 剩余为阶层业主
    const stratumCount = Math.max(0, totalCount - officialCount - foreignCount);
    if (stratumCount > 0) {
        ownershipList.push({
            ownerType: OWNER_TYPES.STRATUM,
            count: stratumCount,
            ownerStratum: building?.owner || null, // 业主阶层
        });
    }
    
    return ownershipList;
}

/**
 * 获取业主类型的图标
 * @param {string} ownerType - 业主类型
 * @returns {string} 图标名称
 */
export function getOwnerTypeIcon(ownerType) {
    switch (ownerType) {
        case OWNER_TYPES.STRATUM:
            return 'User';
        case OWNER_TYPES.OFFICIAL:
            return 'Shield';
        case OWNER_TYPES.FOREIGN:
            return 'Globe';
        case OWNER_TYPES.STATE:
            return 'Building2';
        default:
            return 'User';
    }
}

/**
 * 获取业主类型的颜色样式
 * @param {string} ownerType - 业主类型
 * @returns {Object} { bg, border, text } CSS类名
 */
export function getOwnerTypeColors(ownerType) {
    switch (ownerType) {
        case OWNER_TYPES.STRATUM:
            return {
                bg: 'bg-yellow-900/30',
                border: 'border-yellow-700/40',
                text: 'text-yellow-200',
            };
        case OWNER_TYPES.OFFICIAL:
            return {
                bg: 'bg-emerald-900/30',
                border: 'border-emerald-700/40',
                text: 'text-emerald-200',
            };
        case OWNER_TYPES.FOREIGN:
            return {
                bg: 'bg-amber-900/30',
                border: 'border-amber-700/40',
                text: 'text-amber-200',
            };
        case OWNER_TYPES.STATE:
            return {
                bg: 'bg-blue-900/30',
                border: 'border-blue-700/40',
                text: 'text-blue-200',
            };
        default:
            return {
                bg: 'bg-gray-900/30',
                border: 'border-gray-700/40',
                text: 'text-gray-200',
            };
    }
}
