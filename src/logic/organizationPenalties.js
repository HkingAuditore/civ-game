// 组织度经济惩罚系统 (Organization Penalties)
// 当阶层组织度超过阈值时，对经济生产造成惩罚
// 基于《叛乱与阶层机制改进方案V3》第5节

import { STAGE_THRESHOLDS } from './organizationSystem';

// =========== 惩罚配置 ===========

/**
 * 各阶层在不同组织度阈值下的惩罚效果
 * 30% = 不满阶段 (怠工/抗议)
 * 60% = 动荡阶段 (罢工/破坏)
 */
export const ORGANIZATION_PENALTIES = {
    peasant: {
        30: {
            description: '减产',
            effects: {
                buildingOutput: { farm: -0.15, plantation: -0.15 },
            },
        },
        60: {
            description: '抗粮与囤积',
            effects: {
                buildingOutput: { farm: -0.30, plantation: -0.30 },
                taxMultiplier: { food: 0 }, // 粮食税收归零
                marketSupply: { food: -0.30 }, // 市场供应减少
            },
        },
    },

    worker: {
        30: {
            description: '怠工',
            effects: {
                categoryOutput: { industry: -0.15 },
            },
        },
        60: {
            description: '大罢工与破坏',
            effects: {
                categoryOutput: { industry: -0.50 },
                resourceLoss: { tools: 0.01, stock: 0.01 }, // 每日损耗1%
            },
        },
    },

    miner: {
        30: {
            description: '怠工',
            effects: {
                buildingOutput: { mine: -0.15, iron_mine: -0.15, coal_mine: -0.15 },
            },
        },
        60: {
            description: '矿井破坏',
            effects: {
                buildingOutput: { mine: -0.50, iron_mine: -0.50, coal_mine: -0.50 },
                resourceLoss: { tools: 0.02 },
            },
        },
    },

    lumberjack: {
        30: {
            description: '怠工',
            effects: {
                buildingOutput: { lumber_camp: -0.15 },
            },
        },
        60: {
            description: '林业停滞',
            effects: {
                buildingOutput: { lumber_camp: -0.40 },
            },
        },
    },

    merchant: {
        30: {
            description: '避税',
            effects: {
                taxMultiplier: { business: -0.15 },
            },
        },
        60: {
            description: '关门与资本外逃',
            effects: {
                buildingOutput: { market: -0.50, port: -0.50 },
                treasuryLoss: 0.005, // 每日流失0.5%国库银币
            },
        },
    },

    artisan: {
        30: {
            description: '产量下降',
            effects: {
                buildingOutput: { workshop: -0.15, forge: -0.15 },
            },
        },
        60: {
            description: '停工',
            effects: {
                buildingOutput: { workshop: -0.40, forge: -0.40 },
            },
        },
    },

    landowner: {
        30: {
            description: '私产',
            effects: {
                buildingOutput: { farm: -0.20, plantation: -0.20 },
            },
        },
        60: {
            description: '地方割据',
            effects: {
                taxMultiplier: { agriculture: 0 }, // 农业税收归零
                buildingCost: 0.20, // 建筑建造成本+20%
            },
        },
    },

    capitalist: {
        30: {
            description: '投资收缩',
            effects: {
                taxMultiplier: { business: -0.20 },
            },
        },
        60: {
            description: '股灾与撤资',
            effects: {
                taxMultiplier: { business: 0, industry: 0 },
                treasuryLoss: 0.01, // 每日流失1%国库银币
            },
        },
    },

    soldier: {
        30: {
            description: '纪律涣散',
            effects: {
                militaryPower: -0.10,
            },
        },
        60: {
            description: '兵变风险',
            effects: {
                militaryPower: -0.50,
                militaryDisabled: true, // 无法执行军事行动
            },
        },
    },

    knight: {
        30: {
            description: '懈怠',
            effects: {
                militaryPower: -0.10,
            },
        },
        60: {
            description: '骑士叛离',
            effects: {
                militaryPower: -0.40,
            },
        },
    },

    cleric: {
        30: {
            description: '传播受阻',
            effects: {
                categoryOutput: { civic: -0.15 },
                passiveOutput: { culture: -0.15 },
            },
        },
        60: {
            description: '煽动与异端',
            effects: {
                stabilityDrain: 0.5, // 每日降低稳定度0.5
                decreeRisk: true, // 有风险废除政令
            },
        },
    },

    scribe: {
        30: {
            description: '效率下降',
            effects: {
                passiveOutput: { science: -0.15 },
            },
        },
        60: {
            description: '知识封锁',
            effects: {
                passiveOutput: { science: -0.40, culture: -0.20 },
            },
        },
    },

    engineer: {
        30: {
            description: '创新停滞',
            effects: {
                passiveOutput: { science: -0.15 },
                buildingOutput: { factory: -0.10 },
            },
        },
        60: {
            description: '技术抵制',
            effects: {
                passiveOutput: { science: -0.30 },
                buildingOutput: { factory: -0.30 },
            },
        },
    },

    navigator: {
        30: {
            description: '航运减缓',
            effects: {
                buildingOutput: { port: -0.15, shipyard: -0.15 },
            },
        },
        60: {
            description: '海运中断',
            effects: {
                buildingOutput: { port: -0.40, shipyard: -0.40 },
                tradeDisruption: 0.30, // 贸易路线效率-30%
            },
        },
    },

    official: {
        30: {
            description: '效率低下',
            effects: {
                taxMultiplier: { all: -0.10 },
            },
        },
        60: {
            description: '行政瘫痪',
            effects: {
                taxMultiplier: { all: -0.30 },
                stabilityDrain: 0.3,
            },
        },
    },

    serf: {
        30: {
            description: '消极怠工',
            effects: {
                buildingOutput: { farm: -0.10 },
            },
        },
        60: {
            description: '逃亡',
            effects: {
                buildingOutput: { farm: -0.25 },
                populationDrain: 0.01, // 每日人口流失1%
            },
        },
    },
};

// =========== 核心函数 ===========

/**
 * 计算某阶层当前的经济惩罚
 * @param {string} stratumKey - 阶层键
 * @param {number} organization - 组织度 (0-100)
 * @returns {Object|null} 惩罚效果对象
 */
export function getStratumPenalty(stratumKey, organization) {
    const penalties = ORGANIZATION_PENALTIES[stratumKey];
    if (!penalties) return null;

    // 检查60%阈值
    if (organization >= 60 && penalties[60]) {
        return {
            threshold: 60,
            ...penalties[60],
        };
    }

    // 检查30%阈值
    if (organization >= 30 && penalties[30]) {
        return {
            threshold: 30,
            ...penalties[30],
        };
    }

    return null;
}

/**
 * 汇总所有阶层的经济惩罚
 * @param {Object} organizationStates - 组织度状态 { [stratumKey]: { organization: number } }
 * @returns {Object} 汇总的惩罚效果
 */
export function calculateAllPenalties(organizationStates) {
    const result = {
        buildingOutput: {},      // { buildingId: multiplier }
        categoryOutput: {},      // { category: multiplier }
        taxMultiplier: {},       // { taxType: multiplier }
        marketSupply: {},        // { resource: multiplier }
        passiveOutput: {},       // { resource: multiplier }
        resourceLoss: {},        // { resource: dailyLossRate }
        treasuryLoss: 0,         // 每日国库流失率
        militaryPower: 0,        // 军事力量修正
        militaryDisabled: false, // 军事行动禁用
        stabilityDrain: 0,       // 每日稳定度流失
        buildingCost: 0,         // 建筑成本增加
        tradeDisruption: 0,      // 贸易干扰
        populationDrain: 0,      // 人口流失率
        decreeRisk: false,       // 政令风险
        activeEffects: [],       // 激活的惩罚描述列表
    };

    if (!organizationStates) return result;

    Object.entries(organizationStates).forEach(([stratumKey, state]) => {
        const organization = state?.organization ?? 0;
        const penalty = getStratumPenalty(stratumKey, organization);

        if (!penalty) return;

        const effects = penalty.effects || {};

        // 记录激活的惩罚
        result.activeEffects.push({
            stratum: stratumKey,
            threshold: penalty.threshold,
            description: penalty.description,
        });

        // 建筑产出惩罚
        if (effects.buildingOutput) {
            Object.entries(effects.buildingOutput).forEach(([buildingId, modifier]) => {
                result.buildingOutput[buildingId] = (result.buildingOutput[buildingId] || 0) + modifier;
            });
        }

        // 类别产出惩罚
        if (effects.categoryOutput) {
            Object.entries(effects.categoryOutput).forEach(([category, modifier]) => {
                result.categoryOutput[category] = (result.categoryOutput[category] || 0) + modifier;
            });
        }

        // 税收惩罚
        if (effects.taxMultiplier) {
            Object.entries(effects.taxMultiplier).forEach(([taxType, modifier]) => {
                if (modifier === 0) {
                    result.taxMultiplier[taxType] = 0; // 完全归零
                } else {
                    result.taxMultiplier[taxType] = (result.taxMultiplier[taxType] || 0) + modifier;
                }
            });
        }

        // 市场供应惩罚
        if (effects.marketSupply) {
            Object.entries(effects.marketSupply).forEach(([resource, modifier]) => {
                result.marketSupply[resource] = (result.marketSupply[resource] || 0) + modifier;
            });
        }

        // 被动产出惩罚
        if (effects.passiveOutput) {
            Object.entries(effects.passiveOutput).forEach(([resource, modifier]) => {
                result.passiveOutput[resource] = (result.passiveOutput[resource] || 0) + modifier;
            });
        }

        // 资源损耗
        if (effects.resourceLoss) {
            Object.entries(effects.resourceLoss).forEach(([resource, rate]) => {
                result.resourceLoss[resource] = (result.resourceLoss[resource] || 0) + rate;
            });
        }

        // 国库流失
        if (effects.treasuryLoss) {
            result.treasuryLoss += effects.treasuryLoss;
        }

        // 军事力量
        if (effects.militaryPower) {
            result.militaryPower += effects.militaryPower;
        }

        // 军事禁用
        if (effects.militaryDisabled) {
            result.militaryDisabled = true;
        }

        // 稳定度流失
        if (effects.stabilityDrain) {
            result.stabilityDrain += effects.stabilityDrain;
        }

        // 建筑成本
        if (effects.buildingCost) {
            result.buildingCost += effects.buildingCost;
        }

        // 贸易干扰
        if (effects.tradeDisruption) {
            result.tradeDisruption += effects.tradeDisruption;
        }

        // 人口流失
        if (effects.populationDrain) {
            result.populationDrain += effects.populationDrain;
        }

        // 政令风险
        if (effects.decreeRisk) {
            result.decreeRisk = true;
        }
    });

    return result;
}

/**
 * 获取惩罚的UI描述
 * @param {Object} penalties - 惩罚对象
 * @returns {Array} 惩罚描述列表
 */
export function getPenaltyDescriptions(penalties) {
    if (!penalties || !penalties.activeEffects) return [];

    return penalties.activeEffects.map(effect => ({
        stratum: effect.stratum,
        level: effect.threshold >= 60 ? 'severe' : 'moderate',
        text: effect.description,
    }));
}

export default {
    ORGANIZATION_PENALTIES,
    getStratumPenalty,
    calculateAllPenalties,
    getPenaltyDescriptions,
};
