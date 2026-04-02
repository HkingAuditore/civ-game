// 游戏操作钩子
// 包含所有游戏操作函数，如建造建筑、研究科技、升级时代等

import { useState, useEffect, useRef, useMemo } from 'react';
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
    createPeaceProposalRejectedEvent,
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
    TREATY_CONFIGS,
    calculateTreatySigningCost,
    getTreatyDailyMaintenance,
    VASSAL_TYPE_CONFIGS,
    VASSAL_TYPE_LABELS,
} from '../config';
import { getBuildingCostGrowthFactor, getBuildingCostBaseMultiplier, getTechCostMultiplier, getBuildingUpgradeCostMultiplier, getAIMilitaryStrengthMultiplier } from '../config/difficulty';
import { debugLog } from '../utils/debugFlags';
import { getUpgradeCountAtOrAboveLevel, calculateBuildingCost, applyBuildingCostModifier, areUpgradeInputsUnlocked } from '../utils/buildingUpgradeUtils';
import { simulateBattle, calculateBattlePower, calculateNationBattlePower, generateNationArmy } from '../config';
import { calculateForeignPrice, calculateTradeStatus } from '../utils/foreignTrade';
import { generateSound, SOUND_TYPES } from '../config/sounds';
import { getEnemyUnitsForEpoch, calculateProportionalLoot } from '../config/militaryActions';
import { isResourceUnlocked } from '../utils/resources';
import { calculateDynamicGiftCost, calculateProvokeCost, INSTALLMENT_CONFIG } from '../utils/diplomaticUtils';
import { applyWarRelationCap } from '../utils/diplomacyUtils';
import { filterEventEffects } from '../utils/eventEffectFilter';
import {
    clampPopulationAtFloor,
    reducePopulationWithFloor,
} from '../utils/populationClamp';
import { calculateNegotiationAcceptChance, generateCounterProposal, canAffordStance, NEGOTIATION_STANCES } from '../logic/diplomacy/negotiation';
import { generateFront, getEffectiveFrontWarScore } from '../logic/diplomacy/frontSystem';
import {
    trackBuyBuilding, trackSellBuilding, trackUpgradeBuilding,
    trackDowngradeBuilding, trackBatchUpgradeBuilding, trackBatchDowngradeBuilding,
    trackResearchTech, trackEpochUpgrade, trackDiplomacy,
    trackRecruit, trackBattleLaunch, trackBattleResult, trackDecreeToggle,
    trackResourceSink, trackOfficialHire, trackOfficialFire,
    trackOfficialSalary, trackMinisterAssign,
    trackProgressionComplete, trackProgressionStart, trackDisband,
    trackDisbandAll, trackCancelTraining, trackCancelAllTraining,
    trackManualGather, trackEventChoice, trackRebellionAction,
    trackVassalApprove, trackVassalReject, trackVassalOrder,
    trackPeaceAccept, trackPeaceReject, trackPeacePropose,
    trackTradeRouteMode, trackCoalitionChange,
} from '../analytics/gaTracker';
import { setDimensions } from '../analytics/gaInit';
// 外交叛乱干预系统
import { executeIntervention, INTERVENTION_OPTIONS } from '../logic/diplomacy/rebellionSystem';
// 内部叛乱系统
import {
    processRebellionAction,
    createInvestigationResultEvent,
    createArrestResultEvent,
    createSuppressionResultEvent,
    createRebellionEndEvent,
} from '../logic/rebellionSystem';
import { getOrganizationStage, getPhaseFromStage } from '../logic/organizationSystem';
import { ORGANIZATION_TYPE_CONFIGS, createOrganization, getOrganizationMaxMembers } from '../logic/diplomacy/organizationDiplomacy';
import { getLegacyPolicyDecrees } from '../logic/officials/cabinetSynergy';
import {
    triggerSelection,
    hireOfficial,
    fireOfficial,
    isSelectionAvailable,
    disposeOfficial,
    switchPropertyPolicy,
    getAggregatedOfficialEffects,
} from '../logic/officials/manager';
import { MINISTER_ROLES, MINISTER_LABELS, ECONOMIC_MINISTER_ROLES } from '../logic/officials/ministers';
import { requestExpeditionaryForce, requestWarParticipation } from '../logic/diplomacy/vassalSystem';
import { demandVassalInvestment } from '../logic/diplomacy/overseasInvestment';
import { calculateReputationChange, calculateNaturalRecovery } from '../config/reputationSystem';
import { BUILDING_CHAINS } from '../config/buildingChains';
import { ideologyEventBus, IDEOLOGY_EVENTS } from '../logic/ideology/ideologyEventBus';
import { IDEOLOGY_SCORE_TRIGGERS } from '../config/ideologies';
import { getEpochTechRequirementStatus, getEpochScaleMultiplier } from '../utils/epochUpgrade';

const getCompletedChainIds = (buildingState = {}) => {
    if (!BUILDING_CHAINS || typeof BUILDING_CHAINS !== 'object') return [];
    return Object.entries(BUILDING_CHAINS)
        .filter(([, chain]) => Array.isArray(chain?.buildings) && chain.buildings.length > 0)
        .filter(([, chain]) => chain.buildings.every((buildingId) => (buildingState?.[buildingId] || 0) > 0))
        .map(([chainId]) => chainId);
};

const applyCooldownModifier = (baseDays, modifier = 0) => {
    if (!Number.isFinite(baseDays) || baseDays <= 0) return baseDays;
    const normalizedModifier = Number.isFinite(modifier) ? modifier : 0;
    return Math.max(1, Math.round(baseDays * (1 + normalizedModifier)));
};


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
        militaryPower,
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
        diplomacyOrganizations,
        setDiplomacyOrganizations,
        vassalDiplomacyQueue,
        setVassalDiplomacyQueue,
        setVassalDiplomacyHistory,
        overseasInvestments,
        setOverseasInvestments,
        foreignInvestments,
        setForeignInvestments,
        foreignInvestmentPolicy,
        setForeignInvestmentPolicy,
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
        setModifiers,
        productionPerDay,
        militaryCorps, // [FIX Bug9] 读取军团状态用于兵力统计
        generals,
        setGenerals,
        setMilitaryCorps,
        setActiveBattles,
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
        setMinisterAssignments,
        setMinisterAutoExpansion,
        // 阶层影响力
        classInfluence,
        lastBattleTargetId,
        setLastBattleTargetId,
        lastBattleDay,
        setLastBattleDay,
        setPlayerInstallmentPayment,
        // Ruling coalition for political demands
        rulingCoalition,
        setRulingCoalition,
        // Diplomatic reputation
        diplomaticReputation,
        setDiplomaticReputation,
        // Front system
        activeFronts,
        setActiveFronts,
        // Corps replenish queue
        corpsReplenishQueue,
        setCorpsReplenishQueue,
        // Pending Actions Queue（tick-action 竞争条件修复）
        pendingActionsRef,
    } = gameState;

    // 用 ref 追踪最新值，防止连续快速调用时读到陈旧闭包
    const _resourcesRef = useRef(resources);
    _resourcesRef.current = resources;
    const _buildingsRef = useRef(buildings);
    _buildingsRef.current = buildings;
    const _buildingUpgradesRef = useRef(buildingUpgrades);
    _buildingUpgradesRef.current = buildingUpgrades;

    const setResourcesWithReason = (updater, reason, meta = null) => {
        let nextMeta = meta;
        if (nextMeta && typeof nextMeta === 'object') {
            nextMeta = {
                ...nextMeta,
                day: Number.isFinite(nextMeta.day) ? nextMeta.day : (gameState.daysElapsed || 0),
                source: nextMeta.source || 'action',
            };
        } else if (nextMeta == null) {
            nextMeta = { day: gameState.daysElapsed || 0, source: 'action' };
        }
        setResources(updater, { reason, meta: nextMeta });
    };

    const setClassWealthWithReason = (updater, reason, meta = null) => {
        setClassWealth(updater, { reason, meta });
    };

    const updateOrganizationsState = (updater) => {
        if (typeof setDiplomacyOrganizations !== 'function') return;
        setDiplomacyOrganizations(prev => {
            const current = prev && typeof prev === 'object' ? prev : { organizations: [] };
            const nextOrgs = updater(Array.isArray(current.organizations) ? current.organizations : []);
            return { ...current, organizations: nextOrgs };
        });
    };

    // Helper: create a front when war starts between player and a nation
    const createFrontForWar = (attackerId, defenderId, targetNation) => {
        if (typeof setActiveFronts !== 'function') return;
        const playerEco = {
            resources: resources || {},
            buildings: buildings || {},
            population: population || 0,
            wealth: (resources?.silver || 0),
        };
        const enemyEco = {
            resources: {},
            buildings: {},
            population: targetNation?.population || targetNation?.militaryPower || 200,
            wealth: targetNation?.wealth || 500,
        };
        const front = generateFront(attackerId, defenderId, epoch, playerEco, enemyEco);
        front.createdDay = daysElapsed;
        front.startDay = daysElapsed;
        setActiveFronts(prev => {
            const existing = Array.isArray(prev) ? prev : [];
            // Avoid duplicate fronts for the same war
            const warId = front.warId;
            const altWarId = `${defenderId}_vs_${attackerId}`;
            if (existing.some(f => f.status === 'active' && (f.warId === warId || f.warId === altWarId))) {
                return existing;
            }
            return [...existing, front];
        });
    };

    const pushVassalDiplomacyHistory = (entry) => {
        if (typeof setVassalDiplomacyHistory !== 'function') return;
        setVassalDiplomacyHistory(prev => {
            const history = Array.isArray(prev) ? prev : [];
            return [entry, ...history].slice(0, 120);
        });
    };

    const resolveVassalDiplomacyRequest = (requestId, status, extra = {}) => {
        if (!requestId || typeof setVassalDiplomacyQueue !== 'function') return;
        let resolvedItem = null;
        setVassalDiplomacyQueue(prev => {
            const items = Array.isArray(prev) ? prev : [];
            const next = items.filter(item => item?.id !== requestId);
            resolvedItem = items.find(item => item?.id === requestId) || null;
            return next;
        });
        if (resolvedItem) {
            if (resolvedItem.actionType === 'propose_peace' && resolvedItem.targetId) {
                setNations(prev => prev.map(n => {
                    if (n.id !== resolvedItem.vassalId && n.id !== resolvedItem.targetId) return n;
                    const enemyId = n.id === resolvedItem.vassalId ? resolvedItem.targetId : resolvedItem.vassalId;
                    const foreignWars = { ...(n.foreignWars || {}) };
                    if (foreignWars[enemyId]) {
                        foreignWars[enemyId] = {
                            ...foreignWars[enemyId],
                            pendingPeaceApproval: false,
                        };
                    }
                    return { ...n, foreignWars };
                }));
            }
            pushVassalDiplomacyHistory({
                ...resolvedItem,
                status,
                resolvedDay: daysElapsed,
                ...extra,
            });
        }
    };

    const executeVassalDiplomacyAction = (request) => {
        if (!request) return { success: false, message: '无效的外交请求' };
        const vassal = nations.find(n => n.id === request.vassalId);
        const target = request.targetId ? nations.find(n => n.id === request.targetId) : null;
        if (!vassal) return { success: false, message: '附庸不存在' };

        // [FIX] Annexed vassals cannot perform diplomatic actions
        if (vassal.isAnnexed) return { success: false, message: '附庸已被吞并，无法执行外交行动' };

        // [FIX] Cannot target annexed nations
        if (target && target.isAnnexed) return { success: false, message: '目标国家已被吞并' };

        switch (request.actionType) {
            case 'trade': {
                if (!target) return { success: false, message: '目标国家不存在' };
                if (vassal.isAtWar || target.isAtWar) {
                    return { success: false, message: '战争状态无法贸易' };
                }
                const tradeValue = Math.floor(request.payload?.tradeValue || (20 + Math.random() * 60));
                setNations(prev => prev.map(n => {
                    if (n.id === vassal.id || n.id === target.id) {
                        const relationKey = n.id === vassal.id ? target.id : vassal.id;
                        const nextRelations = { ...(n.foreignRelations || {}) };
                        nextRelations[relationKey] = Math.min(100, (nextRelations[relationKey] || 50) + 1);
                        return {
                            ...n,
                            wealth: (n.wealth || 0) + tradeValue * 0.05,
                            foreignRelations: nextRelations,
                        };
                    }
                    return n;
                }));
                addLog(`🧾 ${vassal.name} 与 ${target.name} 完成贸易协定（宗主批准）。`);
                return { success: true };
            }
            case 'declare_war': {
                if (!target) return { success: false, message: '目标国家不存在' };
                setNations(prev => prev.map(n => {
                    if (n.id === vassal.id) {
                        const foreignWars = { ...(n.foreignWars || {}) };
                        foreignWars[target.id] = { isAtWar: true, warStartDay: daysElapsed, warScore: 0 };
                        return { ...n, foreignWars };
                    }
                    if (n.id === target.id) {
                        const foreignWars = { ...(n.foreignWars || {}) };
                        foreignWars[vassal.id] = { isAtWar: true, warStartDay: daysElapsed, warScore: 0 };
                        return { ...n, foreignWars };
                    }
                    return n;
                }));
                addLog(`⚔️ ${vassal.name} 向 ${target.name} 宣战（宗主批准）。`);
                return { success: true };
            }
            case 'propose_peace': {
                if (!target) return { success: false, message: '目标国家不存在' };
                setNations(prev => prev.map(n => {
                    if (n.id === vassal.id) {
                        const foreignWars = { ...(n.foreignWars || {}) };
                        if (foreignWars[target.id]) {
                            foreignWars[target.id] = {
                                ...foreignWars[target.id],
                                isAtWar: false,
                                peaceTreatyUntil: daysElapsed + 365,
                                pendingPeaceApproval: false,
                            };
                        }
                        return { ...n, foreignWars };
                    }
                    if (n.id === target.id) {
                        const foreignWars = { ...(n.foreignWars || {}) };
                        if (foreignWars[vassal.id]) {
                            foreignWars[vassal.id] = {
                                ...foreignWars[vassal.id],
                                isAtWar: false,
                                peaceTreatyUntil: daysElapsed + 365,
                                pendingPeaceApproval: false,
                            };
                        }
                        return { ...n, foreignWars };
                    }
                    return n;
                }));
                addLog(`🕊️ ${vassal.name} 与 ${target.name} 结束战争（宗主批准）。`);
                return { success: true };
            }
            case 'join_org':
            case 'join_alliance': {
                const orgId = request.payload?.orgId;
                if (!orgId) return { success: false, message: '组织不存在' };
                updateOrganizationsState(orgs => {
                    return orgs.map(org => {
                        if (org.id !== orgId) return org;
                        const maxMembers = getOrganizationMaxMembers(org.type, epoch);
                        const members = Array.isArray(org.members) ? org.members : [];
                        if (members.includes(vassal.id) || members.length >= maxMembers) return org;
                        return { ...org, members: [...members, vassal.id] };
                    });
                });
                addLog(`🏛️ ${vassal.name} 加入了组织（宗主批准）。`);
                return { success: true };
            }
            case 'leave_org': {
                const orgId = request.payload?.orgId;
                if (!orgId) return { success: false, message: '组织不存在' };
                updateOrganizationsState(orgs => {
                    return orgs.map(org => {
                        if (org.id !== orgId) return org;
                        const members = Array.isArray(org.members) ? org.members : [];
                        if (!members.includes(vassal.id)) return org;
                        return { ...org, members: members.filter(id => id !== vassal.id) };
                    });
                });
                addLog(`🏛️ ${vassal.name} 退出了组织（宗主批准）。`);
                return { success: true };
            }
            case 'create_alliance':
            case 'create_economic_bloc': {
                const orgType = request.actionType === 'create_alliance' ? 'military_alliance' : 'economic_bloc';
                const orgName = request.payload?.orgName || `${vassal.name}同盟`;
                const createResult = createOrganization({
                    type: orgType,
                    founderId: vassal.id,
                    founderName: vassal.name,
                    name: orgName,
                    epoch,
                    daysElapsed,
                });
                if (!createResult.success) {
                    return { success: false, message: createResult.reason || '无法创建组织' };
                }
                updateOrganizationsState(orgs => [...orgs, createResult.organization]);
                if (target) {
                    updateOrganizationsState(orgs => orgs.map(org => {
                        if (org.id !== createResult.organization.id) return org;
                        const members = Array.isArray(org.members) ? org.members : [];
                        if (members.includes(target.id)) return org;
                        return { ...org, members: [...members, target.id] };
                    }));
                }
                addLog(`🏛️ ${vassal.name} 组建新组织（宗主批准）。`);
                return { success: true };
            }
            default:
                return { success: false, message: '未知外交类型' };
        }
    };

    const approveVassalDiplomacyAction = (requestId) => {
        const request = (vassalDiplomacyQueue || []).find(item => item?.id === requestId);
        if (!request) return;
        trackVassalApprove(request.actionType, request.vassalId);
        const result = executeVassalDiplomacyAction(request);
        if (result.success) {
            resolveVassalDiplomacyRequest(requestId, 'approved');
        } else {
            resolveVassalDiplomacyRequest(requestId, 'rejected', { failureReason: result.message });
            if (result.message) addLog(`⚠️ 附庸外交失败：${result.message}`);
        }
    };

    const rejectVassalDiplomacyAction = (requestId, reason = 'rejected') => {
        const request = (vassalDiplomacyQueue || []).find(item => item?.id === requestId);
        trackVassalReject(request?.actionType || 'unknown', request?.vassalId);
        resolveVassalDiplomacyRequest(requestId, 'rejected', { failureReason: reason });
        if (reason) addLog(`🛑 已拒绝附庸外交请求：${reason}`);
    };

    const issueVassalDiplomacyOrder = (vassalId, actionType, payload = {}) => {
        const vassal = nations.find(n => n.id === vassalId);
        if (!vassal) {
            addLog('无法下达指令：附庸不存在');
            return;
        }
        trackVassalOrder(actionType, vassalId);

        // [FIX] Cannot issue orders to annexed vassals
        if (vassal.isAnnexed) {
            addLog('无法下达指令：附庸已被吞并');
            return;
        }

        const control = vassal.vassalPolicy?.diplomaticControl || 'guided';
        if (control === 'autonomous') {
            addLog(`${vassal.name} 处于自主外交，无法直接下达指令。`);
            return;
        }
        const target = payload?.targetId ? nations.find(n => n.id === payload.targetId) : null;
        const request = {
            id: `vassal_order_${daysElapsed}_${Math.random().toString(36).slice(2, 8)}`,
            vassalId,
            vassalName: vassal.name,
            targetId: payload?.targetId || null,
            targetName: target?.name,
            actionType,
            payload,
            createdDay: daysElapsed,
            source: 'player',
        };
        const result = executeVassalDiplomacyAction(request);
        if (!result.success) {
            if (result.message) addLog(`⚠️ 附庸指令失败：${result.message}`);
            return;
        }
        pushVassalDiplomacyHistory({
            ...request,
            status: 'ordered',
            resolvedDay: daysElapsed,
        });
    };

    const toggleDecree = (decreeId) => {
        if (!decreeId || typeof setDecrees !== 'function') return;
        trackDecreeToggle(decreeId);

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
            setPendingDiplomaticEvents(prev => {
                const next = [...prev, event];
                return next.length > 50 ? next.slice(-50) : next;
            });
            return;
        }
        // 事件弹出时自动暂停游戏，保存触发前的暂停状态
        if (typeof gameState.setPausedBeforeEvent === 'function') {
            gameState.setPausedBeforeEvent(gameState.isPaused);
        }
        if (typeof gameState.setIsPaused === 'function') {
            gameState.setIsPaused(true);
        }
        setCurrentEvent(event);
        setEventHistory(prev => {
            const next = [...(prev || []), event.id];
            return next.length > 200 ? next.slice(-200) : next;
        });
    };

    const triggerDiplomaticEvent = (event) => {
        launchDiplomaticEvent(event);
    };

    const collectWarFrontIdsForNation = (nationId, fronts = activeFronts) => {
        if (!nationId || !Array.isArray(fronts)) return [];
        return fronts
            .filter(f => f && (
                (f.attackerId === nationId && f.defenderId === 'player')
                || (f.attackerId === 'player' && f.defenderId === nationId)
            ))
            .map(f => f.id);
    };

    const cleanupWarRuntimeState = (nationId, reason = 'peace_treaty') => {
        if (!nationId) return;
        const frontIds = collectWarFrontIdsForNation(nationId, activeFronts || []);

        if (typeof setActiveFronts === 'function') {
            setActiveFronts(prev => {
                if (!Array.isArray(prev)) return prev;
                return prev.map(front => {
                    if (!front || front.status !== 'active') return front;
                    const involves = (
                        (front.attackerId === nationId && front.defenderId === 'player')
                        || (front.attackerId === 'player' && front.defenderId === nationId)
                    );
                    return involves ? { ...front, status: 'collapsed' } : front;
                });
            });
        }

        if (typeof setActiveBattles === 'function') {
            setActiveBattles(prev => {
                if (!Array.isArray(prev)) return prev;
                return prev.map(battle => {
                    if (!battle || battle.status !== 'active') return battle;
                    if (!frontIds.includes(battle.frontId)) return battle;
                    return {
                        ...battle,
                        status: 'ended',
                        result: {
                            ...(battle.result || {}),
                            reason,
                            finalized: true,
                            winner: battle.result?.winner || 'attacker',
                            totalRounds: battle.result?.totalRounds || battle.currentRound || 0,
                        },
                    };
                });
            });
        }

        if (typeof setMilitaryCorps === 'function') {
            setMilitaryCorps(prev => {
                if (!Array.isArray(prev)) return prev;
                return prev.map(corps => {
                    if (!corps || corps.isAI) return corps;
                    const isOnEndedWarFront = frontIds.includes(corps.assignedFrontId);
                    const isOrphanDeployed = corps.status === 'deployed' && !corps.assignedFrontId;
                    if (!isOnEndedWarFront && !isOrphanDeployed) return corps;
                    return {
                        ...corps,
                        status: 'idle',
                        assignedFrontId: null,
                    };
                });
            });
        }
    };

    const startWarAgainstPlayer = (aggressorId, meta = {}) => {
        const aggressor = (nations || []).find(n => n.id === aggressorId);
        if (!aggressor) return null;

        setNations(prev => prev.map(n => {
            if (n.id !== aggressorId) return n;
            return {
                ...n,
                isAtWar: true,
                warStartDay: daysElapsed,
                warDuration: 0,
                warScore: n.warScore ?? 0,
                warReason: meta.reason || n.warReason || 'normal',
                lastMilitaryActionDay: undefined,
            };
        }));

        createFrontForWar(aggressorId, 'player', aggressor);

        if (meta.showEvent !== false) {
            const event = createWarDeclarationEvent(aggressor, () => { }, { reason: meta.reason || 'normal', ...meta });
            triggerDiplomaticEvent(event);
        }

        if (meta.logMessage) {
            addLog(meta.logMessage);
        }
        return aggressor;
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
            : [];

        const eventToLaunch = {
            ...randomEvent,
            options: resolvedOptions,
        };
        launchDiplomaticEvent(eventToLaunch);
    };

    const getVisibleNations = () => (nations || []).filter(n => {
        if (!n || n.visible === false) return false;
        if (n.isAnnexed) return false; // 排除已被吞并的国家
        const appearEpoch = n.appearEpoch ?? 0;
        const expireEpoch = n.expireEpoch;
        if (epoch < appearEpoch) return false;
        if (expireEpoch != null && epoch > expireEpoch) return false;
        return true;
    });

    const isPlayerProtectedEventNation = (nation) => {
        if (!nation || nation.id === 'player') return true;
        if (nation.vassalOf === 'player') return true;
        if (nation.alliedWithPlayer === true) return true;

        const organizations = Array.isArray(diplomacyOrganizations?.organizations)
            ? diplomacyOrganizations.organizations
            : [];
        return organizations.some(org => {
            if (!org || org.type !== 'military_alliance' || org.isActive === false) return false;
            const members = Array.isArray(org.members) ? org.members : [];
            return members.includes('player') && members.includes(nation.id);
        });
    };

    const selectNationBySelector = (selector, visibleNations, options = {}) => {
        const { excludePlayerProtected = false } = options;
        const pool = excludePlayerProtected
            ? visibleNations.filter(n => !isPlayerProtectedEventNation(n))
            : visibleNations;

        if (!selector) return null;
        if (selector === 'random') {
            if (pool.length === 0) return null;
            return pool[Math.floor(Math.random() * pool.length)];
        }
        if (selector === 'strongest') {
            return pool.reduce((best, n) => (!best || (n.wealth || 0) > (best.wealth || 0) ? n : best), null);
        }
        if (selector === 'weakest') {
            return pool.reduce((best, n) => (!best || (n.wealth || 0) < (best.wealth || 0) ? n : best), null);
        }
        if (selector === 'hostile') {
            const hostile = pool.filter(n => (n.relation || 0) < 30);
            if (hostile.length === 0) return null;
            return hostile[Math.floor(Math.random() * hostile.length)];
        }
        if (selector === 'friendly') {
            const friendly = pool.filter(n => (n.relation || 0) >= 60);
            if (friendly.length === 0) return null;
            return friendly[Math.floor(Math.random() * friendly.length)];
        }
        return pool.find(n => n.id === selector) || null;
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
        let allocatedChange = 0;
        let maxStratum = null;
        let maxStratumValue = -1;
        
        Object.entries(currentStructure).forEach(([key, value]) => {
            const share = totalStructure > 0 ? (Number(value) || 0) / totalStructure : 0;
            const deltaForStratum = Math.round(change * share);
            nextStructure[key] = Math.max(0, (Number(value) || 0) + deltaForStratum);
            allocatedChange += deltaForStratum;
            
            // Track the largest stratum for rounding correction
            if ((Number(value) || 0) > maxStratumValue) {
                maxStratumValue = Number(value) || 0;
                maxStratum = key;
            }
        });
        
        // [FIX] Correct rounding error: ensure the sum of changes equals the target change
        const roundingError = change - allocatedChange;
        if (roundingError !== 0 && maxStratum) {
            nextStructure[maxStratum] = Math.max(0, nextStructure[maxStratum] + roundingError);
        }
        
        setPopStructure(nextStructure);
    };

    const applyEventEffects = (effects = {}) => {
        if (!effects || typeof effects !== 'object') return;
        const filtered = filterEventEffects(effects, epoch, techsUnlocked) || {};

        if (filtered.resources && typeof filtered.resources === 'object') {
            setResourcesWithReason(prev => {
                const next = { ...prev };
                Object.entries(filtered.resources).forEach(([key, value]) => {
                    if (typeof value !== 'number') return;
                    next[key] = Math.max(0, (next[key] || 0) + value);
                });
                return next;
            }, 'event_effects_resource');
        }

        if (filtered.resourcePercent && typeof filtered.resourcePercent === 'object') {
            setResourcesWithReason(prev => {
                const next = { ...prev };
                Object.entries(filtered.resourcePercent).forEach(([key, percent]) => {
                    if (typeof percent !== 'number') return;
                    const base = next[key] || 0;
                    const delta = Math.floor(base * percent);
                    next[key] = Math.max(0, base + delta);
                });
                return next;
            }, 'event_effects_resource_percent');
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
                        ...(Array.isArray(prev?.approval) ? prev.approval : []),
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
                        ...(Array.isArray(prev?.stability) ? prev.stability : []),
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
                        ...(Array.isArray(prev?.resourceDemand) ? prev.resourceDemand : []),
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
                        ...(Array.isArray(prev?.stratumDemand) ? prev.stratumDemand : []),
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
                        ...(Array.isArray(prev?.buildingProduction) ? prev.buildingProduction : []),
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

                const applyNationDelta = (map, key, clampMin = null, clampMax = null, options = {}) => {
                    if (!map || typeof map !== 'object') return;
                    const { excludePlayerProtected = false } = options;
                    if (excludePlayerProtected && isPlayerProtectedEventNation(nation)) return;

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
                        const picked = selectNationBySelector(selector, visible, { excludePlayerProtected });
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
                    applyNationDelta(filtered.nationRelation, 'relation', 0, 100, { excludePlayerProtected: true });
                }
                if (filtered.nationAggression) {
                    applyNationDelta(filtered.nationAggression, 'aggression', 0, 1, { excludePlayerProtected: true });
                }
                if (filtered.nationWealth) {
                    applyNationDelta(filtered.nationWealth, 'wealth', 0, null, { excludePlayerProtected: true });
                }
                if (filtered.nationMarketVolatility) {
                    applyNationDelta(filtered.nationMarketVolatility, 'marketVolatility', 0, 1, { excludePlayerProtected: true });
                }

                return nextNation;
            }));

            const triggerWarTarget = filtered.triggerWar;
            if (triggerWarTarget) {
                const targetNation = selectNationBySelector(triggerWarTarget, visible, { excludePlayerProtected: true });
                if (targetNation) {
                    startWarAgainstPlayer(targetNation.id, {
                        reason: 'event',
                        logMessage: `⚔️ ${targetNation.name} 对你宣战！`,
                    });
                }
            }

            const triggerPeaceTarget = filtered.triggerPeace;
            if (triggerPeaceTarget) {
                const targetNation = selectNationBySelector(triggerPeaceTarget, visible, { excludePlayerProtected: true });
                if (targetNation) {
                    endWarWithNation(targetNation.id, {
                        peaceTreatyUntil: daysElapsed + 365,
                    }, {
                        cleanupRuntime: true,
                        cleanupReason: 'event_peace',
                    });
                }
            }
        }

        // Handle modifyCoalition effect (for political demand events)
        if (filtered.modifyCoalition && typeof filtered.modifyCoalition === 'object') {
            const { addToCoalition, removeFromCoalition } = filtered.modifyCoalition;

            if (addToCoalition && typeof setRulingCoalition === 'function') {
                const currentCoalition = Array.isArray(rulingCoalition) ? rulingCoalition : [];
                if (!currentCoalition.includes(addToCoalition)) {
                    const nextCoalition = [...currentCoalition, addToCoalition];
                    setRulingCoalition(nextCoalition);
                    trackCoalitionChange(nextCoalition.length);
                }
            }

            if (removeFromCoalition && typeof setRulingCoalition === 'function') {
                const currentCoalition = Array.isArray(rulingCoalition) ? rulingCoalition : [];
                if (currentCoalition.includes(removeFromCoalition)) {
                    const nextCoalition = currentCoalition.filter(stratum => stratum !== removeFromCoalition);
                    setRulingCoalition(nextCoalition);
                    trackCoalitionChange(nextCoalition.length);
                }
            }
        }
    };

    const handleEventOption = (eventId, option) => {
        const current = currentEvent && currentEvent.id === eventId ? currentEvent : null;
        const fallback = current || EVENTS.find(evt => evt.id === eventId);
        const selected = option || {};
        trackEventChoice(eventId, selected.id || 0);

        const effectSummary = [];

        if (selected.effects) {
            const eff = filterEventEffects(selected.effects, epoch, techsUnlocked) || {};
            applyEventEffects(selected.effects);
            // 收集确定效果摘要
            if (eff.resources) {
                Object.entries(eff.resources).forEach(([k, v]) => {
                    if (typeof v === 'number' && v !== 0) {
                        const name = RESOURCES[k]?.name || k;
                        effectSummary.push(`${name} ${v > 0 ? '+' : ''}${v}`);
                    }
                });
            }
            if (eff.resourcePercent) {
                Object.entries(eff.resourcePercent).forEach(([k, v]) => {
                    if (typeof v === 'number' && v !== 0) {
                        const name = RESOURCES[k]?.name || k;
                        effectSummary.push(`${name} ${v > 0 ? '+' : ''}${(v * 100).toFixed(0)}%`);
                    }
                });
            }
            if (typeof eff.population === 'number' && eff.population !== 0) effectSummary.push(`人口 ${eff.population > 0 ? '+' : ''}${eff.population}`);
            if (typeof eff.stability === 'number' && eff.stability !== 0) effectSummary.push(`稳定度 ${eff.stability > 0 ? '+' : ''}${eff.stability}`);
            if (eff.approval) {
                Object.entries(eff.approval).forEach(([k, v]) => {
                    if (typeof v === 'number' && v !== 0) effectSummary.push(`${k}满意度 ${v > 0 ? '+' : ''}${v}`);
                });
            }
        }

        if (Array.isArray(selected.randomEffects)) {
            selected.randomEffects.forEach(effect => {
                if (!effect || typeof effect !== 'object') return;
                const chance = typeof effect.chance === 'number' ? effect.chance : 0;
                const desc = effect.description || `概率事件(${(chance * 100).toFixed(0)}%)`;
                if (Math.random() <= chance) {
                    applyEventEffects(effect.effects || {});
                    effectSummary.push(`✓ ${desc} → 触发成功`);
                } else {
                    effectSummary.push(`✗ ${desc} → 未触发`);
                }
            });
        }

        // 将效果摘要通过返回值传递给 App.jsx 的日志
        if (effectSummary.length > 0) {
            addLog(`📋 事件效果：${effectSummary.join('；')}`);
        }

        if (typeof selected.callback === 'function') {
            selected.callback();
        }

        if (current) {
            setEventHistory(prev => {
                const next = [...(prev || []), current.id];
                return next.length > 200 ? next.slice(-200) : next;
            });
        } else if (fallback?.id) {
            setEventHistory(prev => {
                const next = [...(prev || []), fallback.id];
                return next.length > 200 ? next.slice(-200) : next;
            });
        }

        if (Array.isArray(pendingDiplomaticEvents) && pendingDiplomaticEvents.length > 0) {
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

    // [FIX Bug9] 统计所有军事单位：散兵 + 训练队列 + 军团内单位
    const getTotalArmyCount = (armyState = army, queueState = militaryQueue) => {
        const armyCount = Object.values(armyState || {}).reduce((sum, count) => sum + (count || 0), 0);
        const queueCount = Array.isArray(queueState) ? queueState.length : 0;
        let corpsCount = 0;
        if (Array.isArray(militaryCorps)) {
            for (const corps of militaryCorps) {
                if (corps?.isAI) continue;
                corpsCount += Object.values(corps?.units || {}).reduce((sum, c) => sum + (c || 0), 0);
            }
        }
        return armyCount + queueCount + corpsCount;
    };

    const handleAutoReplenishLosses = (losses = {}, options = {}) => {
        if (!autoRecruitEnabled) return;
        if (!losses || Object.keys(losses).length === 0) return;

        // If corpsLosses provided, write to corpsReplenishQueue
        if (options.corpsLosses && typeof setCorpsReplenishQueue === 'function') {
            setCorpsReplenishQueue(prev => {
                const next = { ...prev };
                for (const [corpsId, unitLosses] of Object.entries(options.corpsLosses)) {
                    if (!next[corpsId]) next[corpsId] = {};
                    for (const [unitId, loss] of Object.entries(unitLosses)) {
                        if (loss > 0) {
                            next[corpsId][unitId] = (next[corpsId][unitId] || 0) + loss;
                        }
                    }
                }
                return next;
            });
        }

        const capacity = getMilitaryCapacity();

        // [FIX] 如果容量为0，直接返回，防止无限招兵
        if (capacity <= 0) {
            debugLog('gameLoop', `[AUTO_REPLENISH] Failed: No military capacity (capacity=0)`);
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
            return;
        }

        setResourcesWithReason(prev => {
            const next = { ...prev };
            next.silver = Math.max(0, (next.silver || 0) - totalSilverCost);
            Object.entries(totalResourceCost).forEach(([res, amount]) => {
                next[res] = Math.max(0, (next[res] || 0) - amount);
            });
            return next;
        }, 'auto_replenish_cost');

        const replenishItems = [];
        Object.entries(replenishCounts).forEach(([unitId, count]) => {
            const unit = UNIT_TYPES[unitId];
            if (!unit) return;
            const trainingSpeedBonus = modifiers?.ministerEffects?.militaryTrainingSpeed || 0;
            const trainingMultiplier = Math.max(0.5, 1 - trainingSpeedBonus);
            const baseTrainTime = unit.trainingTime || unit.trainDays || 1;
            const trainTime = Math.max(1, Math.ceil(baseTrainTime * trainingMultiplier));
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
        const techRequirement = getEpochTechRequirementStatus(epoch, techsUnlocked);

        // 检查升级要求
        if (nextEpoch.req.science && resources.science < nextEpoch.req.science) return false;
        if (nextEpoch.req.population && population < nextEpoch.req.population) return false;
        if (nextEpoch.req.culture && resources.culture < nextEpoch.req.culture) return false;
        if (!techRequirement.isTechRequirementMet) return false;

        // 检查升级成本（含规模缩放）
        const difficulty = gameState.difficulty || 'normal';
        const scaleMultiplier = getEpochScaleMultiplier(population, epoch);
        const techCostMultiplier = getTechCostMultiplier(difficulty) * Math.max(0.5, 1 + (modifiers?.ideologyRuleMods?.techCostMod || 0)) * scaleMultiplier;

        for (let k in nextEpoch.cost) {
            if (k === 'silver') continue;
            const cost = Math.ceil(nextEpoch.cost[k] * techCostMultiplier);
            if ((resources[k] || 0) < cost) return false;
        }

        let silverCost = Math.ceil((nextEpoch.cost.silver || 0) * techCostMultiplier);
        Object.entries(nextEpoch.cost).forEach(([resource, amount]) => {
            if (resource === 'silver') return;
            silverCost += Math.ceil(amount * techCostMultiplier) * getMarketPrice(resource);
        });
        if ((resources.silver || 0) < silverCost) return false;

        return true;
    };

    /**
     * 升级时代
     */
    const upgradeEpoch = () => {
        const techRequirement = getEpochTechRequirementStatus(epoch, techsUnlocked);
        if (!techRequirement.isTechRequirementMet) {
            addLog(`⚠️ 需要先完成本时代科技：已研发 ${techRequirement.currentEpochResearched}/${techRequirement.currentEpochTechTotal}，至少需要 ${techRequirement.requiredTechCount} 项。`);
            return;
        }
        if (!canUpgradeEpoch()) return;

        const nextEpoch = EPOCHS[epoch + 1];
        const latestResources = _resourcesRef.current;
        const newRes = { ...latestResources };

        const difficulty = gameState.difficulty || 'normal';
        const scaleMultiplier = getEpochScaleMultiplier(population, epoch);
        const techCostMultiplier = getTechCostMultiplier(difficulty) * Math.max(0.5, 1 + (modifiers?.ideologyRuleMods?.techCostMod || 0)) * scaleMultiplier;

        let silverCost = Math.ceil((nextEpoch.cost.silver || 0) * techCostMultiplier);
        Object.entries(nextEpoch.cost).forEach(([resource, amount]) => {
            if (resource === 'silver') return;
            silverCost += Math.ceil(amount * techCostMultiplier) * getMarketPrice(resource);
        });

        // 扣除非银币材料
        for (let k in nextEpoch.cost) {
            if (k === 'silver') continue; // silver deducted as part of silverCost
            const cost = Math.ceil(nextEpoch.cost[k] * techCostMultiplier);
            newRes[k] -= cost;
        }
        // 扣除银币总成本
        newRes.silver = Math.max(0, (newRes.silver || 0) - silverCost);
        _resourcesRef.current = newRes;

        // 时代升级时为新解锁的资源补充少量初始库存，缓解过渡期通胀
        const newEpochIndex = epoch + 1;
        Object.entries(RESOURCES).forEach(([key, def]) => {
            if (def.unlockEpoch === newEpochIndex && !newRes[key]) {
                const seedAmount = (def.basePrice || 1) * 50;
                newRes[key] = seedAmount;
            }
        });

        setResourcesWithReason(newRes, 'upgrade_epoch');
        setEpoch(newEpochIndex);
        addLog(`🎉 文明进入 ${nextEpoch.name}！`);

        trackProgressionComplete(epoch);
        trackProgressionStart(epoch + 1);
        trackEpochUpgrade(epoch + 1, daysElapsed);
        trackResourceSink('silver', silverCost, 'tech', 'upgrade_epoch');
        const epochNames = ['stone', 'bronze', 'classical', 'feudal', 'exploration', 'enlightenment', 'industrial', 'information', 'future'];
        setDimensions({ epoch: epochNames[epoch + 1] });

        // Ideology event: epoch advance
        ideologyEventBus.emit(IDEOLOGY_EVENTS.ON_EPOCH_ADVANCE, { newEpoch: epoch + 1, epochName: nextEpoch.name }, daysElapsed);

        // Proactive ideology score award for epoch advance (replaces passive diff in useGameLoop)
        {
            const { base, epochScale } = IDEOLOGY_SCORE_TRIGGERS.epoch_advance;
            const newEpochNum = epoch + 1;
            const amount = base + newEpochNum * epochScale;
            ideologyEventBus.queueDirectEffect(
                { action: 'addIdeologyScore', amount, category: 'epoch_advance' },
                'epoch_advance'
            );
            addLog(`🔮 进入第${newEpochNum}时代获得 ${amount} 理念之力`);
        }

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
        // 从 ref 读取最新值，防止 React 批处理导致连续快速调用读到陈旧闭包
        const latestResources = _resourcesRef.current;
        const latestBuildings = _buildingsRef.current;
        const currentCount = latestBuildings[id] || 0;

        // 计算成本（随数量递增）
        const difficultyLevel = gameState.difficulty || 'normal';
        const growthFactor = getBuildingCostGrowthFactor(difficultyLevel);
        const baseMultiplier = getBuildingCostBaseMultiplier(difficultyLevel);
        const buildingCostMod = modifiers?.officialEffects?.buildingCostMod || 0;
        // V2: Ideology building cost mod (per category + global)
        const ideoBCM = modifiers?.ideologyRuleMods?.buildingCostMod || {};
        const ideoBuildCostMod = (ideoBCM[b.cat] || 0) + (ideoBCM._global || 0);
        const combinedBuildCostMod = buildingCostMod + ideoBuildCostMod;
        let totalCost = {};

        // 累加每个建筑的成本
        for (let i = 0; i < finalCount; i++) {
            const thisBuildCount = currentCount + i;
            const rawCost = calculateBuildingCost(b.baseCost, thisBuildCount, growthFactor, baseMultiplier);
            const adjustedCost = applyBuildingCostModifier(rawCost, combinedBuildCostMod, b.baseCost);

            Object.entries(adjustedCost).forEach(([res, amount]) => {
                totalCost[res] = (totalCost[res] || 0) + amount;
            });
        }

        // [FIX] silver in baseCost is a direct currency cost, not a material to "buy".
        // Separate silver from materials to avoid double-deducting.
        const directSilverCost = totalCost.silver || 0;

        const hasMaterials = Object.entries(totalCost).every(([resource, amount]) => {
            if (resource === 'silver') return true; // silver checked separately below
            return (latestResources[resource] || 0) >= amount;
        });
        if (!hasMaterials) {
            addLog(`资源不足，无法建造 ${finalCount} 个 ${b.name}`);
            return;
        }

        // 计算银币成本：直接银币成本 + 非银币材料按市场价折算的采购费
        let silverCost = directSilverCost;
        Object.entries(totalCost).forEach(([resource, amount]) => {
            if (resource === 'silver') return; // already included above
            silverCost += amount * getMarketPrice(resource);
        });
        silverCost = Math.max(0, silverCost);

        if ((latestResources.silver || 0) < silverCost) {
            addLog('银币不足，无法支付建造费用');
            return;
        }

        const newRes = { ...latestResources };
        // Deduct non-silver materials
        Object.entries(totalCost).forEach(([resource, amount]) => {
            if (resource === 'silver') return; // silver deducted as part of silverCost
            newRes[resource] = Math.max(0, (newRes[resource] || 0) - amount);
        });
        // Deduct total silver cost (direct + material procurement)
        newRes.silver = Math.max(0, (newRes.silver || 0) - silverCost);

        // 立即更新 ref，确保下一次快速调用能读到最新值
        _resourcesRef.current = newRes;
        _buildingsRef.current = { ...latestBuildings, [id]: currentCount + finalCount };

        setResourcesWithReason(newRes, 'build_purchase', { buildingId: id, count: finalCount });
        setBuildings(prev => ({ ...prev, [id]: (prev[id] || 0) + finalCount }));
        trackBuyBuilding(id, silverCost);
        trackResourceSink('silver', silverCost, 'building', id);

        // 写入 pending queue，防止 tick 覆盖此操作
        // [FIX] Only write buildingDeltas (simulation needs to know new buildings for production).
        // Do NOT write resourceDeltas here — setResourcesWithReason already updated React state,
        // and the lateActionDelta mechanism in useGameLoop tick write-back will preserve the
        // state diff. Writing resourceDeltas causes double-deduction because stateRef syncs
        // the already-deducted resources via useEffect, then pendingDeltas deducts again.
        if (pendingActionsRef?.current) {
            const pa = pendingActionsRef.current;
            pa.buildingDeltas[id] = (pa.buildingDeltas[id] || 0) + finalCount;
        }

        addLog(`建造了 ${finalCount} 个 ${b.name}`);

        // Ideology event: build
        const nextBuildings = { ...buildings, [id]: (buildings[id] || 0) + finalCount };
        const totalBuildingsAfter = Object.values(buildings).reduce((s, v) => s + (v || 0), 0) + finalCount;
        ideologyEventBus.emit(IDEOLOGY_EVENTS.ON_BUILD, {
            buildingId: id, category: b.category, count: finalCount, totalBuildings: totalBuildingsAfter
        }, daysElapsed);
        const completedChainsBefore = new Set(getCompletedChainIds(buildings));
        getCompletedChainIds(nextBuildings).forEach((chainId) => {
            if (completedChainsBefore.has(chainId)) return;
            ideologyEventBus.emit(IDEOLOGY_EVENTS.ON_CHAIN_COMPLETE, {
                chainId,
                chainName: BUILDING_CHAINS?.[chainId]?.name || chainId,
                completedChains: completedChainsBefore.size + 1,
            }, daysElapsed);
            completedChainsBefore.add(chainId);
        });

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

        const currentCount = _buildingsRef.current[id] || 0;
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

            // [FIX] 如果升级数据超过建筑数量，先规范化数据
            // 这可以修复由于数据损坏或旧版本bug导致的不一致
            if (upgradedCount > remainingCount) {
                console.warn(`[sellBuilding] Data inconsistency detected for ${id}: ${upgradedCount} upgrades > ${remainingCount} buildings. Normalizing...`);
                // 按高等级优先分配，同时修复数据
                const sortedLevels = Object.keys(levelCounts)
                    .map(k => parseInt(k))
                    .filter(l => Number.isFinite(l) && levelCounts[l] > 0)
                    .sort((a, b) => b - a); // 降序，高等级优先
                
                let remaining = remainingCount;
                const normalizedCounts = {};
                for (const lvl of sortedLevels) {
                    const wanted = levelCounts[lvl];
                    const actual = Math.min(wanted, remaining);
                    if (actual > 0) {
                        normalizedCounts[lvl] = actual;
                        remaining -= actual;
                    }
                }
                
                // 更新buildingUpgrades
                setBuildingUpgrades(prev => {
                    const newUpgrades = { ...prev };
                    if (Object.keys(normalizedCounts).length > 0) {
                        newUpgrades[id] = normalizedCounts;
                    } else {
                        delete newUpgrades[id];
                    }
                    return newUpgrades;
                });
                
                // 重新计算upgradedCount和level0Count
                upgradedCount = Object.values(normalizedCounts).reduce((sum, c) => sum + c, 0);
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
                    const propCount = off._propertySummary?.byBuildingLevel?.[id]?.[targetLevel] || 0;
                    if (propCount > 0) {
                        totalOwnedByOfficials += propCount;
                        holders.push({ index: idx, count: propCount, official: off });
                    }
                });

                // 如果官员持有总数 > 国家剩余总数，需要移除官员私产（从 summary 中扣减）
                if (totalOwnedByOfficials > remainingGlobalCount) {
                    const victimEntry = holders[Math.floor(Math.random() * holders.length)];

                    setOfficials(prev => {
                        const newOfficials = [...prev];
                        const victim = { ...newOfficials[victimEntry.index] };
                        const summary = victim._propertySummary
                            ? { byBuilding: { ...victim._propertySummary.byBuilding }, byBuildingLevel: { ...victim._propertySummary.byBuildingLevel }, totalCount: victim._propertySummary.totalCount }
                            : { byBuilding: {}, byBuildingLevel: {}, totalCount: 0 };
                        const levels = { ...(summary.byBuildingLevel[id] || {}) };
                        if (levels[targetLevel] > 0) {
                            levels[targetLevel] -= 1;
                            if (levels[targetLevel] <= 0) delete levels[targetLevel];
                            summary.byBuildingLevel[id] = levels;
                            summary.byBuilding[id] = Math.max(0, (summary.byBuilding[id] || 0) - 1);
                            if (summary.byBuilding[id] <= 0) delete summary.byBuilding[id];
                            summary.totalCount = Math.max(0, summary.totalCount - 1);
                        }
                        victim._propertySummary = summary;
                        newOfficials[victimEntry.index] = victim;
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

        // 写入 pending queue，防止 tick 覆盖此操作
        if (pendingActionsRef?.current) {
            pendingActionsRef.current.buildingDeltas[id] =
                (pendingActionsRef.current.buildingDeltas[id] || 0) - sellCount;
        }

        trackSellBuilding(id);

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

        // 从 ref 读取最新值，防止连续快速调用读到陈旧闭包
        const latestResources = _resourcesRef.current;
        const latestBuildings = _buildingsRef.current;
        const latestBuildingUpgrades = _buildingUpgradesRef.current;

        const count = latestBuildings[buildingId] || 0;
        if (count <= 0) {
            addLog('没有该建筑。');
            return;
        }

        const maxLevel = getMaxUpgradeLevel(buildingId);
        if (fromLevel >= maxLevel) {
            addLog(`${building.name} 已达最高等级。`);
            return;
        }

        // 检查目标等级的输入资源是否全部已解锁
        const { unlocked: inputsUnlocked, missingResources } = areUpgradeInputsUnlocked(
            buildingId, fromLevel + 1, epoch, techsUnlocked
        );
        if (!inputsUnlocked) {
            const missingNames = missingResources.map(r => RESOURCES[r]?.name || r).join('、');
            addLog(`⚠️ 无法升级 ${building.name}：需要的输入资源（${missingNames}）尚未解锁。`);
            return;
        }

        // 检查是否有该等级的建筑可升级
        const levelCounts = latestBuildingUpgrades[buildingId] || {};
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
            return (latestResources[resource] || 0) >= amount;
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
        if ((latestResources.silver || 0) < silverCost) {
            addLog(`银币不足，升级 ${building.name} 需要 ${Math.ceil(silverCost)} 银币。`);
            return;
        }

        // 4. 扣除资源和银币
        const newRes = { ...latestResources };
        Object.entries(upgradeCost).forEach(([resource, amount]) => {
            if (resource !== 'silver') {
                newRes[resource] = Math.max(0, (newRes[resource] || 0) - amount);
            }
        });
        newRes.silver = Math.max(0, (newRes.silver || 0) - silverCost);
        // 立即更新 ref，确保下一次快速调用能读到最新值
        _resourcesRef.current = newRes;
        setResourcesWithReason(newRes, 'building_upgrade', { buildingId, count: 1 });

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
        trackUpgradeBuilding(buildingId, nextLevel);
        trackResourceSink('silver', silverCost, 'building', buildingId);

        // Ideology event: upgrade building
        ideologyEventBus.emit(IDEOLOGY_EVENTS.ON_UPGRADE, {
            buildingId, fromLevel, toLevel: nextLevel
        }, daysElapsed);

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
        trackDowngradeBuilding(buildingId, fromLevel);

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
        trackBatchUpgradeBuilding(buildingId, upgradeCount);

        // 检查目标等级的输入资源是否全部已解锁
        const { unlocked: inputsUnlocked, missingResources } = areUpgradeInputsUnlocked(
            buildingId, fromLevel + 1, epoch, techsUnlocked
        );
        if (!inputsUnlocked) {
            const missingNames = missingResources.map(r => RESOURCES[r]?.name || r).join('、');
            addLog(`⚠️ 无法升级 ${building.name}：需要的输入资源（${missingNames}）尚未解锁。`);
            return;
        }

        // 从 ref 读取最新值，防止连续快速调用读到陈旧闭包
        const latestResources = _resourcesRef.current;
        const buildingCount = _buildingsRef.current[buildingId] || 0;
        const levelCounts = _buildingUpgradesRef.current[buildingId] || {};

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
            const available = latestResources[resource] || 0;
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
        const availableSilver = latestResources.silver || 0;
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
                    return (latestResources[resource] || 0) >= amount;
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
        const newRes = { ...latestResources };
        for (const [resource, amount] of Object.entries(actualResourceCost)) {
            newRes[resource] = Math.max(0, (newRes[resource] || 0) - amount);
        }
        newRes.silver = Math.max(0, (newRes.silver || 0) - actualSilverCost);
        // 立即更新 ref，确保下一次快速调用能读到最新值
        _resourcesRef.current = newRes;
        setResourcesWithReason(newRes, 'building_upgrade_batch', { buildingId, count: successCount });

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
        trackBatchDowngradeBuilding(buildingId, downgradeCount);

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

        // 检查前置知识
        if (tech.prerequisites && tech.prerequisites.length > 0) {
            const missingPrereqs = tech.prerequisites.filter(pid => !techsUnlocked.includes(pid));
            if (missingPrereqs.length > 0) {
                const missingNames = missingPrereqs.map(pid => {
                    const pt = TECHS.find(t => t.id === pid);
                    return pt ? pt.name : pid;
                }).join('、');
                addLog(`需要先研究 ${missingNames} 才能研究 ${tech.name}`);
                return;
            }
        }

        // 检查资源（从 ref 读取最新值）
        const latestResources = _resourcesRef.current;
        const difficulty = gameState.difficulty || 'normal';
        const techCostMultiplier = getTechCostMultiplier(difficulty) * Math.max(0.5, 1 + (modifiers?.ideologyRuleMods?.techCostMod || 0));

        let canAfford = true;
        for (let resource in tech.cost) {
            const cost = Math.ceil(tech.cost[resource] * techCostMultiplier);
            if ((latestResources[resource] || 0) < cost) {
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
        if ((latestResources.silver || 0) < silverCost) {
            addLog('银币不足，无法支付研究费用');
            return;
        }

        // 扣除资源和银币
        const newRes = { ...latestResources };
        for (let resource in tech.cost) {
            const cost = Math.ceil(tech.cost[resource] * techCostMultiplier);
            newRes[resource] -= cost;
        }
        newRes.silver = Math.max(0, (newRes.silver || 0) - silverCost);
        _resourcesRef.current = newRes;

        setResourcesWithReason(newRes, 'tech_research', { techId: id });
        setTechsUnlocked(prev => [...prev, id]);
        addLog(`✓ 研究完成：${tech.name}`);
        trackResearchTech(id, tech.cost?.science || 0);
        trackResourceSink('silver', silverCost, 'tech', id);
        if (tech.cost?.science) {
            trackResourceSink('science', Math.ceil(tech.cost.science * techCostMultiplier), 'tech', id);
        }

        // Ideology event: tech unlock
        ideologyEventBus.emit(IDEOLOGY_EVENTS.ON_TECH_UNLOCK, {
            techId: id, techCount: (techsUnlocked?.length || 0) + 1
        }, daysElapsed);

        // Proactive ideology score award for tech research (replaces passive diff in useGameLoop)
        {
            const { base, epochScale } = IDEOLOGY_SCORE_TRIGGERS.research_tech;
            const amount = base + epoch * epochScale;
            ideologyEventBus.queueDirectEffect(
                { action: 'addIdeologyScore', amount, category: 'research_tech' },
                'research_tech'
            );
            addLog(`🔮 研发知识「${tech.name}」获得 ${amount} 理念之力`);
        }

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
        const candidates = triggerSelection(epoch, popStructure, classInfluence, market, rates, officials || []);
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
        
        // [FIX] 使用函数式更新避免竞态条件（与 simulation 的 setOfficials 冲突）
        // 问题：直接赋值 setOfficials(result.newOfficials) 可能被 simulation 返回的旧数据覆盖
        let hireResult = null;
        let hiredOfficial = null;
        
        setOfficials(prevOfficials => {
            const result = hireOfficial(officialId, officialCandidates, prevOfficials, effectiveCapacity, daysElapsed);
            hireResult = result;
            if (!result.success) {
                return prevOfficials; // 保持原状态
            }
            hiredOfficial = result.newOfficials[result.newOfficials.length - 1];
            return result.newOfficials;
        });
        
        // 处理结果（在 setState 回调外执行副作用）
        if (!hireResult || !hireResult.success) {
            addLog(`雇佣失败：${hireResult?.error || '未知错误'}`);
            return;
        }
        
        setOfficialCandidates(hireResult.newCandidates);
        addLog(`雇佣了官员 ${hiredOfficial.name}。`);
        trackOfficialHire();

        // Ideology event: hire official
        ideologyEventBus.emit(IDEOLOGY_EVENTS.ON_HIRE_OFFICIAL, {
            officialId, officialName: hiredOfficial.name, role: hiredOfficial.role
        }, daysElapsed);

        // 更新人口结构：从来源阶层移动到官员阶层
        // 确保数据同步，防止出现"官员数量对不上"的问题
        setPopStructure(prev => {
            const source = hiredOfficial.sourceStratum || 'unemployed';
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
        // Use functional update to avoid stale state when firing multiple officials in sequence.
        setOfficials(prev => {
            const newOfficials = fireOfficial(officialId, prev);
            // 即时更新 officialEffects.buildingCostMod，避免等到下一 tick 才生效
            // 只更新 buildingCostMod（影响建筑购买成本），其他字段等下一 tick 自然刷新
            if (setModifiers) {
                const newEffects = getAggregatedOfficialEffects(newOfficials, true);
                setModifiers(prev2 => ({
                    ...prev2,
                    officialEffects: {
                        ...(prev2?.officialEffects || {}),
                        buildingCostMod: newEffects.buildingCostMod || 0,
                    },
                }));
            }
            return newOfficials;
        });
        clearOfficialFromAssignments(officialId);
        removeOfficialLinkedGeneral(officialId);
        if (official) {
            addLog(`解雇了官员 ${official.name}。`);
            trackOfficialFire();

            // Ideology event: fire official
            ideologyEventBus.emit(IDEOLOGY_EVENTS.ON_FIRE_OFFICIAL, {
                officialId, officialName: official.name, role: official.role
            }, daysElapsed);

            if (official._propertySummary?.totalCount) {
                addLog(`官员产业已全部倒闭（${official._propertySummary.totalCount} 处）`);
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
        let removedOfficial = null;
        let result = null;
        setOfficials(prev => {
            removedOfficial = prev.find(o => o.id === officialId) || null;
            result = disposeOfficial(officialId, disposalType, prev, daysElapsed);
            return result.success ? result.newOfficials : prev;
        });

        if (!result || !result.success) {
            addLog(`处置失败：${result?.error || '未找到该官员'}`);
            return;
        }

        const official = removedOfficial;
        clearOfficialFromAssignments(officialId);
        removeOfficialLinkedGeneral(officialId);

        // 获取没收的财产
        if (result.wealthGained > 0) {
            setResourcesWithReason(prev => ({
                ...prev,
                silver: (prev.silver || 0) + result.wealthGained
            }), 'official_disposal_confiscation', { officialId, disposalType });
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

        // 应用组织度变化（复用现有 rebellionStates 结构）
        if (result.effects?.organizationChange) {
            setRebellionStates(prev => {
                const updated = { ...(prev || {}) };
                Object.entries(result.effects.organizationChange).forEach(([stratum, change]) => {
                    const currentState = updated[stratum] || {};
                    const nextValue = Math.max(0, Math.min(100, (currentState.organization || 0) + change));
                    const stage = getOrganizationStage(nextValue);
                    updated[stratum] = {
                        ...currentState,
                        organization: nextValue,
                        stage,
                        phase: getPhaseFromStage(stage),
                    };
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
     * 切换单个官员的产业政策
     * @param {string} officialId - 目标官员ID
     * @param {string} toPolicy - 目标政策 ('private' | 'high_salary' | 'state_managed')
     * @param {string} confiscationMode - 没收模式 ('compensate' | 'force')，仅从私产制切换时有效
     * @returns {Object} { success, error?, logMessages? }
     */
    const changeOfficialPropertyPolicy = (officialId, toPolicy, confiscationMode = 'compensate') => {
        const targetOfficial = officials.find(o => o.id === officialId);
        if (!targetOfficial) {
            return { success: false, error: '找不到目标官员' };
        }

        const currentPolicy = targetOfficial.propertyPolicy || 'private';
        const currentDay = daysElapsed || 0;

        const result = switchPropertyPolicy(
            currentPolicy,
            toPolicy,
            targetOfficial,
            currentDay,
            confiscationMode
        );

        if (!result.success) {
            return { success: false, error: result.error };
        }

        // 更新目标官员
        setOfficials(prev => prev.map(o =>
            o.id === officialId ? result.updatedOfficial : o
        ));

        // 处理国库变动（补偿没收的花费）
        if (result.treasuryChange !== 0) {
            setResourcesWithReason(prev => ({
                ...prev,
                silver: Math.max(0, (prev.silver || 0) + result.treasuryChange)
            }), 'policy_switch_treasury', { officialId, fromPolicy: currentPolicy, toPolicy });
        }

        // 记录日志
        (result.logMessages || []).forEach(msg => addLog(msg));

        return { success: true, logMessages: result.logMessages };
    };

    /**
     * 调整官员薪俸
     * @param {string} officialId - 官员ID
     * @param {number} nextSalary - 新薪俸
     */
    const updateOfficialSalary = (officialId, nextSalary) => {
        if (!officialId || !Number.isFinite(nextSalary)) return;
        trackOfficialSalary(Math.floor(nextSalary));
        setOfficials(prev => prev.map(official => (
            official.id === officialId ? { ...official, salary: Math.floor(nextSalary) } : official
        )));
    };

    /**
     * 更新官员姓名
     * @param {string} officialId - 官员ID
     * @param {string} nextName - 新姓名
     */
    const updateOfficialName = (officialId, nextName) => {
        if (!officialId || typeof nextName !== 'string') return;
        const trimmedName = nextName.trim();
        if (!trimmedName) return;
        setOfficials(prev => prev.map(official => (
            official.id === officialId ? { ...official, name: trimmedName } : official
        )));
    };

    const buildEmptyMinisterAssignments = () => MINISTER_ROLES.reduce((acc, role) => {
        acc[role] = null;
        return acc;
    }, {});

    const removeOfficialLinkedGeneral = (officialId) => {
        if (!officialId) return;

        const linkedGeneralIds = (generals || [])
            .filter((general) => general?.officialId === officialId)
            .map((general) => general.id)
            .filter(Boolean);

        if (linkedGeneralIds.length === 0) return;

        if (typeof setGenerals === 'function') {
            setGenerals((prev) => (prev || []).filter((general) => general?.officialId !== officialId));
        }

        if (typeof setMilitaryCorps === 'function') {
            setMilitaryCorps((prev) => {
                let changed = false;
                const next = (prev || []).map((corps) => {
                    if (!linkedGeneralIds.includes(corps?.generalId)) return corps;
                    changed = true;
                    return { ...corps, generalId: null };
                });
                return changed ? next : prev;
            });
        }
    };

    const clearOfficialFromAssignments = (officialId) => {
        if (!officialId || typeof setMinisterAssignments !== 'function') return;
        setMinisterAssignments(prev => {
            const next = { ...buildEmptyMinisterAssignments(), ...(prev || {}) };
            let changed = false;
            MINISTER_ROLES.forEach((role) => {
                if (next[role] === officialId) {
                    next[role] = null;
                    changed = true;
                }
            });
            return changed ? next : prev;
        });
    };

    const assignMinister = (role, officialId) => {
        if (!MINISTER_ROLES.includes(role)) return;
        const official = officials.find(o => o.id === officialId);
        if (!official) return;
        trackMinisterAssign(role);
        setMinisterAssignments(prev => {
            const next = { ...buildEmptyMinisterAssignments(), ...(prev || {}) };
            MINISTER_ROLES.forEach((otherRole) => {
                if (otherRole !== role && next[otherRole] === officialId) {
                    next[otherRole] = null;
                }
            });
            next[role] = officialId;
            return next;
        });
        const roleLabel = MINISTER_LABELS[role] || role;
        addLog(`任命${official.name}为${roleLabel}。`);
    };

    const clearMinisterRole = (role) => {
        if (!MINISTER_ROLES.includes(role)) return;
        let removed = false;
        setMinisterAssignments(prev => {
            const next = { ...buildEmptyMinisterAssignments(), ...(prev || {}) };
            if (next[role] === null) return prev;
            next[role] = null;
            removed = true;
            return next;
        });
        if (removed) {
            const roleLabel = MINISTER_LABELS[role] || role;
            addLog(`撤换了${roleLabel}。`);
        }
    };

    const toggleMinisterAutoExpansion = (role, enabled) => {
        if (!ECONOMIC_MINISTER_ROLES.includes(role)) return;
        setMinisterAutoExpansion(prev => ({
            ...prev,
            [role]: enabled,
        }));
        const roleLabel = MINISTER_LABELS[role] || role;
        addLog(`${enabled ? '启用' : '禁用'}了${roleLabel}的自动扩建功能。`);
    };
    // ========== 手动采集 ==========

    /**
     * 手动采集资源
     * @param {Event} e - 鼠标事件
     */
    const manualGather = (e) => {
        trackManualGather(1);
        setClicks(prev => [...prev, {
            id: Date.now(),
            x: e.clientX,
            y: e.clientY,
            text: "+1",
            color: "text-white"
        }]);
        setResourcesWithReason(prev => ({
            ...prev,
            food: prev.food + 1,
            wood: prev.wood + 1
        }), 'manual_gather');
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

        // V2: Ideology recruit cost mod (per unit category + global)
        const ideoRCM = modifiers?.ideologyRuleMods?.recruitCostMod || {};
        const ideoRecruitMod = (ideoRCM[unit.category] || 0) + (ideoRCM._global || 0);
        if (ideoRecruitMod !== 0) {
            const recruitMultiplier = Math.max(0.5, 1 + ideoRecruitMod); // cap at -50%
            for (let resource in totalUnitCost) {
                totalUnitCost[resource] = Math.ceil(totalUnitCost[resource] * recruitMultiplier);
            }
        }

        // 从 ref 读取最新资源值
        const latestResources = _resourcesRef.current;

        // 检查资源
        let canAfford = true;
        for (let resource in totalUnitCost) {
            if (resource === 'silver') continue; // silver checked as part of silverCost below
            if ((latestResources[resource] || 0) < totalUnitCost[resource]) {
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

        // [FIX] silver in recruitCost is a direct currency cost, not a purchasable material
        let silverCost = totalUnitCost.silver || 0;
        Object.entries(totalUnitCost).forEach(([resource, amount]) => {
            if (resource === 'silver') return;
            silverCost += amount * getMarketPrice(resource);
        });

        if ((latestResources.silver || 0) < silverCost) {
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
        const newRes = { ...latestResources };
        for (let resource in totalUnitCost) {
            if (resource === 'silver') continue; // silver deducted as part of silverCost
            newRes[resource] -= totalUnitCost[resource];
        }
        newRes.silver = Math.max(0, (newRes.silver || 0) - silverCost);
        _resourcesRef.current = newRes;
        setResourcesWithReason(newRes, 'recruit_unit', { unitId, count: recruitCount });
        trackRecruit(unitId, recruitCount);
        trackResourceSink('silver', silverCost, 'military', unitId);

        const trainingSpeedBonus = modifiers?.ministerEffects?.militaryTrainingSpeed || 0;
        const trainingMultiplier = Math.max(0.5, 1 - trainingSpeedBonus);
        const baseTrainingTime = unit.trainingTime || 1;
        const effectiveTrainingTime = Math.max(1, Math.ceil(baseTrainingTime * trainingMultiplier));

        // 加入训练队列
        const newQueueItems = Array(recruitCount).fill(null).map(() => ({
            unitId,
            status: 'waiting',
            remainingTime: effectiveTrainingTime,
            totalTime: effectiveTrainingTime
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
     * @param {number} [count=1] - 解散数量
     */
    const disbandUnit = (unitId, count = 1) => {
        const current = army[unitId] || 0;
        const actual = Math.min(Math.max(1, count), current);
        if (actual <= 0) return;
        setArmy(prev => ({
            ...prev,
            [unitId]: Math.max(0, (prev[unitId] || 0) - actual)
        }));
        const unitName = UNIT_TYPES[unitId]?.name || unitId;
        addLog(actual === 1 ? `解散了 ${unitName}` : `解散了 ${actual} 个 ${unitName}`);
        trackDisband(unitId, actual);
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
            trackCancelTraining(item.unitId);

            // 移除该项
            const newQueue = prev.filter((_, idx) => idx !== queueIndex);

            // 如果是等待状态或训练状态，返还部分资源（50%）
            if (item.status === 'waiting' || item.status === 'training') {
                const refundResources = {};
                for (let resource in unit.recruitCost) {
                    if (resource === 'silver') continue; // silver refunded via silverCost
                    refundResources[resource] = Math.floor(unit.recruitCost[resource] * 0.5);
                }

                // [FIX] Refund silver = direct silver cost + material market value
                let silverCost = (unit.recruitCost.silver || 0);
                Object.entries(unit.recruitCost).forEach(([resource, amount]) => {
                    if (resource === 'silver') return;
                    silverCost += amount * getMarketPrice(resource);
                });
                const refundSilver = Math.floor(silverCost * 0.5);

                setResourcesWithReason(prev => {
                    const newRes = { ...prev };
                    for (let resource in refundResources) {
                        newRes[resource] = (newRes[resource] || 0) + refundResources[resource];
                    }
                    newRes.silver = (newRes.silver || 0) + refundSilver;
                    return newRes;
                }, 'cancel_training_refund', { unitId: item.unitId, queueIndex });

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
            trackCancelAllTraining(prev.length);

            let totalRefundSilver = 0;
            const totalRefundResources = {};

            // Calculate total refund for all items
            prev.forEach(item => {
                const unit = UNIT_TYPES[item.unitId];
                if (item.status === 'waiting' || item.status === 'training') {
                    for (let resource in unit.recruitCost) {
                        if (resource === 'silver') continue; // silver refunded via silverCost
                        totalRefundResources[resource] = (totalRefundResources[resource] || 0) + Math.floor(unit.recruitCost[resource] * 0.5);
                    }
                    // [FIX] silver = direct silver cost + material market value
                    let silverCost = (unit.recruitCost.silver || 0);
                    Object.entries(unit.recruitCost).forEach(([resource, amount]) => {
                        if (resource === 'silver') return;
                        silverCost += amount * getMarketPrice(resource);
                    });
                    totalRefundSilver += Math.floor(silverCost * 0.5);
                }
            });

            // Refund all resources
            setResourcesWithReason(prevRes => {
                const newRes = { ...prevRes };
                for (let resource in totalRefundResources) {
                    newRes[resource] = (newRes[resource] || 0) + totalRefundResources[resource];
                }
                newRes.silver = (newRes.silver || 0) + totalRefundSilver;
                return newRes;
            }, 'cancel_all_training_refund');

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
        trackDisbandAll(count);

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
        const lastActionDay = targetNation.lastMilitaryActionDay?.[missionId] || 0;
        const cooldownDays = applyCooldownModifier(
            mission.cooldownDays || 5,
            modifiers?.ideologyRuleMods?.cooldownMod || 0
        );
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

        // 获取难度军力倍数
        const difficultyLevel = gameState.difficulty || 'normal';
        const difficultyMultiplier = getAIMilitaryStrengthMultiplier(difficultyLevel);

        // 使用 generateNationArmy 生成敌方军队
        const defenderArmy = generateNationArmy(targetNation, enemyEpoch, actualDeploymentRatio, difficultyMultiplier);

        const defenderData = {
            army: defenderArmy,
            epoch: enemyEpoch,
            militaryBuffs: mission.enemyBuff || 0,
            wealth: targetNation.wealth || 500,
            isHomeDefense: true,
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
                setResourcesWithReason(prev => {
                    const updated = { ...prev };
                    Object.entries(unlockedLoot).forEach(([resource, amount]) => {
                        updated[resource] = (updated[resource] || 0) + amount;
                    });
                    return updated;
                }, 'battle_loot', { nationId, missionId });
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
            const newPopulation = reducePopulationWithFloor(currentPopulation, populationLoss);

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

        trackBattleLaunch();
        const totalLosses = Object.values(result.attackerLosses || {}).reduce((s, v) => s + v, 0);
        const lossRatio = totalUnits > 0 ? totalLosses / totalUnits : 0;
        trackBattleResult(result.victory ? 'Victory' : 'Defeat', Math.round(lossRatio * 100), nationId);

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
        if (!targetNation && nationId !== 'player') return;
        const shouldTrackAnalytics = payload?.trackAnalytics !== false;
        const clampRelation = (value) => Math.max(0, Math.min(100, value));

        // 外交动作冷却时间配置（天数）        
        const DIPLOMATIC_COOLDOWNS = {
            gift: 30,           // 30天
            demand: 30,         // 30天
            insult: 30,         // 30天 - 侮辱
            provoke: 30,        // 30天
            negotiate_treaty: 120, // Multi-round negotiation cooldown
        };

        // 检查外交动作冷却时间
        const cooldownDays = DIPLOMATIC_COOLDOWNS[action];
        const cooldownModifier =
            (modifiers?.officialEffects?.diplomaticCooldown || 0)
            + (modifiers?.ideologyRuleMods?.cooldownMod || 0);
        const adjustedCooldownDays = applyCooldownModifier(cooldownDays, cooldownModifier);
        const skipCooldownCheck = action === 'negotiate_treaty' && payload?.ignoreCooldown === true;
        if (!skipCooldownCheck && adjustedCooldownDays && adjustedCooldownDays > 0) {
            const lastActionDay = targetNation.lastDiplomaticActionDay?.[action] || 0;
            const daysSinceLastAction = daysElapsed - lastActionDay;
            if (lastActionDay > 0 && daysSinceLastAction < adjustedCooldownDays) {
                const remainingDays = adjustedCooldownDays - daysSinceLastAction;
                const actionNames = {
                    gift: '送礼',
                    demand: '索要',
                    insult: '侮辱',
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

        if (targetNation?.isAtWar && (action === 'gift' || action === 'trade' || action === 'import' || action === 'demand')) {
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

        if (shouldTrackAnalytics) {
            trackDiplomacy(action, nationId);
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
                setResourcesWithReason(prev => ({ ...prev, silver: prev.silver - giftCost }), 'diplomatic_gift', { nationId });
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
                setResourcesWithReason(prev => ({
                    ...prev,
                    silver: prev.silver + payout,
                    [resourceKey]: Math.max(0, (prev[resourceKey] || 0) - amount),
                }), 'diplomatic_trade_export', { nationId, resourceKey, amount });

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
                setResourcesWithReason(prev => ({
                    ...prev,
                    silver: prev.silver - cost,
                    [resourceKey]: (prev[resourceKey] || 0) + amount,
                }), 'diplomatic_trade_import', { nationId, resourceKey, amount });

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

                break;
            }

            case 'propose_peace': {
                const relevantFrontsOld = (activeFronts || []).filter(f =>
                    (f.attackerId === 'player' && f.defenderId === nationId) ||
                    (f.defenderId === 'player' && f.attackerId === nationId)
                );
                const frontWarScoreOld = relevantFrontsOld.length > 0
                    ? relevantFrontsOld.reduce((sum, f) => sum + getEffectiveFrontWarScore(f), 0)
                    : null;
                const playerAdvantage = frontWarScoreOld !== null ? frontWarScoreOld : (targetNation.warScore || 0);

                const event = createPlayerPeaceProposalEvent(
                    targetNation,
                    playerAdvantage,
                    targetNation.warDuration || 0,
                    targetNation.enemyLosses || 0,
                    {
                        population: typeof getTotalPopulation === 'function' ? getTotalPopulation() : 1000,
                        epoch: epoch || 0
                    },
                    (choice, value) => {
                        handleDiplomaticAction(nationId, 'finalize_peace', { type: choice, value });
                    }
                );
                triggerDiplomaticEvent(event);
                break;
            }
            case 'finalize_peace': {
                const { type, value } = payload;
                if (!type) return;
                // 如果是取消操作，直接返回，不做任何处理
                if (type === 'cancel') {
                    addLog(`取消了与 ${targetNation.name} 的和谈提议。`);
                    return;
                }
                // 如果是叛乱政府，使用专门的叛乱结束处理
                if (targetNation.isRebelNation) {
                    // 判断是玩家胜利还是失败
                    // demand_* 视为玩家胜利（叛乱平定）- 玩家向叛军索要赔款
                    // pay_*/offer_*/peace_only 视为玩家失败（向叛军妥协）- 玩家付出任何代价或无条件求和
                    const defeatOptions = [

                        'pay_high',           // 支付巨额赔款
                        'pay_standard',       // 支付赔款
                        'pay_moderate',       // 支付象征性赔款
                        'pay_installment',    // 分期支付赔款
                        'pay_installment_moderate', // 分期支付（低额）

                        'offer_population',   // 割让人口
                        'peace_only',         // 无条件求和（玩家主动低头）
                    ];
                    const playerVictory = !defeatOptions.includes(type);
                    handleRebellionWarEnd(nationId, playerVictory);

                    return;
                }
                setNations(prev => prev.map(n => {
                    if (n.id === nationId) {
                        let silverChange = 0;
                        let popChange = 0;

                        let relationChange = 10;
                        let lootReserveChange = 0;
                        // Handle resource transfers
                        if (['demand_high', 'demand_standard', 'demand_installment'].includes(type)) {
                            silverChange = -Math.floor(value || 0); // AI loses silver
                            setResourcesWithReason(r => ({ ...r, silver: (r.silver || 0) + Math.abs(silverChange) }), 'war_reparation_receive', { nationId });
                            lootReserveChange = Math.abs(silverChange);
                            addLog(`获得战争赔款 ${Math.abs(silverChange)} 银币`);
                        } else if (['pay_high', 'pay_installment'].includes(type)) {
                            // Player pays AI
                            const payment = Math.floor(value || 0);
                            setResourcesWithReason(r => ({ ...r, silver: Math.max(0, (r.silver || 0) - payment) }), 'war_reparation_pay', { nationId });
                            silverChange = payment; // AI gains silver
                            addLog(`支付战争赔款 ${payment} 银币`);
                        }

                        // Handle population transfers
                        if (['demand_population', 'demand_annex'].includes(type)) {

                            popChange = -Math.floor(value || 0); // AI loses pop
                            const populationGain = Math.abs(popChange);
                            
                            // [FIX] Add population to player
                            if (populationGain > 0) {
                                setPopulation(prev => prev + populationGain);
                                // Sync popStructure: new population joins as unemployed
                                setPopStructure(prev => ({
                                    ...prev,
                                    unemployed: (prev.unemployed || 0) + populationGain,
                                }));
                                setMaxPopBonus(prev => prev + populationGain);
                            }
                            
                            addLog(`接收割让人口 ${populationGain} (及对应土地)`);
                        } else if (type === 'offer_population') {
                            // Player loses pop
                            const populationLoss = Math.floor(value || 0);
                            if (populationLoss > 0) {
                                setPopulation(prev => reducePopulationWithFloor(prev, populationLoss));
                                // Reduce from unemployed first, then proportionally from other strata
                                setPopStructure(prev => {
                                    const updated = { ...prev };
                                    let remaining = populationLoss;
                                    
                                    // First take from unemployed
                                    const unemployedLoss = Math.min(remaining, prev.unemployed || 0);
                                    updated.unemployed = Math.max(0, (prev.unemployed || 0) - unemployedLoss);
                                    remaining -= unemployedLoss;
                                    
                                    // If still need to reduce, take proportionally from other strata
                                    if (remaining > 0) {
                                        const totalEmployed = Object.keys(STRATA).reduce((sum, key) => {
                                            if (key !== 'unemployed') {
                                                return sum + (prev[key] || 0);
                                            }
                                            return sum;
                                        }, 0);
                                        
                                        if (totalEmployed > 0) {
                                            Object.keys(STRATA).forEach(key => {
                                                if (key !== 'unemployed' && remaining > 0) {
                                                    const ratio = (prev[key] || 0) / totalEmployed;
                                                    const loss = Math.min(Math.floor(remaining * ratio), prev[key] || 0);
                                                    updated[key] = Math.max(0, (prev[key] || 0) - loss);
                                                    remaining -= loss;
                                                }
                                            });
                                        }
                                    }
                                    
                                    return updated;
                                });
                                setMaxPopBonus(prev => Math.max(0, prev - populationLoss));
                            }
                            addLog(`割让人口 ${populationLoss}`);
                        }
                        // Handle Vassalage
                        let vassalUpdates = {};
                        if (['demand_vassal', 'demand_colony', 'demand_puppet', 'demand_tributary', 'demand_protectorate'].includes(type) || type.startsWith('demand_vassal')) {
                            const vassalType = value || 'vassal'; // passed as string in event, default to unified vassal

                            vassalUpdates = {
                                vassalOf: 'player',
                                vassalType: vassalType,
                                tributeRate: VASSAL_TYPE_CONFIGS[vassalType]?.tributeRate || 0.1,
                            };
                            addLog(`${n.name} 成为你的${VASSAL_TYPE_LABELS[vassalType] || '附庸国'}`);
                        }
                        const nextForeignWars = { ...(n.foreignWars || {}) };
                        if (nextForeignWars.player) {
                            nextForeignWars.player = {
                                ...nextForeignWars.player,
                                isAtWar: false,
                                warScore: 0,
                                peaceTreatyUntil: daysElapsed + 365,
                            };
                        }

                        return {
                            ...n,
                            isAtWar: false,
                            warTarget: null,
                            warScore: 0,
                            warDuration: 0,

                            peaceTreatyUntil: daysElapsed + 365,
                            relation: Math.min(100, Math.max(0, (n.relation || 0) + relationChange)),
                            wealth: Math.max(0, (n.wealth || 0) + silverChange),
                            population: clampPopulationAtFloor((n.population || 1000) + popChange),
                            foreignWars: nextForeignWars,
                            lootReserve: Math.max(0, (n.lootReserve || 0) - lootReserveChange),
                            ...vassalUpdates
                        };
                    }

                    if (n.id === 'player' && n.foreignWars?.[nationId]) {
                        return {
                            ...n,
                            foreignWars: {
                                ...n.foreignWars,
                                [nationId]: {
                                    ...n.foreignWars[nationId],
                                    isAtWar: false,
                                    warScore: 0,
                                    peaceTreatyUntil: daysElapsed + 365,
                                },
                            },
                        };
                    }

                    return n;

                }));
                addLog(`与 ${targetNation.name} 达成和平协议。`);

                cleanupWarRuntimeState(nationId, 'peace_treaty');

                break;

            }
            case 'demand': {
                const armyPower = calculateBattlePower(army, epoch, modifiers?.militaryBonus || 0, 50, modifiers?.ideologyRuleMods || {});
                const successChance = Math.max(0.1, (armyPower / (armyPower + 200)) * 0.6 + (targetNation.relation || 0) / 300);
                if (Math.random() < successChance) {
                    const tribute = Math.min(targetNation.wealth || 0, Math.ceil(150 + armyPower * 0.25));
                    setResourcesWithReason(prev => ({ ...prev, silver: prev.silver + tribute }), 'diplomatic_demand_tribute', { nationId });
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
                setResourcesWithReason(prev => ({ ...prev, silver: prev.silver - provokeCost }), 'diplomatic_provoke_cost', { nationId });
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
            case 'insult': {
                // 羞辱：降低关系，可能引发战争或获得声望（暂时简化为降低关系）
                const relationDamage = Math.floor(15 + Math.random() * 15);
                setNations(prev => prev.map(n =>
                    n.id === nationId
                        ? {
                            ...n,
                            relation: clampRelation((n.relation || 0) - relationDamage),
                            lastDiplomaticActionDay: {
                                ...(n.lastDiplomaticActionDay || {}),

                                insult: daysElapsed,
                            },
                        }
                        : n
                ));
                // 小概率触发宣战
                if (Math.random() < 0.05 && (targetNation.relation || 50) < 20) {
                    // 对方宣战逻辑可以在这里扩展，目前仅提示
                    addLog(`🤬 你的羞辱彻底激怒了 ${targetNation.name}，局势紧张！`);

                } else {
                    addLog(`🤬 你羞辱了 ${targetNation.name}，双方关系恶化。`);
                }
                break;
            }
            case 'propose_alliance': {
                // 结盟请求
                if (targetNation.isAtWar) {
                    addLog(`${targetNation.name} 处于战争中，无法结盟。`);
                    return;
                }
                if (targetNation.alliedWithPlayer) {
                    addLog(`你与 ${targetNation.name} 已经是盟友了。`);

                    return;
                }
                const relation = targetNation.relation || 0;
                const minRelation = 70; // 结盟门槛
                if (relation < minRelation) {
                    addLog(`${targetNation.name} 拒绝了你的结盟请求（关系需达到 ${minRelation}）。`);
                    // 记录冷却
                    setNations(prev => prev.map(n =>
                        n.id === nationId
                            ? {
                                ...n,
                                lastDiplomaticActionDay: {
                                    ...(n.lastDiplomaticActionDay || {}),
                                    propose_alliance: daysElapsed
                                }
                            }
                            : n
                    ));
                    return;
                }
                // 成功结盟
                setNations(prev => prev.map(n =>
                    n.id === nationId
                        ? {
                            ...n,

                            alliedWithPlayer: true,
                            relation: clampRelation(n.relation + 10),
                            lastDiplomaticActionDay: {
                                ...(n.lastDiplomaticActionDay || {}),
                                propose_alliance: daysElapsed
                            }
                        }
                        : n
                ));
                addLog(`🤝 祝贺！你与 ${targetNation.name} 正式结为盟友。`);
                break;
            }

            case 'declare_war': {
                // 检查和平协议是否仍然有效
                const isPeaceActive = targetNation.peaceTreatyUntil && daysElapsed < targetNation.peaceTreatyUntil;
                const breachPenalty = isPeaceActive ? getTreatyBreachPenalty(epoch) : null;

                // 找出目标国家的正式盟友，这些盟友也会被卷入战争
                // 但如果某个盟友同时也是玩家的正式盟友，则该盟友保持中立
                const orgs = diplomacyOrganizations?.organizations || [];
                const getAllianceMemberIds = (nationKey) => {

                    const members = new Set();
                    orgs.forEach(org => {
                        if (org?.type !== 'military_alliance') return;
                        if (!Array.isArray(org.members) || !org.members.includes(nationKey)) return;

                        org.members.forEach(id => {
                            if (id && id !== nationKey) members.add(id);
                        });

                    });
                    return Array.from(members);
                };
                const targetAllianceIds = getAllianceMemberIds(targetNation.id);
                const playerAllianceIds = getAllianceMemberIds('player');

                // ✅ 检查是否在同一个军事组织中
                const sharedAlliance = orgs.find(org =>
                    org?.type === 'military_alliance' &&
                    Array.isArray(org.members) &&
                    org.members.includes('player') &&
                    org.members.includes(targetNation.id)
                );

                if (sharedAlliance) {
                    addLog(`无法宣战：${targetNation.name} 与你同属军事组织 ${sharedAlliance.name}。必须先退出组织才能宣战！`);
                    return;
                }

                const sharedAllianceIds = new Set(targetAllianceIds.filter(id => playerAllianceIds.includes(id)));

                // ✅ 获取所有会被号召的盟友ID（用于交叉检查）
                const potentialTargetAllies = targetAllianceIds.filter(id => !sharedAllianceIds.has(id));
                const potentialPlayerAllies = playerAllianceIds.filter(id => !sharedAllianceIds.has(id));

                // ✅ 检查盟友之间是否在同一军事组织（防止盟友互相交战）
                const checkAllianceConflict = (allyId, opposingAllyIds) => {
                    return orgs.some(org => {
                        if (org?.type !== 'military_alliance') return false;
                        if (!Array.isArray(org.members)) return false;
                        // 检查这个盟友是否与对方的任何盟友在同一组织中
                        return org.members.includes(allyId) &&
                            opposingAllyIds.some(oppId => org.members.includes(oppId));
                    });
                };

                const targetAllies = nations.filter(n => {
                    if (n.id === nationId || n.id === targetNation.id) return false;
                    if (!targetAllianceIds.includes(n.id)) return false;
                    if (sharedAllianceIds.has(n.id)) return false;
                    // ✅ 排除附庸国（附庸国不应该通过联盟自动参战）
                    if (n.vassalOf === 'player' || n.vassalOf) return false;
                    // ✅ 底线检查：如果这个盟友与玩家的盟友在同一组织，不能号召
                    if (checkAllianceConflict(n.id, potentialPlayerAllies)) return false;
                    return true;
                });
                const playerAllies = nations.filter(n => {

                    if (n.id === nationId || n.id === targetNation.id) return false;
                    if (!playerAllianceIds.includes(n.id)) return false;
                    if (sharedAllianceIds.has(n.id)) return false;
                    // ✅ 排除玩家的附庸（附庸不应该被号召参战）
                    if (n.vassalOf === 'player') return false;
                    // ✅ 底线检查：如果这个盟友与目标的盟友在同一组织，不能号召
                    if (checkAllianceConflict(n.id, potentialTargetAllies)) return false;

                    return true;
                });
                const neutralAllies = nations.filter(n => sharedAllianceIds.has(n.id));
                // ===== 违约后果增强 =====
                let breachConsequences = null;
                if (breachPenalty) {
                    breachConsequences = {
                        // 贸易中断天数（基于时代）
                        tradeBlockadeDays: Math.floor(90 + epoch * 30),
                        // 声誉惩罚比例
                        reputationPenalty: Math.floor(breachPenalty.relationPenalty * 0.3),
                        // 违约记录
                        breachRecord: {
                            targetNationId: nationId,
                            targetNationName: targetNation.name,
                            breachDay: daysElapsed,
                            breachType: 'peace_treaty',
                        },

                    };
                }
                // 对目标国家宣战
                setNations(prev => {
                    let updated = prev.map(n => {
                        if (n.id === nationId) {

                            // 初始化可掠夺储备 = 财富 × 1.5
                            const initialLootReserve = (n.wealth || 500) * 1.5;
                            const nextTreaties = Array.isArray(n.treaties)
                                ? n.treaties.filter(t => !PEACE_TREATY_TYPES.includes(t.type))
                                : n.treaties;
                            const updates = {
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
                                lootReserve: initialLootReserve,
                                lastMilitaryActionDay: undefined,
                            };
                            // 违约后果：贸易中断
                            if (breachConsequences) {
                                updates.tradeBlockadeUntil = daysElapsed + breachConsequences.tradeBlockadeDays;
                                // 记录违约历史

                                updates.breachHistory = [
                                    ...(n.breachHistory || []),
                                    breachConsequences.breachRecord,
                                ];
                            }
                            return updates;
                        }
                        // 违约后果：声誉惩罚（所有其他国家关系下降）
                        if (breachConsequences && n.id !== nationId) {
                            return {
                                ...n,
                                relation: Math.max(0, (n.relation || 50) - breachConsequences.reputationPenalty),

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
                                    relation: applyWarRelationCap((n.relation || 50) - 40, true),
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
                    // [FIX] Player's allies should attack the TARGET and its allies via foreignWars
                    // NOT be set as isAtWar (which means at war WITH the player!)
                    if (playerAllies.length > 0) {
                        // Collect all enemy IDs (target + target's allies)
                        const enemyIds = [nationId, ...targetAllies.map(a => a.id)];
                        
                        updated = updated.map(n => {
                            if (playerAllies.some(ally => ally.id === n.id)) {
                                // Initialize or update foreignWars
                                const newForeignWars = { ...(n.foreignWars || {}) };
                                enemyIds.forEach(enemyId => {
                                    // Skip if already at war with this enemy
                                    if (!newForeignWars[enemyId]?.isAtWar) {
                                        newForeignWars[enemyId] = { 
                                            isAtWar: true, 
                                            warStartDay: daysElapsed, 
                                            warScore: 0,
                                            followingAlliance: true,  // Mark as following alliance obligation
                                            allianceTarget: 'player'  // Track which ally they're defending
                                        };
                                    }
                                });
                                return {
                                    ...n,
                                    foreignWars: newForeignWars,
                                    lastMilitaryActionDay: undefined,
                                };
                            }
                            // Also update enemies to register war with player's allies
                            if (enemyIds.includes(n.id)) {
                                const newForeignWars = { ...(n.foreignWars || {}) };
                                playerAllies.forEach(ally => {
                                    if (!newForeignWars[ally.id]?.isAtWar) {
                                        newForeignWars[ally.id] = {
                                            isAtWar: true,
                                            warStartDay: daysElapsed,
                                            warScore: 0
                                        };
                                    }
                                });
                                return {
                                    ...n,
                                    foreignWars: newForeignWars,
                                };
                            }
                            return n;
                        });
                    }
                    return updated;
                });
                // 违约后果：冻结海外投资
                if (breachConsequences && setOverseasInvestments) {
                    setOverseasInvestments(prev =>
                        (prev || []).map(inv => {
                            if (inv.nationId === nationId) {
                                return {
                                    ...inv,
                                    frozen: true,
                                    frozenReason: 'war_breach',
                                    frozenUntil: daysElapsed + breachConsequences.tradeBlockadeDays,
                                };
                            }
                            return inv;
                        })

                    );
                }
                if (breachPenalty) {
                    addLog(`⚠️ 你撕毁与 ${targetNation.name} 的和平条约！`);
                    addLog(`  📉 关系恶化 -${breachPenalty.relationPenalty}，国际声誉下降 -${breachConsequences.reputationPenalty}`);

                    addLog(`  🚫 贸易中断 ${breachConsequences.tradeBlockadeDays} 天，海外投资冻结`);

                    // Actually reduce diplomatic reputation
                    if (setDiplomaticReputation) {
                        const { newReputation } = calculateReputationChange(
                            diplomaticReputation ?? 50,
                            'breakPeaceTreaty',
                            false  // negative event
                        );
                        setDiplomaticReputation(newReputation);
                    }
                }
                addLog(`⚔️ 你向 ${targetNation.name} 宣战了！`);

                // Ideology event: declare war
                ideologyEventBus.emit(IDEOLOGY_EVENTS.ON_DECLARE_WAR, {
                    targetId: nationId, targetName: targetNation.name
                }, daysElapsed);

                // 主动宣战减少声誉（非违约宣战也会有轻微声誉损失）
                if (!breachPenalty && setDiplomaticReputation) {
                    const { newReputation } = calculateReputationChange(
                        diplomaticReputation ?? 50,
                        'declareWar',
                        false  // negative event
                    );
                    setDiplomaticReputation(newReputation);
                }

                // 通知盟友参战
                if (targetAllies.length > 0) {
                    const allyNames = targetAllies.map(a => a.name).join('、');
                    addLog(`⚔️ ${targetNation.name} 的盟友 ${allyNames} 履行同盟义务，加入了战争！`);

                }
                if (playerAllies.length > 0) {
                    const allyNames = playerAllies.map(a => a.name).join(', ');
                    addLog(`Player allies ${allyNames} joined the war.`);
                }
                // 通知共同盟友保持中立
                if (neutralAllies.length > 0) {
                    neutralAllies.forEach(ally => {
                        addLog(`⚖️ ${ally.name} 同时是你和 ${targetNation.name} 的盟友，选择保持中立。`);
                    });
                }

                // Generate fronts for the new war(s)
                createFrontForWar('player', nationId, targetNation);
                // Also create fronts for allied enemies
                targetAllies.forEach(ally => {
                    createFrontForWar('player', ally.id, ally);
                });

                // 主动宣战后自动暂停，让玩家有时间部署军队
                if (typeof gameState.setIsPaused === 'function') {
                    gameState.setIsPaused(true);
                }

                break;
            }
            // ========================================================================
            // 外交干预操作（支持政府、支持叛军、颠覆活动等）

            // ========================================================================
            case 'foreign_intervention': {
                const { interventionType } = options || {};
                if (!interventionType) {

                    addLog('请选择干预类型。');
                    return;
                }

                const interventionOption = INTERVENTION_OPTIONS[interventionType];
                if (!interventionOption) {
                    addLog('无效的干预类型。');

                    return;

                }
                // 检查冷却
                const lastInterventionDay = targetNation.lastDiplomaticActionDay?.intervention || 0;
                const interventionCooldownDays = applyCooldownModifier(
                    30,
                    (modifiers?.officialEffects?.diplomaticCooldown || 0)
                    + (modifiers?.ideologyRuleMods?.cooldownMod || 0)
                );
                if (daysElapsed - lastInterventionDay < interventionCooldownDays) {
                    addLog(`最近已对 ${targetNation.name} 进行过干预，请等待 ${interventionCooldownDays - (daysElapsed - lastInterventionDay)} 天。`);
                    return;
                }
                // 检查前置条件
                if (interventionOption.requiresCivilWar && !targetNation.isInCivilWar) {
                    addLog(`${targetNation.name} 当前没有内战，无法进行军事干预。`);
                    return;
                }
                // 执行干预
                const result = executeIntervention(targetNation, interventionType, resources);
                if (!result.success) {
                    const reasons = {
                        invalid_intervention: '无效的干预类型',
                        no_civil_war: '该国没有内战',
                        insufficient_silver: '银币不足',
                        insufficient_military: '军力不足',
                    };
                    addLog(`干预失败：${reasons[result.reason] || result.reason}`);
                    return;

                }
                // 扣除资源
                if (result.cost.silver) {
                    setResourcesWithReason(
                        prev => ({ ...prev, silver: Math.max(0, (prev.silver || 0) - result.cost.silver) }),
                        'foreign_intervention_cost',
                        { nationId, interventionType }
                    );
                }
                // 更新目标国家
                setNations(prev => prev.map(n => {
                    if (n.id !== nationId) return n;
                    return {
                        ...n,
                        ...result.nationUpdates,
                        lastDiplomaticActionDay: {
                            ...(n.lastDiplomaticActionDay || {}),
                            intervention: daysElapsed,
                        },

                    };
                }));
                // 根据干预类型生成不同的日志
                const interventionLogs = {
                    support_government: `🏛️ 你决定支持 ${targetNation.name} 的现政权，提供了援助。关系提升。`,
                    support_rebels: `🏴 你秘密资助 ${targetNation.name} 的反对派势力，推动其国内动荡。`,
                    destabilize: `🕵️ 你派遣间谍前往 ${targetNation.name} 进行颠覆活动。`,
                    military_intervention: `⚔️ 你直接派兵干预 ${targetNation.name} 的内战！`,
                    humanitarian_aid: `❤️ 你向 ${targetNation.name} 的受难平民提供人道主义援助。`,
                };
                addLog(interventionLogs[interventionType] || result.message);
                break;
            }
            case 'peace': {
                if (!targetNation.isAtWar) {

                    addLog('当前并未与该国交战。');
                    return;
                }
                // 优先从战线系统读取战争分数（上限±200），nation.warScore 被限制在±100 不够精确
                const relevantFronts = (activeFronts || []).filter(f =>
                    f?.status === 'active' && (
                        (f.attackerId === nationId && f.defenderId === 'player') ||
                        (f.attackerId === 'player' && f.defenderId === nationId)
                    )
                );
                const frontWarScore = relevantFronts.length > 0
                    ? relevantFronts.reduce((sum, f) => sum + getEffectiveFrontWarScore(f), 0)
                    : null;
                const warScore = frontWarScore !== null ? frontWarScore : (targetNation.warScore || 0);
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
                        epoch: epoch || 0,
                    },
                    (proposalType, amount) => {
                        // 叛乱政府求和必须走专用收尾逻辑，否则不会正确结束叛乱态
                        if (targetNation.isRebelNation) {
                            handleDiplomaticAction(nationId, 'finalize_peace', { type: proposalType, value: amount });
                            return;
                        }
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
                const COOLDOWN_DAYS = applyCooldownModifier(
                    120,
                    (modifiers?.officialEffects?.diplomaticCooldown || 0)
                    + (modifiers?.ideologyRuleMods?.cooldownMod || 0)
                );
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
                const shouldReplaceOpenMarket = OPEN_MARKET_TREATY_TYPES.includes(type)
                    && (isOpenMarketActive || hasActiveTreatyType(OPEN_MARKET_TREATY_TYPES));
                if (type === 'investment_pact' && hasActiveTreatyType(['investment_pact'])) {
                    addLog(`与 ${targetNation.name} 的投资协议仍在生效中，无法重复提出。`);
                    return;
                }

                // Enhanced acceptance scoring with more realistic evaluation
                const relation = targetNation.relation || 0;
                const aggression = targetNation.aggression ?? 0.3;
                const treatyConfig = TREATY_CONFIGS[type] || {};

                if (Number.isFinite(treatyConfig.minRelation) && relation < treatyConfig.minRelation) {
                    addLog(`${targetNation.name} 当前关系不足，难以接受该条约。`);
                    return;
                }

                // Lower base acceptance rates - AI should be more selective
                const baseChanceByType = {
                    peace_treaty: 0.30,      // 45% -> 30%
                    non_aggression: 0.22,    // 35% -> 22%
                    trade_agreement: 0.20,   // 32% -> 20%
                    free_trade: 0.15,        // 26% -> 15%
                    investment_pact: 0.12,   // 22% -> 12%
                    open_market: 0.18,       // 30% -> 18%
                    academic_exchange: 0.16, // 25% -> 16%
                    defensive_pact: 0.10,    // 18% -> 10%
                };
                const base = baseChanceByType[type] ?? 0.15;

                // Reduced relation boost - good relations help but not too much
                const relationBoost = Math.max(0, (relation - 50) / 250); // 50=>0, 100=>0.2 (was 0.6)
                const aggressionPenalty = aggression * 0.35; // Increased from 0.25

                // Wealth/Power imbalance penalty - AI is suspicious of much stronger players
                const playerWealth = resources.silver || 0;
                const targetWealth = targetNation.wealth || 1000;
                const playerPower = militaryPower || 0;
                const targetPower = targetNation.militaryPower || 100;

                const wealthRatio = targetWealth > 0 ? playerWealth / targetWealth : 1;
                const powerRatio = targetPower > 0 ? playerPower / targetPower : 1;

                // Penalty for being much stronger (AI fears exploitation)
                let dominancePenalty = 0;
                if (['open_market', 'free_trade', 'investment_pact', 'trade_agreement'].includes(type)) {
                    if (wealthRatio > 1.5) {
                        dominancePenalty += (wealthRatio - 1.5) * 0.15; // Significant penalty
                    }
                    if (powerRatio > 1.5) {
                        dominancePenalty += (powerRatio - 1.5) * 0.08;
                    }
                }

                // Maintenance penalty - scaled to target's wealth
                const maintenanceRatio = targetWealth > 0 ? maintenancePerDay / (targetWealth * 0.001) : 0;
                const maintenancePenalty = Math.min(0.30, maintenanceRatio * 0.5);

                let acceptChance = base + relationBoost - aggressionPenalty - maintenancePenalty - dominancePenalty;

                // Stricter type gating with harsher penalties
                if (type === 'open_market' && relation < 55) acceptChance *= 0.25; // was 0.4
                if (type === 'trade_agreement' && relation < 50) acceptChance *= 0.35; // was 0.5
                if (type === 'free_trade' && relation < 65) acceptChance *= 0.20; // was 0.3
                if (type === 'investment_pact' && relation < 60) acceptChance *= 0.25; // was 0.4
                if (type === 'academic_exchange' && relation < 65) acceptChance *= 0.15; // was 0.2
                if (type === 'defensive_pact' && relation < 70) acceptChance *= 0.12; // was 0.2

                // Additional penalty for low relations
                if (relation < 40) {
                    acceptChance *= 0.5; // 50% penalty for poor relations
                }

                acceptChance = Math.max(0.01, Math.min(0.85, acceptChance)); // Lower max from 0.92 to 0.85
                const accepted = Math.random() < acceptChance;
                // 计算签约成本
                const signingCost = calculateTreatySigningCost(type, resources.silver || 0, targetNation.wealth || 0, epoch);
                const autoMaintenancePerDay = getTreatyDailyMaintenance(type, resources.silver || 0, targetNation.wealth || 0);
                const finalMaintenancePerDay = maintenancePerDay > 0 ? maintenancePerDay : autoMaintenancePerDay;
                // 如果接受，检查并扣除签约成本
                if (accepted && signingCost > 0) {

                    const currentSilver = resources.silver || 0;
                    if (currentSilver < signingCost) {
                        addLog(`📜 签约失败：签约成本 ${signingCost} 银币不足（当前 ${Math.floor(currentSilver)}）。`);
                        return;
                    }
                    setResourcesWithReason(

                        prev => ({ ...prev, silver: Math.max(0, (prev.silver || 0) - signingCost) }),
                        'treaty_signing_cost',
                        { nationId, treatyType: type }
                    );
                }

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
                    const nextTreaties = Array.isArray(n.treaties)

                        ? n.treaties.map(t => {
                            if (!shouldReplaceOpenMarket || !OPEN_MARKET_TREATY_TYPES.includes(t.type)) return t;
                            if (t.endDay != null && t.endDay <= daysElapsed) return t;
                            return { ...t, endDay: daysElapsed };

                        })
                        : [];
                    nextTreaties.push({
                        id: `treaty_${n.id}_${Date.now()}`,
                        type,

                        startDay: daysElapsed,
                        endDay: daysElapsed + durationDays,
                        maintenancePerDay: finalMaintenancePerDay,
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
                        updates.openMarketUntil = daysElapsed + durationDays;
                    }
                    if (PEACE_TREATY_TYPES.includes(type)) {
                        updates.peaceTreatyUntil = Math.max(n.peaceTreatyUntil || 0, daysElapsed + durationDays);
                    }
                    if (type === 'defensive_pact') {
                        updates.alliedWithPlayer = true;
                    }

                    return { ...n, ...updates };
                }));
                const resultEvent = createTreatyProposalResultEvent(targetNation, { type, durationDays, maintenancePerDay: finalMaintenancePerDay }, accepted, () => { });
                triggerDiplomaticEvent(resultEvent);
                if (accepted) {
                    // Honor promise - signing peaceful treaties improves reputation
                    if (setDiplomaticReputation && (type === 'peace' || type === 'non_aggression' || type === 'mutual_defense')) {
                        const { newReputation } = calculateReputationChange(
                            diplomaticReputation ?? 50,
                            'honorPromise',
                            true  // positive event
                        );
                        setDiplomaticReputation(newReputation);
                    }
                    
                    let costInfo = '';
                    if (signingCost > 0) {
                        costInfo = `，签约成本 ${Math.floor(signingCost)} 银币`;

                    }
                    if (finalMaintenancePerDay > 0) {
                        costInfo += `，每日维护费 ${finalMaintenancePerDay} 银币`;
                    }
                    addLog(`📜 ${targetNation.name} 同意了你的条约提案（${type}）${costInfo}。`);

                    // Ideology event: treaty sign
                    ideologyEventBus.emit(IDEOLOGY_EVENTS.ON_TREATY_SIGN, {
                        targetId: nationId, targetName: targetNation.name, treatyType: type
                    }, daysElapsed);
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
                const isOrganizationType = type === 'military_alliance' || type === 'economic_bloc';
                const unlockCategory = isOrganizationType ? 'organizations' : 'treaties';
                if (!isDiplomacyUnlocked(unlockCategory, type, epoch)) {

                    addLog(isOrganizationType ? '该组织尚未解锁，无法谈判。' : '该条约尚未解锁，无法谈判。');
                    if (onResult) onResult({ status: 'blocked', reason: isOrganizationType ? 'org_locked' : 'treaty_locked' });
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
                // Support both old single resource format and new multi-resource format
                const offerResources = Array.isArray(proposal.resources)
                    ? proposal.resources.filter(r => r.key && r.amount > 0).map(r => ({ key: r.key, amount: Math.max(0, Math.floor(Number(r.amount) || 0)) }))
                    : (proposal.resourceKey && proposal.resourceAmount > 0 ? [{ key: proposal.resourceKey, amount: Math.max(0, Math.floor(Number(proposal.resourceAmount) || 0)) }] : []);
                const demandSilver = Math.max(0, Math.floor(Number(proposal.demandSilver) || 0));

                const demandResources = Array.isArray(proposal.demandResources)
                    ? proposal.demandResources.filter(r => r.key && r.amount > 0).map(r => ({ key: r.key, amount: Math.max(0, Math.floor(Number(r.amount) || 0)) }))
                    : (proposal.demandResourceKey && proposal.demandResourceAmount > 0 ? [{ key: proposal.demandResourceKey, amount: Math.max(0, Math.floor(Number(proposal.demandResourceAmount) || 0)) }] : []);
                // Get organization info if relevant
                let organization = null;
                let organizationMode = null;
                const orgType = type === 'military_alliance' ? 'military_alliance' :
                    (type === 'economic_bloc' ? 'economic_bloc' : null);
                if (orgType && proposal.targetOrganizationId && proposal.organizationMode) {
                    const orgs = diplomacyOrganizations?.organizations || [];
                    organization = orgs.find(o => o.id === proposal.targetOrganizationId);
                    organizationMode = proposal.organizationMode;
                }
                // For backward compatibility
                const resourceKey = offerResources[0]?.key || '';

                const resourceAmount = offerResources[0]?.amount || 0;
                const demandResourceKey = demandResources[0]?.key || '';
                const demandResourceAmount = demandResources[0]?.amount || 0;
                const isPeaceActive = targetNation.peaceTreatyUntil && daysElapsed < targetNation.peaceTreatyUntil;
                const isOpenMarketActive = targetNation.openMarketUntil && daysElapsed < targetNation.openMarketUntil;

                const hasActiveTreatyType = (types) => Array.isArray(targetNation.treaties)

                    && targetNation.treaties.some((t) => types.includes(t.type) && (!Number.isFinite(t.endDay) || daysElapsed < t.endDay));
                if (PEACE_TREATY_TYPES.includes(type) && isPeaceActive) {
                    addLog(`与 ${targetNation.name} 的和平/互不侵犯仍在生效中，无法重复谈判。`);
                    if (onResult) onResult({ status: 'blocked', reason: 'peace_active' });
                    return;
                }
                const shouldReplaceOpenMarket = OPEN_MARKET_TREATY_TYPES.includes(type)
                    && (isOpenMarketActive || hasActiveTreatyType(OPEN_MARKET_TREATY_TYPES));
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
                // Validate all offer resources
                for (const res of offerResources) {
                    if (!RESOURCES[res.key] || RESOURCES[res.key].type === 'virtual' || res.key === 'silver') {
                        addLog(`赠送资源 ${res.key} 无效，谈判已取消。`);
                        if (onResult) onResult({ status: 'blocked', reason: 'resource' });
                        return;
                    }
                    if ((resources[res.key] || 0) < res.amount) {
                        addLog(`${RESOURCES[res.key]?.name || res.key} 库存不足，无法作为赠礼。`);
                        if (onResult) onResult({ status: 'blocked', reason: 'resource' });
                        return;
                    }
                }

                // Validate maintenance fee
                const rawMaintenance = Number(proposal.maintenancePerDay);
                if (rawMaintenance < 0) {
                    addLog('条约维护费不能为负数。');
                    if (onResult) onResult({ status: 'blocked', reason: 'invalid_maintenance' });
                    return;
                }

                // Validate demand silver - check if the party being asked has enough
                // For player proposals: check if AI (targetNation) can afford what player demands
                // For AI counter-proposals: check if player can afford what AI demands
                // Debug: log actual values
                console.log('[NEGOTIATE DEBUG]', {
                    demandSilver,
                    targetWealth: targetNation.wealth || 0,
                    playerWealth: resources.silver || 0,
                    rawDemandSilver: proposal.demandSilver,
                    nationName: targetNation.name,
                    isCounterProposal: forceAccept
                });

                // Determine who is being asked to pay
                const isCounterProposal = forceAccept;

                if (demandSilver > 0) {
                    if (isCounterProposal) {
                        // This is AI's counter-proposal, AI is demanding from player
                        // Check if PLAYER can afford
                        if ((resources.silver || 0) < demandSilver) {
                            addLog(`你无法承担对方索要的金额（缺少 ${demandSilver - (resources.silver || 0)} 银币）。`);
                            if (onResult) onResult({ status: 'blocked', reason: 'silver' });
                            return;
                        }
                    } else {
                        // This is player's proposal, player is demanding from AI
                        // Check if AI can afford
                        if ((targetNation.wealth || 0) < demandSilver) {
                            addLog(`${targetNation.name} 无法承担索要金额（缺少 ${demandSilver} 银币）。`);
                            if (onResult) onResult({ status: 'blocked', reason: 'demand_silver' });
                            return;
                        }
                    }
                }
                // Validate all demand resources
                for (const res of demandResources) {

                    if (!RESOURCES[res.key] || RESOURCES[res.key].type === 'virtual' || res.key === 'silver') {
                        addLog(`索要资源 ${res.key} 无效，谈判已取消。`);
                        if (onResult) onResult({ status: 'blocked', reason: 'demand_resource' });
                        return;
                    }
                    const targetInventory = targetNation.inventory?.[res.key] || 0;

                    if (targetInventory < res.amount) {
                        addLog(`${targetNation.name} 无法提供 ${RESOURCES[res.key]?.name || res.key} ×${res.amount}。`);
                        if (onResult) onResult({ status: 'blocked', reason: 'demand_resource' });
                        return;
                    }

                }
                const evaluation = calculateNegotiationAcceptChance({
                    proposal: {
                        type,
                        durationDays,

                        maintenancePerDay,
                        signingGift,
                        resources: offerResources,
                        resourceKey,

                        resourceAmount,
                        demandSilver,
                        demandResources,
                        demandResourceKey,
                        demandResourceAmount,
                    },
                    nation: targetNation,
                    epoch,
                    stance,
                    daysElapsed,
                    playerPower: calculateBattlePower(army, epoch, modifiers?.militaryBonus || 0, 50, modifiers?.ideologyRuleMods || {}),
                    targetPower: calculateNationBattlePower(targetNation, epoch, 1.0, getAIMilitaryStrengthMultiplier(gameState.difficulty || 'normal')),

                    playerWealth: resources?.silver || 0,
                    targetWealth: targetNation?.wealth || 0,
                    playerProduction: productionPerDay?.goods || 0,
                    targetProduction: targetNation?.productionCapacity || targetNation?.economyScore || (targetNation?.wealth || 0) * 0.01,
                    organization,
                    organizationMode,
                });

                // Hard relation gate should block signing entirely (scheme B: show explicit reason)
                if (evaluation?.relationGate) {
                    addLog(`谈判被阻止：关系不足，需要达到 ${Math.round(evaluation.minRelation || 0)}（当前 ${Math.round(targetNation.relation || 0)}）。`);
                    if (onResult) onResult({
                        status: 'blocked',
                        reason: evaluation.blockedReason || 'relation_gate',
                        evaluation,
                        minRelation: evaluation.minRelation,
                        currentRelation: targetNation.relation || 0,
                        acceptChance: evaluation.acceptChance,
                    });
                    return;
                }

                // ✅ Check and deduct stance upfront cost BEFORE negotiation
                const stanceCheck = canAffordStance(stance, resources);

                if (!stanceCheck.canAfford) {
                    const missingResources = Object.entries(stanceCheck.missing)
                        .map(([res, amount]) => `${res}: ${Math.floor(amount)}`)
                        .join(', ');
                    addLog(`❌ 无法使用${NEGOTIATION_STANCES[stance]?.name || stance}姿态：资源不足 (${missingResources})`);
                    if (onResult) onResult({
                        status: 'blocked',
                        reason: 'stance_cost',
                        missing: stanceCheck.missing,
                    });
                    return;
                }

                // Deduct stance upfront cost
                for (const [resource, cost] of Object.entries(stanceCheck.cost)) {
                    if (cost > 0) {
                        setResourcesWithReason(
                            prev => ({ ...prev, [resource]: Math.max(0, (prev[resource] || 0) - cost) }),
                            'treaty_negotiate_stance_cost',
                            { nationId, treatyType: type, stance, resource, cost }
                        );
                    }
                }

                // ✅ Apply guaranteed stance effects (relation/reputation changes)
                const stanceConfig = NEGOTIATION_STANCES[stance];
                let guaranteedRelationChange = stanceConfig?.guaranteedEffects?.relationChange || 0;
                let guaranteedReputationChange = stanceConfig?.guaranteedEffects?.reputationChange || 0;

                const accepted = forceAccept || (evaluation.dealScore || 0) >= 0;

                const stanceDelta = guaranteedRelationChange;

                // Deduct political cost for aggressive/threat stance (regardless of outcome)
                const politicalCost = evaluation?.breakdown?.politicalCost || 0;
                if (politicalCost > 0) {
                    setResourcesWithReason(
                        prev => ({ ...prev, political_power: Math.max(0, (prev.political_power || 0) - politicalCost) }),
                        'treaty_negotiate_political_cost',
                        { nationId, treatyType: type, stance, cost: politicalCost }
                    );
                }

                // 计算签约成本

                const negotiateSigningCost = calculateTreatySigningCost(type, resources.silver || 0, targetNation.wealth || 0, epoch);

                const negotiateAutoMaintenancePerDay = getTreatyDailyMaintenance(type, resources.silver || 0, targetNation.wealth || 0);
                const negotiateFinalMaintenancePerDay = maintenancePerDay > 0 ? maintenancePerDay : negotiateAutoMaintenancePerDay;
                if (accepted) {
                    // Honor promise - signing peaceful treaties improves reputation
                    if (setDiplomaticReputation && (type === 'peace' || type === 'non_aggression' || type === 'mutual_defense')) {
                        const { newReputation } = calculateReputationChange(
                            diplomaticReputation ?? 50,
                            'honorPromise',
                            true  // positive event
                        );
                        setDiplomaticReputation(newReputation);
                    }
                    
                    // 检查并扣除签约成本
                    if (negotiateSigningCost > 0) {

                        const currentSilver = resources.silver || 0;
                        const totalCostNeeded = negotiateSigningCost + signingGift;
                        if (currentSilver < totalCostNeeded) {
                            addLog(`📜 签约失败：签约成本 ${Math.floor(negotiateSigningCost)} + 赠礼 ${signingGift} = ${Math.floor(totalCostNeeded)} 银币不足（当前 ${Math.floor(currentSilver)}）。`);
                            if (onResult) onResult({ status: 'blocked', reason: 'silver' });
                            return;
                        }
                        setResourcesWithReason(
                            prev => ({ ...prev, silver: Math.max(0, (prev.silver || 0) - negotiateSigningCost) }),
                            'treaty_negotiate_signing_cost',

                            { nationId, treatyType: type }
                        );
                    }
                    if (signingGift > 0) {
                        setResourcesWithReason(
                            prev => ({ ...prev, silver: Math.max(0, (prev.silver || 0) - signingGift) }),
                            'treaty_negotiate_signing_gift',
                            { nationId, treatyType: type }

                        );
                    }
                    // Deduct all offer resources
                    for (const res of offerResources) {
                        if (res.amount > 0 && res.key) {
                            setResourcesWithReason(
                                prev => ({ ...prev, [res.key]: Math.max(0, (prev[res.key] || 0) - res.amount) }),
                                'treaty_negotiate_resource_gift',
                                { nationId, treatyType: type, resourceKey: res.key, amount: res.amount }
                            );
                        }
                    }

                    setNations(prev => prev.map(n => {
                        if (n.id !== nationId) return n;
                        const nextTreaties = Array.isArray(n.treaties)

                            ? n.treaties.map(t => {
                                if (!shouldReplaceOpenMarket || !OPEN_MARKET_TREATY_TYPES.includes(t.type)) return t;

                                if (t.endDay != null && t.endDay <= daysElapsed) return t;

                                return { ...t, endDay: daysElapsed };
                            })
                            : [];
                        // [FIX] Only add to treaties array if NOT an organization type
                        // Organization types (military_alliance, economic_bloc) should be handled
                        // by the organization system, not stored as individual treaties
                        if (!isOrganizationType) {
                            nextTreaties.push({
                                id: `treaty_${n.id}_${Date.now()}`,
                                type,
                                startDay: daysElapsed,

                                endDay: daysElapsed + durationDays,

                                maintenancePerDay: negotiateFinalMaintenancePerDay,

                                direction: 'player_to_ai',
                            });
                        }
                        const newWealth = (n.wealth || 0) + signingGift - demandSilver;
                        const updates = {
                            treaties: nextTreaties,

                            relation: clampRelation((n.relation || 0) + 6 + stanceDelta),
                            wealth: newWealth,
                            lastDiplomaticActionDay: {
                                ...(n.lastDiplomaticActionDay || {}),
                                negotiate_treaty: daysElapsed,
                            },
                            // [FIX] 立即更新 aiEconomyMetrics，使 UI 财政储备/财富显示即时反映变化
                            // 否则需等到下一 tick AIEconomyService 重算才能看到变化
                            aiEconomyMetrics: n.aiEconomyMetrics ? {
                                ...n.aiEconomyMetrics,
                                liquidWealth: Math.max(0, newWealth),
                                wealthStock: Math.max(0, (n.aiEconomyMetrics.wealthStock || 0) + signingGift - demandSilver),
                                nationalNetWorth: Math.max(0, (n.aiEconomyMetrics.nationalNetWorth || 0) + signingGift - demandSilver),
                                // treasury 基于 budget 计算，不直接等于 wealth，但赠送银币后应同步增加
                                treasury: Math.max(0, (n.aiEconomyMetrics.treasury || 0) + signingGift - demandSilver),
                            } : n.aiEconomyMetrics,
                        };
                        if (resourceAmount > 0 && resourceKey) {
                            updates.inventory = {
                                ...(n.inventory || {}),
                                [resourceKey]: ((n.inventory || {})[resourceKey] || 0) + resourceAmount,
                            };
                        }

                        // Add all offer resources to target nation inventory
                        for (const res of offerResources) {

                            if (res.amount > 0 && res.key) {
                                updates.inventory = {
                                    ...(updates.inventory || n.inventory || {}),
                                    [res.key]: ((updates.inventory || n.inventory || {})[res.key] || 0) + res.amount,
                                };
                            }
                        }
                        // Remove all demand resources from target nation inventory
                        for (const res of demandResources) {
                            if (res.amount > 0 && res.key) {

                                updates.inventory = {
                                    ...(updates.inventory || n.inventory || {}),
                                    [res.key]: Math.max(0, ((updates.inventory || n.inventory || {})[res.key] || 0) - res.amount),
                                };
                            }
                        }
                        if (OPEN_MARKET_TREATY_TYPES.includes(type)) {
                            updates.openMarketUntil = daysElapsed + durationDays;
                        }
                        if (PEACE_TREATY_TYPES.includes(type)) {
                            updates.peaceTreatyUntil = Math.max(n.peaceTreatyUntil || 0, daysElapsed + durationDays);
                        }
                        if (type === 'defensive_pact') {
                            updates.alliedWithPlayer = true;
                        }

                        return { ...n, ...updates };
                    }));
                    if (isOrganizationType && organization && organizationMode) {
                        const orgConfig = ORGANIZATION_TYPE_CONFIGS[organization.type];
                        const leaderId = organization.leaderId ?? organization.founderId;
                        const playerOrgMemberId = 'player'; // Player's ID in organization membership

                        // Authority rules:
                        // - invite: only organization leader can invite others
                        // - kick: only organization leader can kick others (and cannot kick founder)
                        // - join: only allows the negotiating party to join the other side's organization
                        if (organizationMode === 'invite') {
                            const hasAuthority = String(leaderId) === String(playerOrgMemberId);
                            if (!hasAuthority) {
                                addLog(`🏛️ 操作无效：你不是组织「${organization.name}」的领导国，无法邀请其他国家加入。`);
                            } else {
                                updateOrganizationState(prev => prev.map(o => {
                                    if (o.id !== organization.id) return o;
                                    const members = Array.isArray(o.members) ? o.members : [];

                                    if (members.includes(nationId)) return o;
                                    const maxMembers = getOrganizationMaxMembers(o.type, epoch);
                                    if (members.length >= maxMembers) return o;
                                    return { ...o, members: [...members, nationId] };
                                }));
                                setNations(prev => prev.map(n => {
                                    if (n.id !== nationId) return n;
                                    const memberships = Array.isArray(n.organizationMemberships) ? n.organizationMemberships : [];
                                    return {
                                        ...n,
                                        organizationMemberships: memberships.includes(organization.id)
                                            ? memberships
                                            : [...memberships, organization.id],

                                    };
                                }));
                            }

                        } else if (organizationMode === 'join') {
                            updateOrganizationState(prev => prev.map(o => {
                                if (o.id !== organization.id) return o;
                                const members = Array.isArray(o.members) ? o.members : [];
                                if (members.includes(playerOrgMemberId)) return o;
                                const maxMembers = getOrganizationMaxMembers(o.type, epoch);
                                if (members.length >= maxMembers) return o;
                                return { ...o, members: [...members, playerOrgMemberId] };
                            }));

                        } else if (organizationMode === 'kick') {
                            const hasAuthority = String(leaderId) === String(playerOrgMemberId);
                            if (!hasAuthority) {
                                addLog(`🏛️ 操作无效：你不是组织「${organization.name}」的领导国，无法将成员国移除。`);
                            } else if (String(nationId) === String(organization.founderId)) {
                                addLog(`🏛️ 操作无效：无法将组织创始国移除。`);
                            } else {
                                updateOrganizationState(prev => prev.map(o => {
                                    if (o.id !== organization.id) return o;
                                    const members = Array.isArray(o.members) ? o.members : [];

                                    return { ...o, members: members.filter(m => String(m) !== String(nationId)) };
                                }));
                                setNations(prev => prev.map(n => {
                                    if (n.id !== nationId) return n;
                                    const memberships = Array.isArray(n.organizationMemberships) ? n.organizationMemberships : [];
                                    const relationPenalty = orgConfig?.kickRelationPenalty || -20;
                                    return {
                                        ...n,
                                        relation: clampRelation((n.relation || 0) + relationPenalty),
                                        organizationMemberships: memberships.filter(id => id !== organization.id),

                                    };
                                }));
                            }
                        }
                    }
                    if (demandSilver > 0) {
                        setResourcesWithReason(
                            prev => ({ ...prev, silver: (prev.silver || 0) + demandSilver }),
                            'treaty_negotiate_demand_silver',
                            { nationId, treatyType: type }
                        );
                    }
                    // Receive all demand resources
                    for (const res of demandResources) {
                        if (res.amount > 0 && res.key) {
                            setResourcesWithReason(
                                prev => ({
                                    ...prev,
                                    [res.key]: (prev[res.key] || 0) + res.amount,
                                }),
                                'treaty_negotiate_demand_resource',

                                { nationId, treatyType: type, resourceKey: res.key, amount: res.amount }
                            );
                        }

                    }
                    let negotiateCostInfo = '';
                    if (negotiateSigningCost > 0) {
                        negotiateCostInfo = `，签约成本 ${Math.floor(negotiateSigningCost)} 银币`;

                    }

                    if (negotiateFinalMaintenancePerDay > 0) {
                        negotiateCostInfo += `，每日维护费 ${negotiateFinalMaintenancePerDay} 银币`;
                    }

                    if (politicalCost > 0) {
                        negotiateCostInfo += `，政治成本 ${politicalCost}`;
                    }

                    if (demandSilver > 0 || demandResources.length > 0) {
                        const demandParts = [];
                        if (demandSilver > 0) demandParts.push(`索要 ${demandSilver} 银币`);
                        for (const res of demandResources) {
                            if (res.amount > 0) {

                                const name = RESOURCES[res.key]?.name || res.key;
                                demandParts.push(`索要 ${name}×${res.amount}`);
                            }
                        }

                        negotiateCostInfo += `，${demandParts.join('，')}`;
                    }
                    addLog(`🤝 ${targetNation.name} 同意了谈判条约（${type}）${negotiateCostInfo}。`);

                    // Trigger diplomatic event for accepted negotiation
                    const acceptedEvent = createTreatyProposalResultEvent(
                        targetNation,
                        { type, durationDays, maintenancePerDay: negotiateFinalMaintenancePerDay },
                        true,
                        () => { }
                    );
                    triggerDiplomaticEvent(acceptedEvent);

                    if (onResult) onResult({ status: 'accepted', acceptChance: evaluation.acceptChance, evaluation });
                    break;
                }
                const counterProposal = !forceAccept && round < maxRounds
                    ? generateCounterProposal({
                        proposal: {
                            type,
                            durationDays,
                            maintenancePerDay,

                            signingGift,
                            resources: offerResources,
                            resourceKey,
                            resourceAmount,
                            demandSilver,

                            demandResources,
                            demandResourceKey,
                            demandResourceAmount,
                            targetOrganizationId: proposal.targetOrganizationId,
                            organizationMode: proposal.organizationMode,
                        },
                        nation: targetNation,
                        round,
                        daysElapsed,
                        playerPower: calculateBattlePower(army, epoch, modifiers?.militaryBonus || 0, 50, modifiers?.ideologyRuleMods || {}),
                        targetPower: calculateNationBattlePower(targetNation, epoch, 1.0, getAIMilitaryStrengthMultiplier(gameState.difficulty || 'normal')),
                        playerWealth: resources?.silver || 0,
                        targetWealth: targetNation?.wealth || 0,

                        playerProduction: productionPerDay?.goods || 0,
                        targetProduction: targetNation?.productionCapacity || targetNation?.economyScore || (targetNation?.wealth || 0) * 0.01,
                        organization,
                        organizationMode,
                    })

                    : null;
                if (counterProposal) {
                    // Apply guaranteed stance effects on counter-proposal
                    const counterDelta = guaranteedRelationChange;
                    setNations(prev => prev.map(n =>
                        n.id === nationId
                            ? { ...n, relation: clampRelation((n.relation || 0) + counterDelta) }
                            : n
                    ));
                    const costMsg = politicalCost > 0 ? `（政治成本 ${politicalCost}）` : '';
                    const stanceMsg = stanceConfig?.name ? `（${stanceConfig.name}姿态）` : '';
                    addLog(`${targetNation.name} 提出了反提案${stanceMsg}${costMsg}。`);
                    if (onResult) onResult({ status: 'counter', counterProposal, acceptChance: evaluation.acceptChance, evaluation });
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
                if ((evaluation.dealScore || 0) < 0) {
                    const costMsg = politicalCost > 0 ? `（政治成本 ${politicalCost}）` : '';
                    addLog(`${targetNation.name} 认为筹码不足，谈判失败（差额 ${Math.round(Math.abs(evaluation.dealScore || 0))}）${costMsg}。`);
                } else {
                    const costMsg = politicalCost > 0 ? `（政治成本 ${politicalCost}）` : '';
                    addLog(`${targetNation.name} 拒绝了谈判，双方关系下降${costMsg}。`);
                }

                // Trigger diplomatic event for rejected negotiation
                const rejectedEvent = createTreatyProposalResultEvent(
                    targetNation,
                    { type, durationDays, maintenancePerDay: negotiateFinalMaintenancePerDay },
                    false,
                    () => { }
                );
                triggerDiplomaticEvent(rejectedEvent);

                if (onResult) onResult({
                    status: 'rejected',
                    acceptChance: evaluation.acceptChance,
                    evaluation,
                    reason: (evaluation?.dealScore || 0) < 0 ? 'deal_insufficient' : 'refused',
                    dealScore: evaluation?.dealScore || 0,
                });
                break;
            }
            case 'break_treaty': {
                // 玩家主动毁约
                const treatyType = payload?.treatyType;
                if (!treatyType) {
                    addLog('毁约失败：缺少条约类型。');
                    return;
                }

                // 检查是否存在该条约
                const existingTreaty = targetNation.treaties?.find(t => t.type === treatyType);
                if (!existingTreaty) {
                    addLog(`你与 ${targetNation.name} 没有 ${treatyType} 条约。`);
                    return;
                }

                // 计算毁约惩罚
                const breachPenalty = getTreatyBreachPenalty(epoch);
                const breachConsequences = {
                    reputationPenalty: Math.floor(breachPenalty.relationPenalty * 0.5), // 声誉损失
                    tradeBlockadeDays: breachPenalty.cooldownDays, // 贸易中断天数
                };

                // 移除条约
                setNations(prev => prev.map(n => {
                    if (n.id === nationId) {
                        return {
                            ...n,
                            relation: Math.max(0, (n.relation || 50) - breachPenalty.relationPenalty),
                            treaties: (n.treaties || []).filter(t => t.type !== treatyType),
                            lastTreatyBreachDay: daysElapsed,
                            lastDiplomaticActionDay: {
                                ...(n.lastDiplomaticActionDay || {}),
                                break_treaty: daysElapsed,
                            },
                        };
                    }
                    return n;
                }));

                // 冻结海外投资
                if (setOverseasInvestments) {
                    setOverseasInvestments(prev =>
                        (prev || []).map(inv => {
                            if (inv.nationId === nationId) {
                                return {
                                    ...inv,
                                    frozen: true,
                                    frozenReason: 'treaty_breach',
                                    frozenUntil: daysElapsed + breachConsequences.tradeBlockadeDays,
                                };
                            }
                            return inv;
                        })
                    );
                }

                // 降低外交声誉
                if (setDiplomaticReputation) {
                    const { newReputation } = calculateReputationChange(
                        diplomaticReputation ?? 50,
                        'breakPeaceTreaty', // 复用和平条约违约的声誉惩罚
                        false
                    );
                    setDiplomaticReputation(newReputation);
                }

                addLog(`⚠️ 你撕毁了与 ${targetNation.name} 的 ${treatyType} 条约！`);

                // Ideology event: treaty break
                ideologyEventBus.emit(IDEOLOGY_EVENTS.ON_TREATY_BREAK, {
                    targetId: nationId, targetName: targetNation.name, treatyType
                }, daysElapsed);

                addLog(`  📉 关系恶化 -${breachPenalty.relationPenalty}，国际声誉下降 -${breachConsequences.reputationPenalty}`);
                addLog(`  🚫 贸易中断 ${breachConsequences.tradeBlockadeDays} 天，海外投资冻结`);
                addLog(`  ⏳ ${breachPenalty.cooldownDays} 天内无法再次毁约`);

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
                // Support solo creation (player starts it) OR joint creation (with targetNation)
                const isSolo = nationId === 'player';
                if (!isSolo && targetNation.isAtWar) {

                    addLog(`无法创建组织：${targetNation.name} 正与你交战。`);
                    return;
                }
                const existing = getPlayerOrganizationByType(type);
                if (existing) {
                    addLog('你已拥有该类型的组织。');
                    return;
                }
                // If not solo, check relation
                if (!isSolo) {
                    const relation = targetNation.relation || 0;
                    const minRelation = type === 'military_alliance' ? 60 : 50;
                    if (relation < minRelation) {
                        addLog(`关系不足（需要${minRelation}），无法与 ${targetNation.name} 共建组织。`);
                        return;
                    }

                }
                // Calculate and check create cost
                const orgConfig = ORGANIZATION_TYPE_CONFIGS[type];
                const playerSilver = resources.silver || 0;
                const createCost = orgConfig ? Math.floor(playerSilver * orgConfig.createCost) : 0;
                if (createCost > 0 && playerSilver < createCost) {
                    addLog(`创建${orgConfig.name}需要 ${createCost} 银币，你的资金不足。`);

                    return;
                }
                const orgName = payload?.name || (
                    isSolo
                        ? (type === 'military_alliance' ? 'New Alliance' : 'New Bloc')
                        : (type === 'economic_bloc' ? `${targetNation.name} Co-Prosperity` : `${targetNation.name} Pact`)
                );
                const initialMembers = isSolo ? ['player'] : ['player', nationId];
                const org = {
                    id: `org_${type}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,

                    type,
                    name: orgName,

                    founderId: 'player',
                    members: initialMembers,
                    createdDay: daysElapsed,
                    isActive: true,
                };
                // Deduct create cost
                if (createCost > 0) {
                    setResourcesWithReason(prev => ({ ...prev, silver: prev.silver - createCost }), 'create_organization', { orgName: org.name });
                    addLog(`💰 创建组织花费 ${createCost} 银币。`);
                }
                updateOrganizationState(prev => [...prev, org]);
                if (!isSolo) {
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
                    addLog(`你与 ${targetNation.name} 建立了新的组织：${orgName}。`);
                } else {
                    addLog(`你建立了新的组织：${orgName}。`);
                }
                break;
            }
            case 'join_org': {
                const type = payload?.type;
                const orgId = payload?.orgId;
                // If orgId provided, find that specific org
                // If type provided, find player's org of that type (for inviting others)
                let org = null;
                if (orgId) {
                    org = organizations.find(o => o?.id === orgId);
                } else if (type) {
                    org = getPlayerOrganizationByType(type);
                }
                const joinerName = nationId === 'player' ? '你' : (targetNation?.name || '未知国家');
                if (!org) {
                    addLog(nationId === 'player' ? '找不到该组织。' : '没有可邀请加入的组织。');
                    return;
                }
                if (!isDiplomacyUnlocked('organizations', org.type, epoch)) {
                    addLog('该组织尚未解锁。');
                    return;
                }
                // If inviting AI (nationId != player), check target status
                if (nationId !== 'player') {
                    if (targetNation.isAtWar) {
                        addLog(`无法邀请：${targetNation.name} 正与你交战。`);
                        return;
                    }

                }
                if (isNationInOrganization(org, nationId)) {

                    addLog(`${joinerName} 已是该组织成员。`);
                    return;
                }
                // Checks for AI joining (relation check)
                if (nationId !== 'player') {
                    const relation = targetNation.relation || 0;
                    const minRelation = org.type === 'military_alliance' ? 55 : 45;

                    if (relation < minRelation) {
                        addLog(`关系不足（需要${minRelation}），无法邀请加入。`);
                        return;
                    }
                } else {
                    // Implementation detail: we could check relation with org.founderId
                    const leaderId = org.leaderId || org.founderId;
                    if (leaderId && leaderId !== 'player') {
                        const leaderNation = nations.find(n => n.id === leaderId);
                        if (leaderNation && leaderNation.isAtWar) {
                            addLog(`无法加入：该组织领袖 ${leaderNation.name} 正与你交战。`);
                            return;
                        }

                    }
                }
                updateOrganizationState(prev => prev.map(o => {
                    if (o.id !== org.id) return o;
                    const members = Array.isArray(o.members) ? o.members : [];
                    return {
                        ...o,
                        members: members.includes(nationId) ? members : [...members, nationId],
                    };
                }));
                if (nationId !== 'player') {
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
                } else {
                    // For now, minimal effect.
                }
                addLog(`${joinerName} 加入了 ${org.name}。`);
                break;
            }
            case 'leave_org': {
                const orgId = payload?.orgId;
                const org = orgId
                    ? organizations.find(o => o?.id === orgId)
                    : organizations.find(o => isNationInOrganization(o, nationId));

                const leaverName = targetNation ? targetNation.name : '你';
                const isPlayerLeaving = nationId === 'player';
                if (!org || !isNationInOrganization(org, nationId)) {
                    addLog(`${leaverName} 当前不在任何可移除的组织中。`);
                    return;
                }
                // Calculate leave cost and penalties using organization config
                const orgConfig = ORGANIZATION_TYPE_CONFIGS[org.type];
                const isFounder = org.founderId === nationId;
                const leaveCostRate = isFounder ? (orgConfig?.founderLeaveCost || 0.08) : (orgConfig?.leaveCost || 0.03);
                const relationPenalty = isFounder ? (orgConfig?.founderLeaveRelationPenalty || -25) : (orgConfig?.leaveRelationPenalty || -15);

                const willDisband = isFounder && (orgConfig?.founderLeaveDisbands !== false);
                // Player leaving: check and deduct cost
                if (isPlayerLeaving) {
                    const playerSilver = resources.silver || 0;
                    const leaveCost = Math.floor(playerSilver * leaveCostRate);
                    if (leaveCost > 0 && playerSilver < leaveCost) {
                        addLog(`退出${org.name}需要支付 ${leaveCost} 银币的违约金，你的资金不足。`);
                        return;
                    }
                    if (leaveCost > 0) {
                        setResourcesWithReason(prev => ({ ...prev, silver: prev.silver - leaveCost }), 'leave_organization', { orgId: org.id });
                        addLog(`💰 退出组织支付违约金 ${leaveCost} 银币。`);
                    }
                }
                // If founder leaves and org disbands
                if (willDisband) {
                    const memberIds = Array.isArray(org.members) ? org.members : [];

                    // Apply relation penalty + remove memberships from all nations that are (or were) members
                    // Also remove player's membership if player was in this org.
                    if (memberIds.length > 0) {
                        if (memberIds.includes('player')) {
                            // Minimal bookkeeping: player doesn't have organizationMemberships array, but we should still log clearly.
                        }
                        setNations(prev => prev.map(n => {
                            if (!memberIds.includes(n.id)) return n;
                            const memberships = Array.isArray(n.organizationMemberships) ? n.organizationMemberships : [];
                            return {
                                ...n,
                                relation: clampRelation((n.relation || 0) + relationPenalty),
                                organizationMemberships: memberships.filter(id => id !== org.id),
                            };
                        }));
                    }

                    // Remove the organization entirely
                    updateOrganizationState(prev => prev.filter(o => o.id !== org.id));

                    addLog(`⚠️ ${leaverName}（创始国）退出了 ${org.name}，组织已解散！所有成员关系 ${relationPenalty}。`);
                } else {
                    // Regular member leaving - just remove from org
                    updateOrganizationState(prev => prev.map(o => {

                        if (o.id !== org.id) return o;
                        const members = Array.isArray(o.members) ? o.members : [];
                        return {
                            ...o,
                            members: members.filter(m => m !== nationId),

                        };
                    }));
                    // Apply relation penalty
                    if (isPlayerLeaving) {
                        // Player leaving: penalize relation with all remaining members
                        const remainingMembers = (org.members || []).filter(m => m !== 'player');
                        if (remainingMembers.length > 0) {
                            setNations(prev => prev.map(n => {
                                if (!remainingMembers.includes(n.id)) return n;

                                return {
                                    ...n,
                                    relation: clampRelation((n.relation || 0) + relationPenalty),
                                };
                            }));
                        }
                        addLog(`${leaverName} 已退出 ${org.name}。与组织成员关系 ${relationPenalty}。`);
                    } else {

                        // AI nation leaving
                        setNations(prev => prev.map(n => {
                            if (n.id !== nationId) return n;
                            const memberships = Array.isArray(n.organizationMemberships) ? n.organizationMemberships : [];
                            return {

                                ...n,

                                relation: clampRelation((n.relation || 0) + relationPenalty),
                                organizationMemberships: memberships.filter(id => id !== org.id),
                                lastDiplomaticActionDay: {
                                    ...(n.lastDiplomaticActionDay || {}),
                                    leave_org: daysElapsed,
                                },
                            };
                        }));

                        addLog(`${leaverName} 已退出 ${org.name}。关系 ${relationPenalty}。`);
                    }
                }
                break;
            }

            // Kick member from organization (via negotiation)

            case 'kick_member': {
                const orgId = payload?.orgId;
                const targetMemberId = payload?.targetMemberId || nationId;
                const org = organizations.find(o => o?.id === orgId);
                if (!org) {
                    addLog('找不到指定的组织。');
                    return;
                }
                // Check if player is in the organization
                if (!isNationInOrganization(org, 'player')) {
                    addLog('你不是该组织的成员，无权移除其他成员。');
                    return;
                }
                // Check if target is in the organization
                if (!isNationInOrganization(org, targetMemberId)) {
                    addLog('目标国家不是该组织的成员。');
                    return;
                }
                // Cannot kick yourself
                if (targetMemberId === 'player') {
                    addLog('无法移除自己，请使用退出组织功能。');
                    return;
                }
                // Cannot kick the founder
                if (targetMemberId === org.founderId) {
                    addLog('无法移除组织的创始国。');
                    return;
                }
                const kickedNation = nations.find(n => n.id === targetMemberId);
                const kickedName = kickedNation?.name || '未知国家';
                const orgConfig = ORGANIZATION_TYPE_CONFIGS[org.type];

                const kickRelationPenalty = orgConfig?.kickRelationPenalty || -20;

                // Remove from organization
                updateOrganizationState(prev => prev.map(o => {
                    if (o.id !== org.id) return o;
                    const members = Array.isArray(o.members) ? o.members : [];
                    return {
                        ...o,
                        members: members.filter(m => m !== targetMemberId),
                    };

                }));
                // Apply relation penalty to the kicked nation
                setNations(prev => prev.map(n => {
                    if (n.id !== targetMemberId) return n;
                    const memberships = Array.isArray(n.organizationMemberships) ? n.organizationMemberships : [];
                    return {
                        ...n,

                        relation: clampRelation((n.relation || 0) + kickRelationPenalty),
                        organizationMemberships: memberships.filter(id => id !== org.id),
                        lastDiplomaticActionDay: {
                            ...(n.lastDiplomaticActionDay || {}),

                            kicked_from_org: daysElapsed,
                        },
                    };
                }));
                addLog(`⚠️ ${kickedName} 已被移除出 ${org.name}！与其关系 ${kickRelationPenalty}。`);
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
                        const vassalCount = (nations || []).filter(n => n.vassalOf === 'player').length;
                        const { canEstablish, reason } = canEstablishVassal(targetNation, vassalType, {
                            epoch,
                            playerMilitary: Math.max(0.5, playerMilitary),
                            warScore: Math.abs(warScore),
                            vassalCount,
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

                    // Peaceful independence grants reputation bonus
                    if (setDiplomaticReputation) {
                        const { newReputation } = calculateReputationChange(
                            diplomaticReputation ?? 50,
                            'peacefulIndependence',
                            true  // positive event
                        );
                        setDiplomaticReputation(newReputation);
                        addLog(`  ✨ 和平释放附庸国，外交声誉 +15`);
                    }

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

            case 'request_force': {
                const result = requestExpeditionaryForce(targetNation);
                if (result.success) {
                    // Grant manpower/units to player
                    // Assuming 1 unit = 100 manpower
                    const unitCount = Math.floor((result.manpower || 0) / 100);
                    if (unitCount > 0) {
                        const unitId = 'infantry_line'; // Default unit
                        // Check if unit unlocked
                        const unitConfig = UNIT_TYPES[unitId];
                        if (unitConfig && unitConfig.epoch <= epoch) {
                            const newItems = Array(unitCount).fill(null).map(() => ({

                                unitId,
                                status: 'waiting',
                                remainingTime: 1,
                                totalTime: 1,
                                isFree: true // Mark as free/volunteer
                            }));
                            setMilitaryQueue(prev => [...prev, ...newItems]);
                        }
                    }
                    // Deduct manpower from vassal
                    setNations(prev => prev.map(n => n.id === nationId ? { ...n, manpower: Math.max(0, (n.manpower || 0) - result.manpower) } : n));
                    addLog(result.message);
                } else {

                    addLog(result.message);
                }
                break;
            }
            case 'call_to_arms': {
                const result = requestWarParticipation(targetNation, null, resources.silver || 0);
                if (result.success) {
                    // Identify player's enemies
                    const playerEnemies = nations.filter(n =>
                        n.isAtWar === true &&           // Nation is at war with player
                        !n.isRebelNation &&            // Not a rebel
                        n.vassalOf !== 'player' &&     // Not player's vassal
                        n.id !== nationId              // Not the vassal we're calling to arms
                    );

                    if (playerEnemies.length === 0) {
                        alert(`当前没有与你交战的敌国，无需征召 ${targetNation.name} 参战。`);
                        addLog(`⚠️ 当前没有与你交战的敌国，无需征召 ${targetNation.name} 参战。`);
                        break;
                    }

                    // Check if vassal is already at war with all player's enemies (prevent duplicate call)
                    const vassalForeignWars = targetNation.foreignWars || {};
                    const newEnemiesToFight = playerEnemies.filter(enemy => !vassalForeignWars[enemy.id]?.isAtWar);

                    if (newEnemiesToFight.length === 0) {
                        alert(`${targetNation.name} 已经在与你的所有敌人交战中，无需重复征召！`);
                        addLog(`⚠️ ${targetNation.name} 已经在与你的所有敌人交战中。`);
                        break;
                    }

                    // Deduct cost only when there's actually something to do
                    setResourcesWithReason(prev => ({ ...prev, silver: prev.silver - result.cost }), 'call_to_arms', { nationId });

                    setNations(prev => prev.map(n => {
                        if (n.id === nationId) {
                            // Set Vassal to War against player's enemies
                            const newForeignWars = { ...(n.foreignWars || {}) };
                            newEnemiesToFight.forEach(enemy => {
                                newForeignWars[enemy.id] = {
                                    isAtWar: true,
                                    warStartDay: daysElapsed,
                                    warScore: 0,
                                    followingSuzerain: true,  // Mark as following suzerain's war
                                    suzerainTarget: 'player'
                                };
                            });
                            return { ...n, foreignWars: newForeignWars };
                        }
                        // Also set the enemy's foreignWars to include this vassal
                        if (newEnemiesToFight.some(e => e.id === n.id)) {
                            const newForeignWars = { ...(n.foreignWars || {}) };
                            if (!newForeignWars[nationId]?.isAtWar) {
                                newForeignWars[nationId] = {
                                    isAtWar: true,
                                    warStartDay: daysElapsed,
                                    warScore: 0
                                };
                            }
                            return { ...n, foreignWars: newForeignWars };
                        }
                        return n;
                    }));

                    const enemyNames = newEnemiesToFight.map(e => e.name).join('、');
                    alert(`征召成功！${targetNation.name} 将与 ${enemyNames} 交战，花费 ${result.cost} 银币。`);
                    addLog(`⚔️ ${targetNation.name} 同意参战，将与 ${enemyNames} 交战！花费 ${result.cost} 银币。`);
                } else {
                    alert(`征召失败：${result.message}`);
                    addLog(result.message);
                }
                break;
            }
            case 'demand_investment': {
                // Find a building that player already has and can be invested

                // Priority: factory > farm > other buildings player owns
                // [FIX] Use shared building selection logic with proper filtering
                // Import and use selectBestInvestmentBuilding for unified logic
                import('../logic/diplomacy/autonomousInvestment').then(({ selectBestInvestmentBuilding }) => {

                    const result = selectBestInvestmentBuilding({
                        targetBuildings: buildings || {},
                        targetJobFill: {}, // Player's jobFill not available here, skip staffing check
                        epoch: epoch,
                        market: market,

                        investorWealth: targetNation.wealth || 0,
                        foreignInvestments: foreignInvestments || [] // [NEW] Pass existing foreign investments to check limit
                    });
                    if (!result || !result.building) {
                        addLog(`无法强迫 ${targetNation.name} 投资：没有符合条件的建筑（需要有雇佣关系、外资未满）`);

                        return;
                    }
                    const { building, cost: investmentCost } = result;
                    const buildingId = building.id;
                    // Check if vassal has enough wealth

                    if ((targetNation.wealth || 0) < investmentCost) {
                        addLog(`${targetNation.name} 国库资金不足，无法投资 ${building.name}`);
                        return;
                    }
                    // Create the foreign investment

                    import('../logic/diplomacy/overseasInvestment').then(({ createForeignInvestment, mergeForeignInvestments }) => {
                        const investment = createForeignInvestment({
                            buildingId,
                            ownerNationId: targetNation.id,
                            investorStratum: 'capitalist', // [FIX P1] 与 AI 自主投资路径 groupKey 一致，可正确合并

                        });
                        // Add to foreign investments
                        const inv = {
                            ...investment,

                            operatingMode: 'local',
                            investmentAmount: investmentCost,
                            createdDay: daysElapsed,
                            status: 'operating'
                        };
                        setForeignInvestments(prev => mergeForeignInvestments(prev, inv));
                        // Deduct wealth from vassal
                        setNations(prev => prev.map(n => n.id === nationId ? { ...n, wealth: Math.max(0, (n.wealth || 0) - investmentCost) } : n));
                        addLog(`成功迫使 ${targetNation.name} 投资 ${building.name}`);

                    });
                });
                break;
            }
            // ========== 海外投资相关行动 ==========
            case 'establish_overseas_investment': {
                // 在附庸国建立海外投资
                const { buildingId, ownerStratum, strategy } = payload || {};
                const targetNationId = payload?.targetNation?.id || payload?.targetNationId || nationId;
                const targetNation = nations.find(n => n.id === targetNationId);
                if (!targetNation || !buildingId) {
                    addLog(`建立海外投资失败：参数不完整 (targetNationId=${targetNationId}, buildingId=${buildingId})`);
                    break;

                }
                import('../logic/diplomacy/overseasInvestment').then(({ establishOverseasInvestment, mergeOverseasInvestments }) => {
                    const result = establishOverseasInvestment({
                        targetNation,

                        buildingId,
                        ownerStratum: ownerStratum || 'capitalist',
                        strategy: strategy || 'PROFIT_MAX',
                        existingInvestments: overseasInvestments || [],
                        classWealth,

                        daysElapsed,
                    });
                    if (result.success) {

                        // 更新海外投资列表
                        setOverseasInvestments(prev => {
                            return mergeOverseasInvestments(prev, result.investment);
                        });
                        // 扣除业主阶层财富
                        setClassWealthWithReason(prev => ({
                            ...prev,

                            [ownerStratum || 'capitalist']: Math.max(0, (prev[ownerStratum || 'capitalist'] || 0) - result.cost),
                        }), 'overseas_investment_cost', { ownerStratum, investmentId: result.investment?.id });
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
            case 'accept_foreign_investment': {
                // 接受外国投资（外国 -> 玩家）
                const { buildingId, ownerStratum, operatingMode, investmentAmount, investmentPolicy } = payload || {};
                const investorNation = nations.find(n => n.id === nationId);
                if (!investorNation || !buildingId) {

                    addLog('接受投资失败：参数不完整');
                    break;
                }
                const building = BUILDINGS.find(b => b.id === buildingId);
                if (!building) break;

                // [FIX] Check if player has this building - foreign investment can only operate existing buildings

                const playerBuildingCount = buildings[buildingId] || 0;
                if (playerBuildingCount <= 0) {
                    console.log(`[外资投资] 拒绝 ${investorNation.name} 投资 ${building.name}：玩家未建造该建筑`);
                    addLog(`${investorNation.name} 想投资 ${building.name}，但你还没有建造这种建筑。`);
                    break;
                }
                // 1. 玩家接收投资资金 (AI -> 玩家)
                // 这笔钱用于支付建筑公司、购买材料等
                const fundingReceived = investmentAmount || 0;
                // 2. 计算并扣除建造成本
                // 使用当前的建筑数量计算成本（通常外资是新增建筑，所以是第N+1个）
                const currentCount = buildings[buildingId] || 0;
                // 获取当前难度设置
                const difficulty = gameState?.difficulty || 'normal';
                // 使用 calculateBuildingCost 工具函数计算资源消耗
                const growthFactor = getBuildingCostGrowthFactor(difficulty);

                const baseMultiplier = getBuildingCostBaseMultiplier(difficulty);
                // 假设外资建筑也享受同样的成本加成（作为一个简化的处理）
                const buildingCostMod = gameState?.modifiers?.officialEffects?.buildingCostMod || 0;
                const rawCost = calculateBuildingCost(building.baseCost, currentCount, growthFactor, baseMultiplier);
                const constructionCost = applyBuildingCostModifier(rawCost, buildingCostMod, building.baseCost);
                // [FIX] 计算总建造银币成本（仅直接银币成本）
                // 投资款只能覆盖银币成本，资源不足则直接失败
                let totalSilverCostEstimate = constructionCost.silver || 0;
                // 校验资源是否足够（不允许紧急进口）
                const insufficientResources = [];
                Object.entries(constructionCost).forEach(([res, amount]) => {
                    if (res === 'silver') return;
                    const available = resources[res] || 0;
                    if (available < amount) {
                        insufficientResources.push(res);
                    }
                });
                if (insufficientResources.length > 0) {
                    addLog(`外资建设失败：资源不足（${insufficientResources.join('、')}）。`);
                    break;
                }
                if (fundingReceived < totalSilverCostEstimate) {
                    addLog('外资建设失败：投资预算不足。');
                    break;
                }
                // [FIX] 计算承建利润（如果投资款 > 实际成本）
                // 这笔利润归国内工人阶层（建筑工人）
                const constructionProfit = Math.max(0, fundingReceived - totalSilverCostEstimate);

                // 执行资源扣除 - 投资款用于抵消成本，不作为收入
                setResourcesWithReason(prev => {
                    const nextRes = { ...prev };
                    // [FIX] 投资款仅用于覆盖银币成本，玩家不再补差额
                    let remainingBudget = fundingReceived; // AI 提供的建设预算

                    Object.entries(constructionCost).forEach(([res, amount]) => {
                        if (res === 'silver') {
                            // 银币成本从预算中扣除
                            if (remainingBudget >= amount) {
                                remainingBudget -= amount;
                            }
                        } else {
                            // 非银币资源：直接消耗玩家库存（资源不足已提前拦截）
                            nextRes[res] = Math.max(0, (nextRes[res] || 0) - amount);
                        }
                    });
                    // [FIX] 剩余预算（如有）不进入国库
                    // 理论上不应该有剩余，因为 AI 计算投资额时应该精确
                    // 如果有剩余，作为给工人的建筑费用（进入工人阶层财富）
                    return nextRes;
                }, 'foreign_investment_construction', { nationId, buildingId });
                // [FIX] 如果有承建利润，拨给工人阶层
                if (constructionProfit > 0) {
                    setClassWealthWithReason(prev => ({
                        ...prev,

                        worker: (prev.worker || 0) + constructionProfit,
                    }), 'foreign_investment_construction_profit', { nationId, buildingId, profit: constructionProfit });
                }
                import('../logic/diplomacy/overseasInvestment').then(({ createForeignInvestment, mergeForeignInvestments }) => {

                    const newInvestment = createForeignInvestment({
                        buildingId,

                        ownerNationId: investorNation.id,
                        investorStratum: ownerStratum || 'capitalist',
                    });
                    if (newInvestment) {
                        newInvestment.operatingMode = operatingMode || 'local';

                        newInvestment.investmentAmount = investmentAmount || 0;
                        newInvestment.createdDay = daysElapsed;
                        setForeignInvestments(prev => mergeForeignInvestments(prev, newInvestment));
                        // 增加建筑数量
                        setBuildings(prev => ({
                            ...prev,
                            [buildingId]: (prev[buildingId] || 0) + 1,

                        }));
                        setNations(prev => prev.map(n => {
                            if (n.id !== investorNation.id) return n;
                            // [NEW] Apply discontent based on investment policy
                            let unrestChange = 0;
                            let relationChange = 5; // Default relation boost
                            if (investmentPolicy === 'guided') {
                                unrestChange = 2;
                                relationChange = 3; // Less relation boost

                            } else if (investmentPolicy === 'forced') {
                                unrestChange = 5;

                                relationChange = 1; // Minimal relation boost
                            }
                            return {
                                ...n,
                                wealth: Math.max(0, (n.wealth || 0) - (investmentAmount || 0)),

                                relation: Math.min(100, (n.relation || 0) + relationChange),
                                unrest: (n.unrest || 0) + unrestChange, // Apply discontent
                            };
                        }));
                        if (investmentPolicy === 'guided' || investmentPolicy === 'forced') {
                            addLog(`⚠️ 由于${investmentPolicy === 'forced' ? '强制' : '引导'}投资政策，${investorNation.name} 国内出现不满。`);

                        }
                        addLog(`🏭 ${investorNation.name} 投资 ${fundingReceived.toFixed(0)} 银币，在本地建设了 ${building.name}。消耗了相应的建材。`);
                    }
                }).catch(err => {
                    console.error('Failed to accept foreign investment:', err);
                    addLog('外资系统加载失败。');
                });
                break;
            }
            case 'withdraw_overseas_investment': {
                // 撤回海外投资

                const { investmentId } = payload || {};
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
                    setClassWealthWithReason(prevWealth => ({
                        ...prevWealth,
                        [ownerStratum]: (prevWealth[ownerStratum] || 0) + returnAmount,
                    }), 'overseas_investment_withdraw', { ownerStratum, investmentId });
                    addLog(`💰 已撤回在附庸国的投资，收回 ${returnAmount.toFixed(0)} 银币（扣除20%违约金）`);
                    return prev.filter(inv => inv.id !== investmentId);

                });

                break;
            }
            case 'change_investment_mode': {
                // 切换海外投资运营模式（支持批量修改配置）
                const { investmentId, investmentIds, updates } = payload || {};
                const targetIds = investmentIds || (investmentId ? [investmentId] : []);
                if (targetIds.length === 0) {
                    addLog('切换配置失败：参数不完整');
                    break;
                }
                const finalUpdates = updates || {};
                if (Object.keys(finalUpdates).length === 0) {
                    addLog('切换配置失败：无有效更新');
                    break;
                }
                setOverseasInvestments(prev => prev.map(inv => {
                    if (targetIds.includes(inv.id)) {
                        return { ...inv, ...finalUpdates };
                    }
                    return inv;
                }));
                addLog(`📦 已更新 ${targetIds.length} 个海外投资的运营策略`);
                break;
            }
            case 'set_foreign_investment_policy': {

                const { policy } = payload || {};
                if (!policy) {
                    addLog('Foreign investment policy update failed: missing policy.');
                    break;

                }
                const policyLabels = { normal: 'normal tax', increased_tax: 'higher tax', heavy_tax: 'heavy tax' };
                setForeignInvestmentPolicy(policy);
                addLog(`Foreign investment policy set to ${policyLabels[policy] || policy}.`);

                break;
            }

            case 'nationalize_foreign_investment': {
                // 国有化外资建筑
                const { investmentId } = payload || {};
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
        // 触发结果事件（仅当resultEvent已定义时）

        if (typeof resultEvent !== 'undefined' && resultEvent) {
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
        trackRebellionAction(action, stratumKey);
        const rebellionState = (rebellionStates && rebellionStates[stratumKey]) || {};
        const totalArmy = Object.values(army || {}).reduce((sum, count) => sum + (count || 0), 0);
        const militaryStrength = calculateBattlePower(army, epoch, modifiers?.militaryBonus || 0, 50, modifiers?.ideologyRuleMods || {}) / 100;
        const result = processRebellionAction(action, stratumKey, rebellionState, army, militaryStrength);
        const resultCallback = () => { };
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
                    setResourcesWithReason(prev => ({
                        ...prev,
                        culture: (prev.culture || 0) + 50,
                    }), 'rebellion_end_celebrate');
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
    const endWarWithNation = (nationId, extraUpdates = {}, options = {}) => {
        const { cleanupRuntime = true, cleanupReason = 'peace_treaty' } = options;

        // Ideology event: war victory (peace achieved)
        ideologyEventBus.emit(IDEOLOGY_EVENTS.ON_WAR_VICTORY, {
            nationId, reason: cleanupReason
        }, daysElapsed);

        setNations(prev => prev.map(n => {
            if (n.id === nationId) {
                const nextForeignWars = { ...(n.foreignWars || {}) };
                if (nextForeignWars.player) {
                    nextForeignWars.player = {
                        ...nextForeignWars.player,
                        isAtWar: false,
                        warScore: 0,
                        peaceTreatyUntil: daysElapsed + 365,
                    };
                }
                return {
                    ...n,
                    isAtWar: false,
                    warTarget: null,
                    warScore: 0,
                    warDuration: 0,
                    enemyLosses: 0,
                    peaceTreatyUntil: daysElapsed + 365,
                    foreignWars: nextForeignWars,
                    ...extraUpdates,
                };
            }

            if (n.id === 'player' && n.foreignWars?.[nationId]) {
                return {
                    ...n,
                    foreignWars: {
                        ...n.foreignWars,
                        [nationId]: {
                            ...n.foreignWars[nationId],
                            isAtWar: false,
                            warScore: 0,
                            peaceTreatyUntil: daysElapsed + 365,
                        },
                    },
                };
            }

            return n;
        }));

        if (cleanupRuntime) {
            cleanupWarRuntimeState(nationId, cleanupReason);
        }
    };
    const annexNationIntoPlayer = (nationId, nationToAnnex) => {
            const annexPopulation = Math.max(0, Math.floor(nationToAnnex?.population || 0));
            const annexedBuildings = { ...(nationToAnnex?.virtualBuildings || {}) };

            if (annexPopulation > 0) {
                setPopulation(prev => prev + annexPopulation);
                setPopStructure(prev => ({
                    ...prev,
                    unemployed: (prev.unemployed || 0) + annexPopulation,
                }));
                setMaxPopBonus(prev => prev + annexPopulation);
            }

            if (Object.keys(annexedBuildings).length > 0) {
                setBuildings(prev => {
                    const next = { ...prev };
                    Object.entries(annexedBuildings).forEach(([buildingId, count]) => {
                        const numericCount = Math.max(0, Math.floor(Number(count) || 0));
                        if (numericCount <= 0) return;
                        next[buildingId] = (next[buildingId] || 0) + numericCount;
                    });
                    return next;
                });
            }

            setOverseasInvestments(prev => prev.filter(inv => inv.targetNationId !== nationId));
            setForeignInvestments(prev => prev.filter(inv => inv.ownerNationId !== nationId));

            return annexPopulation;
        };
    const handleEnemyPeaceAccept = (nationId, proposalType, amount = 0) => {
        const targetNation = nations.find(n => n.id === nationId);
        if (!targetNation) return;
        trackPeaceAccept(nationId);

        // Peaceful resolution grants reputation bonus (except for annexation)
        if (proposalType !== 'annex' && setDiplomaticReputation) {
            const { newReputation } = calculateReputationChange(
                diplomaticReputation ?? 50,
                'peacefulResolution',
                true  // positive event
            );
            setDiplomaticReputation(newReputation);
        }
        
        const durationDays = INSTALLMENT_CONFIG?.DURATION_DAYS || 365;
        const basePopulation = targetNation.population || 0;
        const transferPopulation = Math.min(basePopulation, Math.max(0, Math.floor(amount || 0)));
        const paymentAmount = Math.max(0, Math.floor(amount || 0));
        if (proposalType === 'annex') {
            const populationGain = annexNationIntoPlayer(nationId, targetNation);

            // Annexation causes reputation loss
            if (setDiplomaticReputation) {
                const { newReputation } = calculateReputationChange(
                    diplomaticReputation ?? 50,
                    'annexVassal',
                    false  // negative event
                );
                setDiplomaticReputation(newReputation);
            }

            endWarWithNation(nationId, {
                isAnnexed: true,
                annexedBy: 'player',
                annexedAt: daysElapsed,
                population: 0,
                wealth: 0,
                virtualBuildings: {},
                virtualBuildingsBaseline: {},
                virtualBuildingsForeign: {},
                economyDirtyFlags: {
                    buildingsDirty: true,
                    laborDirty: true,
                    resourcesDirty: true,
                    warDirty: true,
                    investmentDirty: true,
                },
            });
            const annexEvent = createNationAnnexedEvent(

                targetNation,
                populationGain,
                populationGain,
                'war_annex',
                () => { }
            );
            triggerDiplomaticEvent(annexEvent);

            addLog(`Annexed ${targetNation.name}.`);
            return;
        }
        if (proposalType === 'population') {
            if (transferPopulation > 0) {

                setPopulation(prev => prev + transferPopulation);
                // [FIX] Sync popStructure: new population joins as unemployed
                setPopStructure(prev => ({
                    ...prev,
                    unemployed: (prev.unemployed || 0) + transferPopulation,
                }));
                setMaxPopBonus(prev => prev + transferPopulation);
            }
            endWarWithNation(nationId, {
                population: reducePopulationWithFloor(basePopulation, transferPopulation),
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
            const nextTreaties = Array.isArray(targetNation.treaties) ? [...targetNation.treaties] : [];
            nextTreaties.push({
                id: `treaty_${nationId}_${Date.now()}`,
                type: 'open_market',
                startDay: daysElapsed,
                endDay: daysElapsed + paymentAmount,
                maintenancePerDay: 0,
                direction: 'war_forced',
            });
            endWarWithNation(nationId, {
                openMarketUntil: daysElapsed + paymentAmount,
                treaties: nextTreaties,
            });
            addLog(`${targetNation.name} opened its market.`);
            return;
        }
        if (proposalType === 'vassal') {
            // 建立附庸关系
            const vassalType = 'vassal';
            const vassalConfig = VASSAL_TYPE_CONFIGS[vassalType] || VASSAL_TYPE_CONFIGS.vassal;
            endWarWithNation(nationId, {
                vassalOf: 'player',
                vassalType: vassalType,
                tributeRate: vassalConfig.tributeRate || 0.10,
                independencePressure: 0,
                lastTributeDay: daysElapsed,
            });
            addLog(`${targetNation.name} 成为你的${VASSAL_TYPE_LABELS[vassalType] || '附庸国'}！`);
            return;
        }
        if (proposalType === 'peace_only') {
            endWarWithNation(nationId, {
                isMercyPeaceOffering: false,
                relation: Math.min(100, (targetNation.relation || 50) + 10),
            });
            addLog(`[停战达成] 你接受了 ${targetNation.name} 的和平提议，战争结束。`);
            return;
        }
        if (paymentAmount > 0) {
            setResourcesWithReason(
                prev => ({ ...prev, silver: (prev.silver || 0) + paymentAmount }),
                'peace_payment_received',
                { nationId }
            );
        }
        endWarWithNation(nationId, {
            wealth: Math.max(0, (targetNation.wealth || 0) - paymentAmount),
        });
        addLog(`${targetNation.name} paid ${paymentAmount} silver for peace.`);
    };
    const handleEnemyPeaceReject = (nationId) => {
        const targetNation = nations.find(n => n.id === nationId);
        if (!targetNation) return;
        trackPeaceReject(nationId);
        setNations(prev => prev.map(n => {
            if (n.id !== nationId) return n;
            return { ...n, relation: Math.max(0, (n.relation || 0) - 5) };
        }));
        addLog(`Rejected peace request from ${targetNation.name}.`);
    };
    const handlePlayerPeaceProposal = (nationId, proposalType, amount = 0) => {
        const targetNation = nations.find(n => n.id === nationId);
        if (!targetNation) return;
        trackPeacePropose(nationId);
        if (proposalType === 'cancel') {
            addLog(`Peace proposal to ${targetNation.name} canceled.`);
            return;
        }
        // [FIX] Prefer frontWarScore over nation.warScore to match what UI showed
        const relevantFrontsForProposal = (activeFronts || []).filter(f =>
            f?.status === 'active' && (
                (f.attackerId === nationId && f.defenderId === 'player') ||
                (f.attackerId === 'player' && f.defenderId === nationId)
            )
        );
        const frontWarScoreForProposal = relevantFrontsForProposal.length > 0
            ? relevantFrontsForProposal.reduce((sum, f) => sum + getEffectiveFrontWarScore(f), 0)
            : null;
        const warScore = frontWarScoreForProposal !== null ? frontWarScoreForProposal : (targetNation.warScore || 0);
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
            triggerDiplomaticEvent(createPeaceProposalRejectedEvent(
                targetNation,
                proposalType,
                acceptChance,
                {
                    relationPenalty: 5,
                    warScore,
                }
            ));
            return;
        }
        if (proposalType === 'demand_annex' && warScore < 500) {
            addLog('战争分数不足，无法提出吞并要求。');
            return;
        }

        if (proposalType === 'demand_vassal' && warScore < 300) {
            addLog('战争分数不足，无法提出附庸要求。');
            return;
        }
        if (proposalType === 'demand_annex') {
            const transferPopulation = annexNationIntoPlayer(nationId, targetNation);
            endWarWithNation(nationId, {
                isAnnexed: true,
                annexedBy: 'player',
                annexedAt: daysElapsed,
                population: 0,
                wealth: 0,
                virtualBuildings: {},
                virtualBuildingsBaseline: {},
                virtualBuildingsForeign: {},
                economyDirtyFlags: {
                    buildingsDirty: true,
                    laborDirty: true,
                    resourcesDirty: true,
                    warDirty: true,
                    investmentDirty: true,
                },
            });
            const annexEvent = createNationAnnexedEvent(
                targetNation,
                transferPopulation,
                transferPopulation,
                'war_annex',
                () => { }
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
                // [FIX] Sync popStructure: new population joins as unemployed
                setPopStructure(prev => ({
                    ...prev,
                    unemployed: (prev.unemployed || 0) + transferPopulation,
                }));
                setMaxPopBonus(prev => prev + transferPopulation);

            }
            endWarWithNation(nationId, {
                population: reducePopulationWithFloor(basePopulation, transferPopulation),
            });
            addLog(`${targetNation.name} ceded ${transferPopulation} population.`);
            return;

        }
        if (proposalType === 'demand_open_market') {
            const nextTreaties = Array.isArray(targetNation.treaties) ? [...targetNation.treaties] : [];
            nextTreaties.push({
                id: `treaty_${nationId}_${Date.now()}`,
                type: 'open_market',
                startDay: daysElapsed,

                endDay: daysElapsed + paymentAmount,
                maintenancePerDay: 0,
                direction: 'war_forced',
            });
            endWarWithNation(nationId, {
                openMarketUntil: daysElapsed + paymentAmount,
                treaties: nextTreaties,
            });
            addLog(`${targetNation.name} opened its market.`);
            return;
        }

        if (proposalType === 'demand_vassal') {
            // 建立附庸关系
            const vassalType = amount || 'vassal'; // amount参数传递附庸类型
            const vassalConfig = VASSAL_TYPE_CONFIGS[vassalType] || VASSAL_TYPE_CONFIGS.vassal;
            endWarWithNation(nationId, {
                vassalOf: 'player',
                vassalType: vassalType,
                tributeRate: vassalConfig.tributeRate || 0.10,
                independencePressure: 0,
                lastTributeDay: daysElapsed,
            });
            addLog(`${targetNation.name} 成为你的${VASSAL_TYPE_LABELS[vassalType] || '附庸国'}！`);
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
                setResourcesWithReason(
                    prev => ({ ...prev, silver: (prev.silver || 0) + paymentAmount }),
                    'peace_demand_payment',
                    { nationId, proposalType }
                );
            }
            endWarWithNation(nationId, {
                wealth: Math.max(0, (targetNation.wealth || 0) - paymentAmount),
            });

            addLog(`${targetNation.name} paid ${paymentAmount} silver.`);
            return;
        }
        if (proposalType === 'pay_high' || proposalType === 'pay_standard' || proposalType === 'pay_moderate') {
            setResourcesWithReason(
                prev => ({ ...prev, silver: Math.max(0, (prev.silver || 0) - paymentAmount) }),
                'peace_payment',
                { nationId, proposalType }
            );
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
            setPopulation(prev => reducePopulationWithFloor(prev, paymentAmount));
            // [FIX] Sync popStructure: remove population proportionally from all strata
            setPopStructure(prev => {
                const totalPop = Object.values(prev).reduce((sum, v) => sum + (v || 0), 0);
                if (totalPop <= 0 || paymentAmount <= 0) return prev;
                const next = { ...prev };
                let remaining = paymentAmount;
                // First try to remove from unemployed
                const unemployedRemove = Math.min(next.unemployed || 0, remaining);
                if (unemployedRemove > 0) {
                    next.unemployed = (next.unemployed || 0) - unemployedRemove;
                    remaining -= unemployedRemove;
                }
                // If still need to remove, proportionally from other strata
                if (remaining > 0) {
                    const activePop = totalPop - (prev.unemployed || 0);
                    if (activePop > 0) {
                        Object.keys(next).forEach(key => {
                            if (key === 'unemployed' || remaining <= 0) return;
                            const current = next[key] || 0;
                            if (current <= 0) return;
                            const remove = Math.min(current, Math.ceil((current / activePop) * remaining));
                            next[key] = current - remove;
                            remaining -= remove;
                        });
                    }
                }
                return next;
            });
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
    // 使用稳定引用对象，避免每次渲染创建新对象导致依赖它的 useEffect 无限重触发 (React Error #185)
    const _actionsRef = useRef(null);
    if (!_actionsRef.current) _actionsRef.current = {};
    Object.assign(_actionsRef.current, {
        canUpgradeEpoch,
        upgradeEpoch,
        buyBuilding,
        sellBuilding,
        upgradeBuilding,
        downgradeBuilding,
        batchUpgradeBuilding,
        batchDowngradeBuilding,
        researchTech,
        toggleDecree,
        manualGather,
        recruitUnit,
        handleAutoReplenishLosses,
        disbandUnit,
        disbandAllUnits,
        cancelTraining,
        cancelAllTraining,
        launchBattle,
        startWarAgainstPlayer,
        cleanupWarRuntimeState,
        handleDiplomaticAction,
        handleEnemyPeaceAccept,
        handleEnemyPeaceReject,
        handlePlayerPeaceProposal,
        approveVassalDiplomacyAction,
        rejectVassalDiplomacyAction,
        issueVassalDiplomacyOrder,
        triggerRandomEvent,
        triggerDiplomaticEvent,
        handleEventOption,
        setBattleResult,
        setBattleNotifications,
        addBattleNotification: (battleResult) => {
            const notification = {
                id: `battle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                result: battleResult,
                timestamp: Date.now(),
            };
            setBattleNotifications(prev => {
                const next = [...prev, notification];
                return next.length > 20 ? next.slice(-20) : next;
            });
        },
        dismissBattleNotification: (notificationId) => {
            setBattleNotifications(prev => prev.filter(n => n.id !== notificationId));
        },
        dismissAllBattleNotifications: () => {
            setBattleNotifications([]);
        },
        triggerOfficialSelection,
        hireNewOfficial,
        fireExistingOfficial,
        disposeExistingOfficial,
        updateOfficialSalary,
        updateOfficialName,
        assignMinister,
        clearMinisterRole,
        toggleMinisterAutoExpansion,
        changeOfficialPropertyPolicy,
        handleRebellionAction,
        handleRebellionWarEnd,
    });
    return _actionsRef.current;
};
