import React, { useMemo, useState, useEffect, memo } from 'react';
import { DeclareWarModal } from '../modals/DeclareWarModal';
import TradeRoutesModal from '../modals/TradeRoutesModal';
import { OverseasInvestmentPanel } from '../panels/OverseasInvestmentPanel';
import { InternationalEconomyPanel } from '../panels/InternationalEconomyPanel';
import DiplomacyLayout from '../diplomacy/DiplomacyLayout';
import NegotiationDialog from '../diplomacy/NegotiationDialog';
import ProvokeDialog from '../diplomacy/ProvokeDialog';
import OrganizationDetailsModal from '../modals/OrganizationDetailsModal';
import {
    DIPLOMACY_ERA_UNLOCK,
    NEGOTIABLE_TREATY_TYPES,
    RESOURCES,
    getTreatyDuration,
    isDiplomacyUnlocked,
} from '../../config';
import { calculateNegotiationAcceptChance } from '../../logic/diplomacy/negotiation';

// Constants
const NEGOTIATION_MAX_ROUNDS = 3;
const relationInfo = (relation = 0, isAllied = false) => {
    if (isAllied) return { label: '盟友', color: 'text-green-300', bg: 'bg-green-900/20' };
    if (relation >= 80) return { label: '亲密', color: 'text-emerald-300', bg: 'bg-emerald-900/20' };
    if (relation >= 60) return { label: '友好', color: 'text-blue-300', bg: 'bg-blue-900/20' };
    if (relation >= 40) return { label: '中立', color: 'text-gray-300', bg: 'bg-gray-800/40' };
    if (relation >= 20) return { label: '冷淡', color: 'text-yellow-300', bg: 'bg-yellow-900/20' };
    return { label: '敌对', color: 'text-red-300', bg: 'bg-red-900/20' };
};

const DiplomacyTabComponent = ({
    nations = [],
    epoch = 0,
    market = {},
    resources = {},
    daysElapsed = 0,
    onDiplomaticAction,
    tradeRoutes = { routes: [] },
    tradeOpportunities = { exports: [], imports: [] },
    onTradeRouteAction,
    merchantState = { merchantAssignments: {} },
    onMerchantStateChange,
    playerInstallmentPayment = null,
    jobsAvailable = {},
    popStructure = {},
    taxPolicies = {},
    diplomaticCooldownMod = 0,
    overseasInvestments = [],
    classWealth = {},
    diplomacyOrganizations = { organizations: [] },
    gameState = {},
    population = {},
    foreignInvestments = [],
    foreignInvestmentPolicy = 'normal',
    vassalDiplomacyQueue = [],
    vassalDiplomacyHistory = [],
    onApproveVassalDiplomacy,
    onRejectVassalDiplomacy,
    onIssueVassalOrder,
}) => {
    // --- State Management ---
    const [selectedNationId, setSelectedNationId] = useState(null);

    // Modals State
    const [showProvokeModal, setShowProvokeModal] = useState(false);
    const [showDeclareWarModal, setShowDeclareWarModal] = useState(false);
    const [showTradeRoutesModal, setShowTradeRoutesModal] = useState(false);
    const [showOverseasInvestmentPanel, setShowOverseasInvestmentPanel] = useState(false);
    const [investmentPanelNation, setInvestmentPanelNation] = useState(null);
    const [showInternationalEconomy, setShowInternationalEconomy] = useState(false);

    // Organization Modal State
    const [showOrganizationModal, setShowOrganizationModal] = useState(false);
    const [selectedOrganization, setSelectedOrganization] = useState(null);

    // Negotiation State
    const [showNegotiationModal, setShowNegotiationModal] = useState(false);
    const [negotiationRound, setNegotiationRound] = useState(1);
    const [negotiationCounter, setNegotiationCounter] = useState(null);
    const [negotiationFeedback, setNegotiationFeedback] = useState(null);
    const [negotiationDraft, setNegotiationDraft] = useState({
        type: 'trade_agreement',
        durationDays: 365,
        maintenancePerDay: 0,
        signingGift: 0,
        resources: [], // Array of { key: string, amount: number }
        demandSilver: 0,
        demandResources: [], // Array of { key: string, amount: number }
        stance: 'normal',
    });

    // --- Derived Data ---
    const visibleNations = useMemo(
        () =>
            nations.filter(
                (nation) =>
                    epoch >= (nation.appearEpoch ?? 0) &&
                    (nation.expireEpoch == null || epoch <= nation.expireEpoch) &&
                    !nation.isAnnexed // 排除已被吞并的国家
            ),
        [nations, epoch]
    );

    const checkNationSelection = () => {
        // Only reset if the currently selected nation is no longer visible (e.g. destroyed)
        if (selectedNationId && !visibleNations.some((n) => n.id === selectedNationId)) {
            setSelectedNationId(null);
        }
    };

    useEffect(() => {
        checkNationSelection();
    }, [selectedNationId, visibleNations]);

    const selectedNation =
        visibleNations.find((nation) => nation.id === selectedNationId) || null;

    const getNationRelationInfo = (nation) => {
        if (!nation) return { value: 0, ...relationInfo(0, false) };
        const relationValue = Number.isFinite(nation.relation) ? nation.relation : 0;
        const isAllied = nation.alliedWithPlayer === true;
        return {
            value: relationValue,
            isAllied,
            ...relationInfo(relationValue, isAllied),
        };
    };

    // --- Helpers & Logic ---

    // Negotiation Logic
    const getDefaultNegotiationType = () => {
        const unlockedType = NEGOTIABLE_TREATY_TYPES.find((type) => {
            // military_alliance and economic_bloc are organizations, not treaties
            const isOrganizationType = type === 'military_alliance' || type === 'economic_bloc';
            const category = isOrganizationType ? 'organizations' : 'treaties';
            return isDiplomacyUnlocked(category, type, epoch);
        });
        return unlockedType || 'peace_treaty';
    };

    const buildNegotiationDraft = (type) => ({
        type,
        durationDays: getTreatyDuration(type, epoch),
        maintenancePerDay: 0,
        signingGift: 0,
        resourceKey: '',
        resourceAmount: 0,
        demandSilver: 0,
        demandResourceKey: '',
        demandResourceAmount: 0,
        stance: 'normal',
    });

    const openNegotiationModal = () => {
        const type = getDefaultNegotiationType();
        setNegotiationDraft(buildNegotiationDraft(type));
        setNegotiationCounter(null);
        setNegotiationRound(1);
        setNegotiationFeedback(null);
        setShowNegotiationModal(true);
    };

    const negotiationEvaluation = useMemo(() => {
        if (!selectedNation) return { acceptChance: 0, relationGate: false };
        
        // Get organization info if relevant
        let organization = null;
        let organizationMode = null;
        const orgType = negotiationDraft.type === 'military_alliance' ? 'military_alliance' : 
                       (negotiationDraft.type === 'economic_bloc' ? 'economic_bloc' : null);
        
        if (orgType && negotiationDraft.targetOrganizationId && negotiationDraft.organizationMode) {
            const orgs = diplomacyOrganizations?.organizations || [];
            organization = orgs.find(o => o.id === negotiationDraft.targetOrganizationId);
            organizationMode = negotiationDraft.organizationMode;
        }
        
        // Get player production (use total goods production as proxy)
        const playerProduction = gameState?.totalGoodsProduction || 
                                (gameState?.productionPerDay?.goods || 0);
        const targetProduction = selectedNation?.productionCapacity || 
                                selectedNation?.economyScore || 
                                (selectedNation?.wealth || 0) * 0.01;
        
        return calculateNegotiationAcceptChance({
            proposal: negotiationDraft,
            nation: selectedNation,
            epoch,
            stance: negotiationDraft.stance,
            daysElapsed,
            playerWealth: resources?.silver || 0,
            targetWealth: selectedNation?.wealth || 0,
            playerPower: gameState?.militaryPower || 0,
            targetPower: selectedNation?.militaryPower || selectedNation?.power || 0,
            playerProduction,
            targetProduction,
            organization,
            organizationMode,
        });
    }, [selectedNation, negotiationDraft, epoch, daysElapsed, resources, gameState, diplomacyOrganizations]);

    const handleNegotiationResult = (result) => {
        if (!result) return;
        if (result.status === 'counter' && result.counterProposal) {
            setNegotiationCounter(result.counterProposal);
            setNegotiationDraft((prev) => ({ ...prev, ...result.counterProposal }));
            setNegotiationRound((prev) => Math.min(NEGOTIATION_MAX_ROUNDS, prev + 1));
            return;
        }
        if (result.status === 'accepted') {
            setShowNegotiationModal(false);
            setNegotiationCounter(null);
            setNegotiationRound(1);
            setNegotiationFeedback(null);
            return;
        }
        const reasonMap = {
            era: '当前时代尚未解锁该功能。',
            type: '缺少条约类型，无法发起谈判。',
            treaty_locked: '条约未解锁，无法谈判。',
            org_locked: '组织未解锁，无法谈判。',
            war: '对方处于战争中，无法谈判。',
            peace_active: '和平/互不侵犯条约仍在生效，无法重复谈判。',
            market_active: '开放市场/贸易类条约仍在生效，无法重复谈判。',
            investment_active: '投资协议仍在生效，无法重复谈判。',
            treaty_active: '该类条约仍在生效，无法重复签署。',
            silver: '银币不足，无法支付签约费用/赠礼。',
            resource: '赠送资源无效或库存不足。',
            demand_silver: '对方无法承担索赔银币。',
            demand_resource: '对方无法提供索赔资源。',
        };
        if (result.status === 'blocked') {
            const minR = Number.isFinite(result.minRelation) ? result.minRelation : negotiationEvaluation?.minRelation;
            const curR = Number.isFinite(result.currentRelation) ? result.currentRelation : selectedNation?.relation;
            const reason = result.reason || result.blockedReason;
            if ((reason === 'relation' || reason === 'relation_gate' || reason === 'relationGate') && Number.isFinite(minR) && Number.isFinite(curR)) {
                setNegotiationFeedback(`关系不足：需要达到 ${Math.round(minR)}（当前 ${Math.round(curR)}）。`);
                return;
            }
            setNegotiationFeedback(reasonMap[reason] || '谈判被阻止，请检查条件。');
            return;
        }
        if (result.status === 'rejected') {
            // Prefer explicit relation gate message if available
            const evalObj = result.evaluation || negotiationEvaluation;
            if (evalObj?.relationGate && Number.isFinite(evalObj?.minRelation)) {
                const req = evalObj.minRelation;
                const cur = selectedNation?.relation ?? 0;
                setNegotiationFeedback(`对方拒绝：关系未达硬门槛，需要 ${Math.round(req)}（当前 ${Math.round(cur)}）。`);
                return;
            }
            // If we know the deal is insufficient, show the deficit
            if (result.reason === 'deal_insufficient') {
                const score = Number(result.dealScore || 0);
                setNegotiationFeedback(`对方拒绝：认为筹码不足（差额 ${Math.round(Math.abs(score))}）。`);
                return;
            }
            setNegotiationFeedback('对方拒绝了提案。');
        }
    };

    const submitNegotiation = (proposal, options = {}) => {
        if (!selectedNation || typeof onDiplomaticAction !== 'function') return;
        const nextRound = options?.round || negotiationRound;
        setNegotiationFeedback(null);
        onDiplomaticAction(selectedNation.id, 'negotiate_treaty', {
            proposal,
            stance: proposal.stance || negotiationDraft.stance,
            round: nextRound,
            maxRounds: NEGOTIATION_MAX_ROUNDS,
            ignoreCooldown: nextRound > 1,
            forceAccept: options?.forceAccept === true,
            onResult: handleNegotiationResult,
        });
    };

    // Provoke Logic
    const handleProvokeConfirm = (targetId) => {
        if (!selectedNation || !onDiplomaticAction) return;
        onDiplomaticAction(selectedNation.id, 'provoke', { targetNationId: targetId });
        setShowProvokeModal(false);
    };

    const provokeTargetNations = useMemo(() => {
        if (!selectedNation) return [];
        return visibleNations.filter(n => n.id !== selectedNation.id);
    }, [visibleNations, selectedNation]);

    const targetNationAllies = useMemo(() => {
        if (!selectedNation) return [];
        
        // 获取目标国家所在的军事组织成员
        const orgs = diplomacyOrganizations?.organizations || [];
        const targetMilitaryOrgMembers = new Set();
        
        orgs.forEach(org => {
            if (org?.type !== 'military_alliance') return;
            if (!Array.isArray(org.members) || !org.members.includes(selectedNation.id)) return;
            
            org.members.forEach(memberId => {
                if (memberId && memberId !== selectedNation.id && memberId !== 'player') {
                    targetMilitaryOrgMembers.add(memberId);
                }
            });
        });
        
        // 过滤出会被连带开战的盟友（排除玩家的附庸和玩家所在军事组织的成员）
        const playerMilitaryOrgMembers = new Set();
        orgs.forEach(org => {
            if (org?.type !== 'military_alliance') return;
            if (!Array.isArray(org.members) || !org.members.includes('player')) return;
            
            org.members.forEach(memberId => {
                if (memberId && memberId !== 'player') {
                    playerMilitaryOrgMembers.add(memberId);
                }
            });
        });
        
        return visibleNations.filter(n => {
            if (n.id === selectedNation.id) return false;
            // 必须是目标国家的军事组织成员
            if (!targetMilitaryOrgMembers.has(n.id)) return false;
            // 排除玩家的附庸
            if (n.isVassal === true) return false;
            // 排除与玩家在同一军事组织的成员（他们会保持中立）
            if (playerMilitaryOrgMembers.has(n.id)) return false;
            return true;
        }).map(ally => ({
            ...ally,
            foreignRelation: selectedNation.foreignRelations?.[ally.id] ?? 80,
        }));
    }, [visibleNations, selectedNation, diplomacyOrganizations]);

    // Simple Actions
    const handleSimpleAction = (nationId, action, payload) => {
        if (onDiplomaticAction) {
            onDiplomaticAction(nationId, action, payload);
        }
    };

    // --- Render ---
    return (
        <div className="h-full">
            <DiplomacyLayout
                nations={nations}
                visibleNations={visibleNations}
                selectedNationId={selectedNationId}
                onSelectNation={setSelectedNationId}
                selectedNation={selectedNation}
                gameState={gameState}
                relationInfo={getNationRelationInfo}

                // Context Props
                epoch={epoch}
                market={market}
                resources={resources}
                daysElapsed={daysElapsed}
                diplomaticCooldownMod={diplomaticCooldownMod}
                diplomacyOrganizations={diplomacyOrganizations}
                overseasInvestments={overseasInvestments}
                foreignInvestments={foreignInvestments}
                tradeRoutes={tradeRoutes}
                tradeOpportunities={tradeOpportunities}
                merchantState={merchantState}
                onMerchantStateChange={(nationId, count) => {
                    if (onMerchantStateChange) {
                        onMerchantStateChange(prev => ({
                            ...prev,
                            merchantAssignments: {
                                ...(prev?.merchantAssignments || {}),
                                [nationId]: count
                            }
                        }));
                    }
                }}

                // Actions Handlers
                onDiplomaticAction={onDiplomaticAction}
                onNegotiate={() => openNegotiationModal()}
                onManageTrade={() => setShowTradeRoutesModal(true)}
                onManageInternationalEconomy={() => setShowInternationalEconomy(true)}
                onDeclareWar={() => setShowDeclareWarModal(true)}
                onProvoke={() => setShowProvokeModal(true)}

                // Sub-Actions Handlers (Investment)
                onOverseasInvestment={(nation) => {
                    setInvestmentPanelNation(nation);
                    setShowOverseasInvestmentPanel(true);
                }}

                // Organization Actions
                onViewOrganization={(org) => {
                    setSelectedOrganization(org);
                    setShowOrganizationModal(true);
                }}

                vassalDiplomacyQueue={vassalDiplomacyQueue}
                vassalDiplomacyHistory={vassalDiplomacyHistory}
                onApproveVassalDiplomacy={onApproveVassalDiplomacy}
                onRejectVassalDiplomacy={onRejectVassalDiplomacy}
                onIssueVassalOrder={onIssueVassalOrder}
            />

            {/* --- Modals & Dialogs --- */}

            <NegotiationDialog
                isOpen={showNegotiationModal}
                onClose={() => setShowNegotiationModal(false)}
                selectedNation={selectedNation}
                negotiationDraft={negotiationDraft}
                setNegotiationDraft={setNegotiationDraft}
                negotiationRound={negotiationRound}
                negotiationEvaluation={negotiationEvaluation}
                negotiationCounter={negotiationCounter}
                negotiationFeedback={negotiationFeedback}
                daysElapsed={daysElapsed}
                submitNegotiation={submitNegotiation}
                isDiplomacyUnlocked={isDiplomacyUnlocked}
                epoch={epoch}
                tradableResources={Object.entries(RESOURCES).filter(([key, res]) => res?.type !== 'virtual' && key !== 'silver')}
                organizations={diplomacyOrganizations?.organizations || []}
                nations={visibleNations}
                empireName={gameState?.empireName || '我的帝国'}
            />

            <ProvokeDialog
                isOpen={showProvokeModal}
                onClose={() => setShowProvokeModal(false)}
                selectedNation={selectedNation}
                onConfirm={handleProvokeConfirm}
                provokeTargetNations={provokeTargetNations}
                playerWealth={resources.silver || 0}
            />

            {showDeclareWarModal && selectedNation && (
                <DeclareWarModal
                    targetNation={selectedNation}
                    allies={targetNationAllies}
                    onConfirm={() => {
                        handleSimpleAction(selectedNation.id, 'declare_war');
                        setShowDeclareWarModal(false);
                    }}
                    onCancel={() => setShowDeclareWarModal(false)}
                />
            )}

            {showTradeRoutesModal && (
                <TradeRoutesModal
                    tradeRoutes={tradeRoutes}
                    nations={visibleNations}
                    resources={resources}
                    market={market}
                    taxPolicies={taxPolicies}
                    daysElapsed={daysElapsed}
                    epoch={epoch}
                    merchantCount={popStructure?.merchant || 0} // Using prop passed to component
                    merchantAssignments={merchantState?.merchantAssignments || {}}
                    merchantTradePreferences={merchantState?.merchantTradePreferences || { import: {}, export: {} }}
                    pendingTrades={merchantState?.pendingTrades || []}
                    onUpdateMerchantAssignments={(next) => {
                        if (typeof onMerchantStateChange === 'function') {
                            onMerchantStateChange({
                                ...(merchantState || {}),
                                merchantAssignments: next || {},
                            });
                        }
                    }}
                    onUpdateMerchantTradePreferences={(next) => {
                        if (typeof onMerchantStateChange === 'function') {
                            onMerchantStateChange({
                                ...(merchantState || {}),
                                merchantTradePreferences: next || { import: {}, export: {} },
                            });
                        }
                    }}
                    onCreateRoute={(nationId, resourceKey, type, payload) => {
                        if (typeof onDiplomaticAction === 'function') {
                            onDiplomaticAction(nationId, 'trade_route', {
                                action: 'create',
                                resourceKey,
                                type,
                                ...(payload && typeof payload === 'object' ? payload : {}),
                            });
                        }
                    }}
                    onCancelRoute={(nationId, resourceKey, type) => {
                        if (typeof onDiplomaticAction === 'function') {
                            onDiplomaticAction(nationId, 'trade_route', {
                                action: 'cancel',
                                resourceKey,
                                type,
                            });
                        }
                    }}
                    onClose={() => setShowTradeRoutesModal(false)}
                />
            )}

            <OverseasInvestmentPanel
                isOpen={showOverseasInvestmentPanel}
                onClose={() => {
                    setShowOverseasInvestmentPanel(false);
                    setInvestmentPanelNation(null);
                }}
                targetNation={investmentPanelNation}
                playerNation={nations.find(n => n.id === 'player')}
                overseasInvestments={overseasInvestments}
                classWealth={classWealth}
                epoch={epoch}
                market={market}
                onInvest={(nationId, buildingId, ownerStratum, strategy) => {
                    onDiplomaticAction(nationId, 'establish_overseas_investment', {
                        buildingId,
                        ownerStratum,
                        strategy,
                    });
                }}
                onWithdraw={(investmentId) => {
                    if (investmentPanelNation) {
                        onDiplomaticAction(investmentPanelNation.id, 'withdraw_overseas_investment', { investmentId });
                    }
                }}
                onConfigChange={(investmentIds, updates) => {
                    if (investmentPanelNation) {
                        const payload = Array.isArray(investmentIds)
                            ? { investmentIds, updates }
                            : { investmentId: investmentIds, updates };
                        onDiplomaticAction(investmentPanelNation.id, 'change_investment_mode', payload);
                    }
                }}
            />

            <InternationalEconomyPanel
                isOpen={showInternationalEconomy}
                onClose={() => setShowInternationalEconomy(false)}
                overseasInvestments={overseasInvestments}
                foreignInvestments={foreignInvestments}
                nations={visibleNations}
                playerMarket={market}
                playerResources={resources}
                currentPolicy={foreignInvestmentPolicy}
                onPolicyChange={(policy) => {
                    if (typeof onDiplomaticAction === 'function') {
                        onDiplomaticAction('player', 'set_foreign_investment_policy', { policy });
                    }
                }}
                onNationalize={() => {
                    if (typeof onDiplomaticAction === 'function') {
                        // Assuming nationalize applies generally or we iterate all;
                        // The original panel had a nationalize button per investment or general?
                        // The logic provided in ForeignInvestmentPanel iterates all if the button was general.
                        // But InternationalEconomyPanel passes `onNationalize` which is triggered by a button in the panel.
                        // Let's assume general nationalization or specific if the panel supports it.
                        // Looking at ForeignInvestmentPanel code it passed specific investment ID if button was per row,
                        // but the general button iterated all.
                        // InternationalEconomyPanel implementation calls onNationalize without args for the policy button.
                        // So we implement general nationalization here for safety.
                         foreignInvestments.forEach((investment) => {
                            onDiplomaticAction('player', 'nationalize_foreign_investment', {
                                investmentId: investment.id,
                            });
                        });
                    }
                }}
            />

            <OrganizationDetailsModal
                isOpen={showOrganizationModal}
                onClose={() => {
                    setShowOrganizationModal(false);
                    setSelectedOrganization(null);
                }}
                organization={selectedOrganization}
                nations={visibleNations}
                playerNationId="player"
                empireName={gameState?.empireName || '我的帝国'}
                silver={resources?.silver || 0}
                daysElapsed={daysElapsed}
                isDiplomacyUnlocked={(type, id) => isDiplomacyUnlocked(type, id, epoch)}
                onLeave={(orgId) => {
                    if (onDiplomaticAction) {
                        onDiplomaticAction('player', 'leave_org', { orgId });
                    }
                }}
                onNegotiateWithFounder={(founderNation, organization) => {
                    // Close the organization modal and open negotiation with founder
                    setShowOrganizationModal(false);
                    setSelectedOrganization(null);
                    // Select the founder nation to open diplomacy view
                    if (founderNation && onSelectNation) {
                        onSelectNation(founderNation.id);
                    }
                }}
            />
        </div>
    );
};

export const DiplomacyTab = memo(DiplomacyTabComponent);
