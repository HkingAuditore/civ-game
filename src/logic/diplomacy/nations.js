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
import { processVassalUpdates } from './vassalSystem.js';
import {
    AI_ECONOMY_CONFIG,
    getSocialStructureTemplate,
    TREATY_CONFIGS,
    TREATY_TYPE_LABELS,
} from '../../config/diplomacy.js';

// ========== AI国家经济数据初始化与更新 ==========

/**
 * 财富分配系数（假设）
 * 用于将国家总财富分配给各阶层
 */
const WEALTH_DISTRIBUTION = {
    elites: 0.60,      // 精英阶层掌握60%财富
    commoners: 0.35,   // 平民阶层掌握35%财富
    underclass: 0.05,  // 底层阶层掌握5%财富
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

/**
 * 初始化AI国家的经济数据（价格、库存、阶层）
 * @param {Object} nation - 国家对象
 * @param {Object} marketPrices - 玩家市场价格
 * @returns {Object} 更新后的国家对象
 */
export const initializeNationEconomyData = (nation, marketPrices = {}) => {
    if (!nation) return nation;
    
    const updated = { ...nation };
    const config = AI_ECONOMY_CONFIG;
    
    // 1. 初始化价格数据（如果不存在）
    if (!updated.nationPrices || Object.keys(updated.nationPrices).length === 0) {
        updated.nationPrices = {};
        Object.entries(RESOURCES).forEach(([resourceKey, resourceConfig]) => {
            // 跳过虚拟资源
            if (resourceConfig.type === 'virtual' || resourceConfig.type === 'currency') return;
            
            // 基于玩家市场价格或基础价格
            const basePrice = marketPrices[resourceKey] || resourceConfig.basePrice || 1;
            const variation = (Math.random() - 0.5) * 2 * config.prices.initialVariation;
            updated.nationPrices[resourceKey] = Math.max(
                resourceConfig.minPrice || 0.1,
                Math.min(resourceConfig.maxPrice || 100, basePrice * (1 + variation))
            );
        });
    }
    
    // 2. 初始化库存数据（如果不存在）
    if (!updated.nationInventories || Object.keys(updated.nationInventories).length === 0) {
        updated.nationInventories = {};
        const wealth = updated.wealth || 1000;
        
        // 确定国家规模
        let sizeMultiplier = config.inventory.baseMultipliers.small;
        if (wealth > config.sizeThresholds.medium) {
            sizeMultiplier = config.inventory.baseMultipliers.large;
        } else if (wealth > config.sizeThresholds.small) {
            sizeMultiplier = config.inventory.baseMultipliers.medium;
        }
        
        Object.entries(RESOURCES).forEach(([resourceKey, resourceConfig]) => {
            if (resourceConfig.type === 'virtual' || resourceConfig.type === 'currency') return;
            
            const weight = config.inventory.resourceWeights[resourceKey] || config.inventory.resourceWeights.default;
            const baseInventory = sizeMultiplier * weight * (0.8 + Math.random() * 0.4);
            updated.nationInventories[resourceKey] = Math.floor(baseInventory);
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
 * 更新阶层数据（人口、财富、生活水平）
 * @param {Object} nation - 国家对象
 * @returns {Object} 更新后的国家对象
 */
const updateSocialClasses = (nation) => {
    if (!nation || !nation.socialStructure) return nation;

    const updated = { ...nation };
    const structure = { ...updated.socialStructure };
    const totalPop = updated.population || 1000;
    const totalWealth = updated.wealth || 1000;
    const subsistenceCost = calculateSubsistenceCost(updated.nationPrices);

    // 通用影响因素
    let generalSatisfactionMod = 0;
    if (updated.isAtWar) generalSatisfactionMod -= 5;
    if (updated.vassalOf === 'player') {
        const autonomy = updated.autonomy || 50;
        generalSatisfactionMod -= (100 - autonomy) * 0.05;
    }

    ['elites', 'commoners', 'underclass'].forEach(stratum => {
        if (!structure[stratum]) return;

        const data = { ...structure[stratum] };

        // 1. 更新人口
        const ratio = data.ratio || 0.33;
        data.population = Math.floor(totalPop * ratio);

        // 2. 更新财富
        // 使用预设的财富分配比例，加一点随机波动模拟流动
        const wealthShare = WEALTH_DISTRIBUTION[stratum] || 0.33;
        data.wealth = Math.floor(totalWealth * wealthShare);

        // 3. 计算人均财富与生活水平 (SoL)
        // 人均财富 = 阶层总财富 / 阶层人口
        const perCapitaWealth = data.population > 0 ? data.wealth / data.population : 0;

        // 生活水平 = 人均财富 / 生存成本
        // 阈值：底层需维持 1.0，平民 2.0，精英 10.0
        const solRatio = subsistenceCost > 0 ? perCapitaWealth / subsistenceCost : 1;

        data.sol = solRatio;

        // 4. 更新满意度
        // 基于SoL和基准期望的对比
        const expectations = {
            elites: 15.0,
            commoners: 3.0,
            underclass: 1.0
        };
        const expectedSol = expectations[stratum] || 1.0;

        // 满意度趋向目标值：(实际SoL / 期望SoL) * 50
        // 如果实际 >= 期望，满意度 > 50
        let targetSatisfaction = Math.min(100, (solRatio / expectedSol) * 50);
        targetSatisfaction = Math.max(0, targetSatisfaction + generalSatisfactionMod);

        // 缓慢趋近
        const currentSat = data.satisfaction || 50;
        data.satisfaction = currentSat * 0.95 + targetSatisfaction * 0.05;

        structure[stratum] = data;
    });

    updated.socialStructure = structure;
    return updated;
};

/**
 * 更新AI国家的每日经济数据
 * @param {Object} nation - 国家对象
 * @param {Object} marketPrices - 玩家市场价格
 * @returns {Object} 更新后的国家对象
 */
export const updateNationEconomyData = (nation, marketPrices = {}) => {
    if (!nation || !nation.nationPrices) return nation;
    
    let updated = { ...nation };
    const config = AI_ECONOMY_CONFIG;
    
    // 1. 更新价格（每日随机波动）
    updated.nationPrices = { ...updated.nationPrices };
    Object.entries(updated.nationPrices).forEach(([resourceKey, currentPrice]) => {
        const resourceConfig = RESOURCES[resourceKey];
        if (!resourceConfig) return;
        
        // 随机波动
        const variation = (Math.random() - 0.5) * 2 * config.prices.dailyVariation;
        let newPrice = currentPrice * (1 + variation);
        
        // 向玩家市场价格缓慢收敛（如果有自由贸易协定则更快）
        const playerPrice = marketPrices[resourceKey];
        if (playerPrice) {
            const hasFreeTrade = nation.treaties?.some(t => t.type === 'free_trade' && t.status === 'active');
            const convergenceRate = hasFreeTrade ? 0.03 : 0.01;
            newPrice = newPrice * (1 - convergenceRate) + playerPrice * convergenceRate;
        }
        
        // 限制价格范围
        const minPrice = resourceConfig.minPrice || 0.1;
        const maxPrice = resourceConfig.maxPrice || 100;
        updated.nationPrices[resourceKey] = Math.max(minPrice, Math.min(maxPrice, newPrice));
    });
    
    // 2. 更新库存（简化模拟生产和消费）
    updated.nationInventories = { ...updated.nationInventories };
    Object.entries(updated.nationInventories).forEach(([resourceKey, currentInventory]) => {
        const resourceConfig = RESOURCES[resourceKey];
        if (!resourceConfig) return;
        
        // 基于国家财富计算生产/消费基线
        const wealthFactor = Math.max(0.5, (updated.wealth || 1000) / 2000);
        const changeRate = config.inventory.dailyChangeRate;
        
        // 随机生产/消费变化
        const change = currentInventory * changeRate * (Math.random() - 0.5) * 2 * wealthFactor;
        
        // 战争状态消耗更多资源
        const warPenalty = updated.isAtWar ? 0.98 : 1.0;
        
        let newInventory = (currentInventory + change) * warPenalty;
        
        // 确保库存不为负，且有最小值
        const minInventory = 5;
        const maxInventory = 500 * wealthFactor;
        updated.nationInventories[resourceKey] = Math.max(minInventory, Math.min(maxInventory, Math.floor(newInventory)));
    });
    
    // 3. 全面更新阶层数据（代替旧的简单满意度更新）
    updated = updateSocialClasses(updated);
    
    return updated;
};

/**
 * Update all AI nations for one tick
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
                logs
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
            res.silver = (res.silver || 0) + payment;
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
        const economyUpdated = updateNationEconomyData(next, marketPrices);
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
        logs,
    });
    updatedNations = vassalResult.nations;
    vassalTributeIncome = vassalResult.tributeIncome;
    res.silver = (res.silver || 0) + vassalTributeIncome;

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
const processWarActions = ({ nation, tick, epoch, res, army, stabilityValue, logs }) => {
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

        if (foodLoss > 0) res.food = Math.max(0, (res.food || 0) - foodLoss);
        if (silverLoss > 0) res.silver = Math.max(0, (res.silver || 0) - silverLoss);

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
            if (foodLoss > 0) res.food = Math.max(0, (res.food || 0) - foodLoss);
            if (silverLoss > 0) res.silver = Math.max(0, (res.silver || 0) - silverLoss);
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
    const wealthFactor = clamp(powerProfile.wealthFactor ?? (powerProfile.baseRating ? powerProfile.baseRating * 1.1 : 1.1), 0.5, 3.5);
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

    // Periodic independent growth
    const ticksSinceLastGrowth = tick - (nation.economyTraits.lastGrowthTick || 0);
    if (ticksSinceLastGrowth >= 100) {
        const growthChance = 0.3 * (nation.economyTraits.developmentRate || 1.0);
        if (Math.random() < growthChance && !nation.isAtWar) {
            nation.economyTraits.ownBasePopulation = Math.round(
                nation.economyTraits.ownBasePopulation * (1.03 + Math.random() * 0.05)
            );
            nation.economyTraits.ownBaseWealth = Math.round(
                nation.economyTraits.ownBaseWealth * (1.04 + Math.random() * 0.08)
            );
        }
        nation.economyTraits.lastGrowthTick = tick;
    }

    // Calculate target values
    const eraGrowthFactor = 1 + Math.max(0, epoch) * 0.15;
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
    const templatePopulationBoost = Math.max(1, (nation.wealthTemplate || 800) / Math.max(800, playerWealthBaseline) * 0.8);
    const templateWealthBoost = Math.max(1, (nation.wealthTemplate || 800) / Math.max(800, playerWealthBaseline) * 1.1);

    const desiredPopulation = Math.max(3, blendedTargetPopulation * templatePopulationBoost);
    const desiredWealth = Math.max(100, blendedTargetWealth * templateWealthBoost);

    nation.economyTraits.basePopulation = desiredPopulation;
    nation.economyTraits.baseWealth = desiredWealth;

    // Apply drift
    const driftMultiplier = clamp(1 + volatility * 0.6 + eraMomentum * 0.08, 1, 1.8);
    const populationDriftRate = (nation.isAtWar ? 0.032 : 0.12) * driftMultiplier;
    const wealthDriftRate = (nation.isAtWar ? 0.03 : 0.11) * driftMultiplier;

    const currentPopulation = nation.population ?? desiredPopulation;
    const populationNoise = (Math.random() - 0.5) * volatility * desiredPopulation * 0.04;
    let adjustedPopulation = currentPopulation +
        (desiredPopulation - currentPopulation) * populationDriftRate + populationNoise;
    if (nation.isAtWar) {
        adjustedPopulation -= currentPopulation * 0.012;
    }
    nation.population = Math.max(3, Math.round(adjustedPopulation));

    const currentWealth = nation.wealth ?? desiredWealth;
    const wealthNoise = (Math.random() - 0.5) * volatility * desiredWealth * 0.05;
    let adjustedWealth = currentWealth +
        (desiredWealth - currentWealth) * wealthDriftRate + wealthNoise;
    if (nation.isAtWar) {
        adjustedWealth -= currentWealth * 0.015;
    }
    nation.wealth = Math.max(100, Math.round(adjustedWealth));

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
const processMonthlyRelationDecay = (nations, difficultyLevel = 'normal') => {
    if (!Array.isArray(nations)) return [];
    return nations.map(nation => {
        if (nation.isRebelNation) return nation;

        const currentRelation = nation.relation ?? 50;
        const isAlly = nation.alliedWithPlayer === true;
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
