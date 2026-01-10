// 游戏操作钩子
// 包含所有游戏操作函数，如建造建筑、研究科技、升级时代等

import { useState, useEffect } from 'react';
import {
    BUILDINGS,
    EPOCHS,
    RESOURCES,
    TECHS,
    MILITARY_ACTIONS,
    UNIT_TYPES,
    EVENTS,
    getRandomEvent,
    createWarDeclarationEvent,
    createGiftEvent,
    createPeaceRequestEvent,
    createEnemyPeaceRequestEvent,
    createPlayerPeaceProposalEvent,
    createBattleEvent,
    createAllianceRequestEvent,
    createAllianceProposalResultEvent,
    createAllianceBreakEvent,
    createTreatyProposalResultEvent,
    createNationAnnexedEvent,
    STRATA,
    BUILDING_UPGRADES,
    getMaxUpgradeLevel,
    getUpgradeCost,
    getTreatyBreachPenalty,
    getTreatyDuration,
    isDiplomacyUnlocked,
    OPEN_MARKET_TREATY_TYPES,
    PEACE_TREATY_TYPES,
    TREATY_CONFIGS
} from '../config';
import { getBuildingCostGrowthFactor, getBuildingCostBaseMultiplier, getTechCostMultiplier, getBuildingUpgradeCostMultiplier } from '../config/difficulty';
import { debugLog } from '../utils/debugFlags';
import { getUpgradeCountAtOrAboveLevel, calculateBuildingCost, applyBuildingCostModifier } from '../utils/buildingUpgradeUtils';
import { simulateBattle, calculateBattlePower, generateNationArmy } from '../config';
import { calculateForeignPrice, calculateTradeStatus } from '../utils/foreignTrade';
import { generateSound, SOUND_TYPES } from '../config/sounds';
import { getEnemyUnitsForEpoch, calculateProportionalLoot } from '../config/militaryActions';
import { isResourceUnlocked } from '../utils/resources';
import { calculateDynamicGiftCost, calculateProvokeCost, INSTALLMENT_CONFIG } from '../utils/diplomaticUtils';
import { filterEventEffects } from '../utils/eventEffectFilter';
import { calculateNegotiationAcceptChance, generateCounterProposal } from '../logic/diplomacy/negotiation';
// 叛乱系统
import {
    processRebellionAction,
    createInvestigationResultEvent,
    createArrestResultEvent,
    createSuppressionResultEvent,
    createRebellionEndEvent,
} from '../logic/rebellionSystem';
import { getOrganizationStage, getPhaseFromStage } from '../logic/organizationSystem';
import { getLegacyPolicyDecrees } from '../logic/officials/cabinetSynergy';
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
        diplomacyOrganizations,
        setDiplomacyOrganizations,
        overseasInvestments,
        setOverseasInvestments,
        foreignInvestments,
        setForeignInvestments,
        setClassWealth,
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
        // Cabinet policy decrees (permanent)
        decrees,
        setDecrees,
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
        setPlayerInstallmentPayment,
    } = gameState;

    const toggleDecree = (decreeId) => {
        if (!decreeId || typeof setDecrees !== 'function') return;

        // Pull the latest definition so effects are guaranteed to exist in state.
        // (simulation expects { id, active, modifiers })
        const def = getLegacyPolicyDecrees?.()?.[decreeId];
        const nextModifiers = def?.modifiers || def?.effects;

        setDecrees((prev) => {
            const list = Array.isArray(prev) ? prev : [];
            const idx = list.findIndex(d => d && d.id === decreeId);

            // If decree not present, add it as active by default
            if (idx === -1) {
                return [...list, {
                    id: decreeId,
                    active: true,
                    modifiers: nextModifiers
                }];
            }

            return list.map((d, i) => {
                if (i !== idx) return d;
                const currentlyActive = !!d?.active;
                return {
                    ...(d || {}),
                    id: decreeId,
                    active: !currentlyActive,
                    // Always refresh modifiers from definition in case config changed
                    modifiers: nextModifiers ?? d?.modifiers
                };
            });
        });
    };

    const [pendingDiplomaticEvents, setPendingDiplomaticEvents] = useState([]);

    const launchDiplomaticEvent = (event) => {
        if (!event) return;
        if (currentEvent) {
            setPendingDiplomaticEvents(prev => [...prev, event]);
            return;
        }
        setCurrentEvent(event);
        setEventHistory(prev => [...(prev || []), event.id]);
    };

    const triggerDiplomaticEvent = (event) => {
        launchDiplomaticEvent(event);
    };

    const buildEventGameState = () => ({
        population: population || 0,
        epoch: epoch || 0,
        resources: resources || {},
        popStructure: popStructure || {},
        classApproval: classApproval || {},
        classInfluence: classInfluence || {},
        classWealth: classWealth || {},
        classWealthDelta: gameState.classWealthDelta || {},
        classIncome: gameState.classIncome || {},
        totalInfluence: gameState.totalInfluence,
        totalWealth: gameState.totalWealth,
        nations: nations || [],
    });

    const triggerRandomEvent = () => {
        const randomEvent = getRandomEvent(buildEventGameState());
        if (!randomEvent) return;
        const resolvedOptions = Array.isArray(randomEvent.options)
            ? randomEvent.options.map(option => {
                if (!option) return option;
                const filtered = { ...option };
                if (filtered.effects) {
                    filtered.effects = filterEventEffects(filtered.effects, epoch, techsUnlocked);
                }
                if (Array.isArray(filtered.randomEffects)) {
                    filtered.randomEffects = filtered.randomEffects.map(effect => ({
                        ...effect,
                        effects: filterEventEffects(effect.effects, epoch, techsUnlocked),
                    }));
                }
                return filtered;
            })
            : randomEvent.options;

        const eventToLaunch = {
            ...randomEvent,
            options: resolvedOptions,
        };
        launchDiplomaticEvent(eventToLaunch);
    };

    const getVisibleNations = () => (nations || []).filter(n => {
        if (!n || n.visible === false) return false;
        const appearEpoch = n.appearEpoch ?? 0;
        const expireEpoch = n.expireEpoch;
        if (epoch < appearEpoch) return false;
        if (expireEpoch != null && epoch > expireEpoch) return false;
        return true;
    });

    const selectNationBySelector = (selector, visibleNations) => {
        if (!selector) return null;
        if (selector === 'random') {
            if (visibleNations.length === 0) return null;
            return visibleNations[Math.floor(Math.random() * visibleNations.length)];
        }
        if (selector === 'strongest') {
            return visibleNations.reduce((best, n) => (!best || (n.wealth || 0) > (best.wealth || 0) ? n : best), null);
        }
        if (selector === 'weakest') {
            return visibleNations.reduce((best, n) => (!best || (n.wealth || 0) < (best.wealth || 0) ? n : best), null);
        }
        if (selector === 'hostile') {
            const hostile = visibleNations.filter(n => (n.relation || 0) < 30);
            if (hostile.length === 0) return null;
            return hostile[Math.floor(Math.random() * hostile.length)];
        }
        if (selector === 'friendly') {
            const friendly = visibleNations.filter(n => (n.relation || 0) >= 60);
            if (friendly.length === 0) return null;
            return friendly[Math.floor(Math.random() * friendly.length)];
        }
        return visibleNations.find(n => n.id === selector) || null;
    };

    const applyPopulationDelta = (delta) => {
        if (!delta) return;
        const currentTotal = population || 0;
        const targetTotal = Math.max(10, Math.floor(currentTotal + delta));
        const change = targetTotal - currentTotal;
        setPopulation(targetTotal);

        const currentStructure = popStructure && typeof popStructure === 'object' ? popStructure : {};
        const totalStructure = Object.values(currentStructure).reduce((sum, val) => sum + (Number(val) || 0), 0) || currentTotal || 0;
        if (totalStructure <= 0 || change === 0) return;

        const nextStructure = { ...currentStructure };
        Object.entries(currentStructure).forEach(([key, value]) => {
            const share = totalStructure > 0 ? (Number(value) || 0) / totalStructure : 0;
            const deltaForStratum = Math.round(change * share);
            nextStructure[key] = Math.max(0, (Number(value) || 0) + deltaForStratum);
        });
        setPopStructure(nextStructure);
    };

    const applyEventEffects = (effects = {}) => {
        if (!effects || typeof effects !== 'object') return;
        const filtered = filterEventEffects(effects, epoch, techsUnlocked) || {};

        if (filtered.resources && typeof filtered.resources === 'object') {
            setResources(prev => {
                const next = { ...prev };
                Object.entries(filtered.resources).forEach(([key, value]) => {
                    if (typeof value !== 'number') return;
                    next[key] = Math.max(0, (next[key] || 0) + value);
                });
                return next;
            });
        }

        if (filtered.resourcePercent && typeof filtered.resourcePercent === 'object') {
            setResources(prev => {
                const next = { ...prev };
                Object.entries(filtered.resourcePercent).forEach(([key, percent]) => {
                    if (typeof percent !== 'number') return;
                    const base = next[key] || 0;
                    const delta = Math.floor(base * percent);
                    next[key] = Math.max(0, base + delta);
                });
                return next;
            });
        }

        if (typeof filtered.population === 'number') {
            applyPopulationDelta(filtered.population);
        }

        if (typeof filtered.populationPercent === 'number') {
            const base = population || 0;
            applyPopulationDelta(Math.floor(base * filtered.populationPercent));
        }

        if (typeof filtered.maxPop === 'number') {
            if (typeof setMaxPopBonus === 'function') {
                setMaxPopBonus(prev => (prev || 0) + filtered.maxPop);
            }
            if (typeof setMaxPop === 'function') {
                setMaxPop(prev => Math.max(0, (prev || 0) + filtered.maxPop));
            }
        }

        if (filtered.approval && typeof filtered.approval === 'object') {
            if (typeof setActiveEventEffects === 'function') {
                setActiveEventEffects(prev => ({
                    ...(prev || {}),
                    approval: [
                        ...(prev?.approval || []),
                        ...Object.entries(filtered.approval).map(([stratum, value]) => ({
                            stratum,
                            currentValue: value,
                        })),
                    ],
                }));
            }
        }

        if (typeof filtered.stability === 'number') {
            if (typeof setActiveEventEffects === 'function') {
                setActiveEventEffects(prev => ({
                    ...(prev || {}),
                    stability: [
                        ...(prev?.stability || []),
                        {
                            currentValue: filtered.stability,
                        },
                    ],
                }));
            }
        }

        if (filtered.resourceDemandMod && typeof filtered.resourceDemandMod === 'object') {
            if (typeof setActiveEventEffects === 'function') {
                setActiveEventEffects(prev => ({
                    ...(prev || {}),
                    resourceDemand: [
                        ...(prev?.resourceDemand || []),
                        ...Object.entries(filtered.resourceDemandMod).map(([target, value]) => ({
                            target,
                            currentValue: value,
                        })),
                    ],
                }));
            }
        }

        if (filtered.stratumDemandMod && typeof filtered.stratumDemandMod === 'object') {
            if (typeof setActiveEventEffects === 'function') {
                setActiveEventEffects(prev => ({
                    ...(prev || {}),
                    stratumDemand: [
                        ...(prev?.stratumDemand || []),
                        ...Object.entries(filtered.stratumDemandMod).map(([target, value]) => ({
                            target,
                            currentValue: value,
                        })),
                    ],
                }));
            }
        }

        if (filtered.buildingProductionMod && typeof filtered.buildingProductionMod === 'object') {
            if (typeof setActiveEventEffects === 'function') {
                setActiveEventEffects(prev => ({
                    ...(prev || {}),
                    buildingProduction: [
                        ...(prev?.buildingProduction || []),
                        ...Object.entries(filtered.buildingProductionMod).map(([target, value]) => ({
                            target,
                            currentValue: value,
                        })),
                    ],
                }));
            }
        }

        if (filtered.nationRelation || filtered.nationAggression || filtered.nationWealth || filtered.nationMarketVolatility || filtered.triggerWar || filtered.triggerPeace) {
            const visible = getVisibleNations();
            setNations(prev => prev.map(nation => {
                if (!nation) return nation;
                let nextNation = { ...nation };

                const applyNationDelta = (map, key, clampMin = null, clampMax = null) => {
                    if (!map || typeof map !== 'object') return;
                    const entries = Object.entries(map);
                    let totalDelta = 0;
                    let matched = false;

                    entries.forEach(([selector, value]) => {
                        if (selector === 'exclude') return;
                        if (typeof value !== 'number') return;
                        if (selector === 'all') {
                            matched = true;
                            totalDelta += value;
                            return;
                        }
                        if (selector === nation.id) {
                            matched = true;
                            totalDelta += value;
                            return;
                        }
                        const picked = selectNationBySelector(selector, visible);
                        if (picked && picked.id === nation.id) {
                            matched = true;
                            totalDelta += value;
                        }
                    });

                    if (!matched) return;
                    const currentValue = nextNation[key] || 0;
                    let nextValue = currentValue + totalDelta;
                    if (clampMin !== null) nextValue = Math.max(clampMin, nextValue);
                    if (clampMax !== null) nextValue = Math.min(clampMax, nextValue);
                    nextNation[key] = nextValue;
                };

                if (filtered.nationRelation) {
                    if (filtered.nationRelation.exclude && Array.isArray(filtered.nationRelation.exclude)) {
                        if (filtered.nationRelation.exclude.includes(nation.id)) {
                            return nation;
                        }
                    }
                    applyNationDelta(filtered.nationRelation, 'relation', 0, 100);
                }
                if (filtered.nationAggression) {
                    applyNationDelta(filtered.nationAggression, 'aggression', 0, 1);
                }
                if (filtered.nationWealth) {
                    applyNationDelta(filtered.nationWealth, 'wealth', 0, null);
                }
                if (filtered.nationMarketVolatility) {
                    applyNationDelta(filtered.nationMarketVolatility, 'marketVolatility', 0, 1);
                }

                return nextNation;
            }));

            const triggerWarTarget = filtered.triggerWar;
            if (triggerWarTarget) {
                const targetNation = selectNationBySelector(triggerWarTarget, visible);
                if (targetNation) {
                    setNations(prev => prev.map(n => n.id === targetNation.id ? {
                        ...n,
                        isAtWar: true,
                        warStartDay: daysElapsed,
                        warDuration: 0,
                        warScore: n.warScore || 0,
                        lastMilitaryActionDay: undefined,
                    } : n));
                }
            }

            const triggerPeaceTarget = filtered.triggerPeace;
            if (triggerPeaceTarget) {
                const targetNation = selectNationBySelector(triggerPeaceTarget, visible);
                if (targetNation) {
                    setNations(prev => prev.map(n => n.id === targetNation.id ? {
                        ...n,
                        isAtWar: false,
                        warDuration: 0,
                        warScore: 0,
                        peaceTreatyUntil: daysElapsed + 365,
                    } : n));
                }
            }
        }
    };

    const handleEventOption = (eventId, option) => {
        const current = currentEvent && currentEvent.id === eventId ? currentEvent : null;
        const fallback = current || EVENTS.find(evt => evt.id === eventId);
        const selected = option || {};

        if (selected.effects) {
            applyEventEffects(selected.effects);
        }

        if (Array.isArray(selected.randomEffects)) {
            selected.randomEffects.forEach(effect => {
                if (!effect || typeof effect !== 'object') return;
                const chance = typeof effect.chance === 'number' ? effect.chance : 0;
                if (Math.random() <= chance) {
                    applyEventEffects(effect.effects || {});
                }
            });
        }

        if (typeof selected.callback === 'function') {
            selected.callback();
        }

        if (current) {
            setEventHistory(prev => [...(prev || []), current.id]);
        } else if (fallback?.id) {
            setEventHistory(prev => [...(prev || []), fallback.id]);
        }

        if (pendingDiplomaticEvents.length > 0) {
            const [next, ...rest] = pendingDiplomaticEvents;
            setPendingDiplomaticEvents(rest);
            setCurrentEvent(next);
        } else {
            setCurrentEvent(null);
        }
    };

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

        // [FIX] 如果容量为0，直接返回，防止无限招兵
        if (capacity <= 0) {
            debugLog('gameLoop', `[AUTO_REPLENISH] Failed: No military capacity (capacity=0)`);
            addLog('⚠️ 无军事容量，自动补兵已禁用。请建造兵营。');
            return;
        }

        const queueSnapshot = Array.isArray(militaryQueue) ? militaryQueue : [];
        const totalArmyCount = getTotalArmyCount(army, queueSnapshot);

        // [FIX] Stale State Correction
        // handleAutoReplenishLosses is often called in the same tick as the battle result (before setArmy updates state).
        // Therefore, 'totalArmyCount' reflects the PRE-BATTLE army size (which might be full).
        // We must subtract the 'losses' we are about to replenish to understand the TRUE available capacity.
        const totalLossesCount = Object.values(losses).reduce((sum, c) => sum + (c || 0), 0);
        const projectedArmyCount = Math.max(0, totalArmyCount - totalLossesCount);

        // Calculate slots based on projected army size
        let availableSlots = Math.max(0, capacity - projectedArmyCount);

        debugLog('gameLoop', `[AUTO_REPLENISH] Capacity Check: Cap ${capacity}, CurrentArmy ${totalArmyCount}, Losses ${totalLossesCount} -> Projected ${projectedArmyCount}, Slots ${availableSlots}`);

        if (availableSlots <= 0) {
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
     * @param {number} count - 购买数量 (默认为 1)
     */
    const buyBuilding = (id, count = 1) => {
        const b = BUILDINGS.find(x => x.id === id);
        if (!b) return;

        const finalCount = Math.max(1, Math.floor(count));
        const currentCount = buildings[id] || 0;

        // 计算成本（随数量递增）
        const difficultyLevel = gameState.difficulty || 'normal';
        const growthFactor = getBuildingCostGrowthFactor(difficultyLevel);
        const baseMultiplier = getBuildingCostBaseMultiplier(difficultyLevel);
        const buildingCostMod = modifiers?.officialEffects?.buildingCostMod || 0;

        let totalCost = {};

        // 累加每个建筑的成本
        for (let i = 0; i < finalCount; i++) {
            const thisBuildCount = currentCount + i;
            const rawCost = calculateBuildingCost(b.baseCost, thisBuildCount, growthFactor, baseMultiplier);
            const adjustedCost = applyBuildingCostModifier(rawCost, buildingCostMod, b.baseCost);

            Object.entries(adjustedCost).forEach(([res, amount]) => {
                totalCost[res] = (totalCost[res] || 0) + amount;
            });
        }

        const hasMaterials = Object.entries(totalCost).every(([resource, amount]) => (resources[resource] || 0) >= amount);
        if (!hasMaterials) {
            addLog(`资源不足，无法建造 ${finalCount} 个 ${b.name}`);
            return;
        }

        // 计算银币成本并应用官员建筑成本修正
        let silverCost = Object.entries(totalCost).reduce((sum, [resource, amount]) => {
            return sum + amount * getMarketPrice(resource);
        }, 0);
        silverCost = Math.max(0, silverCost);

        if ((resources.silver || 0) < silverCost) {
            addLog('银币不足，无法支付建造费用');
            return;
        }

        const newRes = { ...resources };
        Object.entries(totalCost).forEach(([resource, amount]) => {
            newRes[resource] = Math.max(0, (newRes[resource] || 0) - amount);
        });
        newRes.silver = Math.max(0, (newRes.silver || 0) - silverCost);

        setResources(newRes);
        setBuildings(prev => ({ ...prev, [id]: (prev[id] || 0) + finalCount }));
        addLog(`建造了 ${finalCount} 个 ${b.name}`);

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
     * @param {number} count - 拆除数量（默认为1）
     */
    const sellBuilding = (id, count = 1) => {
        const building = BUILDINGS.find(b => b.id === id);
        if (!building) return;

        const currentCount = buildings[id] || 0;
        const sellCount = Math.min(Math.max(1, Math.floor(count)), currentCount);

        if (sellCount <= 0) return;

        // 批量拆除：逐个处理以确保正确更新升级等级和官员私产
        for (let i = 0; i < sellCount; i++) {
            const remainingCount = currentCount - i;
            if (remainingCount <= 0) break;

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

            // 0级建筑数量 = 剩余总数 - 有升级记录的数量
            const level0Count = remainingCount - upgradedCount;
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
                    const propCount = (off.ownedProperties || []).filter(p => p.buildingId === id && (p.level || 0) === targetLevel).length;
                    if (propCount > 0) {
                        totalOwnedByOfficials += propCount;
                        holders.push({ index: idx, count: propCount, official: off });
                    }
                });

                // 如果官员持有总数 > 国家剩余总数，需要移除官员私产
                if (totalOwnedByOfficials > remainingGlobalCount) {
                    const victimEntry = holders[Math.floor(Math.random() * holders.length)];

                    setOfficials(prev => {
                        const newOfficials = [...prev];
                        const victim = { ...newOfficials[victimEntry.index] };
                        const props = [...(victim.ownedProperties || [])];

                        const removeIdx = props.findIndex(p => p.buildingId === id && (p.level || 0) === targetLevel);
                        if (removeIdx !== -1) {
                            props.splice(removeIdx, 1);
                            victim.ownedProperties = props;
                            newOfficials[victimEntry.index] = victim;
                        }

                        return newOfficials;
                    });
                }
            }
        }

        // 批量更新建筑数量
        setBuildings(prev => {
            const currentVal = prev[id] || 0;
            const newVal = Math.max(0, currentVal - sellCount);
            return { ...prev, [id]: newVal };
        });

        // 根据拆除数量显示不同日志
        if (sellCount === 1) {
            addLog(`🏚️ 拆除了 ${building.name}`);
        } else {
            addLog(`🏚️ 批量拆除了 ${sellCount} 座 ${building.name}`);
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
        const { silent = false, auto = false, count = 1 } = options;
        const recruitCount = Math.max(1, Math.floor(count));

        // 检查时代
        if (unit.epoch > epoch) {
            if (!silent) {
                addLog(`需要升级到 ${EPOCHS[unit.epoch].name} 才能训练 ${unit.name}`);
            }
            return false;
        }

        // 计算总消耗
        const totalUnitCost = {};
        for (let resource in unit.recruitCost) {
            totalUnitCost[resource] = (unit.recruitCost[resource] || 0) * recruitCount;
        }

        // 检查资源
        let canAfford = true;
        for (let resource in totalUnitCost) {
            if ((resources[resource] || 0) < totalUnitCost[resource]) {
                canAfford = false;
                break;
            }
        }

        if (!canAfford) {
            if (!silent) {
                addLog(`资源不足，无法训练 ${recruitCount} 个 ${unit.name}`);
            }
            return false;
        }

        const silverCost = Object.entries(totalUnitCost).reduce((sum, [resource, amount]) => {
            return sum + amount * getMarketPrice(resource);
        }, 0);

        if ((resources.silver || 0) < silverCost) {
            if (!silent) {
                addLog('银币不足，无法支付征兵物资费用。');
            }
            return false;
        }

        const capacity = getMilitaryCapacity();
        const totalArmyCount = getTotalArmyCount(); // 包含当前军队和训练队列中的总数

        // [FIX] 增强容量检查
        if (capacity <= 0) {
            if (!silent && !auto) {
                addLog('⚠️ 无军事容量，无法招募。请先建造兵营。');
            }
            return false;
        }

        if (totalArmyCount + recruitCount > capacity) {
            if (!silent && !auto) {
                addLog(`军事容量不足（${totalArmyCount}/${capacity}），还需要 ${recruitCount} 个空位。`);
            }
            return false;
        }

        // 扣除资源
        const newRes = { ...resources };
        for (let resource in totalUnitCost) {
            newRes[resource] -= totalUnitCost[resource];
        }
        newRes.silver = Math.max(0, (newRes.silver || 0) - silverCost);
        setResources(newRes);

        // 加入训练队列
        const newQueueItems = Array(recruitCount).fill(null).map(() => ({
            unitId,
            status: 'waiting',
            remainingTime: unit.trainingTime,
            totalTime: unit.trainingTime
        }));

        setMilitaryQueue(prev => [...prev, ...newQueueItems]);

        if (!silent) {
            addLog(`开始招募 ${recruitCount} 个 ${unit.name}，等待人员填补岗位...`);
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
    
    const handleTradeRouteAction = (nationId, action, payload = {}) => {
        if (typeof setTradeRoutes !== 'function') return;
        const resourceKey = payload.resourceKey || payload.resource;
        const type = payload.type;
        const mode = payload.mode || 'normal';

        if (!nationId || !resourceKey || !type) {
            addLog('Invalid trade route request.');
            return;
        }
        if (!RESOURCES[resourceKey] || RESOURCES[resourceKey].type === 'virtual' || resourceKey === 'silver') {
            addLog('Resource cannot be traded.');
            return;
        }
        if (type !== 'import' && type !== 'export') {
            addLog('Invalid trade route type.');
            return;
        }
        if (!isResourceUnlocked(resourceKey, epoch, techsUnlocked)) {
            addLog('Resource not unlocked yet.');
            return;
        }

        setTradeRoutes(prev => {
            const current = prev && typeof prev === 'object' ? prev : { routes: [] };
            const routes = Array.isArray(current.routes) ? current.routes : [];
            const matcher = (route) =>
                route.nationId === nationId &&
                route.resource === resourceKey &&
                route.type === type;

            if (action === 'create') {
                const existing = routes.find(matcher);
                if (existing) {
                    if (existing.mode !== mode) {
                        return {
                            ...current,
                            routes: routes.map(route => (matcher(route) ? { ...route, mode } : route)),
                        };
                    }
                    return current;
                }
                return {
                    ...current,
                    routes: [
                        ...routes,
                        {
                            nationId,
                            resource: resourceKey,
                            type,
                            mode,
                            createdAt: daysElapsed,
                        },
                    ],
                };
            }

            if (action === 'cancel') {
                return {
                    ...current,
                    routes: routes.filter(route => !matcher(route)),
                };
            }

            return current;
        });

        const logVisibility = eventEffectSettings?.logVisibility || {};
        const shouldLogTradeRoutes = logVisibility.showTradeRouteLogs ?? true;
        if (shouldLogTradeRoutes) {
            if (action === 'create') {
                addLog(`Trade route created: ${resourceKey} ${type}.`);
            } else if (action === 'cancel') {
                addLog(`Trade route canceled: ${resourceKey} ${type}.`);
            }
        }
    };

const handleDiplomaticAction = (nationId, action, payload = {}) => {
        const targetNation = nations.find(n => n.id === nationId);
        if (!targetNation) return;
        const clampRelation = (value) => Math.max(0, Math.min(100, value));

        // 外交动作冷却时间配置（天数）        
        const DIPLOMATIC_COOLDOWNS = {
            gift: 30,           // ???30???
            demand: 30,         // ???30???
            provoke: 30,        // ???30???
            propose_alliance: 30, // ?????30???
            create_org: 180,    // ?????180???
            join_org: 90,       // ???????90???
            leave_org: 60,      // ???????60???
            break_alliance: 0,  // ????????????????
            negotiate_treaty: 120, // Multi-round negotiation cooldown
        };

        // 检查外交动作冷却时间
        const cooldownDays = DIPLOMATIC_COOLDOWNS[action];
        const cooldownModifier = modifiers?.officialEffects?.diplomaticCooldown || 0;
        const adjustedCooldownDays = cooldownDays && cooldownDays > 0
            ? Math.max(1, Math.round(cooldownDays * (1 + cooldownModifier)))
            : cooldownDays;
        const skipCooldownCheck = action === 'negotiate_treaty' && payload?.ignoreCooldown === true;
        if (!skipCooldownCheck && adjustedCooldownDays && adjustedCooldownDays > 0) {
            const lastActionDay = targetNation.lastDiplomaticActionDay?.[action] || 0;
            const daysSinceLastAction = daysElapsed - lastActionDay;
            if (lastActionDay > 0 && daysSinceLastAction < adjustedCooldownDays) {
                const remainingDays = adjustedCooldownDays - daysSinceLastAction;
                const actionNames = {
                    gift: '送礼',
                    demand: '索要',
                    provoke: '挑拨',
                    propose_alliance: '请求结盟',
                    create_org: '创建组织',
                    join_org: '邀请加入',
                    leave_org: '移除成员',
                    negotiate_treaty: 'Negotiation',
                };
                addLog(`⏳ 对 ${targetNation.name} 的${actionNames[action] || action}行动尚在冷却中，还需 ${remainingDays} 天。`);
                return;
            }
        }

        if (targetNation.isAtWar && (action === 'gift' || action === 'trade' || action === 'import' || action === 'demand')) {
            addLog(`${targetNation.name} 与你正处于战争状态，无法进行此外交行动。`);
            return;
        }

        const organizationState = diplomacyOrganizations || { organizations: [] };
        const organizations = Array.isArray(organizationState.organizations) ? organizationState.organizations : [];
        const getPlayerOrganizationByType = (type) => organizations.find(org =>
            org?.type === type && Array.isArray(org.members) && org.members.includes('player')
        );
        const isNationInOrganization = (org, nationIdToCheck) =>
            Array.isArray(org?.members) && org.members.includes(nationIdToCheck);
        const updateOrganizationState = (updater) => {
            if (typeof setDiplomacyOrganizations !== 'function') return;
            setDiplomacyOrganizations(prev => {
                const current = prev && typeof prev === 'object' ? prev : { organizations: [] };
                const nextOrgs = updater(Array.isArray(current.organizations) ? current.organizations : []);
                return { ...current, organizations: nextOrgs };
            });
        };

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

            case 'trade_route': {
                const routeAction = payload?.action;
                handleTradeRouteAction(nationId, routeAction, payload || {});
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
                const isPeaceActive = targetNation.peaceTreatyUntil && daysElapsed < targetNation.peaceTreatyUntil;
                const breachPenalty = isPeaceActive ? getTreatyBreachPenalty(epoch) : null;

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
                            const nextTreaties = Array.isArray(n.treaties)
                                ? n.treaties.filter(t => !PEACE_TREATY_TYPES.includes(t.type))
                                : n.treaties;
                            return {
                                ...n,
                                relation: Math.max(0, (n.relation || 0) - (breachPenalty?.relationPenalty || 0)),
                                isAtWar: true,
                                warScore: 0,
                                warStartDay: daysElapsed,
                                warDuration: 0,
                                enemyLosses: 0,
                                peaceTreatyUntil: undefined,
                                treaties: nextTreaties,
                                lastTreatyBreachDay: breachPenalty ? daysElapsed : n.lastTreatyBreachDay,
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

                if (breachPenalty) {
                    addLog(`你撕毁与 ${targetNation.name} 的和平条约，关系恶化（-${breachPenalty.relationPenalty}）。`);
                }
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

            case 'propose_treaty': {
                const treaty = payload || {};
                const type = treaty.type;
                const maintenancePerDay = Math.max(0, Math.floor(Number(treaty.maintenancePerDay) || 0));

                if (!type) {
                    addLog('条约提案失败：缺少条约类型。');
                    return;
                }
                if (!isDiplomacyUnlocked('treaties', type, epoch)) {
                    addLog('该条约尚未解锁，无法提出。');
                    return;
                }
                if (targetNation.isAtWar) {
                    addLog(`无法提出条约：${targetNation.name} 正与你交战。`);
                    return;
                }

                // Cooldown (MVP)
                const COOLDOWN_DAYS = 120;
                const lastActionDay = targetNation.lastDiplomaticActionDay?.propose_treaty || 0;
                const daysSince = daysElapsed - lastActionDay;
                if (lastActionDay > 0 && daysSince < COOLDOWN_DAYS) {
                    addLog(`⏳ 对 ${targetNation.name} 的条约提案尚在冷却中，还需 ${COOLDOWN_DAYS - daysSince} 天。`);
                    return;
                }

                const durationDays = Math.max(1, Math.floor(Number(treaty.durationDays) || getTreatyDuration(type, epoch)));

                // Prevent spamming the same treaty while active
                const isPeaceActive = targetNation.peaceTreatyUntil && daysElapsed < targetNation.peaceTreatyUntil;
                const isOpenMarketActive = targetNation.openMarketUntil && daysElapsed < targetNation.openMarketUntil;
                const hasActiveTreatyType = (types) => Array.isArray(targetNation.treaties)
                    && targetNation.treaties.some((t) => types.includes(t.type) && (!Number.isFinite(t.endDay) || daysElapsed < t.endDay));

                if (PEACE_TREATY_TYPES.includes(type) && isPeaceActive) {
                    addLog(`与 ${targetNation.name} 的互不侵犯/和平协议仍在生效中，无法重复提出。`);
                    return;
                }
                if (OPEN_MARKET_TREATY_TYPES.includes(type) && (isOpenMarketActive || hasActiveTreatyType(OPEN_MARKET_TREATY_TYPES))) {
                    addLog(`与 ${targetNation.name} 的开放市场协议仍在生效中，无法重复提出。`);
                    return;
                }
                if (type === 'investment_pact' && hasActiveTreatyType(['investment_pact'])) {
                    addLog(`与 ${targetNation.name} 的投资协议仍在生效中，无法重复提出。`);
                    return;
                }

                // Simple acceptance scoring (MVP)
                const relation = targetNation.relation || 0;
                const aggression = targetNation.aggression ?? 0.3;
                const treatyConfig = TREATY_CONFIGS[type] || {};
                if (Number.isFinite(treatyConfig.minRelation) && relation < treatyConfig.minRelation) {
                    addLog(`${targetNation.name} 当前关系不足，难以接受该条约。`);
                    return;
                }

                // Base by type
                const baseChanceByType = {
                    peace_treaty: 0.45,
                    non_aggression: 0.35,
                    trade_agreement: 0.32,
                    free_trade: 0.26,
                    investment_pact: 0.22,
                    open_market: 0.30,
                    academic_exchange: 0.25,
                    defensive_pact: 0.18,
                };
                const base = baseChanceByType[type] ?? 0.25;

                // Relation boosts, aggression reduces
                const relationBoost = Math.max(0, (relation - 40) / 100); // 40=>0, 100=>0.6
                const aggressionPenalty = aggression * 0.25;

                // Maintenance reduces acceptance
                const maintenancePenalty = Math.min(0.25, maintenancePerDay / 500000);

                let acceptChance = base + relationBoost - aggressionPenalty - maintenancePenalty;

                // Type gating
                if (type === 'open_market' && relation < 55) acceptChance *= 0.4;
                if (type === 'trade_agreement' && relation < 50) acceptChance *= 0.5;
                if (type === 'free_trade' && relation < 65) acceptChance *= 0.3;
                if (type === 'investment_pact' && relation < 60) acceptChance *= 0.4;
                if (type === 'academic_exchange' && relation < 65) acceptChance *= 0.2;
                if (type === 'defensive_pact' && relation < 70) acceptChance *= 0.2;

                acceptChance = Math.max(0.02, Math.min(0.92, acceptChance));

                const accepted = Math.random() < acceptChance;

                setNations(prev => prev.map(n => {
                    if (n.id !== nationId) return n;

                    if (!accepted) {
                        return {
                            ...n,
                            relation: Math.max(0, (n.relation || 0) - 4),
                            lastDiplomaticActionDay: {
                                ...(n.lastDiplomaticActionDay || {}),
                                propose_treaty: daysElapsed,
                            },
                        };
                    }

                    const nextTreaties = Array.isArray(n.treaties) ? [...n.treaties] : [];
                    nextTreaties.push({
                        id: `treaty_${n.id}_${Date.now()}`,
                        type,
                        startDay: daysElapsed,
                        endDay: daysElapsed + durationDays,
                        maintenancePerDay,
                        direction: 'player_to_ai',
                    });

                    const updates = {
                        treaties: nextTreaties,
                        relation: Math.min(100, (n.relation || 0) + 6),
                        lastDiplomaticActionDay: {
                            ...(n.lastDiplomaticActionDay || {}),
                            propose_treaty: daysElapsed,
                        },
                    };

                      // Minimal effects (still asymmetric in data model: stored on AI nation; it affects your interaction with them)
                      if (OPEN_MARKET_TREATY_TYPES.includes(type)) {
                          updates.openMarketUntil = Math.max(n.openMarketUntil || 0, daysElapsed + durationDays);
                      }
                      if (PEACE_TREATY_TYPES.includes(type)) {
                          updates.peaceTreatyUntil = Math.max(n.peaceTreatyUntil || 0, daysElapsed + durationDays);
                      }
                      if (type === 'defensive_pact') {
                          updates.alliedWithPlayer = true;
                      }

                    return { ...n, ...updates };
                }));

                const resultEvent = createTreatyProposalResultEvent(targetNation, { type, durationDays, maintenancePerDay }, accepted, () => { });
                triggerDiplomaticEvent(resultEvent);

                if (accepted) {
                    addLog(`📜 ${targetNation.name} 同意了你的条约提案（${type}）。`);
                } else {
                    addLog(`📜 ${targetNation.name} 拒绝了你的条约提案。`);
                }

                break;
            }
            case 'negotiate_treaty': {
                const proposal = payload?.proposal || {};
                const type = proposal.type;
                const stance = payload?.stance || 'normal';
                const round = Math.max(1, Math.floor(payload?.round || 1));
                const maxRounds = Math.max(1, Math.floor(payload?.maxRounds || 3));
                const forceAccept = payload?.forceAccept === true;
                const onResult = typeof payload?.onResult === 'function' ? payload.onResult : null;

                if (!isDiplomacyUnlocked('economy', 'multi_round_negotiation', epoch)) {
                    addLog('当前时代尚未解锁多轮谈判。');
                    if (onResult) onResult({ status: 'blocked', reason: 'era' });
                    return;
                }
                if (!type) {
                    addLog('谈判失败：缺少条约类型。');
                    if (onResult) onResult({ status: 'blocked', reason: 'type' });
                    return;
                }
                if (!isDiplomacyUnlocked('treaties', type, epoch)) {
                    addLog('该条约尚未解锁，无法谈判。');
                    if (onResult) onResult({ status: 'blocked', reason: 'treaty_locked' });
                    return;
                }
                if (targetNation.isAtWar) {
                    addLog(`${targetNation.name} 正与您交战，无法谈判。`);
                    if (onResult) onResult({ status: 'blocked', reason: 'war' });
                    return;
                }

                const durationDays = Math.max(1, Math.floor(Number(proposal.durationDays) || getTreatyDuration(type, epoch)));
                const maintenancePerDay = Math.max(0, Math.floor(Number(proposal.maintenancePerDay) || 0));
                const signingGift = Math.max(0, Math.floor(Number(proposal.signingGift) || 0));
                const resourceKey = proposal.resourceKey || '';
                const resourceAmount = Math.max(0, Math.floor(Number(proposal.resourceAmount) || 0));

                const isPeaceActive = targetNation.peaceTreatyUntil && daysElapsed < targetNation.peaceTreatyUntil;
                const isOpenMarketActive = targetNation.openMarketUntil && daysElapsed < targetNation.openMarketUntil;
                const hasActiveTreatyType = (types) => Array.isArray(targetNation.treaties)
                    && targetNation.treaties.some((t) => types.includes(t.type) && (!Number.isFinite(t.endDay) || daysElapsed < t.endDay));

                if (PEACE_TREATY_TYPES.includes(type) && isPeaceActive) {
                    addLog(`与 ${targetNation.name} 的和平/互不侵犯仍在生效中，无法重复谈判。`);
                    if (onResult) onResult({ status: 'blocked', reason: 'peace_active' });
                    return;
                }
                if (OPEN_MARKET_TREATY_TYPES.includes(type) && (isOpenMarketActive || hasActiveTreatyType(OPEN_MARKET_TREATY_TYPES))) {
                    addLog(`与 ${targetNation.name} 的贸易/开放市场条约仍在生效中，无法重复谈判。`);
                    if (onResult) onResult({ status: 'blocked', reason: 'market_active' });
                    return;
                }
                if (type === 'investment_pact' && hasActiveTreatyType(['investment_pact'])) {
                    addLog(`与 ${targetNation.name} 的投资协议仍在生效中，无法重复谈判。`);
                    if (onResult) onResult({ status: 'blocked', reason: 'investment_active' });
                    return;
                }

                if (signingGift > 0 && (resources.silver || 0) < signingGift) {
                    addLog('银币不足，无法支付签约赠礼。');
                    if (onResult) onResult({ status: 'blocked', reason: 'silver' });
                    return;
                }
                if (resourceAmount > 0) {
                    if (!RESOURCES[resourceKey] || RESOURCES[resourceKey].type === 'virtual' || resourceKey === 'silver') {
                        addLog('赠送资源无效，谈判已取消。');
                        if (onResult) onResult({ status: 'blocked', reason: 'resource' });
                        return;
                    }
                    if ((resources[resourceKey] || 0) < resourceAmount) {
                        addLog('资源不足，无法作为赠礼。');
                        if (onResult) onResult({ status: 'blocked', reason: 'resource' });
                        return;
                    }
                }

                const evaluation = calculateNegotiationAcceptChance({
                    proposal: {
                        type,
                        durationDays,
                        maintenancePerDay,
                        signingGift,
                        resourceKey,
                        resourceAmount,
                    },
                    nation: targetNation,
                    epoch,
                    stance,
                });

                const accepted = forceAccept || Math.random() < evaluation.acceptChance;
                const stanceDelta = stance === 'friendly' ? 2 : (stance === 'threat' ? -20 : 0);

                if (accepted) {
                    if (signingGift > 0) {
                        setResources(prev => ({ ...prev, silver: Math.max(0, (prev.silver || 0) - signingGift) }));
                    }
                    if (resourceAmount > 0 && resourceKey) {
                        setResources(prev => ({ ...prev, [resourceKey]: Math.max(0, (prev[resourceKey] || 0) - resourceAmount) }));
                    }

                    setNations(prev => prev.map(n => {
                        if (n.id !== nationId) return n;

                        const nextTreaties = Array.isArray(n.treaties) ? [...n.treaties] : [];
                        nextTreaties.push({
                            id: `treaty_${n.id}_${Date.now()}`,
                            type,
                            startDay: daysElapsed,
                            endDay: daysElapsed + durationDays,
                            maintenancePerDay,
                            direction: 'player_to_ai',
                        });

                        const updates = {
                            treaties: nextTreaties,
                            relation: clampRelation((n.relation || 0) + 6 + stanceDelta),
                            wealth: (n.wealth || 0) + signingGift,
                            lastDiplomaticActionDay: {
                                ...(n.lastDiplomaticActionDay || {}),
                                negotiate_treaty: daysElapsed,
                            },
                        };

                        if (resourceAmount > 0 && resourceKey) {
                            updates.inventory = {
                                ...(n.inventory || {}),
                                [resourceKey]: ((n.inventory || {})[resourceKey] || 0) + resourceAmount,
                            };
                        }
                        if (OPEN_MARKET_TREATY_TYPES.includes(type)) {
                            updates.openMarketUntil = Math.max(n.openMarketUntil || 0, daysElapsed + durationDays);
                        }
                        if (PEACE_TREATY_TYPES.includes(type)) {
                            updates.peaceTreatyUntil = Math.max(n.peaceTreatyUntil || 0, daysElapsed + durationDays);
                        }
                        if (type === 'defensive_pact') {
                            updates.alliedWithPlayer = true;
                        }

                        return { ...n, ...updates };
                    }));

                    addLog(`🤝 ${targetNation.name} 同意了谈判条约（${type}）。`);
                    if (onResult) onResult({ status: 'accepted', acceptChance: evaluation.acceptChance });
                    break;
                }

                const counterProposal = !forceAccept && round < maxRounds
                    ? generateCounterProposal({ proposal: {
                        type,
                        durationDays,
                        maintenancePerDay,
                        signingGift,
                        resourceKey,
                        resourceAmount,
                    }, nation: targetNation, round })
                    : null;

                if (counterProposal) {
                    const counterDelta = stance === 'threat' ? -6 : (stance === 'friendly' ? 0 : -1);
                    setNations(prev => prev.map(n =>
                        n.id === nationId
                            ? { ...n, relation: clampRelation((n.relation || 0) + counterDelta) }
                            : n
                    ));
                    addLog(`${targetNation.name} 提出了反提案。`);
                    if (onResult) onResult({ status: 'counter', counterProposal, acceptChance: evaluation.acceptChance });
                    break;
                }

                setNations(prev => prev.map(n =>
                    n.id === nationId
                        ? {
                            ...n,
                            relation: clampRelation((n.relation || 0) - 4 + stanceDelta),
                            lastDiplomaticActionDay: {
                                ...(n.lastDiplomaticActionDay || {}),
                                negotiate_treaty: daysElapsed,
                            },
                        }
                        : n
                ));
                addLog(`${targetNation.name} 拒绝了谈判，双方关系下降。`);
                if (onResult) onResult({ status: 'rejected', acceptChance: evaluation.acceptChance });
                break;
            }
            case 'create_org': {
                const type = payload?.type;
                if (!type) {
                    addLog('无法创建组织：缺少类型。');
                    return;
                }
                if (!isDiplomacyUnlocked('organizations', type, epoch)) {
                    addLog('该组织尚未解锁。');
                    return;
                }
                if (targetNation.isAtWar) {
                    addLog(`无法创建组织：${targetNation.name} 正与你交战。`);
                    return;
                }

                const existing = getPlayerOrganizationByType(type);
                if (existing) {
                    addLog('你已拥有该类型的组织。');
                    return;
                }

                const relation = targetNation.relation || 0;
                const minRelation = type === 'trade_zone' ? 65 : 60;
                if (relation < minRelation) {
                    addLog(`关系不足（需要${minRelation}），无法与 ${targetNation.name} 共建组织。`);
                    return;
                }

                const name = payload?.name
                    || (type === 'economic_bloc' ? `${targetNation.name}?????` : `${targetNation.name}???`);
                const org = {
                    id: `org_${type}_${Date.now()}`,
                    type,
                    name,
                    leaderId: 'player',
                    members: ['player', nationId],
                    createdDay: daysElapsed,
                };

                updateOrganizationState(prev => [...prev, org]);
                setNations(prev => prev.map(n => {
                    if (n.id !== nationId) return n;
                    const memberships = Array.isArray(n.organizationMemberships) ? n.organizationMemberships : [];
                    return {
                        ...n,
                        relation: clampRelation((n.relation || 0) + 5),
                        organizationMemberships: memberships.includes(org.id) ? memberships : [...memberships, org.id],
                        lastDiplomaticActionDay: {
                            ...(n.lastDiplomaticActionDay || {}),
                            create_org: daysElapsed,
                        },
                    };
                }));

                addLog(`你与 ${targetNation.name} 建立了新的组织：${name}。`);
                break;
            }
            case 'join_org': {
                const type = payload?.type;
                const orgId = payload?.orgId;
                const org = orgId
                    ? organizations.find(o => o?.id === orgId && Array.isArray(o.members) && o.members.includes('player'))
                    : (type ? getPlayerOrganizationByType(type) : null);

                if (!org) {
                    addLog('没有可邀请加入的组织。');
                    return;
                }
                if (!isDiplomacyUnlocked('organizations', org.type, epoch)) {
                    addLog('该组织尚未解锁。');
                    return;
                }
                if (targetNation.isAtWar) {
                    addLog(`无法邀请：${targetNation.name} 正与你交战。`);
                    return;
                }
                if (isNationInOrganization(org, nationId)) {
                    addLog(`${targetNation.name} 已是该组织成员。`);
                    return;
                }

                const relation = targetNation.relation || 0;
                const minRelation = org.type === 'trade_zone' ? 60 : 55;
                if (relation < minRelation) {
                    addLog(`关系不足（需要${minRelation}），无法邀请加入。`);
                    return;
                }

                updateOrganizationState(prev => prev.map(o => {
                    if (o.id !== org.id) return o;
                    const members = Array.isArray(o.members) ? o.members : [];
                    return {
                        ...o,
                        members: members.includes(nationId) ? members : [...members, nationId],
                    };
                }));
                setNations(prev => prev.map(n => {
                    if (n.id !== nationId) return n;
                    const memberships = Array.isArray(n.organizationMemberships) ? n.organizationMemberships : [];
                    return {
                        ...n,
                        relation: clampRelation((n.relation || 0) + 3),
                        organizationMemberships: memberships.includes(org.id) ? memberships : [...memberships, org.id],
                        lastDiplomaticActionDay: {
                            ...(n.lastDiplomaticActionDay || {}),
                            join_org: daysElapsed,
                        },
                    };
                }));

                addLog(`${targetNation.name} 加入了 ${org.name}。`);
                break;
            }
            case 'leave_org': {
                const orgId = payload?.orgId;
                const org = orgId
                    ? organizations.find(o => o?.id === orgId)
                    : organizations.find(o => isNationInOrganization(o, nationId));

                if (!org || !isNationInOrganization(org, nationId)) {
                    addLog(`${targetNation.name} 当前不在任何可移除的组织中。`);
                    return;
                }

                updateOrganizationState(prev => prev.map(o => {
                    if (o.id !== org.id) return o;
                    const members = Array.isArray(o.members) ? o.members : [];
                    return {
                        ...o,
                        members: members.filter(m => m !== nationId),
                    };
                }));
                setNations(prev => prev.map(n => {
                    if (n.id !== nationId) return n;
                    const memberships = Array.isArray(n.organizationMemberships) ? n.organizationMemberships : [];
                    return {
                        ...n,
                        relation: clampRelation((n.relation || 0) - 4),
                        organizationMemberships: memberships.filter(id => id !== org.id),
                        lastDiplomaticActionDay: {
                            ...(n.lastDiplomaticActionDay || {}),
                            leave_org: daysElapsed,
                        },
                    };
                }));

                addLog(`${targetNation.name} 已退出 ${org.name}。`);
                break;
            }

            // ========== 附庸系统行动 ==========
            case 'establish_vassal': {
                const vassalType = payload?.vassalType;
                if (!vassalType) {
                    addLog('无法建立附庸关系：缺少附庸类型。');
                    return;
                }
                
                // 动态导入附庸系统模块
                import('../logic/diplomacy/vassalSystem').then(({ canEstablishVassal, establishVassalRelation }) => {
                    import('../config/diplomacy').then(({ VASSAL_TYPE_CONFIGS }) => {
                        const config = VASSAL_TYPE_CONFIGS[vassalType];
                        if (!config) {
                            addLog(`无效的附庸类型：${vassalType}`);
                            return;
                        }

                        const playerMilitary = Object.values(army || {}).reduce((sum, count) => sum + count, 0) / 100;
                        const warScore = targetNation.warScore || 0;
                        
                        const { canEstablish, reason } = canEstablishVassal(targetNation, vassalType, {
                            epoch,
                            playerMilitary: Math.max(0.5, playerMilitary),
                            warScore: Math.abs(warScore),
                        });

                        if (!canEstablish) {
                            addLog(`无法将 ${targetNation.name} 变为${config.name}：${reason}`);
                            return;
                        }

                        setNations(prev => prev.map(n => {
                            if (n.id !== nationId) return n;
                            return establishVassalRelation(n, vassalType, epoch);
                        }));

                        addLog(`📜 ${targetNation.name} 已成为你的${config.name}！`);
                    });
                }).catch(err => {
                    console.error('Failed to load vassal system:', err);
                    addLog('附庸系统加载失败。');
                });
                break;
            }

            case 'release_vassal': {
                if (targetNation.vassalOf !== 'player') {
                    addLog(`${targetNation.name} 不是你的附庸国。`);
                    return;
                }

                import('../logic/diplomacy/vassalSystem').then(({ releaseVassal }) => {
                    setNations(prev => prev.map(n => {
                        if (n.id !== nationId) return n;
                        return releaseVassal(n, 'released');
                    }));
                    addLog(`📜 你释放了 ${targetNation.name}，对方关系提升。`);
                }).catch(err => {
                    console.error('Failed to load vassal system:', err);
                    addLog('附庸系统加载失败。');
                });
                break;
            }

            case 'adjust_vassal_policy': {
                if (targetNation.vassalOf !== 'player') {
                    addLog(`${targetNation.name} 不是你的附庸国。`);
                    return;
                }

                const policyChanges = payload?.policy || {};
                
                import('../logic/diplomacy/vassalSystem').then(({ adjustVassalPolicy }) => {
                    try {
                        setNations(prev => prev.map(n => {
                            if (n.id !== nationId) return n;
                            return adjustVassalPolicy(n, policyChanges);
                        }));
                        addLog(`📜 已调整对 ${targetNation.name} 的附庸政策。`);
                    } catch (err) {
                        addLog(`调整政策失败：${err.message}`);
                    }
                }).catch(err => {
                    console.error('Failed to load vassal system:', err);
                    addLog('附庸系统加载失败。');
                });
                break;
            }

            // ========== 海外投资相关行动 ==========
            case 'establish_overseas_investment': {
                // 在附庸国建立海外投资
                const { buildingId, ownerStratum, operatingMode } = payload || {};
                if (!targetNation || !buildingId) {
                    addLog('建立海外投资失败：参数不完整');
                    break;
                }
                
                import('../logic/diplomacy/overseasInvestment').then(({ establishOverseasInvestment }) => {
                    const result = establishOverseasInvestment({
                        targetNation,
                        buildingId,
                        ownerStratum: ownerStratum || 'capitalist',
                        operatingMode: operatingMode || 'local',
                        existingInvestments: overseasInvestments || [],
                        classWealth,
                        daysElapsed,
                    });
                    
                    if (result.success) {
                        // 更新海外投资列表
                        setOverseasInvestments(prev => [...prev, result.investment]);
                        // 扣除业主阶层财富
                        setClassWealth(prev => ({
                            ...prev,
                            [ownerStratum || 'capitalist']: Math.max(0, (prev[ownerStratum || 'capitalist'] || 0) - result.cost),
                        }));
                        addLog(`🏭 ${result.message}`);
                    } else {
                        addLog(`⚠️ ${result.message}`);
                    }
                }).catch(err => {
                    console.error('Failed to load overseas investment system:', err);
                    addLog('海外投资系统加载失败。');
                });
                break;
            }

            case 'withdraw_overseas_investment': {
                // 撤回海外投资
                const { investmentId } = details || {};
                if (!investmentId) {
                    addLog('撤回投资失败：参数不完整');
                    break;
                }
                
                setOverseasInvestments(prev => {
                    const investment = prev.find(inv => inv.id === investmentId);
                    if (!investment) {
                        addLog('找不到该投资记录');
                        return prev;
                    }
                    
                    // 返还部分投资（扣除20%违约金）
                    const returnAmount = (investment.investmentAmount || 0) * 0.8;
                    const ownerStratum = investment.ownerStratum || 'capitalist';
                    setClassWealth(prevWealth => ({
                        ...prevWealth,
                        [ownerStratum]: (prevWealth[ownerStratum] || 0) + returnAmount,
                    }));
                    
                    addLog(`💰 已撤回在附庸国的投资，收回 ${returnAmount.toFixed(0)} 银币（扣除20%违约金）`);
                    return prev.filter(inv => inv.id !== investmentId);
                });
                break;
            }

            case 'change_investment_mode': {
                // 切换海外投资运营模式
                const { investmentId, newMode } = details || {};
                if (!investmentId || !newMode) {
                    addLog('切换模式失败：参数不完整');
                    break;
                }
                
                setOverseasInvestments(prev => prev.map(inv => {
                    if (inv.id !== investmentId) return inv;
                    addLog(`📦 已将海外投资切换为${newMode === 'dumping' ? '倾销' : newMode === 'buyback' ? '回购' : '当地运营'}模式`);
                    return { ...inv, operatingMode: newMode };
                }));
                break;
            }

            case 'nationalize_foreign_investment': {
                // 国有化外资建筑
                const { investmentId } = details || {};
                if (!investmentId) {
                    addLog('国有化失败：参数不完整');
                    break;
                }
                
                import('../logic/diplomacy/overseasInvestment').then(({ nationalizeInvestment }) => {
                    setForeignInvestments(prev => {
                        const investment = prev.find(inv => inv.id === investmentId);
                        if (!investment) {
                            addLog('找不到该外资记录');
                            return prev;
                        }
                        
                        const ownerNation = nations.find(n => n.id === investment.ownerNationId);
                        const result = nationalizeInvestment(investment, ownerNation);
                        
                        if (result.success) {
                            // 降低与业主国的关系
                            if (ownerNation) {
                                setNations(prevNations => prevNations.map(n => {
                                    if (n.id !== ownerNation.id) return n;
                                    return {
                                        ...n,
                                        relation: Math.max(0, (n.relation || 50) + result.relationPenalty),
                                    };
                                }));
                            }
                            addLog(`🏛️ ${result.message}`);
                            return prev.map(inv => inv.id === investmentId ? { ...inv, status: 'nationalized' } : inv);
                        } else {
                            addLog(`⚠️ ${result.message}`);
                            return prev;
                        }
                    });
                }).catch(err => {
                    console.error('Failed to load overseas investment system:', err);
                    addLog('海外投资系统加载失败。');
                });
                break;
            }

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
    const handleRebellionAction = (action, stratumKey, extraData = {}) => {
        if (!stratumKey) return;

        const rebellionState = (rebellionStates && rebellionStates[stratumKey]) || {};
        const totalArmy = Object.values(army || {}).reduce((sum, count) => sum + (count || 0), 0);
        const militaryStrength = calculateBattlePower(army, epoch, modifiers?.militaryBonus || 0) / 100;
        const result = processRebellionAction(action, stratumKey, rebellionState, army, militaryStrength);
        const resultCallback = () => {};

        if (result.updatedOrganization !== undefined || result.pauseDays) {
            setRebellionStates(prev => {
                const prevState = prev?.[stratumKey] || {};
                const nextOrganization = result.updatedOrganization !== undefined
                    ? result.updatedOrganization
                    : (prevState.organization || 0);
                const stage = getOrganizationStage(nextOrganization);
                return {
                    ...prev,
                    [stratumKey]: {
                        ...prevState,
                        organization: nextOrganization,
                        stage,
                        phase: result.newPhase || getPhaseFromStage(stage),
                        organizationPaused: result.pauseDays || 0,
                        dissatisfactionDays: prevState.dissatisfactionDays || 0,
                        influenceShare: prevState.influenceShare || 0,
                    },
                };
            });
        }

        let resultEvent = null;
        switch (action) {
            case 'investigate':
                resultEvent = createInvestigationResultEvent(
                    stratumKey,
                    result.success,
                    result.success ? 'Discovered early warning signs.' : null,
                    resultCallback
                );
                break;
            case 'arrest':
                resultEvent = createArrestResultEvent(stratumKey, result.success, resultCallback);
                if (!result.success && result.playerLosses > 0) {
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
                if (result.success && extraData?.id) {
                    setNations(prev => prev.filter(n => n.id !== extraData.id));
                }
                break;
            case 'appease':
            case 'negotiate':
            case 'bribe':
                if (result.approvalChange && result.approvalChange > 0) {
                    setClassApproval(prev => ({
                        ...prev,
                        [stratumKey]: Math.min(100, (prev[stratumKey] || 50) + result.approvalChange),
                    }));
                }
                if (result.message) {
                    addLog(`${result.message}`);
                }
                break;
            case 'accept_war':
                addLog(`Accepted war with ${STRATA[stratumKey]?.name || stratumKey} rebels.`);
                break;
            default:
                break;
        }

        if (resultEvent) {
            triggerDiplomaticEvent(resultEvent);
        }
    };

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

    const endWarWithNation = (nationId, extraUpdates = {}) => {
        setNations(prev => prev.map(n => {
            if (n.id !== nationId) return n;
            return {
                ...n,
                isAtWar: false,
                warScore: 0,
                warDuration: 0,
                enemyLosses: 0,
                peaceTreatyUntil: daysElapsed + 365,
                ...extraUpdates,
            };
        }));
    };

    const handleEnemyPeaceAccept = (nationId, proposalType, amount = 0) => {
        const targetNation = nations.find(n => n.id === nationId);
        if (!targetNation) return;

        const durationDays = INSTALLMENT_CONFIG?.DURATION_DAYS || 365;
        const basePopulation = targetNation.population || 0;
        const transferPopulation = Math.min(basePopulation, Math.max(0, Math.floor(amount || 0)));
        const paymentAmount = Math.max(0, Math.floor(amount || 0));

        if (proposalType === 'annex') {
            const populationGain = transferPopulation;
            if (populationGain > 0) {
                setPopulation(prev => prev + populationGain);
                setMaxPopBonus(prev => prev + populationGain);
            }

            endWarWithNation(nationId, {
                isAnnexed: true,
                annexedBy: 'player',
                annexedAt: daysElapsed,
                population: 0,
                wealth: 0,
            });

            const annexEvent = createNationAnnexedEvent(
                targetNation,
                populationGain,
                populationGain,
                'war_annex',
                () => {}
            );
            triggerDiplomaticEvent(annexEvent);
            addLog(`Annexed ${targetNation.name}.`);
            return;
        }

        if (proposalType === 'population') {
            if (transferPopulation > 0) {
                setPopulation(prev => prev + transferPopulation);
                setMaxPopBonus(prev => prev + transferPopulation);
            }
            endWarWithNation(nationId, {
                population: Math.max(10, basePopulation - transferPopulation),
            });
            addLog(`${targetNation.name} ceded ${transferPopulation} population.`);
            return;
        }

        if (proposalType === 'installment') {
            endWarWithNation(nationId, {
                installmentPayment: {
                    amount: paymentAmount,
                    remainingDays: durationDays,
                    totalAmount: paymentAmount * durationDays,
                    paidAmount: 0,
                },
            });
            addLog(`${targetNation.name} agreed to pay installments.`);
            return;
        }

        if (proposalType === 'open_market') {
            endWarWithNation(nationId, {
                openMarketUntil: daysElapsed + paymentAmount,
            });
            addLog(`${targetNation.name} opened its market.`);
            return;
        }

        if (paymentAmount > 0) {
            setResources(prev => ({ ...prev, silver: (prev.silver || 0) + paymentAmount }));
        }
        endWarWithNation(nationId, {
            wealth: Math.max(0, (targetNation.wealth || 0) - paymentAmount),
        });
        addLog(`${targetNation.name} paid ${paymentAmount} silver for peace.`);
    };

    const handleEnemyPeaceReject = (nationId) => {
        const targetNation = nations.find(n => n.id === nationId);
        if (!targetNation) return;
        setNations(prev => prev.map(n => {
            if (n.id !== nationId) return n;
            return { ...n, relation: Math.max(0, (n.relation || 0) - 5) };
        }));
        addLog(`Rejected peace request from ${targetNation.name}.`);
    };

    const handlePlayerPeaceProposal = (nationId, proposalType, amount = 0) => {
        const targetNation = nations.find(n => n.id === nationId);
        if (!targetNation) return;
        if (proposalType === 'cancel') {
            addLog(`Peace proposal to ${targetNation.name} canceled.`);
            return;
        }

        const warScore = targetNation.warScore || 0;
        const aggression = targetNation.aggression ?? 0.3;
        const durationDays = INSTALLMENT_CONFIG?.DURATION_DAYS || 365;
        const paymentAmount = Math.max(0, Math.floor(amount || 0));
        const currentPop = population || 0;

        const demandingTypes = new Set([
            'demand_annex',
            'demand_high',
            'demand_population',
            'demand_open_market',
            'demand_installment',
            'demand_standard',
        ]);
        const offeringTypes = new Set([
            'pay_high',
            'pay_standard',
            'pay_moderate',
            'pay_installment',
            'pay_installment_moderate',
            'offer_population',
        ]);

        let acceptChance = 0.4;
        if (warScore >= 300) acceptChance = 0.85;
        else if (warScore >= 150) acceptChance = 0.7;
        else if (warScore >= 50) acceptChance = 0.6;
        else if (warScore >= 0) acceptChance = 0.5;
        else if (warScore >= -50) acceptChance = 0.4;
        else if (warScore >= -150) acceptChance = 0.3;
        else acceptChance = 0.2;

        if (demandingTypes.has(proposalType)) {
            acceptChance *= warScore >= 50 ? 1.1 : 0.6;
        }
        if (offeringTypes.has(proposalType)) {
            acceptChance *= warScore < 0 ? 1.2 : 0.8;
        }
        if (proposalType === 'peace_only') {
            acceptChance *= warScore > 0 ? 0.7 : 0.5;
        }

        acceptChance *= (1 - aggression * 0.2);
        acceptChance = Math.min(0.95, Math.max(0.05, acceptChance));

        if (offeringTypes.has(proposalType)) {
            if (proposalType.startsWith('pay_')) {
                const currentSilver = resources?.silver || 0;
                if (currentSilver < paymentAmount) {
                    addLog(`Not enough silver to make the offer (${paymentAmount}).`);
                    return;
                }
            }
            if (proposalType === 'offer_population') {
                if ((population || 0) < paymentAmount + 10) {
                    addLog(`Not enough population to cede (${paymentAmount}).`);
                    return;
                }
            }
        }

        const accepted = Math.random() < acceptChance;
        if (!accepted) {
            setNations(prev => prev.map(n => {
                if (n.id !== nationId) return n;
                return { ...n, relation: Math.max(0, (n.relation || 0) - 5) };
            }));
            addLog(`${targetNation.name} rejected your peace proposal.`);
            return;
        }

        if (proposalType === 'demand_annex') {
            const basePopulation = targetNation.population || 0;
            const transferPopulation = Math.min(basePopulation, Math.max(0, Math.floor(amount || 0)));
            if (transferPopulation > 0) {
                setPopulation(prev => prev + transferPopulation);
                setMaxPopBonus(prev => prev + transferPopulation);
            }
            endWarWithNation(nationId, {
                isAnnexed: true,
                annexedBy: 'player',
                annexedAt: daysElapsed,
                population: 0,
                wealth: 0,
            });

            const annexEvent = createNationAnnexedEvent(
                targetNation,
                transferPopulation,
                transferPopulation,
                'war_annex',
                () => {}
            );
            triggerDiplomaticEvent(annexEvent);
            addLog(`Annexed ${targetNation.name}.`);
            return;
        }

        if (proposalType === 'demand_population') {
            const basePopulation = targetNation.population || 0;
            const transferPopulation = Math.min(basePopulation, paymentAmount);
            if (transferPopulation > 0) {
                setPopulation(prev => prev + transferPopulation);
                setMaxPopBonus(prev => prev + transferPopulation);
            }
            endWarWithNation(nationId, {
                population: Math.max(10, basePopulation - transferPopulation),
            });
            addLog(`${targetNation.name} ceded ${transferPopulation} population.`);
            return;
        }

        if (proposalType === 'demand_open_market') {
            endWarWithNation(nationId, {
                openMarketUntil: daysElapsed + paymentAmount,
            });
            addLog(`${targetNation.name} opened its market.`);
            return;
        }

        if (proposalType === 'demand_installment') {
            endWarWithNation(nationId, {
                installmentPayment: {
                    amount: paymentAmount,
                    remainingDays: durationDays,
                    totalAmount: paymentAmount * durationDays,
                    paidAmount: 0,
                },
            });
            addLog(`${targetNation.name} agreed to pay installments.`);
            return;
        }

        if (proposalType === 'demand_high' || proposalType === 'demand_standard') {
            if (paymentAmount > 0) {
                setResources(prev => ({ ...prev, silver: (prev.silver || 0) + paymentAmount }));
            }
            endWarWithNation(nationId, {
                wealth: Math.max(0, (targetNation.wealth || 0) - paymentAmount),
            });
            addLog(`${targetNation.name} paid ${paymentAmount} silver.`);
            return;
        }

        if (proposalType === 'pay_high' || proposalType === 'pay_standard' || proposalType === 'pay_moderate') {
            setResources(prev => ({ ...prev, silver: Math.max(0, (prev.silver || 0) - paymentAmount) }));
            endWarWithNation(nationId, {
                wealth: (targetNation.wealth || 0) + paymentAmount,
            });
            addLog(`Paid ${paymentAmount} silver to ${targetNation.name}.`);
            return;
        }

        if (proposalType === 'pay_installment' || proposalType === 'pay_installment_moderate') {
            if (typeof setPlayerInstallmentPayment === 'function') {
                setPlayerInstallmentPayment({
                    nationId: targetNation.id,
                    amount: paymentAmount,
                    remainingDays: durationDays,
                    totalAmount: paymentAmount * durationDays,
                    paidAmount: 0,
                });
            }
            endWarWithNation(nationId);
            addLog(`Agreed to pay installments to ${targetNation.name}.`);
            return;
        }

        if (proposalType === 'offer_population') {
            setPopulation(prev => Math.max(10, prev - paymentAmount));
            setMaxPopBonus(prev => Math.max(-currentPop + 10, prev - paymentAmount));
            endWarWithNation(nationId, {
                population: (targetNation.population || 0) + paymentAmount,
            });
            addLog(`Ceded ${paymentAmount} population to ${targetNation.name}.`);
            return;
        }

        if (proposalType === 'peace_only') {
            endWarWithNation(nationId);
            addLog(`Peace signed with ${targetNation.name}.`);
        }
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

        // 政令
        toggleDecree,

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
