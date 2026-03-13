/**
 * War Economy Module
 * 战争-经济联动核心模块。所有函数均为纯函数，接收状态参数返回修正值。
 * 
 * 核心理念：战争的影响体现在经济数据上（产能下降、资源变动、税收波动），
 * 而非独立的战斗数值系统。
 */

import { BUILDINGS } from '../../config/buildings';
import { AI_ECONOMY_CONFIG } from '../../config/diplomacy';
import {
    getPerCapitaWealthCap,
    getTargetPerCapitaWealth,
} from './config/aiEconomyConfig.js';
import {
    WAR_ECONOMY,
    RESOURCES,
} from '../../config/gameConstants';
import { planAIBuildingProfile } from './calculators/AIBuildingExpansionPlanner.js';


const safeNumber = (value, fallback = 0) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
};

const clampNumber = (value, min = 0, max = Infinity) => Math.min(max, Math.max(min, value));

const getNationInventoryWeight = (resourceKey) => (
    AI_ECONOMY_CONFIG.inventory.resourceWeights[resourceKey] || AI_ECONOMY_CONFIG.inventory.resourceWeights.default
);

const AI_BUILDING_EPOCH_CAPS = {
    0: 120,
    1: 220,
    2: 360,
    3: 560,
    4: 900,
    5: 1400,
    6: 2200,
    7: 3200,
};

const getAIBuildingEpochCap = (epoch = 0) => {
    const normalizedEpoch = clampNumber(Math.floor(safeNumber(epoch, 0)), 0, 7);
    return AI_BUILDING_EPOCH_CAPS[normalizedEpoch] || AI_BUILDING_EPOCH_CAPS[7];
};

const getAIBuildingTargetTotal = (nation, epoch = 0) => {
    const effectiveEpoch = clampNumber(Math.floor(safeNumber(epoch, nation?.epoch || 0)), 0, 7);
    const actualPop = Math.max(1, safeNumber(nation?.population, 1));
    const wealth = Math.max(0, safeNumber(nation?.wealth, 0));
    const targetPerCapita = Math.max(1, getTargetPerCapitaWealth(effectiveEpoch));
    const perCapitaCap = Math.max(targetPerCapita, getPerCapitaWealthCap(effectiveEpoch));
    const perCapitaWealth = wealth / Math.max(1, actualPop);
    const normalizedPerCapita = clampNumber(perCapitaWealth, targetPerCapita * 0.4, perCapitaCap);
    const wealthRatio = (normalizedPerCapita - targetPerCapita * 0.4) / Math.max(1, perCapitaCap - targetPerCapita * 0.4);
    const wealthMultiplier = 0.8 + wealthRatio * 0.45;
    let baseBuildings;
    if (actualPop <= 5) {
        baseBuildings = Math.max(1, Math.round(actualPop * 0.7));
    } else if (actualPop <= 12) {
        baseBuildings = Math.max(2, Math.round(actualPop * 0.5));
    } else {
        baseBuildings = Math.max(3, Math.floor(actualPop / 6.5));
    }
    const minBuildings = actualPop <= 3 ? 1 : actualPop <= 8 ? 2 : 3;
    const scaledTarget = Math.max(minBuildings, Math.round(baseBuildings * wealthMultiplier));

    return Math.round(clampNumber(scaledTarget, minBuildings, getAIBuildingEpochCap(effectiveEpoch)));
};

const buildLocalBuildingProfile = (profile = {}, foreignProfile = {}) => {
    const localProfile = {};
    for (const [bId, count] of Object.entries(profile || {})) {
        const localCount = Math.max(0, safeNumber(count, 0) - safeNumber(foreignProfile[bId], 0));
        if (localCount > 0) {
            localProfile[bId] = localCount;
        }
    }
    return localProfile;
};

const markNationEconomyDirty = (nation, flags = {}) => {
    if (!nation) return;
    nation.economyDirtyFlags = {
        buildingsDirty: true,
        laborDirty: true,
        resourcesDirty: true,
        warDirty: false,
        investmentDirty: false,
        ...(nation.economyDirtyFlags || {}),
        ...flags,
    };
};

const scaleBuildingProfileToTarget = (profile = {}, targetTotal = 0) => {
    const entries = Object.entries(profile).filter(([, count]) => safeNumber(count, 0) > 0);
    const safeTarget = Math.max(0, Math.round(safeNumber(targetTotal, 0)));
    if (entries.length === 0 || safeTarget <= 0) return {};

    if (safeTarget <= entries.length) {
        return Object.fromEntries(
            entries
                .sort((a, b) => safeNumber(b[1], 0) - safeNumber(a[1], 0))
                .slice(0, safeTarget)
                .map(([bId]) => [bId, 1])
        );
    }

    const currentTotal = entries.reduce((sum, [, count]) => sum + safeNumber(count, 0), 0);
    if (currentTotal <= 0) return {};

    const scaledEntries = entries.map(([bId, count]) => {
        const rawScaled = safeNumber(count, 0) * safeTarget / currentTotal;
        const baseCount = Math.max(1, Math.floor(rawScaled));
        return {
            bId,
            count: baseCount,
            remainder: rawScaled - baseCount,
        };
    });

    let assigned = scaledEntries.reduce((sum, entry) => sum + entry.count, 0);
    if (assigned < safeTarget) {
        const byRemainder = [...scaledEntries].sort((a, b) => b.remainder - a.remainder);
        let cursor = 0;
        while (assigned < safeTarget && byRemainder.length > 0) {
            byRemainder[cursor % byRemainder.length].count += 1;
            assigned += 1;
            cursor += 1;
        }
    } else if (assigned > safeTarget) {
        const byRemainder = [...scaledEntries].sort((a, b) => a.remainder - b.remainder);
        let cursor = 0;
        while (assigned > safeTarget && byRemainder.length > 0) {
            const entry = byRemainder[cursor % byRemainder.length];
            if (entry.count > 1) {
                entry.count -= 1;
                assigned -= 1;
            }
            cursor += 1;
            if (cursor > byRemainder.length * 4) break;
        }
    }

    return Object.fromEntries(
        scaledEntries
            .filter(entry => entry.count > 0)
            .map(entry => [entry.bId, entry.count])
    );
};

const mergeLocalAndForeignProfiles = (localProfile = {}, foreignProfile = {}) => {
    const merged = {};
    const allIds = new Set([...Object.keys(localProfile), ...Object.keys(foreignProfile)]);
    for (const bId of allIds) {
        const total = safeNumber(localProfile[bId], 0) + safeNumber(foreignProfile[bId], 0);
        if (total > 0) {
            merged[bId] = total;
        }
    }
    return merged;
};

export const getNationInventoryBaseline = ({ resourceKey, wealth = 1000 } = {}) => {

    const wealthScale = Math.pow(Math.max(100, safeNumber(wealth, 1000)) / 1000, 0.7);
    return Math.max(5, 50 * wealthScale * getNationInventoryWeight(resourceKey));
};

export const calculateNationLocalPrice = ({
    resourceKey,
    nation = {},
    marketPrice,
    currentPrice,
    inventoryOverride,
    wealthOverride,
    shock = 0,
} = {}) => {
    const resourceConfig = RESOURCES[resourceKey];
    if (!resourceConfig || resourceConfig.type === 'currency') {
        return clampNumber(safeNumber(currentPrice, marketPrice || resourceConfig?.basePrice || 1), 0.1, Infinity);
    }

    const wealth = Math.max(100, safeNumber(wealthOverride, nation?.wealth || 1000));
    const inventory = Math.max(
        0,
        safeNumber(
            inventoryOverride,
            nation?.nationInventories?.[resourceKey] ?? nation?.inventory?.[resourceKey] ?? 0
        )
    );
    const targetInventory = getNationInventoryBaseline({ resourceKey, wealth });
    const stockRatio = targetInventory > 0 ? inventory / targetInventory : 1;
    const shortagePressure = Math.max(0, 1 - stockRatio);
    const surplusPressure = Math.max(0, stockRatio - 1);
    const warPressure = nation?.isAtWar ? 0.08 : 0;
    let price = safeNumber(currentPrice, nation?.nationPrices?.[resourceKey] ?? marketPrice ?? resourceConfig.basePrice ?? 1);

    price *= 1 + shortagePressure * 0.45 + warPressure + Math.max(-0.12, Math.min(0.3, safeNumber(shock, 0)));
    price *= 1 - Math.min(0.35, surplusPressure * 0.18);

    if (Number.isFinite(Number(marketPrice)) && Number(marketPrice) > 0) {
        price = price * 0.97 + Number(marketPrice) * 0.03;
    }

    const minPrice = resourceConfig.minPrice || 0.1;
    const maxPrice = resourceConfig.maxPrice || 100;
    return Number(clampNumber(price, minPrice, maxPrice).toFixed(2));
};

export const applyMilitaryProcurementPressure = ({
    nation,
    resourceDemand = {},
    marketPrices = {},
    reserveWealth = 100,
    day = 0,
} = {}) => {
    if (!nation) return nation;

    const updatedNation = {
        ...nation,
        nationPrices: { ...(nation.nationPrices || {}) },
        nationInventories: { ...(nation.nationInventories || {}) },
        inventory: { ...(nation.inventory || {}) },
        military: {
            ...(nation.military || {}),
            stockpile: { ...(nation.military?.stockpile || {}) },
        },
    };

    let remainingWealth = Math.max(0, safeNumber(updatedNation.wealth, 0));
    const normalizedDemand = {};
    const fulfilledDemand = {};
    const resourceCost = {};
    const shortageDemand = {};

    Object.entries(resourceDemand || {}).forEach(([resourceKey, rawAmount]) => {
        const demand = Math.max(0, safeNumber(rawAmount, 0));
        if (demand <= 0) return;

        normalizedDemand[resourceKey] = demand;
        let fulfilled = 0;
        let cost = 0;

        if (resourceKey === 'silver') {
            const spendableWealth = Math.max(0, remainingWealth - reserveWealth);
            fulfilled = Math.min(demand, spendableWealth);
            cost = fulfilled;
            remainingWealth = Math.max(0, remainingWealth - cost);
        } else {
            const availableInventory = Math.max(0, safeNumber(updatedNation.nationInventories[resourceKey], 0));
            const unitPrice = Math.max(
                0.05,
                safeNumber(
                    updatedNation.nationPrices?.[resourceKey],
                    marketPrices?.[resourceKey] ?? RESOURCES[resourceKey]?.basePrice ?? 1
                )
            );
            const spendableWealth = Math.max(0, remainingWealth - reserveWealth);
            const affordableAmount = spendableWealth / unitPrice;
            fulfilled = Math.min(demand, availableInventory, affordableAmount);
            cost = fulfilled * unitPrice;
            updatedNation.nationInventories[resourceKey] = Math.max(0, availableInventory - fulfilled);
            updatedNation.inventory[resourceKey] = updatedNation.nationInventories[resourceKey];
            remainingWealth = Math.max(0, remainingWealth - cost);
        }

        if (fulfilled > 0) {
            updatedNation.military.stockpile[resourceKey] = Math.max(
                0,
                safeNumber(updatedNation.military.stockpile?.[resourceKey], 0) + fulfilled
            );
        }

        fulfilledDemand[resourceKey] = Number(fulfilled.toFixed(2));
        resourceCost[resourceKey] = Number(cost.toFixed(2));
        shortageDemand[resourceKey] = Number(Math.max(0, demand - fulfilled).toFixed(2));
    });

    updatedNation.wealth = Number(Math.max(0, remainingWealth).toFixed(2));

    Object.keys(normalizedDemand).forEach((resourceKey) => {
        if (resourceKey === 'silver') return;
        const demand = normalizedDemand[resourceKey] || 0;
        const fulfilled = fulfilledDemand[resourceKey] || 0;
        const shortfallRatio = demand > 0 ? Math.max(0, 1 - fulfilled / demand) : 0;
        const demandPressure = demand / Math.max(10, getNationInventoryBaseline({
            resourceKey,
            wealth: updatedNation.wealth || nation.wealth || 1000,
        }));

        updatedNation.nationPrices[resourceKey] = calculateNationLocalPrice({
            resourceKey,
            nation: updatedNation,
            marketPrice: marketPrices?.[resourceKey],
            currentPrice: updatedNation.nationPrices?.[resourceKey],
            shock: Math.min(0.28, shortfallRatio * 0.18 + demandPressure * 0.1),
        });
    });

    const totalDemand = Object.values(normalizedDemand).reduce((sum, amount) => sum + safeNumber(amount, 0), 0);
    const totalFulfilled = Object.values(fulfilledDemand).reduce((sum, amount) => sum + safeNumber(amount, 0), 0);
    const totalCost = Object.values(resourceCost).reduce((sum, amount) => sum + safeNumber(amount, 0), 0);

    updatedNation.military.procurement = {
        ...(nation.military?.procurement || {}),
        day,
        demand: normalizedDemand,
        fulfilled: fulfilledDemand,
        shortfall: shortageDemand,
        costByResource: resourceCost,
        totalDemand: Number(totalDemand.toFixed(2)),
        totalFulfilled: Number(totalFulfilled.toFixed(2)),
        totalCost: Number(totalCost.toFixed(2)),
        fulfillmentRatio: totalDemand > 0 ? Number((totalFulfilled / totalDemand).toFixed(3)) : 1,
    };

    return updatedNation;
};

// ========== 建筑损毁汇总（保留用于统计，但建筑现在是真实销毁）==========


/**
 * 汇总所有活跃战线的建筑损毁数据（仅用于UI统计显示）
 * 注意：建筑破坏现已改为真实销毁（直接从 builds 扣减），此函数仅用于累计战损统计
 * @param {Array} activeFronts - 活跃战线数组
 * @param {string} nationId - 要计算的国家ID（'player' 或 AI国家ID）
 * @returns {Object} { buildingId: destroyedCount } 所有战线累计的建筑损毁统计
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
 * 在战线 checkpoint crossing 时判定建筑破坏（真实销毁）
 * 破坏速度与敌方兵力绝对值和兵力比相关
 * @param {Object} params
 * @param {string} params.targetNationId - 被侵入方国家ID
 * @param {boolean} params.isPlayerNation - 目标是否为玩家
 * @param {Object} params.buildings - 建筑 { buildingId: count }
 * @param {string} params.zoneCategory - 区域类别：'frontier' | 'economic' | 'capital'
 * @param {number} params.raidMod - 姿态的 raidMod 系数
 * @param {Object} params.existingDestroyed - 该战线已有的建筑损毁统计 { buildingId: count }
 * @param {number} params.nationWealth - AI国家的财富（仅AI侧）
 * @param {number} params.nationMilitaryStrength - AI国家军事力量（仅AI侧）
 * @param {number} params.enemyUnits - 进攻方兵力绝对值（影响破坏上限）
 * @param {number} params.unitRatio - 进攻方兵力/防守方兵力比值（影响破坏概率）
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
    enemyUnits = 0,
    unitRatio = 1.0,
}) => {
    const result = {
        destroyedBuildings: {},
        wealthLoss: 0,
        milStrLoss: 0,
        narrative: '',
    };

    // Force ratio bonus: steeper curve for overwhelming force
    // 1:1→×1.0, 3:1→×1.8, 5:1→×2.3, 10:1→×3.0, 20:1+→×3.5 (cap)
    const ratioBonus = Math.min(3.5, 1.0 + Math.pow(Math.max(0, unitRatio - 1), 0.55) * 0.8);
    // Absolute strength bonus: +1 slot per 500 troops (was 1000)
    const unitsBonus = Math.floor(enemyUnits / 500);

    const baseProbability = WAR_ECONOMY.BUILDING_DESTROY_BASE_PROBABILITY;
    const destroyChance = Math.min(0.92, baseProbability * raidMod * ratioBonus);
    // Destruction cap: base + units bonus, max 12
    const maxDestroy = Math.min(12, WAR_ECONOMY.MAX_BUILDINGS_DESTROYED_PER_CHECKPOINT + unitsBonus);
    const effectiveDestroyChance = isPlayerNation
        ? Math.min(0.65, destroyChance * 0.55)
        : destroyChance;
    const effectiveMaxDestroy = isPlayerNation
        ? Math.max(1, Math.min(5, Math.ceil(maxDestroy * 0.5)))
        : maxDestroy;

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
        const isHousingBuilding = Number(bDef.output?.maxPop || 0) > 0;
        let minKeep = zoneCategory === 'capital' ? 0 : 1;

        // 玩家侧保护：避免战线几次推进就把整城住房和基础建筑瞬间清空。
        if (isPlayerNation) {
            minKeep = Math.max(minKeep, 1);
            if (isHousingBuilding) {
                minKeep = Math.max(minKeep, Math.ceil(count * 0.5));
            }
        }

        if (count <= minKeep) continue;
        candidates.push({ id: bId, name: bDef.name, available: count - minKeep });
    }

    if (isPlayerNation) {
        if (candidates.length === 0) {
            result.narrative = '战区建筑已严重受损，无更多可破坏目标';
            return result;
        }

        let destroyCount = 0;
        const narratives = [];

        for (let i = 0; i < effectiveMaxDestroy && candidates.length > 0; i++) {
            if (Math.random() > effectiveDestroyChance) continue;
            const idx = Math.floor(Math.random() * candidates.length);
            const target = candidates[idx];
            result.destroyedBuildings[target.id] = (result.destroyedBuildings[target.id] || 0) + 1;
            target.available -= 1;
            if (target.available <= 0) {
                candidates.splice(idx, 1);
            }
            destroyCount++;
            narratives.push(target.name);
        }

        if (destroyCount > 0) {
            result.narrative = `敌军摧毁了我方${narratives.join('、')}（共${destroyCount}座建筑被拆除）`;
        }
    } else {
        // AI侧：破坏建筑 + 扣减宏观经济数值，兵力比影响经济损伤幅度
        const wealthPenaltyRate = zoneCategory === 'capital'
            ? WAR_ECONOMY.AI_WEALTH_LOSS_CAPITAL
            : WAR_ECONOMY.AI_WEALTH_LOSS_ECONOMIC;
        const milStrPenaltyRate = zoneCategory === 'capital'
            ? WAR_ECONOMY.AI_MILSTR_LOSS_CAPITAL
            : 0;
        const narratives = [];

        for (let i = 0; i < effectiveMaxDestroy && candidates.length > 0; i++) {
            if (Math.random() > effectiveDestroyChance) continue;
            const idx = Math.floor(Math.random() * candidates.length);
            const target = candidates[idx];
            result.destroyedBuildings[target.id] = (result.destroyedBuildings[target.id] || 0) + 1;
            target.available -= 1;
            if (target.available <= 0) {
                candidates.splice(idx, 1);
            }
            narratives.push(target.name);
        }

        // 兵力比越大，经济损伤越大
        result.wealthLoss = nationWealth * wealthPenaltyRate * ratioBonus;
        result.milStrLoss = milStrPenaltyRate * ratioBonus;
        if (narratives.length > 0) {
            result.narrative = `攻势摧毁了敌方${narratives.join('、')}（共${narratives.length}座建筑被拆除）`;
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
 * 支持双向掠夺：攻方/守方均可作为被掠夺目标
 * @param {Object} params
 * @param {number} params.targetWealth - 被侵入方的财富
 * @param {number} params.linePosition - 战线位置（0-100）
 * @param {string} params.side - 被掠夺方的side（'attacker' 或 'defender'）
 * @param {number} params.raidMod - 掠夺方的raidMod
 * @param {number} params.unitRatio - 兵力比
 * @param {number} [params.efficiencyOverride] - 效率系数覆盖（用于反向掠夺/AI-AI掠夺场景）
 * @returns {Object} { wealthPlundered, wealthGained, zoneType, narrative }
 */
export const calculateWarPlunder = ({
    targetWealth = 0,
    linePosition = 50,
    side = 'defender',
    raidMod = 1.0,
    unitRatio = 1.0,
    efficiencyOverride = null,
}) => {
    // 判断是否在被侵入方的经济区/核心区
    let plunderRate = 0;
    let zoneType = 'none'; // 'none' | 'economic' | 'capital'
    if (side === 'attacker') {
        // attacker 的领土在 linePos 低端
        if (linePosition < 15) {
            plunderRate = WAR_ECONOMY.PLUNDER_RATE_CAPITAL;
            zoneType = 'capital';
        } else if (linePosition < 35) {
            plunderRate = WAR_ECONOMY.PLUNDER_RATE_ECONOMIC;
            zoneType = 'economic';
        }
    } else {
        // defender 的领土在 linePos 高端
        if (linePosition > 85) {
            plunderRate = WAR_ECONOMY.PLUNDER_RATE_CAPITAL;
            zoneType = 'capital';
        } else if (linePosition > 65) {
            plunderRate = WAR_ECONOMY.PLUNDER_RATE_ECONOMIC;
            zoneType = 'economic';
        }
    }

    if (plunderRate <= 0) {
        return { wealthPlundered: 0, wealthGained: 0, zoneType: 'none', narrative: '' };
    }

    // Apply efficiency override for reverse/AI-AI plunder scenarios
    if (efficiencyOverride != null && efficiencyOverride >= 0) {
        plunderRate *= efficiencyOverride;
    }

    // Force ratio amplifies plunder: 1:1→×1, 3:1→×1.6, 10:1→×2.5, cap 3.0
    const plunderRatioBonus = Math.min(3.0, 1.0 + Math.pow(Math.max(0, unitRatio - 1), 0.5) * 0.6);
    const wealthPlundered = targetWealth * plunderRate * raidMod * plunderRatioBonus;
    // 入侵方获得掠夺银币的60%（40%消耗于战争本身）
    const wealthGained = wealthPlundered * WAR_ECONOMY.PLUNDER_GAIN_RATIO;

    return {
        wealthPlundered,
        wealthGained,
        zoneType,
        narrative: wealthPlundered > 1
            ? `掠夺敌方财富${Math.floor(wealthPlundered)}银币`
            : '',
    };
};

// ========== 实物资源掠夺 ==========

/**
 * 计算实物资源掠夺（AI掠夺玩家时银币不足的补充掠夺）
 * @param {Object} params
 * @param {Object} params.resourceInventory - 玩家资源库存 { food: 100, wood: 50, ... }
 * @param {string} params.zoneType - 区域类型 'economic' | 'capital'
 * @param {number} [params.efficiencyOverride=1.0] - 效率系数
 * @param {Object} [params.nationPrices={}] - 资源价格用于估价折算 { food: 2.5, wood: 3.0, ... }
 * @returns {Object} { resourcesPlundered: { [type]: amount }, totalWealthEquivalent: number }
 */
export const calculateResourcePlunder = ({
    resourceInventory = {},
    zoneType = 'economic',
    efficiencyOverride = 1.0,
    nationPrices = {},
}) => {
    const baseRate = zoneType === 'capital'
        ? WAR_ECONOMY.RESOURCE_PLUNDER_RATE_CAPITAL
        : WAR_ECONOMY.RESOURCE_PLUNDER_RATE_ECONOMIC;
    const rate = baseRate * efficiencyOverride;
    const maxTypes = WAR_ECONOMY.MAX_RESOURCE_TYPES_PLUNDERED;

    // Exclude currency/virtual/special resources
    const EXCLUDED_RESOURCES = new Set(['silver', 'science', 'culture', 'maxPop', 'militaryCapacity']);
    const candidates = Object.entries(resourceInventory)
        .filter(([type, amount]) => amount > 0 && !EXCLUDED_RESOURCES.has(type))
        .sort((a, b) => b[1] - a[1]) // descending by stock
        .slice(0, maxTypes);

    const resourcesPlundered = {};
    let totalWealthEquivalent = 0;

    for (const [type, stock] of candidates) {
        const plundered = stock * rate;
        if (plundered <= 0) continue;
        resourcesPlundered[type] = plundered;
        // Estimate wealth equivalent using nationPrices
        const price = nationPrices[type] || (RESOURCES[type]?.basePrice ?? 1);
        totalWealthEquivalent += plundered * price;
    }

    return { resourcesPlundered, totalWealthEquivalent };
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

// ========== AI虚拟建筑画像 ==========

/**
 * 取建筑 output 中产出最大的资源作为主资源
 * @param {Object} output - 建筑的 output 对象 { resourceKey: amount }
 * @returns {string|null} 主资源 key，无 output 时返回 null
 */
const getMainResource = (output) => {
    if (!output || typeof output !== 'object') return null;
    let maxKey = null;
    let maxVal = 0;
    for (const [key, val] of Object.entries(output)) {
        // 排除非资源产出（如 maxPop）
        if (key === 'maxPop') continue;
        if (val > maxVal) {
            maxVal = val;
            maxKey = key;
        }
    }
    return maxKey;
};

/**
 * 计算单个建筑的经济匹配权重
 * @param {Object} building - 建筑配置对象
 * @param {Object} nation - AI 国家对象
 * @param {number} maxEpoch - 当前最大可用时代
 * @returns {number} 权重值（>=0.1）
 */
const calculateBuildingWeight = (building, nation, maxEpoch) => {
    const mainResource = getMainResource(building.output);
    if (!mainResource) return 1.0; // 无产出建筑使用默认权重

    const resourceBias = nation.economyTraits?.resourceBias || {};
    const inventory = nation.inventory || {};
    const nationPrices = nation.nationPrices || {};

    // bias 分数：bias > 1 表示特产 → 权重高
    const biasScore = resourceBias[mainResource] ?? 1.0;

    // 如果国家有 inventory 和 nationPrices 数据，使用完整公式
    const hasEconData = Object.keys(inventory).length > 0 || Object.keys(nationPrices).length > 0;

    let weight;
    if (hasEconData) {
        // 库存充裕 → 产能高 → 权重高（capped at 2.0）
        const inventoryScore = Math.min(2.0, (inventory[mainResource] || 0) / 500);
        // 市场价低 = 供应充足 → 权重高；价格高 = 稀缺 → 权重低
        const basePrice = RESOURCES[mainResource]?.basePrice || 1;
        const priceScore = 1 / Math.max(0.5, (nationPrices[mainResource] || basePrice) / basePrice);
        weight = biasScore * (0.5 + inventoryScore * 0.3 + priceScore * 0.2);
    } else {
        // 旧存档兼容：仅用 resourceBias + 时代加权
        weight = biasScore;
    }

    // 时代加权：高时代建筑优先
    const epochBonus = 1 + (building.epoch / Math.max(1, maxEpoch));
    weight *= epochBonus;

    return Math.max(0.1, weight);
};

/**
 * 为AI国家生成经济驱动的虚拟建筑画像
 * 建筑规模由人口+财富决定，类别比例由国家特质调整，
 * 类别内分配由 resourceBias/inventory/nationPrices 经济数据驱动
 * @param {Object} nation - AI国家对象
 * @param {number} epoch - 当前游戏时代
 * @param {Object} [options] - 可选参数
 * @param {Array} [options.overseasInvestments] - 海外投资数组（任务6使用）
 * @returns {Object} { buildingId: count } 格式，与玩家 buildings 完全兼容
 */
export const generateAIBuildingProfile = (nation, epoch = 0, options = {}) => {
    if (!nation) return {};

    const effectiveEpoch = epoch != null ? epoch : (nation.epoch ?? 0);
    const targetLocalBuildings = getAIBuildingTargetTotal(nation, effectiveEpoch);
    const overseasInvestments = options.overseasInvestments;
    const foreignProfile = {};
    if (Array.isArray(overseasInvestments)) {
        for (const inv of overseasInvestments) {
            if (inv.targetNationId === nation.id && inv.status === 'operating') {
                const count = inv.count || 1;
                foreignProfile[inv.buildingId] = (foreignProfile[inv.buildingId] || 0) + count;
            }
        }
    }

    // E. 幂等性：只有现有本地建筑画像仍在合理区间内时才跳过，避免旧档异常值长期滞留
    const existing = nation.virtualBuildings;
    const existingForeign = nation.virtualBuildingsForeign || {};
    if (existing) {
        const existingLocalTotal = Object.entries(existing).reduce(
            (sum, [bId, count]) => sum + Math.max(0, safeNumber(count, 0) - safeNumber(existingForeign[bId], 0)),
            0
        );
        if (existingLocalTotal >= Math.floor(targetLocalBuildings * 0.75)
            && existingLocalTotal <= Math.ceil(targetLocalBuildings * 1.5)) {
            const foreignChanged = JSON.stringify(existingForeign) !== JSON.stringify(foreignProfile);
            if (foreignChanged) {
                const localProfile = buildLocalBuildingProfile(existing, existingForeign);
                const mergedProfile = mergeLocalAndForeignProfiles(localProfile, foreignProfile);
                nation.virtualBuildingsForeign = foreignProfile;
                nation.virtualBuildings = mergedProfile;
                if (!nation.virtualBuildingsBaseline) {
                    nation.virtualBuildingsBaseline = JSON.parse(JSON.stringify(mergedProfile));
                }
                markNationEconomyDirty(nation, { investmentDirty: true });
                return mergedProfile;
            }
            if (!nation.virtualBuildingsBaseline) {
                nation.virtualBuildingsBaseline = JSON.parse(JSON.stringify(existing));
            }
            markNationEconomyDirty(nation, {
                buildingsDirty: false,
                laborDirty: false,
                resourcesDirty: false,
                investmentDirty: Object.keys(existingForeign).length > 0,
            });
            return existing;
        }
    }

    // A. 总量计算：以人口为主、财富做人均修正，并受时代上限约束
    const totalBuildings = targetLocalBuildings;

    // B. 时代过滤：使用传入的 epoch，排除超时代建筑
    const available = BUILDINGS.filter(b => {
        if (b.epoch > effectiveEpoch) return false;
        // 简化科技门槛：有 requiresTech 的建筑，其 epoch 即科技门槛
        // 同 epoch 有科技需求的仍然允许（假设 AI 有基础科技）
        return true;
    });


    const currentLocalProfile = buildLocalBuildingProfile(existing || {}, existingForeign);
    const profile = planAIBuildingProfile({
        nation,
        epoch: effectiveEpoch,
        totalBuildings,
        availableBuildings: available,
        currentProfile: currentLocalProfile,
        development: nation.aiDevelopment || {},
    });

    // 保存外资部分（独立追踪）
    nation.virtualBuildingsForeign = foreignProfile;

    // 保存并设置基线快照（含外资部分）
    const mergedProfile = mergeLocalAndForeignProfiles(profile, foreignProfile);
    nation.virtualBuildings = mergedProfile;
    nation.virtualBuildingsBaseline = JSON.parse(JSON.stringify(mergedProfile));
    markNationEconomyDirty(nation, {
        investmentDirty: Object.keys(foreignProfile).length > 0,
    });

    return mergedProfile;
};

// ========== 建筑完好度修正 ==========

/**
 * 计算 AI 国家每种资源的"建筑完好度修正因子"
 * 用于 updateAINationInventory 中乘入产量公式，使建筑破坏反向影响经济
 * @param {Object} nation - AI 国家对象（需有 virtualBuildings 和 virtualBuildingsBaseline）
 * @returns {Object} { resourceKey: modifier } modifier 范围 [0.3, 1.0]
 */
export const calculateBuildingIntegrityModifiers = (nation) => {
    const vb = nation?.virtualBuildings;
    if (!vb) return {}; // 无数据时返回空对象 → 调用方默认 1.0

    // 旧存档兼容：缺少 baseline 时从当前 virtualBuildings 复制一份
    if (!nation.virtualBuildingsBaseline) {
        nation.virtualBuildingsBaseline = JSON.parse(JSON.stringify(vb));
    }
    const baseline = nation.virtualBuildingsBaseline;

    // 按主资源汇总当前数量和基线数量
    const currentByResource = {};
    const baselineByResource = {};

    for (const [bId, baseCount] of Object.entries(baseline)) {
        if (baseCount <= 0) continue;
        const bDef = BUILDINGS.find(b => b.id === bId);
        const mainRes = getMainResource(bDef?.output);
        if (!mainRes) continue;
        baselineByResource[mainRes] = (baselineByResource[mainRes] || 0) + baseCount;
        currentByResource[mainRes] = (currentByResource[mainRes] || 0) + (vb[bId] || 0);
    }

    // 计算每种资源的完好度修正
    const modifiers = {};
    for (const [res, baseCount] of Object.entries(baselineByResource)) {
        if (baseCount <= 0) {
            modifiers[res] = 1.0;
            continue;
        }
        const current = currentByResource[res] || 0;
        const integrity = Math.min(1.0, current / baseCount);
        // modifier = 0.3 + integrity * 0.7（全毁保留30%基础产量）
        modifiers[res] = Math.max(0.3, Math.min(1.0, 0.3 + integrity * 0.7));
    }

    return modifiers;
};

// ========== AI 建筑和平恢复 ==========

/**
 * AI 国家在和平时期逐步恢复被破坏的建筑
 * 每30天执行一次，仅对和平状态且有 virtualBuildings 的国家生效
 * @param {Object} nation - AI 国家对象
 * @param {number} epoch - 当前游戏时代
 * @param {number} day - 当前游戏天数（tick）
 */
export const processAIBuildingRecovery = (nation, epoch, day) => {
    if (!nation || !nation.virtualBuildings) return;

    // 旧存档兼容：缺少 baseline 时自动补全
    if (!nation.virtualBuildingsBaseline) {
        nation.virtualBuildingsBaseline = JSON.parse(JSON.stringify(nation.virtualBuildings));
    }

    const effectiveEpoch = epoch != null ? epoch : (nation.epoch ?? 0);
    const targetTotal = getAIBuildingTargetTotal(nation, effectiveEpoch);
    const foreign = nation.virtualBuildingsForeign || {};

    // 先修正旧档中已经膨胀的本地建筑画像，避免异常值长期停留在 UI 和经济链路中
    let vb = nation.virtualBuildings;
    let currentLocalProfile = buildLocalBuildingProfile(vb, foreign);
    let currentLocalTotal = Object.values(currentLocalProfile).reduce((sum, count) => sum + safeNumber(count, 0), 0);
    if (currentLocalTotal > Math.max(targetTotal + 10, targetTotal * 1.6)) {
        const normalizedLocal = scaleBuildingProfileToTarget(currentLocalProfile, targetTotal);
        const baselineLocal = buildLocalBuildingProfile(nation.virtualBuildingsBaseline || vb, foreign);
        const normalizedBaselineLocal = scaleBuildingProfileToTarget(baselineLocal, targetTotal);

        vb = mergeLocalAndForeignProfiles(normalizedLocal, foreign);
        nation.virtualBuildings = vb;
        nation.virtualBuildingsBaseline = JSON.parse(JSON.stringify(
            mergeLocalAndForeignProfiles(normalizedBaselineLocal, foreign)
        ));
        markNationEconomyDirty(nation);

        currentLocalProfile = normalizedLocal;
        currentLocalTotal = Object.values(normalizedLocal).reduce((sum, count) => sum + safeNumber(count, 0), 0);
    }

    if (day % 30 !== 0) return;

    // 仅和平时期恢复
    const isAtWar = nation.isAtWar || (nation.foreignWars && Object.values(nation.foreignWars).some(w => w?.isAtWar));
    if (isAtWar) return;

    const available = BUILDINGS.filter(b => b.epoch <= effectiveEpoch);
    const canExpandPeacetime = day % 60 === 0 && currentLocalTotal < targetTotal;

    // 和平期正常扩张：按当前发展缺口补建筑，而不是只在战损后修复
    if (canExpandPeacetime) {
        const expansionNeed = targetTotal - currentLocalTotal;
        const expansionCount = Math.max(1, Math.min(
            expansionNeed,
            Math.ceil(Math.max(3, targetTotal) * 0.06)
        ));
        const plannedGrowth = planAIBuildingProfile({
            nation,
            epoch: effectiveEpoch,
            totalBuildings: expansionCount,
            availableBuildings: available,
            currentProfile: currentLocalProfile,
            development: nation.aiDevelopment || {},
        });

        let assignedGrowth = 0;
        Object.entries(plannedGrowth).forEach(([buildingId, count]) => {
            const assign = Math.max(0, Math.round(safeNumber(count, 0)));
            if (assign <= 0) return;
            vb[buildingId] = (vb[buildingId] || 0) + assign;
            assignedGrowth += assign;
        });

        if (assignedGrowth > 0) {
            nation.virtualBuildings = vb;
            nation.virtualBuildingsBaseline = JSON.parse(JSON.stringify(vb));
            markNationEconomyDirty(nation, {
                warDirty: false,
            });
            return;
        }
    }

    // 如果当前本地总量 >= 应有的80%，无需恢复
    if (currentLocalTotal >= targetTotal * 0.8) return;

    const deficit = targetTotal - currentLocalTotal;
    const recoveryCount = Math.max(1, Math.ceil(deficit * 0.1));

    // 找出被破坏最多的建筑类型（与基线比较）
    const baseline = nation.virtualBuildingsBaseline || {};
    const deficits = [];
    for (const [bId, baseCount] of Object.entries(baseline)) {
        const current = vb[bId] || 0;
        const foreignCount = foreign[bId] || 0;
        const localCurrent = Math.max(0, current - foreignCount);
        const localBase = Math.max(0, baseCount - foreignCount); // 基线中也需去除外资
        if (localCurrent < localBase) {
            deficits.push({ id: bId, deficit: localBase - localCurrent });
        }
    }

    // 按缺口大小排序（大缺口优先恢复）
    deficits.sort((a, b) => b.deficit - a.deficit);

    let remaining = recoveryCount;
    // 优先恢复被破坏最多的
    for (const item of deficits) {
        if (remaining <= 0) break;
        const restore = Math.min(remaining, item.deficit);
        vb[item.id] = (vb[item.id] || 0) + restore;
        remaining -= restore;
    }

    // 如果仍有恢复名额且 deficits 已补完，按权重新增（用经济匹配权重）
    if (remaining > 0) {
        const planned = planAIBuildingProfile({
            nation,
            epoch: effectiveEpoch,
            totalBuildings: remaining,
            availableBuildings: available.filter(b => b.cat !== 'military'),
            currentProfile: buildLocalBuildingProfile(vb, foreign),
            development: nation.aiDevelopment || {},
        });
        Object.entries(planned).forEach(([buildingId, count]) => {
            if (remaining <= 0) return;
            const assign = Math.min(remaining, Math.max(0, Math.round(safeNumber(count, 0))));
            if (assign > 0) {
                vb[buildingId] = (vb[buildingId] || 0) + assign;
                remaining -= assign;
            }
        });
        if (remaining > 0 && available.length > 0) {
            vb[available[0].id] = (vb[available[0].id] || 0) + remaining;
        }
    }

    // 同步更新基线快照（恢复后的建筑不再被视为"损毁"）
    nation.virtualBuildingsBaseline = JSON.parse(JSON.stringify(vb));
    markNationEconomyDirty(nation, {
        warDirty: false,
    });
};
