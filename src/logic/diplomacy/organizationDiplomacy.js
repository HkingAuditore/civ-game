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
        // maxMembers now calculated by getOrganizationMaxMembers() based on era
        maxMembersByEra: { 3: 4, 4: 6, 5: 8, 6: 10, 7: 12, 8: 15 },  // Era-based limits
        createCost: 0.05,           // 创建成本：玩家财富 × 5%
        memberFee: 0.001,           // 成员费：每月国家财富 × 0.1%
        minRelation: 60,            // 创建/加入最低关系
        leaveCost: 0.03,            // 退出成本：财富 × 3%
        founderLeaveCost: 0.08,     // 创始人退出成本：财富 × 8%
        leaveRelationPenalty: -15,  // 退出后与所有成员关系 -15
        founderLeaveRelationPenalty: -25, // 创始人退出后关系惩罚
        founderLeaveDisbands: true, // 创始人退出是否解散组织
        kickRelationPenalty: -20,   // 被踢出后关系惩罚
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
        // maxMembers now calculated by getOrganizationMaxMembers() based on era
        maxMembersByEra: { 5: 6, 6: 10, 7: 15, 8: 20 },  // Era-based limits
        createCost: 0.08,           // 创建成本：玩家财富 × 8%
        memberFee: 0.002,           // 成员费：每月国家财富 × 0.2%
        minRelation: 75,
        leaveCost: 0.05,            // 退出成本：财富 × 5%
        founderLeaveCost: 0.12,     // 创始人退出成本：财富 × 12%
        leaveRelationPenalty: -10,  // 退出后与所有成员关系 -10
        founderLeaveRelationPenalty: -20, // 创始人退出后关系惩罚
        founderLeaveDisbands: true, // 创始人退出是否解散组织
        kickRelationPenalty: -15,   // 被踢出后关系惩罚
        effects: {
            tariffDiscount: 0.3,     // 成员间关税减免 30%
            relationBonus: 5,
            tradeEfficiency: 0.2,    // 贸易效率加成 20%
        },
        description: '成员国共享经济利益，减免关税，促进贸易自由化（加入需通过外交谈判，且通常要求与创始国关系≥75）',
    },
};

/**
 * 根据时代获取组织成员上限
 * @param {string} type - 组织类型
 * @param {number} epoch - 当前时代
 * @returns {number} - 成员上限
 */
export function getOrganizationMaxMembers(type, epoch) {
    const config = ORGANIZATION_TYPE_CONFIGS[type];
    if (!config || !config.maxMembersByEra) return 6; // fallback
    
    // Find the highest era config that is <= current epoch
    const availableEras = Object.keys(config.maxMembersByEra)
        .map(Number)
        .filter(era => era <= epoch)
        .sort((a, b) => b - a); // descending
    
    if (availableEras.length === 0) {
        // If epoch is before minEra, use the minEra's value
        const minEraValue = config.maxMembersByEra[config.minEra];
        return minEraValue || 6;
    }
    
    return config.maxMembersByEra[availableEras[0]];
}

/**
 * 计算创建组织的成本
 * @param {string} type - 组织类型
 * @param {number} playerWealth - 玩家财富
 * @returns {number} - 创建成本（银币）
 */
export function calculateCreateOrganizationCost(type, playerWealth) {
    const config = ORGANIZATION_TYPE_CONFIGS[type];
    if (!config) return 0;
    return Math.floor(playerWealth * config.createCost);
}

/**
 * 计算退出组织的成本
 * @param {Object} organization - 组织对象
 * @param {string} nationId - 退出国家ID
 * @param {number} nationWealth - 国家财富
 * @returns {Object} - { cost, relationPenalty, willDisband }
 */
export function calculateLeaveOrganizationCost(organization, nationId, nationWealth) {
    const config = ORGANIZATION_TYPE_CONFIGS[organization.type];
    if (!config) return { cost: 0, relationPenalty: 0, willDisband: false };

    const isFounder = organization.founderId === nationId;
    const costRate = isFounder ? config.founderLeaveCost : config.leaveCost;
    const relationPenalty = isFounder ? config.founderLeaveRelationPenalty : config.leaveRelationPenalty;
    const willDisband = isFounder && config.founderLeaveDisbands;

    return {
        cost: Math.floor(nationWealth * costRate),
        relationPenalty,
        willDisband,
        isFounder,
    };
}

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

    const orgId = `org_${type}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
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

    // 人数上限 (now era-based)
    const maxMembers = getOrganizationMaxMembers(organization.type, epoch);
    if (organization.members.length >= maxMembers) {
        return { canJoin: false, reason: `组织成员已达当前时代上限(${maxMembers}国)` };
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

    // If founder leaves, optionally disband the organization (default true)
    if (nationId === organization.founderId && config?.founderLeaveDisbands !== false) {
        return {
            ...organization,
            members: newMembers,
            isActive: false,
            disbandReason: '创始国退出',
        };
    }

    // Otherwise, transfer founder to the earliest remaining member (fallback)
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
    return organizations.filter(org => org.isActive !== false && org.members.includes(nationId));
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
 * @param {Set<string>} validNationIds - （可选）有效国家ID集合，用于检查创始国是否存在
 * @returns {boolean} - 是否应解散
 */
export function shouldDisbandOrganization(organization, validNationIds = null) {
    const config = ORGANIZATION_TYPE_CONFIGS[organization.type];
    if (!config) return true;

    // 成员不足
    if (organization.members.length < config.minMembers) return true;

    // [NEW] 创始国已消亡（被吞并或人口为0）
    if (validNationIds && organization.founderId) {
        if (!validNationIds.has(organization.founderId)) {
            return true;
        }
    }

    // [FIX] 创始国不在成员列表中（可能已退出）
    if (organization.founderId && !organization.members.includes(organization.founderId)) {
        return true;
    }

    // 所有成员互相交战（简化判断）
    // 实际实现需要更复杂的逻辑

    return false;
}

/**
 * 获取组织成员列表（用于UI显示）
 * @param {Object} organization - 组织对象
 * @param {Array} nations - 所有国家
 * @param {string} empireName - 玩家帝国名称
 * @returns {Array} - 成员信息数组
 */
export function getOrganizationMembers(organization, nations = [], empireName = '我的帝国') {
    return organization.members.map(memberId => {
        if (memberId === 'player') {
            return { id: 'player', name: empireName, isPlayer: true, isFounder: memberId === organization.founderId };
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

    // Economic bloc has additional implicit rules implemented elsewhere (overseasInvestment.js)
    // so we explicitly describe them here to avoid missing core gameplay effects.
    if (orgType === 'economic_bloc') {
        descriptions.push('✅ 加入方式：需通过外交谈判向创始国申请加入（关系门槛以谈判界面显示为准）');
        descriptions.push('📌 申请加入硬门槛：与创始国关系需达到 75（未达标将直接被阻止/极低通过率）');
        descriptions.push('🏦 成员国互相开放海外投资（允许彼此建立海外资产/外资项目）');
        descriptions.push('💸 海外投资利润汇回税率降至 10%（替代无条约时的惩罚性税率）');
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
        // Avoid misleading "profit from nothing" phrasing. This is a gameplay bonus applied to trade outcomes.
        descriptions.push(`📈 贸易效率 +${Math.round(effects.tradeEfficiency * 100)}%（同等贸易量下结算收益更高）`);
    }

    return descriptions;
}
