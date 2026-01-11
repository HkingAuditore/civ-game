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

import { BUILDINGS, RESOURCES } from '../../config';
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
    
    // 运营模式
    operatingModes: {
        local: {
            id: 'local',
            name: '当地运营',
            description: '使用当地资源，产出进入当地市场',
            transportCost: 0,
            localSatisfactionImpact: 0,
            independenceImpact: 0,
        },
        dumping: {
            id: 'dumping',
            name: '倾销模式',
            description: '本国资源运入，产出低价倾销当地市场',
            transportCost: 0.15,           // +15%运输成本
            localSatisfactionImpact: -3,   // 当地满意度下降
            independenceImpact: 0.05,      // 独立倾向+5%/年
        },
        buyback: {
            id: 'buyback',
            name: '回购模式',
            description: '使用当地资源，产出运回本国销售',
            transportCost: 0.15,           // +15%运输成本
            localSatisfactionImpact: 0,
            independenceImpact: 0.02,      // 独立倾向+2%/年
        },
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
 * 获取可在海外投资的建筑列表
 * @param {string} accessType - 'colony' | 'vassal' | 'treaty'
 * @param {string} ownerStratum - 业主阶层 (可选，用于过滤)
 * @param {number} epoch - 当前时代
 * @returns {Array} - 可投资建筑ID列表
 */
export function getInvestableBuildings(accessType = 'treaty', ownerStratum = null, epoch = 0) {
    const allowedCategories = OVERSEAS_BUILDING_CATEGORIES[accessType] || ['gather', 'industry'];
    
    return BUILDINGS.filter(building => {
        // 检查建筑类别
        if (!allowedCategories.includes(building.cat)) return false;
        
        // 检查时代解锁
        if ((building.epoch || 0) > epoch) return false;
        
        // 如果指定了阶层，检查建筑owner匹配
        // 但也允许 capitalist 投资 industry 建筑
        if (ownerStratum) {
            const buildingOwner = building.owner || 'worker';
            // 资本家可投资：工业建筑、采集建筑
            if (ownerStratum === 'capitalist' && building.cat === 'industry') return true;
            // 商人可投资：商业相关建筑
            if (ownerStratum === 'merchant' && (buildingOwner === 'merchant' || building.cat === 'civic')) return true;
            // 地主可投资：农业/采集建筑
            if (ownerStratum === 'landowner' && (building.cat === 'gather' || buildingOwner === 'landowner')) return true;
        }
        
        // 默认允许所有采集和工业建筑
        return true;
    }).map(b => b.id);
}

/**
 * 传统静态列表（向后兼容）- 现已扩展
 */
export const INVESTABLE_BUILDINGS = {
    capitalist: [
        // 工业建筑
        'factory', 'steel_foundry', 'textile_mill', 'coal_mine', 'copper_mine', 'iron_mine',
        'sawmill', 'smelter', 'forge', 'brickworks', 'glassworks', 'paper_mill',
        'furniture_workshop', 'tailor_workshop', 'culinary_kitchen', 'distillery',
        'pottery', 'toolmaker', 'loom_house', 'dye_works',
    ],
    merchant: [
        // 商业/贸易建筑
        'market', 'trading_post', 'trade_port', 'warehouse', 'bank', 'stock_exchange',
        'coffee_plantation', 'spice_trade',
    ],
    landowner: [
        // 农业/采集建筑
        'farm', 'large_estate', 'plantation', 'lumber_camp', 'quarry', 'fishing_wharf',
        'coffee_plantation', 'ranch', 'vineyard', 'orchard', 'pasture',
    ],
};

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
    operatingMode = 'local',
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
        operatingMode,
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
    
    return {
        id: `fi_${ownerNationId}_${buildingId}_${Date.now()}`,
        buildingId,
        ownerNationId,
        investorStratum,
        
        operatingData: {
            outputValue: 0,
            inputCost: 0,
            wageCost: 0,
            profit: 0,
        },
        
        status: 'operating',        // 'operating' | 'nationalized'
    };
}

// ===== 投资检查 =====

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
    const hasInvestmentPact = Array.isArray(targetNation.treaties) && 
        targetNation.treaties.some(t => t.type === 'investment_pact' && t.status !== 'expired');
    
    if (!isVassal && !hasInvestmentPact) {
        return { canInvest: false, reason: '只能在附庸国或签有投资协议的国家建立海外投资' };
    }
    
    // 检查建筑是否可被投资（基于建筑类别）
    const building = BUILDINGS.find(b => b.id === buildingId);
    if (!building) {
        return { canInvest: false, reason: '无效的建筑类型' };
    }
    
    // 确定accessType
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
 * 计算海外建筑利润（当地运营模式）
 * @param {Object} investment - 海外投资记录
 * @param {Object} targetNation - 目标国家
 * @param {Object} playerResources - 玩家资源
 * @returns {Object} - { outputValue, inputCost, wageCost, profit }
 */
export function calculateLocalModeProfit(investment, targetNation, playerResources) {
    const building = BUILDINGS.find(b => b.id === investment.buildingId);
    if (!building) return { outputValue: 0, inputCost: 0, wageCost: 0, profit: 0 };
    
    // 使用附庸国的资源和价格
    const nationPrices = targetNation.prices || {};
    const nationInventories = targetNation.inventories || {};
    
    let inputCost = 0;
    let inputAvailable = true;
    const localResourceChanges = {};
    
    // 计算原材料成本（从当地市场采购）
    Object.entries(building.input || {}).forEach(([resourceKey, amount]) => {
        const localPrice = nationPrices[resourceKey] || getBasePrice(resourceKey);
        const localInventory = nationInventories[resourceKey] || 0;
        
        if (localInventory < amount) {
            inputAvailable = false;
        }
        inputCost += amount * localPrice;
        
        // 记录消耗 (如果运营)
        if (inputAvailable) {
            localResourceChanges[resourceKey] = (localResourceChanges[resourceKey] || 0) - amount;
        }
    });
    
    // 如果原料不足，清除之前记录的消耗（因为没有生产）
    if (!inputAvailable) {
        Object.keys(localResourceChanges).forEach(k => delete localResourceChanges[k]);
    }
    
    // 计算产出价值（进入当地市场）
    let outputValue = 0;
    if (inputAvailable) {
        Object.entries(building.output || {}).forEach(([resourceKey, amount]) => {
            if (resourceKey === 'maxPop' || resourceKey === 'militaryCapacity') return;
            const localPrice = nationPrices[resourceKey] || getBasePrice(resourceKey);
            outputValue += amount * localPrice;
            
            // 记录产出
            localResourceChanges[resourceKey] = (localResourceChanges[resourceKey] || 0) + amount;
        });
    }
    
    // 计算工资成本（支付给当地工人）
    const wageCost = calculateVassalWageCost(building, targetNation);
    
    const profit = outputValue - inputCost - wageCost;
    
    return { outputValue, inputCost, wageCost, profit, inputAvailable, localResourceChanges };
}

/**
 * 计算海外建筑利润（倾销模式）
 * @param {Object} investment - 海外投资记录
 * @param {Object} targetNation - 目标国家
 * @param {Object} playerResources - 玩家资源
 * @param {Object} marketPrices - 玩家市场价格
 * @returns {Object} - { outputValue, inputCost, wageCost, profit, transportCost }
 */
export function calculateDumpingModeProfit(investment, targetNation, playerResources, marketPrices) {
    const building = BUILDINGS.find(b => b.id === investment.buildingId);
    if (!building) return { outputValue: 0, inputCost: 0, wageCost: 0, profit: 0, transportCost: 0 };
    
    const nationPrices = targetNation.prices || {};
    const transportCostRate = OVERSEAS_INVESTMENT_CONFIGS.operatingModes.dumping.transportCost;
    
    let inputCost = 0;
    let transportCost = 0;
    const playerResourceChanges = {};
    const localResourceChanges = {};
    
    // 原材料从本国运入（本国价格 + 运费）
    Object.entries(building.input || {}).forEach(([resourceKey, amount]) => {
        const homePrice = marketPrices[resourceKey] || getBasePrice(resourceKey);
        const baseCost = amount * homePrice;
        inputCost += baseCost;
        transportCost += baseCost * transportCostRate;
        
        // 记录本国消耗
        playerResourceChanges[resourceKey] = (playerResourceChanges[resourceKey] || 0) - amount;
    });
    
    // 产出在当地市场销售（价格压低20%倾销）
    let outputValue = 0;
    Object.entries(building.output || {}).forEach(([resourceKey, amount]) => {
        if (resourceKey === 'maxPop' || resourceKey === 'militaryCapacity') return;
        const localPrice = nationPrices[resourceKey] || getBasePrice(resourceKey);
        outputValue += amount * localPrice * 0.8;  // 20%折扣倾销
        
        // 记录当地产出
        localResourceChanges[resourceKey] = (localResourceChanges[resourceKey] || 0) + amount;
    });
    
    const wageCost = calculateVassalWageCost(building, targetNation);
    const profit = outputValue - inputCost - transportCost - wageCost;
    
    return { outputValue, inputCost, wageCost, profit, transportCost, playerResourceChanges, localResourceChanges };
}

/**
 * 计算海外建筑利润（回购模式）
 * @param {Object} investment - 海外投资记录
 * @param {Object} targetNation - 目标国家
 * @param {Object} playerResources - 玩家资源
 * @param {Object} marketPrices - 玩家市场价格
 * @returns {Object} - { outputValue, inputCost, wageCost, profit, transportCost, resourcesGained }
 */
export function calculateBuybackModeProfit(investment, targetNation, playerResources, marketPrices) {
    const building = BUILDINGS.find(b => b.id === investment.buildingId);
    if (!building) return { outputValue: 0, inputCost: 0, wageCost: 0, profit: 0, transportCost: 0, resourcesGained: {} };
    
    const nationPrices = targetNation.prices || {};
    const nationInventories = targetNation.inventories || {};
    const transportCostRate = OVERSEAS_INVESTMENT_CONFIGS.operatingModes.buyback.transportCost;
    
    let inputCost = 0;
    let inputAvailable = true;
    const localResourceChanges = {};
    const playerResourceChanges = {};
    
    // 原材料从当地采购（当地价格）
    Object.entries(building.input || {}).forEach(([resourceKey, amount]) => {
        const localPrice = nationPrices[resourceKey] || getBasePrice(resourceKey);
        const localInventory = nationInventories[resourceKey] || 0;
        
        if (localInventory < amount) {
            inputAvailable = false;
        }
        inputCost += amount * localPrice;

        // 记录当地消耗
        if (inputAvailable) {
            localResourceChanges[resourceKey] = (localResourceChanges[resourceKey] || 0) - amount;
        }
    });

    // 如果原料不足，清除之前记录的消耗
    if (!inputAvailable) {
         Object.keys(localResourceChanges).forEach(k => delete localResourceChanges[k]);
    }
    
    // 产出运回本国（本国价格 - 运费）
    let outputValue = 0;
    let transportCost = 0;
    const resourcesGained = {};
    
    if (inputAvailable) {
        Object.entries(building.output || {}).forEach(([resourceKey, amount]) => {
            if (resourceKey === 'maxPop' || resourceKey === 'militaryCapacity') return;
            const homePrice = marketPrices[resourceKey] || getBasePrice(resourceKey);
            const baseValue = amount * homePrice;
            transportCost += baseValue * transportCostRate;
            outputValue += baseValue * (1 - transportCostRate);
            resourcesGained[resourceKey] = amount;
            
            // 记录本国产出
            playerResourceChanges[resourceKey] = (playerResourceChanges[resourceKey] || 0) + amount;
        });
    }
    
    const wageCost = calculateVassalWageCost(building, targetNation);
    const profit = outputValue - inputCost - wageCost;  // 运费已在outputValue中扣除
    
    return { outputValue, inputCost, wageCost, profit, transportCost, resourcesGained, inputAvailable, localResourceChanges, playerResourceChanges };
}

/**
 * 计算附庸国工资成本
 * @param {Object} building - 建筑配置
 * @param {Object} nation - 目标国家
 * @returns {number} - 工资成本
 */
function calculateVassalWageCost(building, nation) {
    if (!building.jobs) return 0;
    
    // 附庸国工资基于其财富水平
    const wageMultiplier = Math.max(0.3, Math.min(1.0, (nation.wealth || 500) / 1000));
    const baseWagePerWorker = 0.5;  // 基础日工资
    
    let totalWage = 0;
    Object.values(building.jobs).forEach(slots => {
        totalWage += slots * baseWagePerWorker * wageMultiplier;
    });
    
    return totalWage;
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
        let profitResult;
        switch (investment.operatingMode) {
            case 'dumping':
                profitResult = calculateDumpingModeProfit(investment, targetNation, resources, marketPrices);
                break;
            case 'buyback':
                profitResult = calculateBuybackModeProfit(investment, targetNation, resources, marketPrices);
                break;
            default:
                profitResult = calculateLocalModeProfit(investment, targetNation, resources);
        }
        
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
        const hasTreaty = targetNation.treaties?.investment_pact?.status === 'active';
        const repatriationRate = hasTreaty 
            ? OVERSEAS_INVESTMENT_CONFIGS.repatriation.withTreaty
            : OVERSEAS_INVESTMENT_CONFIGS.repatriation.noTreaty;
        
        const repatriatedProfit = profitResult.profit * repatriationRate;
        const retainedProfit = profitResult.profit * (1 - repatriationRate);
        
        // 更新投资记录
        const updated = { ...investment };
        updated.operatingData = {
            ...updated.operatingData,
            ...profitResult,
            repatriatedProfit,
            retainedProfit,
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
    operatingMode = 'local',
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
    const baseCost = Object.values(building.cost || {}).reduce((sum, v) => sum + v, 0);
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
        operatingMode,
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
export function calculateOverseasInvestmentSummary(overseasInvestments) {
    const summary = {
        totalValue: 0,
        estimatedMonthlyProfit: 0,
        byNation: {},
        byStratum: {},
        count: 0,
    };
    
    overseasInvestments.forEach(inv => {
        if (inv.status !== 'operating') return;
        
        summary.count++;
        summary.totalValue += inv.investmentAmount || 0;
        
        const monthlyProfit = (inv.operatingData?.profit || 0) * 30;
        summary.estimatedMonthlyProfit += monthlyProfit;
        
        // 按国家统计
        if (!summary.byNation[inv.targetNationId]) {
            summary.byNation[inv.targetNationId] = { count: 0, value: 0, profit: 0 };
        }
        summary.byNation[inv.targetNationId].count++;
        summary.byNation[inv.targetNationId].value += inv.investmentAmount || 0;
        summary.byNation[inv.targetNationId].profit += monthlyProfit;
        
        // 按阶层统计
        if (!summary.byStratum[inv.ownerStratum]) {
            summary.byStratum[inv.ownerStratum] = { count: 0, value: 0, profit: 0 };
        }
        summary.byStratum[inv.ownerStratum].count++;
        summary.byStratum[inv.ownerStratum].value += inv.investmentAmount || 0;
        summary.byStratum[inv.ownerStratum].profit += monthlyProfit;
    });
    
    return summary;
}
