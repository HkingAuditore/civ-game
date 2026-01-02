/**
 * 内阁协同度与意识形态主导系统
 * 处理官员派系平衡、效率修正和特殊玩法面板
 */

import { POLITICAL_STANCES } from '../../config/politicalStances';

// ========== 常量定义 ==========

// 主导触发阈值
export const DOMINANCE_THRESHOLD = 0.6; // 60% 官员为同一派系
export const SYNERGY_DOMINANCE_THRESHOLD = 0.5; // 协同度高时的派系阈值

// 协同度区间效果
export const SYNERGY_EFFECTS = {
    split: { // 0-30
        maxSynergy: 30,
        adminEfficiency: -0.15,
        stability: -0.05,
        organizationGrowth: 0.20,
        label: '内阁分裂',
        color: 'text-red-400',
    },
    diverse: { // 30-50
        maxSynergy: 50,
        adminEfficiency: 0,
        stability: 0,
        organizationGrowth: 0,
        label: '多元共存',
        color: 'text-gray-400',
    },
    coordinated: { // 50-70
        maxSynergy: 70,
        adminEfficiency: 0.05,
        stability: 0,
        organizationGrowth: 0,
        label: '协调运作',
        color: 'text-blue-400',
    },
    united: { // 70-85
        maxSynergy: 85,
        adminEfficiency: 0.10,
        stability: 0.02,
        organizationGrowth: 0,
        label: '团结一致',
        color: 'text-green-400',
    },
    extreme: { // 85-100
        maxSynergy: 100,
        adminEfficiency: 0.15,
        stability: 0,
        organizationGrowth: 0,
        ideologicalDrift: true,
        oppositionPenalty: -10, // 非主导派系满意度惩罚
        label: '一党独大',
        color: 'text-purple-400',
    },
};

// 派系主导效果
export const DOMINANCE_EFFECTS = {
    left: {
        id: 'left',
        name: '左派主导',
        icon: 'Users',
        color: 'text-red-400',
        panelType: 'plannedEconomy',
        effects: {
            socialMobility: 0.20,
            lowerClassApproval: 5, // peasant, worker, serf, miner
        },
        description: '可进行阶层人口配额规划',
    },
    center: {
        id: 'center',
        name: '中间派主导',
        icon: 'Scale',
        color: 'text-blue-400',
        panelType: 'reformDecree',
        effects: {
            diplomaticRelations: 0.5,
            stability: 0.03,
        },
        description: '可颁布临时法令',
    },
    right: {
        id: 'right',
        name: '右派主导',
        icon: 'TrendingUp',
        color: 'text-amber-400',
        panelType: 'freeMarket',
        effects: {
            tradeBonus: 0.10,
            upperClassApproval: 5, // landowner, merchant, capitalist
        },
        description: '可允许业主自主扩张建筑',
    },
};

// 临时法令定义 - 使用游戏已有的效果键
export const REFORM_DECREES = {
    emergencyGrain: {
        id: 'emergencyGrain',
        name: '紧急征粮',
        icon: 'Wheat',
        duration: 30, // 30天
        cooldown: 180, // 180天冷却
        cost: 300,
        effects: {
            categories: { gather: 0.30 }, // 采集类建筑产出 +30%
            stability: -0.05, // 稳定度下降
        },
        description: '采集产出 +30%，稳定度下降',
    },
    tradeCharter: {
        id: 'tradeCharter',
        name: '贸易特许',
        icon: 'Ship',
        duration: 60,
        cooldown: 240,
        cost: 500,
        effects: {
            taxIncome: 0.25, // 税收收入 +25%
        },
        description: '税收收入 +25%',
    },
    industrialSubsidy: {
        id: 'industrialSubsidy',
        name: '工业补贴',
        icon: 'Factory',
        duration: 90,
        cooldown: 300,
        cost: 800,
        effects: {
            industry: 0.20, // 工业产出 +20%
            taxIncome: -0.10, // 税收 -10%（补贴成本）
        },
        description: '工业产出 +20%，税收 -10%',
    },
    migrationIncentive: {
        id: 'migrationIncentive',
        name: '移民激励',
        icon: 'UserPlus',
        duration: 60,
        cooldown: 200,
        cost: 400,
        effects: {
            populationGrowth: 0.15, // 人口增长 +15%
        },
        description: '人口增长 +15%',
    },
    militaryMobilization: {
        id: 'militaryMobilization',
        name: '军事动员',
        icon: 'Sword',
        duration: 30,
        cooldown: 150,
        cost: 600,
        effects: {
            militaryBonus: 0.25, // 军事力量 +25%
            stability: -0.05, // 稳定度下降
        },
        description: '军事力量 +25%，稳定度下降',
    },
    taxHoliday: {
        id: 'taxHoliday',
        name: '税收减免',
        icon: 'Gift',
        duration: 45,
        cooldown: 200,
        cost: 0, // 无前置成本，但损失税收
        effects: {
            taxIncome: -0.30, // 税收 -30%
            stability: 0.15, // 稳定度 +15%
        },
        description: '税收 -30%，稳定度 +15%',
    },
};

// ========== 核心计算函数 ==========

/**
 * 获取官员的政治光谱
 * @param {Object} official - 官员对象
 * @returns {string} 'left' | 'center' | 'right'
 */
export const getOfficialSpectrum = (official) => {
    if (!official || !official.politicalStance) return 'center';
    const stance = POLITICAL_STANCES[official.politicalStance];
    return stance?.spectrum || 'center';
};

/**
 * 计算内阁协同度
 * @param {Array} officials - 在任官员列表
 * @returns {Object} { synergy, distribution, level }
 */
export const calculateCabinetSynergy = (officials) => {
    if (!officials || officials.length === 0) {
        return { synergy: 50, distribution: { left: 0, center: 0, right: 0 }, level: 'diverse' };
    }

    // 统计各派系人数
    const distribution = { left: 0, center: 0, right: 0 };
    officials.forEach(o => {
        const spectrum = getOfficialSpectrum(o);
        distribution[spectrum]++;
    });

    const total = officials.length;
    const counts = Object.values(distribution);
    const maxCount = Math.max(...counts);
    const minCount = Math.min(...counts);

    // 多样性指数：0 = 完全均衡, 1 = 完全单一
    const diversity = total > 0 ? (maxCount - minCount) / total : 0;

    // 协同度：多样性越高，协同度越高（意见一致）
    // 但不是简单的线性关系，中等多样性时协同度适中
    const synergy = Math.round(50 + diversity * 50);

    // 确定协同等级
    let level = 'diverse';
    if (synergy <= 30) level = 'split';
    else if (synergy <= 50) level = 'diverse';
    else if (synergy <= 70) level = 'coordinated';
    else if (synergy <= 85) level = 'united';
    else level = 'extreme';

    return { synergy, distribution, level };
};

// 主导系统需要的最低条件
export const DOMINANCE_MIN_EPOCH = 5; // 启蒙时代
export const DOMINANCE_MIN_OFFICIAL_RATIO = 0.5; // 官员数量需达到编制的50%

/**
 * 获取主导派系
 * @param {Array} officials - 在任官员列表
 * @param {number} capacity - 官员编制容量
 * @param {number} epoch - 当前时代
 * @returns {Object|null} { faction, percentage, effects } 或 null 如果没有主导
 */
export const getCabinetDominance = (officials, capacity = 3, epoch = 0) => {
    // [DEBUG] 记录详细的判定过程
    const debugInfo = {
        officialCount: officials?.length || 0,
        capacity,
        epoch,
        requirement: Math.ceil(capacity * DOMINANCE_MIN_OFFICIAL_RATIO),
        epochMet: epoch >= DOMINANCE_MIN_EPOCH,
        capacityMet: false,
        percentMet: false,
        result: null,
    };

    if (!officials || officials.length === 0) {
        console.log('[DOMINANCE DEBUG] No officials:', debugInfo);
        return null;
    }

    // 前置条件1: 时代至少为启蒙时代 (epoch >= 5)
    if (epoch < DOMINANCE_MIN_EPOCH) {
        debugInfo.result = 'Epoch requirement not met';
        console.log('[DOMINANCE DEBUG] Epoch not met:', debugInfo);
        return null;
    }

    // 前置条件2: 官员数量至少达到编制的一半
    const minRequired = Math.ceil(capacity * DOMINANCE_MIN_OFFICIAL_RATIO);
    debugInfo.capacityMet = officials.length >= minRequired;
    if (!debugInfo.capacityMet) {
        debugInfo.result = `Need ${minRequired} officials (have ${officials.length})`;
        console.log('[DOMINANCE DEBUG] Capacity not met:', debugInfo);
        return null;
    }

    const { synergy, distribution } = calculateCabinetSynergy(officials);
    const total = officials.length;

    // 找出最大派系
    let dominant = null;
    let maxPercent = 0;
    Object.entries(distribution).forEach(([faction, count]) => {
        const percent = count / total;
        if (percent > maxPercent) {
            maxPercent = percent;
            dominant = faction;
        }
    });

    // 检查是否达到主导条件
    const threshold = synergy >= 70 ? SYNERGY_DOMINANCE_THRESHOLD : DOMINANCE_THRESHOLD;
    debugInfo.synergy = synergy;
    debugInfo.threshold = threshold;
    debugInfo.maxPercent = maxPercent;
    debugInfo.dominant = dominant;
    debugInfo.percentMet = maxPercent >= threshold;

    if (maxPercent >= threshold && dominant) {
        debugInfo.result = 'SUCCESS';
        console.log('[DOMINANCE DEBUG] Dominance activated:', debugInfo);
        return {
            faction: dominant,
            percentage: Math.round(maxPercent * 100),
            ...DOMINANCE_EFFECTS[dominant],
        };
    }

    debugInfo.result = 'Percent threshold not met';
    console.log('[DOMINANCE DEBUG] Percent not met:', debugInfo);
    return null;
};

/**
 * 获取协同度效果
 * @param {number} synergy - 协同度值
 * @returns {Object} 效果修正
 */
export const getSynergyEffects = (synergy) => {
    if (synergy <= 30) return SYNERGY_EFFECTS.split;
    if (synergy <= 50) return SYNERGY_EFFECTS.diverse;
    if (synergy <= 70) return SYNERGY_EFFECTS.coordinated;
    if (synergy <= 85) return SYNERGY_EFFECTS.united;
    return SYNERGY_EFFECTS.extreme;
};

/**
 * 获取内阁综合效果（协同度 + 主导派系）
 * @param {Array} officials - 在任官员列表
 * @param {number} capacity - 官员编制容量
 * @param {number} epoch - 当前时代
 * @returns {Object} 综合效果
 */
export const getCabinetEffects = (officials, capacity = 3, epoch = 0) => {
    const { synergy, distribution, level } = calculateCabinetSynergy(officials);
    const dominance = getCabinetDominance(officials, capacity, epoch);
    const synergyEffects = getSynergyEffects(synergy);

    const effects = {
        synergy,
        level,
        distribution,
        dominance,

        // 协同度修正
        adminEfficiency: synergyEffects.adminEfficiency || 0,
        stabilityMod: synergyEffects.stability || 0,
        organizationGrowthMod: synergyEffects.organizationGrowth || 0,

        // 极端一致时的惩罚
        ideologicalDrift: synergyEffects.ideologicalDrift || false,
        oppositionPenalty: synergyEffects.oppositionPenalty || 0,
    };

    // 添加主导派系效果
    if (dominance) {
        if (dominance.effects.socialMobility) {
            effects.socialMobilityMod = dominance.effects.socialMobility;
        }
        if (dominance.effects.tradeBonus) {
            effects.tradeBonusMod = dominance.effects.tradeBonus;
        }
        if (dominance.effects.diplomaticRelations) {
            effects.diplomaticRelationsMod = dominance.effects.diplomaticRelations;
        }
        if (dominance.effects.stability) {
            effects.stabilityMod += dominance.effects.stability;
        }

        // 阶层满意度加成
        effects.approvalBonus = {};
        if (dominance.effects.lowerClassApproval) {
            ['peasant', 'worker', 'serf', 'miner'].forEach(s => {
                effects.approvalBonus[s] = dominance.effects.lowerClassApproval;
            });
        }
        if (dominance.effects.upperClassApproval) {
            ['landowner', 'merchant', 'capitalist'].forEach(s => {
                effects.approvalBonus[s] = dominance.effects.upperClassApproval;
            });
        }
    }

    return effects;
};

// ========== 临时法令系统 ==========

/**
 * 检查法令是否可用
 * @param {string} decreeId - 法令ID
 * @param {Object} activeDecrees - 当前生效的法令 { decreeId: { endDay, ... } }
 * @param {Object} decreeCooldowns - 法令冷却 { decreeId: availableDay }
 * @param {number} currentDay - 当前天数
 * @param {number} silver - 当前银币
 * @returns {Object} { available, reason }
 */
export const isDecreeAvailable = (decreeId, activeDecrees, decreeCooldowns, currentDay, silver) => {
    const decree = REFORM_DECREES[decreeId];
    if (!decree) return { available: false, reason: '无效的法令' };

    // 检查是否正在生效
    if (activeDecrees && activeDecrees[decreeId]) {
        const remaining = activeDecrees[decreeId].endDay - currentDay;
        return { available: false, reason: `生效中，剩余 ${remaining} 天` };
    }

    // 检查冷却
    if (decreeCooldowns && decreeCooldowns[decreeId]) {
        const cooldownEnd = decreeCooldowns[decreeId];
        if (currentDay < cooldownEnd) {
            const remaining = cooldownEnd - currentDay;
            return { available: false, reason: `冷却中，剩余 ${remaining} 天` };
        }
    }

    // 检查银币
    if (silver < decree.cost) {
        return { available: false, reason: `需要 ${decree.cost} 银` };
    }

    return { available: true, reason: null };
};

/**
 * 颁布法令
 * @param {string} decreeId - 法令ID
 * @param {Object} activeDecrees - 当前生效的法令
 * @param {Object} decreeCooldowns - 法令冷却
 * @param {number} currentDay - 当前天数
 * @returns {Object} { success, newActiveDecrees, newCooldowns, cost }
 */
export const enactDecree = (decreeId, activeDecrees, decreeCooldowns, currentDay) => {
    const decree = REFORM_DECREES[decreeId];
    if (!decree) return { success: false, error: '无效的法令' };

    const newActiveDecrees = { ...activeDecrees };
    const newCooldowns = { ...decreeCooldowns };

    // 添加到生效列表
    newActiveDecrees[decreeId] = {
        startDay: currentDay,
        endDay: currentDay + decree.duration,
        effects: decree.effects,
    };

    // 设置冷却 (结束后开始计算)
    newCooldowns[decreeId] = currentDay + decree.duration + decree.cooldown;

    return {
        success: true,
        newActiveDecrees,
        newCooldowns,
        cost: decree.cost,
    };
};

/**
 * 处理法令到期
 * @param {Object} activeDecrees - 当前生效的法令
 * @param {number} currentDay - 当前天数
 * @returns {Object} { updatedDecrees, expiredDecrees }
 */
export const processDecreeExpiry = (activeDecrees, currentDay) => {
    if (!activeDecrees) return { updatedDecrees: {}, expiredDecrees: [] };

    const updatedDecrees = {};
    const expiredDecrees = [];

    Object.entries(activeDecrees).forEach(([decreeId, data]) => {
        if (currentDay >= data.endDay) {
            expiredDecrees.push(decreeId);
        } else {
            updatedDecrees[decreeId] = data;
        }
    });

    return { updatedDecrees, expiredDecrees };
};

/**
 * 获取所有生效法令的聚合效果
 * @param {Object} activeDecrees - 当前生效的法令
 * @returns {Object} 聚合效果
 */
export const getActiveDecreeEffects = (activeDecrees) => {
    const aggregated = {
        foodTaxBonus: 0,
        tradeBonus: 0,
        industryBonus: 0,
        populationGrowth: 0,
        militaryBonus: 0,
        taxEfficiency: 0,
        stability: 0,
        dailyCost: 0,
        approval: {},
        allApproval: 0,
    };

    if (!activeDecrees) return aggregated;

    Object.values(activeDecrees).forEach(data => {
        const effects = data.effects;
        if (!effects) return;

        Object.entries(effects).forEach(([key, value]) => {
            if (key === 'approval' && typeof value === 'object') {
                Object.entries(value).forEach(([stratum, val]) => {
                    aggregated.approval[stratum] = (aggregated.approval[stratum] || 0) + val;
                });
            } else if (aggregated.hasOwnProperty(key)) {
                aggregated[key] += value;
            }
        });
    });

    return aggregated;
};

// ========== 意识形态漂移 ==========

/**
 * 处理每日意识形态漂移
 * @param {Object} cabinetEffects - 内阁效果
 * @param {Object} classInfluence - 当前阶层影响力
 * @returns {Object} { influenceChanges, approvalChanges, driftActive }
 */
export const processIdeologicalDrift = (cabinetEffects, classInfluence) => {
    const result = {
        influenceChanges: {},
        approvalChanges: {},
        driftActive: false,
    };

    if (!cabinetEffects || !cabinetEffects.ideologicalDrift) {
        return result;
    }

    result.driftActive = true;
    const dominance = cabinetEffects.dominance;
    if (!dominance) return result;

    // 左派主导：下层阶层影响力上升
    // 右派主导：上层阶层影响力上升
    // 中间派主导：温和变化
    const DRIFT_RATE = 0.005; // 每日0.5%

    if (dominance.faction === 'left') {
        ['peasant', 'worker', 'serf', 'miner'].forEach(s => {
            result.influenceChanges[s] = DRIFT_RATE;
        });
        ['landowner', 'capitalist', 'merchant'].forEach(s => {
            result.influenceChanges[s] = -DRIFT_RATE / 2;
        });
    } else if (dominance.faction === 'right') {
        ['landowner', 'capitalist', 'merchant'].forEach(s => {
            result.influenceChanges[s] = DRIFT_RATE;
        });
        ['peasant', 'worker', 'serf'].forEach(s => {
            result.influenceChanges[s] = -DRIFT_RATE / 2;
        });
    }

    // 非主导派系满意度惩罚
    if (cabinetEffects.oppositionPenalty) {
        // 这个惩罚应该在满意度计算时应用，而不是每日累加
        // 这里只标记状态
    }

    return result;
};

// ========== 计划经济：阶层配额 ==========

/**
 * 计算阶层配额调整效果
 * @param {Object} currentDistribution - 当前人口分布 { stratum: population }
 * @param {Object} targetQuotas - 目标配额 { stratum: percentage (0-100) }
 * @returns {Object} { adjustments, approvalPenalties, adminCost }
 */
export const calculateQuotaEffects = (currentDistribution, targetQuotas) => {
    if (!currentDistribution || !targetQuotas) {
        return { adjustments: {}, approvalPenalties: {}, adminCost: 0 };
    }

    const total = Object.values(currentDistribution).reduce((a, b) => a + b, 0);
    const adjustments = {};
    const approvalPenalties = {};
    let adminCost = 0;

    Object.entries(targetQuotas).forEach(([stratum, targetPercent]) => {
        const current = currentDistribution[stratum] || 0;
        const currentPercent = total > 0 ? (current / total) * 100 : 0;
        const diff = targetPercent - currentPercent;

        if (Math.abs(diff) > 1) { // 只有差距大于1%时才调整
            // 每1%差距 = 每日迁移基数的10%加速
            adjustments[stratum] = diff * 0.1;

            // 被压缩的阶层满意度惩罚
            if (diff < -5) {
                approvalPenalties[stratum] = Math.floor(diff / 2); // 每压缩5%，-2.5满意度
            }

            // 行政成本
            adminCost += Math.abs(diff) * 0.5;
        }
    });

    return { adjustments, approvalPenalties, adminCost: Math.round(adminCost) };
};

// ========== 自由市场：业主扩张 ==========

/**
 * 计算建筑的每座利润
 * 利润 = 产出价值 - 投入成本 - 营业税 - 雇员工资
 * @param {Object} building - 建筑配置
 * @param {Object} market - 市场数据 { prices: {...}, wages: {...} }
 * @param {Object} taxPolicies - 税收政策
 * @returns {Object} { profit, outputValue, inputValue, wageCost, businessTax }
 */
export const calculateBuildingProfit = (building, market = {}, taxPolicies = {}) => {
    if (!building) return { profit: 0, outputValue: 0, inputValue: 0, wageCost: 0, businessTax: 0 };
    
    const prices = market?.prices || {};
    const wages = market?.wages || {};
    
    const getPrice = (key) => {
        if (!key || key === 'silver') return 1;
        return prices[key] ?? 1;
    };
    
    // 产出价值
    const outputValue = Object.entries(building.output || {}).reduce(
        (sum, [res, val]) => sum + getPrice(res) * val, 0
    );
    
    // 投入成本
    const inputValue = Object.entries(building.input || {}).reduce(
        (sum, [res, val]) => sum + getPrice(res) * val, 0
    );
    
    // 营业税
    const businessTaxMultiplier = taxPolicies?.businessTaxRates?.[building.id] ?? 1;
    const businessTaxBase = building.businessTaxBase ?? 0.1;
    const businessTax = businessTaxBase * businessTaxMultiplier;
    
    // 雇员工资（不含业主）
    const ownerKey = building.owner;
    let wageCost = 0;
    for (const [role, slotsPerBuilding] of Object.entries(building.jobs || {})) {
        if (role === ownerKey) continue; // 跳过业主
        const wage = wages[role] ?? 0.1;
        wageCost += wage * slotsPerBuilding;
    }
    
    // 每座建筑利润
    const profit = outputValue - inputValue - businessTax - wageCost;
    
    return { 
        profit, 
        outputValue, 
        inputValue, 
        wageCost, 
        businessTax 
    };
};

/**
 * 检查建筑是否可由业主扩张
 * @param {Object} building - 建筑配置
 * @param {string} ownerStratum - 业主阶层
 * @param {number} ownerWealth - 业主阶层的总财富
 * @param {Object} expansionSettings - 玩家设置 { buildingId: { allowed, maxCount } }
 * @param {number} currentCount - 当前建筑数量
 * @param {Object} market - 市场数据 { prices: {...}, wages: {...} }
 * @param {Object} taxPolicies - 税收政策
 * @returns {Object} { canExpand, reason, cost, profit, roi }
 */
export const canOwnerExpand = (building, ownerStratum, ownerWealth, expansionSettings, currentCount, market = {}, taxPolicies = {}) => {
    if (!building || !ownerStratum) {
        return { canExpand: false, reason: '无效建筑', cost: 0, profit: 0, roi: 0 };
    }

    const settings = expansionSettings?.[building.id];
    if (!settings?.allowed) {
        return { canExpand: false, reason: '未允许扩张', cost: 0, profit: 0, roi: 0 };
    }

    if (settings.maxCount && currentCount >= settings.maxCount) {
        return { canExpand: false, reason: '已达扩张上限', cost: 0, profit: 0, roi: 0 };
    }

    // 计算成本（使用实际市场价格）
    const prices = market?.prices || {};
    const bc = building.baseCost || {};
    let baseCost = 0;
    for (const [resource, amount] of Object.entries(bc)) {
        const price = prices[resource] ?? 1;
        baseCost += amount * price;
    }
    baseCost = baseCost > 0 ? Math.round(baseCost) : 100;

    // 计算建筑盈利
    const profitResult = calculateBuildingProfit(building, market, taxPolicies);
    const profit = profitResult.profit;
    
    // 计算 ROI（投资回报率）
    const roi = baseCost > 0 ? profit / baseCost : 0;

    // 盈利检查：不盈利的建筑不扩张
    if (profit <= 0) {
        return { canExpand: false, reason: '建筑不盈利', cost: baseCost, profit, roi };
    }

    if (ownerWealth < baseCost) {
        return { canExpand: false, reason: '业主财富不足', cost: baseCost, profit, roi };
    }

    return { canExpand: true, reason: null, cost: baseCost, profit, roi };
};

/**
 * 处理业主自动扩张
 * @param {Array} buildings - 建筑列表
 * @param {Object} classWealth - 阶层财富 { stratum: wealth }
 * @param {Object} expansionSettings - 扩张设置
 * @param {Object} buildingCounts - 当前建筑数量 { buildingId: count }
 * @param {Object} market - 市场数据 { prices: {...}, wages: {...} }
 * @param {Object} taxPolicies - 税收政策
 * @returns {Object} { expansions, wealthDeductions }
 */
export const processOwnerExpansions = (buildings, classWealth, expansionSettings, buildingCounts, market = {}, taxPolicies = {}) => {
    const expansions = [];
    const wealthDeductions = {};

    if (!buildings || !classWealth || !expansionSettings) {
        console.log('[FREE MARKET] processOwnerExpansions early return:', {
            hasBuildings: !!buildings,
            hasClassWealth: !!classWealth,
            hasExpansionSettings: !!expansionSettings
        });
        return { expansions, wealthDeductions };
    }

    // 每回合最多扩张1个建筑（防止爆发式增长）
    const candidates = [];
    const rejectionReasons = []; // [DEBUG]

    for (const building of buildings) {
        if (!building.owner) continue;

        const ownerStratum = building.owner;
        const ownerWealth = classWealth[ownerStratum] || 0;
        const currentCount = buildingCounts[building.id] || 0;

        const { canExpand, reason, cost, profit, roi } = canOwnerExpand(
            building, ownerStratum, ownerWealth, expansionSettings, currentCount, market, taxPolicies
        );

        if (canExpand) {
            // 计算扩张权重: profit^2 / cost
            // 同时考虑绝对盈利和 ROI
            const weight = cost > 0 ? Math.max(0.01, (profit * profit) / cost) : 0.01;
            
            candidates.push({
                buildingId: building.id,
                owner: ownerStratum,
                cost,
                profit,
                roi,
                weight,
            });
        } else {
            // [DEBUG] 记录拒绝原因
            rejectionReasons.push({
                buildingId: building.id,
                owner: ownerStratum,
                ownerWealth,
                reason,
                cost,
                profit,
                roi,
                settingsForBuilding: expansionSettings[building.id]
            });
        }
    }

    // [DEBUG] 输出详细诊断信息
    console.log('[FREE MARKET] processOwnerExpansions:', {
        totalBuildingsChecked: buildings.filter(b => b.owner).length,
        candidatesFound: candidates.length,
        candidates: candidates.map(c => ({ id: c.buildingId, profit: c.profit.toFixed(2), roi: (c.roi * 100).toFixed(1) + '%', weight: c.weight.toFixed(2) })),
        firstFewRejections: rejectionReasons.slice(0, 5)
    });

    if (candidates.length > 0) {
        // 加权随机选择：盈利越高的建筑被选中的概率越大
        const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
        let randomValue = Math.random() * totalWeight;
        let selected = candidates[0];
        
        for (const candidate of candidates) {
            randomValue -= candidate.weight;
            if (randomValue <= 0) {
                selected = candidate;
                break;
            }
        }
        
        console.log('[FREE MARKET] Selected for expansion:', {
            buildingId: selected.buildingId,
            profit: selected.profit.toFixed(2),
            roi: (selected.roi * 100).toFixed(1) + '%',
            weight: selected.weight.toFixed(2),
            probability: ((selected.weight / totalWeight) * 100).toFixed(1) + '%'
        });
        
        expansions.push(selected);
        wealthDeductions[selected.owner] = (wealthDeductions[selected.owner] || 0) + selected.cost;
    }

    return { expansions, wealthDeductions };
};

// ========== 政府价格管制系统 ==========

/**
 * 计算单次购买交易的政府价格管制效果
 * 当买家购买资源时：
 * - 若市场价 < 政府出售价：买家额外支付差价给政府
 * - 若市场价 > 政府出售价：政府补贴差价给买家
 * 
 * @param {string} resourceKey - 资源键
 * @param {number} amount - 交易数量
 * @param {number} marketPrice - 市场价格
 * @param {Object} priceControls - 价格管制设置
 * @returns {Object} { adjustment: number, isIncome: boolean, effectivePrice: number }
 */
export const calculateBuyPriceControl = (resourceKey, amount, marketPrice, priceControls) => {
    if (!priceControls?.enabled) {
        return { adjustment: 0, isIncome: false, effectivePrice: marketPrice };
    }

    const govSellPrice = priceControls.governmentSellPrices?.[resourceKey];
    if (govSellPrice === undefined || govSellPrice === null) {
        return { adjustment: 0, isIncome: false, effectivePrice: marketPrice };
    }

    // 买家实际支付的价格是政府出售价
    const effectivePrice = govSellPrice;
    const priceDiff = (govSellPrice - marketPrice) * amount;

    if (priceDiff > 0) {
        // 政府出售价 > 市场价：买家额外支付，政府收入
        return { adjustment: priceDiff, isIncome: true, effectivePrice };
    } else if (priceDiff < 0) {
        // 政府出售价 < 市场价：政府补贴买家，政府支出
        return { adjustment: Math.abs(priceDiff), isIncome: false, effectivePrice };
    }

    return { adjustment: 0, isIncome: false, effectivePrice: marketPrice };
};

/**
 * 计算单次出售交易的政府价格管制效果
 * 当卖家出售资源时：
 * - 若市场价 < 政府收购价：政府支付差价给卖家（保底收购）
 * - 若市场价 > 政府收购价：卖家上缴差价给政府（超额利润税）
 * 
 * @param {string} resourceKey - 资源键
 * @param {number} amount - 交易数量
 * @param {number} marketPrice - 市场价格
 * @param {Object} priceControls - 价格管制设置
 * @returns {Object} { adjustment: number, isIncome: boolean, effectivePrice: number }
 */
export const calculateSellPriceControl = (resourceKey, amount, marketPrice, priceControls) => {
    if (!priceControls?.enabled) {
        return { adjustment: 0, isIncome: false, effectivePrice: marketPrice };
    }

    const govBuyPrice = priceControls.governmentBuyPrices?.[resourceKey];
    if (govBuyPrice === undefined || govBuyPrice === null) {
        return { adjustment: 0, isIncome: false, effectivePrice: marketPrice };
    }

    // 卖家实际获得的价格是政府收购价
    const effectivePrice = govBuyPrice;
    const priceDiff = (marketPrice - govBuyPrice) * amount;

    if (priceDiff > 0) {
        // 市场价 > 政府收购价：卖家上缴超额利润，政府收入
        return { adjustment: priceDiff, isIncome: true, effectivePrice };
    } else if (priceDiff < 0) {
        // 市场价 < 政府收购价：政府补贴卖家，政府支出
        return { adjustment: Math.abs(priceDiff), isIncome: false, effectivePrice };
    }

    return { adjustment: 0, isIncome: false, effectivePrice: marketPrice };
};

/**
 * 应用购买时的价格管制效果
 * 修改实际支付成本，并更新税务分解
 * 
 * @param {Object} params - 参数对象
 * @param {string} params.resourceKey - 资源键
 * @param {number} params.amount - 交易数量
 * @param {number} params.marketPrice - 市场价格
 * @param {Object} params.priceControls - 价格管制设置
 * @param {Object} params.taxBreakdown - 税务分解对象（会被修改）
 * @param {Object} params.resources - 资源对象（用于政府支出时扣除银币）
 * @returns {Object} { effectivePrice: number, success: boolean }
 */
export const applyBuyPriceControl = ({
    resourceKey,
    amount,
    marketPrice,
    priceControls,
    taxBreakdown,
    resources
}) => {
    const result = calculateBuyPriceControl(resourceKey, amount, marketPrice, priceControls);

    if (result.adjustment > 0) {
        if (result.isIncome) {
            // 政府收入
            taxBreakdown.priceControlIncome = (taxBreakdown.priceControlIncome || 0) + result.adjustment;
        } else {
            // 政府支出：检查国库是否充足
            const treasury = resources.silver || 0;
            if (treasury >= result.adjustment) {
                resources.silver = treasury - result.adjustment;
                taxBreakdown.priceControlExpense = (taxBreakdown.priceControlExpense || 0) + result.adjustment;
            } else {
                // 国库不足，使用市场价
                return { effectivePrice: marketPrice, success: false };
            }
        }
    }

    return { effectivePrice: result.effectivePrice, success: true };
};

/**
 * 应用出售时的价格管制效果
 * 
 * @param {Object} params - 参数对象
 * @param {string} params.resourceKey - 资源键
 * @param {number} params.amount - 交易数量
 * @param {number} params.marketPrice - 市场价格
 * @param {Object} params.priceControls - 价格管制设置
 * @param {Object} params.taxBreakdown - 税务分解对象（会被修改）
 * @param {Object} params.resources - 资源对象（用于政府支出时扣除银币）
 * @returns {Object} { effectivePrice: number, success: boolean }
 */
export const applySellPriceControl = ({
    resourceKey,
    amount,
    marketPrice,
    priceControls,
    taxBreakdown,
    resources
}) => {
    const result = calculateSellPriceControl(resourceKey, amount, marketPrice, priceControls);

    if (result.adjustment > 0) {
        if (result.isIncome) {
            // 政府收入（超额利润税）
            taxBreakdown.priceControlIncome = (taxBreakdown.priceControlIncome || 0) + result.adjustment;
        } else {
            // 政府支出（保底收购补贴）
            const treasury = resources.silver || 0;
            if (treasury >= result.adjustment) {
                resources.silver = treasury - result.adjustment;
                taxBreakdown.priceControlExpense = (taxBreakdown.priceControlExpense || 0) + result.adjustment;
            } else {
                // 国库不足，使用市场价
                return { effectivePrice: marketPrice, success: false };
            }
        }
    }

    return { effectivePrice: result.effectivePrice, success: true };
};
