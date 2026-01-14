// 游戏循环钩子
// 处理游戏的核心循环逻辑，包括资源生产、人口增长等

import { useEffect, useRef, useState } from 'react';
import { unstable_batchedUpdates } from 'react-dom';
import { useSimulationWorker } from './useSimulationWorker';
import {
    BUILDINGS,
    calculateArmyMaintenance,
    calculateArmyPopulation,
    UNIT_TYPES,
    STRATA,
    RESOURCES,
    LOG_STORAGE_LIMIT,
    HISTORY_STORAGE_LIMIT,
    ORGANIZATION_EFFECTS,
    OPEN_MARKET_TREATY_TYPES,
    PEACE_TREATY_TYPES
} from '../config';
import { getBuildingEffectiveConfig } from '../config/buildingUpgrades';
import { getRandomFestivalEffects } from '../config/festivalEffects';
import { initCheatCodes } from './cheatCodes';
import { getCalendarInfo } from '../utils/calendar';
import { calculateForeignPrice, calculateTradeStatus } from '../utils/foreignTrade';
import {
    createEnemyPeaceRequestEvent,
    createWarDeclarationEvent,
    createGiftEvent,
    createAIRequestEvent,
    createAllianceRequestEvent,
    createTreatyProposalEvent,
    createTreatyBreachEvent,
    createAllyColdEvent,
    createAIDemandSurrenderEvent,
    createAllyAttackedEvent,
    createRebelDemandSurrenderEvent,
    createIndependenceWarEvent,
    createOverseasInvestmentOpportunityEvent,
    createNationalizationThreatEvent,
    createTradeDisputeEvent,
    createMilitaryAllianceInviteEvent,
    createBorderIncidentEvent,
    createVassalRequestEvent,
    REBEL_DEMAND_SURRENDER_TYPE,
} from '../config/events';
import { calculateTotalDailySalary, getCabinetStatus, calculateOfficialCapacity } from '../logic/officials/manager';
import { processDecreeExpiry, getAllTimedDecrees } from '../logic/officials/cabinetSynergy';
// 新版组织度系统
import {
    updateAllOrganizationStates,
    checkOrganizationEvents,
    ORGANIZATION_STAGE,
    MIN_REBELLION_INFLUENCE,
    checkCoalitionRebellion,
    COALITION_REBELLION_CONFIG,
} from '../logic/organizationSystem';
import { calculateAllPenalties } from '../logic/organizationPenalties';
// 联合叛乱系统
import {
    createCoalitionRebelNation,
    createCoalitionRebellionEvent,
    calculateCoalitionPopLoss,
} from '../config/events';
import { evaluatePromiseTasks } from '../logic/promiseTasks';
import { debugLog, debugError, isDebugEnabled } from '../utils/debugFlags';
// 叛乱事件（保留事件创建函数）
import {
    hasAvailableMilitary,
    isMilitaryRebelling,
    REBELLION_PHASE,
    createBrewingEvent,
    createPlottingEvent,
    createActiveRebellionEvent,
    createOfficialCoupEvent,
    createOfficialCoupNation,
    createRebelNation,
    createRebellionEndEvent,
} from '../logic/rebellionSystem';
import { getTreatyDailyMaintenance } from '../config/diplomacy';
import { processVassalUpdates } from '../logic/diplomacy/vassalSystem';
import { LOYALTY_CONFIG } from '../config/officials';

const calculateRebelPopulation = (stratumPop = 0) => {
    if (!Number.isFinite(stratumPop) || stratumPop <= 0) return 0;
    return Math.min(stratumPop, Math.max(1, Math.floor(stratumPop * 0.8)));
};

/**
 * 处理贸易路线的自动执行
 * @param {Object} current - 当前游戏状态
 * @param {Object} result - simulateTick的结果
 * @param {Function} addLog - 添加日志函数
 * @param {Function} setResources - 设置资源函数
 * @param {Function} setNations - 设置国家函数
 * @param {Function} setTradeRoutes - 设置贸易路线函数
 */
const processTradeRoutes = (current) => {
    const { tradeRoutes, nations, resources, daysElapsed, market, popStructure, taxPolicies, diplomacyOrganizations } = current;
    const routes = tradeRoutes.routes || [];
    const organizationList = diplomacyOrganizations?.organizations || [];
    const findSharedOrganization = (nationId) => organizationList.find(org =>
        Array.isArray(org?.members) && org.members.includes('player') && org.members.includes(nationId)
    );
    const getTariffDiscount = (nationId) => {
        const org = findSharedOrganization(nationId);
        return org ? (ORGANIZATION_EFFECTS[org.type]?.tariffDiscount || 0) : 0;
    };

    // 贸易路线配置
    const TRADE_SPEED = 0.05; // 每天传输盈余/缺口的5%
    const MIN_TRADE_AMOUNT = 0.1; // 最小贸易量

    // 获取在岗商人数量，决定有多少条贸易路线有效
    const merchantCount = popStructure?.merchant || 0;

    const routesToRemove = [];
    const tradeLog = [];
    let totalTradeTax = 0; // 玩家获得的贸易税
    const resourceDelta = {};
    const nationDelta = {};

    const addResourceDelta = (key, amount) => {
        if (!Number.isFinite(amount) || amount === 0) return;
        resourceDelta[key] = (resourceDelta[key] || 0) + amount;
    };

    const addNationDelta = (nationId, delta) => {
        if (!nationId || !delta) return;
        if (!nationDelta[nationId]) {
            nationDelta[nationId] = { budget: 0, relation: 0, inventory: {} };
        }
        if (Number.isFinite(delta.budget)) {
            nationDelta[nationId].budget += delta.budget;
        }
        if (Number.isFinite(delta.relation)) {
            nationDelta[nationId].relation += delta.relation;
        }
        if (delta.inventory) {
            Object.entries(delta.inventory).forEach(([resKey, amount]) => {
                if (!Number.isFinite(amount) || amount === 0) return;
                nationDelta[nationId].inventory[resKey] =
                    (nationDelta[nationId].inventory[resKey] || 0) + amount;
            });
        }
    };

    // 只处理前 merchantCount 条贸易路线（有多少个商人在岗就让多少条贸易路线有用）
    routes.forEach((route, index) => {
        const { nationId, resource, type } = route;
        const nation = nations.find(n => n.id === nationId);

        if (!nation) {
            routesToRemove.push(route);
            return;
        }

        // 如果超过商人数量，则跳过该贸易路线
        if (index >= merchantCount) {
            return;
        }

        // 检查是否处于战争，如果是则暂停贸易路线
        if (nation.isAtWar) {
            return; // 不移除路线，只是暂停
        }

        // 获取贸易状态
        const tradeStatus = calculateTradeStatus(resource, nation, daysElapsed);
        const localPrice = market?.prices?.[resource] ?? (RESOURCES[resource]?.basePrice || 1);
        const foreignPrice = calculateForeignPrice(resource, nation, daysElapsed);

        // New: trade route mode
        // - normal: must satisfy surplus/shortage like old rules
        // - force_sell: allow exporting even if the partner has no shortage ("dumping")
        // - force_buy: allow importing even if the partner has no surplus ("coercive purchase")
        const mode = route?.mode || 'normal';
        const isForceSell = mode === 'force_sell';
        const isForceBuy = mode === 'force_buy';

        // If open market treaty is active, coercive trade does not cause diplomatic debuff.
        const isOpenMarketActive = Boolean(nation?.openMarketUntil && daysElapsed < nation.openMarketUntil);

        if (type === 'export') {
            // 出口：商人在国内以国内价购买，在国外以国外价卖出
            // 玩家只赚取商人在国内购买时的交易税

            // Normal export requires partner shortage; force_sell ignores it.
            if (!isForceSell) {
                if (!tradeStatus.isShortage || tradeStatus.shortageAmount <= 0) {
                    return; // 对方没有缺口，暂停贸易但保留路线
                }
            }

            // 计算我方盈余
            const myInventory = resources[resource] || 0;
            const myTarget = 500; // 简化：使用固定目标库存
            const mySurplus = Math.max(0, myInventory - myTarget);

            if (mySurplus <= MIN_TRADE_AMOUNT) {
                return; // 我方没有盈余，暂停贸易但保留路线
            }

            // 计算本次出口量：
            // - normal: min(盈余, 对方缺口)
            // - force_sell: 允许倾销，只看我方盈余（但仍受 TRADE_SPEED 限制）
            const shortageCap = Math.max(0, tradeStatus.shortageAmount || 0);
            const exportCap = isForceSell ? mySurplus : Math.min(mySurplus, shortageCap);
            const exportAmount = exportCap * TRADE_SPEED;

            if (exportAmount < MIN_TRADE_AMOUNT) {
                return;
            }

            // 商人在国内购买资源
            const domesticPurchaseCost = localPrice * exportAmount;  // 商人在国内的购买成本
            const taxRate = taxPolicies?.resourceTaxRates?.[resource] || 0; // 获取该资源的交易税率
            // 关税存储为小数（0=无关税，0.5=50%关税，<0=补贴）
            // 最终税率 = 交易税 + 关税（加法叠加）
            const tariffRate = taxPolicies?.exportTariffMultipliers?.[resource] ?? taxPolicies?.resourceTariffMultipliers?.[resource] ?? 0;
            const tariffDiscount = getTariffDiscount(nationId);
            const adjustedTariffRate = tariffRate * (1 - tariffDiscount);
            const effectiveTaxRate = taxRate + adjustedTariffRate;
            const tradeTax = domesticPurchaseCost * effectiveTaxRate; // 玩家获得的交易税

            // 商人在国外销售
            // force_sell：倾销折价，避免无脑刷钱，同时制造外交代价
            const dumpingDiscount = 0.6;
            const effectiveForeignPrice = isForceSell ? foreignPrice * dumpingDiscount : foreignPrice;
            const foreignSaleRevenue = effectiveForeignPrice * exportAmount;  // 商人在国外的销售收入
            const merchantProfit = foreignSaleRevenue - domesticPurchaseCost - tradeTax; // 商人获得的利润（含关税成本）

            if (merchantProfit <= 0) {
                return;
            }

            // 更新玩家资源：扣除出口的资源，交易税交给 simulation 统一处理
            addResourceDelta(resource, -exportAmount);
            totalTradeTax += tradeTax;

            // 更新外国：支付给商人，获得资源
            // force_sell：关系下降（被倾销），并且对方预算扣款更小（视为“低价抢购”）
            addNationDelta(nationId, {
                budget: -foreignSaleRevenue,
                relation: isForceSell ? (isOpenMarketActive ? 0.2 : -0.6) : 0.2,
                inventory: { [resource]: exportAmount },
            });

        } else if (type === 'import') {
            // 进口：商人在国外以国外价购买，在国内以国内价卖出
            // 玩家只赚取商人在国内销售时的交易税

            // Normal import requires partner surplus; force_buy ignores it.
            if (!isForceBuy) {
                if (!tradeStatus.isSurplus || tradeStatus.surplusAmount <= 0) {
                    return; // 对方没有盈余，暂停贸易但保留路线
                }
            }

            // 计算本次进口量：
            // - normal: 对方盈余的一定比例
            // - force_buy: 允许强买，按固定“目标供给”抽取一部分（同时对关系造成伤害）
            const normalImportCap = Math.max(0, tradeStatus.surplusAmount || 0);
            const forcedBaseline = Math.max(10, tradeStatus.target || 0); // 给旧存档/无target时兜底
            const importCap = isForceBuy ? forcedBaseline : normalImportCap;
            const importAmount = importCap * TRADE_SPEED;

            if (importAmount < MIN_TRADE_AMOUNT) {
                return;
            }

            // 商人在国外购买资源
            // force_buy：强买溢价（你硬要买，对方抬价），避免无脑套利
            const forcedPremium = 1.3;
            const effectiveForeignPrice = isForceBuy ? foreignPrice * forcedPremium : foreignPrice;
            const foreignPurchaseCost = effectiveForeignPrice * importAmount;  // 商人在国外的购买成本

            // 商人在国内销售
            const domesticSaleRevenue = localPrice * importAmount;  // 商人在国内的销售收入
            const taxRate = taxPolicies?.resourceTaxRates?.[resource] || 0; // 获取该资源的交易税率
            // 关税存储为小数（0=无关税，0.5=50%关税，<0=补贴）
            // 最终税率 = 交易税 + 关税（加法叠加）
            const tariffRate = taxPolicies?.importTariffMultipliers?.[resource] ?? taxPolicies?.resourceTariffMultipliers?.[resource] ?? 0;
            const tariffDiscount = getTariffDiscount(nationId);
            const adjustedTariffRate = tariffRate * (1 - tariffDiscount);
            const effectiveTaxRate = taxRate + adjustedTariffRate;
            const tradeTax = domesticSaleRevenue * effectiveTaxRate; // 玩家获得的交易税
            const merchantProfit = domesticSaleRevenue - foreignPurchaseCost - tradeTax; // 商人获得的利润（含关税成本）

            if (merchantProfit <= 0) {
                return;
            }

            // 更新玩家资源：增加进口的资源，交易税交给 simulation 统一处理
            addResourceDelta(resource, importAmount);
            totalTradeTax += tradeTax;

            // 更新外国：收到商人支付，失去资源
            // force_buy：关系下降（被强买），库存允许被压到0
            addNationDelta(nationId, {
                budget: foreignPurchaseCost,
                relation: isForceBuy ? (isOpenMarketActive ? 0.2 : -0.6) : 0.2,
                inventory: { [resource]: -importAmount },
            });

            if (importAmount >= 1 && !isForceBuy) {
                tradeLog.push(`🚢 进口 ${importAmount.toFixed(1)} ${RESOURCES[resource]?.name || resource} 从 ${nation.name}：商人国外购 ${foreignPurchaseCost.toFixed(1)} 银币，国内售 ${domesticSaleRevenue.toFixed(1)} 银币（税 ${tradeTax.toFixed(1)}），商人赚 ${merchantProfit.toFixed(1)} 银币。`);
            }
        }
    });

    // 移除无效的贸易路线
    return { tradeTax: totalTradeTax, resourceDelta, nationDelta, routesToRemove, tradeLog };
};

const applyTradeRouteDeltas = (summary, current, addLog, setResources, setNations, setTradeRoutes, options = {}) => {
    if (!summary) return;
    const {
        resourceDelta = {},
        nationDelta = {},
        routesToRemove = [],
        tradeLog = [],
    } = summary;
    const {
        applyResourceDelta = true,
        applyNationDelta = true,
        applyRouteRemoval = true,
        applyLogs = true,
    } = options;

    if (applyRouteRemoval && routesToRemove.length > 0) {
        setTradeRoutes(prev => ({
            ...prev,
            routes: prev.routes.filter(route =>
                !routesToRemove.some(r =>
                    r.nationId === route.nationId &&
                    r.resource === route.resource &&
                    r.type === route.type
                )
            )
        }));
    }

    if (applyResourceDelta && Object.keys(resourceDelta).length > 0) {
        setResources(prev => {
            const next = { ...prev };
            Object.entries(resourceDelta).forEach(([key, delta]) => {
                const currentValue = next[key] || 0;
                next[key] = Math.max(0, currentValue + delta);
            });
            return next;
        });
    }

    if (applyNationDelta && Object.keys(nationDelta).length > 0) {
        setNations(prev => prev.map(n => {
            const delta = nationDelta[n.id];
            if (!delta) return n;
            const nextInventory = { ...(n.inventory || {}) };
            Object.entries(delta.inventory || {}).forEach(([resKey, amount]) => {
                nextInventory[resKey] = Math.max(0, (nextInventory[resKey] || 0) + amount);
            });
            return {
                ...n,
                budget: Math.max(0, (n.budget || 0) + (delta.budget || 0)),
                inventory: nextInventory,
                relation: Math.min(100, Math.max(-100, (n.relation || 0) + (delta.relation || 0))),
            };
        }));
    }

    if (applyLogs) {
        const logVisibility = current?.eventEffectSettings?.logVisibility || {};
        const shouldLogMerchantTrades = logVisibility.showMerchantTradeLogs ?? true;
        const shouldLogTradeRoutes = logVisibility.showTradeRouteLogs ?? true;

        if (shouldLogMerchantTrades) {
            tradeLog.forEach(log => addLog(log));
        }

        if (!shouldLogTradeRoutes) {
            // currently trade routes only output detailed logs above;
            // keep this block to ensure future trade-route logs can be gated centrally.
        }
    }
};


const applyResourceDeltaToSnapshot = (resources = {}, delta = {}) => {
    if (!delta || Object.keys(delta).length === 0) return resources || {};
    const next = { ...(resources || {}) };
    Object.entries(delta).forEach(([key, amount]) => {
        if (!Number.isFinite(amount) || amount === 0) return;
        const currentValue = next[key] || 0;
        next[key] = Math.max(0, currentValue + amount);
    });
    return next;
};

const getUnitPopulationCost = (unitId) => {
    const unit = UNIT_TYPES[unitId];
    return unit?.populationCost || 1;
};

const getMilitaryCapacity = (buildingState = {}) => {
    let capacity = 0;
    Object.entries(buildingState || {}).forEach(([buildingId, count]) => {
        if (!count) return;
        const building = BUILDINGS.find(b => b.id === buildingId);
        if (building?.output?.militaryCapacity) {
            capacity += building.output.militaryCapacity * count;
        }
    });
    return capacity;
};

const getTotalArmyCount = (armyState = {}, queueState = []) => {
    const armyCount = Object.values(armyState || {}).reduce((sum, count) => sum + (count || 0), 0);
    const queueCount = Array.isArray(queueState) ? queueState.length : 0;
    return armyCount + queueCount;
};

const formatUnitSummary = (unitMap = {}) => {
    return Object.entries(unitMap)
        .map(([unitId, count]) => {
            const unitName = UNIT_TYPES[unitId]?.name || unitId;
            return `${unitName} x${count}`;
        })
        .join('、');
};

/**
 * 根据可用士兵数量同步现役部队与训练队列
 */
const syncArmyWithSoldierPopulation = (armyState = {}, queueState = [], availableSoldiers = 0, autoRecruitEnabled = false) => {
    const safeArmy = armyState || {};
    const safeQueue = Array.isArray(queueState) ? queueState : [];
    const available = Number.isFinite(availableSoldiers) ? Math.max(0, availableSoldiers) : 0;

    let queueClone = null;
    const ensureQueueClone = () => {
        if (!queueClone) {
            queueClone = safeQueue.map(item => (item ? { ...item } : item));
        }
        return queueClone;
    };

    const trainingEntries = [];
    let trainingPopulation = 0;
    safeQueue.forEach((item, index) => {
        if (!item || item.status !== 'training') return;
        const popCost = getUnitPopulationCost(item.unitId);
        trainingPopulation += popCost;
        trainingEntries.push({
            index,
            unitId: item.unitId,
            popCost,
            remainingTime: item.remainingTime || 0,
        });
    });

    let cancelledTraining = null;
    // [FIX] 减小容差值，防止长期超员导致无限爆兵
    // 只保留1点容差用于处理毕业时的时序问题
    const trainingTolerance = 1;
    const effectiveAvailableForTraining = available + trainingTolerance;

    // console.log('[TRAINING SYNC] trainingPop:', trainingPopulation, 'available:', available,
    //     'tolerance:', trainingTolerance, 'effectiveAvailable:', effectiveAvailableForTraining); // Commented for performance

    if (trainingPopulation > effectiveAvailableForTraining) {
        let manpowerToFree = trainingPopulation - effectiveAvailableForTraining;
        // console.log('[TRAINING SYNC] INTERRUPTING! manpowerToFree:', manpowerToFree); // Commented for performance
        const sortedTraining = trainingEntries.sort(
            (a, b) => (b.remainingTime || 0) - (a.remainingTime || 0)
        );

        sortedTraining.forEach(entry => {
            if (manpowerToFree <= 0) return;
            manpowerToFree -= entry.popCost;
            trainingPopulation -= entry.popCost;
            const clone = ensureQueueClone();
            const original = clone[entry.index] || {};
            clone[entry.index] = {
                ...original,
                status: 'waiting',
                remainingTime: original.totalTime ?? original.remainingTime ?? 0,
            };
            if (!cancelledTraining) cancelledTraining = {};
            cancelledTraining[entry.unitId] = (cancelledTraining[entry.unitId] || 0) + 1;
        });
    }

    const availableForArmy = Math.max(0, available - trainingPopulation);
    const currentArmyPopulation = calculateArmyPopulation(safeArmy);
    let updatedArmy = null;
    let removedUnits = null;
    let unitsToRequeue = null; // [NEW] 需要重新加入队列的单位（关闭自动补兵时使用）

    // [FIX] 减小容差值，只为即将毕业的单位保留容差
    // 基础容差从3减到1，防止长期超员导致无限爆兵
    let toleranceForNewGraduates = 1; // Base tolerance for population allocation lag
    safeQueue.forEach(item => {
        if (item && item.status === 'training' && item.remainingTime <= 1) {
            const popCost = getUnitPopulationCost(item.unitId);
            toleranceForNewGraduates += popCost;
        }
    });

    const effectiveAvailableForArmy = availableForArmy + toleranceForNewGraduates;

    // Debug logging for army population sync
    // console.log('[ARMY SYNC] available:', available, 'trainingPop:', trainingPopulation,
    //     'availableForArmy:', availableForArmy, 'tolerance:', toleranceForNewGraduates,
    //     'effectiveAvailable:', effectiveAvailableForArmy, 'currentArmyPop:', currentArmyPopulation); // Commented for performance

    if (currentArmyPopulation > effectiveAvailableForArmy) {
        let manpowerToRemove = currentArmyPopulation - effectiveAvailableForArmy;
        updatedArmy = { ...safeArmy };
        removedUnits = {};

        // [FIX] 如果开启了自动补兵，记录需要重新排队的单位（保留编制意图）
        if (autoRecruitEnabled) {
            unitsToRequeue = {};
        }

        const armyEntries = Object.entries(updatedArmy)
            .filter(([, count]) => count > 0)
            .map(([unitId, count]) => ({
                unitId,
                count,
                popCost: getUnitPopulationCost(unitId),
                epoch: UNIT_TYPES[unitId]?.epoch ?? 0,
                trainingTime: UNIT_TYPES[unitId]?.trainingTime || 1, // [NEW] 记录训练时间用于重新排队
            }))
            .sort((a, b) => {
                // 优先解散人口消耗高的单位
                if (a.popCost === b.popCost) {
                    return a.epoch - b.epoch;
                }
                return b.popCost - a.popCost;
            });

        for (const entry of armyEntries) {
            if (manpowerToRemove <= 0) break;
            const { unitId, popCost, trainingTime } = entry;
            const removable = Math.min(entry.count, Math.ceil(manpowerToRemove / popCost));
            if (removable <= 0) continue;

            updatedArmy[unitId] -= removable;
            manpowerToRemove -= removable * popCost;

            if (updatedArmy[unitId] <= 0) {
                delete updatedArmy[unitId];
            }

            removedUnits[unitId] = (removedUnits[unitId] || 0) + removable;

            // [FIX] 如果开启了自动补兵，记录单位信息用于重新排队（保留编制意图）
            if (autoRecruitEnabled) {
                unitsToRequeue[unitId] = {
                    count: (unitsToRequeue[unitId]?.count || 0) + removable,
                    trainingTime: trainingTime,
                };
            }
        }

        if (Object.keys(removedUnits).length === 0) {
            removedUnits = null;
            updatedArmy = null;
            unitsToRequeue = null;
        }
    }

    return {
        updatedArmy,
        updatedQueue: queueClone,
        removedUnits,
        cancelledTraining,
        unitsToRequeue, // [NEW] 返回需要重新排队的单位
    };
};

const processTimedEventEffects = (effectState = {}, settings = {}) => {
    const approvalEffects = Array.isArray(effectState.approval) ? effectState.approval : [];
    const stabilityEffects = Array.isArray(effectState.stability) ? effectState.stability : [];
    const resourceDemandEffects = Array.isArray(effectState.resourceDemand) ? effectState.resourceDemand : [];
    const stratumDemandEffects = Array.isArray(effectState.stratumDemand) ? effectState.stratumDemand : [];
    const buildingProductionEffects = Array.isArray(effectState.buildingProduction) ? effectState.buildingProduction : [];

    const approvalModifiers = {};
    let stabilityModifier = 0;
    const resourceDemandModifiers = {};   // { resourceKey: totalModifier }
    const stratumDemandModifiers = {};    // { stratumKey: totalModifier }
    const buildingProductionModifiers = {}; // { buildingIdOrCat: totalModifier }

    const nextApprovalEffects = [];
    const nextStabilityEffects = [];
    const nextResourceDemandEffects = [];
    const nextStratumDemandEffects = [];
    const nextBuildingProductionEffects = [];

    const clampDecay = (value, fallback) => {
        if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
        return Math.min(0.95, Math.max(0, value));
    };

    const approvalDurationDefault = Math.max(1, settings?.approval?.duration || 30);
    const approvalDecayDefault = clampDecay(settings?.approval?.decayRate ?? 0.04, 0.04);
    const stabilityDurationDefault = Math.max(1, settings?.stability?.duration || 30);
    const stabilityDecayDefault = clampDecay(settings?.stability?.decayRate ?? 0.04, 0.04);
    const resourceDemandDurationDefault = Math.max(1, settings?.resourceDemand?.duration || 60);
    const resourceDemandDecayDefault = clampDecay(settings?.resourceDemand?.decayRate ?? 0.02, 0.02);
    const stratumDemandDurationDefault = Math.max(1, settings?.stratumDemand?.duration || 60);
    const stratumDemandDecayDefault = clampDecay(settings?.stratumDemand?.decayRate ?? 0.02, 0.02);
    const buildingProductionDurationDefault = Math.max(1, settings?.buildingProduction?.duration || 45);
    const buildingProductionDecayDefault = clampDecay(settings?.buildingProduction?.decayRate ?? 0.025, 0.025);

    // Process approval effects
    approvalEffects.forEach(effect => {
        const currentValue = typeof effect.currentValue === 'number' ? effect.currentValue : 0;
        const remainingDays = effect.remainingDays ?? approvalDurationDefault;
        if (remainingDays <= 0 || Math.abs(currentValue) < 0.001) {
            return;
        }
        const stratum = effect.stratum;
        if (!stratum) {
            return;
        }
        approvalModifiers[stratum] = (approvalModifiers[stratum] || 0) + currentValue;
        const decayRate = clampDecay(effect.decayRate, approvalDecayDefault);
        const nextValue = currentValue * (1 - decayRate);
        const nextRemaining = remainingDays - 1;
        if (nextRemaining > 0 && Math.abs(nextValue) >= 0.001) {
            nextApprovalEffects.push({
                ...effect,
                currentValue: nextValue,
                remainingDays: nextRemaining,
            });
        }
    });

    // Process stability effects
    stabilityEffects.forEach(effect => {
        const currentValue = typeof effect.currentValue === 'number' ? effect.currentValue : 0;
        const remainingDays = effect.remainingDays ?? stabilityDurationDefault;
        if (remainingDays <= 0 || Math.abs(currentValue) < 0.001) {
            return;
        }
        stabilityModifier += currentValue;
        const decayRate = clampDecay(effect.decayRate, stabilityDecayDefault);
        const nextValue = currentValue * (1 - decayRate);
        const nextRemaining = remainingDays - 1;
        if (nextRemaining > 0 && Math.abs(nextValue) >= 0.001) {
            nextStabilityEffects.push({
                ...effect,
                currentValue: nextValue,
                remainingDays: nextRemaining,
            });
        }
    });

    // Process resource demand effects
    resourceDemandEffects.forEach(effect => {
        const currentValue = typeof effect.currentValue === 'number' ? effect.currentValue : 0;
        const remainingDays = effect.remainingDays ?? resourceDemandDurationDefault;
        if (remainingDays <= 0 || Math.abs(currentValue) < 0.001) {
            return;
        }
        const target = effect.target;
        if (!target) return;
        resourceDemandModifiers[target] = (resourceDemandModifiers[target] || 0) + currentValue;
        const decayRate = clampDecay(effect.decayRate, resourceDemandDecayDefault);
        const nextValue = currentValue * (1 - decayRate);
        const nextRemaining = remainingDays - 1;
        if (nextRemaining > 0 && Math.abs(nextValue) >= 0.001) {
            nextResourceDemandEffects.push({
                ...effect,
                currentValue: nextValue,
                remainingDays: nextRemaining,
            });
        }
    });

    // Process stratum demand effects
    stratumDemandEffects.forEach(effect => {
        const currentValue = typeof effect.currentValue === 'number' ? effect.currentValue : 0;
        const remainingDays = effect.remainingDays ?? stratumDemandDurationDefault;
        if (remainingDays <= 0 || Math.abs(currentValue) < 0.001) {
            return;
        }
        const target = effect.target;
        if (!target) return;
        stratumDemandModifiers[target] = (stratumDemandModifiers[target] || 0) + currentValue;
        const decayRate = clampDecay(effect.decayRate, stratumDemandDecayDefault);
        const nextValue = currentValue * (1 - decayRate);
        const nextRemaining = remainingDays - 1;
        if (nextRemaining > 0 && Math.abs(nextValue) >= 0.001) {
            nextStratumDemandEffects.push({
                ...effect,
                currentValue: nextValue,
                remainingDays: nextRemaining,
            });
        }
    });

    // Process building production effects
    buildingProductionEffects.forEach(effect => {
        const currentValue = typeof effect.currentValue === 'number' ? effect.currentValue : 0;
        const remainingDays = effect.remainingDays ?? buildingProductionDurationDefault;
        if (remainingDays <= 0 || Math.abs(currentValue) < 0.001) {
            return;
        }
        const target = effect.target;
        if (!target) return;
        buildingProductionModifiers[target] = (buildingProductionModifiers[target] || 0) + currentValue;
        const decayRate = clampDecay(effect.decayRate, buildingProductionDecayDefault);
        const nextValue = currentValue * (1 - decayRate);
        const nextRemaining = remainingDays - 1;
        if (nextRemaining > 0 && Math.abs(nextValue) >= 0.001) {
            nextBuildingProductionEffects.push({
                ...effect,
                currentValue: nextValue,
                remainingDays: nextRemaining,
            });
        }
    });

    return {
        approvalModifiers,
        stabilityModifier,
        resourceDemandModifiers,
        stratumDemandModifiers,
        buildingProductionModifiers,
        nextEffects: {
            approval: nextApprovalEffects,
            stability: nextStabilityEffects,
            resourceDemand: nextResourceDemandEffects,
            stratumDemand: nextStratumDemandEffects,
            buildingProduction: nextBuildingProductionEffects,
        },
    };
};

/**
 * 游戏循环钩子
 * 处理游戏的核心循环逻辑
 * @param {Object} gameState - 游戏状态对象
 * @param {Function} addLog - 添加日志函数
 * @param {Object} actions - 游戏操作函数集
 */
export const useGameLoop = (gameState, addLog, actions) => {
    const {
        resources,
        setResources,
        market,
        setMarket,
        buildings,
        setBuildings,
        population,
        popStructure,
        setPopulation,
        birthAccumulator,
        setBirthAccumulator,
        epoch,
        techsUnlocked,
        activeDecrees, // [NEW] Active Reform Decrees
        setActiveDecrees, // [NEW] Setter for active decrees
        quotaTargets, // [NEW] Planned Economy Targets
        expansionSettings, // [NEW] Free Market Settings
        priceControls, // [NEW] 价格管制设置
        decrees,
        gameSpeed,
        isPaused,
        setIsPaused,
        nations,
        setNations,
        setPopStructure,
        setMaxPop,
        maxPopBonus,
        setRates,
        setTaxes,
        setClassApproval,
        classApproval,
        setApprovalBreakdown, // [NEW] 用于保存 simulation 返回的满意度分解数据
        setClassInfluence,
        setClassWealth,
        setClassWealthDelta,
        setClassIncome,
        setClassExpense,
        setClassFinancialData, // Detailed financial data setter
        setBuildingFinancialData, // Per-building realized financial data setter
        classWealthHistory,
        setClassWealthHistory,
        classNeedsHistory,
        setClassNeedsHistory,
        setTotalInfluence,
        setTotalWealth,
        setActiveBuffs,
        setActiveDebuffs,
        stability,
        setStability,
        setLogs,
        taxPolicies,
        classWealth,
        setClassShortages,
        setClassLivingStandard,
        livingStandardStreaks,
        setLivingStandardStreaks,
        migrationCooldowns,
        setMigrationCooldowns,
        taxShock,
        setTaxShock,
        activeBuffs,
        activeDebuffs,
        army,
        setArmy,
        militaryQueue,
        setMilitaryQueue,
        jobFill,
        setJobFill,
        jobsAvailable,
        setJobsAvailable,
        setDaysElapsed,
        daysElapsed,
        militaryWageRatio,
        classInfluenceShift,
        setClassInfluenceShift,
        setFestivalModal,
        activeFestivalEffects,
        setActiveFestivalEffects,
        lastFestivalYear,
        setLastFestivalYear,
        setHistory,
        autoSaveInterval,
        isAutoSaveEnabled,
        lastAutoSaveTime,
        saveGame,
        merchantState,
        setMerchantState,
        tradeRoutes,
        setTradeRoutes,
        diplomacyOrganizations,
        tradeStats,
        setTradeStats,
        actionCooldowns,
        setActionCooldowns,
        actionUsage,
        setActionUsage,
        promiseTasks,
        setPromiseTasks,
        activeEventEffects,
        setActiveEventEffects,
        eventEffectSettings,
        rebellionStates,
        setRebellionStates,
        classInfluence,
        totalInfluence,
        buildingUpgrades,
        setBuildingUpgrades, // For owner auto-upgrade
        autoRecruitEnabled,
        targetArmyComposition,
        rulingCoalition, // 执政联盟成员
        legitimacy, // 当前合法性值
        setLegitimacy, // 合法性更新函数
        setModifiers, // Modifiers更新函数
        difficulty, // 游戏难度
        officials, // 官员系统
        setOfficials, // 官员状态更新函数
        officialCapacity, // 官员容量
        setOfficialCapacity, // 官员容量更新函数
        setFiscalActual, // [NEW] realized fiscal numbers per tick
        overseasInvestments, // 海外投资列表
        setOverseasInvestments, // 海外投资更新函数
        foreignInvestments, // [NEW] 用于 simulation 计算
        setForeignInvestments, // [FIX] Destructure setter
    } = gameState;

    // 使用ref保存最新状态，避免闭包问题
    const stateRef = useRef({
        resources,
        market,
        buildings,
        buildingUpgrades,
        autoRecruitEnabled,
        targetArmyComposition,
        population,
        popStructure,
        birthAccumulator,
        maxPopBonus,
        epoch,
        techsUnlocked,
        decrees,
        gameSpeed,
        nations,
        classWealth,
        army,
        militaryQueue,
        jobFill,
        jobsAvailable,
        activeBuffs,
        activeDebuffs,
        taxPolicies,
        classWealthHistory,
        classNeedsHistory,
        militaryWageRatio,
        classApproval,
        daysElapsed,
        activeFestivalEffects,
        lastFestivalYear,
        isPaused,
        autoSaveInterval,
        isAutoSaveEnabled,
        lastAutoSaveTime,
        merchantState,
        tradeRoutes,
        diplomacyOrganizations,
        actions,
        tradeStats,
        actionCooldowns,
        actionUsage,
        promiseTasks,
        activeEventEffects,
        eventEffectSettings,
        rebellionStates,
        classInfluence,
        totalInfluence,
        birthAccumulator,
        stability,
        rulingCoalition, // 执政联盟成员
        legitimacy, // 当前合法性值
        difficulty, // 游戏难度
        officials,
        officialCapacity, // [FIX] 添加官员容量，用于 getCabinetStatus 计算
        activeDecrees, // [NEW] Pass activeDecrees to simulation
        quotaTargets, // [NEW] Planned Economy targets
        expansionSettings, // [NEW] Free Market settings
        priceControls, // [NEW] 价格管制设置
    });

    const saveGameRef = useRef(gameState.saveGame);
    const autoReplenishTickRef = useRef({ day: null, key: '' });
    const capacityTrimLogRef = useRef({ day: null });
    const AUTO_RECRUIT_BATCH_LIMIT = 3;
    const AUTO_RECRUIT_FAIL_COOLDOWN = 5000;

    // [FIX] Overseas Investment Ref to track latest state updates
    const overseasInvestmentsRef = useRef(overseasInvestments);
    useEffect(() => {
        overseasInvestmentsRef.current = overseasInvestments;
    }, [overseasInvestments]);

    // ========== 历史数据节流 ==========
    // 每 HISTORY_UPDATE_INTERVAL 个 tick 才更新一次历史数据，减少内存操作
    const historyUpdateCounterRef = useRef(0);
    const HISTORY_UPDATE_INTERVAL = 1; // 每1个tick更新一次历史数据（保留最近30天）

    const { runSimulation } = useSimulationWorker();

    useEffect(() => {
        saveGameRef.current = gameState.saveGame;
    }, [gameState.saveGame]);

    useEffect(() => {
        stateRef.current = {
            resources,
            market,
            buildings,
            buildingUpgrades,
            autoRecruitEnabled,
            targetArmyComposition,
            population,
            epoch,
            popStructure,
            maxPopBonus,
            techsUnlocked,
            decrees,
            gameSpeed,
            nations,
            classWealth,
            livingStandardStreaks,
            migrationCooldowns,
            taxShock,
            army,
            militaryQueue,
            jobFill,
            activeBuffs,
            activeDebuffs,
            taxPolicies,
            classWealthHistory,
            classNeedsHistory,
            militaryWageRatio,
            classApproval,
            daysElapsed,
            activeFestivalEffects,
            lastFestivalYear,
            isPaused,
            autoSaveInterval,
            isAutoSaveEnabled,
            lastAutoSaveTime,
            merchantState,
            tradeRoutes,
            diplomacyOrganizations,
            actions,
            tradeStats,
            actionCooldowns,
            actionUsage,
            promiseTasks,
            activeEventEffects,
            eventEffectSettings,
            rebellionStates,
            classInfluence,
            totalInfluence,
            birthAccumulator,
            stability,
            rulingCoalition, // 执政联盟成员
            legitimacy, // 当前合法性值
            difficulty, // 游戏难度
            officials,
            // [FIX] 添加内阁机制所需的状态
            activeDecrees, // 当前生效的改革法令
            expansionSettings, // 自由市场扩张设置
            quotaTargets, // 计划经济目标配额
            officialCapacity, // 官员容量
            priceControls, // [NEW] 计划经济价格管制设置
            foreignInvestments, // [NEW] 海外投资
        };
    }, [resources, market, buildings, buildingUpgrades, population, popStructure, maxPopBonus, epoch, techsUnlocked, decrees, gameSpeed, nations, classWealth, livingStandardStreaks, migrationCooldowns, taxShock, army, militaryQueue, jobFill, jobsAvailable, activeBuffs, activeDebuffs, taxPolicies, classWealthHistory, classNeedsHistory, militaryWageRatio, classApproval, daysElapsed, activeFestivalEffects, lastFestivalYear, isPaused, autoSaveInterval, isAutoSaveEnabled, lastAutoSaveTime, merchantState, tradeRoutes, diplomacyOrganizations, tradeStats, actions, actionCooldowns, actionUsage, promiseTasks, activeEventEffects, eventEffectSettings, rebellionStates, classInfluence, totalInfluence, birthAccumulator, stability, rulingCoalition, legitimacy, difficulty, officials, activeDecrees, expansionSettings, quotaTargets, officialCapacity, priceControls, foreignInvestments]);

    // 监听国家列表变化，自动清理无效的贸易路线（修复暂停状态下无法清理的问题）
    useEffect(() => {
        if (!tradeRoutes?.routes?.length) return;
        if (!nations) return;

        const validNationIds = new Set(nations.map(n => n.id));
        const validRoutes = tradeRoutes.routes.filter(r => validNationIds.has(r.nationId));

        if (validRoutes.length !== tradeRoutes.routes.length) {
            setTradeRoutes(prev => ({
                ...prev,
                routes: validRoutes
            }));
        }
    }, [nations, tradeRoutes, setTradeRoutes]);

    // 游戏核心循环
    useEffect(() => {
        // 初始化作弊码系统
        if (process.env.NODE_ENV !== 'production') {
            initCheatCodes(gameState, addLog);
        }

        // 暂停时不设置游戏循环定时器，但自动保存定时器需要单独处理
        if (isPaused) {
            // 设置独立的自动保存定时器（每60秒检查一次）
            const autoSaveTimer = setInterval(() => {
                const current = stateRef.current;
                if (current.isAutoSaveEnabled) {
                    const intervalSeconds = Math.max(60, current.autoSaveInterval || 60);
                    const elapsed = Date.now() - (current.lastAutoSaveTime || 0);
                    if (elapsed >= intervalSeconds * 1000 && saveGameRef.current) {
                        saveGameRef.current({ source: 'auto' });
                        stateRef.current.lastAutoSaveTime = Date.now();
                    }
                }
            }, 60000);

            return () => clearInterval(autoSaveTimer);
        }

        // 计算 Tick 间隔：基于游戏速度动态调整
        // 1倍速 = 1000ms，2倍速 = 500ms，5倍速 = 200ms
        const tickInterval = 1000 / Math.max(1, gameSpeed);

        const timer = setInterval(() => {
            const current = stateRef.current;

            // 自动存档检测：即使暂停也照常运行，避免长时间停留丢进度
            if (current.isAutoSaveEnabled) {
                const intervalSeconds = Math.max(60, current.autoSaveInterval || 60);
                const elapsed = Date.now() - (current.lastAutoSaveTime || 0);
                if (elapsed >= intervalSeconds * 1000 && saveGameRef.current) {
                    saveGameRef.current({ source: 'auto' });
                    stateRef.current.lastAutoSaveTime = Date.now();
                }
            }

            // 检查是否需要触发年度庆典
            // 修复：检测年份变化而非特定日期，避免加速模式下跳过触发点
            const currentCalendar = getCalendarInfo(current.daysElapsed || 0);
            // 注意：这里使用 1 而非 current.gameSpeed，因为现在每次 Tick 只推进 1 天
            const nextCalendar = getCalendarInfo((current.daysElapsed || 0) + 1);

            // 如果当前年份大于上次庆典年份，且即将跨越或已经跨越新年
            if (currentCalendar.year > (current.lastFestivalYear || 0)) {
                // 新的一年开始，触发庆典
                const festivalOptions = getRandomFestivalEffects(current.epoch);
                if (festivalOptions.length > 0) {
                    setFestivalModal({
                        options: festivalOptions,
                        year: currentCalendar.year
                    });
                    setLastFestivalYear(currentCalendar.year);
                    setIsPaused(true);
                }
            }

            // check activeFestivalEffects expiration
            const currentFestivalEffects = current.activeFestivalEffects || [];
            if (currentFestivalEffects.length > 0) {
                const currentDay = current.daysElapsed || 0;
                let hasChange = false;

                const remainingEffects = currentFestivalEffects.filter(effect => {
                    if (effect.type === 'permanent') return true;

                    const duration = effect.duration || 360;
                    const activatedAt = effect.activatedAt !== undefined ? effect.activatedAt : currentDay;
                    const elapsed = currentDay - activatedAt;

                    if (elapsed >= duration) {
                        hasChange = true;
                        addLog(`庆典「${effect.name}」的影响已消退。`);
                        return false;
                    }
                    return true;
                });

                if (hasChange) {
                    setActiveFestivalEffects(remainingEffects);
                    // Update local reference so current tick uses correct effects
                    current.activeFestivalEffects = remainingEffects;
                }
            }

            // [NEW] 处理法令过期
            const currentActiveDecrees = current.activeDecrees || {};
            if (Object.keys(currentActiveDecrees).length > 0) {
                const currentDay = current.daysElapsed || 0;
                const { updatedDecrees, expiredDecrees } = processDecreeExpiry(currentActiveDecrees, currentDay);

                if (expiredDecrees.length > 0) {
                    // 更新法令状态
                    setActiveDecrees(updatedDecrees);
                    // 更新本地引用以确保当前tick使用正确的法令状态
                    current.activeDecrees = updatedDecrees;
                    stateRef.current.activeDecrees = updatedDecrees;

                    // 记录过期法令日志
                    expiredDecrees.forEach(decreeId => {
                        const decree = getAllTimedDecrees()[decreeId];
                        const decreeName = decree?.name || decreeId;
                        addLog(`法令「${decreeName}」已到期结束。`);
                    });
                }
            }

            // 执行游戏模拟
            // 【关键】强制将 gameSpeed 设为 1，确保单次 Tick 只计算 1 个单位时间的产出
            // 原因：我们已经通过调整 setInterval 的频率来实现加速（时间流）
            // 如果这里不归一化，simulateTick 内部会再次乘以 gameSpeed，导致倍率叠加
            // 例如：5倍速时，频率已经是 5 倍（200ms/次），如果再传 gameSpeed=5，
            // 实际速度会变成 25 倍（5×5），这是错误的
            const {
                approvalModifiers,
                stabilityModifier,
                resourceDemandModifiers,
                stratumDemandModifiers,
                buildingProductionModifiers,
                nextEffects
            } = processTimedEventEffects(
                current.activeEventEffects,
                current.eventEffectSettings,
            );

            // 官员薪水计算
            const officialDailySalary = calculateTotalDailySalary(current.officials || []);
            const canAffordOfficials = (current.resources?.silver || 0) >= officialDailySalary;

            // Process trade routes before simulation so their tax revenue is applied inside the worker.
            let tradeRouteSummary = null;
            if (current.tradeRoutes && current.tradeRoutes.routes && current.tradeRoutes.routes.length > 0) {
                tradeRouteSummary = processTradeRoutes(current);
            }
            const tradeRouteTax = tradeRouteSummary?.tradeTax || 0;
            const tradeRouteResourceDelta = tradeRouteSummary?.resourceDelta || {};
            setTradeStats(prev => ({ ...prev, tradeRouteTax }));

            // Build simulation parameters - 手动列出可序列化字段，排除函数对象（如 actions）
            // 这样可以正确启用 Web Worker 加速，避免 DataCloneError
            const simulationParams = {
                // 基础游戏数据
                resources: applyResourceDeltaToSnapshot(current.resources, tradeRouteResourceDelta),
                market: current.market,
                buildings: current.buildings,
                buildingUpgrades: current.buildingUpgrades,
                population: current.population,
                popStructure: current.popStructure,
                birthAccumulator: current.birthAccumulator,
                maxPopBonus: current.maxPopBonus,
                epoch: current.epoch,
                techsUnlocked: current.techsUnlocked,
                decrees: current.decrees,
                nations: current.nations,
                diplomacyOrganizations: current.diplomacyOrganizations,
                classWealth: current.classWealth,
                classApproval: current.classApproval,
                classInfluence: current.classInfluence,
                totalInfluence: current.totalInfluence,
                stability: current.stability,

                // 军事相关
                army: current.army,
                militaryQueue: current.militaryQueue,
                militaryWageRatio: current.militaryWageRatio,
                autoRecruitEnabled: current.autoRecruitEnabled,
                targetArmyComposition: current.targetArmyComposition,

                // 工作和经济
                jobFill: current.jobFill,
                jobsAvailable: current.jobsAvailable,

                // 内阁协同与自由市场
                // [FIX] 使用与 UI 相同的容量计算逻辑：
                // Math.min(jobsAvailable.official, officialCapacity)
                // 这确保主导判定与 UI 显示一致
                cabinetStatus: (() => {
                    // 与 App.jsx Line 1130 保持一致的计算逻辑
                    // 使用 hook 作用域中的 jobsAvailable（而非 current.jobsAvailable）
                    const jobCapacity = jobsAvailable?.official || 0;
                    const maxCapacity = current.officialCapacity ?? officialCapacity ?? 2;
                    const effectiveCapacity = Math.min(
                        jobCapacity > 0 ? jobCapacity : maxCapacity,
                        maxCapacity
                    );
                    const status = getCabinetStatus(
                        current.officials || [],
                        current.activeDecrees || {},
                        effectiveCapacity,
                        current.epoch || 0
                    );
                    // [DEBUG] 主线程检查
                    console.log('[MAIN THREAD PRE-WORKER] cabinetStatus:', {
                        hasDominance: !!status?.dominance,
                        dominanceFaction: status?.dominance?.faction,
                        capacity: effectiveCapacity,
                        jobCapacity,
                        maxCapacity,
                        officialCount: current.officials?.length,
                    });
                    return status;
                })(),
                quotaTargets: current.quotaTargets,
                expansionSettings: current.expansionSettings,
                priceControls: current.priceControls, // [NEW] 价格管制设置
                taxPolicies: current.taxPolicies || {},
                livingStandardStreaks: current.livingStandardStreaks,
                migrationCooldowns: current.migrationCooldowns,
                previousTaxShock: current.taxShock, // [NEW] 累积税收冲击历史

                // 贸易
                merchantState: current.merchantState,
                tradeRoutes: current.tradeRoutes,
                tradeStats: current.tradeStats,
                tradeRouteTax,

                // Buff/Debuff
                activeBuffs: current.activeBuffs,
                activeDebuffs: current.activeDebuffs,

                // 历史数据
                classWealthHistory: current.classWealthHistory,
                classNeedsHistory: current.classNeedsHistory,

                // 时间和节日
                daysElapsed: current.daysElapsed,
                activeFestivalEffects: current.activeFestivalEffects || [],
                lastFestivalYear: current.lastFestivalYear,

                // 行动冷却
                actionCooldowns: current.actionCooldowns,
                actionUsage: current.actionUsage,
                promiseTasks: current.promiseTasks,

                // 事件效果
                activeEventEffects: current.activeEventEffects,
                eventEffectSettings: current.eventEffectSettings,

                // 叛乱系统
                rebellionStates: current.rebellionStates,

                // 执政联盟
                rulingCoalition: current.rulingCoalition,
                legitimacy: current.legitimacy,

                // 难度
                difficulty: current.difficulty,

                // 游戏速度（强制归一化）
                gameSpeed: 1,
                tick: current.daysElapsed || 0,

                // 事件修正器
                eventApprovalModifiers: approvalModifiers,
                eventStabilityModifier: stabilityModifier,
                currentStability: current.stability ?? 50,
                eventResourceDemandModifiers: resourceDemandModifiers,
                eventStratumDemandModifiers: stratumDemandModifiers,
                eventBuildingProductionModifiers: buildingProductionModifiers,
                previousLegitimacy: current.legitimacy ?? 0,

                // 官员系统
                officials: current.officials || [],
                officialsPaid: canAffordOfficials,
                foreignInvestments: current.foreignInvestments || [], // [NEW] Pass foreign investments to worker
            };

            // Execute simulation
            // Phase 2: Use async Worker execution for better performance on low-end devices
            // The runSimulation function handles Worker availability check and fallback
            runSimulation(simulationParams).then(result => {
                if (!result || result.__skipped) {
                    if (!result) {
                        console.error('[GameLoop] Simulation returned null result');
                    }
                    return;
                }

                // 以下是处理模拟结果的代码，包装在 then 回调中

                // 更新 Modifiers 状态供 UI 显示
                setModifiers(result.modifiers || {});

                const soldierPopulationAfterEvents = Number.isFinite(result.popStructure?.soldier)
                    ? result.popStructure.soldier
                    : null;
                // [FIX] 使用战斗后的军队状态，而非战斗前的 current.army
                let armyStateForQueue = result.army || current.army || {};
                let queueOverrideForManpower = null;

                if (soldierPopulationAfterEvents !== null) {
                    const manpowerSync = syncArmyWithSoldierPopulation(
                        armyStateForQueue,
                        current.militaryQueue || [],
                        soldierPopulationAfterEvents,
                        current.autoRecruitEnabled || false  // [NEW] 传入自动补兵开关状态
                    );

                    if (manpowerSync.updatedArmy) {
                        armyStateForQueue = manpowerSync.updatedArmy;
                        setArmy(manpowerSync.updatedArmy);
                    }

                    if (manpowerSync.updatedQueue) {
                        queueOverrideForManpower = manpowerSync.updatedQueue;
                    }

                    // [NEW] 处理需要重新排队的单位（关闭自动补兵时）
                    if (manpowerSync.unitsToRequeue && Object.keys(manpowerSync.unitsToRequeue).length > 0) {
                        const requeueItems = [];
                        Object.entries(manpowerSync.unitsToRequeue).forEach(([unitId, data]) => {
                            for (let i = 0; i < data.count; i++) {
                                requeueItems.push({
                                    unitId,
                                    status: 'waiting',
                                    totalTime: data.trainingTime,
                                    remainingTime: data.trainingTime,
                                    isRequeued: true, // 标记为重新排队
                                });
                            }
                        });
                        if (requeueItems.length > 0) {
                            setMilitaryQueue(prev => [...(queueOverrideForManpower || prev), ...requeueItems]);
                            queueOverrideForManpower = null; // 已处理，清空覆盖
                            const summary = formatUnitSummary(manpowerSync.removedUnits);
                            if (summary) {
                                addLog(`⚠️ 军人人口不足，以下部队暂时解散并重新排入训练队列：${summary}`);
                            }
                        }
                    } else if (manpowerSync.removedUnits) {
                        // [FIX] 关闭自动补兵时，直接解散
                        const summary = formatUnitSummary(manpowerSync.removedUnits);
                        if (summary) {
                            addLog(`⚠️ 军人阶级人口骤减，以下部队被迫解散：${summary}`);
                        }
                    }

                    if (manpowerSync.cancelledTraining) {
                        const summary = formatUnitSummary(manpowerSync.cancelledTraining);
                        if (summary) {
                            addLog(`⚠️ 士兵伤亡导致训练中断，以下单位重新排入招募：${summary}`);
                        }
                    }
                }

                const hadActiveEffects =
                    (current.activeEventEffects?.approval?.length || 0) > 0 ||
                    (current.activeEventEffects?.stability?.length || 0) > 0 ||
                    (current.activeEventEffects?.resourceDemand?.length || 0) > 0 ||
                    (current.activeEventEffects?.stratumDemand?.length || 0) > 0 ||
                    (current.activeEventEffects?.buildingProduction?.length || 0) > 0;

                const maintenance = calculateArmyMaintenance(army);
                const adjustedResources = { ...result.resources };
                const resourceShortages = {}; // 记录资源短缺
                Object.entries(maintenance).forEach(([resource, cost]) => {
                    // 每次 Tick 计算 1 天的维护费用（不再乘以 gameSpeed）
                    const amount = cost;
                    if (amount <= 0) return;
                    const available = adjustedResources[resource] || 0;
                    const shortage = Math.max(0, amount - available);
                    if (shortage > 0) {
                        resourceShortages[resource] = shortage;
                    }
                    adjustedResources[resource] = Math.max(0, available - amount);
                });

                // --- Realized fiscal tracking (must match visible treasury changes) ---
                // We must baseline against the treasury BEFORE this tick starts (current.resources.silver).
                // Otherwise we would only measure extra deductions done in this hook, not the full tick delta.
                const treasuryAtTickStart = Number(current.resources?.silver || 0);
                let officialSalaryPaid = 0;
                let forcedSubsidyPaid = 0;
                let forcedSubsidyUnpaid = 0;

                // 扣除官员薪水（实付：最多扣到0）
                if (officialDailySalary > 0) {
                    const before = Number(adjustedResources.silver || 0);
                    const pay = Math.min(officialDailySalary, before);
                    adjustedResources.silver = before - pay;
                    officialSalaryPaid = pay;
                }

                // 处理强制补贴效果（每日从国库支付给指定阶层）
                const forcedSubsidies = Array.isArray(current.activeEventEffects?.forcedSubsidy)
                    ? current.activeEventEffects.forcedSubsidy
                    : [];

                // 计算补贴对各阶层财富的增加量（稍后合并到 adjustedClassWealth）
                const subsidyWealthDelta = {};
                if (forcedSubsidies.length > 0) {
                    forcedSubsidies.forEach(subsidy => {
                        if (subsidy.remainingDays > 0) {
                            const dailyAmount = subsidy.dailyAmount || 0;
                            const stratumKey = subsidy.stratumKey;

                            // 从国库扣除（实付：受国库余额约束）
                            const treasuryBefore = Number(adjustedResources.silver || 0);
                            const actualPayment = Math.min(dailyAmount, treasuryBefore);
                            adjustedResources.silver = treasuryBefore - actualPayment;

                            forcedSubsidyPaid += actualPayment;
                            forcedSubsidyUnpaid += Math.max(0, dailyAmount - actualPayment);

                            // 记录阶层财富增加量
                            if (stratumKey && actualPayment > 0) {
                                subsidyWealthDelta[stratumKey] = (subsidyWealthDelta[stratumKey] || 0) + actualPayment;
                            }
                        }
                    });
                    // forcedSubsidy 的天数递减和过期清理在下面统一处理
                }

                // Save realized fiscal data for UI
                if (typeof setFiscalActual === 'function') {
                    const treasuryAfterDeductions = Number(adjustedResources.silver || 0);
                    setFiscalActual({
                        // True treasury delta for the whole tick (what the player sees on the silver number)
                        silverDelta: treasuryAfterDeductions - treasuryAtTickStart,
                        officialSalaryPaid,
                        forcedSubsidyPaid,
                        forcedSubsidyUnpaid,
                    });
                }

                // === 详细财政日志 ===
                // 记录所有影响国库的收入和支出项
                const treasuryAfterDeductions = Number(adjustedResources.silver || 0);
                const netTreasuryChange = treasuryAfterDeductions - treasuryAtTickStart;

                console.group('💰 [财政详情] Tick ' + (current.daysElapsed || 0));
                console.log('🏦 国库起始余额:', treasuryAtTickStart.toFixed(2), '银币');

                // 从simulation返回的税收数据
                const taxes = result.taxes || {};
                const breakdown = taxes.breakdown || {};

                console.group('📈 收入项');
                console.log('  人头税:', (breakdown.headTax || 0).toFixed(2));
                console.log('  交易税:', (breakdown.industryTax || 0).toFixed(2));
                console.log('  营业税:', (breakdown.businessTax || 0).toFixed(2));
                console.log('  关税:', (breakdown.tariff || 0).toFixed(2));
                if (breakdown.warIndemnity) console.log('  战争赔款收入:', breakdown.warIndemnity.toFixed(2));
                if (breakdown.tradeRouteTax) console.log('  贸易路线税收:', breakdown.tradeRouteTax.toFixed(2));
                if (breakdown.policyIncome) console.log('  政令收益:', breakdown.policyIncome.toFixed(2));
                if (breakdown.priceControlIncome) console.log('  价格管制收入:', breakdown.priceControlIncome.toFixed(2));
                const effectiveFiscalIncome = typeof breakdown.totalFiscalIncome === 'number'
                    ? breakdown.totalFiscalIncome
                    : (breakdown.headTax || 0) + (breakdown.industryTax || 0) +
                    (breakdown.businessTax || 0) + (breakdown.tariff || 0) +
                    (breakdown.warIndemnity || 0);
                const totalIncome = effectiveFiscalIncome + (breakdown.priceControlIncome || 0) +
                    (breakdown.tradeRouteTax || 0);
                console.log('  ✅ 总收入:', totalIncome.toFixed(2));
                if (typeof breakdown.incomePercentMultiplier === 'number') {
                    console.log('  📌 收入加成倍率:', `×${breakdown.incomePercentMultiplier.toFixed(2)}`);
                }
                if (taxes.efficiency && taxes.efficiency < 1) {
                    console.log('  📊 税收效率:', (taxes.efficiency * 100).toFixed(1) + '%',
                        `(损失: ${(totalIncome * (1 - taxes.efficiency)).toFixed(2)} 银币)`);
                }
                console.groupEnd();

                console.group('📉 支出项');

                // === 军队支出（使用simulation返回的真实数据）===
                // 注意：simulation.js中已经处理了资源购买、时代加成、规模惩罚、军饷倍率
                const simulationArmyCost = result.dailyMilitaryExpense?.dailyExpense || 0;

                if (simulationArmyCost > 0) {
                    console.group('  军队维护（simulation计算）');
                    if (result.dailyMilitaryExpense) {
                        const armyData = result.dailyMilitaryExpense;
                        console.log(`    基础资源成本: ${(armyData.resourceCost || 0).toFixed(2)} 银币`);
                        console.log(`    时代系数: ×${(armyData.epochMultiplier || 1).toFixed(2)}`);
                        console.log(`    规模惩罚: ×${(armyData.scalePenalty || 1).toFixed(2)}`);
                        console.log(`    军饷倍率: ×${(armyData.wageMultiplier || 1).toFixed(2)}`);
                        console.log(`    💰 实际支出: ${simulationArmyCost.toFixed(2)} 银币`);

                        // 显示资源消耗明细
                        if (armyData.resourceConsumption && Object.keys(armyData.resourceConsumption).length > 0) {
                            console.log(`    消耗资源:`, armyData.resourceConsumption);
                        }
                    } else {
                        console.log(`    💰 总支出: ${simulationArmyCost.toFixed(2)} 银币`);
                    }
                    console.groupEnd();
                }

                // 保留useGameLoop中的军队维护计算（仅用于对比，标记为"本地计算"）
                if (false) { // 禁用旧的统计方式
                    const maintenanceResources = {};
                    let totalMaintenanceSilverValue = 0;
                    Object.entries(maintenance || {}).forEach(([resource, cost]) => {
                        if (cost > 0) {
                            maintenanceResources[resource] = cost;
                            if (resource === 'silver') {
                                totalMaintenanceSilverValue += cost;
                            } else {
                                const price = result.market?.prices?.[resource] || 1;
                                const silverValue = cost * price;
                                totalMaintenanceSilverValue += silverValue;
                            }
                        }
                    });

                    if (Object.keys(maintenanceResources).length > 0) {
                        console.group('  军队维护（本地计算 - 仅供参考）');
                        Object.entries(maintenanceResources).forEach(([resource, cost]) => {
                            if (resource === 'silver') {
                                console.log(`    ${resource}: ${cost.toFixed(2)}`);
                            } else {
                                const price = result.market?.prices?.[resource] || 1;
                                const silverValue = cost * price;
                                console.log(`    ${resource}: ${cost.toFixed(2)} (价值 ${silverValue.toFixed(2)} 银币)`);
                            }
                        });
                        console.log(`    💰 总价值: ${totalMaintenanceSilverValue.toFixed(2)} 银币`);
                        console.groupEnd();
                    }
                }

                if (breakdown.subsidy) console.log('  税收补贴:', breakdown.subsidy.toFixed(2));
                if (breakdown.tariffSubsidy) console.log('  关税补贴:', breakdown.tariffSubsidy.toFixed(2));
                if (officialSalaryPaid > 0) console.log('  官员薪俸:', officialSalaryPaid.toFixed(2));
                if (forcedSubsidyPaid > 0) console.log('  强制补贴:', forcedSubsidyPaid.toFixed(2));
                if (breakdown.policyExpense) console.log('  政令支出:', breakdown.policyExpense.toFixed(2));
                if (breakdown.priceControlExpense) console.log('  价格管制支出:', breakdown.priceControlExpense.toFixed(2));

                // 资源短缺警告（暂时保留用于调试）
                if (Object.keys(resourceShortages).length > 0) {
                    console.group('  ⚠️ 资源短缺（军队维护需求未满足）');
                    let totalShortageValue = 0;
                    Object.entries(resourceShortages).forEach(([resource, shortage]) => {
                        const price = result.market?.prices?.[resource] || 1;
                        const silverValue = shortage * price;
                        totalShortageValue += silverValue;
                        console.log(`    ${resource}: 短缺 ${shortage.toFixed(2)}，等价 ${silverValue.toFixed(2)} 银币`);
                    });
                    console.log(`    💸 短缺总价值: ${totalShortageValue.toFixed(2)} 银币`);
                    console.warn(`    ℹ️ 注意：这些资源短缺可能导致隐藏的银币支出！`);
                    console.groupEnd();
                }

                const totalExpense = simulationArmyCost + (breakdown.subsidy || 0) +
                    (breakdown.tariffSubsidy || 0) + officialSalaryPaid + forcedSubsidyPaid +
                    (breakdown.policyExpense || 0) + (breakdown.priceControlExpense || 0);
                console.log('  ❌ 总支出:', totalExpense.toFixed(2));
                console.groupEnd();

                console.log('📊 理论净变化:', (totalIncome - totalExpense).toFixed(2), '银币/天');
                console.log('🏦 国库结束余额:', treasuryAfterDeductions.toFixed(2), '银币');
                console.log('💵 实际净变化:', netTreasuryChange.toFixed(2), '银币');

                // === 显示simulation中的银币变化追踪 ===
                // if (result._debug?.silverChangeLog && result._debug.silverChangeLog.length > 0) {
                //     console.group('🔍 银币变化详细追踪（simulation内部）');
                //     console.log('  起始余额:', (result._debug.startingSilver || 0).toFixed(2), '银币');
                //     result._debug.silverChangeLog.forEach((log, index) => {
                //         const sign = log.amount >= 0 ? '+' : '';
                //         console.log(`  ${index + 1}. ${log.reason}: ${sign}${log.amount.toFixed(2)} 银币 (余额: ${log.balance.toFixed(2)})`);
                //     });
                //     console.log('  结束余额:', (result._debug.endingSilver || 0).toFixed(2), '银币');
                //     const simulationChange = (result._debug.endingSilver || 0) - (result._debug.startingSilver || 0);
                //     console.log('  💰 Simulation净变化:', simulationChange.toFixed(2), '银币');
                //     console.groupEnd();
                // }

                // === useGameLoop本地扣除（simulation之后）===
                const useGameLoopDeductions = [];
                const armyMaintenanceSilver = Object.entries(maintenance || {})
                    .filter(([res]) => res === 'silver')
                    .reduce((sum, [, cost]) => sum + cost, 0);
                if (armyMaintenanceSilver > 0) {
                    useGameLoopDeductions.push({ reason: '军队维护(本地)', amount: -armyMaintenanceSilver });
                }
                if (officialSalaryPaid > 0) {
                    useGameLoopDeductions.push({ reason: '官员薪俸', amount: -officialSalaryPaid });
                }
                if (forcedSubsidyPaid > 0) {
                    useGameLoopDeductions.push({ reason: '强制补贴', amount: -forcedSubsidyPaid });
                }

                if (useGameLoopDeductions.length > 0) {
                    console.group('🔧 useGameLoop本地扣除（simulation之后）');
                    useGameLoopDeductions.forEach((item, index) => {
                        const sign = item.amount >= 0 ? '+' : '';
                        console.log(`  ${index + 1}. ${item.reason}: ${sign}${item.amount.toFixed(2)} 银币`);
                    });
                    const totalLocalDeduction = useGameLoopDeductions.reduce((sum, item) => sum + item.amount, 0);
                    console.log('  💰 本地扣除总计:', totalLocalDeduction.toFixed(2), '银币');
                    console.groupEnd();
                }

                if (Math.abs(netTreasuryChange - (totalIncome - totalExpense)) > 0.1) {
                    console.warn('⚠️ 警告：理论净变化与实际净变化不一致！差异:',
                        (netTreasuryChange - (totalIncome - totalExpense)).toFixed(2));
                }

                console.groupEnd();
                // === 财政日志结束 ===

                setResources(adjustedResources);

                // 处理强制补贴效果的每日更新
                // 注意：这里只处理 forcedSubsidy 的递减和过期，不处理其他效果的更新
                // 其他效果（approval, stability等）由 simulation.js 中的 applyActiveEventEffects 处理
                if (forcedSubsidies.length > 0) {
                    setActiveEventEffects(prev => {
                        // 只更新 forcedSubsidy，保留其他所有效果不变
                        const updatedSubsidies = forcedSubsidies
                            .map(s => ({ ...s, remainingDays: s.remainingDays - 1 }))
                            .filter(s => s.remainingDays > 0);

                        debugLog('gameLoop', '[GAME LOOP] Updating subsidies:', forcedSubsidies.length, '->', updatedSubsidies.length);

                        return {
                            ...prev,
                            forcedSubsidy: updatedSubsidies
                        };
                    });
                }

                // 创建阶层财富对象，合并补贴转账
                let adjustedClassWealth = { ...result.classWealth };
                // 将补贴增量添加到阶层财富
                Object.entries(subsidyWealthDelta).forEach(([key, delta]) => {
                    adjustedClassWealth[key] = (adjustedClassWealth[key] || 0) + delta;
                });
                let adjustedTotalWealth = Object.values(adjustedClassWealth).reduce((sum, val) => sum + val, 0);

                // ========== 海外投资每日结算 ==========
                // ========== 海外投资每日结算 ==========
                if ((overseasInvestmentsRef.current && overseasInvestmentsRef.current.length > 0) || (current.foreignInvestments && current.foreignInvestments.length > 0)) {
                    import('../logic/diplomacy/overseasInvestment').then(({ processOverseasInvestments, processForeignInvestments }) => {
                        // 1. 处理我方在外投资
                        if (overseasInvestmentsRef.current && overseasInvestmentsRef.current.length > 0) {
                            const investmentResult = processOverseasInvestments({
                                overseasInvestments: overseasInvestmentsRef.current,
                                nations: current.nations || [],
                                resources: current.resources || {},
                                marketPrices: current.market?.prices || {},
                                classWealth: adjustedClassWealth,
                                daysElapsed: current.daysElapsed || 0,
                            });

                            // 更新海外投资状态
                            if (investmentResult.updatedInvestments) {
                                setOverseasInvestments(prev => {
                                    const updatedMap = new Map(investmentResult.updatedInvestments.map(i => [i.id, i]));
                                    return prev.map(item => {
                                        const updated = updatedMap.get(item.id);
                                        if (!updated) return item;
                                        // Preserve user-configurable fields from the latest state
                                        // to prevent the simulation snapshot from overwriting recent UI changes
                                        return {
                                            ...updated,
                                            inputSource: item.inputSource, // Keep latest user config
                                            outputDest: item.outputDest,   // Keep latest user config
                                        };
                                    });
                                });
                            }

                            // 将利润汇入各阶层财富
                            if (investmentResult.profitByStratum && Object.keys(investmentResult.profitByStratum).length > 0) {
                                gameState.setClassWealth(prev => {
                                    const updated = { ...prev };
                                    Object.entries(investmentResult.profitByStratum).forEach(([stratum, profit]) => {
                                        updated[stratum] = (updated[stratum] || 0) + profit;
                                    });
                                    return updated;
                                });

                                // [NEW] 同时更新详细财务数据用于UI显示
                                setClassFinancialData(prev => {
                                    const updated = { ...prev };
                                    Object.entries(investmentResult.profitByStratum).forEach(([stratum, profit]) => {
                                        // 浅拷贝该阶层的数据以确保不可变性
                                        updated[stratum] = {
                                            ...(updated[stratum] || {}),
                                            income: { ...(updated[stratum]?.income || {}) }
                                        };

                                        // 计入经营营收 (ownerRevenue)
                                        updated[stratum].income.ownerRevenue = (updated[stratum].income.ownerRevenue || 0) + profit;
                                    });
                                    return updated;
                                });
                            }

                            // 输出日志
                            if (investmentResult.logs && investmentResult.logs.length > 0) {
                                investmentResult.logs.forEach(log => addLog(log));
                            }

                            // [NEW] 应用市场资源变更
                            if (investmentResult.marketChanges && Object.keys(investmentResult.marketChanges).length > 0) {
                                setNations(prevNations => {
                                    return prevNations.map(nation => {
                                        const changes = investmentResult.marketChanges[nation.id];
                                        if (!changes) return nation;

                                        const nextInventories = { ...(nation.inventories || {}) };
                                        Object.entries(changes).forEach(([res, delta]) => {
                                            nextInventories[res] = Math.max(0, (nextInventories[res] || 0) + delta);
                                        });

                                        return {
                                            ...nation,
                                            inventories: nextInventories,
                                        };
                                    });
                                });
                            }

                            // [NEW] 应用玩家资源变更（本国消耗/回购产出）
                            if (investmentResult.playerInventoryChanges && Object.keys(investmentResult.playerInventoryChanges).length > 0) {
                                setResources(prevResources => {
                                    const nextResources = { ...prevResources };
                                    Object.entries(investmentResult.playerInventoryChanges).forEach(([res, delta]) => {
                                        nextResources[res] = Math.max(0, (nextResources[res] || 0) + delta);
                                    });
                                    return nextResources;
                                });
                            }
                        }

                        // 2. 处理外国在华投资 (Phase 2 Add)
                        if (current.foreignInvestments && current.foreignInvestments.length > 0) {
                            const fiResult = processForeignInvestments({
                                foreignInvestments: current.foreignInvestments,
                                foreignInvestmentPolicy: current.foreignInvestmentPolicy || 'normal',
                                playerMarket: adjustedMarket, // 使用更新后的市场数据
                                playerResources: current.resources, // 使用当前资源
                                taxPolicies: current.taxPolicies || {},
                                daysElapsed: current.daysElapsed || 0,
                            });

                            // 更新外资状态
                            if (fiResult.updatedInvestments) {
                                setForeignInvestments(prev => {
                                    const updatedMap = new Map(fiResult.updatedInvestments.map(i => [i.id, i]));
                                    return prev.map(item => updatedMap.get(item.id) || item);
                                });
                            }

                            // 应用税收收益
                            if (fiResult.totalTaxRevenue > 0) {
                                setResources(prev => ({
                                    ...prev,
                                    silver: (prev.silver || 0) + fiResult.totalTaxRevenue
                                }));
                                // 记录日志（可选，为了不刷屏可以合并）
                                // addLog(`收到外资企业税收: ${fiResult.totalTaxRevenue.toFixed(1)} 银币`);
                            }

                            // 日志
                            if (fiResult.logs && fiResult.logs.length > 0) {
                                fiResult.logs.forEach(log => addLog(log));
                            }
                            // 日志
                            if (fiResult.logs && fiResult.logs.length > 0) {
                                fiResult.logs.forEach(log => addLog(log));
                            }
                        }

                // 3. 自主投资逻辑 (5% probability daily)
                        const autoInvestRoll = Math.random();
                        console.log(`🤖 [AUTO-INVEST] 自动投资检查: roll=${autoInvestRoll.toFixed(3)}, threshold=0.05, trigger=${autoInvestRoll < 0.05}`);
                        if (autoInvestRoll < 0.05) {
                            console.log(`🤖 [AUTO-INVEST] 触发自动投资逻辑...`);
                            import('../logic/diplomacy/autonomousInvestment').then(({ processClassAutonomousInvestment }) => {
                                const result = processClassAutonomousInvestment({
                                    nations: current.nations || [],
                                    playerNation: current.nations.find(n => n.id === 'player'),
                                    diplomacyOrganizations: current.diplomacyOrganizations,
                                    overseasInvestments: overseasInvestmentsRef.current,
                                    classWealth: adjustedClassWealth,
                                    market: adjustedMarket,
                                    epoch: current.epoch,
                                    daysElapsed: current.daysElapsed
                                });

                                if (result && result.success) {
                                    const { stratum, targetNation, building, cost, dailyProfit, action } = result;

                                    // Execute Investment
                                    const newInvestment = action();
                                    if (newInvestment) {
                                        // Deduct Wealth
                                        setClassWealth(prev => ({
                                            ...prev,
                                            [stratum]: Math.max(0, (prev[stratum] || 0) - cost)
                                        }));

                                        // Add Investment
                                        setOverseasInvestments(prev => [...prev, newInvestment]);

                                        // Log
                                        const stratumName = STRATA[stratum]?.name || stratum;
                                        addLog(`💰 ${stratumName}发现在 ${targetNation.name} 投资 ${building.name} 有利可图（预计日利 ${dailyProfit.toFixed(1)}），已自动注资 ${formatNumberShortCN(cost)}。`);
                                    }
                                }
                            }).catch(err => console.warn('Autonomous investment error:', err));
                        }

                    }).catch(err => {
                        console.error('Failed to process investments:', err);
                    });
                } else {
                    // Even if no existing investments, try autonomous investment if logic is imported
                    // But here we depend on the dynamic import block which was triggered by existing investments check
                    // We should probably move this out if we want it to happen even with 0 investments.
                    // However, to keep code compact and leverage the same import, let's keep it here 
                    // OR add a separate check roughly here.

                    // Let's add a separate check outside this block to ensure it runs even if no investments exist yet.
                }

                // Add separate autonomous investment check if not already running inside
                if (!((overseasInvestmentsRef.current && overseasInvestmentsRef.current.length > 0) || (current.foreignInvestments && current.foreignInvestments.length > 0)) && Math.random() < 0.05) {
                    import('../logic/diplomacy/overseasInvestment').then(() => {
                        import('../logic/diplomacy/autonomousInvestment').then(({ processClassAutonomousInvestment }) => {
                            const result = processClassAutonomousInvestment({
                                nations: current.nations || [],
                                playerNation: current.nations.find(n => n.id === 'player'),
                                diplomacyOrganizations: current.diplomacyOrganizations,
                                overseasInvestments: overseasInvestmentsRef.current || [],
                                classWealth: adjustedClassWealth,
                                market: adjustedMarket,
                                epoch: current.epoch,
                                daysElapsed: current.daysElapsed
                            });
                            if (result && result.success) {
                                const { stratum, targetNation, building, cost, dailyProfit, action } = result;
                                const newInvestment = action();
                                if (newInvestment) {
                                    setClassWealth(prev => ({ ...prev, [stratum]: Math.max(0, (prev[stratum] || 0) - cost) }));
                                    setOverseasInvestments(prev => [...prev, newInvestment]);
                                    const stratumName = STRATA[stratum]?.name || stratum;
                                    addLog(`💰 ${stratumName}发现在 ${targetNation.name} 投资 ${building.name} 有利可图（预计日利 ${dailyProfit.toFixed(1)}），已自动注资 ${formatNumberShortCN(cost)}。`);
                                }
                            }
                        });
                    });
                }

                // 4. AI Autonomous Investment (30% chance to check daily - increased for better gameplay)
                if (Math.random() < 0.3) {
                    import('../logic/diplomacy/autonomousInvestment').then(({ processAIInvestment }) => {
                        if (!processAIInvestment) return;

                        const potentialInvestors = (current.nations || []).filter(n => n.id !== 'player' && (n.wealth || 0) > 5000);

                        potentialInvestors.forEach(investor => {
                            const decision = processAIInvestment({
                                investorNation: investor,
                                nations: current.nations || [],
                                diplomacyOrganizations: current.diplomacyOrganizations, // [NEW] Pass organizations for treaty checks
                                playerState: {
                                    population: current.population,
                                    wealth: current.resources?.silver || 0,
                                    resources: current.resources,
                                    buildings: current.buildings, // [NEW] Pass buildings for existence check
                                    id: 'player'
                                },
                                market: adjustedMarket,
                                epoch: current.epoch,
                                daysElapsed: current.daysElapsed
                            });

                            if (decision && decision.type === 'request_investment' && decision.targetId === 'player') {
                                // 外资：直接投资，不需要玩家批准
                                const actionsRef = current.actions;

                                if (actionsRef && actionsRef.handleDiplomaticAction) {
                                    // 直接创建外资投资
                                    actionsRef.handleDiplomaticAction(investor.id, 'accept_foreign_investment', {
                                        buildingId: decision.building.id,
                                        ownerStratum: 'capitalist',
                                        operatingMode: 'local', // 默认当地运营模式
                                        investmentAmount: decision.cost
                                    });

                                    console.log(`[外资] ${investor.name} 在本地投资了 ${decision.building.name}，投资额: ${decision.cost}`);
                                    addLog(`🏦 ${investor.name} 在本地投资建造了 ${decision.building.name}。`);
                                } else {
                                    console.warn('[外资] handleDiplomaticAction 不可用');
                                }
                            }
                        });
                    }).catch(err => console.warn('AI investment error:', err));
                }

                // ========== 条约维护费每日扣除 ==========
                let totalTreatyMaintenance = 0;
                if (current.nations) {
                    current.nations.forEach(nation => {
                        if (nation.treaties) {
                            nation.treaties.forEach(treaty => {
                                // 检查条约是否生效
                                if ((!treaty.endDay || (current.daysElapsed || 0) < treaty.endDay)) {
                                    totalTreatyMaintenance += getTreatyDailyMaintenance(treaty.type);
                                }
                            });
                        }
                    });
                }
                if (totalTreatyMaintenance > 0) {
                    setResources(prev => ({
                        ...prev,
                        silver: Math.max(0, (prev.silver || 0) - totalTreatyMaintenance)
                    }));
                    // 记录一下，虽然不一定每次都log，避免刷屏
                    if (isDebugEnabled('diplomacy')) {
                        console.log(`[Diplomacy] Deducted ${totalTreatyMaintenance} silver for treaty maintenance.`);
                    }
                }

                // ========== 附庸每日更新（朝贡与独立倾向） ==========
                if (current.nations && current.nations.some(n => n.vassalOf === 'player')) {
                    const vassalLogs = [];

                    // Calculate player military strength from army
                    const totalArmyUnits = Object.values(current.army || {}).reduce((sum, count) => sum + count, 0);
                    const playerMilitaryStrength = Math.max(0.5, totalArmyUnits / 100);

                    const vassalUpdateResult = processVassalUpdates({
                        nations: current.nations,
                        daysElapsed: current.daysElapsed || 0,
                        epoch: current.epoch || 0,
                        playerMilitary: playerMilitaryStrength,
                        playerStability: result.stability || 50,
                        playerAtWar: current.nations.some(n => n.isAtWar && (n.warTarget === 'player' || n.id === 'player')),
                        playerWealth: adjustedResources.silver || 0,
                        officials: result.officials || [],  // Pass officials for governor system
                        logs: vassalLogs
                    });

                    if (vassalUpdateResult) {
                        // 更新国家列表（包含附庸状态变化）
                        if (vassalUpdateResult.nations) {
                            setNations(vassalUpdateResult.nations);
                        }

                        // 结算现金朝贡
                        if (vassalUpdateResult.tributeIncome > 0) {
                            setResources(prev => ({
                                ...prev,
                                silver: (prev.silver || 0) + vassalUpdateResult.tributeIncome
                            }));
                        }

                        // 结算资源朝贡
                        if (vassalUpdateResult.resourceTribute && Object.keys(vassalUpdateResult.resourceTribute).length > 0) {
                            setResources(prev => {
                                const nextRes = { ...prev };
                                Object.entries(vassalUpdateResult.resourceTribute).forEach(([res, amount]) => {
                                    nextRes[res] = (nextRes[res] || 0) + amount;
                                });
                                return nextRes;
                            });
                        }

                        // NEW: Deduct control costs from treasury
                        if (vassalUpdateResult.totalControlCost > 0) {
                            setResources(prev => ({
                                ...prev,
                                silver: Math.max(0, (prev.silver || 0) - vassalUpdateResult.totalControlCost)
                            }));
                            if (isDebugEnabled('diplomacy')) {
                                console.log(`[Vassal] Deducted ${vassalUpdateResult.totalControlCost} silver for control measures.`);
                            }
                        }

                        // 显示日志
                        if (vassalLogs.length > 0) {
                            vassalLogs.forEach(log => addLog(log));
                        }
                    }
                }

                // ========== 官僚政变检测（基于忠诚度系统） ==========
                let coupOutcome = null;
                const officialsList = result.officials || [];
                if (officialsList.length > 0 && current.actions?.triggerDiplomaticEvent) {
                    const influenceShare = (stratumKey) => {
                        const influence = result.classInfluence?.[stratumKey] || 0;
                        return (result.totalInfluence || 0) > 0 ? influence / result.totalInfluence : 0;
                    };

                    // 新的政变检测条件：基于忠诚度系统
                    const { COUP_THRESHOLD, COUP_DURATION_DAYS, COUP_WEALTH_THRESHOLD,
                        COUP_PROPERTY_THRESHOLD, COUP_INFLUENCE_THRESHOLD } = LOYALTY_CONFIG;

                    const candidates = officialsList
                        .filter(official => official && official.ownedProperties?.length)
                        .map(official => {
                            const propertyValue = official.ownedProperties.reduce((sum, prop) => sum + (prop.purchaseCost || 0), 0);
                            const wealthScore = (official.wealth || 0) + propertyValue;
                            const propertyCount = (official.ownedProperties || []).length;
                            const stratumInfluence = influenceShare(official.sourceStratum || 'official');
                            return {
                                official,
                                propertyValue,
                                propertyCount,
                                wealthScore,
                                influenceShare: stratumInfluence,
                            };
                        })
                        .filter(candidate => {
                            const official = candidate.official;
                            const loyalty = official.loyalty ?? 75; // 默认兼容旧存档
                            const lowLoyaltyDays = official.lowLoyaltyDays ?? 0;

                            // 条件1：忠诚度低于阈值且持续足够天数
                            if (loyalty >= COUP_THRESHOLD || lowLoyaltyDays < COUP_DURATION_DAYS) {
                                return false;
                            }

                            // 条件2：有足够资本发动政变（满足任一）
                            const hasWealth = candidate.wealthScore >= COUP_WEALTH_THRESHOLD;
                            const hasProperties = candidate.propertyCount >= COUP_PROPERTY_THRESHOLD;
                            const hasInfluence = candidate.influenceShare >= COUP_INFLUENCE_THRESHOLD;

                            return hasWealth || hasProperties || hasInfluence;
                        });

                    if (candidates.length > 0) {
                        candidates.sort((a, b) => b.wealthScore - a.wealthScore);
                        const target = candidates[0];
                        // 降低基础概率，根据忠诚度调整
                        const loyalty = target.official.loyalty ?? 75;
                        const loyaltyFactor = Math.max(0.5, (25 - loyalty) / 25); // 忠诚度越低概率越高
                        const triggerChance = Math.min(0.15, 0.02 * loyaltyFactor);

                        if (Math.random() < triggerChance) {
                            const newOfficials = officialsList.filter(o => o.id !== target.official.id);
                            const newBuildings = { ...(result.buildings || {}) };
                            const newBuildingUpgrades = { ...(result.buildingUpgrades || {}) };
                            const newPopStructure = { ...(result.popStructure || {}) };
                            let populationLoss = 1;

                            (target.official.ownedProperties || []).forEach(prop => {
                                const buildingId = prop.buildingId;
                                const level = prop.level || 0;
                                const building = BUILDINGS.find(b => b.id === buildingId);
                                if (building) {
                                    const config = getBuildingEffectiveConfig(building, level);
                                    Object.entries(config.jobs || {}).forEach(([role, slots]) => {
                                        if (!slots) return;
                                        const loss = Math.min(newPopStructure[role] || 0, slots);
                                        if (loss > 0) {
                                            newPopStructure[role] = Math.max(0, (newPopStructure[role] || 0) - loss);
                                            populationLoss += loss;
                                        }
                                    });
                                }

                                if (newBuildings[buildingId]) {
                                    newBuildings[buildingId] = Math.max(0, newBuildings[buildingId] - 1);
                                    if (newBuildings[buildingId] === 0) {
                                        delete newBuildings[buildingId];
                                    }
                                }

                                if (newBuildingUpgrades[buildingId] && level > 0) {
                                    newBuildingUpgrades[buildingId][level] = Math.max(0, (newBuildingUpgrades[buildingId][level] || 0) - 1);
                                    if (newBuildingUpgrades[buildingId][level] <= 0) {
                                        delete newBuildingUpgrades[buildingId][level];
                                    }
                                    if (Object.keys(newBuildingUpgrades[buildingId]).length === 0) {
                                        delete newBuildingUpgrades[buildingId];
                                    }
                                }
                            });

                            newPopStructure.official = Math.max(0, (newPopStructure.official || 0) - 1);

                            const newPopulation = Math.max(0, (result.population || 0) - populationLoss);

                            adjustedClassWealth = {
                                ...adjustedClassWealth,
                                official: Math.max(0, (adjustedClassWealth.official || 0) - (target.official.wealth || 0)),
                            };
                            adjustedTotalWealth = Object.values(adjustedClassWealth).reduce((sum, val) => sum + val, 0);

                            const rebelNation = createOfficialCoupNation(
                                target.official,
                                { propertyValue: target.propertyValue },
                                populationLoss
                            );
                            rebelNation.warStartDay = current.daysElapsed || 0;

                            const coupCallback = (action, stratum, extraData) => {
                                if (current.actions?.handleRebellionAction) {
                                    current.actions.handleRebellionAction(action, stratum, extraData);
                                }
                            };

                            const hasMilitary = hasAvailableMilitary(current.army, current.popStructure, 'official');
                            const militaryIsRebelling = isMilitaryRebelling(current.rebellionStates || {});
                            const coupEvent = createOfficialCoupEvent(
                                target.official,
                                hasMilitary,
                                militaryIsRebelling,
                                rebelNation,
                                coupCallback
                            );

                            coupOutcome = {
                                officials: newOfficials,
                                buildings: newBuildings,
                                buildingUpgrades: newBuildingUpgrades,
                                popStructure: newPopStructure,
                                population: newPopulation,
                                nations: [...(current.nations || []), rebelNation],
                                event: coupEvent,
                            };

                            addLog(`⚠️ 官僚政变：${target.official.name}携资产叛逃，成立了${rebelNation.name}！`);
                        }
                    }
                }

                const nextPopStructure = coupOutcome?.popStructure || result.popStructure;
                const nextOfficials = coupOutcome?.officials || result.officials;
                const nextBuildings = coupOutcome?.buildings || result.buildings;
                const nextBuildingUpgrades = coupOutcome?.buildingUpgrades || result.buildingUpgrades;
                const nextNations = coupOutcome?.nations || result.nations;
                const nextPopulation = coupOutcome?.population ?? result.population;

                // --- 市场数据历史记录更新 ---
                const previousPriceHistory = current.market?.priceHistory || {};
                const priceHistory = { ...previousPriceHistory };

                const previousSupplyHistory = current.market?.supplyHistory || {};
                const supplyHistory = { ...previousSupplyHistory };

                const previousDemandHistory = current.market?.demandHistory || {};
                const demandHistory = { ...previousDemandHistory };

                const MAX_MARKET_HISTORY_POINTS = HISTORY_STORAGE_LIMIT;
                Object.keys(result.market?.prices || {}).forEach(resource => {
                    const price = result.market?.prices?.[resource];

                    if (!priceHistory[resource]) priceHistory[resource] = [];
                    priceHistory[resource] = [...priceHistory[resource], price];
                    if (priceHistory[resource].length > MAX_MARKET_HISTORY_POINTS) {
                        priceHistory[resource].shift();
                    }

                    if (!supplyHistory[resource]) supplyHistory[resource] = [];
                    supplyHistory[resource] = [
                        ...supplyHistory[resource],
                        result.market?.supply?.[resource] || 0,
                    ];
                    if (supplyHistory[resource].length > MAX_MARKET_HISTORY_POINTS) {
                        supplyHistory[resource].shift();
                    }

                    if (!demandHistory[resource]) demandHistory[resource] = [];
                    demandHistory[resource] = [
                        ...demandHistory[resource],
                        result.market?.demand?.[resource] || 0,
                    ];
                    if (demandHistory[resource].length > MAX_MARKET_HISTORY_POINTS) {
                        demandHistory[resource].shift();
                    }
                });

                const previousWealthHistory = current.classWealthHistory || {};
                const wealthHistory = { ...previousWealthHistory };
                const MAX_WEALTH_POINTS = HISTORY_STORAGE_LIMIT;
                Object.entries(result.classWealth || {}).forEach(([key, value]) => {
                    const series = wealthHistory[key] ? [...wealthHistory[key]] : [];
                    series.push(value);
                    if (series.length > MAX_WEALTH_POINTS) {
                        series.shift();
                    }
                    wealthHistory[key] = series;
                });

                const previousNeedsHistory = current.classNeedsHistory || {};
                const needsHistory = { ...previousNeedsHistory };
                const MAX_NEEDS_POINTS = HISTORY_STORAGE_LIMIT;
                Object.entries(result.needsReport || {}).forEach(([key, report]) => {
                    const series = needsHistory[key] ? [...needsHistory[key]] : [];
                    series.push(report.satisfactionRatio);
                    if (series.length > MAX_NEEDS_POINTS) {
                        series.shift();
                    }
                    needsHistory[key] = series;
                });

                const adjustedMarket = {
                    ...(result.market || {}),
                    priceHistory,
                    supplyHistory,
                    demandHistory,
                    // 加成修饰符数据，供UI显示"谁吃到了buff"
                    modifiers: result.modifiers || {},
                };

                // ========== 历史数据节流更新 ==========
                // 只在计数器到达间隔时更新历史数据，减少 80% 的数组操作
                const shouldUpdateHistory = historyUpdateCounterRef.current >= HISTORY_UPDATE_INTERVAL;
                if (shouldUpdateHistory) {
                    historyUpdateCounterRef.current = 0;
                } else {
                    historyUpdateCounterRef.current++;
                }

                const MAX_HISTORY_POINTS = HISTORY_STORAGE_LIMIT;
                if (shouldUpdateHistory) {
                    setHistory(prevHistory => {
                        const appendValue = (series = [], value) => {
                            const nextSeries = [...series, value];
                            if (nextSeries.length > MAX_HISTORY_POINTS) {
                                nextSeries.shift();
                            }
                            return nextSeries;
                        };

                        const safeHistory = prevHistory || {};
                        const nextHistory = {
                            ...safeHistory,
                            treasury: appendValue(safeHistory.treasury, result.resources?.silver || 0),
                            tax: appendValue(safeHistory.tax, result.taxes?.total || 0),
                            population: appendValue(safeHistory.population, nextPopulation || 0),
                        };

                        const previousClassHistory = safeHistory.class || {};
                        const classHistory = { ...previousClassHistory };
                        Object.keys(STRATA).forEach(key => {
                            const entry = previousClassHistory[key] || { pop: [], income: [], expense: [] };
                            classHistory[key] = {
                                pop: appendValue(entry.pop, nextPopStructure?.[key] || 0),
                                income: appendValue(entry.income, result.classIncome?.[key] || 0),
                                expense: appendValue(entry.expense, result.classExpense?.[key] || 0),
                            };
                        });
                        nextHistory.class = classHistory;
                        return nextHistory;
                    });
                }

                // 更新所有状态 - 使用批量更新减少重渲染次数
                // 将所有 setState 调用包装在 unstable_batchedUpdates 中
                // 这可以将 30+ 次渲染合并为 1 次，大幅提升低端设备性能
                unstable_batchedUpdates(() => {
                    setPopStructure(nextPopStructure);
                    setMaxPop(result.maxPop);
                    setRates(result.rates || {});
                    setClassApproval(result.classApproval);
                    setApprovalBreakdown(result.approvalBreakdown || {}); // [NEW] 保存满意度分解数据供 UI 分析使用
                    const adjustedInfluence = { ...(result.classInfluence || {}) };
                    Object.entries(classInfluenceShift || {}).forEach(([key, delta]) => {
                        if (!delta) return;
                        adjustedInfluence[key] = (adjustedInfluence[key] || 0) + delta;
                    });
                    setClassInfluence(adjustedInfluence);
                    const wealthDelta = {};
                    Object.keys(adjustedClassWealth).forEach(key => {
                        const prevWealth = current.classWealth?.[key] || 0;
                        wealthDelta[key] = adjustedClassWealth[key] - prevWealth;
                    });
                    setClassWealth(adjustedClassWealth);
                    setClassWealthDelta(wealthDelta);
                    setClassIncome(result.classIncome || {});
                    setClassExpense(result.classExpense || {});
                    setClassFinancialData(result.classFinancialData || {});
                    setBuildingFinancialData(result.buildingFinancialData || {});
                    // DEBUG: Store building debug data for UI display
                    if (typeof window !== 'undefined') {
                        window.__buildingDebugData = result.buildingDebugData || {};
                    }
                    // 历史数据只在节流条件满足时更新
                    if (shouldUpdateHistory) {
                        setClassWealthHistory(wealthHistory);
                        setClassNeedsHistory(needsHistory);
                    }
                    setTotalInfluence(result.totalInfluence);
                    setTotalWealth(adjustedTotalWealth);
                    setActiveBuffs(result.activeBuffs);
                    setActiveDebuffs(result.activeDebuffs);
                    setStability(result.stability);
                    // 更新执政联盟合法性
                    if (typeof setLegitimacy === 'function' && result.legitimacy !== undefined) {
                        setLegitimacy(result.legitimacy);
                    }
                    // DEBUG: 调试关税值
                    const mainThreadDebug = isDebugEnabled('mainThread');
                    if (mainThreadDebug && result.taxes?.breakdown) {
                        debugLog('mainThread', '[MAIN THREAD DEBUG] result.taxes.breakdown:', result.taxes.breakdown);
                        // 额外打印 taxPolicies 内容
                        debugLog('mainThread', '[MAIN THREAD DEBUG] current.taxPolicies:', {
                            exportTariffMultipliers: current.taxPolicies?.exportTariffMultipliers,
                            importTariffMultipliers: current.taxPolicies?.importTariffMultipliers,
                            resourceTariffMultipliers: current.taxPolicies?.resourceTariffMultipliers,
                        });
                    }
                    setTaxes(result.taxes || {
                        total: 0,
                        breakdown: { headTax: 0, industryTax: 0, subsidy: 0, policyIncome: 0, policyExpense: 0 },
                        efficiency: 1,
                    });
                    setMarket(adjustedMarket);
                    setClassShortages(result.needsShortages || {});
                    setClassLivingStandard(result.classLivingStandard || {});
                    if (result.army) {
                        setArmy(result.army); // 保存战斗损失
                    }
                    // 更新官员状态（含独立财务数据）
                    if (nextOfficials) {
                        setOfficials(nextOfficials);
                    }
                    // 更新官员容量（基于时代、政体、科技动态计算）
                    if (typeof result.effectiveOfficialCapacity === 'number' && typeof setOfficialCapacity === 'function') {
                        setOfficialCapacity(result.effectiveOfficialCapacity);
                    }
                    setLivingStandardStreaks(result.livingStandardStreaks || current.livingStandardStreaks || {});
                    setMigrationCooldowns(result.migrationCooldowns || current.migrationCooldowns || {});
                    setTaxShock(result.taxShock || current.taxShock || {}); // [NEW] 更新累积税收冲击
                    setMerchantState(prev => {
                        const base = prev || current.merchantState || { pendingTrades: [], lastTradeTime: 0, merchantAssignments: {} };
                        const incoming = result.merchantState || current.merchantState || {};

                        // Keep backward-compatible merge so Trade 2.0 assignment UI persists across ticks.
                        const nextState = {
                            ...base,
                            ...incoming,
                            merchantAssignments:
                                (incoming && typeof incoming === 'object' && incoming.merchantAssignments && typeof incoming.merchantAssignments === 'object')
                                    ? incoming.merchantAssignments
                                    : base.merchantAssignments || {},
                        };

                        if (prev === nextState) return prev;
                        return nextState;
                    });
                    if (nextNations) {
                        setNations(nextNations);
                    }
                    if (result.jobFill) {
                        setJobFill(result.jobFill);
                    }
                    if (result.jobsAvailable) {
                        setJobsAvailable(result.jobsAvailable);
                    }
                    // [FIX] Save military expense data from simulation
                    console.log('[useGameLoop] Saving dailyMilitaryExpense:', result.dailyMilitaryExpense);
                    if (result.dailyMilitaryExpense) {
                        // [CRITICAL FIX] 使用window对象临时存储，绕过React state延迟
                        // 这是一个临时解决方案，直到重构state管理
                        window.__GAME_MILITARY_EXPENSE__ = result.dailyMilitaryExpense;
                        current.dailyMilitaryExpense = result.dailyMilitaryExpense;
                    }
                    // [NEW] Update buildings count (from Free Market expansion)
                    if (nextBuildings) {
                        setBuildings(nextBuildings);
                    }
                    // [DEBUG] 临时日志 - 追踪自由市场机制问题
                    if (result._debug) {
                        console.log('[FREE MARKET DEBUG]', result._debug.freeMarket);
                    }
                    // Update building upgrades from owner auto-upgrade
                    if (nextBuildingUpgrades) {
                        setBuildingUpgrades(nextBuildingUpgrades);
                    }
                    if (coupOutcome?.event) {
                        setRebellionStates(prev => ({
                            ...prev,
                            official: {
                                ...(prev?.official || {}),
                                organization: 50,
                                stage: ORGANIZATION_STAGE.MOBILIZING,
                            },
                        }));
                    }
                    // 更新事件效果状态（处理衰减和过期）
                    // 注意：nextEffects 由 processTimedEventEffects 计算得出，需要写回状态
                    setActiveEventEffects(prev => ({
                        ...prev,
                        approval: nextEffects.approval,
                        stability: nextEffects.stability,
                        resourceDemand: nextEffects.resourceDemand,
                        stratumDemand: nextEffects.stratumDemand,
                        buildingProduction: nextEffects.buildingProduction,
                        // forcedSubsidy 由单独的逻辑处理，不在此更新
                    }));
                    // 每次 Tick 推进 1 天（而非 gameSpeed 天）
                    // 加速效果通过增加 Tick 频率实现，而非增加每次推进的天数
                    setDaysElapsed(prev => prev + 1);
                });

                if (coupOutcome?.event && current.actions?.triggerDiplomaticEvent) {
                    current.actions.triggerDiplomaticEvent(coupOutcome.event);
                }

                // ========== 组织度系统更新 ==========
                // 使用新的组织度机制替代旧的RNG叛乱系统
                const currentOrganizationStates = current.rebellionStates || {};
                const updatedOrganizationStates = updateAllOrganizationStates(
                    currentOrganizationStates,
                    result.classApproval || {},
                    result.classInfluence || {},
                    result.totalInfluence || 0,
                    result.stability || 50,
                    current.daysElapsed || 0,
                    current.promiseTasks || [],
                    result.needsShortages || {},
                    {
                        classIncome: result.classIncome || {},
                        classExpense: result.classExpense || current.classExpense || {},
                        popStructure: nextPopStructure || current.popStructure || {},
                        taxPolicies: current.taxPolicies || {},
                        market: result.market || current.market || {},
                        classLivingStandard: result.classLivingStandard || {},
                        livingStandardStreaks: result.livingStandardStreaks || current.livingStandardStreaks || {},
                        epoch: current.epoch || 0,
                        rulingCoalition: current.rulingCoalition || [], // 执政联盟
                        difficultyLevel: current.difficulty, // 游戏难度
                        organizationGrowthMod: result.modifiers?.officialEffects?.organizationGrowthMod || 0, // [NEW] 组织度增长修正
                        // 注意：classInfluence/totalInfluence 已是位置参数，无需在此重复
                    }
                );

                // 检查是否有阶层跨越组织度阈值需要触发事件
                const organizationEvents = checkOrganizationEvents(
                    currentOrganizationStates,
                    updatedOrganizationStates
                );
                const currentEpoch = current.epoch || 0;

                // 处理组织度事件
                if (organizationEvents.length > 0 && current.actions?.triggerDiplomaticEvent) {
                    for (const orgEvent of organizationEvents) {
                        const stratumKey = orgEvent.stratumKey;
                        const epochBlocksRebellion = stratumKey === 'unemployed' && currentEpoch <= 0;
                        const hasMilitary = hasAvailableMilitary(current.army, current.popStructure, stratumKey);
                        const militaryIsRebelling = isMilitaryRebelling(updatedOrganizationStates);

                        // 构建叛乱状态对象供事件使用
                        const rebellionStateForEvent = {
                            ...updatedOrganizationStates[stratumKey],
                            dissatisfactionDays: Math.floor(updatedOrganizationStates[stratumKey]?.organization || 0),
                            influenceShare: (result.classInfluence?.[stratumKey] || 0) / (result.totalInfluence || 1),
                        };
                        const influenceShare = rebellionStateForEvent.influenceShare || 0;
                        if (influenceShare < 0.01 && orgEvent.type !== 'uprising') {
                            continue;
                        }

                        let event = null;
                        const rebellionCallback = (action, stratum, extraData) => {
                            debugLog('gameLoop', '[ORGANIZATION] Action:', action, 'Stratum:', stratum, 'Data:', extraData);
                            if (current.actions?.handleRebellionAction) {
                                current.actions.handleRebellionAction(action, stratum, extraData);
                            }
                        };

                        const stratumPopulation = current.popStructure?.[stratumKey] || 0;
                        const marketPrices = current.market?.prices || {};

                        // 根据事件类型处理
                        switch (orgEvent.type) {
                            case 'brewing':
                                // 创建事件弹窗提醒玩家（选项不直接影响组织度）
                                event = createBrewingEvent(
                                    stratumKey,
                                    rebellionStateForEvent,
                                    hasMilitary,
                                    militaryIsRebelling,
                                    current.resources?.silver || 0, // 传入当前银币
                                    rebellionCallback,
                                    stratumPopulation,
                                    marketPrices
                                );
                                addLog(`⚠️ ${STRATA[stratumKey]?.name || stratumKey}阶层组织度达到30%，出现不满情绪！`);
                                break;

                            case 'plotting':
                                // 创建事件弹窗提醒玩家（选项不直接影响组织度）
                                event = createPlottingEvent(
                                    stratumKey,
                                    rebellionStateForEvent,
                                    hasMilitary,
                                    militaryIsRebelling,
                                    current.resources?.silver || 0, // 传入当前银币
                                    rebellionCallback,
                                    stratumPopulation,
                                    marketPrices
                                );
                                addLog(`🔥 ${STRATA[stratumKey]?.name || stratumKey}阶层组织度达到70%，正在密谋叛乱！`);
                                break;


                            case 'uprising': {
                                // 检查影响力占比是否足够发动叛乱
                                const stratumInfluence = rebellionStateForEvent.influenceShare;
                                if (epochBlocksRebellion) {
                                    addLog(`⚠️ ${STRATA[stratumKey]?.name || stratumKey}阶层尚未具备发动叛乱的组织能力。`);
                                    updatedOrganizationStates[stratumKey] = {
                                        ...updatedOrganizationStates[stratumKey],
                                        organization: 25,
                                        stage: ORGANIZATION_STAGE.GRUMBLING,
                                    };
                                    break;
                                }
                                if (stratumInfluence < MIN_REBELLION_INFLUENCE) {
                                    // 影响力不足无法叛乱，但组织度已满，触发人口外流
                                    const stratumPop = current.popStructure?.[stratumKey] || 0;
                                    const exitRate = 0.05; // 5%人口愤怒离开
                                    const leaving = Math.max(1, Math.floor(stratumPop * exitRate));
                                    const stratumWealth = current.classWealth?.[stratumKey] || 0;
                                    const perCapWealth = stratumPop > 0 ? stratumWealth / stratumPop : 0;
                                    const fleeingCapital = perCapWealth * leaving;

                                    // 扣除离开人口
                                    setPopStructure(prev => ({
                                        ...prev,
                                        [stratumKey]: Math.max(0, (prev[stratumKey] || 0) - leaving),
                                    }));
                                    setPopulation(prev => Math.max(0, prev - leaving));

                                    // 扣除带走的财富
                                    if (fleeingCapital > 0) {
                                        setClassWealth(prev => ({
                                            ...prev,
                                            [stratumKey]: Math.max(0, (prev[stratumKey] || 0) - fleeingCapital),
                                        }));
                                    }

                                    addLog(`⚠️ ${STRATA[stratumKey]?.name || stratumKey}阶层组织度达到100%，但社会影响力不足（${Math.round(stratumInfluence * 100)}%），无法发动叛乱！${leaving}人愤怒地离开了国家。`);

                                    // 降低组织度，让系统恢复正常运转
                                    updatedOrganizationStates[stratumKey] = {
                                        ...updatedOrganizationStates[stratumKey],
                                        organization: 75, // 降到75%而不是99，避免立即再次触发
                                    };
                                    break;
                                }

                                // ========== 联合叛乱检测 ==========
                                const coalitionResult = checkCoalitionRebellion(
                                    stratumKey,
                                    updatedOrganizationStates,
                                    result.classInfluence || {},
                                    result.totalInfluence || 0,
                                    current.popStructure || {}
                                );

                                if (coalitionResult.isCoalition) {
                                    // 联合叛乱处理
                                    const coalitionStrata = coalitionResult.coalitionStrata;
                                    const { details, totalLoss } = calculateCoalitionPopLoss(coalitionStrata, current.popStructure);

                                    const existingRebel = (current.nations || []).find(
                                        n => n.isRebelNation && n.isAtWar && (n.isCoalitionRebellion || coalitionStrata.includes(n.rebellionStratum))
                                    );

                                    if (existingRebel) {
                                        // 合并到已存在叛军
                                        setNations(prev => prev.map(n => {
                                            if (n.id === existingRebel.id) {
                                                const newPop = (n.population || 0) + totalLoss;
                                                const addedWealth = details.reduce((sum, d) => sum + Math.floor((current.classWealth?.[d.stratumKey] || 0) * 0.3), 0);
                                                return {
                                                    ...n,
                                                    population: newPop,
                                                    wealth: (n.wealth || 0) + addedWealth,
                                                    economyTraits: {
                                                        ...n.economyTraits,
                                                        basePopulation: newPop,
                                                        baseWealth: (n.economyTraits?.baseWealth || n.wealth || 0) + addedWealth,
                                                    },
                                                };
                                            }
                                            return n;
                                        }));
                                        // 扣除人口
                                        setPopStructure(prev => {
                                            const updated = { ...prev };
                                            details.forEach(({ stratumKey: sKey, loss }) => {
                                                updated[sKey] = Math.max(0, (prev[sKey] || 0) - loss);
                                            });
                                            return updated;
                                        });
                                        setPopulation(prev => Math.max(0, prev - totalLoss));
                                        addLog(`🔥 更多人（${totalLoss}人）加入了${existingRebel.name}！`);
                                    } else {
                                        // 创建新联合叛军
                                        const rebelNation = createCoalitionRebelNation(
                                            coalitionStrata,
                                            current.popStructure,
                                            current.classWealth || {},
                                            result.classInfluence || {},
                                            result.totalInfluence || 0,
                                            COALITION_REBELLION_CONFIG.COALITION_BONUS
                                        );
                                        rebelNation.isCoalitionRebellion = true;
                                        rebelNation.warStartDay = current.daysElapsed || 0;
                                        setNations(prev => [...prev, rebelNation]);
                                        setPopStructure(prev => {
                                            const updated = { ...prev };
                                            details.forEach(({ stratumKey: sKey, loss }) => {
                                                updated[sKey] = Math.max(0, (prev[sKey] || 0) - loss);
                                            });
                                            return updated;
                                        });
                                        setPopulation(prev => Math.max(0, prev - totalLoss));
                                        event = createCoalitionRebellionEvent(
                                            coalitionStrata,
                                            rebelNation,
                                            hasMilitary,
                                            militaryIsRebelling,
                                            details,
                                            rebellionCallback
                                        );
                                        const coalitionNames = coalitionStrata.map(k => STRATA[k]?.name || k).join('、');
                                        addLog(`🔥🔥🔥 ${coalitionNames}等多个阶层联合发动叛乱！`);
                                    }

                                    // 降低参与阶层组织度
                                    coalitionStrata.forEach(sKey => {
                                        updatedOrganizationStates[sKey] = {
                                            ...updatedOrganizationStates[sKey],
                                            organization: 50,
                                            stage: ORGANIZATION_STAGE.MOBILIZING,
                                        };
                                    });
                                } else {
                                    // 单阶层叛乱
                                    const stratumPop = current.popStructure?.[stratumKey] || 0;
                                    const stratumWealth = current.classWealth?.[stratumKey] || 0;
                                    const rebelPopLoss = calculateRebelPopulation(stratumPop);

                                    const existingRebelNation = (current.nations || []).find(
                                        n => n.isRebelNation && n.rebellionStratum === stratumKey && n.isAtWar
                                    );

                                    if (existingRebelNation) {
                                        setNations(prev => prev.map(n => {
                                            if (n.id === existingRebelNation.id) {
                                                const newPop = (n.population || 0) + rebelPopLoss;
                                                const newWealth = (n.wealth || 0) + Math.floor(stratumWealth * 0.3);
                                                return {
                                                    ...n,
                                                    population: newPop,
                                                    wealth: newWealth,
                                                    economyTraits: { ...n.economyTraits, basePopulation: newPop, baseWealth: newWealth },
                                                };
                                            }
                                            return n;
                                        }));
                                        setPopStructure(prev => ({
                                            ...prev,
                                            [stratumKey]: Math.max(0, (prev[stratumKey] || 0) - rebelPopLoss),
                                        }));
                                        setPopulation(prev => Math.max(0, prev - rebelPopLoss));
                                        addLog(`🔥 更多${STRATA[stratumKey]?.name || stratumKey}（${rebelPopLoss}人）加入了${existingRebelNation.name}！`);
                                    } else {
                                        const resourceLoot = { resources: current.resources || {}, marketPrices: current.market?.prices || {} };
                                        const rebelResult = createRebelNation(stratumKey, stratumPop, stratumWealth, stratumInfluence, rebelPopLoss, resourceLoot);
                                        const rebelNation = rebelResult.nation;

                                        if (rebelResult.lootedResources && Object.keys(rebelResult.lootedResources).length > 0) {
                                            setResources(prev => {
                                                const updated = { ...prev };
                                                Object.entries(rebelResult.lootedResources).forEach(([resKey, amount]) => {
                                                    updated[resKey] = Math.max(0, (updated[resKey] || 0) - amount);
                                                });
                                                return updated;
                                            });
                                            const lootSummary = Object.entries(rebelResult.lootedResources).map(([k, v]) => `${RESOURCES[k]?.name || k}: ${v}`).join('、');
                                            addLog(`⚠️ 叛军掠夺了物资：${lootSummary}（总价值约${Math.floor(rebelResult.lootedValue)}银币）`);
                                        }

                                        rebelNation.warStartDay = current.daysElapsed || 0;
                                        setNations(prev => [...prev, rebelNation]);
                                        setPopStructure(prev => ({
                                            ...prev,
                                            [stratumKey]: Math.max(0, (prev[stratumKey] || 0) - rebelPopLoss),
                                        }));
                                        setPopulation(prev => Math.max(0, prev - rebelPopLoss));

                                        event = createActiveRebellionEvent(stratumKey, rebellionStateForEvent, hasMilitary, militaryIsRebelling, rebelNation, rebellionCallback);
                                        addLog(`🔥🔥🔥 ${STRATA[stratumKey]?.name || stratumKey}阶层组织度达到100%，发动叛乱！`);
                                    }

                                    updatedOrganizationStates[stratumKey] = {
                                        ...updatedOrganizationStates[stratumKey],
                                        organization: 50,
                                        stage: ORGANIZATION_STAGE.MOBILIZING,
                                    };
                                }
                                break;
                            }
                        }

                        if (event) {
                            current.actions.triggerDiplomaticEvent(event);
                        }
                    }
                }

                // 更新组织度状态
                setRebellionStates(updatedOrganizationStates);

                // 起义后议和检查
                const rebelNations = (current.nations || []).filter(n => n.isRebelNation && n.isAtWar);
                for (const rebelNation of rebelNations) {
                    const stratumKey = rebelNation.rebellionStratum;
                    if (!stratumKey) continue;
                    if ((rebelNation.warDuration || 0) < 60) continue;

                    const orgState = updatedOrganizationStates[stratumKey];
                    const organization = orgState?.organization ?? 50;
                    const rebelWarScore = rebelNation.warScore || 0;

                    if (organization < 30 && rebelWarScore >= -20) {
                        const stratumName = STRATA[stratumKey]?.name || stratumKey;
                        addLog(`🕊️ ${rebelNation.name}内部分裂，组织度降至${Math.round(organization)}%，叛乱崩溃！`);

                        const returnedPop = Math.floor((rebelNation.population || 0) * 0.5);
                        if (returnedPop > 0) {
                            setPopStructure(prev => ({ ...prev, [stratumKey]: (prev[stratumKey] || 0) + returnedPop }));
                            setPopulation(prev => prev + returnedPop);
                            addLog(`🏠 ${returnedPop}名${stratumName}从叛军中回归。`);
                        }

                        const collapseCallback = (action, nation) => { debugLog('gameLoop', '[REBELLION END]', action, nation?.name); };
                        const collapseEvent = createRebellionEndEvent(rebelNation, true, current.resources?.silver || 0, collapseCallback);
                        if (collapseEvent && current.actions?.triggerDiplomaticEvent) {
                            current.actions.triggerDiplomaticEvent(collapseEvent);
                        }

                        setNations(prevNations => prevNations.map(n => n.id === rebelNation.id ? { ...n, isAtWar: false, warScore: 0, warDuration: 0 } : n));
                        setTimeout(() => { setNations(prevNations => prevNations.filter(n => n.id !== rebelNation.id)); }, 500);

                        setRebellionStates(prev => ({
                            ...prev,
                            [stratumKey]: { ...prev[stratumKey], organization: Math.max(0, organization - 30) }
                        }));
                    }
                }

                // 策略行动冷却
                if (actionCooldowns && Object.keys(actionCooldowns).length > 0) {
                    setActionCooldowns(prev => {
                        if (!prev) return prev;
                        let changed = false;
                        const next = {};
                        Object.entries(prev).forEach(([key, value]) => {
                            if (value > 1) { next[key] = value - 1; changed = true; }
                            else if (value > 1e-6) { changed = true; }
                        });
                        return changed ? next : prev;
                    });
                }

                // 评估承诺任务
                if (promiseTasks && promiseTasks.length > 0) {
                    const today = (current.daysElapsed || 0) + 1;
                    const evaluation = evaluatePromiseTasks(promiseTasks, {
                        currentDay: today,
                        classApproval: result.classApproval || {},
                        market: result.market || current.market || {},
                        nations: result.nations || current.nations || [],
                        taxPolicies: current.taxPolicies || {},
                        classWealth: result.classWealth || current.classWealth || {},
                        needsReport: result.needsReport || {},
                        tradeRoutes: current.tradeRoutes || {},
                        classIncome: result.classIncome || {},
                        popStructure: result.popStructure || current.popStructure || {},
                    });

                    if (evaluation.completed.length > 0) {
                        evaluation.completed.forEach(task => {
                            addLog(`🤝 ${task.stratumName} 的承诺已兑现：${task.description || '任务完成'}`);
                        });
                    }

                    if (evaluation.updated && evaluation.updated.length > 0) {
                        evaluation.updated.forEach(task => {
                            addLog(`✓ ${task.stratumName} 的承诺目标已达成，现在需要保持 ${task.maintainDuration} 天`);
                        });
                    }

                    if (evaluation.failed.length > 0) {
                        evaluation.failed.forEach(task => {
                            const stratumKey = task.stratumKey;
                            const failReason = task.failReason === 'maintain_broken' ? '未能保持承诺' : '未能按时完成';
                            addLog(`⚠️ 你违背了对${task.stratumName}的承诺（${failReason}），组织度暴涨！`);

                            const prevState = current.rebellionStates?.[stratumKey] || {};
                            const penalty = task.failurePenalty || { organization: 50 };
                            let newOrganization = prevState.organization || 0;

                            if (penalty.forcedUprising) {
                                newOrganization = 100;
                            } else if (typeof penalty.organization === 'number') {
                                newOrganization = Math.min(100, Math.max(0, newOrganization + penalty.organization));
                            }

                            const stratumInfluence = (result.classInfluence?.[stratumKey] || 0) / (result.totalInfluence || 1);
                            const epochBlocksRebellion = stratumKey === 'unemployed' && (current.epoch || 0) <= 0;
                            const reachedThreshold = newOrganization >= 100;
                            const canTriggerUprising = reachedThreshold && stratumInfluence >= MIN_REBELLION_INFLUENCE && !epochBlocksRebellion;

                            if (reachedThreshold && !canTriggerUprising) {
                                newOrganization = 99;
                                const extraReason = epochBlocksRebellion ? '当前时代他们尚缺乏发动叛乱的组织力' : `社会影响力不足（${Math.round(stratumInfluence * 100)}%）`;
                                addLog(`⚠️ ${STRATA[stratumKey]?.name || stratumKey}阶层因承诺违背组织度达到100%，但${extraReason}，无法发动叛乱！`);
                            }

                            updatedOrganizationStates[stratumKey] = {
                                ...updatedOrganizationStates[stratumKey], // Note: Here we update persisted state, but we should probably use setRebellionStates for promise failure as it's separate from main loop? 
                                // Actually better to keep consistent with previous logic.
                                organization: newOrganization,
                            };

                            // Re-trigger persistence just in case
                            setRebellionStates(prev => ({
                                ...prev,
                                [stratumKey]: { ...prev[stratumKey], organization: newOrganization }
                            }));

                            if (canTriggerUprising && current.actions?.triggerDiplomaticEvent) {
                                const hasMilitary = hasAvailableMilitary(current.army, current.popStructure, stratumKey);
                                const militaryIsRebelling = isMilitaryRebelling(current.rebellionStates || {});

                                const rebellionStateForEvent = {
                                    organization: newOrganization,
                                    dissatisfactionDays: Math.floor(newOrganization),
                                    influenceShare: stratumInfluence,
                                };

                                const stratumPop = current.popStructure?.[stratumKey] || 0;
                                const stratumWealth = current.classWealth?.[stratumKey] || 0;
                                const rebelPopLoss = calculateRebelPopulation(stratumPop);
                                const resourceLoot = {
                                    resources: current.resources || {},
                                    marketPrices: current.market?.prices || {},
                                };
                                const rebelResult = createRebelNation(
                                    stratumKey,
                                    stratumPop,
                                    stratumWealth,
                                    stratumInfluence,
                                    rebelPopLoss,
                                    resourceLoot
                                );
                                const rebelNation = rebelResult.nation;

                                if (rebelResult.lootedResources && Object.keys(rebelResult.lootedResources).length > 0) {
                                    setResources(prev => {
                                        const updated = { ...prev };
                                        Object.entries(rebelResult.lootedResources).forEach(([resKey, amount]) => {
                                            updated[resKey] = Math.max(0, (updated[resKey] || 0) - amount);
                                        });
                                        return updated;
                                    });
                                    const lootSummary = Object.entries(rebelResult.lootedResources)
                                        .map(([k, v]) => `${RESOURCES[k]?.name || k}: ${v}`)
                                        .join('、');
                                    addLog(`⚠️ 叛军掠夺了物资：${lootSummary}（总价值约${Math.floor(rebelResult.lootedValue)}银币）`);
                                }

                                rebelNation.warStartDay = current.daysElapsed || 0;
                                setNations(prev => [...prev, rebelNation]);
                                setPopStructure(prev => ({
                                    ...prev,
                                    [stratumKey]: Math.max(0, (prev[stratumKey] || 0) - rebelPopLoss),
                                }));
                                setPopulation(prev => Math.max(0, prev - rebelPopLoss));

                                const rebellionCallback = (action, stratum, extraData) => {
                                    if (current.actions?.handleRebellionAction) {
                                        current.actions.handleRebellionAction(action, stratum, extraData);
                                    }
                                };

                                const event = createActiveRebellionEvent(
                                    stratumKey,
                                    rebellionStateForEvent,
                                    hasMilitary,
                                    militaryIsRebelling,
                                    rebelNation,
                                    rebellionCallback
                                );
                                addLog(`🔥🔥🔥 ${STRATA[stratumKey]?.name || stratumKey}因承诺违背，组织度达到100%，发动叛乱！`);
                                current.actions.triggerDiplomaticEvent(event);
                                setIsPaused(true);
                            }
                        });
                    }

                    // 更新任务列表（包括进入保持阶段的任务）
                    const newRemaining = [...evaluation.remaining];
                    if (evaluation.updated) {
                        // updated 任务已经在 remaining 中了
                    }
                    setPromiseTasks(newRemaining);
                }

                // 处理贸易路线并记录贸易税收入
                // 处理玩家的分期支付
                if (tradeRouteSummary) {
                    applyTradeRouteDeltas(
                        tradeRouteSummary,
                        current,
                        addLog,
                        setResources,
                        setNations,
                        setTradeRoutes,
                        { applyResourceDelta: false }
                    );
                }

                if (gameState.playerInstallmentPayment && gameState.playerInstallmentPayment.remainingDays > 0) {
                    const payment = gameState.playerInstallmentPayment;
                    const paymentAmount = payment.amount;

                    if ((current.resources.silver || 0) >= paymentAmount) {
                        setResources(prev => ({
                            ...prev,
                            silver: (prev.silver || 0) - paymentAmount
                        }));

                        gameState.setPlayerInstallmentPayment(prev => ({
                            ...prev,
                            paidAmount: prev.paidAmount + paymentAmount,
                            remainingDays: prev.remainingDays - 1
                        }));

                        if (payment.remainingDays === 1) {
                            addLog(`💰 你完成了所有分期赔款支付（共${payment.totalAmount} 银币）。`);
                            gameState.setPlayerInstallmentPayment(null);
                        }
                    } else {
                        // 银币不足，违约
                        addLog(`⚠️ 银币不足，无法支付分期赔款！和平协议被破坏。`);
                        setNations(prev => prev.map(n =>
                            n.id === payment.nationId
                                ? {
                                    ...n,
                                    isAtWar: true,
                                    warStartDay: current.daysElapsed || 0,
                                    warDuration: 0,
                                    relation: Math.max(0, (n.relation || 0) - 50),
                                    peaceTreatyUntil: undefined,
                                    lootReserve: (n.wealth || 500) * 1.5, // 初始化掠夺储备
                                    lastMilitaryActionDay: undefined, // 重置军事行动冷却
                                }
                                : n
                        ));
                        gameState.setPlayerInstallmentPayment(null);
                    }
                }

                // 更新庆典效果，移除过期的短期效果
                if (activeFestivalEffects.length > 0) {
                    const updatedEffects = activeFestivalEffects.filter(effect => {
                        if (effect.type === 'permanent') return true;
                        const elapsedSinceActivation = (current.daysElapsed || 0) - (effect.activatedAt || 0);
                        return elapsedSinceActivation < (effect.duration || 360);
                    });
                    if (updatedEffects.length !== activeFestivalEffects.length) {
                        setActiveFestivalEffects(updatedEffects);
                    }
                }

                setClassInfluenceShift(prev => {
                    if (!prev || Object.keys(prev).length === 0) return prev || {};
                    const next = {};
                    Object.entries(prev).forEach(([key, value]) => {
                        const decayed = value * 0.9;
                        if (Math.abs(decayed) >= 0.1) {
                            next[key] = decayed;
                        }
                    });
                    return Object.keys(next).length > 0 ? next : {};
                });

                // 更新人口（如果有变化）
                if (nextPopulation !== current.population) {
                    setPopulation(nextPopulation);
                }
                if (typeof result.birthAccumulator === 'number') {
                    setBirthAccumulator(result.birthAccumulator);
                }

                // 添加新日志
                if (result.logs.length) {
                    // 去重：追踪已处理的突袭事件
                    const processedRaidNations = new Set();

                    // Filter and transform technical logs to human-readable format
                    const logVisibility = current?.eventEffectSettings?.logVisibility || {};
                    const shouldLogMerchantTrades = logVisibility.showMerchantTradeLogs ?? true;
                    const processedLogs = result.logs.map(log => {
                        if (typeof log !== 'string') return log;

                        // Transform RAID_EVENT logs to human-readable format (now supports multiple action types)
                        if (log.includes('❗RAID_EVENT❗')) {
                            try {
                                const jsonStr = log.replace('❗RAID_EVENT❗', '');
                                const raidData = JSON.parse(jsonStr);

                                // 去重：如果这个国家已经有军事行动记录，跳过
                                if (processedRaidNations.has(raidData.nationName)) {
                                    return null; // 返回null，稍后过滤掉
                                }
                                processedRaidNations.add(raidData.nationName);

                                // 获取行动名称，默认为"突袭"
                                const actionName = raidData.actionName || '突袭';

                                if (raidData.victory) {
                                    return `⚔️ 成功击退了 ${raidData.nationName} 的${actionName}！`;
                                } else {
                                    const losses = [];
                                    if (raidData.foodLoss > 0) losses.push(`粮食 -${raidData.foodLoss}`);
                                    if (raidData.silverLoss > 0) losses.push(`银币 -${raidData.silverLoss}`);
                                    if (raidData.woodLoss > 0) losses.push(`木材 -${raidData.woodLoss}`);
                                    if (raidData.popLoss > 0) losses.push(`人口 -${raidData.popLoss}`);
                                    const lossText = losses.length > 0 ? `（${losses.join('，')}）` : '';
                                    return `🔥 遭到 ${raidData.nationName} 的${actionName}！${lossText}`;
                                }
                            } catch (e) {
                                return `⚔️ 发生了一场敌方军事行动！`;
                            }
                        }

                        // Transform WAR_DECLARATION_EVENT logs to human-readable format
                        if (log.includes('WAR_DECLARATION_EVENT:')) {
                            try {
                                const jsonStr = log.replace('WAR_DECLARATION_EVENT:', '');
                                const warData = JSON.parse(jsonStr);
                                return `⚔️ ${warData.nationName} 对你宣战！`;
                            } catch (e) {
                                return `⚔️ 有国家对你宣战！`;
                            }
                        }

                        if (log.includes('AI_GIFT_EVENT:')) {
                            return '💝 收到一份来自外国的外交礼物通知';
                        }
                        if (log.includes('AI_REQUEST_EVENT:')) {
                            return '🗣️ 收到一份来自外国的外交请求';
                        }

                        // Merchant autonomous trade summary logs (from simulation)
                        // Gate behind showMerchantTradeLogs
                        if (log.startsWith('🛒 商人贸易完成')) {
                            return shouldLogMerchantTrades ? log : null;
                        }

                        // 过滤掉 AI_TRADE_EVENT 的原始 JSON，后续会通过 addLog 添加格式化日志
                        if (log.includes('AI_TRADE_EVENT:')) {
                            return null;
                        }

                        return log;
                    });

                    setLogs(prev => [...processedLogs.filter(log => log !== null), ...prev].slice(0, LOG_STORAGE_LIMIT));

                    // 检测外交事件并触发事件系统
                    const currentActions = current.actions;
                    const eventDebug = isDebugEnabled('event');
                    if (eventDebug) {
                        debugLog('event', '[EVENT DEBUG] actions:', !!currentActions, 'triggerDiplomaticEvent:', !!currentActions?.triggerDiplomaticEvent);
                    }
                    if (currentActions && currentActions.triggerDiplomaticEvent) {
                        if (eventDebug) {
                            debugLog('event', '[EVENT DEBUG] Checking logs:', result.logs);
                            debugLog('event', '[EVENT DEBUG] Total logs count:', result.logs.length);
                        }

                        // 先解析突袭事件日志，触发战斗结果弹窗
                        const raidLogEntry = Array.isArray(result.logs)
                            ? result.logs.find((log) => typeof log === 'string' && log.includes('RAID_EVENT'))
                            : null;
                        if (raidLogEntry && currentActions.addBattleNotification) {
                            try {
                                const jsonStart = raidLogEntry.indexOf('{');
                                if (jsonStart !== -1) {
                                    const raidJson = raidLogEntry.slice(jsonStart);
                                    const raidData = JSON.parse(raidJson);

                                    // 获取行动名称，默认为"突袭"
                                    const actionName = raidData.actionName || '突袭';

                                    let description = `${raidData.nationName} 发动了${actionName}！\n\n`;
                                    if (raidData.victory) {
                                        description += `你的军队成功击退了${actionName}！\n\n`;
                                        description += '战斗力对比：\n';
                                        description += `我方：${raidData.ourPower || 0} \n`;
                                        description += `敌方：${raidData.enemyPower || 0} \n`;
                                        if (raidData.battleReport && raidData.battleReport.length > 0) {
                                            description += '\n' + raidData.battleReport.join('\n');
                                        }
                                    } else {
                                        if (!raidData.ourPower) {
                                            description += `你没有军队防御，${actionName}成功！\n\n`;
                                        } else {
                                            description += `你的军队未能阻止${actionName}！\n\n`;
                                            description += '战斗力对比：\n';
                                            description += `我方：${raidData.ourPower || 0} \n`;
                                            description += `敌方：${raidData.enemyPower || 0} \n`;
                                            if (raidData.battleReport && raidData.battleReport.length > 0) {
                                                description += '\n' + raidData.battleReport.join('\n');
                                            }
                                        }
                                        description += `\n${actionName}损失：\n`;
                                        if (raidData.foodLoss > 0) description += `粮食：${raidData.foodLoss} \n`;
                                        if (raidData.silverLoss > 0) description += `银币：${raidData.silverLoss} \n`;
                                        if (raidData.woodLoss > 0) description += `木材：${raidData.woodLoss} \n`;
                                        if (raidData.popLoss > 0) description += `人口：${raidData.popLoss} \n`;
                                    }

                                    const battleResult = {
                                        victory: !!raidData.victory,
                                        missionName: `${raidData.nationName} 的${actionName}`,
                                        missionDesc: raidData.victory
                                            ? `你成功击退了敌方的${actionName}！`
                                            : `敌方对你发动了${actionName}！`,
                                        nationName: raidData.nationName,
                                        ourPower: raidData.ourPower || 0,
                                        enemyPower: raidData.enemyPower || 0,
                                        powerRatio:
                                            (raidData.enemyPower || 0) > 0
                                                ? (raidData.ourPower || 0) / raidData.enemyPower
                                                : 0,
                                        score: 0,
                                        losses: raidData.defenderLosses || {},
                                        attackerLosses: raidData.attackerLosses || {},
                                        enemyLosses: raidData.attackerLosses || {},
                                        defenderLosses: raidData.defenderLosses || {},
                                        resourcesGained: {},
                                        description,
                                        foodLoss: raidData.foodLoss || 0,
                                        silverLoss: raidData.silverLoss || 0,
                                        popLoss: raidData.popLoss || 0,
                                        isRaid: true,
                                        attackerArmy: raidData.attackerArmy, // Pass attacker army composition
                                        defenderArmy: raidData.defenderArmy, // Pass defender army composition
                                        isPlayerAttacker: false,
                                    };

                                    debugLog('event', '[EVENT DEBUG] Raid battle result created (pre-loop):', battleResult);
                                    // 使用非阻断式通知，不打断玩家操作
                                    currentActions.addBattleNotification(battleResult);
                                }
                            } catch (e) {
                                debugError('event', '[EVENT DEBUG] Failed to parse raid event log:', e);
                            }
                        }


                        result.logs.forEach((log, index) => {
                            debugLog('event', `[EVENT DEBUG] Log ${index}: `, log);
                            debugLog('event', `[EVENT DEBUG] Log ${index} includes RAID_EVENT: `, log.includes('❗RAID_EVENT❗'));

                            // 检测宣战事件（使用新的 WAR_DECLARATION_EVENT 标记）
                            if (log.includes('WAR_DECLARATION_EVENT:')) {
                                debugLog('event', '[EVENT DEBUG] War declaration detected:', log);
                                try {
                                    const jsonStr = log.replace('WAR_DECLARATION_EVENT:', '');
                                    const warData = JSON.parse(jsonStr);
                                    const aggressorId = warData.nationId;
                                    const aggressorName = warData.nationName;

                                    // 触发玩家的宣战弹窗
                                    const aggressor = result.nations?.find(n => n.id === aggressorId);
                                    if (aggressor) {
                                        const event = createWarDeclarationEvent(aggressor, () => {
                                            debugLog('event', '[EVENT DEBUG] War declaration acknowledged');
                                        });
                                        currentActions.triggerDiplomaticEvent(event);
                                    }

                                    // === 战争同盟连锁反应逻辑 ===
                                    // 既然 simulation.js 仅仅触发了事件，我们需要在这里处理复杂的同盟逻辑
                                    // 我们需要同时更新 state 中的 nations (result.nations 是本Tick的结果，我们需要更新它)

                                    setNations(prevNations => {
                                        const nextNations = [...prevNations];
                                        const aggressorIdx = nextNations.findIndex(n => n.id === aggressorId);
                                        if (aggressorIdx === -1) return nextNations;

                                        // 1. 识别各方盟友
                                        // 侵略者的盟友: 与侵略者关系 >= 80
                                        const aggressorAllies = nextNations.filter(n => {
                                            if (n.id === aggressorId) return false;
                                            const r = nextNations[aggressorIdx].foreignRelations?.[n.id] ?? 50;
                                            return r >= 80 && !n.isAtWar;
                                        });

                                        // 玩家(目标)的正式盟友: alliedWithPlayer === true
                                        const playerAllies = nextNations.filter(n => {
                                            if (n.id === aggressorId) return false;
                                            return n.alliedWithPlayer === true && !n.isAtWar;
                                        });

                                        // ========== 战争上限检查 ==========
                                        const MAX_CONCURRENT_WARS = 3;
                                        // 计算当前与玩家交战的AI国家数量（不包括叛军）
                                        let currentWarsWithPlayer = nextNations.filter(n =>
                                            n.isAtWar === true && !n.isRebelNation
                                        ).length;

                                        // 2. 处理侵略者的盟友加入战争
                                        aggressorAllies.forEach(ally => {
                                            // 检查中立原则：如果该盟友同时也与玩家正式结盟，则保持中立
                                            if (ally.alliedWithPlayer === true) {
                                                addLog(`⚖️ ${ally.name} 既是你的盟友又是 ${aggressorName} 的盟友，决定保持中立。`);
                                                return;
                                            }

                                            // 检查战争上限：如果已达上限，盟友保持中立
                                            if (currentWarsWithPlayer >= MAX_CONCURRENT_WARS) {
                                                addLog(`⚖️ ${ally.name} 虽是 ${aggressorName} 的盟友，但考虑到局势复杂，决定暂时观望。`);
                                                return;
                                            }

                                            // 否则，加入侵略者一方，对玩家宣战
                                            const allyIdx = nextNations.findIndex(n => n.id === ally.id);
                                            if (allyIdx !== -1) {
                                                nextNations[allyIdx] = {
                                                    ...nextNations[allyIdx],
                                                    isAtWar: true,
                                                    warStartDay: daysElapsed,
                                                    warDuration: 0,
                                                    relation: 0 // 与玩家关系破裂
                                                };
                                                currentWarsWithPlayer++; // 更新计数
                                                addLog(`⚔️ ${ally.name} 作为 ${aggressorName} 的盟友，对你宣战！`);
                                            }
                                        });

                                        // 3. 处理玩家的盟友加入战争
                                        playerAllies.forEach(ally => {
                                            // 检查中立原则：如果该盟友同时也与侵略者正式结盟，则保持中立
                                            const aggressorNation = nextNations[aggressorIdx];
                                            const isAlsoAggressorAlly = (aggressorNation.allies || []).includes(ally.id) ||
                                                (ally.allies || []).includes(aggressorId);
                                            if (isAlsoAggressorAlly) {
                                                // 日志已在上一步处理（双向的，只需触发一次提示即可，或者重复提示也没关系）
                                                // addLog(`⚖️ 你的盟友 ${ally.name} 与 ${aggressorName} 关系密切，决定保持中立。`); 
                                                // 上面的逻辑已经涵盖了这种情况（因为是遍历两组盟友，同一个国家可能出现在两组中）
                                                // 但为了清晰，这里只提示一次 "保持中立" 比较好。
                                                // 实际上 ally 在这里肯定出现在 playerAllies 列表中。
                                                // 如果它也在 aggressorAllies 列表中，它会在上面的循环被处理吗？
                                                // 上面的循环遍历 aggressorAllies，如果它与玩家关系好，会中立。
                                                // 这里的循环遍历 playerAllies，如果它与侵略者关系好，也会中立。
                                                // 结果是一致的：只要既是A盟友又是C盟友，就不参战。
                                                return;
                                            }

                                            // 否则，该盟友对侵略者及其盟友宣战 (设置 foreignWars)
                                            const allyIdx = nextNations.findIndex(n => n.id === ally.id);
                                            if (allyIdx !== -1) {
                                                const updatedAlly = { ...nextNations[allyIdx] };
                                                if (!updatedAlly.foreignWars) updatedAlly.foreignWars = {};

                                                // 对侵略者宣战
                                                updatedAlly.foreignWars[aggressorId] = {
                                                    isAtWar: true,
                                                    warStartDay: daysElapsed,
                                                    warScore: 0
                                                };

                                                // 同时也需要更新侵略者的 foreignWars 状态，标记它与该盟友开战了
                                                // 注意：aggressorIdx 的引用如果不更新，可能导致状态不一致
                                                // 我们直接修改 nextNations 数组中的对象
                                                if (!nextNations[aggressorIdx].foreignWars) nextNations[aggressorIdx].foreignWars = {};
                                                nextNations[aggressorIdx].foreignWars[ally.id] = {
                                                    isAtWar: true,
                                                    warStartDay: daysElapsed,
                                                    warScore: 0
                                                };

                                                nextNations[allyIdx] = updatedAlly;
                                                addLog(`🛡️ 你的盟友 ${ally.name} 响应号召，对 ${aggressorName} 宣战！`);
                                            }
                                        });

                                        return nextNations;
                                    });

                                } catch (e) {
                                    debugError('event', '[EVENT DEBUG] Failed to parse war declaration event:', e);
                                }
                            }
                            // 兼容旧的宣战检测逻辑
                            else if (log.includes('对你发动了战争') && !log.includes('WAR_DECLARATION_EVENT')) {
                                const match = log.match(/⚠️ (.+) 对你发动了战争/);
                                if (match) {
                                    const nationName = match[1];
                                    const nation = result.nations?.find(n => n.name === nationName);
                                    if (nation) {
                                        const event = createWarDeclarationEvent(nation, () => {
                                            // 宣战事件只需要确认，不需要额外操作
                                        });
                                        currentActions.triggerDiplomaticEvent(event);
                                    }
                                }
                            }

                            // 检测和平请求事件
                            if (log.includes('请求和平')) {
                                debugLog('event', '[EVENT DEBUG] Peace request detected in log:', log);
                                const match = log.match(/🤝 (.+) 请求和平，愿意支付 (\d+) 银币作为赔款/);
                                debugLog('event', '[EVENT DEBUG] Regex match result:', match);
                                if (match) {
                                    const nationName = match[1];
                                    const tribute = parseInt(match[2], 10);
                                    debugLog('event', '[EVENT DEBUG] Looking for nation:', nationName);
                                    debugLog('event', '[EVENT DEBUG] result.nations:', result.nations?.map(n => ({ name: n.name, isPeaceRequesting: n.isPeaceRequesting })));
                                    const nation = result.nations?.find(n => n.name === nationName);
                                    debugLog('event', '[EVENT DEBUG] Found nation:', nation?.name, 'isPeaceRequesting:', nation?.isPeaceRequesting);
                                    if (nation && nation.isPeaceRequesting) {
                                        debugLog('event', '[EVENT DEBUG] Creating peace request event...');
                                        debugLog('event', '[EVENT DEBUG] Parameters:', {
                                            nation: nation.name,
                                            nationId: nation.id,
                                            tribute,
                                            warScore: nation.warScore || 0,
                                            population: nation.population
                                        });
                                        try {
                                            const event = createEnemyPeaceRequestEvent(
                                                nation,
                                                tribute,
                                                nation.warScore || 0,
                                                (accepted, proposalType, amount) => {
                                                    // 处理和平请求的回调
                                                    if (accepted) {
                                                        currentActions.handleEnemyPeaceAccept(nation.id, proposalType, amount || tribute);
                                                    } else {
                                                        currentActions.handleEnemyPeaceReject(nation.id);
                                                    }
                                                }
                                            );
                                            debugLog('event', '[EVENT DEBUG] Event created:', event);
                                            debugLog('event', '[EVENT DEBUG] Calling triggerDiplomaticEvent...');
                                            currentActions.triggerDiplomaticEvent(event);
                                            debugLog('event', '[EVENT DEBUG] triggerDiplomaticEvent called');
                                        } catch (error) {
                                            debugError('event', '[EVENT DEBUG] Error creating or triggering event:', error);
                                        }
                                        // 清除和平请求标志，避免重复触发
                                        setNations(prev => prev.map(n =>
                                            n.id === nation.id ? { ...n, isPeaceRequesting: false } : n
                                        ));
                                    }
                                }
                            }

                            // 检测叛军投降事件
                            if (log.includes('请求投降')) {
                                const surrenderMatch = log.match(/🏳️ (.+) (?:已陷入绝境|已经崩溃)，(?:请求|恳求)投降/);
                                if (surrenderMatch) {
                                    const nationName = surrenderMatch[1];
                                    const nation = result.nations?.find(n => n.name === nationName && n.isRebelNation);
                                    if (nation && nation.isPeaceRequesting) {
                                        debugLog('event', '[EVENT DEBUG] Rebel surrender detected:', nationName);
                                        // 创建叛军投降事件（直接使用叛乱结束事件）
                                        // 注意：回调只处理效果，不再调用 handleRebellionWarEnd 避免重复
                                        const surrenderEvent = createRebellionEndEvent(
                                            nation,
                                            true, // 玩家胜利
                                            current.resources?.silver || 0,
                                            (action) => {
                                                // 效果由事件本身的 effects 处理，这里只做日志
                                                debugLog('gameLoop', '[REBELLION SURRENDER]', action, nation?.name);
                                            }
                                        );
                                        currentActions.triggerDiplomaticEvent(surrenderEvent);

                                        // 直接处理叛军移除和状态重置（不再通过 handleRebellionWarEnd）
                                        const stratumKey = nation.rebellionStratum;
                                        if (stratumKey) {
                                            // 恢复部分人口
                                            const recoveredPop = Math.floor((nation.population || 0) * 0.5);
                                            if (recoveredPop > 0) {
                                                setPopStructure(prev => ({
                                                    ...prev,
                                                    [stratumKey]: (prev[stratumKey] || 0) + recoveredPop,
                                                }));
                                            }
                                            // 重置组织度
                                            setRebellionStates(prev => ({
                                                ...prev,
                                                [stratumKey]: {
                                                    ...prev?.[stratumKey],
                                                    organization: 15,
                                                    dissatisfactionDays: 0,
                                                    organizationPaused: 0,
                                                },
                                            }));
                                        }
                                        // 移除叛军
                                        setNations(prev => prev.filter(n => n.id !== nation.id));
                                    }
                                }
                            }

                            // 检测叛军勒索/最后通牒事件
                            if (log.includes('REBEL_DEMAND_SURRENDER:')) {
                                try {
                                    const jsonStr = log.replace('REBEL_DEMAND_SURRENDER:', '');
                                    const data = JSON.parse(jsonStr);
                                    const nation = result.nations?.find(n => n.id === data.nationId);

                                    if (nation) {
                                        const event = createRebelDemandSurrenderEvent(nation, data, (action, nationObj, eventData) => {
                                            debugLog('gameLoop', '[REBEL ULTIMATUM] Callback triggered:', action, eventData.demandType);
                                            if (action === 'accept') {
                                                // 1. 根据类型扣除资源
                                                if (eventData.demandType === 'massacre') {
                                                    // 屠杀：扣除人口和人口上限
                                                    const popLoss = eventData.demandAmount || 0;
                                                    setPopulation(prev => Math.max(10, prev - popLoss));
                                                    setMaxPop(prev => Math.max(20, prev - popLoss));
                                                    addLog(`💀 叛军进行了大屠杀，你失去了 ${popLoss} 人口和人口上限！`);

                                                    // 对应阶层人口也需减少
                                                    const massacreStratumKey = nationObj.rebellionStratum;
                                                    if (massacreStratumKey) {
                                                        setPopStructure(prev => ({
                                                            ...prev,
                                                            [massacreStratumKey]: Math.max(0, (prev[massacreStratumKey] || 0) - popLoss)
                                                        }));
                                                    }
                                                } else if (eventData.demandType === 'reform') {
                                                    // 改革妥协：一次性从国库扣除银币，转入该阶层的财富
                                                    const reformAmount = eventData.demandAmount || 0;
                                                    const coalitionStrata = eventData.coalitionStrata || [eventData.reformStratum || nationObj.rebellionStratum];
                                                    debugLog('gameLoop', '[REBEL REFORM] Amount:', reformAmount, 'Coalition:', coalitionStrata);

                                                    // 扣除银币
                                                    setResources(prev => ({
                                                        ...prev,
                                                        silver: Math.max(0, (prev.silver || 0) - reformAmount)
                                                    }));

                                                    // 按人口比例分配给各阶层
                                                    const popShare = {};
                                                    let totalPop = 0;
                                                    coalitionStrata.forEach(sKey => {
                                                        const pop = current.popStructure?.[sKey] || 0;
                                                        popShare[sKey] = pop;
                                                        totalPop += pop;
                                                    });

                                                    // 如果总人口为0，平均分配
                                                    if (totalPop === 0) {
                                                        coalitionStrata.forEach(sKey => {
                                                            popShare[sKey] = 1;
                                                        });
                                                        totalPop = coalitionStrata.length;
                                                    }

                                                    // 将钱按比例转入各阶层财富
                                                    const distributions = [];
                                                    setClassWealth(prev => {
                                                        const newWealth = { ...prev };
                                                        coalitionStrata.forEach(sKey => {
                                                            const share = popShare[sKey] / totalPop;
                                                            const amount = Math.floor(reformAmount * share);
                                                            newWealth[sKey] = (newWealth[sKey] || 0) + amount;
                                                            distributions.push(`${STRATA[sKey]?.name || sKey}(${amount})`);
                                                        });
                                                        debugLog('gameLoop', '[REBEL REFORM] Distributed:', distributions.join(', '));
                                                        return newWealth;
                                                    });

                                                    const distribDesc = coalitionStrata.length > 1
                                                        ? `（按比例分配给：${distributions.join('、')}）`
                                                        : '';
                                                    addLog(`💸 你接受了叛军的改革要求，支付了 ${reformAmount} 银币${distribDesc}。`);
                                                } else if (eventData.demandType === 'subsidy') {
                                                    // 强制补贴：设置为期一年的每日补贴效果，按比例分配给所有联盟阶层
                                                    const subsidyDaily = eventData.subsidyDailyAmount || Math.ceil((eventData.demandAmount || 0) / 365);
                                                    const subsidyTotal = eventData.demandAmount || 0;
                                                    const coalitionStrata = eventData.coalitionStrata || [eventData.subsidyStratum || nationObj.rebellionStratum];
                                                    debugLog('gameLoop', '[REBEL SUBSIDY] Daily:', subsidyDaily, 'Total:', subsidyTotal, 'Coalition:', coalitionStrata);

                                                    // 按人口比例计算每个阶层的份额
                                                    const popShare = {};
                                                    let totalPop = 0;
                                                    coalitionStrata.forEach(sKey => {
                                                        const pop = current.popStructure?.[sKey] || 0;
                                                        popShare[sKey] = pop;
                                                        totalPop += pop;
                                                    });

                                                    // 如果总人口为0，平均分配
                                                    if (totalPop === 0) {
                                                        coalitionStrata.forEach(sKey => {
                                                            popShare[sKey] = 1;
                                                        });
                                                        totalPop = coalitionStrata.length;
                                                    }

                                                    // 为每个阶层添加补贴效果
                                                    const subsidyDescParts = [];
                                                    setActiveEventEffects(prev => {
                                                        debugLog('gameLoop', '[REBEL SUBSIDY] Previous state:', prev);

                                                        const newSubsidies = coalitionStrata.map(sKey => {
                                                            const share = popShare[sKey] / totalPop;
                                                            const dailyAmount = Math.floor(subsidyDaily * share);
                                                            const stratumName = STRATA[sKey]?.name || sKey;
                                                            subsidyDescParts.push(`${stratumName}(${dailyAmount}/天)`);

                                                            return {
                                                                id: `rebel_subsidy_${nationObj.id}_${sKey}_${Date.now()}`,
                                                                type: 'rebel_forced_subsidy',
                                                                name: `对${stratumName}的强制补贴`,
                                                                description: `每日支付 ${dailyAmount} 银币给${stratumName}`,
                                                                stratumKey: sKey,
                                                                dailyAmount: dailyAmount,
                                                                remainingDays: 365,
                                                                createdAt: current.daysElapsed,
                                                            };
                                                        });

                                                        const newEffects = {
                                                            ...prev,
                                                            forcedSubsidy: [
                                                                ...(prev?.forcedSubsidy || []),
                                                                ...newSubsidies
                                                            ]
                                                        };
                                                        debugLog('gameLoop', '[REBEL SUBSIDY] Added', newSubsidies.length, 'subsidies');
                                                        return newEffects;
                                                    });

                                                    const distribDesc = coalitionStrata.length > 1
                                                        ? `（按比例分配给：${subsidyDescParts.join('、')}）`
                                                        : `给${STRATA[coalitionStrata[0]]?.name || '起义阶层'}`;
                                                    addLog(`📜 你接受了叛军的强制补贴要求，将在未来一年内每日支付 ${subsidyDaily} 银币${distribDesc}（共 ${subsidyTotal} 银币）。`);
                                                }

                                                // 2. 立即结束战争，移除叛军国家并重置状态
                                                // 使用 handleRebellionWarEnd 函数（与玩家主动求和使用相同的函数）
                                                // 这个函数会正确删除叛军、重置状态并触发"屈辱的和平"事件
                                                if (actions?.handleRebellionWarEnd) {
                                                    debugLog('gameLoop', '[REBEL] Calling handleRebellionWarEnd for defeat...');
                                                    actions.handleRebellionWarEnd(nationObj.id, false); // false = 玩家失败
                                                } else {
                                                    debugError('gameLoop', '[REBEL] handleRebellionWarEnd not available!');
                                                    // 备用方案：手动清理
                                                    const rebellionStratumKey = nationObj.rebellionStratum;
                                                    setNations(prev => prev.filter(n => n.id !== nationObj.id));
                                                    if (rebellionStratumKey) {
                                                        setRebellionStates(prev => ({
                                                            ...prev,
                                                            [rebellionStratumKey]: {
                                                                ...prev[rebellionStratumKey],
                                                                organization: 20,
                                                                dissatisfactionDays: 0,
                                                            }
                                                        }));
                                                    }
                                                    setStability(prev => Math.max(0, (prev || 50) - 20));
                                                }
                                            } else {
                                                addLog(`⚔️ 你拒绝了叛军的(${eventData.demandType})要求，战争继续！`);
                                            }
                                        });
                                        currentActions.triggerDiplomaticEvent(event);
                                    }
                                } catch (e) {
                                    debugError('event', '[EVENT DEBUG] Failed to parse rebel demand:', e);
                                }
                            }

                            // 检测 AI 送礼事件
                            if (log.includes('AI_GIFT_EVENT:')) {
                                try {
                                    const jsonStr = log.replace('AI_GIFT_EVENT:', '');
                                    const eventData = JSON.parse(jsonStr);
                                    const nation = result.nations?.find(n => n.id === eventData.nationId);
                                    if (nation && currentActions && currentActions.triggerDiplomaticEvent) {
                                        const event = createGiftEvent(nation, eventData.amount, () => {
                                            // 接受礼物的回调
                                            setResources(prev => ({ ...prev, silver: (prev.silver || 0) + eventData.amount }));
                                            setNations(prev => prev.map(n => n.id === nation.id ? { ...n, relation: Math.min(100, (n.relation || 0) + 15) } : n));
                                            addLog(`💰 你接受了 ${nation.name} 的礼物，获得 ${eventData.amount} 银币。`);
                                        });
                                        currentActions.triggerDiplomaticEvent(event);
                                        debugLog('event', '[EVENT DEBUG] AI Gift event triggered:', nation.name, eventData.amount);
                                    }
                                } catch (e) {
                                    debugError('event', '[EVENT DEBUG] Failed to parse AI gift event:', e);
                                }
                            }

                            // 检测 AI 索要事件
                            if (log.includes('AI_REQUEST_EVENT:')) {
                                try {
                                    const jsonStr = log.replace('AI_REQUEST_EVENT:', '');
                                    const eventData = JSON.parse(jsonStr);
                                    const nation = result.nations?.find(n => n.id === eventData.nationId);
                                    if (nation && currentActions && currentActions.triggerDiplomaticEvent) {
                                        const event = createAIRequestEvent(nation, eventData.resourceKey, eventData.resourceName, eventData.amount, (accepted) => {
                                            if (accepted) {
                                                const currentSilver = current.resources?.silver || 0;
                                                if (currentSilver < eventData.amount) {
                                                    addLog(`❌ 银币不足，无法满足 ${nation.name} 的请求！`);
                                                    return;
                                                }
                                                setResources(prev => ({ ...prev, silver: (prev.silver || 0) - eventData.amount }));
                                                setNations(prev => prev.map(n => n.id === nation.id ? { ...n, relation: Math.min(100, (n.relation || 0) + 10) } : n));
                                                addLog(`🤝 你满足了 ${nation.name} 的请求，关系提升了。`);
                                            } else {
                                                setNations(prev => prev.map(n => n.id === nation.id ? { ...n, relation: Math.max(0, (n.relation || 0) - 15) } : n));
                                                addLog(`❌ 你拒绝了 ${nation.name} 的请求，关系恶化了。`);
                                            }
                                        });
                                        currentActions.triggerDiplomaticEvent(event);
                                        debugLog('event', '[EVENT DEBUG] AI Request event triggered:', nation.name, eventData.amount);
                                    }
                                } catch (e) {
                                    debugError('event', '[EVENT DEBUG] Failed to parse AI request event:', e);
                                }
                            }

                            // 检测 AI 联盟请求事件
                            if (log.includes('AI_ALLIANCE_REQUEST:')) {
                                try {
                                    const jsonStr = log.replace('AI_ALLIANCE_REQUEST:', '');
                                    const eventData = JSON.parse(jsonStr);
                                    const nation = result.nations?.find(n => n.id === eventData.nationId);
                                    if (nation && currentActions && currentActions.triggerDiplomaticEvent) {
                                        const event = createAllianceRequestEvent(nation, (accepted) => {
                                            if (accepted) {
                                                setNations(prev => prev.map(n =>
                                                    n.id === nation.id
                                                        ? { ...n, alliedWithPlayer: true, relation: Math.min(100, (n.relation || 0) + 20) }
                                                        : n
                                                ));
                                                addLog(`🤝 你接受了 ${nation.name} 的结盟请求！你们正式成为盟友！`);
                                            } else {
                                                setNations(prev => prev.map(n =>
                                                    n.id === nation.id
                                                        ? { ...n, relation: Math.max(0, (n.relation || 0) - 10) }
                                                        : n
                                                ));
                                                addLog(`你婉言谢绝了 ${nation.name} 的结盟请求，关系略有下降。`);
                                            }
                                        });
                                        currentActions.triggerDiplomaticEvent(event);
                                        debugLog('event', '[EVENT DEBUG] AI Alliance Request event triggered:', nation.name);
                                    }
                                } catch (e) {
                                    debugError('event', '[EVENT DEBUG] Failed to parse AI alliance request event:', e);
                                }
                            }

                            // Treaty 2.0 MVP: 检测 AI 条约提案事件
                            if (log.includes('AI_TREATY_PROPOSAL:')) {
                                try {
                                    const jsonStr = log.replace('AI_TREATY_PROPOSAL:', '');
                                    const eventData = JSON.parse(jsonStr);
                                    const nation = result.nations?.find(n => n.id === eventData.nationId);
                                    const treaty = eventData.treaty || null;

                                    if (nation && treaty && currentActions && currentActions.triggerDiplomaticEvent) {
                                        const event = createTreatyProposalEvent(nation, treaty, (accepted) => {
                                            if (accepted) {
                                                setNations(prev => prev.map(n => {
                                                    if (n.id !== nation.id) return n;

                                                    const nextTreaties = Array.isArray(n.treaties) ? [...n.treaties] : [];
                                                    nextTreaties.push({
                                                        id: `treaty_${n.id}_${Date.now()}`,
                                                        type: treaty.type,
                                                        startDay: daysElapsed,
                                                        endDay: daysElapsed + Math.max(1, Math.floor(Number(treaty.durationDays) || 365)),
                                                        maintenancePerDay: Math.max(0, Math.floor(Number(treaty.maintenancePerDay) || 0)),
                                                        direction: 'ai_to_player',
                                                    });

                                                    const durationDays = Math.max(1, Math.floor(Number(treaty.durationDays) || 365));
                                                    const updates = { treaties: nextTreaties, relation: Math.min(100, (n.relation || 0) + 8) };

                                                    // Minimal effects reuse existing fields for immediate gameplay impact
                                                    if (OPEN_MARKET_TREATY_TYPES.includes(treaty.type)) {
                                                        updates.openMarketUntil = Math.max(n.openMarketUntil || 0, daysElapsed + durationDays);
                                                    }
                                                    if (PEACE_TREATY_TYPES.includes(treaty.type)) {
                                                        updates.peaceTreatyUntil = Math.max(n.peaceTreatyUntil || 0, daysElapsed + durationDays);
                                                    }
                                                    if (treaty.type === 'defensive_pact') {
                                                        updates.alliedWithPlayer = true;
                                                    }

                                                    return { ...n, ...updates };
                                                }));
                                                addLog(`📜 你与 ${nation.name} 签署了条约（${treaty.type}）。`);
                                            } else {
                                                setNations(prev => prev.map(n =>
                                                    n.id === nation.id
                                                        ? { ...n, relation: Math.max(0, (n.relation || 0) - 8) }
                                                        : n
                                                ));
                                                addLog(`📜 你拒绝了 ${nation.name} 的条约提案，关系下降。`);
                                            }
                                        });

                                        currentActions.triggerDiplomaticEvent(event);
                                        debugLog('event', '[EVENT DEBUG] AI Treaty Proposal event triggered:', nation.name, treaty?.type);
                                    }
                                } catch (e) {
                                    debugError('event', '[EVENT DEBUG] Failed to parse AI treaty proposal event:', e);
                                }
                            }

                            // AI条约撕毁通知
                            if (log.includes('AI_TREATY_BREACH:')) {
                                try {
                                    const jsonStr = log.replace('AI_TREATY_BREACH:', '');
                                    const eventData = JSON.parse(jsonStr);
                                    const nation = result.nations?.find(n => n.id === eventData.nationId);
                                    if (nation && currentActions && currentActions.triggerDiplomaticEvent) {
                                        const event = createTreatyBreachEvent(nation, {
                                            relationPenalty: eventData.relationPenalty,
                                        }, () => { });
                                        currentActions.triggerDiplomaticEvent(event);
                                        debugLog('event', '[EVENT DEBUG] AI Treaty Breach event triggered:', nation.name);
                                    }
                                } catch (e) {
                                    debugError('event', '[EVENT DEBUG] Failed to parse AI treaty breach event:', e);
                                }
                            }

                            // 附庸国独立战争事件
                            if (log.includes('VASSAL_INDEPENDENCE_WAR:')) {
                                try {
                                    const jsonStr = log.replace('VASSAL_INDEPENDENCE_WAR:', '');
                                    const eventData = JSON.parse(jsonStr);
                                    const nation = result.nations?.find(n => n.id === eventData.nationId);
                                    if (nation && currentActions && currentActions.triggerDiplomaticEvent) {
                                        const event = createIndependenceWarEvent(nation, {
                                            vassalType: nation.vassalType,
                                            autonomy: nation.autonomy,
                                            independencePressure: nation.independencePressure,
                                            tributeRate: nation.tributeRate,
                                        }, (action) => {
                                            if (action === 'crush') {
                                                // 镇压：维持战争状态，降低稳定度
                                                setStability(prev => Math.max(0, prev - 10));
                                                addLog(`⚔️ 你决定出兵镇压 ${nation.name} 的叛乱！`);
                                            } else if (action === 'negotiate') {
                                                // 谈判：尝试取消战争，大幅提高自主度和降低朝贡率
                                                setNations(prev => prev.map(n => {
                                                    if (n.id !== nation.id) return n;
                                                    return {
                                                        ...n,
                                                        isAtWar: false,
                                                        warTarget: null,
                                                        independenceWar: false,
                                                        vassalOf: 'player',
                                                        autonomy: Math.min(100, (n.autonomy || 50) + 25),
                                                        tributeRate: Math.max(0.02, (n.tributeRate || 0.1) * 0.5),
                                                        independencePressure: Math.max(0, (n.independencePressure || 0) - 30),
                                                    };
                                                }));
                                                addLog(`📜 你与 ${nation.name} 达成协议，提高其自主度并降低朝贡，叛乱平息。`);
                                            } else if (action === 'release') {
                                                // 释放：承认独立，关系提升
                                                setNations(prev => prev.map(n => {
                                                    if (n.id !== nation.id) return n;
                                                    return {
                                                        ...n,
                                                        isAtWar: false,
                                                        warTarget: null,
                                                        independenceWar: false,
                                                        vassalOf: null,
                                                        vassalType: null,
                                                        autonomy: 100,
                                                        tributeRate: 0,
                                                        independencePressure: 0,
                                                        relation: Math.min(100, (n.relation || 50) + 30),
                                                    };
                                                }));
                                                addLog(`🏳️ 你承认了 ${nation.name} 的独立，对方感激你的明智决定。`);
                                            }
                                        });
                                        currentActions.triggerDiplomaticEvent(event);
                                        debugLog('event', '[EVENT DEBUG] Independence War event triggered:', nation.name);
                                    }
                                } catch (e) {
                                    debugError('event', '[EVENT DEBUG] Failed to parse independence war event:', e);
                                }
                            }

                            // 检测盟友冷淡事件
                            if (log.includes('ALLY_COLD_EVENT:')) {
                                try {
                                    const jsonStr = log.replace('ALLY_COLD_EVENT:', '');
                                    const eventData = JSON.parse(jsonStr);
                                    const nation = result.nations?.find(n => n.id === eventData.nationId);
                                    if (nation && currentActions && currentActions.triggerDiplomaticEvent) {
                                        const event = createAllyColdEvent(nation, eventData.relation, (action, giftCost) => {
                                            if (action === 'gift') {
                                                // 检查银币是否足够
                                                const currentSilver = current.resources?.silver || 0;
                                                if (currentSilver < giftCost) {
                                                    addLog(`❌ 银币不足，无法向 ${nation.name} 赠送礼物！`);
                                                    return;
                                                }
                                                setResources(prev => ({ ...prev, silver: (prev.silver || 0) - giftCost }));
                                                setNations(prev => prev.map(n =>
                                                    n.id === nation.id
                                                        ? { ...n, relation: Math.min(100, (n.relation || 0) + 15) }
                                                        : n
                                                ));
                                                addLog(`💝 你向盟友 ${nation.name} 赠送了礼物，关系改善了（+15）。`);
                                            } else {
                                                // 不管：关系继续下降，增加解盟风险
                                                setNations(prev => prev.map(n =>
                                                    n.id === nation.id
                                                        ? { ...n, relation: Math.max(0, (n.relation || 0) - 5), allianceStrain: ((n.allianceStrain || 0) + 1) }
                                                        : n
                                                ));
                                                addLog(`😐 你忽视了盟友 ${nation.name} 的关系问题，同盟关系出现裂痕。`);
                                            }
                                        });
                                        currentActions.triggerDiplomaticEvent(event);
                                        debugLog('event', '[EVENT DEBUG] Ally Cold event triggered:', nation.name);
                                    }
                                } catch (e) {
                                    debugError('event', '[EVENT DEBUG] Failed to parse Ally Cold event:', e);
                                }
                            }

                            // 检测AI贸易事件（资源变化已在simulation中处理，这里只需记录和显示）
                            if (log.includes('AI_TRADE_EVENT:')) {
                                try {
                                    const jsonStr = log.replace('AI_TRADE_EVENT:', '');
                                    const eventData = JSON.parse(jsonStr);
                                    const resourceName = RESOURCES[eventData.resourceKey]?.name || eventData.resourceKey;

                                    // 将关税计入tradeStats，显示在财政面板中
                                    if (eventData.tariff > 0) {
                                        setTradeStats(prev => ({ ...prev, tradeTax: (prev.tradeTax || 0) + eventData.tariff }));
                                    }

                                    // 生成详细的贸易日志（玩家政府只收关税）
                                    // 这些属于“贸易路线/市场贸易”类日志，受 showTradeRouteLogs 控制
                                    if (shouldLogTradeRoutes) {
                                        if (eventData.tradeType === 'export') {
                                            // 玩家出口：资源减少，只收关税
                                            if (eventData.tariff > 0) {
                                                addLog(`📦 ${eventData.nationName} 从你的市场购买了 ${eventData.quantity} ${resourceName}，你收取 ${eventData.tariff} 关税。`);
                                            } else {
                                                addLog(`📦 ${eventData.nationName} 从你的市场购买了 ${eventData.quantity} ${resourceName}（开放市场，无关税）。`);
                                            }
                                        } else if (eventData.tradeType === 'import') {
                                            // 玩家进口：资源增加，只收关税
                                            if (eventData.tariff > 0) {
                                                addLog(`📦 ${eventData.nationName} 向你的市场出售了 ${eventData.quantity} ${resourceName}，你收取 ${eventData.tariff} 关税。`);
                                            } else {
                                                addLog(`📦 ${eventData.nationName} 向你的市场出售了 ${eventData.quantity} ${resourceName}（开放市场，无关税）。`);
                                            }
                                        } else {
                                            // 旧版兼容
                                            if (eventData.tariff > 0) {
                                                addLog(`📦 ${eventData.nationName} 与你进行了贸易，你收取 ${eventData.tariff} 关税。`);
                                            }
                                        }
                                    }
                                } catch (e) {
                                    debugError('event', '[EVENT DEBUG] Failed to parse AI Trade event:', e);
                                }
                            }

                            // 检测AI要求投降事件
                            if (log.includes('AI_DEMAND_SURRENDER:')) {
                                try {
                                    const jsonStr = log.replace('AI_DEMAND_SURRENDER:', '');
                                    const eventData = JSON.parse(jsonStr);
                                    const nation = result.nations?.find(n => n.id === eventData.nationId);
                                    if (nation && currentActions && currentActions.triggerDiplomaticEvent) {
                                        // 传入玩家状态以便正确计算赔款选项
                                        const playerState = {
                                            population: current.population || 100,
                                            maxPopulation: current.maxPop || 1000,
                                            wealth: current.resources?.silver || 10000,
                                        };
                                        const event = createAIDemandSurrenderEvent(
                                            nation,
                                            eventData.warScore,
                                            { type: eventData.demandType, amount: eventData.demandAmount },
                                            playerState,
                                            (actionType, amount) => {
                                                if (actionType === 'reject') {
                                                    addLog(`⚔️ 你拒绝了 ${nation.name} 的投降要求，战争继续！`);
                                                    return;
                                                }

                                                // 根据选择类型处理不同的投降条件
                                                if (actionType === 'pay_high' || actionType === 'pay_standard' || actionType === 'pay_moderate') {
                                                    // 一次性支付赔款
                                                    const currentSilver = current.resources?.silver || 0;
                                                    if (currentSilver < amount) {
                                                        addLog(`❌ 银币不足（需要 ${amount}，当前 ${Math.floor(currentSilver)}），无法接受投降条件！`);
                                                        return;
                                                    }
                                                    setResources(prev => ({ ...prev, silver: Math.max(0, (prev.silver || 0) - amount) }));
                                                    addLog(`💰 你向 ${nation.name} 支付了 ${amount} 银币赔款。`);
                                                } else if (actionType === 'pay_installment') {
                                                    // 分期付款 - amount 是每日金额
                                                    // 设置玩家的分期支付状态（不是敌国的！）
                                                    gameState.setPlayerInstallmentPayment({
                                                        nationId: nation.id,
                                                        amount: amount,
                                                        remainingDays: 365,
                                                        totalAmount: amount * 365,
                                                        paidAmount: 0,
                                                    });
                                                    addLog(`📜 你同意在365天内每日向 ${nation.name} 支付 ${amount} 银币（共计 ${amount * 365} 银币）。`);
                                                } else if (actionType === 'offer_population') {
                                                    // 割让人口：扣减人口与人口上限加成，避免下一tick被模拟重算覆盖
                                                    const currentPop = current.population || 0;
                                                    if (currentPop < amount + 10) {
                                                        addLog(`❌ 人口不足（需要 ${amount}，当前 ${Math.floor(currentPop)}），无法接受投降条件！`);
                                                        return;
                                                    }
                                                    setPopulation(prev => Math.max(10, prev - amount));
                                                    setMaxPopBonus(prev => Math.max(-currentPop + 10, prev - amount));
                                                    addLog(`🏴 你向 ${nation.name} 割让了 ${amount} 人口的领土。`);
                                                }

                                                // 结束战争
                                                setNations(prev => prev.map(n => n.id === nation.id ? {
                                                    ...n,
                                                    isAtWar: false,
                                                    warScore: 0,
                                                    warDuration: 0,
                                                    peaceTreatyUntil: current.daysElapsed + 365
                                                } : n));
                                            }
                                        );
                                        currentActions.triggerDiplomaticEvent(event);
                                        debugLog('event', '[EVENT DEBUG] AI Demand Surrender event triggered:', nation.name);
                                    }
                                } catch (e) {
                                    debugError('event', '[EVENT DEBUG] Failed to parse AI Demand Surrender event:', e);
                                }
                            }

                            // 检测AI主动提出无条件和平事件（玩家处于绝境时）
                            if (log.includes('AI_MERCY_PEACE_OFFER:')) {
                                try {
                                    const jsonStr = log.replace('AI_MERCY_PEACE_OFFER:', '');
                                    const eventData = JSON.parse(jsonStr);
                                    const nation = result.nations?.find(n => n.id === eventData.nationId);
                                    if (nation && currentActions && currentActions.triggerDiplomaticEvent) {
                                        // 创建仁慈和平事件
                                        const event = {
                                            id: `mercy_peace_${eventData.nationId}_${Date.now()}`,
                                            type: 'diplomacy',
                                            name: '🕊️ 无条件和平提议',
                                            title: '🕊️ 无条件和平提议',
                                            icon: 'HandHeart',
                                            isDiplomaticEvent: true,
                                            description: `${eventData.nationName} 见你国力衰弱，已无力继续作战，愿意无条件停战。\n\n这是一个难得的喘息机会，接受后双方将签订和平条约。`,
                                            nationId: eventData.nationId,
                                            nationName: eventData.nationName,
                                            warScore: eventData.warScore,
                                            warDuration: eventData.warDuration,
                                            options: [
                                                {
                                                    id: 'accept',
                                                    text: '🕊️ 接受和平',
                                                    description: '结束战争，签订和平条约',
                                                    style: 'success',
                                                    effects: {},
                                                    callback: () => {
                                                        // 接受和平，结束战争
                                                        setNations(prev => prev.map(n => n.id === eventData.nationId ? {
                                                            ...n,
                                                            isAtWar: false,
                                                            warScore: 0,
                                                            warDuration: 0,
                                                            peaceTreatyUntil: current.daysElapsed + 365, // 1年和平条约
                                                            isMercyPeaceOffering: false,
                                                            relation: Math.min(100, (n.relation || 50) + 10), // 关系略微改善
                                                        } : n));
                                                        addLog(`🕊️ 你接受了 ${eventData.nationName} 的和平提议，战争结束。`);
                                                    },
                                                },
                                                {
                                                    id: 'reject',
                                                    text: '⚔️ 拒绝',
                                                    description: '继续战争（不推荐）',
                                                    style: 'danger',
                                                    effects: {},
                                                    callback: () => {
                                                        // 拒绝和平
                                                        setNations(prev => prev.map(n => n.id === eventData.nationId ? {
                                                            ...n,
                                                            isMercyPeaceOffering: false,
                                                        } : n));
                                                        addLog(`⚔️ 你拒绝了 ${eventData.nationName} 的和平提议，战争继续。`);
                                                    },
                                                },
                                            ],
                                        };
                                        currentActions.triggerDiplomaticEvent(event);
                                        debugLog('event', '[EVENT DEBUG] AI Mercy Peace Offer event triggered:', nation.name);
                                    }
                                } catch (e) {
                                    debugError('event', '[EVENT DEBUG] Failed to parse AI Mercy Peace Offer event:', e);
                                }
                            }

                            // 检测AI解除联盟事件
                            if (log.includes('AI_BREAK_ALLIANCE:')) {
                                try {
                                    const jsonStr = log.replace('AI_BREAK_ALLIANCE:', '');
                                    const eventData = JSON.parse(jsonStr);
                                    const reasonText = eventData.reason === 'relation_low'
                                        ? '由于双方关系恶化'
                                        : '由于你多次忽视盟友问题';
                                    addLog(`💔 ${reasonText}，${eventData.nationName} 决定解除与你的同盟关系！`);
                                } catch (e) {
                                    debugError('event', '[EVENT DEBUG] Failed to parse AI Break Alliance event:', e);
                                }
                            }

                            // 检测盟友被攻击事件
                            if (log.includes('ALLY_ATTACKED_EVENT:')) {
                                try {
                                    const jsonStr = log.replace('ALLY_ATTACKED_EVENT:', '');
                                    const eventData = JSON.parse(jsonStr);
                                    const ally = result.nations?.find(n => n.id === eventData.allyId);
                                    const attacker = result.nations?.find(n => n.id === eventData.attackerId);
                                    if (ally && attacker && currentActions && currentActions.triggerDiplomaticEvent) {
                                        const event = createAllyAttackedEvent(
                                            ally,
                                            attacker,
                                            (helped) => {
                                                if (helped) {
                                                    // 玩家选择援助盟友，对攻击者宣战
                                                    setNations(prev => prev.map(n => {
                                                        if (n.id === attacker.id) {
                                                            return {
                                                                ...n,
                                                                isAtWar: true,
                                                                warStartDay: current.daysElapsed,
                                                                warDuration: 0,
                                                                relation: Math.max(0, (n.relation || 50) - 40),
                                                                lootReserve: (n.wealth || 500) * 1.5, // 初始化掠夺储备
                                                                lastMilitaryActionDay: undefined, // 重置军事行动冷却
                                                            };
                                                        }
                                                        return n;
                                                    }));
                                                    addLog(`⚔️ 你决定援助盟友 ${ally.name}，对 ${attacker.name} 宣战！`);
                                                } else {
                                                    // 玩家拒绝援助：关系大幅下降、联盟终止、背叛者声誉
                                                    setNations(prev => prev.map(n => {
                                                        if (n.id === ally.id) {
                                                            return {
                                                                ...n,
                                                                relation: Math.max(0, (n.relation || 50) - 30),
                                                                alliedWithPlayer: false
                                                            };
                                                        }
                                                        // 其他国家也对玩家印象变差
                                                        return {
                                                            ...n,
                                                            relation: Math.max(0, (n.relation || 50) - 5)
                                                        };
                                                    }));
                                                    addLog(`💔 你拒绝援助盟友 ${ally.name}，${ally.name} 解除与你的联盟！你获得了"背叛者"的声誉。`);
                                                }
                                            }
                                        );
                                        currentActions.triggerDiplomaticEvent(event);
                                        debugLog('event', '[EVENT DEBUG] Ally Attacked event triggered:', ally.name);
                                    }
                                } catch (e) {
                                    debugError('event', '[EVENT DEBUG] Failed to parse Ally Attacked event:', e);
                                }
                            }

                            // 检测海外投资机会事件
                            if (log.includes('OVERSEAS_INVESTMENT_OPPORTUNITY:')) {
                                console.log('[AI投资事件监听] 检测到投资机会日志:', log);
                                try {
                                    const jsonStr = log.replace('OVERSEAS_INVESTMENT_OPPORTUNITY:', '');
                                    const eventData = JSON.parse(jsonStr);
                                    const nation = result.nations?.find(n => n.id === eventData.nationId);
                                    console.log('[AI投资事件监听] 解析成功, nation:', nation?.name, 'currentActions:', !!currentActions, 'triggerDiplomaticEvent:', !!currentActions?.triggerDiplomaticEvent);
                                    if (nation && currentActions && currentActions.triggerDiplomaticEvent) {
                                        const event = createOverseasInvestmentOpportunityEvent(
                                            nation,
                                            eventData.opportunity,
                                            (accepted, investmentDetails) => {
                                                console.log('[AI投资事件监听] 回调被触发, accepted:', accepted, 'details:', investmentDetails);
                                                if (accepted && investmentDetails) {
                                                    // 通过外交行动建立投资
                                                    if (actions?.handleDiplomaticAction) {
                                                        actions.handleDiplomaticAction(nation.id, 'accept_foreign_investment', {
                                                            buildingId: investmentDetails.buildingId,
                                                            ownerStratum: investmentDetails.ownerStratum,
                                                            operatingMode: investmentDetails.operatingMode,
                                                            investmentAmount: investmentDetails.requiredInvestment
                                                        });
                                                    }
                                                }
                                            }
                                        );
                                        console.log('[AI投资事件监听] 创建事件成功, 正在触发:', event);
                                        currentActions.triggerDiplomaticEvent(event);
                                        debugLog('event', '[EVENT DEBUG] Overseas Investment Opportunity event triggered:', nation.name);
                                    } else {
                                        console.log('[AI投资事件监听] 缺少必要条件, nation:', !!nation, 'currentActions:', !!currentActions);
                                    }
                                } catch (e) {
                                    console.error('[AI投资事件监听] 解析失败:', e);
                                    debugError('event', '[EVENT DEBUG] Failed to parse Overseas Investment Opportunity event:', e);
                                }
                            }

                            // 检测外资国有化威胁事件
                            if (log.includes('NATIONALIZATION_THREAT:')) {
                                try {
                                    const jsonStr = log.replace('NATIONALIZATION_THREAT:', '');
                                    const eventData = JSON.parse(jsonStr);
                                    const nation = result.nations?.find(n => n.id === eventData.nationId);
                                    if (nation && currentActions && currentActions.triggerDiplomaticEvent) {
                                        const event = createNationalizationThreatEvent(
                                            nation,
                                            eventData.investment,
                                            (action, details) => {
                                                if (action === 'accept_compensation') {
                                                    // 接受补偿，移除投资
                                                    setResources(prev => ({
                                                        ...prev,
                                                        silver: (prev.silver || 0) + (details?.compensation || 0)
                                                    }));
                                                    addLog(`💰 你接受了 ${nation.name} 的国有化补偿金 ${details?.compensation || 0} 银币。`);
                                                } else if (action === 'negotiate') {
                                                    // 尝试谈判
                                                    setNations(prev => prev.map(n =>
                                                        n.id === nation.id
                                                            ? { ...n, relation: Math.max(0, (n.relation || 50) - 10) }
                                                            : n
                                                    ));
                                                    addLog(`🤝 你尝试与 ${nation.name} 就国有化问题进行谈判，关系下降。`);
                                                } else if (action === 'threaten') {
                                                    // 发出警告
                                                    setNations(prev => prev.map(n =>
                                                        n.id === nation.id
                                                            ? { ...n, relation: Math.max(0, (n.relation || 50) - 25) }
                                                            : n
                                                    ));
                                                    addLog(`⚠️ 你警告 ${nation.name} 不要国有化你的投资，关系严重恶化！`);
                                                }
                                            }
                                        );
                                        currentActions.triggerDiplomaticEvent(event);
                                        debugLog('event', '[EVENT DEBUG] Nationalization Threat event triggered:', nation.name);
                                    }
                                } catch (e) {
                                    debugError('event', '[EVENT DEBUG] Failed to parse Nationalization Threat event:', e);
                                }
                            }

                            // 检测贸易争端事件
                            if (log.includes('TRADE_DISPUTE:')) {
                                try {
                                    const jsonStr = log.replace('TRADE_DISPUTE:', '');
                                    const eventData = JSON.parse(jsonStr);
                                    const nation1 = result.nations?.find(n => n.id === eventData.nation1Id);
                                    const nation2 = result.nations?.find(n => n.id === eventData.nation2Id);
                                    if (nation1 && nation2 && currentActions && currentActions.triggerDiplomaticEvent) {
                                        const event = createTradeDisputeEvent(
                                            nation1,
                                            nation2,
                                            eventData.disputeType,
                                            (decision) => {
                                                if (decision === 'support_nation1') {
                                                    setNations(prev => prev.map(n => {
                                                        if (n.id === nation1.id) return { ...n, relation: Math.min(100, (n.relation || 50) + 10) };
                                                        if (n.id === nation2.id) return { ...n, relation: Math.max(0, (n.relation || 50) - 15) };
                                                        return n;
                                                    }));
                                                    addLog(`⚖️ 你在贸易争端中支持 ${nation1.name}。`);
                                                } else if (decision === 'support_nation2') {
                                                    setNations(prev => prev.map(n => {
                                                        if (n.id === nation2.id) return { ...n, relation: Math.min(100, (n.relation || 50) + 10) };
                                                        if (n.id === nation1.id) return { ...n, relation: Math.max(0, (n.relation || 50) - 15) };
                                                        return n;
                                                    }));
                                                    addLog(`⚖️ 你在贸易争端中支持 ${nation2.name}。`);
                                                } else if (decision === 'mediate') {
                                                    setNations(prev => prev.map(n => {
                                                        if (n.id === nation1.id || n.id === nation2.id) {
                                                            return { ...n, relation: Math.min(100, (n.relation || 50) + 5) };
                                                        }
                                                        return n;
                                                    }));
                                                    addLog(`🤝 你成功调停了 ${nation1.name} 与 ${nation2.name} 之间的贸易争端。`);
                                                }
                                            }
                                        );
                                        currentActions.triggerDiplomaticEvent(event);
                                        debugLog('event', '[EVENT DEBUG] Trade Dispute event triggered:', nation1.name, nation2.name);
                                    }
                                } catch (e) {
                                    debugError('event', '[EVENT DEBUG] Failed to parse Trade Dispute event:', e);
                                }
                            }

                            // 检测军事同盟邀请事件
                            if (log.includes('MILITARY_ALLIANCE_INVITE:')) {
                                try {
                                    const jsonStr = log.replace('MILITARY_ALLIANCE_INVITE:', '');
                                    const eventData = JSON.parse(jsonStr);
                                    const inviter = result.nations?.find(n => n.id === eventData.inviterId);
                                    const target = result.nations?.find(n => n.id === eventData.targetId);
                                    if (inviter && target && currentActions && currentActions.triggerDiplomaticEvent) {
                                        const event = createMilitaryAllianceInviteEvent(
                                            inviter,
                                            target,
                                            eventData.reason,
                                            (accepted, rejectType) => {
                                                if (accepted) {
                                                    setNations(prev => prev.map(n => {
                                                        if (n.id === inviter.id) {
                                                            return { ...n, alliedWithPlayer: true, relation: Math.min(100, (n.relation || 50) + 20) };
                                                        }
                                                        if (n.id === target.id) {
                                                            return { ...n, relation: Math.max(0, (n.relation || 50) - 20) };
                                                        }
                                                        return n;
                                                    }));
                                                    addLog(`🤝 你与 ${inviter.name} 建立军事同盟，共同对抗 ${target.name}。`);
                                                } else if (rejectType === 'warn_target') {
                                                    setNations(prev => prev.map(n => {
                                                        if (n.id === target.id) return { ...n, relation: Math.min(100, (n.relation || 50) + 15) };
                                                        if (n.id === inviter.id) return { ...n, relation: Math.max(0, (n.relation || 50) - 25) };
                                                        return n;
                                                    }));
                                                    addLog(`📢 你向 ${target.name} 通报了 ${inviter.name} 的同盟邀请。`);
                                                } else {
                                                    addLog(`你婉拒了 ${inviter.name} 的军事同盟邀请。`);
                                                }
                                            }
                                        );
                                        currentActions.triggerDiplomaticEvent(event);
                                        debugLog('event', '[EVENT DEBUG] Military Alliance Invite event triggered:', inviter.name);
                                    }
                                } catch (e) {
                                    debugError('event', '[EVENT DEBUG] Failed to parse Military Alliance Invite event:', e);
                                }
                            }

                            // 检测边境冲突事件
                            if (log.includes('BORDER_INCIDENT:')) {
                                try {
                                    const jsonStr = log.replace('BORDER_INCIDENT:', '');
                                    const eventData = JSON.parse(jsonStr);
                                    const nation = result.nations?.find(n => n.id === eventData.nationId);
                                    if (nation && currentActions && currentActions.triggerDiplomaticEvent) {
                                        const event = createBorderIncidentEvent(
                                            nation,
                                            { casualties: eventData.casualties, isOurFault: eventData.isOurFault },
                                            (response) => {
                                                if (response === 'apologize') {
                                                    setResources(prev => ({ ...prev, silver: Math.max(0, (prev.silver || 0) - 500) }));
                                                    addLog(`🙏 你向 ${nation.name} 道歉并支付了赔偿金。`);
                                                } else if (response === 'deny') {
                                                    setNations(prev => prev.map(n =>
                                                        n.id === nation.id ? { ...n, relation: Math.max(0, (n.relation || 50) - 15) } : n
                                                    ));
                                                    addLog(`❌ 你否认了边境冲突的责任，${nation.name} 对此表示不满。`);
                                                } else if (response === 'demand_apology') {
                                                    addLog(`📜 你向 ${nation.name} 发出正式抗议，要求道歉。`);
                                                } else if (response === 'retaliate') {
                                                    setNations(prev => prev.map(n =>
                                                        n.id === nation.id ? { ...n, relation: Math.max(0, (n.relation || 50) - 30) } : n
                                                    ));
                                                    addLog(`⚔️ 你下令对 ${nation.name} 进行军事报复！`);
                                                } else if (response === 'protest') {
                                                    addLog(`📜 你向 ${nation.name} 提出外交抗议。`);
                                                }
                                            }
                                        );
                                        currentActions.triggerDiplomaticEvent(event);
                                        debugLog('event', '[EVENT DEBUG] Border Incident event triggered:', nation.name);
                                    }
                                } catch (e) {
                                    debugError('event', '[EVENT DEBUG] Failed to parse Border Incident event:', e);
                                }
                            }

                            // 检测附庸请求事件
                            if (log.includes('VASSAL_REQUEST:')) {
                                try {
                                    const jsonStr = log.replace('VASSAL_REQUEST:', '');
                                    const eventData = JSON.parse(jsonStr);
                                    const nation = result.nations?.find(n => n.id === eventData.nationId);
                                    if (nation && currentActions && currentActions.triggerDiplomaticEvent) {
                                        const event = createVassalRequestEvent(
                                            nation,
                                            eventData.vassalType,
                                            eventData.reason,
                                            (accepted, vassalType) => {
                                                if (accepted) {
                                                    // 通过外交行动建立附庸关系
                                                    if (actions?.handleDiplomaticAction) {
                                                        actions.handleDiplomaticAction(nation.id, 'establish_vassal', {
                                                            vassalType: vassalType
                                                        });
                                                    }
                                                    addLog(`👑 ${nation.name} 成为你的附庸！`);
                                                } else {
                                                    addLog(`你拒绝了 ${nation.name} 成为附庸的请求。`);
                                                }
                                            }
                                        );
                                        currentActions.triggerDiplomaticEvent(event);
                                        debugLog('event', '[EVENT DEBUG] Vassal Request event triggered:', nation.name);
                                    }
                                } catch (e) {
                                    debugError('event', '[EVENT DEBUG] Failed to parse Vassal Request event:', e);
                                }
                            }


                        });
                    }
                }
                // 处理训练队列

                // [FIX] Moved Auto Replenish Logic here to share scope with setMilitaryQueue
                const autoRecruitEnabled = current.autoRecruitEnabled || false;
                const allAutoReplenishLosses = {};

                // DEBUG: Check if we are receiving any replenish logs
                const hasReplenishLog = result.logs.some(l => typeof l === 'string' && l.includes('AUTO_REPLENISH_LOSSES:'));
                if (hasReplenishLog) {
                    addLog(`🛠️ [DEBUG] Worker sent replenishment signal! AutoRecruit: ${autoRecruitEnabled}`);
                }

                if (autoRecruitEnabled) {
                    result.logs.forEach((log) => {
                        if (typeof log === 'string' && log.includes('AUTO_REPLENISH_LOSSES:')) {
                            try {
                                const jsonStr = log.replace('AUTO_REPLENISH_LOSSES:', '');
                                const losses = JSON.parse(jsonStr);
                                Object.entries(losses).forEach(([unitId, count]) => {
                                    if (count > 0) {
                                        allAutoReplenishLosses[unitId] = (allAutoReplenishLosses[unitId] || 0) + count;
                                    }
                                });
                            } catch (e) {
                                console.error(e);
                            }
                        }
                    });
                }
                const autoReplenishKey = Object.entries(allAutoReplenishLosses)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([unitId, count]) => `${unitId}:${count}`)
                    .join('|');

                const shouldProcessAutoReplenish = autoRecruitEnabled && Object.keys(allAutoReplenishLosses).length > 0;

                if (shouldProcessAutoReplenish) {
                    debugLog('gameLoop', `[AUTO_REPLENISH] Triggering for losses: ${autoReplenishKey}`);
                }

                // [FIX] 将自动补兵逻辑移入此回调，确保使用最新的队列状态
                setMilitaryQueue(prev => {
                    let baseQueue = queueOverrideForManpower || prev;
                    const currentSoldierPop = (soldierPopulationAfterEvents ?? result.popStructure?.soldier) || 0;
                    // [FIX] 使用战斗后的军队状态 (result.army)
                    const currentArmyCount = Object.values(result.army || armyStateForQueue || {}).reduce((sum, count) => sum + count, 0);
                    // [FIX] 计算军队实际人口消耗（考虑不同兵种的populationCost）
                    const currentArmyPopulation = calculateArmyPopulation(result.army || armyStateForQueue || {});
                    const militaryCapacity = getMilitaryCapacity(current.buildings || {});

                    // [FIX] 在队列处理中执行自动补兵，确保使用最新状态
                    if (shouldProcessAutoReplenish && autoRecruitEnabled && militaryCapacity > 0) {
                        // 计算可用槽位 = 容量 - 当前军队 - 当前队列
                        const availableSlotsForReplenish = Math.max(0, militaryCapacity - currentArmyCount - baseQueue.length);

                        if (availableSlotsForReplenish > 0) {
                            let slotsRemaining = availableSlotsForReplenish;
                            const replenishItems = [];
                            const replenishCounts = {};

                            // 计算每种单位可补充的数量
                            // IMPORTANT: units already queued for auto-replenish (waiting/training) should count as "already replenishing"
                            // otherwise we'd enqueue the same losses again on every tick until training finishes.
                            const queuedAutoReplenishCounts = {};
                            for (let i = 0; i < baseQueue.length; i++) {
                                const q = baseQueue[i];
                                if (!q?.isAutoReplenish) continue;
                                if (!q?.unitId) continue;
                                queuedAutoReplenishCounts[q.unitId] = (queuedAutoReplenishCounts[q.unitId] || 0) + 1;
                            }

                            Object.entries(allAutoReplenishLosses).forEach(([unitId, lossCount]) => {
                                if (lossCount <= 0 || slotsRemaining <= 0) return;
                                const unit = UNIT_TYPES[unitId];
                                if (!unit || unit.epoch > current.epoch) return;

                                const alreadyQueued = queuedAutoReplenishCounts[unitId] || 0;
                                const remainingLossToCover = Math.max(0, lossCount - alreadyQueued);
                                if (remainingLossToCover <= 0) return;

                                const fillCount = Math.min(remainingLossToCover, slotsRemaining);
                                if (fillCount > 0) {
                                    replenishCounts[unitId] = fillCount;
                                    slotsRemaining -= fillCount;
                                }
                            });

                            // 检查资源是否足够
                            const getMarketPrice = (resource) => {
                                const base = RESOURCES[resource]?.basePrice || 1;
                                return result.market?.prices?.[resource] ?? current.market?.prices?.[resource] ?? base;
                            };

                            let totalSilverCost = 0;
                            const totalResourceCost = {};
                            Object.entries(replenishCounts).forEach(([unitId, count]) => {
                                const unit = UNIT_TYPES[unitId];
                                if (!unit) return;
                                const cost = unit.recruitCost || {};
                                Object.entries(cost).forEach(([res, amount]) => {
                                    totalResourceCost[res] = (totalResourceCost[res] || 0) + amount * count;
                                });
                                const unitSilverCost = Object.entries(cost).reduce((sum, [res, amount]) => {
                                    return sum + amount * getMarketPrice(res);
                                }, 0);
                                totalSilverCost += unitSilverCost * count;
                            });

                            // 检查是否能支付
                            const currentResources = result.resources || current.resources || {};
                            let canAfford = (currentResources.silver || 0) >= totalSilverCost;
                            if (canAfford) {
                                Object.entries(totalResourceCost).forEach(([res, amount]) => {
                                    if ((currentResources[res] || 0) < amount) canAfford = false;
                                });
                            }

                            if (canAfford && Object.keys(replenishCounts).length > 0) {
                                // 扣除资源
                                setResources(prevRes => {
                                    const next = { ...prevRes };
                                    next.silver = Math.max(0, (next.silver || 0) - totalSilverCost);
                                    Object.entries(totalResourceCost).forEach(([res, amount]) => {
                                        next[res] = Math.max(0, (next[res] || 0) - amount);
                                    });
                                    return next;
                                });

                                // 添加到队列
                                Object.entries(replenishCounts).forEach(([unitId, count]) => {
                                    const unit = UNIT_TYPES[unitId];
                                    if (!unit) return;
                                    const trainTime = unit.trainingTime || unit.trainDays || 1;
                                    for (let i = 0; i < count; i++) {
                                        replenishItems.push({
                                            unitId,
                                            status: 'waiting',
                                            totalTime: trainTime,
                                            remainingTime: trainTime,
                                            isAutoReplenish: true,
                                        });
                                    }
                                });

                                if (replenishItems.length > 0) {
                                    baseQueue = [...baseQueue, ...replenishItems];
                                    const summary = Object.entries(replenishCounts)
                                        .filter(([_, count]) => count > 0)
                                        .map(([unitId, count]) => `${UNIT_TYPES[unitId]?.name || unitId} ×${count}`)
                                        .join('、');
                                    addLog(`🔄 自动补兵：已花费资金招募 ${summary} 加入训练队列。`);
                                }
                            } else if (!canAfford && Object.keys(replenishCounts).length > 0) {
                                addLog(`❌ 资金或资源不足，已取消本次自动补兵（需 ${Math.ceil(totalSilverCost)} 银币）。`);
                            }
                        } else if (availableSlotsForReplenish <= 0 && Object.keys(allAutoReplenishLosses).length > 0) {
                            addLog('⚠️ 军事容量不足，自动补兵已暂停。');
                        }
                    } else if (shouldProcessAutoReplenish && militaryCapacity <= 0) {
                        addLog('⚠️ 无军事容量，自动补兵已禁用。请建造兵营。');
                    }

                    // 原有的队列裁剪逻辑
                    if (militaryCapacity > 0) {
                        const maxQueueSize = Math.max(0, militaryCapacity - currentArmyCount);
                        if (baseQueue.length > maxQueueSize) {
                            const trainingItems = baseQueue.filter(item => item.status === 'training');
                            const waitingItems = baseQueue.filter(item => item.status !== 'training');
                            let trimmedQueue = [];
                            if (trainingItems.length >= maxQueueSize) {
                                trimmedQueue = trainingItems.slice(0, maxQueueSize);
                            } else {
                                const remainingSlots = maxQueueSize - trainingItems.length;
                                trimmedQueue = [...trainingItems, ...waitingItems.slice(0, remainingSlots)];
                            }
                            const removedCount = baseQueue.length - trimmedQueue.length;
                            if (removedCount > 0) {
                                const currentDay = current.daysElapsed || 0;
                                if (capacityTrimLogRef.current.day !== currentDay) {
                                    capacityTrimLogRef.current.day = currentDay;
                                    addLog(`⚠️ 军事容量不足，已取消 ${removedCount} 个训练队列名额。`);
                                }
                            }
                            baseQueue = trimmedQueue;
                        }
                    }

                    // 计算有多少岗位可以用于新训练（避免多次 filter 带来的 O(n) 扫描）
                    // [FIX] 必须考虑不同兵种的populationCost，否则会导致超员
                    let waitingCount = 0;
                    let trainingCount = 0;
                    let trainingPopulation = 0; // [FIX] 训练中单位的实际人口消耗
                    for (let i = 0; i < baseQueue.length; i++) {
                        const item = baseQueue[i];
                        const s = item?.status;
                        if (s === 'waiting') waitingCount++;
                        else if (s === 'training') {
                            trainingCount++;
                            // [FIX] 累加训练中单位的人口消耗
                            const popCost = UNIT_TYPES[item?.unitId]?.populationCost || 1;
                            trainingPopulation += popCost;
                        }
                    }

                    // [FIX] 使用人口消耗而非单位数量来计算可用岗位
                    const occupiedPopulation = currentArmyPopulation + trainingPopulation;
                    const availableJobsForNewTraining = Math.max(0, currentSoldierPop - occupiedPopulation);

                    // 将等待中的项转为训练中（如果有可用岗位）
                    // [PERF] 大队列时逐条写日志会严重卡顿，这里做节流：只写摘要日志
                    // [FIX] 使用人口消耗而非单位数量来判断是否可以开始训练
                    let remainingPopCapacity = availableJobsForNewTraining;
                    let startedThisTick = 0;
                    const updated = baseQueue.map(item => {
                        if (item.status === 'waiting' && remainingPopCapacity > 0) {
                            // [FIX] 检查该单位的人口消耗是否在可用范围内
                            const unitPopCost = UNIT_TYPES[item?.unitId]?.populationCost || 1;
                            if (unitPopCost > remainingPopCapacity) {
                                // 人口不足以训练此单位，跳过
                                return item;
                            }
                            remainingPopCapacity -= unitPopCost;
                            startedThisTick++;
                            return {
                                ...item,
                                status: 'training',
                                remainingTime: item.totalTime
                            };
                        }
                        // 只对训练中的项进行倒计时
                        if (item.status === 'training') {
                            return {
                                ...item,
                                remainingTime: item.remainingTime - 1
                            };
                        }
                        return item;
                    });

                    if (startedThisTick > 0) {
                        addLog(`✓ ${startedThisTick} 个单位开始训练`);
                    }

                    // 找出已完成的训练（避免再次 filter 扫描）
                    const completed = [];
                    for (let i = 0; i < updated.length; i++) {
                        const it = updated[i];
                        if (it?.status === 'training' && it.remainingTime <= 0) completed.push(it);
                    }

                    // [FIX] 计算可以加入军队的数量（不超过容量上限）
                    const currentTotalArmy = Object.values(result.army || armyStateForQueue || {}).reduce((sum, c) => sum + c, 0);
                    const slotsAvailableForCompletion = militaryCapacity > 0
                        ? Math.max(0, militaryCapacity - currentTotalArmy)
                        : completed.length; // 如果没有容量限制，允许所有完成的单位加入

                    // 只取能加入的部分
                    const canComplete = completed.slice(0, slotsAvailableForCompletion);
                    const mustWait = completed.slice(slotsAvailableForCompletion);

                    if (canComplete.length > 0) {
                        // 将完成的单位加入军队
                        setArmy(prevArmy => {
                            const newArmy = { ...prevArmy };
                            // [FIX] 再次检查容量，防止竞态条件
                            const prevTotal = Object.values(newArmy).reduce((sum, c) => sum + c, 0);
                            let addedCount = 0;

                            canComplete.forEach(item => {
                                if (militaryCapacity <= 0 || prevTotal + addedCount < militaryCapacity) {
                                    newArmy[item.unitId] = (newArmy[item.unitId] || 0) + 1;
                                    addedCount++;
                                }
                            });
                            return newArmy;
                        });

                        // [PERF] 大量单位同时毕业时逐条日志会卡顿：改为摘要 + 少量样例
                        {
                            const total = canComplete.length;
                            if (total <= 10) {
                                canComplete.forEach(item => {
                                    addLog(`✓ ${UNIT_TYPES[item.unitId].name} 训练完成！`);
                                });
                            } else {
                                const preview = canComplete
                                    .slice(0, 3)
                                    .map(item => UNIT_TYPES[item.unitId]?.name || item.unitId)
                                    .join('、');
                                addLog(`✓ ${total} 个单位训练完成（例如：${preview}...）`);
                            }
                        }
                    }

                    if (mustWait.length > 0) {
                        addLog(`⚠️ 军事容量已满，${mustWait.length} 个单位将在队列中等待。`);
                    }

                    // 返回未完成的训练（排除已完成且加入军队的），保留因容量问题未能加入的
                    // IMPORTANT: We must remove the exact items we just added to the army.
                    // Using indexes here is error-prone because `canComplete` is a slice of `completed`.
                    const canCompleteSet = new Set(canComplete);
                    return updated.filter(item => {
                        if (item.status === 'training' && item.remainingTime <= 0) {
                            // Remove only those completed items that were successfully applied to the army
                            return !canCompleteSet.has(item);
                        }
                        return true;
                    });
                });
            }).catch(error => {
                console.error('[GameLoop] Simulation error:', error);
            });
        }, tickInterval); // 根据游戏速度动态调整执行频率

        return () => clearInterval(timer);
    }, [gameSpeed, isPaused, army, activeFestivalEffects, setFestivalModal, setActiveFestivalEffects, setLastFestivalYear, lastFestivalYear, setIsPaused]); // 依赖游戏速度、暂停状态、军队状态和庆典相关状态
};
