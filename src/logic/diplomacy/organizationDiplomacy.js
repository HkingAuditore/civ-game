/**
 * 国际组织系统 (International Organizations System)
 * 
 * 功能：
 * 1. 创建和管理军事联盟、经济共同体、自贸区
 * 2. 组织成员关系和效果计算
 * 3. 成员费用和收益结算
 * 
 * 依赖：diplomacy.js 配置
 */

import {
    DIPLOMACY_ERA_UNLOCK,
    DIPLOMACY_ORGANIZATION_TYPES,
    ORGANIZATION_EFFECTS,
    isDiplomacyUnlocked,
} from '../../config/diplomacy';

// ===== 组织类型配置 =====

/**
 * 组织类型完整配置
 */
export const ORGANIZATION_TYPE_CONFIGS = {
    military_alliance: {
        id: 'military_alliance',
        name: '军事联盟',
        minEra: 3,
        minMembers: 2,
        maxMembers: 6,
        createCost: 0.02,           // 创建成本：双方财富最小值 × 2%
        memberFee: 0.001,           // 成员费：每月国家财富 × 0.1%
        minRelation: 60,            // 创建/加入最低关系
        effects: {
            mutualDefense: true,     // 共同防御
            relationBonus: 5,        // 成员间关系加成
            militaryBonus: 0.1,      // 军事力量加成 10%
        },
        description: '成员国互相保护，共同对抗外敌',
    },
    economic_bloc: {
        id: 'economic_bloc',
        name: '经济共同体',
        minEra: 5,
        minMembers: 2,
        maxMembers: 10,
        createCost: 0.03,
        memberFee: 0.002,
        minRelation: 45,
        effects: {
            tariffDiscount: 0.3,     // 成员间关税减免 30%
            relationBonus: 5,
            tradeEfficiency: 0.2,    // 贸易效率加成 20%
            priceConvergence: 0.03,  // 价格收敛 3%/月
        },
        description: '成员国共享经济利益，减免关税，促进贸易自由化',
    },
};

// ===== 数据结构 =====

/**
 * 创建新组织
 * @param {Object} params - 创建参数
 * @returns {Object} - 组织对象
 */
export function createOrganization({
    type,
    founderId,
    founderName,
    name = null,
    epoch = 0,
    daysElapsed = 0,
}) {
    const config = ORGANIZATION_TYPE_CONFIGS[type];
    if (!config) {
        throw new Error(`无效的组织类型: ${type}`);
    }

    // 检查时代解锁
    if (!isDiplomacyUnlocked('organizations', type, epoch)) {
        return { success: false, reason: `需要 ${DIPLOMACY_ERA_UNLOCK.organizations[type]?.name} 时代解锁` };
    }

    const orgId = `org_${type}_${Date.now()}`;
    const orgName = name || `${founderName}主导的${config.name}`;

    return {
        success: true,
        organization: {
            id: orgId,
            type,
            name: orgName,
            founderId,
            members: [founderId],  // 创始国自动成为成员
            createdDay: daysElapsed,
            isActive: true,
        },
    };
}

// ===== 成员管理 =====

/**
 * 检查国家是否可以加入组织
 * @param {Object} nation - 目标国家
 * @param {Object} organization - 组织对象
 * @param {number} epoch - 当前时代
 * @returns {Object} - { canJoin, reason }
 */
export function canJoinOrganization(nation, organization, epoch) {
    const config = ORGANIZATION_TYPE_CONFIGS[organization.type];
    if (!config) {
        return { canJoin: false, reason: '无效的组织类型' };
    }

    // 时代检查
    if (!isDiplomacyUnlocked('organizations', organization.type, epoch)) {
        return { canJoin: false, reason: `需要达到${DIPLOMACY_ERA_UNLOCK.organizations[organization.type]?.name}` };
    }

    // 已是成员
    if (organization.members.includes(nation.id)) {
        return { canJoin: false, reason: '已是该组织成员' };
    }

    // 人数上限
    if (organization.members.length >= config.maxMembers) {
        return { canJoin: false, reason: '组织成员已达上限' };
    }

    // 战争状态（不能加入敌对国所在的组织）
    if (nation.isAtWar && organization.members.some(memberId => {
        // 这里简化处理，实际应检查是否与任一成员处于战争状态
        return false; // 需要传入更多状态来判断
    })) {
        return { canJoin: false, reason: '不能加入与交战国所在的组织' };
    }

    return { canJoin: true };
}

/**
 * 国家加入组织
 * @param {Object} organization - 组织对象
 * @param {string} nationId - 加入国家ID
 * @returns {Object} - 更新后的组织
 */
export function joinOrganization(organization, nationId) {
    if (organization.members.includes(nationId)) {
        return organization;
    }

    return {
        ...organization,
        members: [...organization.members, nationId],
    };
}

/**
 * 国家退出组织
 * @param {Object} organization - 组织对象
 * @param {string} nationId - 退出国家ID
 * @returns {Object} - 更新后的组织（可能解散）
 */
export function leaveOrganization(organization, nationId) {
    const config = ORGANIZATION_TYPE_CONFIGS[organization.type];
    const newMembers = organization.members.filter(id => id !== nationId);

    // 如果成员不足最低要求，解散组织
    if (newMembers.length < config.minMembers) {
        return {
            ...organization,
            members: newMembers,
            isActive: false,
            disbandReason: '成员不足',
        };
    }

    // 如果创始国退出，转移所有权给最早加入的成员
    let newFounderId = organization.founderId;
    if (nationId === organization.founderId && newMembers.length > 0) {
        newFounderId = newMembers[0];
    }

    return {
        ...organization,
        members: newMembers,
        founderId: newFounderId,
    };
}

// ===== 效果计算 =====

/**
 * 获取国家从所有组织中获得的综合效果
 * @param {string} nationId - 国家ID
 * @param {Array} organizations - 所有组织列表
 * @param {string} targetNationId - （可选）针对特定国家的效果
 * @returns {Object} - 综合效果
 */
export function getOrganizationEffects(nationId, organizations = [], targetNationId = null) {
    const effects = {
        tariffDiscount: 0,
        relationBonus: 0,
        militaryBonus: 0,
        tradeEfficiency: 0,
        priceConvergence: 0,
        mutualDefense: false,
        sharedOrganizations: [],  // 与目标国家共享的组织
    };

    if (!organizations || organizations.length === 0) {
        return effects;
    }

    for (const org of organizations) {
        if (!org.isActive || !org.members.includes(nationId)) continue;

        const config = ORGANIZATION_TYPE_CONFIGS[org.type];
        if (!config) continue;

        // 如果指定了目标国家，只计算双方都在的组织的效果
        if (targetNationId) {
            if (!org.members.includes(targetNationId)) continue;
            effects.sharedOrganizations.push(org);
        }

        // 累加效果
        if (config.effects.tariffDiscount) {
            effects.tariffDiscount = Math.min(1, effects.tariffDiscount + config.effects.tariffDiscount);
        }
        if (config.effects.relationBonus) {
            effects.relationBonus += config.effects.relationBonus;
        }
        if (config.effects.militaryBonus) {
            effects.militaryBonus += config.effects.militaryBonus;
        }
        if (config.effects.tradeEfficiency) {
            effects.tradeEfficiency = Math.max(effects.tradeEfficiency, config.effects.tradeEfficiency);
        }
        if (config.effects.priceConvergence) {
            effects.priceConvergence = Math.max(effects.priceConvergence, config.effects.priceConvergence);
        }
        if (config.effects.mutualDefense) {
            effects.mutualDefense = true;
        }
    }

    return effects;
}

/**
 * 获取国家加入的所有组织
 * @param {string} nationId - 国家ID
 * @param {Array} organizations - 所有组织列表
 * @returns {Array} - 该国家加入的组织
 */
export function getNationOrganizations(nationId, organizations = []) {
    return organizations.filter(org => org.isActive && org.members.includes(nationId));
}

/**
 * 获取可创建的组织类型
 * @param {number} epoch - 当前时代
 * @returns {Array} - 可创建的组织类型配置
 */
export function getAvailableOrganizationTypes(epoch) {
    return Object.values(ORGANIZATION_TYPE_CONFIGS).filter(config =>
        isDiplomacyUnlocked('organizations', config.id, epoch)
    );
}

/**
 * 获取可加入的组织列表
 * @param {Object} nation - 国家对象
 * @param {Array} organizations - 所有组织
 * @param {Array} nations - 所有国家（用于检查关系）
 * @param {number} epoch - 当前时代
 * @returns {Array} - 可加入的组织
 */
export function getJoinableOrganizations(nation, organizations = [], nations = [], epoch = 0) {
    const result = [];

    for (const org of organizations) {
        if (!org.isActive) continue;
        
        const { canJoin, reason } = canJoinOrganization(nation, org, epoch);
        if (canJoin) {
            // 检查与创始国或任一成员的关系
            const config = ORGANIZATION_TYPE_CONFIGS[org.type];
            const hasGoodRelation = org.members.some(memberId => {
                const memberNation = nations.find(n => n.id === memberId);
                return memberNation && (nation.relation >= config.minRelation || 
                    (memberNation.relation && memberNation.relation >= config.minRelation));
            });

            if (hasGoodRelation) {
                result.push({ ...org, joinReason: '关系满足' });
            }
        }
    }

    return result;
}

// ===== 每日/每月更新 =====

/**
 * 处理组织每月更新（成员费收取等）
 * @param {Object} params - 更新参数
 * @returns {Object} - { updatedOrganizations, fees, logs }
 */
export function processOrganizationMonthlyUpdate({
    organizations = [],
    nations = [],
    playerWealth = 0,
    daysElapsed = 0,
}) {
    const logs = [];
    const fees = { player: 0, ai: {} };
    const updatedOrganizations = [];

    for (const org of organizations) {
        if (!org.isActive) {
            updatedOrganizations.push(org);
            continue;
        }

        const config = ORGANIZATION_TYPE_CONFIGS[org.type];
        if (!config) {
            updatedOrganizations.push(org);
            continue;
        }

        // 收取成员费
        for (const memberId of org.members) {
            if (memberId === 'player') {
                const fee = Math.floor(playerWealth * config.memberFee);
                fees.player += fee;
                if (fee > 0) {
                    logs.push(`🏛️ ${org.name}成员费: -${fee.toLocaleString()}银`);
                }
            } else {
                const nation = nations.find(n => n.id === memberId);
                if (nation) {
                    const fee = Math.floor((nation.wealth || 1000) * config.memberFee);
                    fees.ai[memberId] = (fees.ai[memberId] || 0) + fee;
                }
            }
        }

        updatedOrganizations.push(org);
    }

    return { updatedOrganizations, fees, logs };
}

/**
 * 检查组织是否应该解散
 * @param {Object} organization - 组织对象
 * @returns {boolean} - 是否应解散
 */
export function shouldDisbandOrganization(organization) {
    const config = ORGANIZATION_TYPE_CONFIGS[organization.type];
    if (!config) return true;

    // 成员不足
    if (organization.members.length < config.minMembers) return true;

    // 所有成员互相交战（简化判断）
    // 实际实现需要更复杂的逻辑

    return false;
}

/**
 * 获取组织成员列表（用于UI显示）
 * @param {Object} organization - 组织对象
 * @param {Array} nations - 所有国家
 * @returns {Array} - 成员信息数组
 */
export function getOrganizationMembers(organization, nations = []) {
    return organization.members.map(memberId => {
        if (memberId === 'player') {
            return { id: 'player', name: '你的国家', isPlayer: true, isFounder: memberId === organization.founderId };
        }
        const nation = nations.find(n => n.id === memberId);
        return {
            id: memberId,
            name: nation?.name || '未知国家',
            isPlayer: false,
            isFounder: memberId === organization.founderId,
            relation: nation?.relation || 0,
        };
    });
}

/**
 * 获取组织效果描述（用于UI显示）
 * @param {string} orgType - 组织类型
 * @returns {Array<string>} - 效果描述列表
 */
export function getOrganizationEffectDescriptions(orgType) {
    const config = ORGANIZATION_TYPE_CONFIGS[orgType];
    if (!config) return [];

    const descriptions = [];
    const effects = config.effects;

    if (effects.mutualDefense) {
        descriptions.push('🛡️ 共同防御');
    }
    if (effects.tariffDiscount) {
        descriptions.push(`📉 成员间关税 -${Math.round(effects.tariffDiscount * 100)}%`);
    }
    if (effects.relationBonus) {
        descriptions.push(`💕 成员关系 +${effects.relationBonus}`);
    }
    if (effects.militaryBonus) {
        descriptions.push(`⚔️ 军事力量 +${Math.round(effects.militaryBonus * 100)}%`);
    }
    if (effects.tradeEfficiency) {
        descriptions.push(`📈 贸易效率 +${Math.round(effects.tradeEfficiency * 100)}%`);
    }
    if (effects.priceConvergence) {
        descriptions.push(`💱 价格趋同 ${Math.round(effects.priceConvergence * 100)}%/月`);
    }

    return descriptions;
}
