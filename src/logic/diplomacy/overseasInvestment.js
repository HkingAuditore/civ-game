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

import { BUILDINGS, RESOURCES, STRATA } from '../../config';
import { debugLog } from '../../utils/debugFlags';

// ===== 配置常量 =====

/**
 * 海外投资类型配置
 */
export const OVERSEAS_INVESTMENT_CONFIGS = {
    // 投资限制
    limits: {
        maxInvestmentRatio: 0.2,          // 最大投资占附庸GDP比例
        minRelationForInvestment: 30,      // 最低外交关系要求
        investmentCooldown: 30,            // 两次投资间隔（天）
    },

    // 运营配置 (灵活配置)
    config: {
        transportCostRate: 0.0,       // 跨国运输成本 (0%)
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
        targetNationId,
        ownerStratum,
        strategy: 'PROFIT_MAX', // Default strategy
        investmentAmount,
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
            profitHistory: [],
        },

        status: 'operating',        // 'operating' | 'suspended' | 'nationalized'
    };
}

/**
 * 创建外资建筑记录（外国在玩家国投资）
 * @param {Object} params - 投资参数
 * @returns {Object} - 外资建筑记录
 */
export function createForeignInvestment({
    buildingId,
    ownerNationId,
    investorStratum = 'capitalist',
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
    const estimatedDailyProfit = Math.max(0, outputValue - inputCost);

    return {
        id: `fi_${ownerNationId}_${buildingId}_${Date.now()}`,
        buildingId,
        ownerNationId,
        investorStratum,

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

    // Array form
    if (Array.isArray(treaties)) {
        return treaties.some(t => {
            if (!t || t.type !== treatyType) return false;
            if (t.withPlayer === false) return false;
            if (t.status === 'active') return true;
            // Treat missing status but valid endDay as active (legacy saves)
            if (!t.status && (t.endDay == null || t.endDay > daysElapsed)) return true;
            return false;
        });
    }

    // Map form
    const entry = treaties[treatyType];
    if (!entry) return false;
    if (entry.withPlayer === false) return false;
    if (entry.status === 'active') return true;
    if (!entry.status && (entry.endDay == null || entry.endDay > daysElapsed)) return true;
    return false;
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

    if (!isVassal && !hasInvestmentPact) {
        // 无协议时，仅允许建造贸易站
        if (buildingId !== 'trading_post') {
            return { canInvest: false, reason: '未签署投资协议，仅允许建立贸易站' };
        }
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
    const nationGDP = targetNation.wealth || 1000;
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
 */
export function calculateOverseasProfit(investment, targetNation, playerResources, playerMarketPrices = {}) {
    const building = BUILDINGS.find(b => b.id === investment.buildingId);
    if (!building) return { outputValue: 0, inputCost: 0, wageCost: 0, profit: 0, transportCost: 0 };

    const strategy = investment.strategy || 'PROFIT_MAX';
    const transportRate = OVERSEAS_INVESTMENT_CONFIGS.config.transportCostRate;

    // 价格获取器
    const getNationPrice = (res) => (targetNation.market?.prices || {})[res] || (targetNation.prices || {})[res] || playerMarketPrices[res] || getBasePrice(res);
    const getHomePrice = (res) => playerMarketPrices[res] || getBasePrice(res);

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
    const localResourceChanges = {};
    const playerResourceChanges = {};

    // 决策结果记录 (用于UI显示)
    const decisions = {
        inputs: {}, // { resource: 'local' | 'home' }
        outputs: {}, // { resource: 'local' | 'home' }
    };

    // 1. 计算投入成本 & 自动决策来源
    Object.entries(building.input || {}).forEach(([res, amount]) => {
        const localPrice = getNationPrice(res);
        const homePrice = getHomePrice(res);
        const importCost = homePrice * (1 + transportRate);

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
            const localInventory = getNationInventory(res, amount);
            if (localInventory < amount) inputAvailable = false;

            inputCost += amount * localPrice;

            if (inputAvailable) {
                localResourceChanges[res] = (localResourceChanges[res] || 0) - amount;
            }
        } else {
            // 国内进口
            const baseInput = amount * homePrice;
            inputCost += baseInput;
            transportCost += baseInput * transportRate; // 运费
            playerResourceChanges[res] = (playerResourceChanges[res] || 0) - amount;
        }
    });

    if (!inputAvailable) {
        return { outputValue: 0, inputCost: 0, wageCost: 0, profit: 0, transportCost: 0, inputAvailable: false, decisions };
    }

    // 2. 计算产出价值 & 自动决策去向
    let outputValue = 0;
    Object.entries(building.output || {}).forEach(([res, amount]) => {
        if (res === 'maxPop' || res === 'militaryCapacity') return;

        const localPrice = getNationPrice(res);
        const homePrice = getHomePrice(res);
        const exportNetValue = homePrice * (1 - transportRate);

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
            outputValue += amount * localPrice;
            localResourceChanges[res] = (localResourceChanges[res] || 0) + amount;
        } else {
            // 运回国内
            const grossValue = amount * homePrice;
            const transport = grossValue * transportRate;

            outputValue += (grossValue - transport); // 净收入
            transportCost += transport;
            playerResourceChanges[res] = (playerResourceChanges[res] || 0) + amount;
        }
    });

    // 3. 计算工资
    const { total: wageCost, breakdown: wageBreakdown } = calculateVassalWageCost(building, targetNation);

    // 4. 总利润
    const profit = outputValue - inputCost - wageCost;

    return {
        outputValue,
        inputCost,
        wageCost,
        wageBreakdown,
        transportCost,
        profit,
        inputAvailable: true,
        localResourceChanges,
        playerResourceChanges,
        decisions // Return strategy decisions for UI
    };
}





/**
 * 计算附庸国/投资国工资成本
 * @param {Object} building - 建筑配置
 * @param {Object} nation - 目标国家
 * @returns {Object} - { total: 工资成本, breakdown: 明细 }
 */
function calculateVassalWageCost(building, nation) {
    if (!building.jobs) return { total: 0, breakdown: [] };

    // 从附庸政策获取劳工工资修正 (核心新逻辑)
    const laborPolicy = nation?.vassalPolicy?.labor || 'standard';
    // 动态导入避免循环依赖，使用内联默认值
    const laborWageMultiplier = getLaborPolicyWageMultiplier(laborPolicy);

    // 生活水平乘数 (保留以备未来扩展)
    const LIVING_STANDARD_MULTIPLIER = 1.0;

    let totalWage = 0;
    const wageBreakdown = [];
    const marketPrices = nation.market?.prices || nation.prices || {};

    Object.entries(building.jobs).forEach(([stratumId, count]) => {
        // [FIX] 排除拥有者自己给自己发工资的情况
        if (building.owner && stratumId === building.owner) return;

        const stratumConfig = STRATA[stratumId];
        if (!stratumConfig) return;

        // 计算该阶层的生存成本 (Subsistence Cost)
        let subsistenceCost = 0;
        if (stratumConfig.needs) {
            Object.entries(stratumConfig.needs).forEach(([resKey, amount]) => {
                const price = marketPrices[resKey] || RESOURCES[resKey]?.basePrice || 1;
                subsistenceCost += amount * price;
            });
        }

        // 单人日工资 = 生存成本 * 生活水平 * 劳工政策修正
        const wagePerWorker = subsistenceCost * LIVING_STANDARD_MULTIPLIER * laborWageMultiplier;
        const totalStratumWage = count * wagePerWorker;

        totalWage += totalStratumWage;
        wageBreakdown.push({
            stratumId,
            count,
            wagePerWorker,
            total: totalStratumWage,
            laborPolicy,
            laborMultiplier: laborWageMultiplier,
        });
    });

    return { total: totalWage, breakdown: wageBreakdown };
}

/**
 * 获取劳工政策对应的工资乘数
 * @param {string} laborPolicyId - 劳工政策ID
 * @returns {number} - 工资乘数
 */
function getLaborPolicyWageMultiplier(laborPolicyId) {
    // 内联定义以避免循环依赖
    const multipliers = {
        standard: 1.0,
        exploitation: 0.6,
        slavery: 0.3,
    };
    return multipliers[laborPolicyId] ?? 1.0;
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
    resources = {},
    marketPrices = {},
    classWealth = {},
    daysElapsed = 0,
}) {
    const logs = [];
    let totalProfit = 0;
    const profitByStratum = {};
    const updatedInvestments = [];

    // 资源变更汇总
    const marketChanges = {}; // { nationId: { resourceKey: delta } }
    const playerInventoryChanges = {}; // { resourceKey: delta }

    overseasInvestments.forEach(investment => {
        if (investment.status !== 'operating') {
            updatedInvestments.push(investment);
            return;
        }

        const targetNation = nations.find(n => n.id === investment.targetNationId);
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
        const profitResult = calculateOverseasProfit(investment, targetNation, resources, marketPrices);

        // 汇总资源变更
        if (profitResult.localResourceChanges) {
            if (!marketChanges[investment.targetNationId]) {
                marketChanges[investment.targetNationId] = {};
            }
            Object.entries(profitResult.localResourceChanges).forEach(([res, delta]) => {
                marketChanges[investment.targetNationId][res] = (marketChanges[investment.targetNationId][res] || 0) + delta;
            });
        }

        if (profitResult.playerResourceChanges) {
            Object.entries(profitResult.playerResourceChanges).forEach(([res, delta]) => {
                playerInventoryChanges[res] = (playerInventoryChanges[res] || 0) + delta;
            });
        }

        // 计算利润汇回率
        const hasTreaty = hasActiveTreaty(targetNation, 'investment_pact', daysElapsed);
        const repatriationRate = hasTreaty
            ? OVERSEAS_INVESTMENT_CONFIGS.repatriation.withTreaty
            : OVERSEAS_INVESTMENT_CONFIGS.repatriation.noTreaty;

        const repatriatedProfit = profitResult.profit * repatriationRate;
        const retainedProfit = profitResult.profit * (1 - repatriationRate);

        // 更新投资记录
        const updated = { ...investment };

        // 维护利润历史记录（保留最近30天）
        const profitHistory = [...(investment.operatingData?.profitHistory || [])];
        profitHistory.push({
            day: daysElapsed,
            profit: profitResult.profit,
            repatriated: profitResult.profit * repatriationRate,
        });
        // 只保留最近30条记录
        if (profitHistory.length > 30) {
            profitHistory.shift();
        }

        updated.operatingData = {
            ...updated.operatingData,
            ...profitResult,
            repatriatedProfit,
            retainedProfit,
            profitHistory,
        };

        // 累加利润
        totalProfit += repatriatedProfit;
        profitByStratum[investment.ownerStratum] =
            (profitByStratum[investment.ownerStratum] || 0) + repatriatedProfit;

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
        updatedInvestments,
        totalProfit,
        profitByStratum,
        logs,
        marketChanges,
        playerInventoryChanges
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
    const investmentCost = baseCost * 1.5;

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

        summary.count++;
        summary.totalValue += inv.investmentAmount || 0;

        const dailyProfit = inv.operatingData?.profit || 0;
        const monthlyProfit = dailyProfit * 30;

        summary.estimatedDailyProfit += dailyProfit;
        summary.estimatedMonthlyProfit += monthlyProfit;

        // 按国家统计
        if (!summary.byNation[inv.targetNationId]) {
            summary.byNation[inv.targetNationId] = { count: 0, value: 0, profit: 0, dailyProfit: 0 };
        }
        summary.byNation[inv.targetNationId].count++;
        summary.byNation[inv.targetNationId].value += inv.investmentAmount || 0;
        summary.byNation[inv.targetNationId].profit += monthlyProfit;
        summary.byNation[inv.targetNationId].dailyProfit += dailyProfit;

        // 按阶层统计
        if (!summary.byStratum[inv.ownerStratum]) {
            summary.byStratum[inv.ownerStratum] = { count: 0, value: 0, profit: 0, dailyProfit: 0 };
        }
        summary.byStratum[inv.ownerStratum].count++;
        summary.byStratum[inv.ownerStratum].value += inv.investmentAmount || 0;
        summary.byStratum[inv.ownerStratum].profit += monthlyProfit;
        summary.byStratum[inv.ownerStratum].dailyProfit += dailyProfit;
    });

    return summary;
}

// ===== 外资系统（AI在玩家国投资）=====

/**
 * 外资税率政策配置
 */
export const FOREIGN_INVESTMENT_POLICIES = {
    normal: { taxRate: 0.10, relationImpact: 0 },
    increased_tax: { taxRate: 0.25, relationImpact: -5 },
    heavy_tax: { taxRate: 0.50, relationImpact: -15 },
};/**
 * 处理外资建筑每日更新 (Dynamic Logic)
 * 使用 calculateOverseasProfit 动态决定供应链（本地采购 vs 进口）
 * @param {Object} params - 参数
 * @returns {Object} - { updatedInvestments, taxRevenue, profitOutflow, logs, marketChanges }
 */
export function processForeignInvestments({
    foreignInvestments = [],
    nations = [],
    playerMarket = {},
    playerResources = {},
    foreignInvestmentPolicy = 'normal',
    daysElapsed = 0,
}) {
    const logs = [];
    let totalTaxRevenue = 0;
    let totalProfitOutflow = 0;
    const updatedInvestments = [];
    const policyConfig = FOREIGN_INVESTMENT_POLICIES[foreignInvestmentPolicy] || FOREIGN_INVESTMENT_POLICIES.normal;

    // 追踪玩家市场变化 (被外资买入/卖出)
    const marketChanges = {}; // { resourceKey: delta }

    foreignInvestments.forEach(investment => {
        if (investment.status !== 'operating') {
            updatedInvestments.push(investment);
            return;
        }

        const building = BUILDINGS.find(b => b.id === investment.buildingId);
        if (!building) {
            updatedInvestments.push(investment);
            return;
        }

        // 1. 准备上下文
        // 投资国 (Owner) -> 相当于 "Home"
        const ownerNation = nations.find(n => n.id === investment.ownerNationId);
        // 如果找不到投资国，假设它有基础价格和无限库存
        const homePrices = ownerNation?.market?.prices || ownerNation?.prices || {};
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
            homePrices
        );

        // 4. 处理结果
        const dailyProfit = profitResult.profit || 0;

        // 计算税收
        const taxAmount = dailyProfit > 0 ? dailyProfit * policyConfig.taxRate : 0;
        const profitAfterTax = dailyProfit > 0 ? dailyProfit * (1 - policyConfig.taxRate) : 0;

        totalTaxRevenue += taxAmount;
        totalProfitOutflow += profitAfterTax;

        // 记录市场变化 (localResourceChanges 指的是 TargetNation 即 Player 的变化)
        if (profitResult.localResourceChanges) {
            Object.entries(profitResult.localResourceChanges).forEach(([res, delta]) => {
                marketChanges[res] = (marketChanges[res] || 0) + delta;
            });
        }

        // 计算岗位数
        const jobsProvided = building.jobs ? Object.values(building.jobs).reduce((a, b) => a + b, 0) : 0;

        // 更新投资记录
        updatedInvestments.push({
            ...invWithStrategy, // 保留 strategy
            dailyProfit: dailyProfit,
            jobsProvided: jobsProvided,
            operatingData: {
                ...profitResult, // 包含 decisions, inputCost, outputValue 等
                taxPaid: taxAmount,
                profitRepatriated: profitAfterTax,
            },
        });
    });

    // 每月日志
    if (daysElapsed % 30 === 0 && foreignInvestments.length > 0) {
        logs.push(`🏭 外资月报: 税收+${(totalTaxRevenue * 30).toFixed(0)}, 利润外流-${(totalProfitOutflow * 30).toFixed(0)}`);
    }

    return {
        updatedInvestments,
        taxRevenue: totalTaxRevenue,
        profitOutflow: totalProfitOutflow,
        logs,
        marketChanges, // 返回给 GameLoop 使用 (如果支持)
    };
}

/**
 * AI决策：是否在玩家国建立投资
 * @param {Object} nation - AI国家
 * @param {Object} playerState - 玩家状态
 * @param {Array} existingInvestments - 现有外资
 * @returns {Object|null} - 投资决策或null
 */
export function aiDecideForeignInvestment(nation, playerState, existingInvestments = []) {
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

    // 随机决定是否投资（每月10%概率）
    if (Math.random() > 0.10 / 30) return null;

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
