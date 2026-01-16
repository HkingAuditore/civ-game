import { MINISTRIES } from '../../config/ministries';
import { BUILDINGS, RESOURCES } from '../../config';

/**
 * 计算六部尚书的综合加成效果
 * @param {Object} ministries - 当前任命状态 { [ministryId]: officialId }
 * @param {Array} officials - 所有官员列表
 * @returns {Object} 综合加成对象
 */
export const calculateMinistryEffects = (ministries, officials) => {
    const effects = {
        agricultureProduction: 0, // 农业产出加成
        industryProduction: 0,    // 工业产出加成
        tradeRevenue: 0,          // 贸易收入加成
        taxEfficiency: 0,         // 税收效率加成
        stability: 0,             // 稳定度加成
        maxPop: 0,                // 人口上限加成
        combatPower: 0,           // 战斗力加成
        relationGain: 0,          // 外交关系提升加成
        negotiationChance: 0,     // 谈判成功率加成
    };

    if (!ministries || !officials) return effects;

    Object.entries(ministries).forEach(([ministryId, officialId]) => {
        if (!officialId) return;

        const official = officials.find(o => o.id === officialId);
        const config = MINISTRIES[ministryId];

        if (!official || !config) return;

        // 计算属性总和 (取允许属性中的最高值，或者平均值？通常是相关属性之和)
        // 这里假设是相关属性之和
        let attributeScore = 0;
        config.allowedAttributes.forEach(attr => {
            attributeScore += (official[attr] || 0);
        });

        // 应用加成
        if (ministryId === 'agriculture') {
            effects.agricultureProduction += attributeScore * config.bonuses.production;
        } else if (ministryId === 'industry') {
            effects.industryProduction += attributeScore * config.bonuses.production;
        } else if (ministryId === 'commerce') {
            effects.tradeRevenue += attributeScore * config.bonuses.tradeRevenue;
            effects.taxEfficiency += attributeScore * config.bonuses.taxEfficiency;
        } else if (ministryId === 'municipal') {
            effects.stability += attributeScore * config.bonuses.stability;
            effects.maxPop += attributeScore * config.bonuses.maxPop;
        } else if (ministryId === 'military') {
            effects.combatPower += attributeScore * config.bonuses.combatPower;
        } else if (ministryId === 'diplomacy') {
            effects.relationGain += attributeScore * config.bonuses.relationGain;
            effects.negotiationChance += attributeScore * config.bonuses.negotiationChance;
        }
    });

    return effects;
};

/**
 * 处理尚书省自动建设逻辑
 * @param {Object} params - 模拟参数
 * @returns {Array} 建设日志
 */
export const processMinistryAutoBuild = ({
    ministries,
    officials,
    resources,
    buildings,
    market,
    tick,
    gameSpeed = 1
}) => {
    const logs = [];
    // 每5天检查一次，避免过于频繁
    if (tick % 5 !== 0) return logs;

    Object.entries(ministries).forEach(([ministryId, officialId]) => {
        if (!officialId) return;

        const config = MINISTRIES[ministryId];
        if (!config || !config.autoBuild) return;

        const official = officials.find(o => o.id === officialId);
        if (!official) return;

        // 1. 确定预算
        const currentSilver = resources.silver || 0;
        const maxBudget = currentSilver * config.autoBuild.budgetRatio;
        if (maxBudget < 100) return; // 资金太少不行动

        // 2. 筛选候选建筑
        let candidateBuildings = [];

        if (config.autoBuild.targetBuildings) {
            // 指定建筑列表
            candidateBuildings = BUILDINGS.filter(b =>
                config.autoBuild.targetBuildings.includes(b.id)
            );
        } else if (config.autoBuild.category) {
            // 指定类别
            candidateBuildings = BUILDINGS.filter(b =>
                b.cat === config.autoBuild.category
            );
        }

        if (candidateBuildings.length === 0) return;

        // 3. 评估需求 (简单逻辑：看哪个资源缺口大，或者随机)
        // 对于生产类 (农/工)，检查产出资源的供需
        let bestBuilding = null;
        let highestPriority = -1;

        candidateBuildings.forEach(building => {
            let priority = 0;
            const count = buildings[building.id] || 0;

            if (ministryId === 'agriculture' || ministryId === 'industry') {
                // 检查产出资源的供需
                if (building.output) {
                    Object.keys(building.output).forEach(resKey => {
                        if (config.autoBuild.resourceFocus.includes(resKey)) {
                            const demand = market?.demand?.[resKey] || 0;
                            const supply = market?.supply?.[resKey] || 1;
                            const ratio = supply > 0 ? demand / supply : 2;
                            // 缺口越大，优先级越高
                            if (ratio > 1) priority += (ratio - 1) * 10;

                            // 库存过低也加分
                            const stock = resources[resKey] || 0;
                            if (stock < 100) priority += 5;
                        }
                    });
                }
            } else if (ministryId === 'municipal') {
                // 市政：人口压力大时扩建
                if (building.output?.maxPop) {
                    // 这里无法轻易获取当前人口/上限比例，简化为：如果很便宜就建
                    priority = 5;
                }
                // 提升稳定度的建筑
                if (building.output?.stability) {
                    priority = 5;
                }
            } else if (ministryId === 'commerce' || ministryId === 'military') {
                // 商业/军事：保持一定规模，或随机扩建
                priority = 1;
                // 防止无限扩建：如果已有较多，降低优先级
                if (count > 5) priority *= 0.5;
                if (count > 10) priority *= 0.1;
            }

            if (priority > highestPriority) {
                highestPriority = priority;
                bestBuilding = building;
            }
        });

        // 4. 执行建设
        if (bestBuilding && highestPriority > 0) {
            // 计算成本 (简化：只计算基础成本，不考虑随数量增加)
            // 实际上应该用 calculateBuildingCost，但这里为了解耦暂时简化
            // 或者直接扣除银币作为简化模拟

            // 简单估算成本：每级基础成本 * (1.1 ^ count)
            // 这里我们假设尚书利用国库资金和自身能力，成本可能有所波动
            // 为简化，我们直接检查银币是否足够支付大概的费用

            // 获取建筑的基础银币成本（如果有）
            const baseSilverCost = bestBuilding.baseCost?.silver || 0;
            // 估算总价值（资源折算）
            let estimatedTotalCost = baseSilverCost;
            if (bestBuilding.baseCost) {
                Object.entries(bestBuilding.baseCost).forEach(([res, amount]) => {
                    if (res !== 'silver') {
                        const price = market?.prices?.[res] || 1;
                        estimatedTotalCost += amount * price;
                    }
                });
            }

            // 随着数量增加成本
            const count = buildings[bestBuilding.id] || 0;
            const finalCost = estimatedTotalCost * Math.pow(1.15, count);

            if (finalCost <= maxBudget) {
                // 扣除国库
                resources.silver -= finalCost;

                // 增加建筑
                buildings[bestBuilding.id] = (buildings[bestBuilding.id] || 0) + 1;

                logs.push(`🏗️ [${config.name}] 察觉到需求，拨款 ${Math.floor(finalCost)} 扩建了 ${bestBuilding.name}。`);
            }
        }
    });

    return logs;
};
