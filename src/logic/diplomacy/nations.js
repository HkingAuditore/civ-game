/**
 * Nations AI Module
 * Handles AI nation updates, war logic, diplomacy, and economy
 */

import { RESOURCES, PEACE_TREATY_TYPES, getTreatyBreachPenalty } from '../../config/index.js';
import { simulateBattle, UNIT_TYPES } from '../../config/militaryUnits.js';
import { getEnemyUnitsForEpoch } from '../../config/militaryActions.js';
import {
    calculateAIGiftAmount,
    calculateAIPeaceTribute,
    calculateAISurrenderDemand
} from '../../utils/diplomaticUtils.js';
import {
    clamp,
    PEACE_REQUEST_COOLDOWN_DAYS,
    MAX_CONCURRENT_WARS,
    GLOBAL_WAR_COOLDOWN
} from '../utils/index.js';
import { getRelationMonthlyDriftRate } from '../../config/difficulty.js';
import { processVassalUpdates, calculateDynamicSatisfactionCap, SATISFACTION_CAP_CONFIG } from './vassalSystem.js';
import {
    calculateNationLocalPrice,
    getNationInventoryBaseline,
} from './warEconomy.js';
import {
    AI_ECONOMY_CONFIG,
    getSocialStructureTemplate,
    TREATY_CONFIGS,
    TREATY_TYPE_LABELS,
    VASSAL_POLICY_SATISFACTION_EFFECTS,
} from '../../config/diplomacy.js';


const applyTreasuryChange = (resources, delta, reason, onTreasuryChange) => {
    if (!resources || !Number.isFinite(delta) || delta === 0) return 0;
    const before = Number(resources.silver || 0);
    const after = Math.max(0, before + delta);
    const actual = after - before;
    resources.silver = after;
    if (typeof onTreasuryChange === 'function' && actual !== 0) {
        onTreasuryChange(actual, reason);
    }
    return actual;
};

/**
 * Helper: Apply resource change and optionally invoke callback for tracking
 */
const applyResourceChange = (resources, resourceType, delta, reason, onResourceChange) => {
    if (!resources || !Number.isFinite(delta) || delta === 0) return 0;
    const before = Number(resources[resourceType] || 0);
    const after = Math.max(0, before + delta);
    const actual = after - before;
    resources[resourceType] = after;
    if (typeof onResourceChange === 'function' && actual !== 0) {
        onResourceChange(actual, reason, resourceType);
    }
    return actual;
};

// ========== AI国家经济数据初始化与更新 ==========

/**
 * 基础财富分配系数（未受政策影响时的默认分布）
 * 这只是初始化时的基准，实际分配会根据政策动态调整
 */
const BASE_WEALTH_DISTRIBUTION = {
    elites: 0.55,      // 精英阶层基础占比55%
    commoners: 0.35,   // 平民阶层基础占比35%
    underclass: 0.10,  // 底层阶层基础占比10%
};

/**
 * 基础人口比例（未受政策影响时的默认分布）
 */
const BASE_POPULATION_RATIO = {
    elites: 0.08,      // 精英阶层基础占比8%
    commoners: 0.62,   // 平民阶层基础占比62%
    underclass: 0.30,  // 底层阶层基础占比30%
};

/**
 * 政策对阶层财富分配的影响
 * 返回每个阶层的财富份额修正值
 */
const getPolicyWealthEffects = (vassalPolicy = {}) => {
    const laborPolicy = vassalPolicy.labor || 'standard';
    const tradePolicy = vassalPolicy.tradePolicy || 'preferential';
    const governancePolicy = vassalPolicy.governance || 'autonomous';
    const investmentPolicy = vassalPolicy.investmentPolicy || 'autonomous';

    // 劳工政策对财富分配的影响
    // 剥削性政策将财富从底层转移到精英
    const laborEffects = {
        standard: { elites: 0, commoners: 0, underclass: 0 },
        corvee: { elites: 0.03, commoners: 0, underclass: -0.03 },  // 徭役：底层→精英
        debt_bondage: { elites: 0.05, commoners: -0.02, underclass: -0.03 },  // 债务奴役：底层+平民→精英
        serfdom: { elites: 0.08, commoners: -0.03, underclass: -0.05 },  // 农奴制
        slavery: { elites: 0.12, commoners: -0.04, underclass: -0.08 },  // 奴隶制：极端剥削
    };

    // 贸易政策对财富分配的影响
    // 掠夺性政策减少商人/平民阶层的财富
    const tradeEffects = {
        free_trade: { elites: -0.02, commoners: 0.02, underclass: 0 },      // 自由贸易：利于平民
        preferential: { elites: 0, commoners: 0, underclass: 0 },
        monopoly: { elites: 0.04, commoners: -0.03, underclass: -0.01 },  // 垄断：利于精英
        plunder: { elites: 0.08, commoners: -0.05, underclass: -0.03 },  // 掠夺：财富集中到精英
    };

    // 治理政策对财富分配的影响
    // 直接统治削弱本地精英
    const governanceEffects = {
        autonomous: { elites: 0.02, commoners: 0, underclass: -0.02 },  // 自治：本地精英受益
        puppet_govt: { elites: 0, commoners: 0, underclass: 0 },
        direct_rule: { elites: -0.05, commoners: 0, underclass: 0.05 },   // 直接统治：削弱本地精英
    };

    // 投资政策对财富分配的影响
    // 强制投资可能扭曲本地经济结构
    const investmentEffects = {
        autonomous: { elites: 0, commoners: 0, underclass: 0 },
        guided: { elites: 0.02, commoners: 0.01, underclass: -0.03 },  // 引导投资：部分利于上层
        forced: { elites: 0.05, commoners: -0.02, underclass: -0.03 },  // 强制投资：扭曲经济
    };

    const labor = laborEffects[laborPolicy] || laborEffects.standard;
    const trade = tradeEffects[tradePolicy] || tradeEffects.preferential;
    const governance = governanceEffects[governancePolicy] || governanceEffects.puppet_govt;
    const investment = investmentEffects[investmentPolicy] || investmentEffects.autonomous;

    return {
        elites: labor.elites + trade.elites + governance.elites + investment.elites,
        commoners: labor.commoners + trade.commoners + governance.commoners + investment.commoners,
        underclass: labor.underclass + trade.underclass + governance.underclass + investment.underclass,
    };
};

/**
 * 政策对人口比例的影响
 * 严苛政策会导致人口流动（底层人口减少/逃亡、精英外流等）
 */
const getPolicyPopulationEffects = (vassalPolicy = {}) => {
    const laborPolicy = vassalPolicy.labor || 'standard';
    const governancePolicy = vassalPolicy.governance || 'autonomous';

    // 劳工政策对人口比例的影响
    // 剥削性政策导致底层人口减少（死亡、逃亡、起义被镇压）
    const laborEffects = {
        standard: { elites: 0, commoners: 0, underclass: 0 },
        corvee: { elites: 0, commoners: 0.01, underclass: -0.01 },  // 底层略减
        debt_bondage: { elites: 0, commoners: 0.02, underclass: -0.02 },
        serfdom: { elites: 0, commoners: 0.03, underclass: -0.03 },  // 人口向上流动受阻
        slavery: { elites: 0.01, commoners: 0.04, underclass: -0.05 },  // 底层大量减少
    };

    // 治理政策对人口比例的影响
    // 直接统治导致本地精英流失
    const governanceEffects = {
        autonomous: { elites: 0.01, commoners: 0, underclass: -0.01 },  // 精英增加
        puppet_govt: { elites: 0, commoners: 0, underclass: 0 },
        direct_rule: { elites: -0.02, commoners: 0.01, underclass: 0.01 },   // 精英流失
    };

    const labor = laborEffects[laborPolicy] || laborEffects.standard;
    const governance = governanceEffects[governancePolicy] || governanceEffects.puppet_govt;

    return {
        elites: labor.elites + governance.elites,
        commoners: labor.commoners + governance.commoners,
        underclass: labor.underclass + governance.underclass,
    };
};

/**
 * 计算朝贡对各阶层财富的抽取
 * 朝贡按阶层财富比例抽取，但精英有更多手段规避
 * @param {number} tributeRate - 朝贡率（0-1）
 * @returns {Object} 各阶层的财富抽取比例
 */
const getTributeExtractionRates = (tributeRate = 0) => {
    // 精英有能力规避部分朝贡负担（转嫁给下层）
    // 朝贡率越高，转嫁效应越明显
    const evasionFactor = Math.min(0.5, tributeRate * 0.8);  // 精英最多规避50%

    return {
        elites: tributeRate * (1 - evasionFactor),      // 精英实际承担较少
        commoners: tributeRate * (1 + evasionFactor * 0.3),  // 平民承担略多
        underclass: tributeRate * (1 + evasionFactor * 0.5), // 底层承担最多
    };
};

/**
 * 根据附庸政策计算阶层满意度修正
 * @param {Object} vassalPolicy - 附庸政策
 * @param {string} stratum - 阶层
 * @returns {number} 目标满意度修正值
 */
const getPolicySatisfactionModifier = (vassalPolicy = {}, stratum) => {
    const laborPolicy = vassalPolicy.labor || 'standard';
    const tradePolicy = vassalPolicy.tradePolicy || 'preferential';
    const governancePolicy = vassalPolicy.governance || 'autonomous';
    const militaryPolicy = vassalPolicy.military || 'call_to_arms';
    const investmentPolicy = vassalPolicy.investmentPolicy || 'autonomous';

    const effects = VASSAL_POLICY_SATISFACTION_EFFECTS;
    const labor = effects.labor?.[laborPolicy]?.[stratum] || 0;
    const trade = effects.tradePolicy?.[tradePolicy]?.[stratum] || 0;
    const governance = effects.governance?.[governancePolicy]?.[stratum] || 0;
    const military = effects.military?.[militaryPolicy]?.[stratum] || 0;
    const investment = effects.investmentPolicy?.[investmentPolicy]?.[stratum] || 0;

    return labor + trade + governance + military + investment;
};

/**
 * 计算当地生存成本
 * @param {Object} nationPrices - 当地市场价格
 * @returns {number} 每日生存成本
 */
const calculateSubsistenceCost = (nationPrices = {}) => {
    // 基本生存篮子：食物、布料、木材
    const basket = {
        food: 1.0,
        cloth: 0.1,
        wood: 0.2,
    };

    let cost = 0;
    Object.entries(basket).forEach(([res, amount]) => {
        const price = nationPrices[res] || RESOURCES[res]?.basePrice || 1;
        cost += amount * price;
    });

    return cost;
};

const syncNationInventoryMirror = (nation) => {
    if (!nation) return nation;
    const nationInventories = { ...(nation.nationInventories || {}) };
    return {
        ...nation,
        nationInventories,
        inventory: {
            ...(nation.inventory || {}),
            ...nationInventories,
        },
    };
};


/**
 * 初始化AI国家的经济数据（价格、库存、阶层）
 * @param {Object} nation - 国家对象
 * @param {Object} marketPrices - 玩家市场价格
 * @returns {Object} 更新后的国家对象
 */
export const initializeNationEconomyData = (nation, marketPrices = {}) => {
    if (!nation) return nation;

    let updated = { ...nation };
    const config = AI_ECONOMY_CONFIG;
    const wealth = Math.max(100, Number(updated.wealth || 1000));

    // 1. 初始化库存数据（如果不存在）
    if (!updated.nationInventories || Object.keys(updated.nationInventories).length === 0) {
        updated.nationInventories = {};
        Object.entries(RESOURCES).forEach(([resourceKey, resourceConfig]) => {
            if (resourceConfig.type === 'virtual' || resourceConfig.type === 'currency') return;

            const baseInventory = getNationInventoryBaseline({ resourceKey, wealth });
            updated.nationInventories[resourceKey] = Math.max(5, Math.floor(baseInventory * (0.8 + Math.random() * 0.4)));
        });
    }

    updated = syncNationInventoryMirror(updated);

    // 2. 初始化价格数据（如果不存在）
    if (!updated.nationPrices || Object.keys(updated.nationPrices).length === 0) {
        updated.nationPrices = {};
        Object.entries(RESOURCES).forEach(([resourceKey, resourceConfig]) => {
            // 跳过虚拟资源
            if (resourceConfig.type === 'virtual' || resourceConfig.type === 'currency') return;

            // 基于玩家市场价格或基础价格，再叠加本地库存压力
            const basePrice = marketPrices[resourceKey] || resourceConfig.basePrice || 1;
            const variation = (Math.random() - 0.5) * 2 * config.prices.initialVariation;
            const seededPrice = basePrice * (1 + variation);
            updated.nationPrices[resourceKey] = calculateNationLocalPrice({
                resourceKey,
                nation: updated,
                marketPrice: basePrice,
                currentPrice: seededPrice,
                inventoryOverride: updated.nationInventories?.[resourceKey],
                wealthOverride: wealth,
            });
        });
    }

    // 3. 初始化阶层结构（如果不存在或不完整）
    if (!updated.socialStructure) {
        const governmentType = updated.governmentType || 'default';
        updated.socialStructure = getSocialStructureTemplate(governmentType);
    }

    // 立即执行一次完整的阶层数据更新以填充 population 和 wealth
    updated.socialStructure = updateSocialClasses(updated).socialStructure;

    // 4. 初始化稳定度（如果不存在）
    if (typeof updated.stability !== 'number') {
        updated.stability = 50 + (Math.random() - 0.5) * 20;
    }

    return updated;
};


/**
 * 计算玩家在附庸国的投资对阶层经济的影响
 * @param {Object} nation - 国家对象
 * @param {Array} overseasInvestments - 海外投资列表（可选，从nation._investmentEffects获取）
 * @returns {Object} 投资对各阶层的影响 { wealthFlow, jobCreation }
 */
const calculateInvestmentImpact = (nation) => {
    // 从nation对象中获取缓存的投资影响数据
    // 这些数据由overseasInvestment.js在处理投资收益时更新
    const investmentEffects = nation._investmentEffects || {};

    // 投资带来的财富流动：
    // - 工资流入底层和平民（创造就业）
    // - 利润流入精英和外资方（资本回报）
    // - 租金流入地主阶层（如果有土地使用）
    const wagesPaid = investmentEffects.totalWages || 0;          // 支付给本地工人的工资
    const profitsExtracted = investmentEffects.profitsExtracted || 0; // 被外资抽走的利润
    const localReinvestment = investmentEffects.localReinvestment || 0; // 在当地再投资

    // 工资分配：70%流入底层，30%流入平民（技术工人）
    const wealthFlow = {
        elites: localReinvestment * 0.4,           // 部分再投资惠及本地精英
        commoners: wagesPaid * 0.3 + localReinvestment * 0.3,
        underclass: wagesPaid * 0.7 + localReinvestment * 0.3,
    };

    // 就业创造对人口比例的影响（小幅度）
    // 投资越多，底层人口越能维持生存（减少死亡/外流）
    const investmentIntensity = Math.min(1, wagesPaid / Math.max(100, nation.wealth || 1000));
    const jobCreation = {
        elites: 0,
        commoners: investmentIntensity * 0.005,
        underclass: investmentIntensity * 0.01,  // 投资保护底层人口
    };

    // 负面效果：利润被抽走减少总财富
    const wealthDrain = profitsExtracted;

    return { wealthFlow, jobCreation, wealthDrain };
};

/**
 * 更新阶层数据（人口、财富、生活水平）- 动态模型
 * 
 * 核心设计：
 * 1. 阶层财富不再是简单的按固定比例分配
 * 2. 政策、朝贡、投资都会影响财富在阶层间的流动
 * 3. 人口比例会根据政策和经济状况缓慢变化
 * 4. 所有变化都是渐进式的，不会瞬间跳变
 * 
 * @param {Object} nation - 国家对象
 * @returns {Object} 更新后的国家对象
 */
/**
 * 国库占国家总财富的比例
 * 国库用于军事、基建、行政开支等，不属于民众可分配财富
 */
const TREASURY_RATIO = 0.45;  // 45%的国家财富是国库，55%是民众财富

/**
 * 阶层生活水平期望值（基于生存成本的倍数）
 * 这些值决定了什么样的生活水平能达到基准满意度（70%）
 */
const SOL_EXPECTATIONS = {
    elites: 25.0,      // 精英期望很高的生活水平
    commoners: 8.0,    // 平民期望中等生活水平
    underclass: 3.0,   // 底层期望较低，但仍需超过最低生存线
};

/**
 * 更新阶层数据（人口、财富、生活水平）- 动态模型
 * @param {Object} nation - 国家对象
 * @param {Object} context - 上下文信息（用于计算动态满意度上限）
 * @returns {Object} 更新后的国家对象
 */
const updateSocialClasses = (nation, context = {}) => {
    if (!nation || !nation.socialStructure) return nation;

    const updated = { ...nation };
    const structure = { ...updated.socialStructure };
    const totalPop = updated.population || 1000;
    const totalNationWealth = updated.wealth || 1000;

    // 区分国库和民众可分配财富
    // 国库用于军事、基建、行政等，不分配给民众
    const treasuryWealth = totalNationWealth * TREASURY_RATIO;
    const distributedWealth = totalNationWealth - treasuryWealth;  // 民众可分配财富

    const subsistenceCost = calculateSubsistenceCost(updated.nationPrices);
    const vassalPolicy = updated.vassalPolicy || {};
    const tributeRate = updated.tributeRate || 0;

    // ========== 1. 计算政策影响 ==========
    const policyWealthEffects = getPolicyWealthEffects(vassalPolicy);
    const policyPopulationEffects = getPolicyPopulationEffects(vassalPolicy);

    // ========== 2. 计算朝贡抽取 ==========
    const tributeExtraction = getTributeExtractionRates(tributeRate);

    // ========== 3. 计算投资影响 ==========
    const investmentImpact = calculateInvestmentImpact(updated);

    // ========== 4. 通用影响因素 ==========
    let generalSatisfactionMod = 0;
    if (updated.isAtWar) generalSatisfactionMod -= 5;

    // ========== 4.5 计算动态满意度上限 ==========
    // 满意度上限受统治政策、经济对比、国际局势、军事实力等多因素影响
    const dynamicCaps = calculateDynamicSatisfactionCap(updated, context);

    // ========== 5. 计算各阶层的目标财富份额和人口比例 ==========
    const targetWealthShares = {};
    const targetPopulationRatios = {};
    let totalWealthShare = 0;
    let totalPopRatio = 0;

    ['elites', 'commoners', 'underclass'].forEach(stratum => {
        // 基础份额 + 政策修正
        let wealthShare = BASE_WEALTH_DISTRIBUTION[stratum] + policyWealthEffects[stratum];
        let popRatio = BASE_POPULATION_RATIO[stratum] + policyPopulationEffects[stratum];

        // 投资创造就业对人口比例的影响
        popRatio += investmentImpact.jobCreation[stratum];

        // 朝贡减少该阶层的有效财富份额
        // （这里通过减少份额来模拟朝贡对该阶层的影响）
        wealthShare *= (1 - tributeExtraction[stratum] * 0.3);  // 朝贡不会完全抹除份额

        // 确保不为负
        wealthShare = Math.max(0.01, wealthShare);
        popRatio = Math.max(0.02, popRatio);

        targetWealthShares[stratum] = wealthShare;
        targetPopulationRatios[stratum] = popRatio;
        totalWealthShare += wealthShare;
        totalPopRatio += popRatio;
    });

    // 归一化（确保总和为1）
    ['elites', 'commoners', 'underclass'].forEach(stratum => {
        targetWealthShares[stratum] /= totalWealthShare;
        targetPopulationRatios[stratum] /= totalPopRatio;
    });

    // ========== 6. 更新各阶层数据 ==========
    ['elites', 'commoners', 'underclass'].forEach(stratum => {
        if (!structure[stratum]) {
            structure[stratum] = {
                ratio: BASE_POPULATION_RATIO[stratum],
                wealthShare: BASE_WEALTH_DISTRIBUTION[stratum],
                population: 0,
                wealth: 0,
                satisfaction: 50,
                sol: 1.0,
            };
        }

        const data = { ...structure[stratum] };

        // 6.1 缓慢趋近目标人口比例（每tick变化2%）
        const currentRatio = data.ratio || BASE_POPULATION_RATIO[stratum];
        const targetRatio = targetPopulationRatios[stratum];
        data.ratio = currentRatio * 0.98 + targetRatio * 0.02;
        data.population = Math.floor(totalPop * data.ratio);

        // 6.2 缓慢趋近目标财富份额（每tick变化3%）
        const currentWealthShare = data.wealthShare || BASE_WEALTH_DISTRIBUTION[stratum];
        const targetWealthShare = targetWealthShares[stratum];
        data.wealthShare = currentWealthShare * 0.97 + targetWealthShare * 0.03;

        // 计算实际财富（基于份额，从民众可分配财富中分配）+ 投资流入
        // 注意：这里用 distributedWealth 而不是 totalNationWealth
        const baseWealth = distributedWealth * data.wealthShare;
        const investmentBonus = investmentImpact.wealthFlow[stratum] || 0;
        data.wealth = Math.floor(baseWealth + investmentBonus);

        // 6.3 计算人均财富与生活水平 (SoL)
        const perCapitaWealth = data.population > 0 ? data.wealth / data.population : 0;
        const solRatio = subsistenceCost > 0 ? perCapitaWealth / subsistenceCost : 1;
        data.sol = solRatio;

        // 6.4 更新满意度
        // 使用更合理的期望值
        const expectedSol = SOL_EXPECTATIONS[stratum] || 5.0;
        const solRatioNormalized = expectedSol > 0 ? solRatio / expectedSol : 0;

        // 获取该阶层的动态满意度上限
        const dynamicCap = dynamicCaps[stratum] || SATISFACTION_CAP_CONFIG.baseCap;

        // 基础满意度计算（改进版）
        // - 低于期望：线性增长到70%
        // - 超出期望：缓慢对数增长，但受动态上限限制
        let baseSatisfaction = 0;
        if (solRatioNormalized < 1.0) {
            // 低于期望值：线性增长
            baseSatisfaction = 70 * solRatioNormalized;
        } else {
            // 超出期望值：对数增长，但受动态上限限制
            // log10(2) ≈ 0.3, log10(10) ≈ 1.0
            // 生活水平翻倍只增加约3%满意度
            baseSatisfaction = Math.min(dynamicCap, 70 + Math.log10(solRatioNormalized + 1) * 10);
        }

        const policySatisfactionMod = getPolicySatisfactionModifier(vassalPolicy, stratum);

        // 最终上限：综合考虑动态上限和政策惩罚
        // 政策惩罚会进一步降低上限
        const finalCap = policySatisfactionMod < 0
            ? Math.max(SATISFACTION_CAP_CONFIG.absoluteMin, dynamicCap + policySatisfactionMod * 1.5)
            : dynamicCap;

        let targetSatisfaction = baseSatisfaction + generalSatisfactionMod + policySatisfactionMod;
        targetSatisfaction = Math.max(0, Math.min(finalCap, targetSatisfaction));

        // 缓慢趋近
        const currentSat = data.satisfaction || 50;
        data.satisfaction = currentSat * 0.95 + targetSatisfaction * 0.05;

        // 6.5 记录影响因素用于UI显示
        data._factors = {
            policyWealthEffect: policyWealthEffects[stratum],
            policyPopulationEffect: policyPopulationEffects[stratum],
            tributeExtraction: tributeExtraction[stratum],
            investmentWealthFlow: investmentImpact.wealthFlow[stratum],
            investmentJobCreation: investmentImpact.jobCreation[stratum],
            // 新增：满意度上限相关
            satisfactionCap: finalCap,
            satisfactionCapFactors: dynamicCaps.factors?.[stratum] || [],
        };

        structure[stratum] = data;
    });

    // 记录投资带来的财富流失（用于UI显示）
    updated._investmentWealthDrain = investmentImpact.wealthDrain;
    updated.socialStructure = structure;
    return updated;
};

/**
 * 更新AI国家的每日经济数据
 * @param {Object} nation - 国家对象
 * @param {Object} marketPrices - 玩家市场价格
 * @param {Object} context - 上下文信息（用于计算动态满意度上限）
 * @returns {Object} 更新后的国家对象
 */
export const updateNationEconomyData = (nation, marketPrices = {}, context = {}) => {
    if (!nation || !nation.nationPrices) return nation;

    let updated = { ...nation };
    const config = AI_ECONOMY_CONFIG;
    const wealth = Math.max(100, Number(updated.wealth || 1000));

    // 1. 更新库存（基于财富动态调整 + 随机波动）
    // 设计理念：
    // - 产量/消耗量随财富增长（富裕国家生产和消费更多）
    // - 库存基线随财富增长（富裕国家有更大的库存容量）
    // - 库存向基线趋近，但保持随机波动以创造贸易机会
    // - 战时采购/前线消耗则在 useGameLoop 中额外从这里真实扣减
    updated.nationInventories = { ...updated.nationInventories };

    Object.entries(updated.nationInventories).forEach(([resourceKey, currentInventory]) => {
        const resourceConfig = RESOURCES[resourceKey];
        if (!resourceConfig) return;

        const baseInventory = getNationInventoryBaseline({ resourceKey, wealth });
        const targetInventory = baseInventory * (0.9 + Math.random() * 0.2);
        const productionConsumption = baseInventory * config.inventory.dailyChangeRate * (Math.random() - 0.5) * 2;

        const convergenceRate = 0.05;
        let newInventory = currentInventory * (1 - convergenceRate) + targetInventory * convergenceRate + productionConsumption;

        // 战争状态下，民用库存每天会有额外损耗，体现常备军备战与运输损耗；
        // 真实的前线采购/补仓会在 useGameLoop 中进一步从 nationInventories 扣减。
        if (updated.isAtWar) {
            newInventory *= 0.98;
        }

        const minInventory = Math.max(5, baseInventory * 0.1);
        const maxInventory = baseInventory * 3;
        updated.nationInventories[resourceKey] = Math.max(minInventory, Math.min(maxInventory, Math.floor(newInventory)));
    });

    updated = syncNationInventoryMirror(updated);

    // 2. 更新价格：先做日常波动/对外收敛，再叠加本地库存压力
    updated.nationPrices = { ...updated.nationPrices };
    Object.entries(updated.nationPrices).forEach(([resourceKey, currentPrice]) => {
        const resourceConfig = RESOURCES[resourceKey];
        if (!resourceConfig) return;

        const variation = (Math.random() - 0.5) * 2 * config.prices.dailyVariation;
        let newPrice = currentPrice * (1 + variation);

        const playerPrice = marketPrices[resourceKey];
        if (playerPrice) {
            const hasFreeTrade = updated.treaties?.some(t => t.type === 'free_trade' && t.status === 'active');
            const convergenceRate = hasFreeTrade ? 0.03 : 0.01;
            newPrice = newPrice * (1 - convergenceRate) + playerPrice * convergenceRate;
        }

        updated.nationPrices[resourceKey] = calculateNationLocalPrice({
            resourceKey,
            nation: updated,
            marketPrice: playerPrice,
            currentPrice: newPrice,
            inventoryOverride: updated.nationInventories?.[resourceKey],
            wealthOverride: wealth,
            shock: updated.isAtWar ? 0.03 : 0,
        });
    });

    // 3. 全面更新阶层数据（代替旧的简单满意度更新）
    updated = updateSocialClasses(updated, context);

    return updated;
};


/**
 * Updates all nations each tick
 * @param {Object} params - Update parameters
 * @returns {Object} Updated nations and related data
 */
export const updateNations = ({
    nations,
    tick,
    epoch,
    resources,
    army,
    population,
    stabilityValue,
    logs,
    marketPrices = {},  // 新增：玩家市场价格，用于AI经济数据初始化和更新
    diplomaticReputation = 50, // Player's diplomatic reputation (0-100)
    difficultyLevel = 'normal', // Game difficulty level
    onTreasuryChange,
    onResourceChange,
}) => {
    const res = { ...resources };
    let warIndemnityIncome = 0;
    let raidPopulationLoss = 0;
    let vassalTributeIncome = 0;

    // Calculate player baselines for AI scaling
    const playerPopulationBaseline = Math.max(10, population);
    const playerWealthBaseline = Math.max(500, (res.food || 0) + (res.silver || 0) + (res.wood || 0));

    let updatedNations = (nations || []).map(nationInput => {
        // 首先初始化经济数据（如果不存在）
        let nation = initializeNationEconomyData({ ...nationInput }, marketPrices);
        const next = nation;

        // Process war-related updates
        if (next.isAtWar) {
            next.warDuration = (next.warDuration || 0) + 1;

            // Process war actions and battles
            processWarActions({
                nation: next,
                tick,
                epoch,
                res,
                army,
                stabilityValue,
                logs,
                onTreasuryChange,
                onResourceChange,
            });

            // Check for peace requests
            checkPeaceRequest({
                nation: next,
                tick,
                logs
            });

            // Check for AI surrender demands
            checkSurrenderDemand({
                nation: next,
                tick,
                population,
                playerWealth: playerWealthBaseline,
                logs
            });
        } else if (next.warDuration) {
            next.warDuration = 0;
        }

        // Relation decay
        processRelationDecay(next);

        // Check alliance status
        checkAllianceStatus({
            nation: next,
            tick,
            logs
        });

        // War declaration check
        checkWarDeclaration({
            nation: next,
            nations,
            tick,
            epoch,
            res,
            stabilityValue,
            logs
        });

        // Check treaty stability
        checkTreatyStability({
            nation: next,
            tick,
            logs
        });

        // Process installment payments
        if (next.installmentPayment && next.installmentPayment.remainingDays > 0) {
            const payment = next.installmentPayment.amount;
            applyTreasuryChange(res, payment, 'installment_payment_income', onTreasuryChange);
            warIndemnityIncome += payment;
            next.installmentPayment.paidAmount += payment;
            next.installmentPayment.remainingDays -= 1;

            if (next.installmentPayment.remainingDays === 0) {
                logs.push(`💰 ${next.name} completed all installment payments (total ${next.installmentPayment.totalAmount} silver).`);
                delete next.installmentPayment;
            }
        }

        // Post-war recovery
        if (!next.isAtWar) {
            const currentStrength = next.militaryStrength ?? 1.0;
            if (currentStrength < 1.0) {
                const recoveryRate = 0.005;
                next.militaryStrength = Math.min(1.0, currentStrength + recoveryRate);
            }
        }

        // Update economy (原有逻辑)
        updateNationEconomy({
            nation: next,
            tick,
            epoch,
            playerPopulationBaseline,
            playerWealthBaseline
        });

        // 更新AI国家经济数据（新增：价格、库存、阶层满意度）
        // 构建满意度上限计算所需的上下文
        const satisfactionContext = {
            suzereainWealth: playerWealthBaseline,
            suzereainPopulation: playerPopulationBaseline,
            suzereainMilitary: Object.values(army || {}).reduce((sum, count) => sum + count, 0) / 100,
            suzereainAtWar: updatedNations.some(n => n.isAtWar && !n.vassalOf),
            suzereainReputation: diplomaticReputation ?? 50, // Use actual reputation value
            hasIndependenceSupport: false,  // TODO: 可以检查是否有支持独立的势力
        };
        const economyUpdated = updateNationEconomyData(next, marketPrices, satisfactionContext);
        Object.assign(next, economyUpdated);

        return next;
    });

    // Process AI-AI relations and wars
    updatedNations = processAIRelations(updatedNations, tick, logs);

    // Monthly relation decay
    if (tick % 30 === 0) {
        updatedNations = processMonthlyRelationDecay(updatedNations);
    }

    // 处理附庸系统更新
    const playerAtWar = updatedNations.some(n => n.isAtWar && !n.vassalOf);
    const playerMilitary = Object.values(army || {}).reduce((sum, count) => sum + count, 0) / 100;
    const vassalResult = processVassalUpdates({
        nations: updatedNations,
        daysElapsed: tick,
        epoch,
        playerMilitary: Math.max(0.5, playerMilitary),
        playerStability: stabilityValue,
        playerAtWar,
        playerWealth: res.silver || 0,
        playerPopulation: population || 1000000,
        difficultyLevel,
        logs,
    });
    updatedNations = vassalResult.nations;
    vassalTributeIncome = vassalResult.tributeIncome;
    applyTreasuryChange(res, vassalTributeIncome, 'vassal_tribute_income', onTreasuryChange);

    // 处理附庸事件（独立战争等）
    if (vassalResult.vassalEvents && vassalResult.vassalEvents.length > 0) {
        vassalResult.vassalEvents.forEach(event => {
            if (event.type === 'independence_war') {
                logs.push(`VASSAL_INDEPENDENCE_WAR:${JSON.stringify(event)}`);
            }
        });
    }

    return {
        nations: updatedNations,
        resources: res,
        warIndemnityIncome,
        raidPopulationLoss,
        vassalTributeIncome,
    };
};

/**
 * Process war actions for a nation at war with player
 * @private
 */
const processWarActions = ({ nation, tick, epoch, res, army, stabilityValue, logs, onTreasuryChange, onResourceChange }) => {
    // Frequency of AI actions based on aggression
    const actionFrequency = Math.max(10, Math.floor(30 - (nation.aggression || 0.3) * 20));

    if (tick % actionFrequency !== 0) return;

    const actionRoll = Math.random();
    const aggression = nation.aggression || 0.3;

    // Determine action type based on AI personality
    let actionType = 'raid';
    if (actionRoll < 0.3 * aggression) {
        actionType = 'assault';
    } else if (actionRoll < 0.5) {
        actionType = 'raid';
    } else if (actionRoll < 0.7 && stabilityValue < 40) {
        actionType = 'scorched_earth';
    }

    // Generate enemy army
    const attackerArmy = getEnemyUnitsForEpoch(epoch, nation.militaryStrength || 1.0);
    const defenderArmy = { ...army };

    // Check if player has defending army
    const hasDefenders = Object.values(defenderArmy).some(count => count > 0);

    if (!hasDefenders) {
        // No defense - automatic loss (AI wins)
        const lossMultiplier = { raid: 0.15, assault: 0.25, scorched_earth: 0.2 }[actionType] || 0.15;
        const foodLoss = Math.floor((res.food || 0) * lossMultiplier);
        const silverLoss = Math.floor((res.silver || 0) * lossMultiplier * 0.5);

        if (foodLoss > 0) applyResourceChange(res, 'food', -foodLoss, 'ai_raid_loss', onResourceChange);
        if (silverLoss > 0) applyTreasuryChange(res, -silverLoss, 'ai_raid_loss', onTreasuryChange);

        nation.warScore = (nation.warScore || 0) - 8;  // AI赢：玩家优势减少
        nation.wealth = (nation.wealth || 0) + Math.floor((foodLoss + silverLoss) * 0.08);

        logs.push(`⚔️ ${nation.name} ${actionType === 'raid' ? 'raided' : 'attacked'} undefended! Lost ${foodLoss} food, ${silverLoss} silver.`);
    } else {
        // Battle simulation
        const battleResult = simulateBattle(
            { army: attackerArmy, epoch, militaryBuffs: 0.1 },
            { army: defenderArmy, epoch, militaryBuffs: 0 }
        );

        // Apply battle results
        Object.entries(battleResult.defenderLosses || {}).forEach(([unitId, count]) => {
            if (army[unitId]) {
                army[unitId] = Math.max(0, army[unitId] - count);
            }
        });

        if (battleResult.victory) {
            // AI won - 减少玩家优势
            const foodLoss = Math.floor((res.food || 0) * 0.1);
            const silverLoss = Math.floor((res.silver || 0) * 0.05);
            if (foodLoss > 0) applyResourceChange(res, 'food', -foodLoss, 'ai_battle_loss', onResourceChange);
            if (silverLoss > 0) applyTreasuryChange(res, -silverLoss, 'ai_battle_loss', onTreasuryChange);
            nation.warScore = (nation.warScore || 0) - 5;  // AI赢：玩家优势减少
        } else {
            // Player won - 增加玩家优势
            nation.warScore = (nation.warScore || 0) + 3;  // 玩家赢：玩家优势增加
            const enemyLosses = Object.values(battleResult.attackerLosses || {})
                .reduce((sum, val) => sum + (val || 0), 0);
            nation.enemyLosses = (nation.enemyLosses || 0) + enemyLosses;
        }

        // Generate battle event log
        const raidData = {
            nationName: nation.name,
            victory: !battleResult.victory,
            attackerArmy,
            defenderArmy,
            attackerLosses: battleResult.attackerLosses || {},
            defenderLosses: battleResult.defenderLosses || {},
            ourPower: battleResult.defenderPower,
            enemyPower: battleResult.attackerPower,
            actionType
        };
        logs.push(`❗RAID_EVENT❗${JSON.stringify(raidData)}`);
    }
};

/**
 * Check if nation should request peace
 * @private
 */
const checkPeaceRequest = ({ nation, tick, logs }) => {
    const lastPeaceRequestDay = Number.isFinite(nation.lastPeaceRequestDay)
        ? nation.lastPeaceRequestDay
        : -Infinity;
    const canRequestPeace = (tick - lastPeaceRequestDay) >= PEACE_REQUEST_COOLDOWN_DAYS;

    if ((nation.warScore || 0) > 12 && canRequestPeace) {
        const willingness = Math.min(0.5,
            0.03 + (nation.warScore || 0) / 120 +
            (nation.warDuration || 0) / 400 +
            Math.min(0.15, (nation.enemyLosses || 0) / 500)
        );

        if (Math.random() < willingness) {
            const tribute = calculateAIPeaceTribute(
                nation.warScore || 0,
                nation.enemyLosses || 0,
                nation.warDuration || 0,
                Math.max(0, nation.wealth || 0)
            );

            logs.push(`🤝 ${nation.name} requests peace, willing to pay ${tribute} silver.`);
            nation.isPeaceRequesting = true;
            nation.peaceTribute = tribute;
            nation.lastPeaceRequestDay = tick;
        }
    }
};

/**
 * Check if AI should demand player surrender
 * @private
 */
const checkSurrenderDemand = ({ nation, tick, population, playerWealth, logs }) => {
    const aiWarScore = -(nation.warScore || 0);

    if (aiWarScore > 25 && (nation.warDuration || 0) > 30) {
        const lastDemandDay = nation.lastSurrenderDemandDay || 0;
        if (tick - lastDemandDay >= 60 && Math.random() < 0.03) {
            nation.lastSurrenderDemandDay = tick;

            let demandType = 'tribute';
            const warDuration = nation.warDuration || 0;
            // 传入玩家财富，使赔款计算与玩家主动求和时一致
            let demandAmount = calculateAISurrenderDemand(aiWarScore, warDuration, playerWealth);

            if (aiWarScore > 100) {
                demandType = 'territory';
                demandAmount = Math.min(50, Math.max(3, Math.floor(population * 0.05)));
            } else if (aiWarScore > 50 && Math.random() < 0.5) {
                demandType = 'open_market';
                demandAmount = 365 * 2;
            }

            logs.push(`AI_DEMAND_SURRENDER:${JSON.stringify({
                nationId: nation.id,
                nationName: nation.name,
                warScore: nation.warScore,
                demandType,
                demandAmount
            })}`);
        }
    }
};

/**
 * Process relation decay for a nation
 * @private
 */
const processRelationDecay = (nation) => {
    const relation = nation.relation ?? 50;
    let relationChange = 0;

    // 减缓衰减速度：从0.02降低到0.005，让外交行动的效果更持久
    if (relation > 50) {
        relationChange = -0.005;
    } else if (relation < 50) {
        relationChange = 0.005;
    }

    nation.relation = Math.max(0, Math.min(100, relation + relationChange));

    // AI-AI relation decay - 同步减缓衰减速度
    if (nation.foreignRelations) {
        Object.keys(nation.foreignRelations).forEach(otherId => {
            let r = nation.foreignRelations[otherId] ?? 50;
            if (r > 50) r -= 0.005;
            else if (r < 50) r += 0.005;
            nation.foreignRelations[otherId] = Math.max(0, Math.min(100, r));
        });
    }
};

/**
 * Check alliance status and AI alliance breaking
 * @private
 */
const checkAllianceStatus = ({ nation, tick, logs }) => {
    if (nation.alliedWithPlayer && !nation.isAtWar) {
        const relation = nation.relation ?? 50;
        const shouldBreakAlliance = (
            relation < 40 ||
            (nation.allianceStrain || 0) >= 3
        );

        if (shouldBreakAlliance) {
            nation.alliedWithPlayer = false;
            nation.allianceStrain = 0;
            logs.push(`AI_BREAK_ALLIANCE:${JSON.stringify({
                nationId: nation.id,
                nationName: nation.name,
                reason: relation < 40 ? 'relation_low' : 'player_neglect'
            })}`);
        }
    }
};

/**
 * Check war declaration conditions
 * @private
 */
const checkWarDeclaration = ({ nation, nations, tick, epoch, res, stabilityValue, logs }) => {
    // 附庸国不会主动对玩家宣战（独立战争由vassalSystem处理）
    if (nation.vassalOf === 'player') {
        return;
    }

    let relation = nation.relation ?? 50;
    const aggression = nation.aggression ?? 0.2;

    // Count current wars
    const currentWarsWithPlayer = (nations || []).filter(n =>
        n.isAtWar === true && n.id !== nation.id && !n.isRebelNation
    ).length;

    // Check global cooldown
    const recentWarDeclarations = (nations || []).some(n =>
        n.isAtWar && n.warStartDay &&
        (tick - n.warStartDay) < GLOBAL_WAR_COOLDOWN &&
        n.id !== nation.id
    );

    // War count penalty
    const warCountPenalty = currentWarsWithPlayer > 0
        ? Math.pow(0.3, currentWarsWithPlayer)
        : 1.0;

    // Calculate declaration chance
    const hostility = Math.max(0, (50 - relation) / 70);
    const unrest = stabilityValue < 35 ? 0.02 : 0;
    const aggressionBonus = aggression > 0.5 ? aggression * 0.03 : 0;

    let declarationChance = epoch >= 1
        ? Math.min(0.08, (aggression * 0.04) + (hostility * 0.025) + unrest + aggressionBonus)
        : 0;

    declarationChance *= warCountPenalty;

    // Check conditions
    const hasPeaceTreaty = nation.peaceTreatyUntil && tick < nation.peaceTreatyUntil;
    // Fixed: Use formal alliance status instead of relation-based check
    const isPlayerAlly = nation.alliedWithPlayer === true;
    let isBreakingTreaty = false;

    if (hasPeaceTreaty && !isPlayerAlly) {
        const breachPenalty = getTreatyBreachPenalty(epoch);
        const lastBreachDay = Number.isFinite(nation.lastTreatyBreachDay) ? nation.lastTreatyBreachDay : -Infinity;
        const canBreach = (tick - lastBreachDay) >= breachPenalty.cooldownDays;
        const breachPressure = relation < 15 && aggression > 0.55;

        if (canBreach && breachPressure) {
            const breachChance = Math.min(0.05, 0.005 + (0.02 * (aggression - 0.55)) + Math.max(0, (15 - relation) / 500));
            if (Math.random() < breachChance) {
                isBreakingTreaty = true;
                nation.relation = Math.max(0, relation - breachPenalty.relationPenalty);
                nation.peaceTreatyUntil = undefined;
                if (Array.isArray(nation.treaties)) {
                    nation.treaties = nation.treaties.filter(t => !PEACE_TREATY_TYPES.includes(t.type));
                }
                nation.lastTreatyBreachDay = tick;
                relation = nation.relation ?? relation;
                logs.push(`AI_TREATY_BREACH:${JSON.stringify({
                    nationId: nation.id,
                    nationName: nation.name,
                    relationPenalty: breachPenalty.relationPenalty,
                })}`);
                logs.push(`⚠️ ${nation.name} 撕毁了与你的和平条约。`);
            }
        }
    }

    const canDeclareWar = !nation.isAtWar &&
        (!hasPeaceTreaty || isBreakingTreaty) &&
        !isPlayerAlly &&
        relation < 25 &&
        currentWarsWithPlayer < MAX_CONCURRENT_WARS &&
        !recentWarDeclarations;

    if (canDeclareWar && Math.random() < declarationChance) {
        nation.isAtWar = true;
        nation.warStartDay = tick;
        nation.warDuration = 0;
        nation.warDeclarationPending = true;
        logs.push(`⚠️ ${nation.name} declared war!`);
        logs.push(`WAR_DECLARATION_EVENT:${JSON.stringify({ nationId: nation.id, nationName: nation.name })}`);
    }

    // Wealth-based war
    const playerWealth = (res.food || 0) + (res.silver || 0) + (res.wood || 0);
    const aiWealth = nation.wealth || 500;
    const aiMilitaryStrength = nation.militaryStrength ?? 1.0;

    if (!nation.isAtWar && (!hasPeaceTreaty || isBreakingTreaty) && !isPlayerAlly &&
        playerWealth > aiWealth * 2 &&
        aiMilitaryStrength > 0.8 &&
        relation < 50 &&
        aggression > 0.4 &&
        currentWarsWithPlayer < MAX_CONCURRENT_WARS &&
        !recentWarDeclarations) {

        const wealthWarChance = 0.001 * aggression * (playerWealth / aiWealth - 1);
        if (Math.random() < wealthWarChance) {
            nation.isAtWar = true;
            nation.warStartDay = tick;
            nation.warDuration = 0;
            nation.warDeclarationPending = true;
            logs.push(`⚠️ ${nation.name} covets your wealth, declared war!`);
            logs.push(`WAR_DECLARATION_EVENT:${JSON.stringify({ nationId: nation.id, nationName: nation.name, reason: 'wealth' })}`);
        }
    }
};

/**
 * Check treaty stability based on relations
 * @private
 */
const checkTreatyStability = ({ nation, tick, logs }) => {
    if (!nation.treaties || nation.treaties.length === 0) return;

    const currentRelation = nation.relation || 50;
    // Filter active treaties that are with the player
    const activeTreaties = nation.treaties.filter(t =>
        (t.status === 'active' || (!t.status && (t.endDay == null || t.endDay > tick))) &&
        t.withPlayer !== false
    );

    let treatiesChanged = false;

    activeTreaties.forEach(treaty => {
        const config = TREATY_CONFIGS[treaty.type];
        if (!config) return;

        const minRelation = config.minRelation || 0;

        // If relation is below threshold
        if (currentRelation < minRelation) {
            // Initialize or increment instability counter
            treaty.instability = (treaty.instability || 0) + 1;

            // Warning threshold (e.g., 10 days of low relation)
            if (treaty.instability === 10) {
                const treatyName = TREATY_TYPE_LABELS[treaty.type] || treaty.type;
                logs.push(`⚠️ 与 ${nation.name} 的关系恶化，${treatyName}岌岌可危！`);
            }

            // Termination threshold (e.g., 30 days)
            if (treaty.instability >= 30) {
                const treatyName = TREATY_TYPE_LABELS[treaty.type] || treaty.type;

                // Terminate treaty
                treaty.status = 'terminated';
                treaty.endDay = tick; // End immediately
                treaty.instability = 0;
                treatiesChanged = true;

                logs.push(`❌ 由于关系长期恶化，与 ${nation.name} 的 ${treatyName} 已自动终止。`);

                // Add specific logic for investment pact termination if needed (e.g., notification event)
            }
        } else {
            // Recover stability if relation is good
            if (treaty.instability > 0) {
                treaty.instability = Math.max(0, treaty.instability - 1);
                if (treaty.instability === 0) {
                    // Recovered
                }
            }
        }
    });

    // If any treaty was terminated, we might need to trigger cleanup or side effects elsewhere,
    // but usually checking status='active' is enough for other systems.
};

/**
 * Update nation's economy
 * @private
 */
const updateNationEconomy = ({ nation, tick, epoch, playerPopulationBaseline, playerWealthBaseline }) => {
    const powerProfile = nation.foreignPower || {};
    const volatility = clamp(powerProfile.volatility ?? nation.marketVolatility ?? 0.3, 0.1, 0.9);
    const populationFactor = clamp(powerProfile.populationFactor ?? powerProfile.baseRating ?? 1, 0.6, 2.5);
    const wealthFactor = clamp(powerProfile.wealthFactor ?? (powerProfile.baseRating ? powerProfile.baseRating * 1.1 : 1.1), 0.5, 2.0);
    const eraMomentum = 1 + Math.max(0, epoch - (powerProfile.appearEpoch ?? 0)) * 0.03;

    // Initialize AI development baseline
    if (!nation.economyTraits?.ownBasePopulation) {
        const templateWealth = nation.wealthTemplate || 800;
        const templateFactor = templateWealth / 800;
        nation.economyTraits = {
            ...(nation.economyTraits || {}),
            ownBasePopulation: Math.max(5, Math.round(16 * templateFactor * (0.8 + Math.random() * 0.4))),
            ownBaseWealth: Math.max(500, Math.round(1000 * templateFactor * (0.8 + Math.random() * 0.4))),
            developmentRate: 0.8 + (nation.aggression || 0.3) * 0.3 + Math.random() * 0.4,
            lastGrowthTick: tick,
        };
    }

    // [FIX] REMOVED INDEPENDENT GROWTH - Population growth is now handled ONLY by 
    // processAIIndependentGrowth in aiEconomy.js using logistic growth model
    // This duplicate growth logic was causing MULTIPLE GROWTH BUG!
    const ticksSinceLastGrowth = tick - (nation.economyTraits.lastGrowthTick || 0);
    if (ticksSinceLastGrowth >= 10) {
        // [FIX] Only update wealth base, NOT population
        // Population is handled by logistic growth model
        if (!nation.isAtWar) {
            const developmentRate = nation.economyTraits.developmentRate || 1.0;
            const tickScale = Math.min(ticksSinceLastGrowth / 30, 1.5);  // [FIX] Very conservative scaling
            
            // [FIX] Apply per-capita wealth cap to prevent infinite wealth growth
            const perCapitaWealthCap = Math.min(100000, 5000 * Math.pow(2, Math.min(epoch, 4)));
            const currentPopulation = nation.population || 1;
            const currentPerCapitaWealth = (nation.economyTraits.ownBaseWealth || 1000) / currentPopulation;
            
            // Only grow wealth base if below per-capita cap
            if (currentPerCapitaWealth < perCapitaWealthCap) {
                // [FIX] Only grow wealth base slowly (1-2% per update)
                const wealthGrowthRate = 1 + (0.01 + (developmentRate - 1) * 0.005) * tickScale;
                const newBaseWealth = Math.round(nation.economyTraits.ownBaseWealth * wealthGrowthRate);
                // Ensure new per-capita wealth doesn't exceed cap
                const maxBaseWealth = currentPopulation * perCapitaWealthCap;
                nation.economyTraits.ownBaseWealth = Math.min(newBaseWealth, maxBaseWealth);
            }
            // [FIX] DO NOT modify ownBasePopulation here - it's handled by logistic model
        }
        nation.economyTraits.lastGrowthTick = tick;
    }

    // Calculate target values
    // [FIX v4] Reduced era growth factor from 0.15 to 0.08 to slow late-game growth
    const eraGrowthFactor = 1 + Math.max(0, epoch) * 0.08;
    const aiOwnTargetPopulation = nation.economyTraits.ownBasePopulation * eraGrowthFactor * populationFactor;
    const aiOwnTargetWealth = nation.economyTraits.ownBaseWealth * eraGrowthFactor * wealthFactor;

    // Blend with player reference
    const playerInfluenceFactor = 0.3;
    const playerTargetPopulation = playerPopulationBaseline * populationFactor * eraMomentum;
    const playerTargetWealth = playerWealthBaseline * wealthFactor * eraMomentum;

    const blendedTargetPopulation = aiOwnTargetPopulation * (1 - playerInfluenceFactor) +
        playerTargetPopulation * playerInfluenceFactor;
    const blendedTargetWealth = aiOwnTargetWealth * (1 - playerInfluenceFactor) +
        playerTargetWealth * playerInfluenceFactor;

    // Template boosts
    // [FIX v4] Reduced template boost multipliers to prevent late-game explosion
    const templatePopulationBoost = Math.max(1, (nation.wealthTemplate || 800) / Math.max(800, playerWealthBaseline) * 0.5);
    const templateWealthBoost = Math.max(1, (nation.wealthTemplate || 800) / Math.max(800, playerWealthBaseline) * 0.6);

    const desiredPopulation = Math.max(3, blendedTargetPopulation * templatePopulationBoost);
    const desiredWealth = Math.max(100, blendedTargetWealth * templateWealthBoost);

    nation.economyTraits.basePopulation = desiredPopulation;
    nation.economyTraits.baseWealth = desiredWealth;

    // [FIX] REMOVED POPULATION DRIFT - Population is now handled ONLY by processAIIndependentGrowth in aiEconomy.js
    // This function should only update economy traits and wealth targets, NOT directly modify population
    // Having multiple functions modify population caused TRIPLE GROWTH BUG!
    
    // [FIX] Track tick intervals (for reference only, no longer used for growth)
    const lastDevTick = nation.economyTraits?.lastDevelopmentTick || 0;
    const ticksSinceDev = Math.max(1, tick - lastDevTick);
    const tickScaleFactor = Math.min(ticksSinceDev / 10, 2);
    nation.economyTraits.lastDevelopmentTick = tick;
    
    const driftMultiplier = clamp(1 + volatility * 0.6 + eraMomentum * 0.08, 1, 2.2);

    // [FIX] Only apply war casualty to population, don't drift towards target
    const currentPopulation = nation.population ?? desiredPopulation;
    if (nation.isAtWar) {
        const warCasualty = currentPopulation * 0.006 * tickScaleFactor;
        nation.population = Math.max(3, Math.round(currentPopulation - warCasualty));
    }

    // [FIX] Wealth still uses drift but with much more conservative rate
    const currentWealth = nation.wealth ?? desiredWealth;
    const previousWealth = Number.isFinite(nation._lastWealth) ? nation._lastWealth : currentWealth;
    
    // [FIX v4] Apply per-capita wealth cap check before drift (reduced caps)
    // Per-capita cap: Stone=2k, Ancient=4k, Medieval=8k, Industrial=16k, Modern=32k
    const perCapitaWealthCapForDrift = Math.min(50000, 2000 * Math.pow(2, Math.min(epoch, 4)));
    const currentPerCapitaWealthForDrift = currentWealth / Math.max(1, currentPopulation);
    const maxWealthForDrift = currentPopulation * perCapitaWealthCapForDrift;
    
    // [FIX] Very conservative wealth drift: 2% max
    const baseWealthDriftRate = (nation.isAtWar ? 0.01 : 0.02) * driftMultiplier;
    const wealthDriftRate = Math.min(0.03, baseWealthDriftRate * tickScaleFactor);
    
    let adjustedWealth = currentWealth;
    
    // Only allow drift towards desiredWealth if below per-capita cap
    if (currentPerCapitaWealthForDrift < perCapitaWealthCapForDrift) {
        // Cap desiredWealth to respect per-capita limit
        const cappedDesiredWealth = Math.min(desiredWealth, maxWealthForDrift);
        const wealthNoise = (Math.random() - 0.5) * currentWealth * 0.02;
        adjustedWealth = currentWealth + (cappedDesiredWealth - currentWealth) * wealthDriftRate + wealthNoise;
    } else {
        // At or above cap - apply slight decay
        const decayRate = 0.002 * tickScaleFactor;
        adjustedWealth = currentWealth - currentWealth * decayRate;
    }
    
    if (nation.isAtWar) {
        adjustedWealth -= currentWealth * 0.008 * tickScaleFactor;
    }
    
    // Hard cap on wealth
    adjustedWealth = Math.min(adjustedWealth, maxWealthForDrift);
    nation.wealth = Math.max(100, Math.round(adjustedWealth));

    // ========== 计算GDP（稳健版：平滑的正向财富增量） ==========
    // 设计：GDP 作为“流量”指标，不等同于财富存量
    // gdp = gdp * 0.9 + max(0, wealthDelta) * 0.1
    const rawWealthDelta = nation.wealth - previousWealth;
    const positiveDelta = Math.max(0, rawWealthDelta);
    const gdpSmoothing = 0.9;
    const gdpBaseline = Number.isFinite(nation.gdp)
        ? nation.gdp
        : Math.max(1, previousWealth * 0.05);
    nation.gdp = Math.max(1, gdpBaseline * gdpSmoothing + positiveDelta * (1 - gdpSmoothing));
    nation._lastWealth = nation.wealth;

    // Update budget
    const dynamicBudgetTarget = nation.wealth * 0.45;
    const workingBudget = Number.isFinite(nation.budget) ? nation.budget : dynamicBudgetTarget;
    nation.budget = Math.max(0, workingBudget + (dynamicBudgetTarget - workingBudget) * 0.35);
};

/**
 * Process AI-AI relations and wars
 * @private
 */
const processAIRelations = (nations, tick, logs) => {
    if (!Array.isArray(nations)) return [];
    return nations.map(nation => {
        // Initialize foreign relations
        if (!nation.foreignRelations) {
            nation.foreignRelations = {};
        }

        nations.forEach(otherNation => {
            if (otherNation.id === nation.id) return;

            if (nation.foreignRelations[otherNation.id] === undefined) {
                const avgAggression = ((nation.aggression || 0.3) + (otherNation.aggression || 0.3)) / 2;
                nation.foreignRelations[otherNation.id] = Math.floor(
                    50 - avgAggression * 30 + (Math.random() - 0.5) * 20
                );
            }

            // Natural fluctuation
            if (Math.random() < 0.05) {
                const change = (Math.random() - 0.5) * 6;
                nation.foreignRelations[otherNation.id] = clamp(
                    (nation.foreignRelations[otherNation.id] || 50) + change,
                    0,
                    100
                );
            }
        });

        return nation;
    });
};

/**
 * Process monthly relation decay for all nations
 * @private
 */
const processMonthlyRelationDecay = (nations, difficultyLevel = 'normal', diplomacyOrganizations = null) => {
    if (!Array.isArray(nations)) return [];
    // [FIX Bug10] 从组织系统获取玩家盟友列表
    const orgs = diplomacyOrganizations?.organizations || [];
    const playerOrgAllyIds = new Set();
    orgs.forEach(org => {
        if (org?.type !== 'military_alliance') return;
        if (!Array.isArray(org.members) || !org.members.includes('player')) return;
        org.members.forEach(id => { if (id && id !== 'player') playerOrgAllyIds.add(id); });
    });

    return nations.map(nation => {
        if (nation.isRebelNation) return nation;

        const currentRelation = nation.relation ?? 50;
        // [FIX Bug10] 组织盟友也享受盟友关系衰减保护
        const isAlly = nation.alliedWithPlayer === true || playerOrgAllyIds.has(nation.id);
        const decayRate = getRelationMonthlyDriftRate(difficultyLevel, isAlly);

        let newRelation = currentRelation;
        if (currentRelation > 50) {
            newRelation = Math.max(50, currentRelation - decayRate);
        } else if (currentRelation < 50) {
            newRelation = Math.min(50, currentRelation + decayRate);
        }

        return { ...nation, relation: newRelation };
    });
};

// ========== 阶层经济分析工具函数（供UI使用）==========

/**
 * 获取附庸国阶层经济的详细分析
 * 用于UI显示各因素对阶层财富和人口的影响
 * @param {Object} nation - 附庸国对象
 * @returns {Object} 详细的阶层经济分析
 */
export const getVassalEconomyAnalysis = (nation) => {
    if (!nation || !nation.socialStructure) {
        return null;
    }

    const vassalPolicy = nation.vassalPolicy || {};
    const tributeRate = nation.tributeRate || 0;

    // 获取各项政策效果
    const policyWealthEffects = getPolicyWealthEffects(vassalPolicy);
    const policyPopulationEffects = getPolicyPopulationEffects(vassalPolicy);
    const tributeExtraction = getTributeExtractionRates(tributeRate);

    // 投资效果
    const investmentEffects = nation._investmentEffects || {
        totalWages: 0,
        profitsExtracted: 0,
        localReinvestment: 0,
        taxRetained: 0,
    };

    // 计算净财富流动
    const netWealthFlow = investmentEffects.totalWages +
        investmentEffects.localReinvestment +
        investmentEffects.taxRetained -
        investmentEffects.profitsExtracted;

    // 各阶层分析
    const stratumAnalysis = {};
    ['elites', 'commoners', 'underclass'].forEach(stratum => {
        const data = nation.socialStructure[stratum] || {};
        const factors = data._factors || {};

        stratumAnalysis[stratum] = {
            // 当前状态
            population: data.population || 0,
            wealth: data.wealth || 0,
            wealthShare: data.wealthShare || BASE_WEALTH_DISTRIBUTION[stratum],
            populationRatio: data.ratio || BASE_POPULATION_RATIO[stratum],
            sol: data.sol || 1.0,
            satisfaction: data.satisfaction || 50,

            // 影响因素
            factors: {
                // 政策对财富份额的影响
                policyWealthEffect: policyWealthEffects[stratum],
                // 政策对人口比例的影响
                policyPopulationEffect: policyPopulationEffects[stratum],
                // 朝贡抽取比例
                tributeExtraction: tributeExtraction[stratum],
                // 投资带来的财富流入
                investmentWealthFlow: factors.investmentWealthFlow || 0,
                // 投资带来的就业机会
                investmentJobCreation: factors.investmentJobCreation || 0,
            },

            // 趋势
            trends: {
                wealthTrend: (policyWealthEffects[stratum] || 0) - (tributeExtraction[stratum] * 0.3),
                populationTrend: policyPopulationEffects[stratum] || 0,
            },
        };
    });

    return {
        // 总体状态
        totalWealth: nation.wealth || 0,
        totalPopulation: nation.population || 0,
        tributeRate,

        // 政策配置
        policies: {
            labor: vassalPolicy.labor || 'standard',
            trade: vassalPolicy.tradePolicy || 'preferential',
            governance: vassalPolicy.governance || 'puppet_govt',
            investment: vassalPolicy.investmentPolicy || 'autonomous',
        },

        // 投资影响
        investment: {
            wagesFlowingIn: investmentEffects.totalWages,
            profitsFlowingOut: investmentEffects.profitsExtracted,
            localReinvestment: investmentEffects.localReinvestment,
            taxRetained: investmentEffects.taxRetained,
            netFlow: netWealthFlow,
        },

        // 各阶层详细分析
        strata: stratumAnalysis,

        // 财富流失（投资抽走的利润）
        wealthDrain: nation._investmentWealthDrain || 0,
    };
};
