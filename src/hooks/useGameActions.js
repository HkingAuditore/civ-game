// 游戏操作钩子
// 包含所有游戏操作函数，如建造建筑、研究科技、升级时代等

import { useState, useEffect } from 'react';
import { BUILDINGS, EPOCHS, RESOURCES, TECHS, MILITARY_ACTIONS, UNIT_TYPES, EVENTS, getRandomEvent, createWarDeclarationEvent, createGiftEvent, createPeaceRequestEvent, createEnemyPeaceRequestEvent, createPlayerPeaceProposalEvent, createBattleEvent, createAllianceRequestEvent, createAllianceProposalResultEvent, createAllianceBreakEvent, createNationAnnexedEvent, STRATA, BUILDING_UPGRADES, getMaxUpgradeLevel, getUpgradeCost } from '../config';
import { getBuildingCostGrowthFactor, getBuildingCostBaseMultiplier, getTechCostMultiplier, getBuildingUpgradeCostMultiplier } from '../config/difficulty';
import { debugLog } from '../utils/debugFlags';
import { getUpgradeCountAtOrAboveLevel, calculateBuildingCost, applyBuildingCostModifier } from '../utils/buildingUpgradeUtils';
import { simulateBattle, calculateBattlePower, generateNationArmy } from '../config';
import { calculateForeignPrice, calculateTradeStatus } from '../utils/foreignTrade';
import { generateSound, SOUND_TYPES } from '../config/sounds';
import { getEnemyUnitsForEpoch, calculateProportionalLoot } from '../config/militaryActions';
import { isResourceUnlocked } from '../utils/resources';
import { calculateDynamicGiftCost, calculateProvokeCost } from '../utils/diplomaticUtils';
import { filterEventEffects } from '../utils/eventEffectFilter';
// 叛乱系统
import {
    processRebellionAction,
    createInvestigationResultEvent,
    createArrestResultEvent,
    createSuppressionResultEvent,
    createRebellionEndEvent,
} from '../logic/rebellionSystem';
import { getOrganizationStage, getPhaseFromStage } from '../logic/organizationSystem';
import {
    triggerSelection,
    hireOfficial,
    fireOfficial,
    isSelectionAvailable,
    disposeOfficial,
} from '../logic/officials/manager';


/**
 * 游戏操作钩子
 * 提供所有游戏操作函数
 * @param {Object} gameState - 游戏状态对象
 * @param {Function} addLog - 添加日志函数
 * @returns {Object} 包含所有操作函数的对象
 */
export const useGameActions = (gameState, addLog) => {
    const {
        resources,
        setResources,
        market,
        rates,
        buildings,
        setBuildings,
        epoch,
        setEpoch,
        population,
        techsUnlocked,
        setTechsUnlocked,
        setClicks,
        army,
        setArmy,
        militaryQueue,
        setMilitaryQueue,
        setBattleResult,
        battleNotifications,
        setBattleNotifications,
        nations,
        setNations,
        setClassInfluenceShift,
        daysElapsed,
        currentEvent,
        setCurrentEvent,
        eventHistory,
        setEventHistory,
        classApproval,
        setClassApproval,
        stability,
        setStability,
        setPopulation,
        setMaxPop,
        setMaxPopBonus,
        tradeRoutes,
        setTradeRoutes,
        jobsAvailable,
        eventEffectSettings,
        setActiveEventEffects,
        rebellionStates,
        setRebellionStates,
        popStructure,
        setPopStructure,
        classWealth,
        buildingUpgrades,
        setBuildingUpgrades,
        autoRecruitEnabled,
        modifiers,
        // 官员系统状态
        officials,
        setOfficials,
        officialCandidates,
        setOfficialCandidates,
        lastSelectionDay,
        setLastSelectionDay,
        officialCapacity,
        // 阶层影响力
        classInfluence,
        lastBattleTargetId,
        setLastBattleTargetId,
        lastBattleDay,
        setLastBattleDay,
    } = gameState;

    const [pendingDiplomaticEvents, setPendingDiplomaticEvents] = useState([]);

    const getMarketPrice = (resource) => {
        if (!resource) return 1;
        const base = RESOURCES[resource]?.basePrice || 1;
        return market?.prices?.[resource] ?? base;
    };

    const getMilitaryCapacity = (buildingState = buildings) => {
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

    const getTotalArmyCount = (armyState = army, queueState = militaryQueue) => {
        const armyCount = Object.values(armyState || {}).reduce((sum, count) => sum + (count || 0), 0);
        const queueCount = Array.isArray(queueState) ? queueState.length : 0;
        return armyCount + queueCount;
    };

    const handleAutoReplenishLosses = (losses = {}, options = {}) => {
        if (!autoRecruitEnabled) return;
        if (!losses || Object.keys(losses).length === 0) return;

        const capacity = getMilitaryCapacity();
        const queueSnapshot = Array.isArray(militaryQueue) ? militaryQueue : [];
        const totalArmyCount = getTotalArmyCount(army, queueSnapshot);

        // [FIX] Stale State Correction
        // handleAutoReplenishLosses is often called in the same tick as the battle result (before setArmy updates state).
        // Therefore, 'totalArmyCount' reflects the PRE-BATTLE army size (which might be full).
        // We must subtract the 'losses' we are about to replenish to understand the TRUE available capacity.
        const totalLossesCount = Object.values(losses).reduce((sum, c) => sum + (c || 0), 0);
        const projectedArmyCount = Math.max(0, totalArmyCount - totalLossesCount);
        
        // Calculate slots based on projected army size
        let availableSlots = capacity > 0 ? Math.max(0, capacity - projectedArmyCount) : 0;

        debugLog('gameLoop', `[AUTO_REPLENISH] Capacity Check: Cap ${capacity}, CurrentArmy ${totalArmyCount}, Losses ${totalLossesCount} -> Projected ${projectedArmyCount}, Slots ${availableSlots}`);

        if (capacity > 0 && availableSlots <= 0) {
            debugLog('gameLoop', `[AUTO_REPLENISH] Failed: Capacity full (Cap: ${capacity}, ProjectedArmy: ${projectedArmyCount})`);
            addLog('⚠️ 军事容量不足，自动补兵已暂停。');
            return;
        }

        const replenishCounts = {};
        Object.entries(losses).forEach(([unitId, lossCount]) => {
            if (lossCount <= 0 || availableSlots <= 0) return;
            const unit = UNIT_TYPES[unitId];
            if (!unit || unit.epoch > epoch) return;
            const fillCount = capacity > 0 ? Math.min(lossCount, availableSlots) : lossCount;
            if (fillCount <= 0) return;
            replenishCounts[unitId] = fillCount;
            availableSlots -= fillCount;
        });

        const replenishTotal = Object.values(replenishCounts).reduce((sum, count) => sum + count, 0);
        if (replenishTotal <= 0) {
             debugLog('gameLoop', `[AUTO_REPLENISH] Failed: No valid units to replenish (Losses: ${JSON.stringify(losses)})`);
             return;
        }

        let canAfford = true;
        const totalResourceCost = {};
        let totalSilverCost = 0;
        Object.entries(replenishCounts).forEach(([unitId, count]) => {
            const unit = UNIT_TYPES[unitId];
            if (!unit) return;
            const cost = unit.recruitCost || {};
            Object.entries(cost).forEach(([res, amount]) => {
                totalResourceCost[res] = (totalResourceCost[res] || 0) + amount * count;
            });
            const unitSilverCost = Object.entries(cost).reduce((sum, [res, amount]) => {
                const price = getMarketPrice(res);
                return sum + amount * price;
            }, 0);
            totalSilverCost += unitSilverCost * count;
        });

        if ((resources.silver || 0) < totalSilverCost) canAfford = false;
        if (canAfford) {
            Object.entries(totalResourceCost).forEach(([res, amount]) => {
                if ((resources[res] || 0) < amount) canAfford = false;
            });
        }

        if (!canAfford) {
            debugLog('gameLoop', `[AUTO_REPLENISH] Failed: Cannot afford (Cost: ${totalSilverCost}, Silver: ${resources.silver})`);
            addLog(`❌ 资金或资源不足，已取消本次自动补兵（需 ${Math.ceil(totalSilverCost)} 银币）。`);
            return;
        }

        setResources(prev => {
            const next = { ...prev };
            next.silver = Math.max(0, (next.silver || 0) - totalSilverCost);
            Object.entries(totalResourceCost).forEach(([res, amount]) => {
                next[res] = Math.max(0, (next[res] || 0) - amount);
            });
            return next;
        });

        const replenishItems = [];
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
            debugLog('gameLoop', `[AUTO_REPLENISH] Success: Adding ${replenishItems.length} items to queue`);
            setMilitaryQueue(prev => [...prev, ...replenishItems]);
            const summary = Object.entries(replenishCounts)
                .filter(([_, count]) => count > 0)
                .map(([unitId, count]) => `${UNIT_TYPES[unitId]?.name || unitId} ×${count}`)
                .join('、');
            addLog(`🔄 自动补兵：已花费资金招募 ${summary} 加入训练队列。`);
        }

        if (capacity > 0) {
            const totalLosses = Object.values(losses).reduce((sum, count) => sum + (count || 0), 0);
            if (replenishTotal < totalLosses) {
                debugLog('gameLoop', `[AUTO_REPLENISH] Partial success: Capacity limited`);
                addLog('⚠️ 军事容量不足，部分损失未能补充。');
            }
        }
    };

    // 获取资源名称
    const getResourceName = (key) => {
        if (!key) return key;
        return RESOURCES[key]?.name || key;
    };

    // 获取阶层名称
    const getStratumName = (key) => {
        if (!key) return key;
        // 尝试从导入的STRATA获取，如果没有则直接返回key
        // 注意：STRATA可能没有被导入，这里需要检查
        if (typeof STRATA !== 'undefined' && STRATA[key]?.name) {
            return STRATA[key].name;
        }
        return key;
    };

    // ========== 时代升级 ========== 

    /**
     * 检查是否可以升级时代
     * @returns {boolean}
     */
    const canUpgradeEpoch = () => {
        if (epoch >= EPOCHS.length - 1) return false;
        const nextEpoch = EPOCHS[epoch + 1];

        // 检查升级要求
        if (nextEpoch.req.science && resources.science < nextEpoch.req.science) return false;
        if (nextEpoch.req.population && population < nextEpoch.req.population) return false;
        if (nextEpoch.req.culture && resources.culture < nextEpoch.req.culture) return false;

        // 检查升级成本
        const difficulty = gameState.difficulty || 'normal';
        const techCostMultiplier = getTechCostMultiplier(difficulty);

        for (let k in nextEpoch.cost) {
            const cost = Math.ceil(nextEpoch.cost[k] * techCostMultiplier);
            if ((resources[k] || 0) < cost) return false;
        }

        // 检查银币成本
        const silverCost = Object.entries(nextEpoch.cost).reduce((sum, [resource, amount]) => {
            const cost = Math.ceil(amount * techCostMultiplier);
            return sum + cost * getMarketPrice(resource);
        }, 0);
        if ((resources.silver || 0) < silverCost) return false;

        return true;
    };

    /**
     * 升级时代
     */
    const upgradeEpoch = () => {
        if (!canUpgradeEpoch()) return;

        const nextEpoch = EPOCHS[epoch + 1];
        const newRes = { ...resources };
        
        const difficulty = gameState.difficulty || 'normal';
        const techCostMultiplier = getTechCostMultiplier(difficulty);

        // 计算银币成本
        const silverCost = Object.entries(nextEpoch.cost).reduce((sum, [resource, amount]) => {
            const cost = Math.ceil(amount * techCostMultiplier);
            return sum + cost * getMarketPrice(resource);
        }, 0);

        // 扣除成本和银币
        for (let k in nextEpoch.cost) {
            const cost = Math.ceil(nextEpoch.cost[k] * techCostMultiplier);
            newRes[k] -= cost;
        }
        newRes.silver = Math.max(0, (newRes.silver || 0) - silverCost);

        setResources(newRes);
        setEpoch(epoch + 1);
        addLog(`🎉 文明进入 ${nextEpoch.name}！`);

        // 播放升级音效
        try {
            const soundGenerator = generateSound(SOUND_TYPES.LEVEL_UP);
            if (soundGenerator) soundGenerator();
        } catch (e) {
            console.warn('Failed to play level up sound:', e);
        }
    };

    // ========== 建筑管理 ==========

    /**
     * 购买建筑
     * @param {string} id - 建筑ID
     */
    const buyBuilding = (id) => {
        const b = BUILDINGS.find(x => x.id === id);
        const count = buildings[id] || 0;

        // 计算成本（随数量递增）
        const difficultyLevel = gameState.difficulty || 'normal';
        const growthFactor = getBuildingCostGrowthFactor(difficultyLevel);
        const baseMultiplier = getBuildingCostBaseMultiplier(difficultyLevel);
        console.log(`[DEBUG] buyBuilding: diff=${difficultyLevel}, baseMult=${baseMultiplier}, growth=${growthFactor}`);
        const cost = calculateBuildingCost(b.baseCost, count, growthFactor, baseMultiplier);
        const buildingCostMod = modifiers?.officialEffects?.buildingCostMod || 0;
        // 传入基础成本，确保减免只作用于数量惩罚部分
        const adjustedCost = applyBuildingCostModifier(cost, buildingCostMod, b.baseCost);

        const hasMaterials = Object.entries(adjustedCost).every(([resource, amount]) => (resources[resource] || 0) >= amount);
        if (!hasMaterials) {
            addLog(`资源不足，无法建造 ${b.name}`);
            return;
        }

        // 计算银币成本并应用官员建筑成本修正
        let silverCost = Object.entries(adjustedCost).reduce((sum, [resource, amount]) => {
            return sum + amount * getMarketPrice(resource);
        }, 0);
        silverCost = Math.max(0, silverCost);

        if ((resources.silver || 0) < silverCost) {
            addLog('银币不足，无法支付建造费用');
            return;
        }

        const newRes = { ...resources };
        Object.entries(adjustedCost).forEach(([resource, amount]) => {
            newRes[resource] = Math.max(0, (newRes[resource] || 0) - amount);
        });
        newRes.silver = Math.max(0, (newRes.silver || 0) - silverCost);

        setResources(newRes);
        setBuildings(prev => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
        addLog(`建造了 ${b.name}`);

        // 播放建造音效
        try {
            const soundGenerator = generateSound(SOUND_TYPES.BUILD);
            if (soundGenerator) soundGenerator();
        } catch (e) {
            console.warn('Failed to play build sound:', e);
        }
    };
    /**
     * 出售建筑
     * 优先移除最低等级的建筑
     * @param {string} id - 建筑ID
     */
    const sellBuilding = (id) => {
        const currentCount = buildings[id] || 0;
        if (currentCount > 0) {
            setBuildings(prev => ({ ...prev, [id]: prev[id] - 1 }));
            addLog(`拆除了 ${BUILDINGS.find(b => b.id === id).name}`);

            // 新格式：优先移除最低等级的建筑
            // 数据格式: { level: count }，注意0级不记录
            const levelCounts = buildingUpgrades[id] || {};

            // 计算有升级记录的建筑总数
            let upgradedCount = 0;
            for (const lvlCount of Object.values(levelCounts)) {
                if (typeof lvlCount === 'number' && lvlCount > 0) {
                    upgradedCount += lvlCount;
                }
            }

            // 0级建筑数量 = 总数 - 有升级记录的数量
            const level0Count = currentCount - upgradedCount;
            let targetLevel = -1;

            if (level0Count > 0) {
                // 有0级建筑，优先拆除0级
                targetLevel = 0;
            } else if (Object.keys(levelCounts).length > 0) {
                // 没有0级建筑，需要拆除最低等级的升级建筑
                const levels = Object.keys(levelCounts)
                    .map(k => parseInt(k))
                    .filter(l => Number.isFinite(l) && levelCounts[l] > 0)
                    .sort((a, b) => a - b);

                if (levels.length > 0) {
                    targetLevel = levels[0];
                    setBuildingUpgrades(prev => {
                        const newUpgrades = { ...prev };
                        const buildingUpgrade = { ...(newUpgrades[id] || {}) };
                        buildingUpgrade[targetLevel] = (buildingUpgrade[targetLevel] || 0) - 1;
                        if (buildingUpgrade[targetLevel] <= 0) {
                            delete buildingUpgrade[targetLevel];
                        }
                        newUpgrades[id] = buildingUpgrade;
                        return newUpgrades;
                    });
                }
            }

            // 处理官员私产移除逻辑
            if (targetLevel !== -1 && officials && officials.length > 0) {
                // 计算该等级建筑拆除后的国家剩余数量
                // 注意：currentCount 是拆除前的总数，所以0级数量用拆除前计算再-1
                // 非0级数量直接从 levelCounts 取再-1
                let remainingGlobalCount = 0;
                if (targetLevel === 0) {
                    remainingGlobalCount = Math.max(0, level0Count - 1);
                } else {
                    remainingGlobalCount = Math.max(0, (levelCounts[targetLevel] || 0) - 1);
                }

                // 统计所有官员持有的该等级建筑总数
                let totalOwnedByOfficials = 0;
                const holders = [];

                officials.forEach((off, idx) => {
                    const count = (off.ownedProperties || []).filter(p => p.buildingId === id && (p.level || 0) === targetLevel).length;
                    if (count > 0) {
                        totalOwnedByOfficials += count;
                        holders.push({ index: idx, count, official: off });
                    }
                });

                // 如果官员持有总数 > 国家剩余总数，说明刚才拆的是官员的或者需要强制移除一个
                if (totalOwnedByOfficials > remainingGlobalCount) {
                    // 随机选择一个持有者进行移除
                    const victimEntry = holders[Math.floor(Math.random() * holders.length)];

                    setOfficials(prev => {
                        const newOfficials = [...prev];
                        const victim = { ...newOfficials[victimEntry.index] };
                        const props = [...(victim.ownedProperties || [])];

                        // 移除一个匹配的产业
                        const removeIdx = props.findIndex(p => p.buildingId === id && (p.level || 0) === targetLevel);
                        if (removeIdx !== -1) {
                            props.splice(removeIdx, 1);
                            victim.ownedProperties = props;
                            newOfficials[victimEntry.index] = victim;

                            addLog(`${victim.name} 失去了一处 ${BUILDINGS.find(b => b.id === id).name}${targetLevel > 0 ? ` (等级 ${targetLevel})` : ''}，因为建筑被拆除`);
                        }

                        return newOfficials;
                    });
                }
            }
        }
    };

    // ========== 建筑升级系统 ==========

    /**
     * 升级单座建筑
     * 新格式：直接操作等级计数
     * @param {string} buildingId - 建筑ID
     * @param {number} fromLevel - 当前等级（从哪个等级升级）
     */
    const upgradeBuilding = (buildingId, fromLevel) => {
        const building = BUILDINGS.find(b => b.id === buildingId);
        if (!building) {
            addLog('未找到该建筑。');
            return;
        }

        const count = buildings[buildingId] || 0;
        if (count <= 0) {
            addLog('没有该建筑。');
            return;
        }

        const maxLevel = getMaxUpgradeLevel(buildingId);
        if (fromLevel >= maxLevel) {
            addLog(`${building.name} 已达最高等级。`);
            return;
        }

        // 检查是否有该等级的建筑可升级
        const levelCounts = buildingUpgrades[buildingId] || {};
        const distribution = {};
        let accounted = 0;
        for (const [lvlStr, lvlCount] of Object.entries(levelCounts)) {
            const lvl = parseInt(lvlStr);
            if (Number.isFinite(lvl) && lvlCount > 0) {
                distribution[lvl] = lvlCount;
                accounted += lvlCount;
            }
        }
        distribution[0] = count - accounted; // 0级的数量

        if ((distribution[fromLevel] || 0) <= 0) {
            addLog(`没有等级 ${fromLevel} 的 ${building.name} 可升级。`);
            return;
        }

        // 计算已有的同等级或更高升级数量，用于成本递增
        // 获取困难系数
        const difficultyLevel = gameState.difficulty || 'normal';
        const growthFactor = getBuildingCostGrowthFactor(difficultyLevel);
        const existingUpgradeCount = getUpgradeCountAtOrAboveLevel(fromLevel + 1, count, levelCounts);
        
        const upgradeMultiplier = getBuildingUpgradeCostMultiplier(difficultyLevel);
        const baseUpgradeCost = getUpgradeCost(buildingId, fromLevel + 1, existingUpgradeCount, growthFactor);
        
        const upgradeCost = {};
        if (baseUpgradeCost) {
            Object.entries(baseUpgradeCost).forEach(([res, val]) => {
                upgradeCost[res] = Math.ceil(val * upgradeMultiplier);
            });
        }
        if (!upgradeCost) {
            addLog('无法获取升级费用。');
            return;
        }

        // 1. 检查市场库存是否足够
        const hasMaterials = Object.entries(upgradeCost).every(([resource, amount]) => {
            if (resource === 'silver') return true;
            return (resources[resource] || 0) >= amount;
        });

        if (!hasMaterials) {
            addLog(`市场资源不足，无法升级 ${building.name}。`);
            return;
        }

        // 2. 计算银币成本（资源按市场价）
        let silverCost = 0;
        for (const [resource, amount] of Object.entries(upgradeCost)) {
            if (resource === 'silver') {
                silverCost += amount;
            } else {
                const marketPrice = getMarketPrice(resource);
                silverCost += amount * marketPrice;
            }
        }

        // 3. 检查银币是否足够
        if ((resources.silver || 0) < silverCost) {
            addLog(`银币不足，升级 ${building.name} 需要 ${Math.ceil(silverCost)} 银币。`);
            return;
        }

        // 4. 扣除资源和银币
        const newRes = { ...resources };
        Object.entries(upgradeCost).forEach(([resource, amount]) => {
            if (resource !== 'silver') {
                newRes[resource] = Math.max(0, (newRes[resource] || 0) - amount);
            }
        });
        newRes.silver = Math.max(0, (newRes.silver || 0) - silverCost);
        setResources(newRes);

        // 5. 更新升级等级（新格式：等级计数）
        const nextLevel = fromLevel + 1;
        setBuildingUpgrades(prev => {
            const newUpgrades = { ...prev };
            const newLevelCounts = { ...(prev[buildingId] || {}) };

            // fromLevel 减少一个（如果是0级则不需要记录）
            if (fromLevel > 0) {
                newLevelCounts[fromLevel] = (newLevelCounts[fromLevel] || 0) - 1;
                if (newLevelCounts[fromLevel] <= 0) {
                    delete newLevelCounts[fromLevel];
                }
            }

            // nextLevel 增加一个
            newLevelCounts[nextLevel] = (newLevelCounts[nextLevel] || 0) + 1;

            if (Object.keys(newLevelCounts).length === 0) {
                delete newUpgrades[buildingId];
            } else {
                newUpgrades[buildingId] = newLevelCounts;
            }

            return newUpgrades;
        });

        const upgradeName = BUILDING_UPGRADES[buildingId]?.[fromLevel]?.name || `等级${nextLevel}`;
        addLog(`⬆️ ${building.name} 升级为 ${upgradeName}！（花费 ${Math.ceil(silverCost)} 银币）`);

        // 播放升级音效
        try {
            const soundGenerator = generateSound(SOUND_TYPES.LEVEL_UP);
            if (soundGenerator) soundGenerator();
        } catch (e) {
            console.warn('Failed to play upgrade sound:', e);
        }
    };

    /**
     * 降级单座建筑
     * 新格式：直接操作等级计数
     * @param {string} buildingId - 建筑ID
     * @param {number} fromLevel - 当前等级（从哪个等级降级）
     */
    const downgradeBuilding = (buildingId, fromLevel) => {
        const building = BUILDINGS.find(b => b.id === buildingId);
        if (!building) {
            addLog('未找到该建筑。');
            return;
        }

        if (fromLevel <= 0) {
            addLog(`${building.name} 已是基础等级。`);
            return;
        }

        // 检查是否有该等级的建筑可降级
        const levelCounts = buildingUpgrades[buildingId] || {};
        if ((levelCounts[fromLevel] || 0) <= 0) {
            addLog(`没有等级 ${fromLevel} 的 ${building.name} 可降级。`);
            return;
        }

        // 降级不返还费用
        setBuildingUpgrades(prev => {
            const newUpgrades = { ...prev };
            const newLevelCounts = { ...(prev[buildingId] || {}) };

            // fromLevel 减少一个
            newLevelCounts[fromLevel] = (newLevelCounts[fromLevel] || 0) - 1;
            if (newLevelCounts[fromLevel] <= 0) {
                delete newLevelCounts[fromLevel];
            }

            // 降到的等级增加一个（如果降到0级则不记录）
            const targetLevel = fromLevel - 1;
            if (targetLevel > 0) {
                newLevelCounts[targetLevel] = (newLevelCounts[targetLevel] || 0) + 1;
            }

            // 如果该建筑类型没有任何升级了，移除整个条目
            if (Object.keys(newLevelCounts).length === 0) {
                delete newUpgrades[buildingId];
            } else {
                newUpgrades[buildingId] = newLevelCounts;
            }

            return newUpgrades;
        });

        addLog(`⬇️ ${building.name} 已降级。`);
    };
    /**
     * 批量升级建筑
     * 新格式：直接操作等级计数
     * @param {string} buildingId - 建筑ID
     * @param {number} fromLevel - 当前等级
     * @param {number} upgradeCount - 升级数量
     */
    const batchUpgradeBuilding = (buildingId, fromLevel, upgradeCount) => {
        const building = BUILDINGS.find(b => b.id === buildingId);
        if (!building) return;

        const buildingCount = buildings[buildingId] || 0;
        const levelCounts = buildingUpgrades[buildingId] || {};

        // 计算该等级的建筑数量（新格式）
        const distribution = {};
        let accounted = 0;
        for (const [lvlStr, lvlCount] of Object.entries(levelCounts)) {
            const lvl = parseInt(lvlStr);
            if (Number.isFinite(lvl) && lvlCount > 0) {
                distribution[lvl] = lvlCount;
                accounted += lvlCount;
            }
        }
        distribution[0] = buildingCount - accounted; // 0级的数量

        const availableAtLevel = distribution[fromLevel] || 0;
        const requestedCount = Math.min(upgradeCount, availableAtLevel);
        if (requestedCount <= 0) return;

        // 计算初始已有的同等级或更高升级数量，用于成本递增
        const baseExistingCount = getUpgradeCountAtOrAboveLevel(fromLevel + 1, buildingCount, levelCounts);

        // 逐个计算每座建筑的升级成本，考虑成本递增
        const totalResourceCost = {};
        let totalSilverCost = 0;
        const individualCosts = [];

        // 获取困难系数
        const difficultyLevel = gameState.difficulty || 'normal';
        const growthFactor = getBuildingCostGrowthFactor(difficultyLevel);
        const upgradeMultiplier = getBuildingUpgradeCostMultiplier(difficultyLevel);

        for (let i = 0; i < requestedCount; i++) {
            const currentExistingCount = baseExistingCount + i;
            const baseCost = getUpgradeCost(buildingId, fromLevel + 1, currentExistingCount, growthFactor);
            if (!baseCost) break;

            const cost = {};
            Object.entries(baseCost).forEach(([res, val]) => {
                cost[res] = Math.ceil(val * upgradeMultiplier);
            });

            individualCosts.push(cost);

            for (const [resource, amount] of Object.entries(cost)) {
                if (resource === 'silver') {
                    totalSilverCost += amount;
                } else {
                    totalResourceCost[resource] = (totalResourceCost[resource] || 0) + amount;
                    const marketPrice = getMarketPrice(resource);
                    totalSilverCost += amount * marketPrice;
                }
            }
        }

        // 检查资源是否足够
        let canAffordCount = individualCosts.length;

        for (const [resource, totalAmount] of Object.entries(totalResourceCost)) {
            const available = resources[resource] || 0;
            if (available < totalAmount) {
                let accumulated = 0;
                for (let i = 0; i < individualCosts.length; i++) {
                    accumulated += individualCosts[i][resource] || 0;
                    if (accumulated > available) {
                        canAffordCount = Math.min(canAffordCount, i);
                        break;
                    }
                }
            }
        }

        // 检查银币是否足够
        const availableSilver = resources.silver || 0;
        let accumulatedSilver = 0;
        for (let i = 0; i < canAffordCount; i++) {
            const cost = individualCosts[i];
            let silverForThis = 0;
            for (const [resource, amount] of Object.entries(cost)) {
                if (resource === 'silver') {
                    silverForThis += amount;
                } else {
                    silverForThis += amount * getMarketPrice(resource);
                }
            }
            if (accumulatedSilver + silverForThis > availableSilver) {
                canAffordCount = i;
                break;
            }
            accumulatedSilver += silverForThis;
        }

        const successCount = canAffordCount;

        if (successCount <= 0) {
            const firstBaseCost = getUpgradeCost(buildingId, fromLevel + 1, baseExistingCount, growthFactor);
            const firstCost = {};
            if (firstBaseCost) {
                 Object.entries(firstBaseCost).forEach(([res, val]) => {
                    firstCost[res] = Math.ceil(val * upgradeMultiplier);
                });
            }

            if (firstCost && Object.keys(firstCost).length > 0) {
                const hasMaterials = Object.entries(firstCost).every(([resource, amount]) => {
                    if (resource === 'silver') return true;
                    return (resources[resource] || 0) >= amount;
                });
                if (!hasMaterials) {
                    addLog(`市场资源不足，无法批量升级 ${building.name}。`);
                } else {
                    addLog(`银币不足，无法批量升级 ${building.name}。`);
                }
            }
            return;
        }

        // 重新计算实际消耗的资源和银币
        const actualResourceCost = {};
        let actualSilverCost = 0;
        for (let i = 0; i < successCount; i++) {
            const cost = individualCosts[i];
            for (const [resource, amount] of Object.entries(cost)) {
                if (resource === 'silver') {
                    actualSilverCost += amount;
                } else {
                    actualResourceCost[resource] = (actualResourceCost[resource] || 0) + amount;
                    actualSilverCost += amount * getMarketPrice(resource);
                }
            }
        }

        // 扣除资源和银币
        const newRes = { ...resources };
        for (const [resource, amount] of Object.entries(actualResourceCost)) {
            newRes[resource] = Math.max(0, (newRes[resource] || 0) - amount);
        }
        newRes.silver = Math.max(0, (newRes.silver || 0) - actualSilverCost);
        setResources(newRes);

        // 更新升级等级（新格式：等级计数）
        const nextLevel = fromLevel + 1;
        setBuildingUpgrades(prev => {
            const newUpgrades = { ...prev };
            const newLevelCounts = { ...(prev[buildingId] || {}) };

            // fromLevel 减少 successCount（如果是0级则不需要记录）
            if (fromLevel > 0) {
                newLevelCounts[fromLevel] = (newLevelCounts[fromLevel] || 0) - successCount;
                if (newLevelCounts[fromLevel] <= 0) {
                    delete newLevelCounts[fromLevel];
                }
            }

            // nextLevel 增加 successCount
            newLevelCounts[nextLevel] = (newLevelCounts[nextLevel] || 0) + successCount;

            if (Object.keys(newLevelCounts).length === 0) {
                delete newUpgrades[buildingId];
            } else {
                newUpgrades[buildingId] = newLevelCounts;
            }

            return newUpgrades;
        });

        addLog(`⬆️ 批量升级了 ${successCount} 座 ${building.name}！（花费 ${Math.ceil(actualSilverCost)} 银币）`);

        try {
            const soundGenerator = generateSound(SOUND_TYPES.LEVEL_UP);
            if (soundGenerator) soundGenerator();
        } catch (e) {
            console.warn('Failed to play upgrade sound:', e);
        }
    };

    /**
     * 批量降级建筑
     * 新格式：直接操作等级计数
     * @param {string} buildingId - 建筑ID
     * @param {number} fromLevel - 当前等级
     * @param {number} downgradeCount - 降级数量
     */
    const batchDowngradeBuilding = (buildingId, fromLevel, downgradeCount) => {
        const building = BUILDINGS.find(b => b.id === buildingId);
        if (!building) return;

        if (fromLevel <= 0) {
            addLog(`${building.name} 已是基础等级。`);
            return;
        }

        // 新格式：直接读取该等级的数量
        const levelCounts = buildingUpgrades[buildingId] || {};
        const availableAtLevel = levelCounts[fromLevel] || 0;
        const actualCount = Math.min(downgradeCount, availableAtLevel);
        if (actualCount <= 0) return;

        // 降级不返还费用
        setBuildingUpgrades(prev => {
            const newUpgrades = { ...prev };
            const newLevelCounts = { ...(prev[buildingId] || {}) };

            // fromLevel 减少 actualCount
            newLevelCounts[fromLevel] = (newLevelCounts[fromLevel] || 0) - actualCount;
            if (newLevelCounts[fromLevel] <= 0) {
                delete newLevelCounts[fromLevel];
            }

            // 降到的等级增加 actualCount（如果降到0级则不记录）
            const targetLevel = fromLevel - 1;
            if (targetLevel > 0) {
                newLevelCounts[targetLevel] = (newLevelCounts[targetLevel] || 0) + actualCount;
            }

            // 如果该建筑类型没有任何升级了，移除整个条目
            if (Object.keys(newLevelCounts).length === 0) {
                delete newUpgrades[buildingId];
            } else {
                newUpgrades[buildingId] = newLevelCounts;
            }

            return newUpgrades;
        });

        addLog(`⬇️ 批量降级了 ${actualCount} 座 ${building.name}！`);
    };

    // ========== 科技研究 ==========

    /**
     * 研究科技
     * @param {string} id - 科技ID
     */
    const researchTech = (id) => {
        const tech = TECHS.find(t => t.id === id);
        if (!tech) return;

        // 检查是否已研究
        if (techsUnlocked.includes(id)) {
            addLog(`已经研究过 ${tech.name}`);
            return;
        }

        // 检查时代要求
        if (tech.epoch > epoch) {
            addLog(`需要升级到 ${EPOCHS[tech.epoch].name} 才能研究 ${tech.name}`);
            return;
        }

        // 检查资源
        const difficulty = gameState.difficulty || 'normal';
        const techCostMultiplier = getTechCostMultiplier(difficulty);

        let canAfford = true;
        for (let resource in tech.cost) {
            const cost = Math.ceil(tech.cost[resource] * techCostMultiplier);
            if ((resources[resource] || 0) < cost) {
                canAfford = false;
                break;
            }
        }

        if (!canAfford) {
            addLog(`资源不足，无法研究 ${tech.name}`);
            return;
        }

        // 计算银币成本
        const silverCost = Object.entries(tech.cost).reduce((sum, [resource, amount]) => {
            const cost = Math.ceil(amount * techCostMultiplier);
            return sum + cost * getMarketPrice(resource);
        }, 0);

        // 检查银币是否足够
        if ((resources.silver || 0) < silverCost) {
            addLog('银币不足，无法支付研究费用');
            return;
        }

        // 扣除资源和银币
        const newRes = { ...resources };
        for (let resource in tech.cost) {
            const cost = Math.ceil(tech.cost[resource] * techCostMultiplier);
            newRes[resource] -= cost;
        }
        newRes.silver = Math.max(0, (newRes.silver || 0) - silverCost);

        setResources(newRes);
        setTechsUnlocked(prev => [...prev, id]);
        addLog(`✓ 研究完成：${tech.name}`);

        // 播放研究音效
        try {
            const soundGenerator = generateSound(SOUND_TYPES.RESEARCH);
            if (soundGenerator) soundGenerator();
        } catch (e) {
            console.warn('Failed to play research sound:', e);
        }
    };

    // ========== 官员管理 ==========

    /**
     * 触发新一轮官员选拔
     */
    const triggerOfficialSelection = () => {
        if (!isSelectionAvailable(lastSelectionDay, daysElapsed)) {
            addLog('选拔仍在冷却中。');
            return;
        }
        const candidates = triggerSelection(epoch, popStructure, classInfluence, market, rates);
        setOfficialCandidates(candidates);
        setLastSelectionDay(daysElapsed);
        addLog('已举行新一轮官员选拔，请查看候选人名单。');

        try {
            const soundGenerator = generateSound(SOUND_TYPES.UI_CLICK);
            if (soundGenerator) soundGenerator();
        } catch (e) {
            console.warn('Failed to play selection sound:', e);
        }
    };

    /**
     * 雇佣官员
     * @param {string} officialId 
     */
    const hireNewOfficial = (officialId) => {
        // 实际容量限制：取 建筑提供的岗位数 和 面板容量上限 的最小值
        // 防止在没有建造相应建筑时雇佣官员
        const effectiveCapacity = Math.min(jobsAvailable?.official || 0, officialCapacity);
        const result = hireOfficial(officialId, officialCandidates, officials, effectiveCapacity, daysElapsed);
        if (!result.success) {
            addLog(`雇佣失败：${result.error}`);
            return;
        }
        setOfficialCandidates(result.newCandidates);
        setOfficials(result.newOfficials);
        const hired = result.newOfficials[result.newOfficials.length - 1];
        addLog(`雇佣了官员 ${hired.name}。`);

        // 更新人口结构：从来源阶层移动到官员阶层
        // 确保数据同步，防止出现"官员数量对不上"的问题
        setPopStructure(prev => {
            const source = hired.sourceStratum || 'unemployed';
            const sourceCount = prev[source] || 0;
            return {
                ...prev,
                [source]: Math.max(0, sourceCount - 1),
                official: (prev.official || 0) + 1
            };
        });

        try {
            const soundGenerator = generateSound(SOUND_TYPES.HIRE); // 暂用 BUILD 音效替代，具体待定
            if (soundGenerator) soundGenerator();
        } catch (e) {
            console.warn('Failed to play hire sound:', e);
        }
    };

    /**
     * 解雇官员
     * @param {string} officialId 
     */
    const fireExistingOfficial = (officialId) => {
        const official = officials.find(o => o.id === officialId);
        const newOfficials = fireOfficial(officialId, officials);
        setOfficials(newOfficials);
        if (official) {
            addLog(`解雇了官员 ${official.name}。`);
            if (official.ownedProperties?.length) {
                addLog(`官员产业已全部倒闭（${official.ownedProperties.length} 处）`);
            }

            // 更新人口结构：从官员阶层移回来源阶层（或无业）
            setPopStructure(prev => {
                const target = official.sourceStratum || 'unemployed';
                return {
                    ...prev,
                    official: Math.max(0, (prev.official || 0) - 1),
                    [target]: (prev[target] || 0) + 1
                };
            });
        }
    };

    /**
     * 处置官员（流放/处死）
     * @param {string} officialId - 官员ID
     * @param {string} disposalType - 处置类型 ('exile' | 'execute')
     */
    const disposeExistingOfficial = (officialId, disposalType) => {
        const result = disposeOfficial(officialId, disposalType, officials, daysElapsed);

        if (!result.success) {
            addLog(`处置失败：${result.error}`);
            return;
        }

        const official = officials.find(o => o.id === officialId);

        // 更新官员列表
        setOfficials(result.newOfficials);

        // 获取没收的财产
        if (result.wealthGained > 0) {
            setResources(prev => ({
                ...prev,
                silver: (prev.silver || 0) + result.wealthGained
            }));
        }

        // 应用阶层好感度惩罚
        if (result.effects?.approvalChange) {
            setClassApproval(prev => {
                const updated = { ...prev };
                Object.entries(result.effects.approvalChange).forEach(([stratum, change]) => {
                    updated[stratum] = Math.max(0, Math.min(100, (updated[stratum] || 50) + change));
                });
                return updated;
            });
        }

        // 应用稳定度惩罚
        if (result.effects?.stabilityChange && result.effects.stabilityChange !== 0) {
            setStability(prev => Math.max(0, Math.min(1, (prev || 0.5) + result.effects.stabilityChange)));
        }

        // 应用组织度增加
        if (result.effects?.organizationChange) {
            setClassOrganization(prev => {
                const updated = { ...prev };
                Object.entries(result.effects.organizationChange).forEach(([stratum, change]) => {
                    updated[stratum] = Math.max(0, (updated[stratum] || 0) + change);
                });
                return updated;
            });
        }

        // 更新人口结构：从官员阶层移回来源阶层
        if (official) {
            setPopStructure(prev => {
                const target = official.sourceStratum || 'unemployed';
                return {
                    ...prev,
                    official: Math.max(0, (prev.official || 0) - 1),
                    [target]: (prev[target] || 0) + 1
                };
            });
        }

        if (result.propertyOutcome === 'transfer' && result.propertyTransfer?.transfers?.length) {
            const transferCount = result.propertyTransfer.transfers.length;
            addLog(`官员产业已转交给原始业主阶层（${transferCount} 处）`);
        } else if (result.propertyOutcome === 'collapse' && result.propertyCount > 0) {
            addLog(`官员产业已全部倒闭（${result.propertyCount} 处）`);
        }

        // 记录日志
        addLog(result.logMessage);
    };

    /**
     * 调整官员薪俸
     * @param {string} officialId - 官员ID
     * @param {number} nextSalary - 新薪俸
     */
    const updateOfficialSalary = (officialId, nextSalary) => {
        if (!officialId || !Number.isFinite(nextSalary)) return;
        setOfficials(prev => prev.map(official => (
            official.id === officialId ? { ...official, salary: Math.floor(nextSalary) } : official
        )));
    };

    // ========== 手动采集 ==========

    /**
     * 手动采集资源
     * @param {Event} e - 鼠标事件
     */
    const manualGather = (e) => {
        setClicks(prev => [...prev, {
            id: Date.now(),
            x: e.clientX,
            y: e.clientY,
            text: "+1",
            color: "text-white"
        }]);
        setResources(prev => ({
            ...prev,
            food: prev.food + 1,
            wood: prev.wood + 1
        }));
    };

    // ========== 军事系统 ==========

    /**
     * 招募单位
     * @param {string} unitId - 单位ID
     */
    const recruitUnit = (unitId, options = {}) => {
        const unit = UNIT_TYPES[unitId];
        if (!unit) return false;
        const { silent = false, auto = false } = options;

        // 检查时代
        if (unit.epoch > epoch) {
            if (!silent) {
                addLog(`需要升级到 ${EPOCHS[unit.epoch].name} 才能训练 ${unit.name}`);
            }
            return false;
        }

        // 检查资源
        let canAfford = true;
        for (let resource in unit.recruitCost) {
            if ((resources[resource] || 0) < unit.recruitCost[resource]) {
                canAfford = false;
                break;
            }
        }

        if (!canAfford) {
            if (!silent) {
                addLog(`资源不足，无法训练 ${unit.name}`);
            }
            return false;
        }

        const silverCost = Object.entries(unit.recruitCost).reduce((sum, [resource, amount]) => {
            return sum + amount * getMarketPrice(resource);
        }, 0);

        if ((resources.silver || 0) < silverCost) {
            if (!silent) {
                addLog('银币不足，无法支付征兵物资费用。');
            }
            return false;
        }

        const capacity = getMilitaryCapacity();
        const totalArmyCount = getTotalArmyCount();
        if (capacity > 0 && totalArmyCount + 1 > capacity) {
            if (!silent && !auto) {
                addLog(`军事容量不足（${totalArmyCount}/${capacity}），需要建造更多兵营。`);
            }
            return false;
        }

        // 扣除资源
        const newRes = { ...resources };
        for (let resource in unit.recruitCost) {
            newRes[resource] -= unit.recruitCost[resource];
        }
        newRes.silver = Math.max(0, (newRes.silver || 0) - silverCost);
        setResources(newRes);

        // 加入训练队列，状态为等待人员
        setMilitaryQueue(prev => [...prev, {
            unitId,
            status: 'waiting', // 等待人员填补岗位
            remainingTime: unit.trainingTime, // 保存训练时长，等开始训练时使用
            totalTime: unit.trainingTime
        }]);

        if (!silent) {
            addLog(`开始招募 ${unit.name}，等待人员填补岗位...`);
        }
        return true;
    };

    /**
     * 解散单位
     * @param {string} unitId - 单位ID
     */
    const disbandUnit = (unitId) => {
        if ((army[unitId] || 0) > 0) {
            setArmy(prev => ({
                ...prev,
                [unitId]: prev[unitId] - 1
            }));
            addLog(`解散了 ${UNIT_TYPES[unitId].name}`);
        }
    };

    /**
     * 取消训练队列中的单位
     * @param {number} queueIndex - 队列索引
     */
    const cancelTraining = (queueIndex) => {
        setMilitaryQueue(prev => {
            if (queueIndex < 0 || queueIndex >= prev.length) {
                return prev;
            }

            const item = prev[queueIndex];
            const unit = UNIT_TYPES[item.unitId];

            // 移除该项
            const newQueue = prev.filter((_, idx) => idx !== queueIndex);

            // 如果是等待状态或训练状态，返还部分资源（50%）
            if (item.status === 'waiting' || item.status === 'training') {
                const refundResources = {};
                for (let resource in unit.recruitCost) {
                    refundResources[resource] = Math.floor(unit.recruitCost[resource] * 0.5);
                }

                const silverCost = Object.entries(unit.recruitCost).reduce((sum, [resource, amount]) => {
                    return sum + amount * getMarketPrice(resource);
                }, 0);
                const refundSilver = Math.floor(silverCost * 0.5);

                setResources(prev => {
                    const newRes = { ...prev };
                    for (let resource in refundResources) {
                        newRes[resource] = (newRes[resource] || 0) + refundResources[resource];
                    }
                    newRes.silver = (newRes.silver || 0) + refundSilver;
                    return newRes;
                });

                addLog(`取消训练 ${unit.name}，返还50%资源`);
            }

            return newQueue;
        });
    };

    /**
     * 一键取消所有训练队列
     */
    const cancelAllTraining = () => {
        setMilitaryQueue(prev => {
            if (prev.length === 0) return prev;

            let totalRefundSilver = 0;
            const totalRefundResources = {};

            // Calculate total refund for all items
            prev.forEach(item => {
                const unit = UNIT_TYPES[item.unitId];
                if (item.status === 'waiting' || item.status === 'training') {
                    for (let resource in unit.recruitCost) {
                        totalRefundResources[resource] = (totalRefundResources[resource] || 0) + Math.floor(unit.recruitCost[resource] * 0.5);
                    }
                    const silverCost = Object.entries(unit.recruitCost).reduce((sum, [resource, amount]) => {
                        return sum + amount * getMarketPrice(resource);
                    }, 0);
                    totalRefundSilver += Math.floor(silverCost * 0.5);
                }
            });

            // Refund all resources
            setResources(prevRes => {
                const newRes = { ...prevRes };
                for (let resource in totalRefundResources) {
                    newRes[resource] = (newRes[resource] || 0) + totalRefundResources[resource];
                }
                newRes.silver = (newRes.silver || 0) + totalRefundSilver;
                return newRes;
            });

            addLog(`一键取消了 ${prev.length} 个训练任务，返还50%资源`);
            return [];
        });
    };

    /**
     * 一键解散某种兵种的所有单位
     * @param {string} unitId - 兵种ID
     */
    const disbandAllUnits = (unitId) => {
        const count = army[unitId] || 0;
        if (count <= 0) return;

        setArmy(prev => ({
            ...prev,
            [unitId]: 0
        }));
        addLog(`解散了全部 ${count} 个 ${UNIT_TYPES[unitId].name}`);
    };

    /**
     * 发起战斗
     * @param {string} missionId - 行动类型
     * @param {string} nationId - 目标国家
     */
    const launchBattle = (missionId, nationId) => {
        const mission = MILITARY_ACTIONS.find(action => action.id === missionId);
        if (!mission) {
            addLog('未找到对应的军事行动。');
            return;
        }

        const targetNation = nations.find(n => n.id === nationId);
        if (!targetNation) {
            addLog('请先选择一个目标国家。');
            return;
        }
        if (!targetNation.isAtWar) {
            addLog(`${targetNation.name} 当前与你处于和平状态。`);
            return;
        }

        // 军队行军时间检查
        // 如果上次攻击的目标不是当前目标，且距离上次攻击不足 5 天，则需要行军
        if (lastBattleTargetId && lastBattleTargetId !== nationId) {
            const daysSinceLastBattle = daysElapsed - lastBattleDay;
            const TRAVEL_DAYS = 5;

            if (daysSinceLastBattle < TRAVEL_DAYS) {
                const remainingTravelDays = TRAVEL_DAYS - daysSinceLastBattle;
                addLog(`⏳ 军队正在向 ${targetNation.name} 进军中，预计还需要 ${remainingTravelDays} 天抵达战场。`);
                return;
            }
        }

        // 检查针对该目标的军事行动冷却
        const cooldownKey = `military_${nationId}_${missionId}`;
        const lastActionDay = targetNation.lastMilitaryActionDay?.[missionId] || 0;
        const cooldownDays = mission.cooldownDays || 5;
        const daysSinceLastAction = daysElapsed - lastActionDay;

        if (lastActionDay > 0 && daysSinceLastAction < cooldownDays) {
            const remainingDays = cooldownDays - daysSinceLastAction;
            addLog(`⏳ 针对 ${targetNation.name} 的${mission.name}行动尚在冷却中，还需 ${remainingDays} 天。`);
            return;
        }

        const totalUnits = Object.values(army).reduce((sum, count) => sum + count, 0);
        if (totalUnits === 0) {
            addLog('没有可用的军队');
            return;
        }
        const attackerUnitEntries = Object.entries(army).filter(([, count]) => count > 0);
        const attackerAllCavalry = attackerUnitEntries.length > 0
            && attackerUnitEntries.every(([unitId]) => UNIT_TYPES[unitId]?.category === 'cavalry');

        const attackerData = {
            army,
            epoch,
            militaryBuffs: modifiers?.militaryBonus || 0,
        };

        // 计算敌方时代（基于国家的出现和消失时代）
        const enemyEpoch = Math.max(targetNation.appearEpoch || 0, Math.min(epoch, targetNation.expireEpoch ?? epoch));

        // 使用派遣比例生成敌方军队
        const deploymentRatio = mission.deploymentRatio || { min: 0.1, max: 0.2 };
        // 随机选择派遣比例范围内的值
        const actualDeploymentRatio = deploymentRatio.min + Math.random() * (deploymentRatio.max - deploymentRatio.min);

        // 使用 generateNationArmy 生成敌方军队
        const defenderArmy = generateNationArmy(targetNation, enemyEpoch, actualDeploymentRatio);

        const defenderData = {
            army: defenderArmy,
            epoch: enemyEpoch,
            militaryBuffs: mission.enemyBuff || 0,
            wealth: targetNation.wealth || 500,
        };

        const result = simulateBattle(attackerData, defenderData);
        let resourcesGained = {};
        let totalLootValue = 0; // 记录本次掠夺总价值，用于扣减敌方储备

        if (result.victory) {
            const combinedLoot = {};
            const mergeLoot = (source) => {
                Object.entries(source || {}).forEach(([resource, amount]) => {
                    if (amount > 0) {
                        combinedLoot[resource] = (combinedLoot[resource] || 0) + Math.floor(amount);
                    }
                });
            };

            // 计算敌方可掠夺储备（lootReserve）
            // 初始储备 = 敌方财富 × 1.5，战争中会逐渐被掠夺耗尽
            const initialLootReserve = (targetNation.wealth || 500) * 1.5;
            const currentLootReserve = targetNation.lootReserve ?? initialLootReserve;

            // 计算储备系数：储备越少，能掠夺的越少
            // 储备 100% 时系数 = 1.0，储备 50% 时系数 = 0.5，储备 10% 时系数 = 0.1
            const reserveRatio = Math.max(0.05, currentLootReserve / Math.max(1, initialLootReserve));
            const lootMultiplier = Math.min(1.0, reserveRatio);

            // Add battle result loot (from simulateBattle) - 应用储备系数
            if (result.loot) {
                Object.entries(result.loot).forEach(([resource, amount]) => {
                    if (amount > 0) {
                        const adjustedAmount = Math.floor(amount * lootMultiplier);
                        if (adjustedAmount > 0) {
                            combinedLoot[resource] = (combinedLoot[resource] || 0) + adjustedAmount;
                            totalLootValue += adjustedAmount;
                        }
                    }
                });
            }

            // Calculate proportional loot based on lootConfig if available
            // [FIXED] Now uses calculateProportionalLoot which has hard caps
            if (mission.lootConfig) {
                const proportionalLoot = calculateProportionalLoot(resources, targetNation, mission.lootConfig);

                Object.entries(proportionalLoot).forEach(([resource, amount]) => {
                    if (amount > 0) {
                        // 应用储备系数
                        const adjustedAmount = Math.floor(amount * lootMultiplier);

                        // Add some randomness (±20%)
                        const randomFactor = 0.8 + Math.random() * 0.4;
                        const finalAmount = Math.floor(adjustedAmount * randomFactor);

                        if (finalAmount > 0) {
                            combinedLoot[resource] = (combinedLoot[resource] || 0) + finalAmount;
                            // 银币计入总价值，其他资源按一定比例折算
                            totalLootValue += resource === 'silver' ? finalAmount : finalAmount * 0.5;
                        }
                    }
                });
            } else {
                // Fallback to legacy loot ranges - 应用储备系数
                Object.entries(mission.loot || {}).forEach(([resource, range]) => {
                    if (!Array.isArray(range) || range.length < 2) return;
                    const [min, max] = range;
                    let amount = Math.floor(min + Math.random() * (max - min + 1));
                    amount = Math.floor(amount * lootMultiplier);
                    if (amount > 0) {
                        combinedLoot[resource] = (combinedLoot[resource] || 0) + amount;
                        totalLootValue += resource === 'silver' ? amount : amount * 0.5;
                    }
                });
            }

            // 如果储备已经很低，显示提示信息
            if (reserveRatio < 0.3) {
                addLog(`⚠️ ${targetNation.name} 的资源已被大量掠夺，可获取的战利品大幅减少。`);
            }

            const unlockedLoot = {};
            Object.entries(combinedLoot).forEach(([resource, amount]) => {
                if (amount > 0 && isResourceUnlocked(resource, epoch, techsUnlocked)) {
                    unlockedLoot[resource] = amount;
                }
            });
            resourcesGained = unlockedLoot;

            if (Object.keys(unlockedLoot).length > 0) {
                setResources(prev => {
                    const updated = { ...prev };
                    Object.entries(unlockedLoot).forEach(([resource, amount]) => {
                        updated[resource] = (updated[resource] || 0) + amount;
                    });
                    return updated;
                });
            }
        }

        // 处理军队损失
        // 处理军队损失
        const lossesToReplenishRaw = result.attackerLosses || {};
        const lossesToReplenish = {};

        // 防御性修复：确保损失不超过实际拥有的军队数量
        Object.entries(lossesToReplenishRaw).forEach(([unitId, lossCount]) => {
            const currentCount = army[unitId] || 0;
            const actualLoss = Math.min(currentCount, lossCount);
            if (actualLoss > 0) {
                lossesToReplenish[unitId] = actualLoss;
            }
        });

        setArmy(prevArmy => {
            const updated = { ...prevArmy };
            Object.entries(lossesToReplenish).forEach(([unitId, lossCount]) => {
                updated[unitId] = Math.max(0, (updated[unitId] || 0) - lossCount);
            });
            return updated;
        });

        // 玩家主动出击的战斗不会进入主循环的 AUTO_REPLENISH_LOSSES 日志通道
        // 因此这里需要处理战损自动补兵
        handleAutoReplenishLosses(lossesToReplenish, { source: 'player_battle' });

        const influenceChange = result.victory
            ? mission.influence?.win || 0
            : mission.influence?.lose || 0;
        if (influenceChange !== 0) {
            setClassInfluenceShift(prev => ({
                ...prev,
                soldier: (prev?.soldier || 0) + influenceChange,
            }));
        }

        const enemyLossCount = Object.values(result.defenderLosses || {}).reduce((sum, val) => sum + val, 0);
        const wealthDamagePerUnit = mission.wealthDamage || 20;
        const wealthDamage = result.victory
            ? Math.min(targetNation.wealth || 0, Math.max(50, enemyLossCount * wealthDamagePerUnit))
            : 0;
        const warScoreDelta = result.victory
            ? (mission.winScore || 10)
            : -(mission.loseScore || 8);

        // 计算军事实力损失（基于伤亡和财富损失）
        const militaryStrengthDamage = result.victory
            ? Math.min(0.15, enemyLossCount * 0.005 + wealthDamage / 10000) // 每次胜利最多削弱15%
            : 0;

        // 计算人口损失（战争消耗）
        const populationLoss = result.victory
            ? Math.floor(enemyLossCount * 0.8) // 每个士兵损失对应0.8人口损失
            : 0;

        setNations(prev => prev.map(n => {
            if (n.id !== nationId) return n;
            const currentStrength = n.militaryStrength ?? 1.0;
            const newStrength = Math.max(0.2, currentStrength - militaryStrengthDamage); // 最低保持20%实力
            const currentPopulation = n.population ?? 1000;
            const newPopulation = Math.max(100, currentPopulation - populationLoss); // 最低保持100人口

            // 计算新的掠夺储备 - 扣除本次掠夺的价值
            const initialLootReserve = (n.wealth || 500) * 1.5;
            const currentLootReserve = n.lootReserve ?? initialLootReserve;
            const newLootReserve = result.victory
                ? Math.max(0, currentLootReserve - totalLootValue)
                : currentLootReserve;

            // 更新军事行动冷却记录
            const updatedLastMilitaryActionDay = {
                ...(n.lastMilitaryActionDay || {}),
                [missionId]: daysElapsed,
            };

            return {
                ...n,
                wealth: Math.max(0, (n.wealth || 0) - wealthDamage),
                warScore: (n.warScore || 0) + warScoreDelta,
                enemyLosses: (n.enemyLosses || 0) + enemyLossCount,
                militaryStrength: newStrength,
                population: newPopulation,
                lootReserve: newLootReserve,
                lastMilitaryActionDay: updatedLastMilitaryActionDay,
            };
        }));

        setBattleResult({
            id: `battle_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            victory: result.victory,
            actionType: mission.id,
            missionName: mission.name,
            missionDesc: mission.desc,
            missionDifficulty: mission.difficulty,
            ourPower: result.attackerPower,
            enemyPower: result.defenderPower,
            powerRatio: result.defenderPower > 0 ? result.attackerPower / result.defenderPower : result.attackerPower,
            score: Number(result.attackerAdvantage || 0),
            losses: result.attackerLosses || {},
            enemyLosses: result.defenderLosses || {},
            attackerArmy: attackerData.army, // Pass attacker army composition
            defenderArmy: defenderData.army, // Pass defender army composition
            isPlayerAttacker: true,
            resourcesGained,
            attackerAllCavalry,
            attackerTotalUnits: totalUnits,
            nationName: targetNation.name,
            description: (result.battleReport || []).join('\n'),
        });

        addLog(result.victory ? `⚔️ 针对 ${targetNation.name} 的行动取得胜利！` : `💀 对 ${targetNation.name} 的进攻受挫。`);

        // 更新上次战斗目标和时间，用于计算行军时间
        if (setLastBattleTargetId && setLastBattleDay) {
            setLastBattleTargetId(nationId);
            setLastBattleDay(daysElapsed);
        }

        // 播放战斗音效
        try {
            const soundGenerator = generateSound(result.victory ? SOUND_TYPES.VICTORY : SOUND_TYPES.BATTLE);
            if (soundGenerator) soundGenerator();
        } catch (e) {
            console.warn('Failed to play battle sound:', e);
        }
    };

    // ========== 外交系统 ==========

    /**
     * 处理外交行动
     * @param {string} nationId - 国家ID
     * @param {string} action - 外交行动类型
     * @param {Object} payload - 附加参数
     */
    const handleDiplomaticAction = (nationId, action, payload = {}) => {
        const targetNation = nations.find(n => n.id === nationId);
        if (!targetNation) return;
        const clampRelation = (value) => Math.max(0, Math.min(100, value));

        // 外交动作冷却时间配置（天数）
        const DIPLOMATIC_COOLDOWNS = {
            gift: 30,           // 送礼：30天冷却
            demand: 30,         // 索要：30天冷却
            provoke: 30,        // 挑拨：30天冷却
            propose_alliance: 30, // 请求结盟：30天冷却
            break_alliance: 0,  // 解除同盟：无冷却（但有严重后果）
        };

        // 检查外交动作冷却时间
        const cooldownDays = DIPLOMATIC_COOLDOWNS[action];
        const cooldownModifier = modifiers?.officialEffects?.diplomaticCooldown || 0;
        const adjustedCooldownDays = cooldownDays && cooldownDays > 0
            ? Math.max(1, Math.round(cooldownDays * (1 + cooldownModifier)))
            : cooldownDays;
        if (adjustedCooldownDays && adjustedCooldownDays > 0) {
            const lastActionDay = targetNation.lastDiplomaticActionDay?.[action] || 0;
            const daysSinceLastAction = daysElapsed - lastActionDay;
            if (lastActionDay > 0 && daysSinceLastAction < adjustedCooldownDays) {
                const remainingDays = adjustedCooldownDays - daysSinceLastAction;
                const actionNames = {
                    gift: '送礼',
                    demand: '索要',
                    provoke: '挑拨',
                    propose_alliance: '请求结盟',
                };
                addLog(`⏳ 对 ${targetNation.name} 的${actionNames[action] || action}行动尚在冷却中，还需 ${remainingDays} 天。`);
                return;
            }
        }

        if (targetNation.isAtWar && (action === 'gift' || action === 'trade' || action === 'import' || action === 'demand')) {
            addLog(`${targetNation.name} 与你正处于战争状态，无法进行此外交行动。`);
            return;
        }

        switch (action) {
            case 'gift': {
                // 动态计算送礼成本：基于双方财富的5%，范围100-500000
                const dynamicGiftCost = calculateDynamicGiftCost(resources.silver || 0, targetNation.wealth || 0);
                const giftCost = payload.amount || dynamicGiftCost;
                if ((resources.silver || 0) < giftCost) {
                    addLog(`银币不足，无法赠送礼物。需要 ${giftCost} 银币。`);
                    return;
                }
                setResources(prev => ({ ...prev, silver: prev.silver - giftCost }));
                setNations(prev => prev.map(n =>
                    n.id === nationId
                        ? {
                            ...n,
                            relation: clampRelation((n.relation || 0) + 10),
                            wealth: (n.wealth || 0) + giftCost,
                            lastDiplomaticActionDay: {
                                ...(n.lastDiplomaticActionDay || {}),
                                gift: daysElapsed,
                            },
                        }
                        : n
                ));
                addLog(`你向 ${targetNation.name} 赠送了价值 ${giftCost} 银币的礼物，关系提升了。`);
                break;
            }

            case 'trade': {
                const resourceKey = payload.resource;
                const amount = Math.max(1, Math.floor(payload.amount || 5));
                if (!resourceKey || !RESOURCES[resourceKey] || RESOURCES[resourceKey].type === 'virtual' || resourceKey === 'silver') {
                    addLog('该资源无法进行套利贸易。');
                    return;
                }
                if ((resources[resourceKey] || 0) < amount) {
                    addLog('库存不足，无法出口。');
                    return;
                }

                // 检查目标国家是否有缺口（库存低于目标值的50%）
                const tradeStatus = calculateTradeStatus(resourceKey, targetNation, daysElapsed);
                const shortageCapacity = Math.floor(tradeStatus.shortageAmount);

                if (!tradeStatus.isShortage || shortageCapacity <= 0) {
                    addLog(`${targetNation.name} 对 ${RESOURCES[resourceKey].name} 没有缺口，无法出口。`);
                    return;
                }

                // 检查是否超过缺口限制
                if (amount > shortageCapacity) {
                    addLog(`${targetNation.name} 对 ${RESOURCES[resourceKey].name} 的缺口只有 ${shortageCapacity} 单位，已调整出口数量（原计划 ${amount}）。`);
                    // 调整交易数量为缺口的最大值
                    payload.amount = shortageCapacity;
                    return handleDiplomaticAction(nationId, action, payload); // 递归调用，使用调整后的数量
                }

                const localPrice = getMarketPrice(resourceKey);
                const foreignPrice = calculateForeignPrice(resourceKey, targetNation, daysElapsed);
                const totalCost = foreignPrice * amount;

                const payout = totalCost;
                const profitPerUnit = foreignPrice - localPrice;

                // 执行交易
                setResources(prev => ({
                    ...prev,
                    silver: prev.silver + payout,
                    [resourceKey]: Math.max(0, (prev[resourceKey] || 0) - amount),
                }));

                setNations(prev => prev.map(n =>
                    n.id === nationId
                        ? {
                            ...n,
                            budget: Math.max(0, (n.budget || 0) - payout), // 扣除预算
                            inventory: {
                                ...n.inventory,
                                [resourceKey]: ((n.inventory || {})[resourceKey] || 0) + amount, // 增加库存
                            },
                            relation: clampRelation((n.relation || 0) + (profitPerUnit > 0 ? 2 : 0)),
                        }
                        : n
                ));

                const logVisibility = eventEffectSettings?.logVisibility || {};
                const shouldLogTradeRoutes = logVisibility.showTradeRouteLogs ?? true;
                if (shouldLogTradeRoutes) {
                    addLog(`向 ${targetNation.name} 出口 ${amount}${RESOURCES[resourceKey].name}，收入 ${payout.toFixed(1)} 银币（单价差 ${profitPerUnit >= 0 ? '+' : ''}${profitPerUnit.toFixed(2)}）。`);
                }
                break;
            }

            case 'import': {
                const resourceKey = payload.resource;
                const amount = Math.max(1, Math.floor(payload.amount || 5));
                if (!resourceKey || !RESOURCES[resourceKey] || RESOURCES[resourceKey].type === 'virtual' || resourceKey === 'silver') {
                    addLog('该资源无法进行套利贸易。');
                    return;
                }

                // 检查目标国家是否有盈余（库存高于目标值的150%）
                const tradeStatus = calculateTradeStatus(resourceKey, targetNation, daysElapsed);
                const surplusCapacity = Math.floor(tradeStatus.surplusAmount);

                if (!tradeStatus.isSurplus || surplusCapacity <= 0) {
                    addLog(`${targetNation.name} 对 ${RESOURCES[resourceKey].name} 没有盈余，无法进口。`);
                    return;
                }

                // 检查是否超过盈余限制
                if (amount > surplusCapacity) {
                    addLog(`${targetNation.name} 对 ${RESOURCES[resourceKey].name} 的盈余只有 ${surplusCapacity} 单位，已调整进口数量（原计划 ${amount}）。`);
                    // 调整交易数量为盈余的最大值
                    payload.amount = surplusCapacity;
                    return handleDiplomaticAction(nationId, action, payload); // 递归调用，使用调整后的数量
                }

                const localPrice = getMarketPrice(resourceKey);
                const foreignPrice = calculateForeignPrice(resourceKey, targetNation, daysElapsed);
                const cost = foreignPrice * amount;

                if ((resources.silver || 0) < cost) {
                    addLog('银币不足，无法从外国进口。');
                    return;
                }

                const profitPerUnit = localPrice - foreignPrice;

                // 执行交易
                setResources(prev => ({
                    ...prev,
                    silver: prev.silver - cost,
                    [resourceKey]: (prev[resourceKey] || 0) + amount,
                }));

                setNations(prev => prev.map(n =>
                    n.id === nationId
                        ? {
                            ...n,
                            budget: (n.budget || 0) + cost, // 增加预算
                            inventory: {
                                ...n.inventory,
                                [resourceKey]: Math.max(0, ((n.inventory || {})[resourceKey] || 0) - amount), // 减少库存
                            },
                            relation: clampRelation((n.relation || 0) + (profitPerUnit > 0 ? 2 : 0)),
                        }
                        : n
                ));

                const logVisibility = eventEffectSettings?.logVisibility || {};
                const shouldLogTradeRoutes = logVisibility.showTradeRouteLogs ?? true;
                if (shouldLogTradeRoutes) {
                    addLog(`从 ${targetNation.name} 进口 ${amount}${RESOURCES[resourceKey].name}，支出 ${cost.toFixed(1)} 银币（单价差 ${profitPerUnit >= 0 ? '+' : ''}${profitPerUnit.toFixed(2)}）。`);
                }
                break;
            }

            case 'demand': {
                const armyPower = calculateBattlePower(army, epoch, modifiers?.militaryBonus || 0);
                const successChance = Math.max(0.1, (armyPower / (armyPower + 200)) * 0.6 + (targetNation.relation || 0) / 300);
                if (Math.random() < successChance) {
                    const tribute = Math.min(targetNation.wealth || 0, Math.ceil(150 + armyPower * 0.25));
                    setResources(prev => ({ ...prev, silver: prev.silver + tribute }));
                    setNations(prev => prev.map(n =>
                        n.id === nationId
                            ? {
                                ...n,
                                wealth: Math.max(0, (n.wealth || 0) - tribute),
                                relation: clampRelation((n.relation || 0) - 30),
                                lastDiplomaticActionDay: {
                                    ...(n.lastDiplomaticActionDay || {}),
                                    demand: daysElapsed,
                                },
                            }
                            : n
                    ));
                    addLog(`${targetNation.name} 被迫缴纳 ${tribute} 银币。`);
                } else {
                    const escalate = Math.random() < (0.4 + (targetNation.aggression || 0) * 0.4);
                    setNations(prev => prev.map(n =>
                        n.id === nationId
                            ? {
                                ...n,
                                relation: clampRelation((n.relation || 0) - 40),
                                isAtWar: escalate ? true : n.isAtWar,
                                warStartDay: escalate ? daysElapsed : n.warStartDay,
                                warDuration: escalate ? 0 : n.warDuration,
                                lastDiplomaticActionDay: {
                                    ...(n.lastDiplomaticActionDay || {}),
                                    demand: daysElapsed,
                                },
                            }
                            : n
                    ));
                    addLog(`${targetNation.name} 拒绝了你的勒索${escalate ? '，并向你宣战！' : '。'}`);
                }
                break;
            }

            case 'provoke': {
                // 挑拨关系：花费银币离间两个国家
                const provokeCost = calculateProvokeCost(resources.silver || 0, targetNation.wealth || 0);
                if ((resources.silver || 0) < provokeCost) {
                    addLog(`银币不足，无法进行挑拨行动（需要 ${provokeCost} 银币）。`);
                    return;
                }

                // 从 payload 中获取指定的目标国家，或者随机选择
                let otherNation;
                if (payload.targetNationId) {
                    otherNation = nations.find(n => n.id === payload.targetNationId);
                    if (!otherNation) {
                        addLog('指定的目标国家不存在。');
                        return;
                    }
                } else {
                    // 找到可以被离间的其他国家（与目标国有外交关系的国家）
                    const visibleNations = nations.filter(n =>
                        n.id !== nationId &&
                        epoch >= (n.appearEpoch ?? 0) &&
                        (n.expireEpoch == null || epoch <= n.expireEpoch)
                    );

                    if (visibleNations.length === 0) {
                        addLog('没有其他国家可以被离间。');
                        return;
                    }

                    // 随机选择一个国家作为离间目标
                    otherNation = visibleNations[Math.floor(Math.random() * visibleNations.length)];
                }

                // 成功率取决于玩家与目标国家的关系
                const playerRelation = targetNation.relation || 50;
                const successChance = Math.min(0.8, 0.3 + playerRelation / 200);

                setResources(prev => ({ ...prev, silver: prev.silver - provokeCost }));

                if (Math.random() < successChance) {
                    // 成功：降低两国之间的关系
                    const relationDamage = Math.floor(15 + Math.random() * 15);

                    setNations(prev => prev.map(n => {
                        if (n.id === nationId) {
                            const newForeignRelations = { ...(n.foreignRelations || {}) };
                            newForeignRelations[otherNation.id] = Math.max(0, (newForeignRelations[otherNation.id] || 50) - relationDamage);
                            return {
                                ...n,
                                foreignRelations: newForeignRelations,
                                lastDiplomaticActionDay: {
                                    ...(n.lastDiplomaticActionDay || {}),
                                    provoke: daysElapsed,
                                },
                            };
                        }
                        if (n.id === otherNation.id) {
                            const newForeignRelations = { ...(n.foreignRelations || {}) };
                            newForeignRelations[nationId] = Math.max(0, (newForeignRelations[nationId] || 50) - relationDamage);
                            return { ...n, foreignRelations: newForeignRelations };
                        }
                        return n;
                    }));

                    addLog(`🕵️ 你成功离间了 ${targetNation.name} 与 ${otherNation.name} 的关系（-${relationDamage}）！`);
                } else {
                    // 失败：被发现，与目标国家关系下降
                    setNations(prev => prev.map(n =>
                        n.id === nationId
                            ? {
                                ...n,
                                relation: clampRelation((n.relation || 0) - 15),
                                lastDiplomaticActionDay: {
                                    ...(n.lastDiplomaticActionDay || {}),
                                    provoke: daysElapsed,
                                },
                            }
                            : n
                    ));
                    addLog(`🕵️ 你的离间行动被 ${targetNation.name} 发现了，关系恶化！`);
                }
                break;
            }

            case 'declare_war': {
                // 检查和平协议是否仍然有效
                if (targetNation.peaceTreatyUntil && daysElapsed < targetNation.peaceTreatyUntil) {
                    const remainingDays = targetNation.peaceTreatyUntil - daysElapsed;
                    addLog(`无法宣战：与 ${targetNation.name} 的和平协议还有 ${remainingDays} 天有效期。`);
                    return;
                }

                // 检查是否为正式同盟关系
                if (targetNation.alliedWithPlayer === true) {
                    addLog(`无法宣战：${targetNation.name} 是你的正式盟友。必须先解除同盟才能宣战！`);
                    return;
                }

                // 找出目标国家的正式盟友，这些盟友也会被卷入战争
                // 但如果某个盟友同时也是玩家的正式盟友，则该盟友保持中立
                const targetAllies = nations.filter(n => {
                    if (n.id === nationId || n.id === targetNation.id) return false;
                    // 检查是否是目标国家的正式联盟
                    const isTargetAlly = (targetNation.allies || []).includes(n.id) || (n.allies || []).includes(targetNation.id);
                    if (!isTargetAlly) return false;
                    // 排除同时也是玩家正式盟友的国家（共同盟友保持中立）
                    if (n.alliedWithPlayer === true) return false;
                    return true;
                });

                // 找出共同盟友（同时是玩家和目标国家的盟友），这些国家会保持中立
                const neutralAllies = nations.filter(n => {
                    if (n.id === nationId || n.id === targetNation.id) return false;
                    const isTargetAlly = (targetNation.allies || []).includes(n.id) || (n.allies || []).includes(targetNation.id);
                    return isTargetAlly && n.alliedWithPlayer === true;
                });

                // 对目标国家宣战
                setNations(prev => {
                    let updated = prev.map(n => {
                        if (n.id === nationId) {
                            // 初始化可掠夺储备 = 财富 × 1.5
                            const initialLootReserve = (n.wealth || 500) * 1.5;
                            return {
                                ...n,
                                relation: 0,
                                isAtWar: true,
                                warScore: 0,
                                warStartDay: daysElapsed,
                                warDuration: 0,
                                enemyLosses: 0,
                                peaceTreatyUntil: undefined,
                                lootReserve: initialLootReserve, // 初始化掠夺储备
                                lastMilitaryActionDay: undefined, // 重置军事行动冷却
                            };
                        }
                        return n;
                    });

                    // 同盟连坐：目标国家的盟友也加入战争
                    if (targetAllies.length > 0) {
                        updated = updated.map(n => {
                            if (targetAllies.some(ally => ally.id === n.id)) {
                                // 初始化可掠夺储备
                                const initialLootReserve = (n.wealth || 500) * 1.5;
                                return {
                                    ...n,
                                    relation: Math.max(0, (n.relation || 50) - 40), // 关系大幅恶化
                                    isAtWar: true,
                                    warScore: 0,
                                    warStartDay: daysElapsed,
                                    warDuration: 0,
                                    enemyLosses: 0,
                                    lootReserve: initialLootReserve, // 初始化掠夺储备
                                    lastMilitaryActionDay: undefined, // 重置军事行动冷却
                                };
                            }
                            return n;
                        });
                    }

                    return updated;
                });

                addLog(`你向 ${targetNation.name} 宣战了！`);

                // 通知盟友参战
                if (targetAllies.length > 0) {
                    const allyNames = targetAllies.map(a => a.name).join('、');
                    addLog(`⚔️ ${targetNation.name} 的盟友 ${allyNames} 履行同盟义务，加入了战争！`);
                }

                // 通知共同盟友保持中立
                if (neutralAllies.length > 0) {
                    neutralAllies.forEach(ally => {
                        addLog(`⚖️ ${ally.name} 同时是你和 ${targetNation.name} 的盟友，选择保持中立。`);
                    });
                }
                break;
            }

            case 'peace': {
                if (!targetNation.isAtWar) {
                    addLog('当前并未与该国交战。');
                    return;
                }
                const warScore = targetNation.warScore || 0;
                const warDuration = targetNation.warDuration || 0;
                const enemyLosses = targetNation.enemyLosses || 0;

                // 触发玩家和平提议事件
                const peaceEvent = createPlayerPeaceProposalEvent(
                    targetNation,
                    warScore,
                    warDuration,
                    enemyLosses,
                    {
                        population,
                        wealth: resources?.silver || 0,
                    },
                    (proposalType, amount) => {
                        handlePlayerPeaceProposal(nationId, proposalType, amount);
                    }
                );
                triggerDiplomaticEvent(peaceEvent);
                break;
            }

            case 'propose_alliance': {
                // 玩家请求与目标国结盟
                if (targetNation.isAtWar) {
                    addLog(`无法请求结盟：${targetNation.name} 正与你交战。`);
                    return;
                }
                if (targetNation.alliedWithPlayer === true) {
                    addLog(`${targetNation.name} 已经是你的盟友了。`);
                    return;
                }
                const targetRelation = targetNation.relation || 0;
                if (targetRelation < 60) {
                    addLog(`关系不足：需要与 ${targetNation.name} 的关系至少达到60才能请求结盟（当前：${Math.round(targetRelation)}）。`);
                    return;
                }

                // 计算接受概率：基于关系（60关系=30%，100关系=90%）
                const acceptChance = 0.3 + (targetRelation - 60) * 0.015;
                const aggression = targetNation.aggression ?? 0.3;
                // 高侵略性国家不太愿意结盟
                const finalChance = acceptChance * (1 - aggression * 0.5);

                const accepted = Math.random() < finalChance;

                if (accepted) {
                    // 结盟成功
                    setNations(prev => prev.map(n =>
                        n.id === nationId
                            ? {
                                ...n,
                                alliedWithPlayer: true,
                                relation: Math.min(100, (n.relation || 0) + 15),
                                lastDiplomaticActionDay: {
                                    ...(n.lastDiplomaticActionDay || {}),
                                    propose_alliance: daysElapsed,
                                },
                            }
                            : n
                    ));
                    const resultEvent = createAllianceProposalResultEvent(targetNation, true, () => { });
                    triggerDiplomaticEvent(resultEvent);
                    addLog(`🤝 ${targetNation.name} 接受了你的结盟请求！你们正式成为盟友！`);
                } else {
                    // 结盟被拒绝
                    setNations(prev => prev.map(n =>
                        n.id === nationId
                            ? {
                                ...n,
                                relation: Math.max(0, (n.relation || 0) - 5),
                                lastDiplomaticActionDay: {
                                    ...(n.lastDiplomaticActionDay || {}),
                                    propose_alliance: daysElapsed,
                                },
                            }
                            : n
                    ));
                    const resultEvent = createAllianceProposalResultEvent(targetNation, false, () => { });
                    triggerDiplomaticEvent(resultEvent);
                    addLog(`${targetNation.name} 拒绝了你的结盟请求。`);
                }
                break;
            }

            case 'break_alliance': {
                // 玩家主动解除与目标国的联盟
                if (targetNation.alliedWithPlayer !== true) {
                    addLog(`${targetNation.name} 并非你的盟友。`);
                    return;
                }

                setNations(prev => prev.map(n =>
                    n.id === nationId
                        ? { ...n, alliedWithPlayer: false, relation: Math.max(0, (n.relation || 0) - 25) }
                        : n
                ));

                const breakEvent = createAllianceBreakEvent(targetNation, 'player_break', () => { });
                triggerDiplomaticEvent(breakEvent);
                addLog(`你主动解除了与 ${targetNation.name} 的同盟关系。两国关系有所下降。`);
                break;
            }

            default:
                break;
        }
    };

    // ========== 和平协议处理 ==========

    /**
     * 处理敌方和平请求被接受
     * @param {string} nationId - 国家ID
     * @param {string} proposalType - 提议类型
     * @param {number} amount - 金额或人口数量
     */
    const handleEnemyPeaceAccept = (nationId, proposalType, amount) => {
        const clampRelation = (value) => Math.max(0, Math.min(100, value));
        const targetNation = nations.find(n => n.id === nationId);
        if (!targetNation) return;

        // 特殊处理：如果是叛乱政府，使用叛乱结束处理
        if (targetNation.isRebelNation) {
            // 敌方请求和平意味着玩家胜利
            handleRebellionWarEnd(nationId, true);
            return;
        }

        const peaceTreatyUntil = daysElapsed + 730; // 和平协议持续两年

        if (proposalType === 'annex') {
            // 敌国无条件投降，直接吞并（战争吞并）
            if (targetNation.isRebelNation) {
                // 叛乱政府仍按叛乱战争结束流程处理
                handleRebellionWarEnd(nationId, true);
                return;
            }
            const currentPop = targetNation.population || amount || 0;
            const populationGained = Math.max(0, currentPop);
            const maxPopGained = populationGained;

            if (populationGained > 0) {
                setPopulation(prev => prev + populationGained);
                setMaxPopBonus(prev => prev + maxPopGained);
            }

            setNations(prev => prev.filter(n => n.id !== nationId));

            const annexEvent = createNationAnnexedEvent(
                targetNation,
                populationGained,
                maxPopGained,
                'war_annex',
                () => { }
            );
            triggerDiplomaticEvent(annexEvent);
            addLog(`你选择吞并 ${targetNation.name}，其人民与领土并入你的国家。`);
        } else if (proposalType === 'installment') {
            // 分期支付赔款
            setNations(prev => prev.map(n =>
                n.id === nationId
                    ? {
                        ...n,
                        isAtWar: false,
                        alliedWithPlayer: false, // 战争结束时清除同盟状态
                        warScore: 0,
                        warDuration: 0,
                        enemyLosses: 0,
                        isPeaceRequesting: false,
                        relation: Math.max(35, n.relation || 0),
                        peaceTreatyUntil,
                        lootReserve: undefined, // 重置掠夺储备
                        lastMilitaryActionDay: undefined, // 重置军事行动冷却
                        installmentPayment: {
                            amount: amount, // 每天支付的金额
                            remainingDays: 365,
                            totalAmount: amount * 365,
                            paidAmount: 0,
                        },
                    }
                    : n
            ));
            addLog(`你接受了和平协议，${targetNation.name}将每天支付 ${amount} 银币，持续一年（共${amount * 365}银币）。`);
        } else if (proposalType === 'population') {
            // 敌国割让人口上限与人口
            setMaxPopBonus(prev => prev + amount);
            setPopulation(prev => prev + amount);

            const remainingPopulation = Math.max(0, (targetNation.population || 0) - amount);

            if (!targetNation.isRebelNation && remainingPopulation <= 0) {
                // 人口归零：该国家灭亡并触发人口归零吞并事件
                setNations(prev => prev.filter(n => n.id !== nationId));

                const annexEvent = createNationAnnexedEvent(
                    targetNation,
                    0,
                    0,
                    'population_zero',
                    () => { }
                );
                triggerDiplomaticEvent(annexEvent);
                addLog(`由于连续割地，${targetNation.name}的人口被耗尽，国家灭亡，其领土被你吞并。`);
            } else {
                setNations(prev => prev.map(n =>
                    n.id === nationId
                        ? {
                            ...n,
                            isAtWar: false,
                            alliedWithPlayer: false, // 战争结束时清除同盟状态
                            warScore: 0,
                            warDuration: 0,
                            enemyLosses: 0,
                            isPeaceRequesting: false,
                            population: remainingPopulation,
                            relation: Math.max(35, n.relation || 0),
                            peaceTreatyUntil,
                            lootReserve: undefined, // 重置掠夺储备
                            lastMilitaryActionDay: undefined, // 重置军事行动冷却
                        }
                        : n
                ));
                addLog(`你接受了和平协议，${targetNation.name}提供了 ${amount} 人口。`);
            }
        } else if (proposalType === 'open_market') {
            // 开放市场 - 战败国在N天内不限制贸易路线数量
            const openMarketUntil = daysElapsed + amount; // amount为天数
            const yearsCount = Math.round(amount / 365);
            setNations(prev => prev.map(n =>
                n.id === nationId
                    ? {
                        ...n,
                        isAtWar: false,
                        alliedWithPlayer: false, // 战争结束时清除同盟状态
                        warScore: 0,
                        warDuration: 0,
                        enemyLosses: 0,
                        isPeaceRequesting: false,
                        relation: Math.max(35, n.relation || 0),
                        peaceTreatyUntil,
                        openMarketUntil, // 开放市场截止日期
                    }
                    : n
            ));
            addLog(`你接受了和平协议，${targetNation.name}将在${yearsCount}年内开放市场，不限制我方贸易路线数量。`);
        } else {
            // 标准赔款或更多赔款
            setResources(prev => ({ ...prev, silver: (prev.silver || 0) + amount }));
            setNations(prev => prev.map(n =>
                n.id === nationId
                    ? {
                        ...n,
                        isAtWar: false,
                        alliedWithPlayer: false, // 战争结束时清除同盟状态
                        warScore: 0,
                        warDuration: 0,
                        enemyLosses: 0,
                        isPeaceRequesting: false,
                        wealth: Math.max(0, (n.wealth || 0) - amount),
                        relation: Math.max(35, n.relation || 0),
                        peaceTreatyUntil,
                    }
                    : n
            ));
            addLog(`你接受了和平协议，${targetNation.name}支付了 ${amount} 银币。`);
        }
    };

    /**
     * 处理敌方和平请求被拒绝
     * @param {string} nationId - 国家ID
     */
    const handleEnemyPeaceReject = (nationId) => {
        setNations(prev => prev.map(n =>
            n.id === nationId
                ? {
                    ...n,
                    isPeaceRequesting: false,
                }
                : n
        ));
        addLog(`你拒绝了${nations.find(n => n.id === nationId)?.name || '敌国'}的和平请求，战争继续。`);
    };

    /**
     * 处理玩家和平提议
     * @param {string} nationId - 国家ID
     * @param {string} proposalType - 提议类型
     * @param {number} amount - 金额
     */
    const handlePlayerPeaceProposal = (nationId, proposalType, amount) => {
        if (proposalType === 'cancel') {
            addLog('你取消了和平谈判。');
            return;
        }

        const targetNation = nations.find(n => n.id === nationId);
        if (!targetNation) return;
        const isRebelNation = targetNation.isRebelNation === true;
        const rebellionLogSuffix = isRebelNation ? ' 叛乱已经结束。' : '';

        const clampRelation = (value) => Math.max(0, Math.min(100, value));
        const warScore = targetNation.warScore || 0;
        const warDuration = targetNation.warDuration || 0;
        const enemyLosses = targetNation.enemyLosses || 0;
        const peaceTreatyUntil = daysElapsed + 730; // 和平协议持续两年

        // 根据提议类型处理
        if (proposalType === 'demand_annex') {
            // 玩家在和平协议中直接吞并敌国（战争分数>350才会出现该选项）
            if (isRebelNation) {
                // 叛乱政府仍按叛乱结束流程
                handleRebellionWarEnd(nationId, true);
                return;
            }

            const currentPop = targetNation.population || amount || 0;
            const populationGained = Math.max(0, currentPop);
            const maxPopGained = populationGained;

            if (populationGained > 0) {
                setPopulation(prev => prev + populationGained);
                setMaxPopBonus(prev => prev + maxPopGained);
            }

            setNations(prev => prev.filter(n => n.id !== nationId));

            const annexEvent = createNationAnnexedEvent(
                targetNation,
                populationGained,
                maxPopGained,
                'war_annex',
                () => { }
            );
            triggerDiplomaticEvent(annexEvent);
            addLog(`你在和平协议中吞并了 ${targetNation.name}，其所有人口和人口上限并入你的国家。${rebellionLogSuffix}`);
        } else if (proposalType === 'demand_high') {
            // 要求高额赔款，成功率较低
            const willingness = (warScore / 100) + Math.min(0.4, enemyLosses / 250) + Math.min(0.2, warDuration / 250);
            if (willingness > 0.7 || (targetNation.wealth || 0) <= 0) {
                setResources(prev => ({ ...prev, silver: (prev.silver || 0) + amount }));
                if (isRebelNation) {
                    handleRebellionWarEnd(nationId, true);
                } else {
                    setNations(prev => prev.map(n =>
                        n.id === nationId
                            ? {
                                ...n,
                                wealth: Math.max(0, (n.wealth || 0) - amount),
                                isAtWar: false,
                                alliedWithPlayer: false, // 战争结束时清除同盟状态
                                warScore: 0,
                                warDuration: 0,
                                enemyLosses: 0,
                                relation: clampRelation((n.relation || 0) + 5),
                                peaceTreatyUntil,
                                lootReserve: undefined, // 重置掠夺储备
                                lastMilitaryActionDay: undefined, // 重置军事行动冷却
                            }
                            : n
                    ));
                }
                addLog(`${targetNation.name} 接受了你的高额赔款要求，支付 ${amount} 银币换取和平。${rebellionLogSuffix}`);
            } else {
                addLog(`${targetNation.name} 拒绝了你的高额赔款要求。`);
            }
        } else if (proposalType === 'demand_installment') {
            // 要求分期支付赔款
            const willingness = (warScore / 90) + Math.min(0.45, enemyLosses / 220) + Math.min(0.25, warDuration / 220);
            if (willingness > 0.65) {
                if (isRebelNation) {
                    handleRebellionWarEnd(nationId, true);
                } else {
                    setNations(prev => prev.map(n =>
                        n.id === nationId
                            ? {
                                ...n,
                                isAtWar: false,
                                alliedWithPlayer: false, // 战争结束时清除同盟状态
                                warScore: 0,
                                warDuration: 0,
                                enemyLosses: 0,
                                relation: clampRelation((n.relation || 0) + 8),
                                peaceTreatyUntil,
                                lootReserve: undefined, // 重置掠夺储备
                                lastMilitaryActionDay: undefined, // 重置军事行动冷却
                                installmentPayment: {
                                    amount: amount, // 每天支付的金额
                                    remainingDays: 365,
                                    totalAmount: amount * 365,
                                    paidAmount: 0,
                                },
                            }
                            : n
                    ));
                }
                addLog(`${targetNation.name} 接受了分期支付协议，将每天支付 ${amount} 银币，持续一年（共${amount * 365}银币）。${rebellionLogSuffix}`);
            } else {
                addLog(`${targetNation.name} 拒绝了分期支付要求。`);
            }
        } else if (proposalType === 'demand_population') {
            // 要求提供人口
            const willingness = (warScore / 95) + Math.min(0.42, enemyLosses / 230) + Math.min(0.23, warDuration / 230);
            if (willingness > 0.68) {
                setMaxPopBonus(prev => prev + amount);
                setPopulation(prev => prev + amount);

                if (isRebelNation) {
                    handleRebellionWarEnd(nationId, true);
                } else {
                    const remainingPopulation = Math.max(0, (targetNation.population || 0) - amount);

                    if (remainingPopulation <= 0) {
                        // 敌国人口因割地归零：灭亡并触发吞并事件
                        setNations(prev => prev.filter(n => n.id !== nationId));

                        const annexEvent = createNationAnnexedEvent(
                            targetNation,
                            0,
                            0,
                            'population_zero',
                            () => { }
                        );
                        triggerDiplomaticEvent(annexEvent);
                        addLog(`由于割让过多人口，${targetNation.name}的人口被耗尽，国家灭亡，其领土被你吞并。${rebellionLogSuffix}`);
                    } else {
                        setNations(prev => prev.map(n =>
                            n.id === nationId
                                ? {
                                    ...n,
                                    isAtWar: false,
                                    alliedWithPlayer: false, // 战争结束时清除同盟状态
                                    warScore: 0,
                                    warDuration: 0,
                                    enemyLosses: 0,
                                    population: remainingPopulation,
                                    relation: clampRelation((n.relation || 0) + 7),
                                    peaceTreatyUntil,
                                    lootReserve: undefined, // 重置掠夺储备
                                    lastMilitaryActionDay: undefined, // 重置军事行动冷却
                                }
                                : n
                        ));
                        addLog(`${targetNation.name} 接受了和平协议，提供了 ${amount} 人口。${rebellionLogSuffix}`);
                    }
                }
            } else {
                addLog(`${targetNation.name} 拒绝了提供人口的要求。`);
            }
        } else if (proposalType === 'demand_standard' || proposalType === 'demand_tribute') {
            // 要求标准赔款
            const willingness = (warScore / 80) + Math.min(0.5, enemyLosses / 200) + Math.min(0.3, warDuration / 200);
            if (willingness > 0.6 || (targetNation.wealth || 0) <= 0) {
                setResources(prev => ({ ...prev, silver: (prev.silver || 0) + amount }));
                if (isRebelNation) {
                    handleRebellionWarEnd(nationId, true);
                } else {
                    setNations(prev => prev.map(n =>
                        n.id === nationId
                            ? {
                                ...n,
                                wealth: Math.max(0, (n.wealth || 0) - amount),
                                isAtWar: false,
                                alliedWithPlayer: false, // 战争结束时清除同盟状态
                                warScore: 0,
                                warDuration: 0,
                                enemyLosses: 0,
                                relation: clampRelation((n.relation || 0) + 10),
                                peaceTreatyUntil,
                                lootReserve: undefined, // 重置掠夺储备
                                lastMilitaryActionDay: undefined, // 重置军事行动冷却
                            }
                            : n
                    ));
                }
                addLog(`${targetNation.name} 接受了和平协议，支付 ${amount} 银币。${rebellionLogSuffix}`);
            } else {
                addLog(`${targetNation.name} 拒绝了你的赔款要求。`);
            }
        } else if (proposalType === 'peace_only') {
            // 无条件和平，成功率较高
            const willingness = Math.max(0.3, (warScore / 60) + Math.min(0.4, enemyLosses / 150));
            if (willingness > 0.5) {
                if (isRebelNation) {
                    handleRebellionWarEnd(nationId, true);
                } else {
                    setNations(prev => prev.map(n =>
                        n.id === nationId
                            ? {
                                ...n,
                                isAtWar: false,
                                alliedWithPlayer: false, // 战争结束时清除同盟状态
                                warScore: 0,
                                warDuration: 0,
                                enemyLosses: 0,
                                relation: clampRelation((n.relation || 0) + 15),
                                peaceTreatyUntil,
                                lootReserve: undefined, // 重置掠夺储备
                                lastMilitaryActionDay: undefined, // 重置军事行动冷却
                            }
                            : n
                    ));
                }
                addLog(`${targetNation.name} 接受了和平协议，战争结束。${rebellionLogSuffix}`);
            } else {
                addLog(`${targetNation.name} 拒绝了和平提议。`);
            }
        } else if (proposalType === 'demand_open_market') {
            // 要求开放市场 - 战败国在N天内不限制贸易路线数量
            const willingness = (warScore / 85) + Math.min(0.45, enemyLosses / 210) + Math.min(0.25, warDuration / 210);
            if (willingness > 0.6) {
                const openMarketUntil = daysElapsed + amount; // amount为天数
                const yearsCount = Math.round(amount / 365);
                if (isRebelNation) {
                    handleRebellionWarEnd(nationId, true);
                } else {
                    setNations(prev => prev.map(n =>
                        n.id === nationId
                            ? {
                                ...n,
                                isAtWar: false,
                                alliedWithPlayer: false, // 战争结束时清除同盟状态
                                warScore: 0,
                                warDuration: 0,
                                enemyLosses: 0,
                                relation: clampRelation((n.relation || 0) + 10),
                                peaceTreatyUntil,
                                openMarketUntil, // 开放市场截止日期
                                lootReserve: undefined, // 重置掠夺储备
                                lastMilitaryActionDay: undefined, // 重置军事行动冷却
                            }
                            : n
                    ));
                }
                addLog(`${targetNation.name} 接受了和平协议，将在${yearsCount}年内开放市场，不限制我方贸易路线数量。${rebellionLogSuffix}`);
            } else {
                addLog(`${targetNation.name} 拒绝了开放市场的要求。`);
            }
        } else if (proposalType === 'pay_installment' || proposalType === 'pay_installment_moderate') {
            // 玩家分期支付赔款
            if (isRebelNation) {
                handleRebellionWarEnd(nationId, false);
            } else {
                setNations(prev => prev.map(n =>
                    n.id === nationId
                        ? {
                            ...n,
                            isAtWar: false,
                            alliedWithPlayer: false, // 战争结束时清除同盟状态
                            warScore: 0,
                            warDuration: 0,
                            enemyLosses: 0,
                            relation: clampRelation(28),
                            peaceTreatyUntil,
                            lootReserve: undefined, // 重置掠夺储备
                            lastMilitaryActionDay: undefined, // 重置军事行动冷却
                        }
                        : n
                ));
            }
            // 设置玩家的分期支付
            gameState.setPlayerInstallmentPayment({
                nationId,
                amount: amount,
                remainingDays: 365,
                totalAmount: amount * 365,
                paidAmount: 0,
            });
            addLog(`你与 ${targetNation.name} 达成和平，将每天支付 ${amount} 银币，持续一年（共${amount * 365}银币）。${rebellionLogSuffix}`);
        } else if (proposalType === 'offer_population') {
            // 玩家提供人口
            if (population < amount) {
                addLog('人口不足，无法提供。');
                return;
            }
            setMaxPopBonus(prev => Math.max(-population + 1, prev - amount));
            setPopulation(prev => Math.max(1, prev - amount));
            if (isRebelNation) {
                handleRebellionWarEnd(nationId, false);
            } else {
                setNations(prev => prev.map(n =>
                    n.id === nationId
                        ? {
                            ...n,
                            isAtWar: false,
                            alliedWithPlayer: false, // 战争结束时清除同盟状态
                            warScore: 0,
                            warDuration: 0,
                            enemyLosses: 0,
                            population: (n.population || 1000) + amount,
                            relation: clampRelation(27),
                            peaceTreatyUntil,
                            lootReserve: undefined, // 重置掠夺储备
                            lastMilitaryActionDay: undefined, // 重置军事行动冷却
                        }
                        : n
                ));
            }
            addLog(`你提供 ${amount} 人口，与 ${targetNation.name} 达成和平。${rebellionLogSuffix}`);
        } else if (proposalType === 'pay_standard' || proposalType === 'pay_high' || proposalType === 'pay_moderate') {
            // 玩家支付赔款求和
            if ((resources.silver || 0) < amount) {
                addLog('银币不足，无法支付赔款。');
                return;
            }
            setResources(prev => ({ ...prev, silver: (prev.silver || 0) - amount }));
            if (isRebelNation) {
                handleRebellionWarEnd(nationId, false);
            } else {
                setNations(prev => prev.map(n =>
                    n.id === nationId
                        ? {
                            ...n,
                            isAtWar: false,
                            alliedWithPlayer: false, // 战争结束时清除同盟状态
                            warScore: 0,
                            warDuration: 0,
                            enemyLosses: 0,
                            wealth: (n.wealth || 0) + amount,
                            relation: clampRelation(proposalType === 'pay_high' ? 25 : 30),
                            peaceTreatyUntil,
                            lootReserve: undefined, // 重置掠夺储备
                            lastMilitaryActionDay: undefined, // 重置军事行动冷却
                        }
                        : n
                ));
            }
            addLog(`你支付 ${amount} 银币，与 ${targetNation.name} 达成和平。${rebellionLogSuffix}`);
        }
    };

    // ========== 贸易路线系统 ==========

    /**
     * 处理贸易路线操作
     * @param {string} nationId - 目标国家ID
     * @param {string} action - 操作类型：'create' 或 'cancel'
     * @param {Object} payload - 操作参数 { resource, type: 'import'|'export' }
     */
    const handleTradeRouteAction = (nationId, action, payload = {}) => {
        const targetNation = nations.find(n => n.id === nationId);
        if (!targetNation) return;

        const { resource: resourceKey, type } = payload;
        if (!resourceKey || !type) return;

        // 检查资源是否有效
        if (!RESOURCES[resourceKey] || RESOURCES[resourceKey].type === 'virtual' || resourceKey === 'silver') {
            addLog('该资源无法创建贸易路线。');
            return;
        }

        // 检查资源是否已解锁
        const resourceDef = RESOURCES[resourceKey];
        if ((resourceDef.unlockEpoch ?? 0) > epoch) {
            addLog(`${resourceDef.name} 尚未解锁，无法创建贸易路线。`);
            return;
        }

        if (action === 'create') {
            // 检查贸易路线数量是否超过商人岗位上限（只有当有商人岗位时才检查）
            const merchantJobLimit = jobsAvailable?.merchant || 0;
            const currentRouteCount = tradeRoutes.routes.length;
            if (merchantJobLimit > 0 && currentRouteCount >= merchantJobLimit) {
                addLog(`贸易路线数量已达上限（${merchantJobLimit}），需要更多商人岗位。请建造更多贸易站。`);
                return;
            }

            // 检查是否处于战争
            if (targetNation.isAtWar) {
                addLog(`与 ${targetNation.name} 处于战争状态，无法创建贸易路线。`);
                return;
            }

            // Check if open market is active (defeated nation allows unlimited trade)
            const isOpenMarketActive = targetNation.openMarketUntil && daysElapsed < targetNation.openMarketUntil;

            // Check relation-based trade route limit (skip if open market is active)
            if (!isOpenMarketActive) {
                const nationRelation = targetNation.relation || 0;
                const getMaxTradeRoutesForRelation = (relation) => {
                    if (relation >= 80) return 4; // Allied
                    if (relation >= 60) return 3; // Friendly
                    if (relation >= 40) return 2; // Neutral
                    if (relation >= 20) return 1; // Cold
                    return 0; // Hostile - no trade
                };
                const maxRoutesWithNation = getMaxTradeRoutesForRelation(nationRelation);
                const currentRoutesWithNation = tradeRoutes.routes.filter(r => r.nationId === nationId).length;

                if (maxRoutesWithNation === 0) {
                    addLog(`与 ${targetNation.name} 关系敌对（${nationRelation}），无法建立贸易路线。请先改善关系至少达到20。`);
                    return;
                }

                if (currentRoutesWithNation >= maxRoutesWithNation) {
                    const relationLabels = { 0: '敌对', 1: '冷淡', 2: '中立', 3: '友好', 4: '盟友' };
                    addLog(`与 ${targetNation.name} 的贸易路线已达关系上限（${currentRoutesWithNation}/${maxRoutesWithNation}条，关系${relationLabels[maxRoutesWithNation]}）。提升关系可增加贸易路线数量。`);
                    return;
                }
            }

            // 检查是否已存在相同的贸易路线
            const exists = tradeRoutes.routes.some(
                route => route.nationId === nationId && route.resource === resourceKey && route.type === type
            );
            if (exists) {
                addLog(`已存在该贸易路线。`);
                return;
            }

            // 检查贸易条件
            const tradeStatus = calculateTradeStatus(resourceKey, targetNation, daysElapsed);
            if (type === 'export') {
                // 出口：对方需要有缺口
                if (!tradeStatus.isShortage || tradeStatus.shortageAmount <= 0) {
                    addLog(`${targetNation.name} 对 ${resourceDef.name} 没有缺口，无法创建出口路线。`);
                    return;
                }
            } else if (type === 'import') {
                // 进口：对方需要有盈余
                if (!tradeStatus.isSurplus || tradeStatus.surplusAmount <= 0) {
                    addLog(`${targetNation.name} 对 ${resourceDef.name} 没有盈余，无法创建进口路线。`);
                    return;
                }
            }

            // 创建贸易路线
            setTradeRoutes(prev => ({
                ...prev,
                routes: [
                    ...prev.routes,
                    {
                        nationId,
                        resource: resourceKey,
                        type,
                        createdAt: daysElapsed,
                    }
                ]
            }));

            const typeText = type === 'export' ? '出口' : '进口';
            addLog(`✅ 已创建 ${resourceDef.name} 的${typeText}贸易路线至 ${targetNation.name}。`);

        } else if (action === 'cancel') {
            // 取消贸易路线
            const routeExists = tradeRoutes.routes.some(
                route => route.nationId === nationId && route.resource === resourceKey && route.type === type
            );
            if (!routeExists) {
                addLog(`该贸易路线不存在。`);
                return;
            }

            setTradeRoutes(prev => ({
                ...prev,
                routes: prev.routes.filter(
                    route => !(route.nationId === nationId && route.resource === resourceKey && route.type === type)
                )
            }));

            const typeText = type === 'export' ? '出口' : '进口';
            addLog(`❌ 已取消 ${resourceDef.name} 的${typeText}贸易路线至 ${targetNation.name}。`);
        }
    };

    // ========== 事件系统 ==========

    /**
     * 触发随机事件
     */
    const triggerRandomEvent = () => {
        // 如果已经有事件在显示，不再触发新事件
        if (currentEvent) return;

        const event = getRandomEvent(gameState);
        if (event) {
            setCurrentEvent(event);
            addLog(`⚠️ 事件：${event.name}`);
            generateSound(SOUND_TYPES.EVENT);
            // 事件触发时保存当前暂停状态，然后暂停游戏
            gameState.setPausedBeforeEvent(gameState.isPaused);
            gameState.setIsPaused(true);
        }
    };

    const launchDiplomaticEvent = (diplomaticEvent) => {
        if (!diplomaticEvent) return;
        setCurrentEvent(diplomaticEvent);
        addLog(`⚠️ 外交事件：${diplomaticEvent.name}`);
        generateSound(SOUND_TYPES.EVENT);
        gameState.setPausedBeforeEvent(gameState.isPaused);
        gameState.setIsPaused(true);
    };

    /**
     * 触发外交事件
     * @param {Object} diplomaticEvent - 外交事件对象
     */
    const triggerDiplomaticEvent = (diplomaticEvent) => {
        if (!diplomaticEvent) return;
        console.log('[DIPLOMATIC EVENT] Triggering:', diplomaticEvent.name, 'Current event exists?', !!currentEvent);
        if (currentEvent) {
            console.log('[DIPLOMATIC EVENT] Queuing event because currentEvent exists');
            setPendingDiplomaticEvents(prev => {
                console.log('[DIPLOMATIC EVENT] Adding to queue, current queue size:', prev?.length || 0);
                return [...prev, diplomaticEvent];
            });
            return;
        }
        console.log('[DIPLOMATIC EVENT] Launching directly');
        launchDiplomaticEvent(diplomaticEvent);
    };

    useEffect(() => {
        console.log('[PENDING EVENTS] useEffect triggered. currentEvent?', !!currentEvent, 'pendingDiplomaticEvents:', pendingDiplomaticEvents?.length || 0);
        if (currentEvent) return;
        if (!pendingDiplomaticEvents || pendingDiplomaticEvents.length === 0) return;

        console.log('[PENDING EVENTS] Processing queue, first event:', pendingDiplomaticEvents[0]?.name);
        // 使用 setTimeout 确保在当前渲染周期完成后再显示下一个事件
        const timer = setTimeout(() => {
            setPendingDiplomaticEvents(prev => {
                if (!prev || prev.length === 0) return prev;
                const [next, ...rest] = prev;
                console.log('[PENDING EVENTS] Launching next event:', next?.name, 'Remaining:', rest.length);
                // 延迟触发事件以确保状态更新完成
                setTimeout(() => launchDiplomaticEvent(next), 0);
                return rest;
            });
        }, 100);

        return () => clearTimeout(timer);
    }, [currentEvent, pendingDiplomaticEvents]);

    /**
     * 处理事件选项
     * @param {string} eventId - 事件ID
     * @param {Object} option - 选择的选项
     */
    const handleEventOption = (eventId, option) => {
        // 尝试从EVENTS中查找，如果找不到则使用currentEvent（用于外交事件）
        let event = EVENTS.find(e => e.id === eventId);
        if (!event && currentEvent && currentEvent.id === eventId) {
            event = currentEvent;
        }
        if (!event) return;

        const approvalSettings = eventEffectSettings?.approval || {};
        const stabilitySettings = eventEffectSettings?.stability || {};
        const clampDecay = (value, fallback) => {
            if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
            return Math.min(0.95, Math.max(0, value));
        };
        const cloneEffectState = (prev = {}) => ({
            approval: Array.isArray(prev.approval) ? [...prev.approval] : [],
            stability: Array.isArray(prev.stability) ? [...prev.stability] : [],
            resourceDemand: Array.isArray(prev.resourceDemand) ? [...prev.resourceDemand] : [],
            stratumDemand: Array.isArray(prev.stratumDemand) ? [...prev.stratumDemand] : [],
            buildingProduction: Array.isArray(prev.buildingProduction) ? [...prev.buildingProduction] : [],
            forcedSubsidy: Array.isArray(prev.forcedSubsidy) ? [...prev.forcedSubsidy] : [],
        });

        const registerApprovalEffect = (changes = {}) => {
            if (!changes || typeof setActiveEventEffects !== 'function') return;
            const entries = Object.entries(changes).filter(([, value]) => typeof value === 'number' && value !== 0);
            if (!entries.length) return;
            const duration = Math.max(1, approvalSettings.duration || 30);
            const decayRate = clampDecay(approvalSettings.decayRate ?? 0.04, 0.04);
            const timestamp = Date.now();
            setActiveEventEffects(prev => {
                const next = cloneEffectState(prev);
                entries.forEach(([stratum, value]) => {
                    next.approval.push({
                        id: `approval_${timestamp}_${stratum}_${Math.random()}`,
                        stratum,
                        currentValue: value,
                        remainingDays: duration,
                        decayRate,
                    });
                });
                return next;
            });
        };

        const registerStabilityEffect = (value) => {
            if (typeof value !== 'number' || value === 0 || typeof setActiveEventEffects !== 'function') return;
            const duration = Math.max(1, stabilitySettings.duration || 30);
            const decayRate = clampDecay(stabilitySettings.decayRate ?? 0.04, 0.04);
            const timestamp = Date.now();
            setActiveEventEffects(prev => {
                const next = cloneEffectState(prev);
                next.stability.push({
                    id: `stability_${timestamp}_${Math.random()}`,
                    currentValue: value,
                    remainingDays: duration,
                    decayRate,
                });
                return next;
            });
        };

        // Economic effect settings
        const resourceDemandSettings = eventEffectSettings?.resourceDemand || { duration: 60, decayRate: 0.02 };
        const stratumDemandSettings = eventEffectSettings?.stratumDemand || { duration: 60, decayRate: 0.02 };
        const buildingProductionSettings = eventEffectSettings?.buildingProduction || { duration: 45, decayRate: 0.025 };

        // Register resource demand modifier effect
        // resourceDemandMod: { resourceKey: percentModifier } e.g., { cloth: 0.2 } = +20% cloth demand
        const registerResourceDemandEffect = (mods = {}) => {
            if (!mods || typeof setActiveEventEffects !== 'function') return;
            const entries = Object.entries(mods).filter(([, value]) => typeof value === 'number' && value !== 0);
            if (!entries.length) return;
            const duration = Math.max(1, resourceDemandSettings.duration || 60);
            const decayRate = clampDecay(resourceDemandSettings.decayRate ?? 0.02, 0.02);
            const timestamp = Date.now();
            setActiveEventEffects(prev => ({
                ...prev,
                resourceDemand: [
                    ...(prev?.resourceDemand || []),
                    ...entries.map(([target, value]) => ({
                        id: `resourceDemand_${timestamp}_${target}_${Math.random()}`,
                        target,
                        currentValue: value,
                        remainingDays: duration,
                        decayRate,
                    })),
                ],
            }));
        };

        // Register stratum demand modifier effect
        // stratumDemandMod: { stratumKey: percentModifier } e.g., { noble: 0.15 } = +15% noble consumption
        const registerStratumDemandEffect = (mods = {}) => {
            if (!mods || typeof setActiveEventEffects !== 'function') return;
            const entries = Object.entries(mods).filter(([, value]) => typeof value === 'number' && value !== 0);
            if (!entries.length) return;
            const duration = Math.max(1, stratumDemandSettings.duration || 60);
            const decayRate = clampDecay(stratumDemandSettings.decayRate ?? 0.02, 0.02);
            const timestamp = Date.now();
            setActiveEventEffects(prev => ({
                ...prev,
                stratumDemand: [
                    ...(prev?.stratumDemand || []),
                    ...entries.map(([target, value]) => ({
                        id: `stratumDemand_${timestamp}_${target}_${Math.random()}`,
                        target,
                        currentValue: value,
                        remainingDays: duration,
                        decayRate,
                    })),
                ],
            }));
        };

        // Register building production modifier effect
        // buildingProductionMod: { buildingIdOrCat: percentModifier } e.g., { farm: 0.1, gather: -0.05 }
        const registerBuildingProductionEffect = (mods = {}) => {
            if (!mods || typeof setActiveEventEffects !== 'function') return;
            const entries = Object.entries(mods).filter(([, value]) => typeof value === 'number' && value !== 0);
            if (!entries.length) return;
            const duration = Math.max(1, buildingProductionSettings.duration || 45);
            const decayRate = clampDecay(buildingProductionSettings.decayRate ?? 0.025, 0.025);
            const timestamp = Date.now();
            setActiveEventEffects(prev => ({
                ...prev,
                buildingProduction: [
                    ...(prev?.buildingProduction || []),
                    ...entries.map(([target, value]) => ({
                        id: `buildingProduction_${timestamp}_${target}_${Math.random()}`,
                        target,
                        currentValue: value,
                        remainingDays: duration,
                        decayRate,
                    })),
                ],
            }));
        };

        // 通用效果应用函数
        const applyEffects = (effects = {}) => {
            // 资源（固定值）
            if (effects.resources) {
                setResources(prev => {
                    const updated = { ...prev };
                    Object.entries(effects.resources).forEach(([resource, value]) => {
                        updated[resource] = Math.max(0, (updated[resource] || 0) + value);
                    });
                    return updated;
                });
            }

            // 资源（百分比变化）- resourcePercent: { food: -0.05 } 表示减少5%的食物
            if (effects.resourcePercent) {
                setResources(prev => {
                    const updated = { ...prev };
                    Object.entries(effects.resourcePercent).forEach(([resource, percent]) => {
                        const currentValue = updated[resource] || 0;
                        const change = Math.floor(currentValue * percent);
                        updated[resource] = Math.max(0, currentValue + change);
                    });
                    return updated;
                });
            }

            // 人口（固定值）
            if (effects.population) {
                setPopulation(prev => Math.max(1, prev + effects.population));
            }

            // 人口（百分比变化）- populationPercent: -0.1 表示减少10%的人口
            if (effects.populationPercent) {
                setPopulation(prev => {
                    const change = Math.floor(prev * effects.populationPercent);
                    return Math.max(1, prev + change);
                });
            }

            // 稳定度
            if (effects.stability) {
                setStability(prev => Math.max(0, Math.min(100, prev + effects.stability)));
                registerStabilityEffect(effects.stability);
            }

            // 科技
            if (effects.science) {
                setResources(prev => ({
                    ...prev,
                    science: Math.max(0, (prev.science || 0) + effects.science),
                }));
            }

            // 阶层支持度
            if (effects.approval) {
                setClassApproval(prev => {
                    const updated = { ...prev };
                    Object.entries(effects.approval).forEach(([stratum, value]) => {
                        updated[stratum] = Math.max(
                            0,
                            Math.min(100, (updated[stratum] || 50) + value),
                        );
                    });
                    return updated;
                });
                registerApprovalEffect(effects.approval);
            }

            // 阶层财富
            if (effects.classWealth) {
                // 如果 setClassWealth 只有在 useGameLoop 中定义并没有传入 useGameActions，我们需要检查
                // 实际上 useGameActions 接收整个 gameState，其中包含 classWealth 和 setClassWealth (line 76)
                // 但这里需要确认 setClassWealth 是否解构出来了。
                // 检查 line 31-80，发现 classWealth 被解构了，但 setClassWealth 没有被解构。
                // 我们需要使用 gameState.setClassWealth 或者确保它被解构。
                // 假设 gameState 中有 setClassWealth。
                if (typeof gameState.setClassWealth === 'function') {
                    gameState.setClassWealth(prev => {
                        const updated = { ...prev };
                        Object.entries(effects.classWealth).forEach(([stratum, value]) => {
                            updated[stratum] = Math.max(0, (updated[stratum] || 0) + value);
                        });
                        return updated;
                    });
                }
            }

            // Economic effects - timed modifiers that decay over time
            // Resource demand modifier: affects how much of a resource is consumed
            if (effects.resourceDemandMod) {
                registerResourceDemandEffect(effects.resourceDemandMod);
            }

            // Stratum demand modifier: affects how much a specific stratum consumes
            if (effects.stratumDemandMod) {
                registerStratumDemandEffect(effects.stratumDemandMod);
            }

            // Building production modifier: affects building output
            if (effects.buildingProductionMod) {
                registerBuildingProductionEffect(effects.buildingProductionMod);
            }

            // ========== Diplomatic Effects ==========
            // Helper function to resolve nation selector
            const resolveNationSelector = (selector) => {
                // 完整的可见性检查：包括 visible 属性、时代范围（appearEpoch/expireEpoch），并排除叛军
                const visibleNations = nations.filter(n =>
                    n.visible !== false &&
                    epoch >= (n.appearEpoch ?? 0) &&
                    (n.expireEpoch == null || epoch <= n.expireEpoch) &&
                    !n.isRebelNation
                );
                if (!visibleNations.length) return [];

                switch (selector) {
                    case 'random':
                        return [visibleNations[Math.floor(Math.random() * visibleNations.length)]];
                    case 'all':
                        return visibleNations;
                    case 'hostile':
                        return visibleNations.filter(n => (n.relation || 50) < 30);
                    case 'friendly':
                        return visibleNations.filter(n => (n.relation || 50) >= 60);
                    case 'strongest':
                        return [visibleNations.reduce((a, b) => (a.wealth || 0) > (b.wealth || 0) ? a : b)];
                    case 'weakest':
                        return [visibleNations.reduce((a, b) => (a.wealth || 0) < (b.wealth || 0) ? a : b)];
                    default:
                        // Direct nation id
                        const nation = visibleNations.find(n => n.id === selector);
                        return nation ? [nation] : [];
                }
            };

            // Nation relation modifier: { nationId/selector: change }
            if (effects.nationRelation) {
                const excludeList = effects.nationRelation.exclude || [];
                setNations(prev => {
                    const updated = [...prev];
                    Object.entries(effects.nationRelation).forEach(([selector, change]) => {
                        if (selector === 'exclude') return;
                        const targets = resolveNationSelector(selector);
                        targets.forEach(target => {
                            if (excludeList.includes(target.id)) return;
                            const idx = updated.findIndex(n => n.id === target.id);
                            if (idx >= 0) {
                                const oldRelation = updated[idx].relation || 50;
                                updated[idx] = {
                                    ...updated[idx],
                                    relation: Math.max(0, Math.min(100, oldRelation + change)),
                                };
                                addLog(`与 ${updated[idx].name} 的关系${change > 0 ? '改善' : '恶化'}了 ${Math.abs(change)} 点`);
                            }
                        });
                    });
                    return updated;
                });
            }

            // Nation aggression modifier: { nationId/selector: change }
            if (effects.nationAggression) {
                setNations(prev => {
                    const updated = [...prev];
                    Object.entries(effects.nationAggression).forEach(([selector, change]) => {
                        const targets = resolveNationSelector(selector);
                        targets.forEach(target => {
                            const idx = updated.findIndex(n => n.id === target.id);
                            if (idx >= 0) {
                                const oldAggression = updated[idx].aggression || 0.5;
                                updated[idx] = {
                                    ...updated[idx],
                                    aggression: Math.max(0, Math.min(1, oldAggression + change)),
                                };
                            }
                        });
                    });
                    return updated;
                });
            }

            // Nation wealth modifier: { nationId/selector: change }
            if (effects.nationWealth) {
                setNations(prev => {
                    const updated = [...prev];
                    Object.entries(effects.nationWealth).forEach(([selector, change]) => {
                        const targets = resolveNationSelector(selector);
                        targets.forEach(target => {
                            const idx = updated.findIndex(n => n.id === target.id);
                            if (idx >= 0) {
                                const oldWealth = updated[idx].wealth || 1000;
                                updated[idx] = {
                                    ...updated[idx],
                                    wealth: Math.max(0, oldWealth + change),
                                };
                            }
                        });
                    });
                    return updated;
                });
            }

            // Nation market volatility modifier: { nationId/selector: change }
            if (effects.nationMarketVolatility) {
                setNations(prev => {
                    const updated = [...prev];
                    Object.entries(effects.nationMarketVolatility).forEach(([selector, change]) => {
                        const targets = resolveNationSelector(selector);
                        targets.forEach(target => {
                            const idx = updated.findIndex(n => n.id === target.id);
                            if (idx >= 0) {
                                const oldVolatility = updated[idx].marketVolatility || 0.3;
                                updated[idx] = {
                                    ...updated[idx],
                                    marketVolatility: Math.max(0.1, Math.min(0.8, oldVolatility + change)),
                                };
                            }
                        });
                    });
                    return updated;
                });
            }

            // Trigger war with a nation
            if (effects.triggerWar) {
                const targets = resolveNationSelector(effects.triggerWar);
                if (targets.length > 0) {
                    const target = targets[0];
                    // 检查和平协议是否仍然有效
                    if (target.peaceTreatyUntil && daysElapsed < target.peaceTreatyUntil) {
                        const remainingDays = target.peaceTreatyUntil - daysElapsed;
                        addLog(`⚠️ 与 ${target.name} 的和平协议仍在有效期内（剩余 ${remainingDays} 天），战争未能爆发。`);
                    } else if (target.isAtWar) {
                        // 已经在交战中，不重复处理
                        addLog(`⚠️ 与 ${target.name} 已经处于战争状态。`);
                    } else {
                        setNations(prev => prev.map(n =>
                            n.id === target.id
                                ? {
                                    ...n,
                                    relation: 0,
                                    isAtWar: true,
                                    warScore: 0,
                                    warStartDay: daysElapsed,
                                    warDuration: 0,
                                    enemyLosses: 0,
                                    peaceTreatyUntil: undefined,
                                    lootReserve: (n.wealth || 500) * 1.5, // 初始化掠夺储备
                                    lastMilitaryActionDay: undefined, // 重置军事行动冷却
                                }
                                : n
                        ));
                        addLog(`⚔️ ${target.name} 向我方宣战！`);

                        // 触发宣战事件对话框
                        if (triggerDiplomaticEvent) {
                            const warEvent = createWarDeclarationEvent(target, () => {
                                // 宣战事件只需要确认，不需要额外操作
                            });
                            triggerDiplomaticEvent(warEvent);
                        }
                    }
                } else {
                    // 没有找到匹配的国家（例如没有敌对国家时选择'hostile'）
                    const selectorLabels = {
                        random: '随机国家',
                        all: '所有国家',
                        hostile: '敌对国家',
                        friendly: '友好国家',
                        strongest: '最强国家',
                        weakest: '最弱国家',
                    };
                    const label = selectorLabels[effects.triggerWar] || effects.triggerWar;
                    addLog(`⚠️ 无法发动战争：没有可用的${label}。`);
                }
            }

            // Trigger peace with a nation
            if (effects.triggerPeace) {
                const targets = resolveNationSelector(effects.triggerPeace);
                if (targets.length > 0) {
                    const target = targets[0];
                    setNations(prev => prev.map(n =>
                        n.id === target.id && n.isAtWar
                            ? {
                                ...n,
                                isAtWar: false,
                                warScore: 0,
                                warDuration: 0,
                                enemyLosses: 0,
                                peaceTreatyUntil: daysElapsed + 365,
                            }
                            : n
                    ));
                    addLog(`🕊️ 与 ${target.name} 的战争结束，签订和平协议`);
                }
            }

            // ========== 执政联盟修改效果 ==========
            // modifyCoalition: { addToCoalition: 'stratumKey' } 或 { removeFromCoalition: 'stratumKey' }
            if (effects.modifyCoalition) {
                const { addToCoalition, removeFromCoalition } = effects.modifyCoalition;
                if (addToCoalition && typeof gameState.setRulingCoalition === 'function') {
                    gameState.setRulingCoalition(prev => {
                        if (prev.includes(addToCoalition)) return prev;
                        return [...prev, addToCoalition];
                    });
                    addLog(`🤝 ${getStratumName(addToCoalition)} 已加入执政联盟`);
                }
                if (removeFromCoalition && typeof gameState.setRulingCoalition === 'function') {
                    gameState.setRulingCoalition(prev =>
                        prev.filter(k => k !== removeFromCoalition)
                    );
                    addLog(`👋 ${getStratumName(removeFromCoalition)} 已退出执政联盟`);
                }
            }
        };

        // 基础效果（必然发生）
        const baseEffects = option.effects || {};

        // 概率效果：randomEffects: [{ chance, effects }, ...]
        const randomEffects = Array.isArray(option.randomEffects)
            ? option.randomEffects
            : [];

        // 生成效果描述的辅助函数
        const generateEffectDescription = (effects) => {
            if (!effects) return '';

            const descriptions = [];

            // 资源效果
            if (effects.resources) {
                Object.entries(effects.resources).forEach(([resource, value]) => {
                    const resourceName = getResourceName(resource);
                    descriptions.push(`${resourceName}${value > 0 ? '+' : ''}${value}`);
                });
            }

            // 资源百分比效果
            if (effects.resourcePercent) {
                Object.entries(effects.resourcePercent).forEach(([resource, value]) => {
                    const resourceName = getResourceName(resource);
                    const percent = Math.round(value * 100);
                    descriptions.push(`${resourceName}${percent > 0 ? '+' : ''}${percent}%`);
                });
            }

            // 人口效果
            if (effects.population) {
                descriptions.push(`人口${effects.population > 0 ? '+' : ''}${effects.population}`);
            }

            // 人口百分比效果
            if (effects.populationPercent) {
                const percent = Math.round(effects.populationPercent * 100);
                descriptions.push(`人口${percent > 0 ? '+' : ''}${percent}%`);
            }

            // 稳定度效果
            if (effects.stability) {
                descriptions.push(`稳定度${effects.stability > 0 ? '+' : ''}${effects.stability}`);
            }

            // 科技效果
            if (effects.science) {
                descriptions.push(`科技${effects.science > 0 ? '+' : ''}${effects.science}`);
            }

            // 阶层支持度效果
            if (effects.approval) {
                Object.entries(effects.approval).forEach(([stratum, value]) => {
                    const stratumName = getStratumName(stratum);
                    descriptions.push(`${stratumName}支持度${value > 0 ? '+' : ''}${value}`);
                });
            }

            // 外交关系效果
            if (effects.nationRelation) {
                descriptions.push('外交关系变化');
            }

            // 国家侵略性效果
            if (effects.nationAggression) {
                const aggressionValues = Object.values(effects.nationAggression).filter(v => v !== 'exclude');
                if (aggressionValues.length > 0) {
                    const avgChange = aggressionValues.reduce((sum, v) => sum + v, 0) / aggressionValues.length;
                    const percent = Math.round(avgChange * 100);
                    descriptions.push(`国家侵略性${percent > 0 ? '+' : ''}${percent}%`);
                }
            }

            // 国家财富效果
            if (effects.nationWealth) {
                const wealthValues = Object.values(effects.nationWealth).filter(v => v !== 'exclude');
                if (wealthValues.length > 0) {
                    const totalChange = wealthValues.reduce((sum, v) => sum + Math.abs(v), 0);
                    descriptions.push(`国家财富变化${totalChange > 0 ? '±' : ''}${totalChange}`);
                }
            }

            // 国家市场波动性效果
            if (effects.nationMarketVolatility) {
                const volatilityValues = Object.values(effects.nationMarketVolatility).filter(v => v !== 'exclude');
                if (volatilityValues.length > 0) {
                    const avgChange = volatilityValues.reduce((sum, v) => sum + v, 0) / volatilityValues.length;
                    const percent = Math.round(avgChange * 100);
                    descriptions.push(`市场波动性${percent > 0 ? '+' : ''}${percent}%`);
                }
            }

            // 资源需求修正效果
            if (effects.resourceDemandMod) {
                Object.entries(effects.resourceDemandMod).forEach(([resource, value]) => {
                    const resourceName = getResourceName(resource);
                    const percent = Math.round(value * 100);
                    descriptions.push(`${resourceName}需求${percent > 0 ? '+' : ''}${percent}%`);
                });
            }

            // 阶层消费修正效果
            if (effects.stratumDemandMod) {
                Object.entries(effects.stratumDemandMod).forEach(([stratum, value]) => {
                    const stratumName = getStratumName(stratum);
                    const percent = Math.round(value * 100);
                    descriptions.push(`${stratumName}消费${percent > 0 ? '+' : ''}${percent}%`);
                });
            }

            // 建筑产量修正效果
            if (effects.buildingProductionMod) {
                Object.entries(effects.buildingProductionMod).forEach(([target, value]) => {
                    // 尝试查找建筑名称，回退到分类名称或原始键
                    const building = BUILDINGS.find(b => b.id === target);
                    const categoryNames = { gather: '采集类', industry: '工业类', civic: '市政类', all: '所有' };
                    const displayName = building?.name || categoryNames[target] || target;
                    const percent = Math.round(value * 100);
                    descriptions.push(`${displayName}产量${percent > 0 ? '+' : ''}${percent}%`);
                });
            }

            // 触发战争
            if (effects.triggerWar) {
                descriptions.push('触发战争');
            }

            // 触发和平
            if (effects.triggerPeace) {
                descriptions.push('触发和平协议');
            }

            return descriptions.length > 0 ? `（${descriptions.join('，')}）` : '';
        };

        // 过滤效果，移除尚未解锁的阶层/资源/建筑相关效果
        const filteredBaseEffects = filterEventEffects(baseEffects, epoch, techsUnlocked);

        // 先应用过滤后的基础效果
        applyEffects(filteredBaseEffects);

        // 再逐条按概率叠加 randomEffects（同样需要过滤）
        randomEffects.forEach(re => {
            const chance = typeof re.chance === 'number' ? re.chance : 0;
            if (chance > 0 && Math.random() < chance) {
                const filteredRandomEffects = filterEventEffects(re.effects || {}, epoch, techsUnlocked);
                applyEffects(filteredRandomEffects);
                // 记录触发的随机效果
                const percent = Math.round(chance * 100);
                const effectDesc = generateEffectDescription(filteredRandomEffects);

                if (re.description) {
                    addLog(`🎲 运气不错！${percent}%的额外效果「${re.description}」触发了${effectDesc}`);
                } else {
                    addLog(`🎲 运气不错！${percent}%的额外效果触发了${effectDesc}`);
                }

                // 如果有特别重要的效果，可以额外记录
                if (filteredRandomEffects?.triggerWar) {
                    addLog(`⚔️ 与目标国家进入战争状态！`);
                }
                if (filteredRandomEffects?.triggerPeace) {
                    addLog(`🕊️ 与目标国家签订和平协议！`);
                }
            } else if (chance > 0) {
                // 也可以记录未触发的情况（可选）
                const percent = Math.round(chance * 100);
                if (re.description) {
                    addLog(`🎲 ${percent}%的额外效果「${re.description}」未能触发`);
                } else {
                    addLog(`🎲 ${percent}%的额外效果未能触发`);
                }
            }
        });

        // 执行回调（用于外交事件）
        if (option.callback && typeof option.callback === 'function') {
            option.callback();
        }

        // 记录事件历史
        setEventHistory(prev => [
            {
                eventId,
                eventName: event.name,
                optionId: option.id,
                optionText: option.text,
                timestamp: Date.now(),
                day: daysElapsed,
            },
            ...prev,
        ].slice(0, 30));

        // 添加日志
        addLog(`你选择了「${option.text}」`);

        // 清除当前事件
        setCurrentEvent(null);
    };

    // ========== 叛乱系统处理 ==========

    /**
     * 处理叛乱行动
     * @param {string} action - 行动类型
     * @param {string} stratumKey - 阶层键
     * @param {Object} extraData - 额外数据（如叛乱政府对象）
     */
    const handleRebellionAction = (action, stratumKey, extraData) => {
        const currentState = rebellionStates?.[stratumKey];
        if (!currentState) {
            console.warn('[REBELLION] No rebellion state for stratum:', stratumKey);
            return;
        }

        const stratumName = STRATA[stratumKey]?.name || stratumKey;

        // 计算军事力量加成
        const totalArmy = Object.values(army || {}).reduce((sum, c) => sum + (c || 0), 0);
        const militaryStrength = totalArmy * 0.01; // 简化计算

        // 处理行动结果
        const result = processRebellionAction(action, stratumKey, currentState, army, militaryStrength);

        // 更新组织度/阶段
        if (result.updatedOrganization !== undefined || result.pauseDays > 0) {
            setRebellionStates(prev => {
                const prevState = prev?.[stratumKey] || {};
                const nextOrg = result.updatedOrganization !== undefined
                    ? result.updatedOrganization
                    : (prevState.organization || 0);
                const nextStage = getOrganizationStage(nextOrg);
                const nextPhase = getPhaseFromStage(nextStage);
                const phaseChanged = nextPhase !== prevState.phase;
                return {
                    ...prev,
                    [stratumKey]: {
                        ...prevState,
                        organization: nextOrg,
                        stage: nextStage,
                        phase: nextPhase,
                        lastPhaseChange: phaseChanged ? daysElapsed : (prevState.lastPhaseChange || 0),
                        organizationPaused: result.pauseDays
                            ? Math.max(result.pauseDays, prevState.organizationPaused || 0)
                            : prevState.organizationPaused || 0,
                    },
                };
            });
        }

        // 根据行动类型创建结果事件
        let resultEvent = null;
        const resultCallback = (resultAction, stratum) => {
            // 处理结果事件的后续选择
            if (resultAction.startsWith('arrest_')) {
                // 拘捕后处理
                addLog(`叛乱首领已被处理`);
            } else if (resultAction.startsWith('suppress_')) {
                // 镇压后处理
                if (resultAction === 'suppress_mercy') {
                    setClassApproval(prev => ({
                        ...prev,
                        [stratum]: Math.min(100, (prev[stratum] || 50) + 10),
                    }));
                } else if (resultAction === 'suppress_strict') {
                    setStability(prev => Math.min(100, (prev || 50) + 10));
                    setClassApproval(prev => ({
                        ...prev,
                        [stratum]: Math.max(0, (prev[stratum] || 50) - 20),
                    }));
                }
            }
        };

        switch (action) {
            case 'investigate':
                resultEvent = createInvestigationResultEvent(
                    stratumKey,
                    result.success,
                    result.success ? '他们计划在节日时发动突袭。' : null,
                    resultCallback
                );
                break;

            case 'arrest':
                resultEvent = createArrestResultEvent(stratumKey, result.success, resultCallback);
                // 如果失败，扣除损失
                if (!result.success && result.playerLosses > 0) {
                    // 从军队中扣除损失（简化：按比例扣除各单位）
                    const lossRatio = result.playerLosses / Math.max(1, totalArmy);
                    setArmy(prev => {
                        const newArmy = { ...prev };
                        Object.keys(newArmy).forEach(unitType => {
                            const loss = Math.ceil((newArmy[unitType] || 0) * lossRatio);
                            newArmy[unitType] = Math.max(0, (newArmy[unitType] || 0) - loss);
                        });
                        return newArmy;
                    });
                }
                break;

            case 'suppress':
                resultEvent = createSuppressionResultEvent(
                    stratumKey,
                    result.success,
                    result.playerLosses,
                    result.rebelLosses,
                    resultCallback
                );
                // 扣除军队损失
                if (result.playerLosses > 0) {
                    const lossRatio = result.playerLosses / Math.max(1, totalArmy);
                    setArmy(prev => {
                        const newArmy = { ...prev };
                        Object.keys(newArmy).forEach(unitType => {
                            const loss = Math.ceil((newArmy[unitType] || 0) * lossRatio);
                            newArmy[unitType] = Math.max(0, (newArmy[unitType] || 0) - loss);
                        });
                        return newArmy;
                    });
                }
                // 如果镇压成功，移除叛乱政府
                if (result.success && extraData?.id) {
                    setNations(prev => prev.filter(n => n.id !== extraData.id));
                }
                break;

            case 'appease':
            case 'negotiate':
            case 'bribe':
                // 应用满意度变化
                if (result.approvalChange && result.approvalChange > 0) {
                    setClassApproval(prev => ({
                        ...prev,
                        [stratumKey]: Math.min(100, (prev[stratumKey] || 50) + result.approvalChange),
                    }));
                }
                addLog(`${result.message}`);
                break;

            case 'accept_war':
                // 接受与叛乱政府的战争状态（已经在创建时设置）
                addLog(`你决定与${stratumName}叛乱政府全面开战！`);
                break;

            default:
                console.warn('[REBELLION] Unknown action:', action);
        }

        // 触发结果事件
        if (resultEvent) {
            triggerDiplomaticEvent(resultEvent);
        }
    };

    /**
     * 检测并处理叛乱战争结束
     * @param {string} nationId - 叛乱政府国家ID
     * @param {boolean} playerVictory - 玩家是否胜利
     */
    const handleRebellionWarEnd = (nationId, playerVictory) => {
        const rebelNation = nations.find(n => n.id === nationId && n.isRebelNation);
        if (!rebelNation) return;

        const stratumKey = rebelNation.rebellionStratum;
        const stratumName = STRATA[stratumKey]?.name || stratumKey;

        // 创建战争结束事件
        const endEvent = createRebellionEndEvent(
            rebelNation,
            playerVictory,
            resources.silver || 0,
            (action, nation) => {
                if (action === 'end_celebrate') {
                    setStability(prev => Math.min(100, (prev || 50) + 15));
                    setResources(prev => ({
                        ...prev,
                        culture: (prev.culture || 0) + 50,
                    }));
                } else if (action === 'end_rebuild') {
                    setStability(prev => Math.min(100, (prev || 50) + 5));
                } else if (action === 'end_defeat') {
                    setStability(prev => Math.max(0, (prev || 50) - 20));
                }
            }
        );

        // 移除叛乱政府
        setNations(prev => prev.filter(n => n.id !== nationId));

        // 重置叛乱状态
        setRebellionStates(prev => {
            const prevState = prev?.[stratumKey] || {};
            const resetOrganization = playerVictory ? 15 : 40;
            const stage = getOrganizationStage(resetOrganization);
            return {
                ...prev,
                [stratumKey]: {
                    ...prevState,
                    organization: resetOrganization,
                    stage,
                    phase: getPhaseFromStage(stage),
                    dissatisfactionDays: 0,
                    organizationPaused: 0,
                },
            };
        });

        // 如果玩家胜利，恢复部分人口
        if (playerVictory && rebelNation.population > 0) {
            const recoveredPop = Math.floor(rebelNation.population * 0.5); // 恢复50%
            setPopStructure(prev => ({
                ...prev,
                [stratumKey]: (prev[stratumKey] || 0) + recoveredPop,
            }));
            addLog(`${recoveredPop}名${stratumName}回归了你的统治。`);
        }

        // 触发结束事件 - 延迟执行确保在选项处理完成后再显示弹窗
        setTimeout(() => {
            launchDiplomaticEvent(endEvent);
        }, 200);
    };

    // 返回所有操作函数
    return {
        // 时代
        canUpgradeEpoch,
        upgradeEpoch,

        // 建筑
        buyBuilding,
        sellBuilding,
        upgradeBuilding,
        downgradeBuilding,
        batchUpgradeBuilding,
        batchDowngradeBuilding,

        // 科技
        researchTech,

        // 政令 (已废弃)

        // 采集
        manualGather,

        // 军事
        recruitUnit,
        handleAutoReplenishLosses,
        disbandUnit,
        disbandAllUnits,
        cancelTraining,
        cancelAllTraining,
        launchBattle,

        // 外交
        handleDiplomaticAction,
        handleEnemyPeaceAccept,
        handleEnemyPeaceReject,
        handlePlayerPeaceProposal,

        // 贸易路线
        handleTradeRouteAction,

        // 事件
        triggerRandomEvent,
        triggerDiplomaticEvent,
        handleEventOption,

        // 战斗结果
        setBattleResult,
        setBattleNotifications,

        // 添加战斗通知（非阻断式）
        addBattleNotification: (battleResult) => {
            const notification = {
                id: `battle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                result: battleResult,
                timestamp: Date.now(),
            };
            setBattleNotifications(prev => [...prev, notification]);
        },

        // 关闭单个战斗通知
        dismissBattleNotification: (notificationId) => {
            setBattleNotifications(prev => prev.filter(n => n.id !== notificationId));
        },

        // 关闭所有战斗通知
        dismissAllBattleNotifications: () => {
            setBattleNotifications([]);
        },

        // 官员系统
        triggerOfficialSelection,
        hireNewOfficial,
        fireExistingOfficial,
        disposeExistingOfficial,
        updateOfficialSalary,

        // 叛乱系统
        handleRebellionAction,
        handleRebellionWarEnd,
    };
};
