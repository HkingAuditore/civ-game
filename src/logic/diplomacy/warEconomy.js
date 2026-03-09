/**
 * War Economy Module
 * 战争-经济联动核心模块。所有函数均为纯函数，接收状态参数返回修正值。
 * 
 * 核心理念：战争的影响体现在经济数据上（产能下降、资源变动、税收波动），
 * 而非独立的战斗数值系统。
 */

import { BUILDINGS } from '../../config/buildings';
import {
    WAR_ECONOMY,
} from '../../config/gameConstants';

// ========== 建筑损毁汇总 ==========

/**
 * 汇总所有活跃战线的建筑损毁数据，生成本 tick 的有效建筑扣减映射
 * @param {Array} activeFronts - 活跃战线数组
 * @param {string} nationId - 要计算的国家ID（'player' 或 AI国家ID）
 * @returns {Object} { buildingId: destroyedCount } 所有战线累计的建筑损毁
 */
export const aggregateWarDamagedBuildings = (activeFronts = [], nationId = 'player') => {
    const damaged = {};
    for (const front of activeFronts) {
        if (front?.status !== 'active') continue;
        const frontDamage = front.destroyedBuildings?.[nationId];
        if (!frontDamage) continue;
        for (const [buildingId, count] of Object.entries(frontDamage)) {
            if (count > 0) {
                damaged[buildingId] = (damaged[buildingId] || 0) + count;
            }
        }
    }
    return damaged;
};

// ========== 建筑破坏判定 ==========

/**
 * 在战线 checkpoint crossing 时判定建筑破坏
 * 玩家侧：概率破坏实际建筑；AI侧：直接扣减 wealth 和 militaryStrength
 * @param {Object} params
 * @param {string} params.targetNationId - 被侵入方国家ID
 * @param {boolean} params.isPlayerNation - 目标是否为玩家
 * @param {Object} params.buildings - 玩家的建筑 { buildingId: count }（仅玩家侧需要）
 * @param {string} params.zoneCategory - 区域类别：'frontier' | 'economic' | 'capital'
 * @param {number} params.raidMod - 姿态的 raidMod 系数
 * @param {Object} params.existingDestroyed - 该战线已有的建筑损毁 { buildingId: count }
 * @param {number} params.nationWealth - AI国家的财富（仅AI侧）
 * @param {number} params.nationMilitaryStrength - AI国家军事力量（仅AI侧）
 * @returns {Object} { destroyedBuildings: {buildingId: count}, wealthLoss: number, milStrLoss: number, narrative: string }
 */
export const calculateWarBuildingDamage = ({
    targetNationId: _targetNationId,
    isPlayerNation = false,
    buildings = {},
    zoneCategory = 'frontier',
    raidMod = 1.0,
    existingDestroyed = {},
    nationWealth = 0,
    nationMilitaryStrength: _nationMilitaryStrength = 0,
}) => {
    const result = {
        destroyedBuildings: {},
        wealthLoss: 0,
        milStrLoss: 0,
        narrative: '',
    };

    const baseProbability = WAR_ECONOMY.BUILDING_DESTROY_BASE_PROBABILITY;
    const destroyChance = baseProbability * raidMod;
    const allowedCats = zoneCategory === 'capital'
        ? ['gather', 'industry', 'civic', 'military']
        : zoneCategory === 'economic'
            ? ['industry', 'civic']
            : ['military', 'gather'];
    const candidates = [];

    for (const [bId, count] of Object.entries(buildings)) {
        if (count <= 0) continue;
        const bDef = BUILDINGS.find(b => b.id === bId);
        if (!bDef || !allowedCats.includes(bDef.cat)) continue;
        const alreadyDestroyed = (existingDestroyed[bId] || 0);
        if (count - alreadyDestroyed <= 1) continue;
        candidates.push({ id: bId, name: bDef.name, available: count - alreadyDestroyed });
    }

    if (isPlayerNation) {
        // 玩家侧：概率破坏实际建筑
        if (candidates.length === 0) {
            result.narrative = '战区建筑已严重受损，无更多可破坏目标';
            return result;
        }

        // 随机决定是否破坏，以及破坏几座
        const maxDestroy = WAR_ECONOMY.MAX_BUILDINGS_DESTROYED_PER_CHECKPOINT;
        let destroyCount = 0;
        const narratives = [];

        for (let i = 0; i < maxDestroy && candidates.length > 0; i++) {
            if (Math.random() > destroyChance) continue;
            // 随机选一座建筑
            const idx = Math.floor(Math.random() * candidates.length);
            const target = candidates[idx];
            result.destroyedBuildings[target.id] = (result.destroyedBuildings[target.id] || 0) + 1;
            target.available -= 1;
            if (target.available <= 1) {
                candidates.splice(idx, 1);
            }
            destroyCount++;
            narratives.push(target.name);
        }

        if (destroyCount > 0) {
            result.narrative = `敌军破坏了我方${narratives.join('、')}（共${destroyCount}座建筑受损）`;
        }
    } else {
        // AI侧：优先按真实建筑库存记录建筑损毁，同时继续扣减宏观经济数值
        const wealthPenaltyRate = zoneCategory === 'capital'
            ? WAR_ECONOMY.AI_WEALTH_LOSS_CAPITAL
            : WAR_ECONOMY.AI_WEALTH_LOSS_ECONOMIC;
        const milStrPenaltyRate = zoneCategory === 'capital'
            ? WAR_ECONOMY.AI_MILSTR_LOSS_CAPITAL
            : 0;
        const maxDestroy = WAR_ECONOMY.MAX_BUILDINGS_DESTROYED_PER_CHECKPOINT;
        const narratives = [];

        for (let i = 0; i < maxDestroy && candidates.length > 0; i++) {
            if (Math.random() > destroyChance) continue;
            const idx = Math.floor(Math.random() * candidates.length);
            const target = candidates[idx];
            result.destroyedBuildings[target.id] = (result.destroyedBuildings[target.id] || 0) + 1;
            target.available -= 1;
            if (target.available <= 1) {
                candidates.splice(idx, 1);
            }
            narratives.push(target.name);
        }

        result.wealthLoss = nationWealth * wealthPenaltyRate;
        result.milStrLoss = milStrPenaltyRate;
        if (narratives.length > 0) {
            result.narrative = `攻势破坏了敌方${narratives.join('、')}（共${narratives.length}座建筑受损）`;
        } else {
            result.narrative = zoneCategory === 'capital'
                ? `攻入敌方核心区，敌国经济和军工设施遭到重创`
                : `推进至敌方经济区，敌国产能受损`;
        }
    }

    return result;
};

// ========== 人口流失 ==========

/**
 * 战线进入新区域时的人口流失计算
 * @param {Object} params
 * @param {number} params.population - 被侵入方的当前人口
 * @param {string} params.zoneCategory - 区域类别
 * @returns {Object} { populationLoss: number, narrative: string }
 */
export const calculateWarPopulationLoss = ({
    population = 0,
    zoneCategory = 'frontier',
}) => {
    const lossRate = zoneCategory === 'capital'
        ? WAR_ECONOMY.POP_LOSS_CAPITAL
        : zoneCategory === 'economic'
            ? WAR_ECONOMY.POP_LOSS_ECONOMIC
            : WAR_ECONOMY.POP_LOSS_FRONTIER;

    const populationLoss = Math.floor(population * lossRate);

    const narrative = populationLoss > 0
        ? `战区平民伤亡和难民出逃，损失人口${populationLoss}`
        : '';

    return { populationLoss, narrative };
};

// ========== 财富掠夺 ==========

/**
 * 每tick持续从被侵入方掠夺财富（经济区/核心区时生效）
 * @param {Object} params
 * @param {number} params.targetWealth - 被侵入方的财富
 * @param {number} params.linePosition - 战线位置（0-100）
 * @param {string} params.side - 被掠夺方的side（'attacker' 或 'defender'）
 * @param {number} params.raidMod - 掠夺方的raidMod
 * @returns {Object} { wealthPlundered: number, wealthGained: number, narrative: string }
 */
export const calculateWarPlunder = ({
    targetWealth = 0,
    linePosition = 50,
    side = 'defender',
    raidMod = 1.0,
}) => {
    // 判断是否在被侵入方的经济区/核心区
    let plunderRate = 0;
    if (side === 'attacker') {
        // attacker 的领土在 linePos 低端
        if (linePosition < 15) {
            plunderRate = WAR_ECONOMY.PLUNDER_RATE_CAPITAL;
        } else if (linePosition < 35) {
            plunderRate = WAR_ECONOMY.PLUNDER_RATE_ECONOMIC;
        }
    } else {
        // defender 的领土在 linePos 高端
        if (linePosition > 85) {
            plunderRate = WAR_ECONOMY.PLUNDER_RATE_CAPITAL;
        } else if (linePosition > 65) {
            plunderRate = WAR_ECONOMY.PLUNDER_RATE_ECONOMIC;
        }
    }

    if (plunderRate <= 0) {
        return { wealthPlundered: 0, wealthGained: 0, narrative: '' };
    }

    const wealthPlundered = targetWealth * plunderRate * raidMod;
    // 入侵方获得掠夺银币的60%（40%消耗于战争本身）
    const wealthGained = wealthPlundered * WAR_ECONOMY.PLUNDER_GAIN_RATIO;

    return {
        wealthPlundered,
        wealthGained,
        narrative: wealthPlundered > 1
            ? `掠夺敌方财富${Math.floor(wealthPlundered)}银币`
            : '',
    };
};

// ========== 贸易中断 ==========

/**
 * 计算战时贸易中断惩罚系数
 * @param {number} activeWarCount - 当前活跃战争数
 * @returns {Object} { tradeDisruptionPenalty: number } 0~0.45的贸易量惩罚
 */
export const calculateWartimeTradeDisruption = (activeWarCount = 0) => {
    const penalty = Math.min(
        WAR_ECONOMY.TRADE_DISRUPTION_MAX,
        activeWarCount * WAR_ECONOMY.TRADE_DISRUPTION_PER_WAR
    );
    return { tradeDisruptionPenalty: penalty };
};

// ========== 军工繁荣 ==========

/**
 * 计算战时军工繁荣加成
 * @param {boolean} isAtWar - 是否处于战争状态
 * @returns {Object} { militaryBoost: number, miningBoost: number }
 */
export const calculateMilitaryIndustryBoost = (isAtWar = false) => {
    if (!isAtWar) {
        return { militaryBoost: 0, miningBoost: 0 };
    }
    return {
        militaryBoost: WAR_ECONOMY.MILITARY_INDUSTRY_BOOST,
        miningBoost: WAR_ECONOMY.MINING_INDUSTRY_BOOST,
    };
};

// ========== 战争经济快照汇总 ==========

/**
 * 汇总本tick的全部战争经济影响，供 simulation.js 统一消费
 * @param {Object} params
 * @param {Array} params.activeFronts - 活跃战线数组
 * @param {string} params.nationId - 国家ID
 * @param {boolean} params.isAtWar - 是否处于战争状态
 * @param {number} params.activeWarCount - 活跃战争数
 * @returns {Object} WarEconomySnapshot
 */
export const buildWarEconomySnapshot = ({
    activeFronts = [],
    nationId = 'player',
    isAtWar = false,
    activeWarCount = 0,
}) => {
    const warDamagedBuildings = aggregateWarDamagedBuildings(activeFronts, nationId);
    const { tradeDisruptionPenalty } = calculateWartimeTradeDisruption(activeWarCount);
    const { militaryBoost, miningBoost } = calculateMilitaryIndustryBoost(isAtWar);

    return {
        warDamagedBuildings,
        tradeDisruptionPenalty,
        militaryBoost,
        miningBoost,
    };
};
