/**
 * 海外投资系统 (Overseas Investment System)
 * 
 * 功能：
 * 1. 玩家资本家/商人在附庸国建造建筑
 * 2. 外国在玩家国投资建筑（外资系统）
 * 3. 利润计算与结算
 * 
 * 依赖：附庸系统 (vassalSystem.js)
 */

import { BUILDINGS, RESOURCES, STRATA, ORGANIZATION_EFFECTS } from '../../config/index.js';
import { debugLog } from '../../utils/debugFlags.js';
import { getMaxUpgradeLevel, getUpgradeCost, getBuildingEffectiveConfig } from '../../config/buildingUpgrades.js';
import { VASSAL_TYPE_CONFIGS, TRADE_POLICY_DEFINITIONS, getLaborWageMultiplier } from '../../config/diplomacy.js';
import { getTreatyEffects } from './treatyEffects.js';
import { BUILDING_CATEGORY_INDEX } from './foreignEconomy.js';

// ===== 配置常量 =====

/**
 * 海外投资类型配置
 */
export const OVERSEAS_INVESTMENT_CONFIGS = {
    // 投资限制
    limits: {
        maxInvestmentRatio: 0.2,          // 最大投资占附庸GDP比例
        minRelationForInvestment: 30,      // 最低外交关系要求
        investmentCooldown: 15,            // 两次投资间隔（天）— 缩短以加速外资入境
    },

    // 运营配置 (灵活配置)
    config: {
        transportCostRate: 0.15,      // 跨国运输成本 (15%)
    },

    // 投资收益基础配置
    profitRates: {
        protectorate: 0.08,    // 保护国：8%年化收益
        tributary: 0.12,       // 朝贡国：12%年化收益
        puppet: 0.18,          // 傀儡国：18%年化收益
        colony: 0.25,          // 殖民地：25%年化收益
    },

    // 利润汇回限制
    repatriation: {
        noTreaty: 0.8,         // 无投资协定：80%可汇回
        withTreaty: 1.0,       // 有投资协定：100%可汇回
        wartime: 0,            // 战争期间：无法汇回
    },
};

/**
 * 投资策略定义
 */
export const INVESTMENT_STRATEGIES = {
    PROFIT_MAX: {
        id: 'PROFIT_MAX',
        name: '利润优先',
        desc: '自动选择成本最低的原料来源和售价最高的销售去向，以最大化利润。',
    },
    RESOURCE_EXTRACTION: {
        id: 'RESOURCE_EXTRACTION',
        name: '资源掠夺',
        desc: '优先将产出运回国内，无论当地价格是否更高。原料倾向于当地采购以降低成本。',
    },
    MARKET_DUMPING: {
        id: 'MARKET_DUMPING',
        name: '市场倾销',
        desc: '优先使用国内原料（去库存），产出优先在当地销售以占据市场。',
    },
};

/**
 * 海外投资允许的建筑类别（按accessType）
 * - colony: 仅采集类
 * - vassal: 采集+加工类（受附庸等级限制）
 * - treaty: 采集+加工类
 */
export const OVERSEAS_BUILDING_CATEGORIES = {
    colony: ['gather'],              // 殖民地：仅采集
    vassal: ['gather', 'industry'],  // 附庸国：采集+加工
    treaty: ['gather', 'industry'],  // 投资协议：采集+加工
};

/**
 * 所有可海外投资的建筑ID列表（静态引用）
 */
// [DYNAMIC] No hardcoded building list - buildings are filtered dynamically based on:
// 1. Epoch unlock (player's current tech level)
// 2. Building category (gather/industry for overseas)
// 3. Employment relationship (owner must hire different strata)

/**
 * 获取可在海外投资的建筑列表（动态计算）
 * 
 * 核心逻辑：
 * 1. 根据玩家当前时代（epoch）过滤已解锁的建筑
 * 2. 根据访问类型（accessType）过滤允许的建筑类别
 * 3. 只返回有雇佣关系的建筑（jobs中有不同于owner的阶层）
 * 4. 如果指定了ownerStratum，只返回该阶层可以作为业主的建筑
 * 
 * @param {string} accessType - 'colony' | 'vassal' | 'treaty'
 * @param {string} ownerStratum - 业主阶层 (可选，用于过滤该阶层可投资的建筑)
 * @param {number} epoch - 当前时代
 * @param {Object|null} unlockedTechs - 已解锁的科技 (null=跳过科技检查)
 * @returns {Array} - 可投资建筑对象列表 (返回完整building对象，不只是id)
 */
export function getInvestableBuildings(accessType = 'treaty', ownerStratum = null, epoch = 0, unlockedTechs = null) {
    const allowedCategories = OVERSEAS_BUILDING_CATEGORIES[accessType] || ['gather', 'industry'];

    return BUILDINGS.filter(building => {
        // 1. Check building category (gather/industry for overseas)
        if (!allowedCategories.includes(building.cat)) return false;

        // 2. Check epoch unlock
        if ((building.epoch || 0) > epoch) return false;

        // 3. Check tech requirement (if unlockedTechs provided)
        if (building.requiresTech && unlockedTechs) {
            if (!unlockedTechs[building.requiresTech]) return false;
        }

        // 4. Must have an owner defined (someone needs to own the business)
        const buildingOwner = building.owner;
        if (!buildingOwner) return false;

        // 5. [CRITICAL] Must have employment relationship
        // The building must hire workers from different strata than the owner
        // This is the core requirement for overseas investment - exploiting foreign labor
        const jobs = building.jobs || {};
        const hasEmployees = Object.keys(jobs).some(jobStratum => jobStratum !== buildingOwner);
        if (!hasEmployees) return false;

        // 6. If ownerStratum specified, only show buildings where that stratum is the owner
        // Any stratum that can be an owner can invest in their own buildings
        if (ownerStratum && buildingOwner !== ownerStratum) return false;

        return true;
    });
}


// ===== 数据结构 =====

/**
 * 创建海外投资记录
 * @param {Object} params - 投资参数
 * @returns {Object} - 海外投资记录
 */
export function createOverseasInvestment({
    buildingId,
    targetNationId,
    ownerStratum = 'capitalist',
    inputSource = 'local',
    outputDest = 'local',
    investmentAmount = 0,
    strategy = 'PROFIT_MAX',
}) {
    const building = BUILDINGS.find(b => b.id === buildingId);
    if (!building) {
        debugLog('overseas', `[海外投资] 无效的建筑ID: ${buildingId}`);
        return null;
    }

    return {
        id: `oi_${targetNationId}_${buildingId}_${Date.now()}`,
        buildingId,
        targetNationId,
        ownerStratum,
        strategy,
        investmentAmount,
        count: 1,
        createdDay: 0,  // 将在实际创建时设置

        // 运营数据
        operatingData: {
            outputValue: 0,
            inputCost: 0,
            wageCost: 0,
            profit: 0,
            laborShortage: 0,
            supplyShortage: false,
            frozenProfit: 0,        // 因战争冻结的利润
        },

        status: 'operating',        // 'operating' | 'suspended' | 'nationalized'
    };
}

export const getOverseasInvestmentGroupKey = (investment) => {
    if (!investment) return '';
    const strategy = investment.strategy || 'PROFIT_MAX';
    return `${investment.targetNationId}::${investment.buildingId}::${investment.ownerStratum || 'capitalist'}::${strategy}`;
};

/**
 * 运行时简并：将海外投资数组按 groupKey 合并，减少对象数量。
 * 相同 groupKey 的条目合并为一条（count 累加、investmentAmount 累加、取最早 createdDay）。
 * operatingData 保留最后一个有效值。
 */
export const consolidateOverseasInvestments = (investments = []) => {
    if (!investments || investments.length <= 1) return investments;
    const map = new Map();
    for (const inv of investments) {
        if (!inv) continue;
        const key = getOverseasInvestmentGroupKey(inv);
        if (map.has(key)) {
            const existing = map.get(key);
            existing.count = (existing.count || 1) + (inv.count || 1);
            existing.investmentAmount = (existing.investmentAmount || 0) + (inv.investmentAmount || 0);
            existing.createdDay = Math.min(existing.createdDay || inv.createdDay || 0, inv.createdDay || 0);
            // 保留有 operatingData 的最后一个
            if (inv.operatingData && !existing.operatingData) {
                existing.operatingData = inv.operatingData;
            }
            // 保留有 upgradeLevel 的最高等级
            if ((inv.upgradeLevel || 0) > (existing.upgradeLevel || 0)) {
                existing.upgradeLevel = inv.upgradeLevel;
                existing.lastUpgradeDay = inv.lastUpgradeDay;
            }
        } else {
            map.set(key, { ...inv });
        }
    }
    return Array.from(map.values());
};

/**
 * 运行时简并：将外资投资数组按 groupKey 合并。
 */
export const consolidateForeignInvestments = (investments = []) => {
    if (!investments || investments.length <= 1) return investments;
    const map = new Map();
    for (const inv of investments) {
        if (!inv) continue;
        const key = getForeignInvestmentGroupKey(inv);
        if (map.has(key)) {
            const existing = map.get(key);
            existing.count = (existing.count || 1) + (inv.count || 1);
            existing.investmentAmount = (existing.investmentAmount || 0) + (inv.investmentAmount || 0);
            if (inv.operatingData && !existing.operatingData) {
                existing.operatingData = inv.operatingData;
            }
            if ((inv.upgradeLevel || 0) > (existing.upgradeLevel || 0)) {
                existing.upgradeLevel = inv.upgradeLevel;
                existing.lastUpgradeDay = inv.lastUpgradeDay;
            }
        } else {
            map.set(key, { ...inv });
        }
    }
    return Array.from(map.values());
};

export const mergeOverseasInvestments = (existingInvestments = [], incomingInvestment) => {
    if (!incomingInvestment) return existingInvestments;

    const incomingKey = getOverseasInvestmentGroupKey(incomingInvestment);
    const incomingCount = incomingInvestment.count || 1;
    const incomingAmount = incomingInvestment.investmentAmount || 0;

    const next = [...existingInvestments];
    const index = next.findIndex(inv =>
        inv?.status === 'operating' &&
        getOverseasInvestmentGroupKey(inv) === incomingKey
    );

    if (index === -1) {
        next.push(incomingInvestment);
        return next;
    }

    const existing = next[index];
    next[index] = {
        ...existing,
        count: (existing.count || 1) + incomingCount,
        investmentAmount: (existing.investmentAmount || 0) + incomingAmount,
        createdDay: Math.min(existing.createdDay || incomingInvestment.createdDay || 0, incomingInvestment.createdDay || 0),
    };

    return next;
};

export const getForeignInvestmentGroupKey = (investment) => {
    if (!investment) return '';
    const strategy = investment.strategy || 'PROFIT_MAX';
    return `${investment.ownerNationId}::${investment.buildingId}::${investment.investorStratum || 'capitalist'}::${strategy}`;
};

export const mergeForeignInvestments = (existingInvestments = [], incomingInvestment) => {
    if (!incomingInvestment) return existingInvestments;

    const incomingKey = getForeignInvestmentGroupKey(incomingInvestment);
    const incomingCount = incomingInvestment.count || 1;
    const incomingAmount = incomingInvestment.investmentAmount || 0;

    const next = [...existingInvestments];
    const index = next.findIndex(inv =>
        inv?.status === 'operating' &&
        getForeignInvestmentGroupKey(inv) === incomingKey
    );

    if (index === -1) {
        next.push(incomingInvestment);
        return next;
    }

    const existing = next[index];
    next[index] = {
        ...existing,
        count: (existing.count || 1) + incomingCount,
        investmentAmount: (existing.investmentAmount || 0) + incomingAmount,
        createdDay: Math.min(existing.createdDay || incomingInvestment.createdDay || 0, incomingInvestment.createdDay || 0),
    };

    return next;
};

/**
 * 创建外资建筑记录（外国在玩家国投资）
 * @param {Object} params - 投资参数
 * @returns {Object} - 外资建筑记录
 */
export function createForeignInvestment({
    buildingId,
    ownerNationId,
    investorStratum = 'capitalist',
    strategy = 'PROFIT_MAX',
}) {
    const building = BUILDINGS.find(b => b.id === buildingId);
    if (!building) {
        debugLog('overseas', `[外资] 无效的建筑ID: ${buildingId}`);
        return null;
    }

    // 计算提供的岗位数量
    const jobsProvided = Object.values(building.jobs || {}).reduce((sum, val) => sum + val, 0);

    // 估算每日利润（基于建筑产出，简化计算）
    // 实际利润应该在 processForeignInvestments 中动态计算
    const outputValue = Object.entries(building.output || {}).reduce((sum, [res, val]) => {
        const price = RESOURCES[res]?.basePrice || 1;
        return sum + val * price;
    }, 0);
    const inputCost = Object.entries(building.input || {}).reduce((sum, [res, val]) => {
        const price = RESOURCES[res]?.basePrice || 1;
        return sum + val * price;
    }, 0);
    const estimatedDailyProfit = outputValue - inputCost; // Allow negative (losses)

    return {
        id: `fi_${ownerNationId}_${buildingId}_${Date.now()}`,
        buildingId,
        ownerNationId,
        investorStratum,
        strategy,
        count: 1,

        // 添加显示用的字段
        dailyProfit: estimatedDailyProfit,
        jobsProvided: jobsProvided,

        operatingData: {
            outputValue: outputValue,
            inputCost: inputCost,
            wageCost: 0,
            profit: estimatedDailyProfit,
        },

        status: 'operating',        // 'operating' | 'nationalized'
    };
}

// ===== 投资检查 =====

/**
 * Helper: determine whether a nation has an active treaty of a given type with the player.
 * Supports both treaty representations:
 * 1) Array form: nation.treaties = [{ type, status, endDay, withPlayer, ... }]
 * 2) Map form:  nation.treaties = { [type]: { status, endDay, withPlayer, ... } }
 */
export function hasActiveTreaty(nation, treatyType, daysElapsed = 0) {
    const treaties = nation?.treaties;
    if (!treaties) return false;

    const isTreatyRecordActive = (record) => {
        if (!record) return false;
        if (record.withPlayer === false) return false;

        const status = typeof record.status === 'string' ? record.status.toLowerCase() : null;
        const isExpiredByTime = Number.isFinite(record.endDay) && record.endDay <= daysElapsed;

        // 到期日优先：即使 status 仍是 active，只要过期就失效。
        if (isExpiredByTime) return false;
        if (status === 'expired' || status === 'terminated' || status === 'cancelled') return false;
        if (status === 'active') return true;

        // 兼容旧存档：无状态或未知状态时，未过期即视为有效。
        return true;
    };

    // Array form
    if (Array.isArray(treaties)) {
        const activeTreaty = treaties.find(t => t?.type === treatyType && isTreatyRecordActive(t));
        
        return !!activeTreaty;
    }

    // Map form
    const entry = treaties[treatyType];
    return isTreatyRecordActive(entry);
}

/**
 * Helper: check if nation is in the same economic bloc as player
 * @param {Object} nation - The nation to check
 * @param {Array} organizations - Global list of organizations
 */
export function isInSameBloc(nation, organizations = []) {
    // [DEBUG] Always log for troubleshooting
    // console.log('[isInSameBloc] Called with:', {
    //     nationName: nation?.name,
    //     nationId: nation?.id,
    //     orgCount: organizations?.length || 0,
    //     orgTypes: organizations?.map(o => o?.type) || [],
    // });

    if (!organizations || !nation) {
        // console.log('[isInSameBloc] Early return: no organizations or no nation');
        return false;
    }

    const nationIdStr = String(nation.id);

    // Check if both nation and player are members of any active 'economic_bloc' organization
    for (const org of organizations) {
        // Skip if not an active economic bloc
        if (!org || org.type !== 'economic_bloc') {
            continue;
        }
        
        // [FIX] Handle organizations that may have isActive undefined (default to true for backwards compatibility)
        const orgIsActive = org.isActive !== false;
        if (!orgIsActive) {
            // console.log(`[isInSameBloc] Skipping inactive org: ${org.name}`);
            continue;
        }
        
        const members = Array.isArray(org.members) ? org.members : [];

        // Player membership may be represented as:
        // - literal 'player'
        // - player nation id (number/string) in members (0, '0', or any other player nation id)
        // - implicitly via founderId/leaderId
        const hasPlayer =
            members.some(m => String(m) === 'player' || String(m) === '0') ||
            String(org.founderId) === 'player' || String(org.founderId) === '0' ||
            String(org.leaderId) === 'player' || String(org.leaderId) === '0';
        
        const hasNation = members.some(m => String(m) === nationIdStr);

        // console.log(`[isInSameBloc] Checking org "${org.name}":`, {
        //     orgId: org.id,
        //     members: members,
        //     nationIdStr,
        //     hasPlayer,
        //     hasNation,
        //     founderId: org.founderId,
        //     leaderId: org.leaderId,
        // });

        if (hasPlayer && hasNation) {
            // console.log(`[isInSameBloc] MATCH FOUND: ${nation.name} is in same bloc as player (${org.name})`);
            return true;
        }
    }

    // console.log(`[isInSameBloc] No matching bloc found for nation "${nation.name}" (id: ${nationIdStr})`);
    return false;
}

const findSharedOrganization = (nationId, organizations = []) => {
    if (!nationId || !organizations) return null;
    const nationIdStr = String(nationId);
    return organizations.find(org => {
        if (!org || org.isActive === false) return false;
        const members = Array.isArray(org.members) ? org.members : [];
        const hasPlayer = members.some(m => String(m) === 'player' || String(m) === '0');
        const hasNation = members.some(m => String(m) === nationIdStr);
        return hasPlayer && hasNation;
    }) || null;
};

const getTariffDiscountForNation = (nation, organizations = []) => {
    if (!nation) return 0;

    let discount = 0;
    const sharedOrg = findSharedOrganization(nation.id, organizations);
    if (sharedOrg) {
        discount = Math.max(discount, ORGANIZATION_EFFECTS[sharedOrg.type]?.tariffDiscount || 0);
    }

    if (nation.vassalOf === 'player') {
        const policyId = nation.vassalPolicy?.tradePolicy;
        const policyDiscount = TRADE_POLICY_DEFINITIONS[policyId]?.tariffDiscount || 0;
        const typeDiscount = VASSAL_TYPE_CONFIGS[nation.vassalType]?.tariffDiscount || 0;
        discount = Math.max(discount, policyDiscount, typeDiscount);
    }

    return discount;
};

const getTariffRateForPlayer = (resourceKey, tariffType, partnerNation, taxPolicies = {}, organizations = [], daysElapsed = 0) => {
    const baseRate = tariffType === 'import'
        ? (taxPolicies?.importTariffMultipliers?.[resourceKey] ?? taxPolicies?.resourceTariffMultipliers?.[resourceKey] ?? 0)
        : (taxPolicies?.exportTariffMultipliers?.[resourceKey] ?? taxPolicies?.resourceTariffMultipliers?.[resourceKey] ?? 0);

    if (!Number.isFinite(baseRate) || baseRate === 0) return 0;

    let adjustedRate = baseRate;
    const discount = getTariffDiscountForNation(partnerNation, organizations);
    if (discount) adjustedRate *= (1 - discount);

    const treatyEffects = partnerNation ? getTreatyEffects(partnerNation, daysElapsed) : null;
    if (Number.isFinite(treatyEffects?.tariffMultiplier)) {
        adjustedRate *= treatyEffects.tariffMultiplier;
    }

    return adjustedRate;
};

/**
 * Calculate the foreign investment profit tax rate for a given nation
 * This function determines the tax rate that would apply when:
 * - Player invests in target nation (direction = 'outbound')
 * - Target nation invests in player country (direction = 'inbound')
 * 
 * @param {Object} params - Parameters object
 * @param {Object} params.nation - The foreign nation
 * @param {Array} params.organizations - Global list of organizations (for bloc membership check)
 * @param {number} params.daysElapsed - Current game day
 * @param {string} params.direction - 'outbound' (player -> nation) or 'inbound' (nation -> player)
 * @returns {Object} - { rate: number, source: string, isVassal: boolean, inBloc: boolean, hasTreaty: boolean }
 */
export function getForeignInvestmentTaxRate({ nation, organizations = [], daysElapsed = 0, direction = 'outbound' }) {
    if (!nation) {
        return { rate: 0.60, source: 'DEFAULT', isVassal: false, inBloc: false, hasTreaty: false };
    }

    // For outbound: player is the investor, nation is the host (we check nation's status relative to player)
    // For inbound: nation is the investor, player is the host (we check player's policies toward the nation)
    
    const isVassal = direction === 'outbound' 
        ? nation.vassalOf === 'player'      // Nation is player's vassal
        : nation.vassals?.includes('player'); // Player is nation's vassal (rare case)
    
    const hasTreaty = hasActiveTreaty(nation, 'investment_pact', daysElapsed);
    const inBloc = isInSameBloc(nation, organizations);

    const applicableRates = [];

    if (isVassal) {
        // Vassal tax rate depends on vassal type
        const vassalConfig = VASSAL_TYPE_CONFIGS[nation.vassalType];
        const exemption = vassalConfig?.economicPrivileges?.profitTaxExemption || 0;
        const vassalRate = 0.25 * (1 - exemption);
        applicableRates.push({ source: 'VASSAL', rate: vassalRate });
    }

    if (inBloc) {
        // Economic bloc: 10% tax rate
        applicableRates.push({ source: 'ECONOMIC_BLOC', rate: 0.10 });
    }

    if (hasTreaty) {
        // Investment pact: 25% tax rate
        applicableRates.push({ source: 'TREATY', rate: 0.25 });
    }

    // Select the lowest rate
    if (applicableRates.length > 0) {
        const bestRate = applicableRates.reduce((best, current) =>
            current.rate < best.rate ? current : best
        );
        return {
            rate: bestRate.rate,
            source: bestRate.source,
            isVassal,
            inBloc,
            hasTreaty,
            allRates: applicableRates,
        };
    }

    // No applicable rates: default punitive rate of 60%
    return {
        rate: 0.60,
        source: 'DEFAULT',
        isVassal,
        inBloc,
        hasTreaty,
        allRates: [],
    };
}

/**
 * 检查是否可以在目标国家建立海外投资
 * @param {Object} targetNation - 目标国家
 * @param {string} buildingId - 建筑ID
 * @param {string} ownerStratum - 业主阶层
 * @param {Array} existingInvestments - 现有海外投资
 * @returns {Object} - { canInvest: boolean, reason?: string }
 */
export function canEstablishOverseasInvestment(targetNation, buildingId, ownerStratum, existingInvestments = []) {
    // 检查是否为附庸或有投资协议
    const isVassal = targetNation.vassalOf === 'player';
    const hasInvestmentPact = hasActiveTreaty(targetNation, 'investment_pact', targetNation.daysElapsed || 0);
    // 假设 organizations 通过某种方式传入或者 targetNation 包含它。
    // 注意：canEstablishOverseasInvestment 目前签名没有 organizations。
    // 但 isInSameBloc 需要 organizations。
    // 如果调用者没有传入 global organizations，我们无法准确判断。
    // 这是一个架构问题。现有的 establishment 逻辑可能需要 organizations。
    // 暂时：如果在 targetNation 中找不到 organizations，则只依赖 treaty。
    // 如果 targetNation 来自 useGameLoop，它应该没有 organizations 属性（除非我们注入了）。
    // 我们必须更新 canEstablishOverseasInvestment 签名，或者让调用者负责检查。
    // 鉴于 isInSameBloc 需要 organizations，我们尝试从 extra arguments 获取，或者假设 targetNation.organizations 存在。

    // Check organizations if available in existingInvestments context (hacky) or assume logic handles it.
    // 更好的做法：更新 canEstablishOverseasInvestment 签名
    // 但这涉及所有调用点。
    // 让我们先假设 Pact 是必须的，或者 Bloc 自动赋予 Pact?
    // 通常 Bloc 会自动签署相关条约，或者视同条约。
    // 为了稳妥，我们暂时只允许 Pact or Vassal。如果 Bloc 需要投资，玩家应该签署 Pact。
    // 或者：用户说"没有投资协定不允许投资"，可能 Bloc 自带 "投资协定" 效果？
    // 让我们暂且严格遵守"No Pact = No Invest"。如果 Bloc 成员想投资，必须签 Pact。
    // 这样最符合"Strict Rules"。
    // 但是 User Rule 3 Says: "In same bloc ... 10% tax". This implies investment happens.
    // If I block investment, rule 3 is useless.
    // So Bloc MUST allow investment.

    // Re-reading: "1. Without investment agreement is not allowed."
    // Maybe "Economic Bloc" IS an investment agreement?
    // I will assume Bloc acts as a Pact.

    // I need to access organizations. canEstablishOverseasInvestment receives `existingInvestments` as 4th arg.
    // I will add `organizations` as 5th arg.

    // But wait, I can't easily change all call sites right now.
    // Let's look at `isInSameBloc` implementation again. It checks `nation.organizations` OR `organizations` param.
    // If I can't pass `organizations`, I might fail to detect Bloc.

    // However, for the UI `OverseasInvestmentPanel`, we can pass organizations.
    // For `establishOverseasInvestment` (the action), we can pass organizations.

    if (!isVassal && !hasInvestmentPact) {
        // Try to check Bloc if possible (assuming organizations might be passed in existingInvestments if it's actually an options object? No it's an array).
        // Let's relax this check slightly IF we can detect Bloc, otherwise fail.
        // For now, adhere to Strict Pact Requirement. If user wants Bloc benefits, they sign a Pact too.
        // "3. ...双方利润出境只收10%" -> This applies to Repatriation (which happens for existing investments).
        // It doesn't explicitly say "Bloc allows new investment without Pact".
        // But usually it does.
        // Given "1. No Pact = No Investment", I will stick to that.
        // If you want 10% tax, join Bloc AND sign Pact (or Bloc implies Pact).
        // Actually, logic is cleaner if Pact is required for *Creation*.
        // Tax benefit applies if Bloc exists.

        return { canInvest: false, reason: '未签署投资协议，不允许建立任何海外资产' };
    }

    // 检查建筑是否可被投资（基于建筑类别）
    const building = BUILDINGS.find(b => b.id === buildingId);
    if (!building) {
        return { canInvest: false, reason: '无效的建筑类型' };
    }

    // 确定accessType
    // 如果无协议但允许建造(即trading_post)，视为treaty类型但受限
    const accessType = isVassal ? 'vassal' : 'treaty';
    const allowedCategories = OVERSEAS_BUILDING_CATEGORIES[accessType] || ['gather', 'industry'];

    if (!allowedCategories.includes(building.cat)) {
        return { canInvest: false, reason: `此建筑类型(${building.cat})不允许在海外投资` };
    }

    // 检查投资上限（附庸GDP的20%）
    const nationGDP = Number.isFinite(targetNation?.gdp)
        ? targetNation.gdp
        : (targetNation.wealth || 1000);
    const maxInvestment = nationGDP * OVERSEAS_INVESTMENT_CONFIGS.limits.maxInvestmentRatio;
    const currentInvestmentValue = existingInvestments
        .filter(inv => inv.targetNationId === targetNation.id && inv.status === 'operating')
        .reduce((sum, inv) => sum + (inv.investmentAmount || 0), 0);

    if (currentInvestmentValue >= maxInvestment) {
        return { canInvest: false, reason: '已达到该国最大投资额度' };
    }

    // 检查关系要求
    const relation = targetNation.relation || 50;
    if (relation < OVERSEAS_INVESTMENT_CONFIGS.limits.minRelationForInvestment) {
        return { canInvest: false, reason: '与目标国家关系过差' };
    }

    return { canInvest: true };
}

// ===== 利润计算 =====

/**
 * 通用：计算海外建筑利润 (基于策略自动决定流向)
 * @param {Object} investment - 投资对象 { ..., strategy }
 * @param {Object} targetNation
 * @param {Object} playerResources
 * @param {Object} playerMarketPrices
 * @param {Object} options
 * @param {Object} options.taxPolicies
 * @param {Array} options.organizations
 * @param {number} options.daysElapsed
 * @param {boolean} options.playerIsHome - True when player is the "home" market
 * @param {Object|null} options.partnerNation - Counterparty nation for treaty/org tariff discounts
 */
export function calculateOverseasProfit(investment, targetNation, playerResources, playerMarketPrices = {}, options = {}) {
    const building = BUILDINGS.find(b => b.id === investment.buildingId);
    if (!building) {
        return {
            outputValue: 0,
            inputCost: 0,
            wageCost: 0,
            businessTaxCost: 0,
            profit: 0,
            transportCost: 0,
            tariffCost: 0,
            tariffRevenue: 0,
            tariffSubsidy: 0,
        };
    }

    const strategy = investment.strategy || 'PROFIT_MAX';
    const transportRate = OVERSEAS_INVESTMENT_CONFIGS.config.transportCostRate;
    const buildingCategory = BUILDING_CATEGORY_INDEX[building.id] || building.cat || 'industry';
    const staffingFactor = Math.max(0.2, Math.min(1, Number(targetNation?.virtualEconomy?.staffingFactorByCategory?.[buildingCategory] ?? targetNation?.virtualLabor?.employmentRate ?? 1)));
    const inputFactor = Math.max(0.25, Math.min(1, Number(targetNation?.virtualEconomy?.inputFactorByCategory?.[buildingCategory] ?? 1)));
    const warFactor = Math.max(0.35, Math.min(1, Number(targetNation?.virtualEconomy?.warFactorByCategory?.[buildingCategory] ?? 1)));
    const operatingFactor = Math.max(0.15, Math.min(1, staffingFactor * inputFactor * warFactor));
    const {
        taxPolicies = {},
        organizations = [],
        daysElapsed = 0,
        playerIsHome = true,
        partnerNation = null,
    } = options;

    // 价格获取器
    // [FIX] AI国家的价格存储在 nationPrices 字段，需要添加到查询链
    const getNationPrice = (res) => (targetNation.market?.prices || {})[res] ?? (targetNation.nationPrices || {})[res] ?? (targetNation.prices || {})[res] ?? getBasePrice(res);
    const getHomePrice = (res) => playerMarketPrices[res] ?? getBasePrice(res);

    // 库存获取器
    const getNationInventory = (res, amount) => {
        const inv = (targetNation.inventories || {})[res] || 0;
        if (inv > 0) return inv;
        const wealthFactor = Math.max(0.5, (targetNation.wealth || 1000) / 2000);
        return Math.floor(amount * 2 * wealthFactor); // 模拟库存
    };

    let inputCost = 0;
    let transportCost = 0;
    let inputAvailable = true;
    let tariffCost = 0;
    let tariffRevenue = 0;
    let tariffSubsidy = 0;
    const localResourceChanges = {};
    const playerResourceChanges = {};

    // 决策结果记录 (用于UI显示)
    const decisions = {
        inputs: {}, // { resource: 'local' | 'home' }
        outputs: {}, // { resource: 'local' | 'home' }
    };

    const recordTariff = (amount) => {
        if (!Number.isFinite(amount) || amount === 0) return;
        tariffCost += amount;
        if (amount > 0) {
            tariffRevenue += amount;
        } else if (amount < 0) {
            tariffSubsidy += Math.abs(amount);
        }
    };

    const getTariffCost = (resourceKey, amount, basePrice, tariffType) => {
        const rate = getTariffRateForPlayer(resourceKey, tariffType, partnerNation, taxPolicies, organizations, daysElapsed);
        if (!rate) return 0;
        return basePrice * amount * rate;
    };

    // 1. 计算投入成本 & 自动决策来源
    Object.entries(building.input || {}).forEach(([res, amount]) => {
        const effectiveAmount = amount * operatingFactor;
        const localPrice = getNationPrice(res);
        const homePrice = getHomePrice(res);
        const importTariffType = playerIsHome ? 'export' : 'import';
        const importTariff = getTariffCost(res, effectiveAmount, homePrice, importTariffType);
        const importCost = homePrice * (1 + transportRate) + importTariff;

        let useLocal = true;

        if (strategy === 'PROFIT_MAX') {
            // 选便宜的
            if (importCost < localPrice) useLocal = false;
        } else if (strategy === 'MARKET_DUMPING') {
            // 倾销模式：优先用国内原料 (去库存)
            useLocal = false;
        } else if (strategy === 'RESOURCE_EXTRACTION') {
            // 掠夺模式：倾向于就地取材降低成本，除非国内极其便宜
            if (importCost < localPrice * 0.8) useLocal = false;
        }

        decisions.inputs[res] = useLocal ? 'local' : 'home';

        if (useLocal) {
            // 当地采购
            const localInventory = getNationInventory(res, effectiveAmount);
            if (localInventory < effectiveAmount) inputAvailable = false;

            inputCost += effectiveAmount * localPrice;

            if (inputAvailable) {
                localResourceChanges[res] = (localResourceChanges[res] || 0) - effectiveAmount;
            }
        } else {
            // 国内进口
            const baseInput = effectiveAmount * homePrice;
            inputCost += baseInput;
            transportCost += baseInput * transportRate; // 运费
            recordTariff(importTariff);
            playerResourceChanges[res] = (playerResourceChanges[res] || 0) - effectiveAmount;
        }
    });

    if (!inputAvailable) {
        return { outputValue: 0, inputCost: 0, wageCost: 0, businessTaxCost: 0, profit: 0, transportCost: 0, tariffCost: 0, tariffRevenue: 0, tariffSubsidy: 0, inputAvailable: false, decisions };
    }

    // 2. 计算产出价值 & 自动决策去向
    let outputValue = 0;
    Object.entries(building.output || {}).forEach(([res, amount]) => {
        if (res === 'maxPop' || res === 'militaryCapacity') return;
        const effectiveAmount = amount * operatingFactor;

        const localPrice = getNationPrice(res);
        const homePrice = getHomePrice(res);
        const exportTariffType = playerIsHome ? 'import' : 'export';
        const exportTariff = getTariffCost(res, effectiveAmount, localPrice, exportTariffType);
        const exportNetValue = homePrice * (1 - transportRate) - exportTariff;

        let sellLocal = true;

        if (strategy === 'PROFIT_MAX') {
            // 选卖得贵的 (净收入)
            if (exportNetValue > localPrice) sellLocal = false;
        } else if (strategy === 'RESOURCE_EXTRACTION') {
            // 掠夺模式：强制运回国内 (除非亏损严重? 暂定强制)
            sellLocal = false;
        } else if (strategy === 'MARKET_DUMPING') {
            // 倾销模式：强制当地销售抢占市场
            sellLocal = true;
        }

        decisions.outputs[res] = sellLocal ? 'local' : 'home';

        if (sellLocal) {
            // 当地销售
            outputValue += effectiveAmount * localPrice;
            localResourceChanges[res] = (localResourceChanges[res] || 0) + effectiveAmount;
        } else {
            // 运回国内
            const grossValue = effectiveAmount * homePrice;
            const transport = grossValue * transportRate;

            outputValue += (grossValue - transport); // 净收入
            transportCost += transport;
            recordTariff(exportTariff);
            playerResourceChanges[res] = (playerResourceChanges[res] || 0) + effectiveAmount;
        }
    });

    // 3. 计算工资
    const { total: wageCost, breakdown: wageBreakdown } = calculateVassalWageCost(building, targetNation, operatingFactor);

    // 4. [FIX] 计算营业税成本（与 simulation.js 保持一致）
    // 外资企业也需要向当地政府缴纳营业税，和国内业主一样
    const businessTaxBase = building.businessTaxBase ?? 0.1;
    // 默认营业税率为 1.0（即基础值 * 1.0）
    // 未来可以根据目标国家的税率政策调整
    const businessTaxRate = 1.0;
    const businessTaxCost = businessTaxBase * businessTaxRate;

    // 5. 市场规模因子：小国市场无法支撑完全产出
    const targetPopulation = targetNation?.population || 100;
    const marketScaleFactor = Math.min(1.0, Math.max(0.05, Math.sqrt(targetPopulation / 5000)));

    // 6. 总利润（扣除营业税，乘以市场规模因子）
    const rawProfit = outputValue - inputCost - wageCost - businessTaxCost - tariffCost;
    const profit = rawProfit * marketScaleFactor;

    return {
        outputValue,
        inputCost,
        wageCost,
        wageBreakdown,
        businessTaxCost, // [NEW] 返回营业税成本供 UI 显示
        transportCost,
        tariffCost,
        tariffRevenue,
        tariffSubsidy,
        profit,
        staffingFactor,
        inputFactor,
        warFactor,
        operatingFactor,
        inputAvailable: true,
        localResourceChanges,
        playerResourceChanges,
        decisions // Return strategy decisions for UI
    };
}





/**
 * 阶层期望生活水平 (Standard of Living)
 * 必须与 nations.js 中的定义保持一致
 */
const STRATUM_EXPECTATIONS = {
    elites: 15.0,
    commoners: 3.0,
    underclass: 1.0
};

/**
 * 计算附庸国/投资国工资成本 (深度整合版)
 * 基于真实的阶层人口供需和生活水平计算市场工资
 * @param {Object} building - 建筑配置
 * @param {Object} nation - 目标国家
 * @returns {Object} - { total: 工资成本, breakdown: 明细 }
 */
function calculateVassalWageCost(building, nation, operatingFactor = 1) {
    if (!building.jobs) return { total: 0, breakdown: [] };

    // 从附庸政策获取劳工工资修正
    const laborPolicy = nation?.vassalPolicy?.labor || 'standard';
    // Use centralized config for wage multiplier
    const laborWageMultiplier = getLaborWageMultiplier(laborPolicy);
    const wagePressure = Math.max(0.75, Math.min(1.45, Number(nation?.virtualLabor?.wagePressure ?? 1)));
    const employmentRate = Math.max(0.2, Math.min(1, Number(nation?.virtualLabor?.employmentRate ?? 0.7)));

    let totalWage = 0;
    const wageBreakdown = [];
    const marketPrices = nation.market?.prices || nation.prices || {};

    Object.entries(building.jobs).forEach(([stratumId, count]) => {
        // [Overseas Logic] In overseas investments, the 'owner' in building config is irrelevant.
        // The investor (player) pays wages to ALL local workers defined in jobs.
        // So we do NOT skip building.owner here.

        const stratumConfig = STRATA[stratumId];
        if (!stratumConfig) {
            // console.log(`[Overseas] Missing stratum config for ${stratumId}. STRATA keys: ${Object.keys(STRATA || {})}`);
            return;
        }

        // 1. 计算生存成本 (Subsistence Cost)
        let subsistenceCost = 0;
        if (stratumConfig.needs) {
            Object.entries(stratumConfig.needs).forEach(([resKey, amount]) => {
                const price = marketPrices[resKey] || RESOURCES[resKey]?.basePrice || 1;
                subsistenceCost += amount * price;
            });
        }

        // 2. 确定期望工资基准
        // 正常情况下，工资应足以维持期望的 SoL (Standard of Living)
        // Wage = Subsistence * Expected_SoL
        const expectedSoL = STRATUM_EXPECTATIONS[stratumId] || 1.0;
        const baseWage = subsistenceCost * expectedSoL;

        // 3. 计算劳动力供需因子
        // 如果该阶层人口稀少，工资上涨
        let supplyFactor = 1.0;
        if (nation.socialStructure && nation.socialStructure[stratumId]) {
            const stratumPop = nation.socialStructure[stratumId].population || 1000;
            // 简单模型：如果需求(count)占总人口比例过高，成本指数上升
            // 假设该建筑只占总需求的很小一部分，但我们需要一个能够反映"该国劳动力充裕度"的指标
            // 如果人口很少 (e.g. < 500)，供应紧张，工资上涨
            if (stratumPop < 500) {
                supplyFactor = 1.5;
            } else if (stratumPop > 10000) {
                supplyFactor = 0.8; // 劳动力过剩，工资降低
            }

            // 如果该阶层当前生活水平很高，他们可能要求更高工资？
            // 或者：如果当前生活水平低，他们愿意接受低工资？
            // 经济学上：工资决定生活水平。但在博弈中，已有生活水平高的群体议价能力强。
            const currentSoL = nation.socialStructure[stratumId].sol || 1.0;
            if (currentSoL > expectedSoL) {
                supplyFactor *= 1.1; // 议价能力强
            }
        }

        // 4. 综合计算单人日工资
        // Final Wage = Base * Supply * Policy
        const wagePerWorker = baseWage * supplyFactor * laborWageMultiplier * wagePressure * (0.92 + employmentRate * 0.16);
        const totalStratumWage = count * Math.max(0.15, operatingFactor) * wagePerWorker;

        totalWage += totalStratumWage;
        wageBreakdown.push({
            stratumId,
            count,
            wagePerWorker,
            total: totalStratumWage,
            laborPolicy,
            laborMultiplier: laborWageMultiplier,
            baseWage,
            supplyFactor
        });
    });

    return { total: totalWage, breakdown: wageBreakdown };
}

/**
 * 比较两国劳动力成本
 * @param {string} buildingId - 建筑ID
 * @param {Object} nationA - 国家A (通常是本国)
 * @param {Object} nationB - 国家B (通常是附庸国)
 * @returns {Object} - { ratio: number, wageA: number, wageB: number } ratio < 1 意味着B更便宜
 */
export function compareLaborCost(buildingId, nationA, nationB) {
    const building = BUILDINGS.find(b => b.id === buildingId);
    if (!building) return { ratio: 1, wageA: 0, wageB: 0 };

    const wageA = calculateVassalWageCost(building, nationA).total;
    const wageB = calculateVassalWageCost(building, nationB).total;

    if (wageA === 0) return { ratio: 1, wageA, wageB };
    return {
        ratio: wageB / wageA,
        wageA,
        wageB
    };
}

/**
 * 获取资源基础价格
 * @param {string} resourceKey - 资源键
 * @returns {number} - 基础价格
 */
function getBasePrice(resourceKey) {
    const resource = RESOURCES[resourceKey];
    return resource?.basePrice || 1;
}

// ===== 结算流程 =====

/**
 * 处理所有海外投资的每日更新
 * @param {Object} params - 参数
 * @returns {Object} - { updatedInvestments, totalProfit, logs }
 */
export function processOverseasInvestments({
    overseasInvestments = [],
    nations = [],
    organizations = [],
    resources = {},
    marketPrices = {},
    classWealth = {},
    taxPolicies = {},
    daysElapsed = 0,
    ticksElapsed = 1, // [PERF] 批量结算倍率，默认1表示每tick执行
}) {
    const logs = [];
    let totalProfit = 0;
    let totalTariffRevenue = 0;
    let totalTariffSubsidy = 0;
    const profitByStratum = {};
    const updatedInvestments = [];

    // [PERF] 预建国家索引，避免循环内 nations.find
    const nationMap = new Map((nations || []).map(n => [n?.id, n]));

    // 资源变更汇总
    const marketChanges = {}; // { nationId: { resourceKey: delta } }
    const playerInventoryChanges = {}; // { resourceKey: delta }
    
    // 新增：投资对各国阶层经济的影响
    // 结构：{ nationId: { totalWages, profitsExtracted, localReinvestment } }
    const nationInvestmentEffects = {};
    
    // [FIX] 新增：按阶层累计海外投资的成本和收入数据
    const costsByStratum = {}; // { stratum: { outputValue, inputCost, wageCost, businessTaxCost, transportCost } }

    overseasInvestments.forEach(investment => {
        if (investment.status !== 'operating') {
            updatedInvestments.push(investment);
            return;
        }

        const multiplier = investment.count || 1;

        const targetNation = nationMap.get(investment.targetNationId);
        if (!targetNation) {
            updatedInvestments.push({ ...investment, status: 'suspended' });
            return;
        }

        // 检查战争状态
        if (targetNation.isAtWar && targetNation.warTarget === 'player') {
            // 与玩家交战，冻结利润
            const updated = { ...investment };
            updated.operatingData = { ...updated.operatingData };
            logs.push(`⚠️ 与 ${targetNation.name} 处于战争状态，海外投资利润被冻结`);
            updatedInvestments.push(updated);
            return;
        }

        // 根据运营模式计算利润
        // 根据配置计算利润
        const profitResult = calculateOverseasProfit(investment, targetNation, resources, marketPrices, {
            taxPolicies,
            organizations,
            daysElapsed,
            playerIsHome: true,
            partnerNation: targetNation,
        });
        const scaledProfit = (profitResult.profit || 0) * multiplier * ticksElapsed;
        const scaledOutput = (profitResult.outputValue || 0) * multiplier * ticksElapsed;
        const scaledInput = (profitResult.inputCost || 0) * multiplier * ticksElapsed;
        const scaledWage = (profitResult.wageCost || 0) * multiplier * ticksElapsed;
        const scaledBusinessTax = (profitResult.businessTaxCost || 0) * multiplier * ticksElapsed;
        const scaledTransport = (profitResult.transportCost || 0) * multiplier * ticksElapsed;
        const scaledTariffCost = (profitResult.tariffCost || 0) * multiplier * ticksElapsed;
        const scaledTariffRevenue = (profitResult.tariffRevenue || 0) * multiplier * ticksElapsed;
        const scaledTariffSubsidy = (profitResult.tariffSubsidy || 0) * multiplier * ticksElapsed;

        // 汇总资源变更（同样乘以ticksElapsed倍率）
        if (profitResult.localResourceChanges) {
            if (!marketChanges[investment.targetNationId]) {
                marketChanges[investment.targetNationId] = {};
            }
            Object.entries(profitResult.localResourceChanges).forEach(([res, delta]) => {
                marketChanges[investment.targetNationId][res] = (marketChanges[investment.targetNationId][res] || 0) + delta * multiplier * ticksElapsed;
            });
        }

        if (profitResult.playerResourceChanges) {
            Object.entries(profitResult.playerResourceChanges).forEach(([res, delta]) => {
                playerInventoryChanges[res] = (playerInventoryChanges[res] || 0) + delta * multiplier * ticksElapsed;
            });
        }

        // 计算利润汇回 (Strict Rules Logic)
        let targetTaxRate = 0.60; // 默认：无协议时的惩罚性税率 (60%)

        const isVassal = targetNation.vassalOf === 'player';
        const hasTreaty = hasActiveTreaty(targetNation, 'investment_pact', daysElapsed);
        const inBloc = isInSameBloc(targetNation, organizations);

        // [DEBUG] Log tax rate determination factors
        // console.log(`[Tax Rate] Determining tax for investment in ${targetNation.name}:`, {
        //     nationId: targetNation.id,
        //     isVassal,
        //     hasTreaty,
        //     inBloc,
        //     organizationsCount: organizations?.length || 0,
        // });

        // console.log(`[Tax Rate] BEFORE branch selection - isVassal: ${isVassal}, inBloc: ${inBloc}, hasTreaty: ${hasTreaty}`);
        
        // 使用最低税率原则：计算所有适用税率，取最优惠的
        const applicableRates = [];
        
        if (isVassal) {
            // 1. 附庸国 (Suzerain Privilege): Based on Vassal Type Exemption
            const vassalConfig = VASSAL_TYPE_CONFIGS[targetNation.vassalType];
            // Base Treaty Rate (25%) reduced by exemption privilege
            // If exemption is 1.0 (Colony), tax is 0.
            // If exemption is 0.2 (Protectorate), tax is 25% * 0.8 = 20%.
            const exemption = vassalConfig?.economicPrivileges?.profitTaxExemption || 0;
            const vassalRate = 0.25 * (1 - exemption);
            applicableRates.push({ source: 'VASSAL', rate: vassalRate });
        }
        
        if (inBloc) {
            // 2. 经济共同体 (Common Market): 10% 税率
            applicableRates.push({ source: 'ECONOMIC_BLOC', rate: 0.10 });
        }
        
        if (hasTreaty) {
            // 3. 投资协定 (Standard Pact): 固定 25% 税率
            applicableRates.push({ source: 'TREATY', rate: 0.25 });
        }
        
        // 选择最低税率
        if (applicableRates.length > 0) {
            const bestRate = applicableRates.reduce((best, current) => 
                current.rate < best.rate ? current : best
            );
            targetTaxRate = bestRate.rate;
            // console.log(`[Tax Rate] Available rates: ${applicableRates.map(r => `${r.source}=${(r.rate*100).toFixed(1)}%`).join(', ')}`);
            // console.log(`[Tax Rate] SELECTED=${bestRate.source}, rate=${(targetTaxRate * 100).toFixed(1)}%`);
        } else {
            // 4. 无条约 (关系恶化导致协定终止): 惩罚性税率 60%
            targetTaxRate = 0.60;
            // console.log(`[Tax Rate] No applicable rates, using DEFAULT=60%`);
        }
        
        // console.log(`[Tax Rate] FINAL for ${targetNation.name}: ${(targetTaxRate * 100).toFixed(1)}%`);

        // [FIX] Allow negative profits (losses) - no more Math.max(0, ...)
        // 只有正利润才需缴税；亏损时税额为0，全额亏损由投资者承担
        const taxPaid = scaledProfit > 0 ? scaledProfit * targetTaxRate : 0;
        const repatriatedProfit = scaledProfit - taxPaid; // Allow negative
        const retainedProfit = taxPaid;

        // 更新投资记录
        const updated = { ...investment };

        // profitHistory 已移除（无组件读取，consecutiveLossDays 已单独追踪）

        // 自动撤资逻辑 (Autonomous Divestment - Probabilistic)
        const isUnprofitable = repatriatedProfit <= 0;
        const consecutiveLossDays = isUnprofitable ? (updated.operatingData?.consecutiveLossDays || 0) + 1 : 0;

        // 从连续亏损30天起，每天有概率移除
        if (consecutiveLossDays >= 30) {
            // 基础概率 1%
            let divestProbability = 0.01;

            // 时间系数：每超过1天增加 0.5%
            const daysFactor = (consecutiveLossDays - 30) * 0.005;
            divestProbability += daysFactor;

            // 亏损系数：亏损越多概率越大 (如果利润为负)
            // profitResult.profit 是日利润。如果为负，则为亏损。
            // 注意：repatriatedProfit 在亏损时为0 (Math.max(0, ...))，所以不能用它判断亏损深度。
            // 我们应该用 profitResult.profit (原始利润)
            if (scaledProfit < 0) {
                const lossRatio = Math.abs(scaledProfit) / (updated.investmentAmount || 1000);
                // 假设日亏损 1% 投资额增加 1% 概率 (1:1 Ratio)
                divestProbability += lossRatio;
            }

            // 上限 50%
            divestProbability = Math.min(0.5, divestProbability);

            if (Math.random() < divestProbability) {
                logs.push(`📉 由于长期入不敷出（${consecutiveLossDays}天），${STRATA[updated.ownerStratum]?.name || '业主'}决定关闭在 ${targetNation.name} 的 ${BUILDINGS.find(b => b.id === updated.buildingId)?.name}。`);

                const salvageValue = (updated.investmentAmount || 0) * 0.1;
                profitByStratum[updated.ownerStratum] = (profitByStratum[updated.ownerStratum] || 0) + salvageValue;

                // Skip adding to updatedInvestments -> Effectively removed from UI and Logic
                return;
            }
        }

        // 只保留 UI 和逻辑必需的标量字段，不继承旧 operatingData 中可能存在的中间对象
        updated.operatingData = {
            outputValue: scaledOutput,
            inputCost: scaledInput,
            wageCost: scaledWage,
            businessTaxCost: scaledBusinessTax,
            transportCost: scaledTransport,
            tariffCost: scaledTariffCost,
            tariffRevenue: scaledTariffRevenue,
            tariffSubsidy: scaledTariffSubsidy,
            profit: scaledProfit,
            repatriatedProfit,
            retainedProfit,
            effectiveTaxRate: targetTaxRate,
            decisions: profitResult.decisions,
            consecutiveLossDays,
            laborShortage: profitResult.inputAvailable === false ? 1 : 0,
            frozenProfit: updated.operatingData?.frozenProfit || 0,
        };

        // 累加利润
        totalProfit += repatriatedProfit;
        totalTariffRevenue += scaledTariffRevenue;
        totalTariffSubsidy += scaledTariffSubsidy;
        profitByStratum[investment.ownerStratum] =
            (profitByStratum[investment.ownerStratum] || 0) + repatriatedProfit;
        
        // [FIX] 累加各阶层的成本和收入数据
        const stratum = investment.ownerStratum;
        if (!costsByStratum[stratum]) {
            costsByStratum[stratum] = {
                outputValue: 0,
                inputCost: 0,
                wageCost: 0,
                businessTaxCost: 0,
                transportCost: 0,
            };
        }
        costsByStratum[stratum].outputValue += scaledOutput;
        costsByStratum[stratum].inputCost += scaledInput;
        costsByStratum[stratum].wageCost += scaledWage;
        costsByStratum[stratum].businessTaxCost += scaledBusinessTax;
        costsByStratum[stratum].transportCost += scaledTransport;

        // 新增：累计投资对附庸国阶层经济的影响
        // 投资创造工资（流入当地底层和平民）和抽取利润（流出当地）
        const nationId = investment.targetNationId;
        if (!nationInvestmentEffects[nationId]) {
            nationInvestmentEffects[nationId] = {
                totalWages: 0,        // 支付给当地工人的工资
                profitsExtracted: 0,  // 被抽走的利润
                localReinvestment: 0, // 在当地再投资的金额
                taxRetained: 0,       // 被当地政府收取的税款
            };
        }
        
        // 估算支付给当地的工资（基于投资规模和利润）
        // 假设投资的20%用于支付当地工资（劳动密集型产业）
        const investmentAmount = investment.investmentAmount || 0;
        const estimatedWages = Math.max(0, scaledProfit * 0.3 + investmentAmount * 0.001);
        nationInvestmentEffects[nationId].totalWages += estimatedWages;
        
        // 抽走的利润（汇回给投资者的部分）
        if (repatriatedProfit > 0) {
            nationInvestmentEffects[nationId].profitsExtracted += repatriatedProfit;
        }
        
        // 税款留在当地
        nationInvestmentEffects[nationId].taxRetained += retainedProfit;
        
        // 部分再投资（如果投资在增长）
        const previousValue = investment.investmentAmount || 0;
        const currentValue = investmentAmount;
        if (currentValue > previousValue) {
            nationInvestmentEffects[nationId].localReinvestment += (currentValue - previousValue);
        }

        updatedInvestments.push(updated);
    });

    // 每月（30天）生成汇总日志
    if (daysElapsed % 30 === 0 && totalProfit > 0) {
        logs.push(`💰 海外投资本月利润汇回: ${totalProfit.toFixed(1)} 银币`);
        Object.entries(profitByStratum).forEach(([stratum, profit]) => {
            if (profit > 0) {
                logs.push(`  • ${stratum}阶层: +${profit.toFixed(1)}`);
            }
        });
    }

    return {
        updatedInvestments: consolidateOverseasInvestments(updatedInvestments),
        totalProfit,
        tariffRevenue: totalTariffRevenue,
        tariffSubsidy: totalTariffSubsidy,
        profitByStratum,
        costsByStratum, // [FIX] 新增：各阶层的成本和收入数据
        logs,
        marketChanges,
        playerInventoryChanges,
        nationInvestmentEffects,  // 新增：投资对各国阶层的影响
    };
}

/**
 * 建立新的海外投资
 * @param {Object} params - 参数
 * @returns {Object} - { success, investment?, message, cost }
 */
export function establishOverseasInvestment({
    targetNation,
    buildingId,
    ownerStratum,
    strategy = 'PROFIT_MAX',
    existingInvestments = [],
    classWealth = {},
    daysElapsed = 0,
}) {
    // 检查是否可以投资
    const check = canEstablishOverseasInvestment(targetNation, buildingId, ownerStratum, existingInvestments);
    if (!check.canInvest) {
        return { success: false, message: check.reason };
    }

    // 获取建筑配置计算投资成本
    const building = BUILDINGS.find(b => b.id === buildingId);
    if (!building) {
        return { success: false, message: '无效的建筑类型' };
    }

    // 投资成本 = 建筑基础成本 × 1.5（海外溢价）
    // Fix: building config uses 'baseCost', not 'cost'. Fallback matching UI logic.
    const costConfig = building.cost || building.baseCost || {};
    const baseCost = Object.values(costConfig).reduce((sum, v) => sum + v, 0);

    // Apply Vassal Privilege Discount
    const isVassal = targetNation.vassalOf === 'player';
    const vassalConfig = isVassal ? VASSAL_TYPE_CONFIGS[targetNation.vassalType] : null;
    const discount = vassalConfig?.economicPrivileges?.investmentCostDiscount || 0;

    const investmentCost = baseCost * 1.5 * (1 - discount);

    // 检查业主阶层财富
    const stratumWealth = classWealth[ownerStratum] || 0;
    if (stratumWealth < investmentCost) {
        return { success: false, message: `${ownerStratum}阶层资金不足` };
    }

    // 创建投资记录
    const investment = createOverseasInvestment({
        buildingId,
        targetNationId: targetNation.id,
        ownerStratum,
        strategy,
        investmentAmount: investmentCost,
    });

    investment.createdDay = daysElapsed;

    return {
        success: true,
        investment,
        cost: investmentCost,
        message: `成功在 ${targetNation.name} 建立 ${building.name}`,
    };
}

/**
 * 国有化外资建筑
 * @param {Object} investment - 外资投资记录
 * @param {Object} ownerNation - 业主国家
 * @returns {Object} - { success, relationPenalty, message }
 */
export function nationalizeInvestment(investment, ownerNation) {
    if (investment.status === 'nationalized') {
        return { success: false, message: '该投资已被国有化' };
    }

    // 国有化惩罚
    const relationPenalty = -30;
    const investmentValue = investment.investmentAmount || 0;

    return {
        success: true,
        relationPenalty,
        compensationOwed: investmentValue * 0.5,  // 应付赔偿（通常不支付）
        message: `国有化 ${ownerNation?.name || '外国'} 的投资，关系下降 ${Math.abs(relationPenalty)}`,
    };
}

/**
 * 获取玩家在某国的所有投资
 * @param {Array} overseasInvestments - 所有海外投资
 * @param {string} nationId - 目标国家ID
 * @returns {Array} - 该国的投资列表
 */
export function getInvestmentsInNation(overseasInvestments, nationId) {
    return overseasInvestments.filter(inv =>
        inv.targetNationId === nationId && inv.status === 'operating'
    );
}

/**
 * 计算海外投资总收益（用于UI显示）
 * @param {Array} overseasInvestments - 所有海外投资
 * @returns {Object} - { totalValue, monthlyProfit, byNation, byStratum }
 */
export function calculateOverseasInvestmentSummary(overseasInvestments, targetNationId) {
    const summary = {
        totalValue: 0,
        estimatedMonthlyProfit: 0,
        estimatedDailyProfit: 0,
        byNation: {}, // Keyed by nation ID (string)
        byStratum: {},
        count: 0,
    };

    if (!overseasInvestments || !Array.isArray(overseasInvestments)) return summary;

    overseasInvestments.forEach(inv => {
        // If targetNationId is provided, filter by it.
        // inv.targetNationId might be string or number, force string comparison if needed.
        if (targetNationId && String(inv.targetNationId) !== String(targetNationId)) return;

        if (inv.status !== 'operating') return;

        const invCount = inv.count || 1;
        summary.count += invCount;
        summary.totalValue += inv.investmentAmount || 0;

        const dailyProfit = inv.operatingData?.profit || 0;
        const monthlyProfit = dailyProfit * 30;

        summary.estimatedDailyProfit += dailyProfit;
        summary.estimatedMonthlyProfit += monthlyProfit;

        // 按国家统计
        if (!summary.byNation[inv.targetNationId]) {
            summary.byNation[inv.targetNationId] = { count: 0, value: 0, profit: 0, dailyProfit: 0 };
        }
        summary.byNation[inv.targetNationId].count += invCount;
        summary.byNation[inv.targetNationId].value += inv.investmentAmount || 0;
        summary.byNation[inv.targetNationId].profit += monthlyProfit;
        summary.byNation[inv.targetNationId].dailyProfit += dailyProfit;

        // 按阶层统计
        if (!summary.byStratum[inv.ownerStratum]) {
            summary.byStratum[inv.ownerStratum] = { count: 0, value: 0, profit: 0, dailyProfit: 0 };
        }
        summary.byStratum[inv.ownerStratum].count += invCount;
        summary.byStratum[inv.ownerStratum].value += inv.investmentAmount || 0;
        summary.byStratum[inv.ownerStratum].profit += monthlyProfit;
        summary.byStratum[inv.ownerStratum].dailyProfit += dailyProfit;
    });

    return summary;
}

// ===== 外资系统（AI在玩家国投资）=====

/**
 * 外资税率政策配置
 * taxRate: 玩家设定的附加税率（与外交规则税率取较高值）
 * relationImpact: 每月对有投资国家的关系影响
 * investmentMultiplier: AI投资概率乘数
 */
export const FOREIGN_INVESTMENT_POLICIES = {
    preferential: {
        taxRate: 0.05,
        relationImpact: 2,
        investmentMultiplier: 1.5,
        label: '优惠税率',
        description: '降低税率吸引外资，改善与投资国关系',
        color: 'green',
    },
    normal: {
        taxRate: 0.10,
        relationImpact: 0,
        investmentMultiplier: 1.0,
        label: '正常税率',
        description: '默认税率档位，无额外外交影响',
        color: 'gray',
    },
    increased_tax: {
        taxRate: 0.25,
        relationImpact: -5,
        investmentMultiplier: 0.5,
        label: '加税',
        description: '提高税收收入，但会恶化与投资国关系',
        color: 'yellow',
    },
    heavy_tax: {
        taxRate: 0.50,
        relationImpact: -15,
        investmentMultiplier: 0.1,
        label: '重税',
        description: '大幅提高税收，严重恶化外交关系并抑制外资',
        color: 'red',
    },
};

/**
 * 处理外资建筑每日更新 (Dynamic Logic)
 * 使用 calculateOverseasProfit 动态决定供应链（本地采购 vs 进口）
 * @param {Object} params - 参数
 * @returns {Object} - { updatedInvestments, taxRevenue, profitOutflow, logs, marketChanges }
 */
export function processForeignInvestments({
    foreignInvestments = [],
    nations = [],
    organizations = [],
    playerMarket = {},
    playerResources = {},
    foreignInvestmentPolicy = 'normal',
    foreignInvestmentPolicyOverrides = {},
    taxPolicies = {},
    daysElapsed = 0,
    // [NEW] 用于计算实际到岗率
    jobFill = {},
    buildings = {},
    ticksElapsed = 1, // [PERF] 批量结算倍率，默认1表示每tick执行
}) {
    const logs = [];
    let totalTaxRevenue = 0;
    let totalProfitOutflow = 0;
    let totalTariffRevenue = 0;
    let totalTariffSubsidy = 0;
    const updatedInvestments = [];
    const globalPolicyConfig = FOREIGN_INVESTMENT_POLICIES[foreignInvestmentPolicy] || FOREIGN_INVESTMENT_POLICIES.normal;

    // Helper: 获取某国的有效税率政策配置（逐国覆盖优先，否则全局默认）
    const getEffectivePolicyConfig = (nationId) => {
        const override = foreignInvestmentPolicyOverrides[nationId];
        if (override && FOREIGN_INVESTMENT_POLICIES[override]) {
            return FOREIGN_INVESTMENT_POLICIES[override];
        }
        return globalPolicyConfig;
    };

    // [PERF] 预建国家索引
    const nationMap = new Map((nations || []).map(n => [n?.id, n]));

    // 追踪玩家市场变化 (被外资买入/卖出)
    const marketChanges = {}; // { resourceKey: delta }

    // 收集有投资的国家ID，用于计算关系影响
    const investingNationIds = new Set();

    foreignInvestments.forEach(investment => {
        if (investment.status !== 'operating') {
            updatedInvestments.push(investment);
            return;
        }

        // 记录有投资的国家
        if (investment.ownerNationId) investingNationIds.add(investment.ownerNationId);

        const building = BUILDINGS.find(b => b.id === investment.buildingId);
        if (!building) {
            updatedInvestments.push(investment);
            return;
        }

        const multiplier = investment.count || 1;

        // 1. 准备上下文
        // 投资国 (Owner) -> 相当于 "Home"
        const ownerNation = nationMap.get(investment.ownerNationId);
        // 如果找不到投资国，假设它有基础价格和无限库存
        // [FIX] AI国家的价格存储在 nationPrices 字段，需要添加到查询链
        const homePrices = ownerNation?.market?.prices || ownerNation?.nationPrices || ownerNation?.prices || {};
        const homeResources = ownerNation?.inventories || {}; // 用作 "PlayerResources" 参数 (Home Inventory)

        // 东道国 (Player) -> 相当于 "TargetNation"
        // 构造一个类似 Nation 的对象供 calculateOverseasProfit 使用
        const targetNation = {
            id: 'player',
            name: 'Player',
            market: playerMarket,
            inventories: playerResources,
            wealth: 10000, // 假设足够，影响库存模拟
            vassalPolicy: { labor: 'standard' }, // 玩家默认劳工政策
        };

        // 2. 确保 investment 有 strategy (默认为 Profit Max)
        const invWithStrategy = {
            ...investment,
            strategy: investment.strategy || 'PROFIT_MAX'
        };

        // 3. 调用核心计算逻辑
        // calculateOverseasProfit(investment, targetNation, playerResources, playerMarketPrices)
        // investment: 投资对象
        // targetNation: 建筑所在地 (Player)
        // playerResources: 母国库存 (AI Owner Inventory) - 用于判断是否能从母国进口
        // playerMarketPrices: 母国价格 (AI Owner Prices)
        const profitResult = calculateOverseasProfit(
            invWithStrategy,
            targetNation,
            homeResources,
            homePrices,
            {
                taxPolicies,
                organizations,
                daysElapsed,
                playerIsHome: false,
                partnerNation: ownerNation,
            }
        );

        // 4. [NEW] 计算实际到岗率并应用到利润
        // 外资企业的实际利润取决于玩家建筑的岗位填充率
        const buildingJobs = building.jobs || {};
        const buildingCount = buildings[building.id] || 0;
        const buildingJobFillData = jobFill[building.id] || {};

        let totalSlots = 0;
        let filledSlots = 0;
        Object.entries(buildingJobs).forEach(([role, slotsPerBuilding]) => {
            const totalRoleSlots = slotsPerBuilding * buildingCount;
            totalSlots += totalRoleSlots;
            filledSlots += Math.min(buildingJobFillData[role] || 0, totalRoleSlots);
        });

        // [FIX] 计算到岗率 - 当玩家没有该类型建筑时，外资企业仍应能正常运营
        // 原逻辑：buildingCount=0 时 staffingRatio=0，导致外资利润和税收为0
        // 修复：如果玩家没有该建筑，假设外资有独立劳动力来源，默认100%到岗率
        let staffingRatio = 1.0; // 默认假设外资能独立运营
        if (totalSlots > 0 && buildingCount > 0) {
            // 如果玩家有该类型建筑，使用玩家的到岗率作为参考
            staffingRatio = filledSlots / totalSlots;
        }

        // 5. 处理结果 - 利润乘以到岗率，再乘以ticksElapsed批量结算倍率
        // 理论利润 * 到岗率 * 累积tick数 = 实际利润
        const theoreticalProfit = (profitResult.profit || 0) * multiplier;
        const dailyProfit = theoreticalProfit * staffingRatio * ticksElapsed;
        const theoreticalTariffRevenue = (profitResult.tariffRevenue || 0) * multiplier;
        const theoreticalTariffSubsidy = (profitResult.tariffSubsidy || 0) * multiplier;
        const theoreticalTariffCost = (profitResult.tariffCost || 0) * multiplier;
        const scaledTariffRevenue = theoreticalTariffRevenue * staffingRatio * ticksElapsed;
        const scaledTariffSubsidy = theoreticalTariffSubsidy * staffingRatio * ticksElapsed;
        const scaledTariffCost = theoreticalTariffCost * staffingRatio * ticksElapsed;

        // 计算税收 (Strict Rules Logic for Foreign Investment)
        // Step 1: 外交规则决定的基础税率
        let diplomaticTaxRate = 0.60; // 默认惩罚性税率 60%
        const isVassal = ownerNation && ownerNation.vassalOf === 'player';
        const hasTreaty = ownerNation ? hasActiveTreaty(ownerNation, 'investment_pact', daysElapsed) : false;
        const inBloc = isInSameBloc(ownerNation, organizations);

        if (isVassal) {
            diplomaticTaxRate = 0.25;
            if (inBloc) diplomaticTaxRate = 0.10;
        } else if (inBloc) {
            diplomaticTaxRate = 0.10;
        } else if (hasTreaty) {
            diplomaticTaxRate = 0.25;
        } else {
            diplomaticTaxRate = 0.60;
        }

        // Step 2: 获取该国的有效税率政策（逐国覆盖优先）
        const policyConfig = getEffectivePolicyConfig(investment.ownerNationId);
        // 外交规则是下限，玩家只能在此基础上加税，不能低于外交规则
        const effectiveTaxRate = Math.max(diplomaticTaxRate, policyConfig.taxRate);

        const taxAmount = dailyProfit > 0 ? dailyProfit * effectiveTaxRate : 0;
        const profitAfterTax = dailyProfit > 0 ? dailyProfit * (1 - effectiveTaxRate) : 0;

        totalTaxRevenue += taxAmount;
        totalProfitOutflow += profitAfterTax;
        totalTariffRevenue += scaledTariffRevenue;
        totalTariffSubsidy += scaledTariffSubsidy;

        // 记录市场变化
        if (profitResult.localResourceChanges) {
            Object.entries(profitResult.localResourceChanges).forEach(([res, delta]) => {
                marketChanges[res] = (marketChanges[res] || 0) + delta * multiplier;
            });
        }

        // 计算岗位数
        const jobsProvided = building.jobs ? Object.values(building.jobs).reduce((a, b) => a + b, 0) * multiplier : 0;

        // 自动撤资逻辑 (Autonomous Divestment for Foreign Investors - Probabilistic)
        const isUnprofitable = profitAfterTax <= 0;
        const consecutiveLossDays = isUnprofitable ? (investment.operatingData?.consecutiveLossDays || 0) + 1 : 0;

        if (consecutiveLossDays >= 30) {
            let divestProbability = 0.01;
            const daysFactor = (consecutiveLossDays - 30) * 0.005;
            divestProbability += daysFactor;

            // 亏损系数
            if (dailyProfit < 0) {
                // 估算投资额用于比率计算 (假设基准 1000)
                const estimatedInvestment = 1000;
                divestProbability += Math.abs(dailyProfit) / estimatedInvestment;
            }

            divestProbability = Math.min(0.5, divestProbability);

            if (Math.random() < divestProbability) {
                const unitCount = investment.count || 1;
                if (unitCount > 1) {
                    const perUnitAmount = (investment.investmentAmount || 0) / unitCount;
                    const remainingCount = unitCount - 1;
                    logs.push(`📉 ${ownerNation?.name || '外资'} 因长期亏损（${consecutiveLossDays}天），减少了在我国的 ${building.name} 投资（剩余${remainingCount}处）。`);
                    updatedInvestments.push({
                        ...invWithStrategy,
                        count: remainingCount,
                        investmentAmount: Math.max(0, (investment.investmentAmount || 0) - perUnitAmount),
                        dailyProfit: dailyProfit * (remainingCount / unitCount),
                        jobsProvided: jobsProvided * (remainingCount / unitCount),
                        operatingData: {
                            outputValue: (profitResult.outputValue || 0) * remainingCount,
                            inputCost: (profitResult.inputCost || 0) * remainingCount,
                            wageCost: (profitResult.wageCost || 0) * remainingCount,
                            businessTaxCost: (profitResult.businessTaxCost || 0) * remainingCount,
                            transportCost: (profitResult.transportCost || 0) * remainingCount,
                            tariffCost: (profitResult.tariffCost || 0) * remainingCount,
                            tariffRevenue: (profitResult.tariffRevenue || 0) * remainingCount,
                            tariffSubsidy: (profitResult.tariffSubsidy || 0) * remainingCount,
                            taxPaid: taxAmount * (remainingCount / unitCount),
                            profitRepatriated: profitAfterTax * (remainingCount / unitCount),
                            consecutiveLossDays,
                            staffingRatio,
                            theoreticalProfit: theoreticalProfit * (remainingCount / unitCount),
                            profit: dailyProfit * (remainingCount / unitCount),
                            decisions: profitResult.decisions,
                            diplomaticTaxRate,
                            policyTaxRate: policyConfig.taxRate,
                            effectiveTaxRate,
                        },
                    });
                } else {
                    logs.push(`📉 ${ownerNation?.name || '外资'} 因长期亏损（${consecutiveLossDays}天），撤出了在我国的 ${building.name} 投资。`);
                }
                return;
            }
        }

        // 更新投资记录（只存储 UI 必需的标量字段，不存 wageBreakdown/resourceChanges 等中间对象）
        updatedInvestments.push({
            ...invWithStrategy,
            dailyProfit: dailyProfit,
            jobsProvided: jobsProvided,
            operatingData: {
                outputValue: (profitResult.outputValue || 0) * multiplier,
                inputCost: (profitResult.inputCost || 0) * multiplier,
                wageCost: (profitResult.wageCost || 0) * multiplier,
                businessTaxCost: (profitResult.businessTaxCost || 0) * multiplier,
                transportCost: (profitResult.transportCost || 0) * multiplier,
                tariffCost: scaledTariffCost,
                tariffRevenue: scaledTariffRevenue,
                tariffSubsidy: scaledTariffSubsidy,
                taxPaid: taxAmount,
                profitRepatriated: profitAfterTax,
                consecutiveLossDays,
                staffingRatio,
                theoreticalProfit,
                profit: dailyProfit,
                decisions: profitResult.decisions,
                diplomaticTaxRate,
                policyTaxRate: policyConfig.taxRate,
                effectiveTaxRate,
            },
        });
    });

    // 每月日志
    if (daysElapsed % 30 === 0 && foreignInvestments.length > 0) {
        logs.push(`🏭 外资月报: 税收+${(totalTaxRevenue * 30).toFixed(0)}, 利润外流-${(totalProfitOutflow * 30).toFixed(0)}`);
    }

    // 计算关系影响：逐国使用各自有效档位的 relationImpact，每日1/30月度影响
    const relationChanges = [];
    investingNationIds.forEach(nationId => {
        const nationPolicyConfig = getEffectivePolicyConfig(nationId);
        if (nationPolicyConfig.relationImpact !== 0) {
            const dailyImpact = nationPolicyConfig.relationImpact / 30;
            relationChanges.push({ nationId, change: dailyImpact });
        }
    });

    return {
        updatedInvestments: consolidateForeignInvestments(updatedInvestments),
        taxRevenue: totalTaxRevenue,
        tariffRevenue: totalTariffRevenue,
        tariffSubsidy: totalTariffSubsidy,
        profitOutflow: totalProfitOutflow,
        logs,
        marketChanges, // 返回给 GameLoop 使用 (如果支持)
        relationChanges, // 税率政策对投资国的关系影响
        currentPolicy: foreignInvestmentPolicy, // 当前政策标识，供日志使用
    };
}

/**
 * 处理外资建筑自动升级
 * 外资企业会自动升级在玩家国的建筑（类似本国业主和官员的升级逻辑）
 * 
 * @param {Object} params - 参数
 * @returns {Object} - { updatedInvestments, upgrades, logs }
 */
export function processForeignInvestmentUpgrades({
    foreignInvestments = [],
    nations = [],
    playerMarket = {},
    playerResources = {},
    buildingUpgrades = {},
    buildingCounts = {},
    daysElapsed = 0,
}) {
    const logs = [];
    const upgrades = []; // Record of upgrades to apply
    const updatedInvestments = [...foreignInvestments];

    // Constants for upgrade logic
    const UPGRADE_COOLDOWN = 60; // Days between upgrades per investment
    const UPGRADE_CHANCE_PER_CHECK = 0.03; // 3% chance per day per eligible investment
    const MIN_ROI_FOR_UPGRADE = 0.05; // Minimum 5% ROI to consider upgrade
    const MIN_NATION_WEALTH_FOR_UPGRADE = 10000; // Investor nation must have this much wealth

    // [PERF] 预建国家索引
    const nationMap = new Map((nations || []).map(n => [n?.id, n]));

    foreignInvestments.forEach((investment, index) => {
        if (investment.status !== 'operating') return;

        // Check upgrade cooldown
        const lastUpgradeDay = investment.lastUpgradeDay || 0;
        if (daysElapsed - lastUpgradeDay < UPGRADE_COOLDOWN) return;

        // Random chance check (to avoid all upgrades happening at once)
        if (Math.random() > UPGRADE_CHANCE_PER_CHECK) return;

        // Get the building config
        const building = BUILDINGS.find(b => b.id === investment.buildingId);
        if (!building) return;

        // Check if building has upgrades available
        const maxLevel = getMaxUpgradeLevel(building.id);
        if (maxLevel <= 0) return;

        // Get investor nation wealth
        const investorNation = nationMap.get(investment.ownerNationId);
        const nationWealth = investorNation?.wealth || 0;
        if (nationWealth < MIN_NATION_WEALTH_FOR_UPGRADE) return;

        // Determine current level of this specific investment
        // Foreign investments track their own level (default 0)
        const currentLevel = investment.upgradeLevel || 0;
        if (currentLevel >= maxLevel) return; // Already at max level

        const nextLevel = currentLevel + 1;

        // Get upgrade cost
        // For foreign investments, we calculate cost based on home market prices
        const homePrices = investorNation?.market?.prices || investorNation?.prices || {};
        const upgradeCost = getUpgradeCost(building.id, nextLevel, 0); // existingUpgradeCount=0 for base cost
        if (!upgradeCost) return;

        const unitCount = investment.count || 1;

        // Calculate cost in silver (using investor's home market prices)
        let totalCost = 0;
        for (const [resource, amount] of Object.entries(upgradeCost)) {
            if (resource === 'silver') {
                totalCost += amount;
            } else {
                const price = homePrices[resource] || playerMarket?.prices?.[resource] || RESOURCES[resource]?.basePrice || 1;
                totalCost += amount * price;
            }
        }
        totalCost *= unitCount;

        // Check if nation can afford (use 30% of wealth as max budget)
        const maxBudget = nationWealth * 0.3;
        if (totalCost > maxBudget) return;

        // Calculate ROI for the upgrade
        // Compare profit before and after upgrade
        const currentConfig = getBuildingEffectiveConfig(building, currentLevel);
        const nextConfig = getBuildingEffectiveConfig(building, nextLevel);

        // Calculate current profit
        const currentProfit = calculateSimpleBuildingProfit(building, currentConfig, playerMarket);
        const nextProfit = calculateSimpleBuildingProfit(building, nextConfig, playerMarket);
        const profitGain = (nextProfit - currentProfit) * unitCount;

        if (profitGain <= 0) return; // No profit improvement

        // ROI = (annual profit gain) / cost
        const annualProfitGain = profitGain * 365;
        const roi = annualProfitGain / totalCost;

        if (roi < MIN_ROI_FOR_UPGRADE) return; // ROI too low

        // === Execute the upgrade ===
        debugLog('overseas', `🏭 [外资升级] ${investorNation?.name || '外国'} 升级 ${building.name} Lv${currentLevel} → Lv${nextLevel}，花费 ${totalCost.toFixed(0)}，预计ROI ${(roi * 100).toFixed(1)}%`);

        // Record the upgrade
        upgrades.push({
            investmentId: investment.id,
            investmentIndex: index,
            buildingId: building.id,
            fromLevel: currentLevel,
            toLevel: nextLevel,
            cost: totalCost,
            ownerNationId: investment.ownerNationId,
            profitGain,
            roi,
        });

        // Update investment record
        updatedInvestments[index] = {
            ...investment,
            upgradeLevel: nextLevel,
            lastUpgradeDay: daysElapsed,
            // Update daily profit estimate based on new level
            dailyProfit: nextProfit * unitCount,
        };

        // Log
        // const nationName = investorNation?.name || '外国';
        // logs.push(`🏭 ${nationName}升级了在本国的 ${building.name}（Lv${currentLevel} → Lv${nextLevel}，花费 ${Math.ceil(totalCost)} 银）`);
    });

    return {
        updatedInvestments: consolidateForeignInvestments(updatedInvestments),
        upgrades,
        logs,
    };
}

/**
 * 强制附庸国对玩家进行反向投资 (Demand Investment)
 * @param {Object} vassal - 附庸国对象
 * @param {string} buildingId - 建筑ID
 * @returns {Object} - { success, message, investment, cost }
 */
export function demandVassalInvestment(vassal, buildingId) {
    if (vassal.vassalOf !== 'player') {
        return { success: false, message: '只能向附庸国索取投资' };
    }

    const building = BUILDINGS.find(b => b.id === buildingId);
    if (!building) return { success: false, message: '无效的建筑类型' };

    // Cost calculation (Standard cost for them)
    const costConfig = building.cost || building.baseCost || {};
    const baseCost = Object.values(costConfig).reduce((sum, v) => sum + v, 0);
    // Foreign investment usually implies higher cost (transport etc), but this is forced capital flight.
    // Let's say standard cost.
    const investmentCost = baseCost * 1.2;

    if ((vassal.wealth || 0) < investmentCost) {
        return { success: false, message: `${vassal.name} 国库资金不足` };
    }

    // Create the foreign investment record
    const investment = createForeignInvestment({
        buildingId,
        ownerNationId: vassal.id,
        investorStratum: 'state', // State-owned (forced)
    });

    return {
        success: true,
        message: `成功迫使 ${vassal.name} 投资 ${building.name}`,
        investment,
        cost: investmentCost
    };
}

/**
 * 简化的建筑利润计算（用于外资升级ROI评估）
 * @param {Object} building - 建筑配置
 * @param {Object} effectiveConfig - 升级后的有效配置
 * @param {Object} market - 市场数据
 * @returns {number} - 日利润
 */
function calculateSimpleBuildingProfit(building, effectiveConfig, market) {
    const prices = market?.prices || {};

    // Output value
    let outputValue = 0;
    const output = effectiveConfig?.output || building.output || {};
    Object.entries(output).forEach(([res, amount]) => {
        if (res === 'maxPop' || res === 'militaryCapacity') return;
        const price = prices[res] || RESOURCES[res]?.basePrice || 1;
        outputValue += amount * price;
    });

    // Input cost
    let inputCost = 0;
    const input = effectiveConfig?.input || building.input || {};
    Object.entries(input).forEach(([res, amount]) => {
        const price = prices[res] || RESOURCES[res]?.basePrice || 1;
        inputCost += amount * price;
    });

    // Simple wage estimate (not exact, but good enough for comparison)
    let wageCost = 0;
    const jobs = effectiveConfig?.jobs || building.jobs || {};
    Object.entries(jobs).forEach(([stratum, count]) => {
        if (building.owner && stratum === building.owner) return; // Owner doesn't pay self
        // Estimate wage as 10 silver per worker per day
        wageCost += count * 10;
    });

    return outputValue - inputCost - wageCost;
}

/**
 * AI决策：是否在玩家国建立投资
 * @param {Object} nation - AI国家
 * @param {Object} playerState - 玩家状态
 * @param {Array} existingInvestments - 现有外资
 * @returns {Object|null} - 投资决策或null
 */
export function aiDecideForeignInvestment(nation, playerState, existingInvestments = [], foreignInvestmentPolicy = 'normal', foreignInvestmentPolicyOverrides = {}) {
    // 检查是否有投资协议
    const hasInvestmentPact = hasActiveTreaty(nation, 'investment_pact', playerState?.daysElapsed || 0);

    if (!hasInvestmentPact) return null;

    // 检查关系
    if ((nation.relation || 50) < 40) return null;

    // 检查AI是否有足够财富
    const nationWealth = nation.wealth || 1000;
    if (nationWealth < 5000) return null;

    // 检查现有投资数量
    const currentInvestments = existingInvestments.filter(inv => inv.ownerNationId === nation.id);
    const maxInvestments = Math.floor(nationWealth / 10000) + 1;
    if (currentInvestments.length >= maxInvestments) return null;

    // 玩家税率政策影响投资概率（逐国覆盖优先）
    const effectivePolicy = foreignInvestmentPolicyOverrides[nation.id] || foreignInvestmentPolicy;
    const policyConfig = FOREIGN_INVESTMENT_POLICIES[effectivePolicy] || FOREIGN_INVESTMENT_POLICIES.normal;
    const baseChance = 0.10 / 30;
    const adjustedChance = baseChance * (policyConfig.investmentMultiplier || 1.0);

    // 随机决定是否投资
    if (Math.random() > adjustedChance) return null;

    // 选择投资建筑（偏好采集类）
    const preferredBuildings = ['farm', 'mine', 'lumber_camp', 'iron_mine', 'coal_mine', 'factory'];
    const availableBuildings = preferredBuildings.filter(bId => {
        const building = BUILDINGS.find(b => b.id === bId);
        return building && (building.epoch || 0) <= (playerState.epoch || 0);
    });

    if (availableBuildings.length === 0) return null;

    const selectedBuilding = availableBuildings[Math.floor(Math.random() * availableBuildings.length)];

    return {
        buildingId: selectedBuilding,
        ownerNationId: nation.id,
        investorStratum: 'capitalist',
    };
}

/**
 * 处理本国海外投资的自动升级
 * 本国业主（资本家/商人）会根据ROI自动升级海外资产
 * 
 * @param {Object} params - 参数
 * @returns {Object} - 升级结果
 */
export function processOverseasInvestmentUpgrades({
    overseasInvestments = [],
    nations = [],
    classWealth = {},
    marketPrices = {},
    daysElapsed = 0,
}) {
    const logs = [];
    const upgrades = []; // Record of upgrades to apply
    const updatedInvestments = [...overseasInvestments];
    const wealthChanges = {}; // { stratum: delta }

    // [PERF] 预建国家索引
    const nationMap = new Map((nations || []).map(n => [n?.id, n]));

    // Constants for upgrade logic
    const UPGRADE_COOLDOWN = 60; // Days between upgrades per investment
    const UPGRADE_CHANCE_PER_CHECK = 0.03; // 3% chance per day per eligible investment
    const MIN_ROI_FOR_UPGRADE = 0.05; // Minimum 5% ROI to consider upgrade
    const MIN_STRATUM_WEALTH_FOR_UPGRADE = 10000; // Owner stratum must have this much wealth

    overseasInvestments.forEach((investment, index) => {
        if (investment.status !== 'operating') return;

        // Check upgrade cooldown
        const lastUpgradeDay = investment.lastUpgradeDay || 0;
        if (daysElapsed - lastUpgradeDay < UPGRADE_COOLDOWN) return;

        // Random chance check (to avoid all upgrades happening at once)
        if (Math.random() > UPGRADE_CHANCE_PER_CHECK) return;

        // Get the building config
        const building = BUILDINGS.find(b => b.id === investment.buildingId);
        if (!building) return;

        // Check if building has upgrades available
        const maxLevel = getMaxUpgradeLevel(building.id);
        if (maxLevel <= 0) return;

        // Get owner stratum wealth
        const ownerStratum = investment.ownerStratum || 'capitalist';
        const stratumWealth = classWealth[ownerStratum] || 0;
        if (stratumWealth < MIN_STRATUM_WEALTH_FOR_UPGRADE) return;

        // Determine current level of this specific investment
        const currentLevel = investment.upgradeLevel || 0;
        if (currentLevel >= maxLevel) return; // Already at max level

        const nextLevel = currentLevel + 1;

        // Get target nation for market prices
        const targetNation = nationMap.get(investment.targetNationId);
        const targetPrices = targetNation?.market?.prices || targetNation?.prices || {};

        // Get upgrade cost
        const upgradeCost = getUpgradeCost(building.id, nextLevel, 0);
        if (!upgradeCost) return;

        const unitCount = investment.count || 1;

        // Calculate cost in silver (using player's home market prices)
        let totalCost = 0;
        for (const [resource, amount] of Object.entries(upgradeCost)) {
            if (resource === 'silver') {
                totalCost += amount;
            } else {
                // Use player market prices (domestic) for upgrade materials
                const price = marketPrices[resource] || 1;
                totalCost += amount * price;
            }
        }
        totalCost *= unitCount;

        // Check if stratum can afford (use 20% of wealth as max budget per upgrade)
        const maxBudget = stratumWealth * 0.2;
        if (totalCost > maxBudget) return;

        // Calculate ROI for the upgrade
        const currentConfig = getBuildingEffectiveConfig(building, currentLevel);
        const nextConfig = getBuildingEffectiveConfig(building, nextLevel);

        // Calculate profit using target nation's market prices
        const currentProfit = calculateSimpleBuildingProfit(building, currentConfig, { prices: targetPrices });
        const nextProfit = calculateSimpleBuildingProfit(building, nextConfig, { prices: targetPrices });
        const profitGain = (nextProfit - currentProfit) * unitCount;

        if (profitGain <= 0) return; // No profit improvement

        // ROI = (annual profit gain) / cost
        const annualProfitGain = profitGain * 365;
        const roi = annualProfitGain / totalCost;

        if (roi < MIN_ROI_FOR_UPGRADE) return; // ROI too low

        // === Execute the upgrade ===
        const targetName = targetNation?.name || '海外';
        debugLog('overseas', `🏭 [海外升级] ${ownerStratum} 升级 ${targetName} 的 ${building.name} Lv${currentLevel} → Lv${nextLevel}，花费 ${totalCost.toFixed(0)}，预计ROI ${(roi * 100).toFixed(1)}%`);

        // Record the upgrade
        upgrades.push({
            investmentId: investment.id,
            investmentIndex: index,
            buildingId: building.id,
            fromLevel: currentLevel,
            toLevel: nextLevel,
            cost: totalCost,
            ownerStratum,
            targetNationId: investment.targetNationId,
            profitGain,
            roi,
        });

        // Update investment record
        updatedInvestments[index] = {
            ...investment,
            upgradeLevel: nextLevel,
            lastUpgradeDay: daysElapsed,
            dailyProfit: nextProfit * unitCount,
        };

        // Deduct cost from owner stratum wealth
        wealthChanges[ownerStratum] = (wealthChanges[ownerStratum] || 0) - totalCost;

        // Log
        // const stratumName = STRATA[ownerStratum]?.name || ownerStratum;
        // logs.push(`🏭 ${stratumName}升级了在 ${targetName} 的 ${building.name}（Lv${currentLevel} → Lv${nextLevel}，花费 ${Math.ceil(totalCost)} 银）`);
    });

    return {
        updatedInvestments: consolidateOverseasInvestments(updatedInvestments),
        upgrades,
        wealthChanges,
        logs,
    };
}
