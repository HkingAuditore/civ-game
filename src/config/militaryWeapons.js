/**
 * 军事武器消耗配置
 * 定义各兵种招募和维护所需的武器资源
 * 
 * 武器类型按时代演进:
 * - Epoch 0-1: 使用 tools (工具)
 * - Epoch 2-4: 使用 weapons (兵器)
 * - Epoch 4+: 使用 gunpowder (火药) - 火器单位
 * - Epoch 5-6: 使用 firearms (枪炮) - 现代火器单位
 */

/**
 * 兵种招募时的武器消耗
 * 格式: { unitId: { resourceType: amount } }
 */
export const UNIT_WEAPON_RECRUIT_COST = {
    // ============ 石器-青铜时代 (Epoch 0-1) - 使用工具 ============
    militia: { tools: 5 },
    slinger: { tools: 3 },
    spearman: { tools: 10 },
    archer: { tools: 8 },
    chariot: { tools: 15 },

    // ============ 古典时代 (Epoch 2) - 使用兵器 ============
    hoplite: { weapons: 20 },
    composite_archer: { weapons: 15 },
    light_cavalry: { weapons: 25 },
    battering_ram: { weapons: 30 },

    // ============ 封建时代 (Epoch 3) - 使用兵器 ============
    heavy_infantry: { weapons: 25 },
    crossbowman: { weapons: 20 },
    knight: { weapons: 40 },
    trebuchet: { weapons: 35 },

    // ============ 探索时代 (Epoch 4) - 混合：兵器+火药 ============
    pikeman: { weapons: 20 },
    arquebus: { weapons: 15, gunpowder: 10 },
    cuirassier: { weapons: 35 },
    bombard: { weapons: 20, gunpowder: 25 },
    man_at_arms: { weapons: 30 },

    // ============ 启蒙时代 (Epoch 5) - 使用枪炮 ============
    musketeer: { firearms: 25 },
    dragoon: { firearms: 35 },
    field_cannon: { firearms: 50 },
    line_infantry: { firearms: 30 },

    // ============ 工业时代 (Epoch 6) - 使用枪炮 ============
    rifleman: { firearms: 35 },
    gatling: { firearms: 80, gunpowder: 30 },
    lancer: { firearms: 20, weapons: 15 },  // 骑兵仍使用部分冷兵器
    artillery: { firearms: 100, gunpowder: 40 },
    assault_infantry: { firearms: 45 },
};

/**
 * 兵种维护时的武器消耗 (每日每单位)
 * 格式: { unitId: { resourceType: dailyAmount } }
 */
export const UNIT_WEAPON_MAINTENANCE_COST = {
    // ============ 石器-青铜时代 - 工具维护 ============
    militia: { tools: 0.02 },
    slinger: { tools: 0.01 },
    spearman: { tools: 0.03 },
    archer: { tools: 0.02 },
    chariot: { tools: 0.05 },

    // ============ 古典时代 - 兵器维护 ============
    hoplite: { weapons: 0.05 },
    composite_archer: { weapons: 0.04 },
    light_cavalry: { weapons: 0.06 },
    battering_ram: { weapons: 0.08 },

    // ============ 封建时代 - 兵器维护 ============
    heavy_infantry: { weapons: 0.06 },
    crossbowman: { weapons: 0.05 },
    knight: { weapons: 0.10 },
    trebuchet: { weapons: 0.08 },

    // ============ 探索时代 - 混合维护 ============
    pikeman: { weapons: 0.05 },
    arquebus: { weapons: 0.03, gunpowder: 0.02 },
    cuirassier: { weapons: 0.08 },
    bombard: { weapons: 0.04, gunpowder: 0.06 },
    man_at_arms: { weapons: 0.07 },

    // ============ 启蒙时代 - 枪炮维护 ============
    musketeer: { firearms: 0.06, gunpowder: 0.03 },
    dragoon: { firearms: 0.08, gunpowder: 0.04 },
    field_cannon: { firearms: 0.12, gunpowder: 0.08 },
    line_infantry: { firearms: 0.07, gunpowder: 0.04 },

    // ============ 工业时代 - 枪炮维护 ============
    rifleman: { firearms: 0.08, gunpowder: 0.05 },
    gatling: { firearms: 0.20, gunpowder: 0.15 },
    lancer: { firearms: 0.05, weapons: 0.03 },
    artillery: { firearms: 0.25, gunpowder: 0.20 },
    assault_infantry: { firearms: 0.10, gunpowder: 0.06 },
};

/**
 * 战斗时的武器消耗系数
 * 根据战斗规模和时代计算额外的武器消耗
 */
export const BATTLE_WEAPON_CONSUMPTION = {
    // 每次战斗的基础消耗系数 (相对于招募成本)
    baseConsumption: 0.1,

    // 战斗规模修正
    scaleModifiers: {
        skirmish: 0.5,    // 小规模遭遇战
        battle: 1.0,      // 标准战斗
        siege: 1.5,       // 攻城战
        decisive: 2.0,    // 决战
    },

    // 战损系数 (损失单位额外消耗)
    casualtyModifier: 0.5,
};

/**
 * 根据时代获取主要武器类型
 * @param {number} epoch - 当前时代
 * @returns {string} 主要武器资源ID
 */
export function getPrimaryWeaponForEpoch(epoch) {
    if (epoch <= 1) return 'tools';
    if (epoch <= 4) return 'weapons';
    return 'firearms';
}

/**
 * 根据时代获取辅助武器类型（火药）
 * @param {number} epoch - 当前时代  
 * @returns {string|null} 辅助武器资源ID，如果该时代不需要则返回null
 */
export function getSecondaryWeaponForEpoch(epoch) {
    if (epoch >= 4) return 'gunpowder';
    return null;
}

/**
 * 计算兵种的总武器招募成本
 * @param {string} unitId - 兵种ID
 * @param {number} count - 招募数量
 * @returns {Object} 武器成本对象
 */
export function calculateRecruitWeaponCost(unitId, count) {
    const baseCost = UNIT_WEAPON_RECRUIT_COST[unitId] || {};
    const result = {};

    Object.entries(baseCost).forEach(([resource, amount]) => {
        result[resource] = amount * count;
    });

    return result;
}

/**
 * 计算军队的总武器维护成本
 * @param {Object} army - 军队对象 { unitId: count }
 * @returns {Object} 每日武器维护成本
 */
export function calculateArmyWeaponMaintenance(army) {
    const result = {};

    Object.entries(army).forEach(([unitId, count]) => {
        const unitCost = UNIT_WEAPON_MAINTENANCE_COST[unitId] || {};
        Object.entries(unitCost).forEach(([resource, amount]) => {
            result[resource] = (result[resource] || 0) + (amount * count);
        });
    });

    return result;
}

/**
 * 检查是否有足够的武器资源招募
 * @param {Object} resources - 玩家资源
 * @param {string} unitId - 兵种ID
 * @param {number} count - 招募数量
 * @returns {boolean} 是否资源充足
 */
export function canAffordWeaponCost(resources, unitId, count) {
    const cost = calculateRecruitWeaponCost(unitId, count);

    for (const [resource, amount] of Object.entries(cost)) {
        if ((resources[resource] || 0) < amount) {
            return false;
        }
    }

    return true;
}

/**
 * 获取武器供应状态
 * @param {Object} resources - 玩家资源
 * @param {Object} army - 军队组成
 * @param {number} daysReserve - 需要储备的天数
 * @returns {Object} 供应状态 { status: 'normal'|'low'|'critical', details: {} }
 */
export function getWeaponSupplyStatus(resources, army, daysReserve = 30) {
    const dailyMaintenance = calculateArmyWeaponMaintenance(army);
    const requiredReserve = {};

    Object.entries(dailyMaintenance).forEach(([resource, dailyAmount]) => {
        requiredReserve[resource] = dailyAmount * daysReserve;
    });

    let worstStatus = 'normal';
    const details = {};

    Object.entries(requiredReserve).forEach(([resource, required]) => {
        const available = resources[resource] || 0;
        const ratio = available / required;

        let status;
        if (ratio >= 1) {
            status = 'normal';
        } else if (ratio >= 0.5) {
            status = 'low';
            if (worstStatus === 'normal') worstStatus = 'low';
        } else {
            status = 'critical';
            worstStatus = 'critical';
        }

        details[resource] = {
            available,
            required,
            ratio,
            status,
            daysRemaining: Math.floor(available / (dailyMaintenance[resource] || 1)),
        };
    });

    return { status: worstStatus, details };
}
