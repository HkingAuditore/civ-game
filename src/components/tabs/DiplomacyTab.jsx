// 外交标签页
// 展示国家状态、贸易套利与和平谈判

import React, { useMemo, useState, useEffect, memo } from 'react';
import { Icon } from '../common/UIComponents';
import { Modal } from '../common/UnifiedUI';
import { BottomSheet } from './BottomSheet';
import { DeclareWarModal } from '../modals/DeclareWarModal';
import TradeRoutesModal from '../modals/TradeRoutesModal';
import {
    DIPLOMACY_ERA_UNLOCK,
    EPOCHS,
    RESOURCES,
    TREATY_TYPE_LABELS,
    getTreatyDuration,
    isDiplomacyUnlocked,
    VASSAL_TYPE_CONFIGS,
    VASSAL_TYPE_LABELS,
    calculateIndependenceDesire,
    BUILDINGS,
} from '../../config';
import { calculateEnhancedTribute } from '../../logic/diplomacy/vassalSystem';
import { calculateNationBattlePower } from '../../config/militaryUnits';
import { calculateForeignPrice, calculateTradeStatus } from '../../utils/foreignTrade';
import { calculateDynamicGiftCost, calculateProvokeCost } from '../../utils/diplomaticUtils';
import { formatNumberShortCN } from '../../utils/numberFormat';
import { calculateNegotiationAcceptChance } from '../../logic/diplomacy/negotiation';
import {
    OVERSEAS_INVESTMENT_CONFIGS,
    INVESTABLE_BUILDINGS,
    getInvestmentsInNation,
    calculateOverseasInvestmentSummary,
} from '../../logic/diplomacy/overseasInvestment';
import { DiplomacyStatsPanel } from '../panels/DiplomacyStatsPanel';
import { VassalPolicyModal } from '../modals/VassalPolicyModal';
import { OverseasInvestmentPanel } from '../panels/OverseasInvestmentPanel';
import RebellionPanel from '../panels/RebellionPanel';
import MigrationPanel from '../panels/MigrationPanel';
import EraProgressionPanel from '../panels/EraProgressionPanel';

const relationInfo = (relation = 0, isAllied = false) => {
    // 如果是正式盟友，显示盟友标签
    if (isAllied) return { label: '盟友', color: 'text-green-300', bg: 'bg-green-900/20' };
    // 否则根据关系值显示
    if (relation >= 80) return { label: '亲密', color: 'text-emerald-300', bg: 'bg-emerald-900/20' };
    if (relation >= 60) return { label: '友好', color: 'text-blue-300', bg: 'bg-blue-900/20' };
    if (relation >= 40) return { label: '中立', color: 'text-gray-300', bg: 'bg-gray-800/40' };
    if (relation >= 20) return { label: '冷淡', color: 'text-yellow-300', bg: 'bg-yellow-900/20' };
    return { label: '敌对', color: 'text-red-300', bg: 'bg-red-900/20' };
};
const getTreatyLabel = (type) => TREATY_TYPE_LABELS[type] || type;
const getTreatyUnlockEraName = (type) => {
    const unlockEra = DIPLOMACY_ERA_UNLOCK.treaties[type]?.minEra ?? 0;
    return EPOCHS[unlockEra]?.name || `Era ${unlockEra}`;
};

const NEGOTIATION_MAX_ROUNDS = 3;
const NEGOTIABLE_TREATY_TYPES = [
    'peace_treaty',
    'non_aggression',
    'trade_agreement',
    'open_market',
    'free_trade',
    'investment_pact',
    'academic_exchange',
    'defensive_pact',
];


/**
 * Calculate max trade routes allowed with a nation based on relation and alliance * @param {number} relation - Relation value (0-100)
 * @param {boolean} isAllied - Whether formally allied with this nation
 * @returns {number} Max trade routes allowed
 */
const getMaxTradeRoutesForRelation = (relation = 0, isAllied = false) => {
    if (isAllied) return 5; // Formal alliance: 5 routes
    if (relation >= 80) return 4; // Very friendly: 4 routes
    if (relation >= 60) return 3; // Friendly: 3 routes
    if (relation >= 40) return 2; // Neutral: 2 routes
    if (relation >= 20) return 1; // Cold: 1 route
    return 0; // Hostile: no trade
};

/**
 * Get count of trade routes with a specific nation
 * @param {Array} routes - All trade routes
 * @param {string} nationId - Target nation ID
 * @returns {number} Number of routes with this nation
 */
const getRouteCountWithNation = (routes = [], nationId) => {
    return routes.filter(r => r.nationId === nationId).length;
};

const formatStatValue = (value, unit = '') => {
    if (!Number.isFinite(value)) return `未知${unit}`;
    return `${formatNumberShortCN(value, { decimals: 1 })}${unit}`;
};

const getEstimatedMilitaryStrength = (nation, epoch, daysElapsed) => {
    if (!nation) return { label: '未知', colorClass: 'text-gray-400' };
    const relation = nation?.relation || 0;
    const realPower = calculateNationBattlePower(nation, epoch);
    const accuracyFactor = Math.max(0.1, relation / 100);
    const errorRange = 1 - accuracyFactor;
    const seedStr = `${nation?.id || 'unknown'}-${Math.floor(daysElapsed / 30)}`;
    let seedHash = 0;
    for (let i = 0; i < seedStr.length; i++) {
        seedHash = ((seedHash << 5) - seedHash) + seedStr.charCodeAt(i);
        seedHash |= 0;
    }
    const stableRandom = ((Math.abs(seedHash) % 1000) / 1000) - 0.5;
    const estimatedPower = Math.floor(realPower * (1 + stableRandom * errorRange * 0.5));
    const formatPower = (p) => formatNumberShortCN(p, { decimals: 1 });
    const label = relation >= 60
        ? `约 ${formatPower(estimatedPower)}`
        : relation >= 40
            ? `${formatPower(Math.floor(estimatedPower * 0.8))} - ${formatPower(Math.floor(estimatedPower * 1.2))}`
            : relation >= 20
                ? '情报不足'
                : '未知';
    const colorClass = relation >= 60
        ? 'text-green-300'
        : relation >= 40
            ? 'text-yellow-300'
            : 'text-gray-400';
    return { label, colorClass };
};

// 动态送礼成本将在组件内根据双方财富计算

const getPreferredResources = (nation) => {
    if (!nation?.economyTraits?.resourceBias) return [];
    return Object.entries(nation.economyTraits.resourceBias)
        .filter(([, bias]) => bias > 1.05)
        .sort((a, b) => b[1] - a[1])
        .map(([key, bias]) => ({
            key,
            bias,
            name: RESOURCES[key]?.name || key,
            icon: RESOURCES[key]?.icon || 'Box',
            color: RESOURCES[key]?.color || 'text-gray-300',
        }));
};

const CULTURAL_TRAIT_LABELS = {
    adaptability: 'Adaptability',
    militaryFocus: 'Military focus',
    marketExpertise: 'Market expertise',
    diplomaticMastery: 'Diplomatic mastery',
};

const TRADE_STYLE_LABELS = {
    aggressive: '激进型',
    merchant: '商人型',
    maritime: '海洋型',
    monopolistic: '垄断型',
    capitalist: '资本型',
};

const formatCulturalTraitValue = (trait, value) => {
    if (typeof value === 'boolean') return '';
    if (trait === 'tradingStyle' && typeof value === 'string') {
        const styleLabel = TRADE_STYLE_LABELS[value] || value;
        return ` (${styleLabel})`;
    }
    if (typeof value === 'number') {
        return ` (${(value * 100).toFixed(0)}%)`;
    }
    if (value != null && value !== '') {
        return ` (${value})`;
    }
    return '';
};

const DiplomacyTabComponent = ({
    nations = [],
    epoch = 0,
    market = {},
    resources = {},
    daysElapsed = 0,
    onDiplomaticAction,
    tradeRoutes = { routes: [] },
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
}) => {
    const [selectedNationId, setSelectedNationId] = useState(null);
    const [tradeAmount, setTradeAmount] = useState(10);
    // State for provoke modal
    const [showProvokeModal, setShowProvokeModal] = useState(false);
    const [provokeTargetId, setProvokeTargetId] = useState(null);
    // State for declare war confirmation modal
    const [showDeclareWarModal, setShowDeclareWarModal] = useState(false);
    // State for trade routes management modal
    const [showTradeRoutesModal, setShowTradeRoutesModal] = useState(false);
    // State for multi-round negotiation modal
    const [showNegotiationModal, setShowNegotiationModal] = useState(false);
    const [negotiationRound, setNegotiationRound] = useState(1);
    const [negotiationCounter, setNegotiationCounter] = useState(null);
    const [negotiationDraft, setNegotiationDraft] = useState({
        type: 'trade_agreement',
        durationDays: 365,
        maintenancePerDay: 0,
        signingGift: 0,
        resourceKey: '',
        resourceAmount: 0,
        stance: 'normal',
    });
    const [showNationModal, setShowNationModal] = useState(false);
    const [sheetSection, setSheetSection] = useState('diplomacy');
    // 附庸政策模态框状态
    const [showVassalPolicyModal, setShowVassalPolicyModal] = useState(false);
    const [vassalPolicyTarget, setVassalPolicyTarget] = useState(null);
    // 海外投资面板状态
    const [showOverseasInvestmentPanel, setShowOverseasInvestmentPanel] = useState(false);
    const [investmentPanelNation, setInvestmentPanelNation] = useState(null);
    const [mobileTab, setMobileTab] = useState('nations'); // 'nations', 'world', 'organizations', 'migration'

    // 外交动作冷却时间配置（天数）
    const DIPLOMATIC_COOLDOWNS = {
        gift: 30,
        demand: 60,
        provoke: 90,
        propose_alliance: 60,
        propose_treaty: 120,
        negotiate_treaty: 120,
    };

    /**
     * 计算外交行动的冷却状态
     * @param {Object} nation - 目标国家对象
     * @param {string} actionType - 外交行动类型
     * @returns {{ isOnCooldown: boolean, remainingDays: number }} 冷却状态
     */
    const getDiplomaticCooldown = (nation, actionType) => {
        if (!nation) return { isOnCooldown: false, remainingDays: 0 };

        const baseCooldown = DIPLOMATIC_COOLDOWNS[actionType] || 30;
        // 应用冷却时间修改器（负值减少冷却时间）
        const adjustedCooldown = Math.max(1, Math.round(baseCooldown * (1 + diplomaticCooldownMod)));

        const lastActionDay = nation.lastDiplomaticActionDay?.[actionType] || 0;
        if (lastActionDay <= 0) {
            return { isOnCooldown: false, remainingDays: 0 };
        }

        const daysSinceLastAction = daysElapsed - lastActionDay;
        const remainingDays = Math.max(0, adjustedCooldown - daysSinceLastAction);

        return {
            isOnCooldown: remainingDays > 0,
            remainingDays: Math.ceil(remainingDays),
        };
    };

    const tradableResources = useMemo(
        () =>
            Object.entries(RESOURCES).filter(
                ([key, def]) =>
                    def.type !== 'virtual' &&
                    key !== 'silver' &&
                    (def.unlockEpoch ?? 0) <= epoch
            ),
        [epoch]
    );

    const visibleNations = useMemo(
        () =>
            nations.filter(
                (nation) =>
                    epoch >= (nation.appearEpoch ?? 0) &&
                    (nation.expireEpoch == null || epoch <= nation.expireEpoch)
            ),
        [nations, epoch]
    );

    useEffect(() => {
        if (!selectedNationId && visibleNations.length > 0) {
            setSelectedNationId(visibleNations[0].id);
        } else if (selectedNationId && !visibleNations.some((n) => n.id === selectedNationId)) {
            setSelectedNationId(visibleNations[0]?.id || null);
        }
    }, [selectedNationId, visibleNations]);

    useEffect(() => {
        if (showNationModal) {
            setSheetSection('diplomacy');
        }
    }, [showNationModal]);

    const selectedNation =
        visibleNations.find((nation) => nation.id === selectedNationId) || visibleNations[0] || null;
    const selectedRelation = selectedNation ? relationInfo(selectedNation.relation, selectedNation.alliedWithPlayer === true) : null;
    const negotiationUnlocked = isDiplomacyUnlocked('economy', 'multi_round_negotiation', epoch);

    const getDefaultNegotiationType = () => {
        const unlockedType = NEGOTIABLE_TREATY_TYPES.find((type) => isDiplomacyUnlocked('treaties', type, epoch));
        return unlockedType || 'peace_treaty';
    };

    const buildNegotiationDraft = (type) => ({
        type,
        durationDays: getTreatyDuration(type, epoch),
        maintenancePerDay: 0,
        signingGift: 0,
        resourceKey: '',
        resourceAmount: 0,
        stance: 'normal',
    });

    const openNegotiationModal = () => {
        const type = getDefaultNegotiationType();
        setNegotiationDraft(buildNegotiationDraft(type));
        setNegotiationCounter(null);
        setNegotiationRound(1);
        setShowNegotiationModal(true);
    };

    const closeNegotiationModal = () => {
        setShowNegotiationModal(false);
        setNegotiationCounter(null);
        setNegotiationRound(1);
    };

    const negotiationEvaluation = useMemo(() => {
        if (!selectedNation) return { acceptChance: 0, relationGate: false };
        return calculateNegotiationAcceptChance({
            proposal: negotiationDraft,
            nation: selectedNation,
            epoch,
            stance: negotiationDraft.stance,
        });
    }, [selectedNation, negotiationDraft, epoch]);

    const handleNegotiationResult = (result) => {
        if (!result) return;
        if (result.status === 'counter' && result.counterProposal) {
            setNegotiationCounter(result.counterProposal);
            setNegotiationDraft((prev) => ({ ...prev, ...result.counterProposal }));
            setNegotiationRound((prev) => Math.min(NEGOTIATION_MAX_ROUNDS, prev + 1));
            return;
        }
        closeNegotiationModal();
    };

    const submitNegotiation = (proposal, options = {}) => {
        if (!selectedNation || typeof onDiplomaticAction !== 'function') return;
        const nextRound = options?.round || negotiationRound;
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

    const selectedPreferences = useMemo(() => getPreferredResources(selectedNation), [selectedNation]);

    const totalAllies = visibleNations.filter((n) => n.alliedWithPlayer === true).length;
    const totalWars = visibleNations.filter((n) => n.isAtWar).length;

    // 获取商人岗位信息
    const merchantJobLimit = jobsAvailable?.merchant || 0;
    const merchantCount = popStructure?.merchant || 0;
    // 派驻商人统计（新系统）
    const assignedMerchants = useMemo(() => {
        const assignments = merchantState?.merchantAssignments || {};
        return Object.values(assignments).reduce((sum, v) => sum + Math.max(0, Math.floor(Number(v) || 0)), 0);
    }, [merchantState?.merchantAssignments]);
    const remainingMerchants = Math.max(0, merchantCount - assignedMerchants);

    // 检查是否已存在贸易路线
    const hasTradeRoute = (nationId, resourceKey, type) => {
        if (!tradeRoutes || !tradeRoutes.routes || !Array.isArray(tradeRoutes.routes)) {
            return false;
        }
        return tradeRoutes.routes.some(
            route => route.nationId === nationId && route.resource === resourceKey && route.type === type
        );
    };

    const handleTradeRoute = (resourceKey, type) => {
        if (!selectedNation || !onTradeRouteAction) return;
        const exists = hasTradeRoute(selectedNation.id, resourceKey, type);
        if (exists) {
            // 取消贸易路线
            onTradeRouteAction(selectedNation.id, 'cancel', { resource: resourceKey, type });
        } else {
            // 创建贸易路线
            onTradeRouteAction(selectedNation.id, 'create', { resource: resourceKey, type });
        }
    };

    const handleSimpleAction = (nationId, action, payload) => {
        if (onDiplomaticAction) {
            onDiplomaticAction(nationId, action, payload);
        }
    };

    // Handler for provoke action with target selection
    const handleProvokeWithTarget = () => {
        if (!selectedNation || !provokeTargetId || !onDiplomaticAction) return;
        onDiplomaticAction(selectedNation.id, 'provoke', { targetNationId: provokeTargetId });
        setShowProvokeModal(false);
        setProvokeTargetId(null);
    };

    // Get nations that can be provoked against (other visible nations)
    const provokeTargetNations = useMemo(() => {
        if (!selectedNation) return [];
        return visibleNations.filter(n => n.id !== selectedNation.id);
    }, [visibleNations, selectedNation]);

    // 计算目标国家的正式同盟国
    const targetNationAllies = useMemo(() => {
        if (!selectedNation) return [];
        return visibleNations.filter(n => {
            if (n.id === selectedNation.id) return false;
            // 检查目标国家的正式联盟
            const isAllied = (selectedNation.allies || []).includes(n.id) ||
                (n.allies || []).includes(selectedNation.id);
            return isAllied;
        }).map(ally => ({
            ...ally,
            foreignRelation: selectedNation.foreignRelations?.[ally.id] ?? 50,
        }));
    }, [visibleNations, selectedNation]);

    const getLocalPrice = (resourceKey) => {
        return market?.prices?.[resourceKey] ?? (RESOURCES[resourceKey]?.basePrice || 1);
    };

    const renderPeaceHint = (nation) => {
        if (!nation?.isAtWar) return null;
        if ((nation.warScore || 0) > 0) {
            return '我方占优，可尝试索赔停战。';
        }
        if ((nation.warScore || 0) < 0) {
            return '局势不利，可能需要赔款求和。';
        }
        return '僵持阶段，继续作战或准备谈判。';
    };

    const renderMobileOrganizations = () => {
        const organizations = Array.isArray(diplomacyOrganizations?.organizations)
            ? diplomacyOrganizations.organizations
            : [];
        const playerOrgs = organizations.filter(org =>
            Array.isArray(org?.members) && org.members.includes('player')
        );

        const ORG_TYPES = [
            { type: 'military_alliance', name: '军事联盟', icon: 'Shield', era: 3, color: 'red' },
            { type: 'economic_bloc', name: '经济共同体', icon: 'TrendingUp', era: 5, color: 'amber' },
            { type: 'trade_zone', name: '自贸区', icon: 'Globe', era: 5, color: 'cyan' },
        ];

        return (
            <div className="space-y-4 pb-20">
                {/* 组织创建 */}
                <div className="p-3 bg-gray-900/60 rounded-lg border border-gray-700/50">
                    <h4 className="text-sm font-bold text-white font-decorative flex items-center gap-2 mb-3">
                        <Icon name="Users" size={14} className="text-purple-300" />
                        创建国际组织
                    </h4>

                    <div className="grid grid-cols-3 gap-2 text-xs">
                        {ORG_TYPES.map(orgType => {
                            const isUnlocked = isDiplomacyUnlocked('organizations', orgType.type, epoch);
                            const playerHasOrg = playerOrgs.some(o => o.type === orgType.type);

                            const blocked = !isUnlocked;
                            let buttonText = playerHasOrg ? '已创建' : `创建${orgType.name.substring(0, 2)}`;
                            let canClick = isUnlocked && !playerHasOrg;

                            return (
                                <button
                                    key={orgType.type}
                                    className={`p-2 rounded border flex flex-col items-center gap-1 ${canClick
                                        ? 'bg-gray-800 border-gray-600 hover:bg-gray-700 text-white'
                                        : 'bg-gray-900/50 border-gray-800 text-gray-600 cursor-not-allowed'
                                        }`}
                                    onClick={() => {
                                        if (canClick) {
                                            onDiplomaticAction('player', 'create_org', { type: orgType.type });
                                        }
                                    }}
                                    disabled={!canClick}
                                >
                                    <Icon name={orgType.icon} size={14} className={canClick ? 'text-amber-400' : 'text-gray-600'} />
                                    <span>{isUnlocked ? buttonText : '未解锁'}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* 玩家组织列表 */}
                {playerOrgs.length > 0 ? (
                    <div className="p-3 bg-gray-900/60 rounded-lg border border-gray-700/50">
                        <h4 className="text-sm font-bold text-white mb-2">我的组织</h4>
                        <div className="space-y-2">
                            {playerOrgs.map(org => {
                                const orgType = ORG_TYPES.find(t => t.type === org.type);
                                return (
                                    <div key={org.id} className="flex items-center justify-between bg-gray-800 rounded px-3 py-2 border border-gray-700">
                                        <div className="flex items-center gap-2">
                                            <Icon name={orgType?.icon || 'Users'} size={14} className="text-blue-400" />
                                            <span className="text-sm text-gray-200">{org.name}</span>
                                        </div>
                                        <span className="text-xs text-gray-500">{org.members?.length || 0} 成员</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div className="text-center text-gray-500 text-xs py-4">
                        你尚未建立任何国际组织
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-2 font-body">
            {/* 精简的统计信息 - 仅在桌面端显示 */}
            <div className="hidden md:flex gap-2 text-xs font-epic">
                <div className="bg-gray-800/60 px-2 py-1 rounded border border-gray-700">
                    <span className="text-gray-400 font-body">国家:</span>
                    <span className="text-white font-semibold ml-1 font-epic">{visibleNations.length}</span>
                </div>
                <div className="bg-green-900/20 px-2 py-1 rounded border border-green-600/20">
                    <span className="text-gray-400 font-body">盟友:</span>
                    <span className="text-green-300 font-semibold ml-1 font-epic">{totalAllies}</span>
                </div>
                <div className="bg-red-900/20 px-2 py-1 rounded border border-red-600/30">
                    <span className="text-gray-400 font-body">战争:</span>
                    <span className="text-red-300 font-semibold ml-1 font-epic">{totalWars}</span>
                </div>
                <div className="bg-amber-900/20 px-2 py-1 rounded border border-amber-600/20 flex items-center gap-2">
                    <span className="text-gray-400 font-body">派驻商人:</span>
                    <span className={`font-semibold ml-1 font-epic ${assignedMerchants > 0 ? 'text-amber-300' : 'text-gray-500'}`}>
                        {assignedMerchants}/{merchantCount}
                    </span>
                    <span className="text-gray-500 text-[10px] ml-1 font-body">(剩余:{remainingMerchants})</span>
                    <button
                        onClick={() => setShowTradeRoutesModal(true)}
                        className="ml-auto flex items-center gap-1 px-2 py-0.5 bg-amber-600 hover:bg-amber-500 text-white text-[10px] rounded shadow-sm border border-amber-400/50 transition-all active:scale-95"
                        title="派驻商人"
                    >
                        <Icon name="Users" size={10} />
                        <span className="font-bold">派驻</span>
                    </button>
                </div>
                <div className="bg-blue-900/20 px-2 py-1 rounded border border-blue-600/20">
                    <span className="text-gray-400 font-body">商人总数:</span>
                    <span className="text-blue-300 font-semibold ml-1 font-epic">{merchantCount}/{merchantJobLimit}</span>
                </div>
            </div>

            {/* 外交统计面板 - 仅在桌面端显示 */}
            <div className="hidden md:block">
                <DiplomacyStatsPanel
                    nations={visibleNations}
                    daysElapsed={daysElapsed}
                    tradeRoutes={tradeRoutes}
                    overseasInvestments={overseasInvestments}
                />
            </div>

            {/* Mobile Tab Navigation */}
            <div className="md:hidden flex items-center justify-between bg-gray-900/90 p-1 rounded-lg mb-3 border border-gray-700/50 sticky top-0 z-20 backdrop-blur-md shadow-lg">
                {[
                    { id: 'nations', label: '列国', icon: 'Flag' },
                    { id: 'world', label: '局势', icon: 'Globe' },
                    { id: 'organizations', label: '组织', icon: 'Users' },
                    { id: 'migration', label: '移民', icon: 'Footprints' },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setMobileTab(tab.id)}
                        className={`flex-1 flex flex-col items-center justify-center py-1.5 rounded-md transition-all duration-200 ${mobileTab === tab.id
                            ? 'bg-gray-700 text-amber-400 shadow-md'
                            : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                            }`}
                    >
                        <Icon name={tab.icon} size={16} className="mb-0.5" />
                        <span className="text-[10px] font-bold">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Mobile Content Area */}
            <div className="md:hidden">
                {mobileTab === 'nations' && (
                    <div className="space-y-2">
                        {/* Mobile Trade Routes Button */}
                        <div className="flex items-center justify-between gap-2 bg-gray-800/60 px-3 py-2 rounded-lg border border-gray-700 text-xs">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1">
                                    <span className="text-gray-400">派驻:</span>
                                    <span className={`font-semibold ${assignedMerchants > 0 ? 'text-amber-300' : 'text-gray-500'}`}>
                                        {assignedMerchants}/{merchantCount}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="text-gray-400">剩余:</span>
                                    <span className="text-green-300 font-semibold">{remainingMerchants}</span>
                                </div>
                            </div>

                            <button
                                onClick={() => setShowTradeRoutesModal(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs rounded shadow-sm border border-amber-400/50 transition-all active:scale-95"
                            >
                                <Icon name="Users" size={14} />
                                <span className="font-bold">派驻商人</span>
                            </button>
                        </div>

                        {/* Nations List */}
                        <div className="grid grid-cols-1 gap-2 pb-20">
                            {visibleNations.map((nation) => {
                                const relation = relationInfo(nation.relation || 0, nation.alliedWithPlayer === true);
                                const militaryEstimate = getEstimatedMilitaryStrength(nation, epoch, daysElapsed);
                                const compactMilitaryLabel = militaryEstimate.label === '情报不足'
                                    ? '情报不足'
                                    : militaryEstimate.label === '未知'
                                        ? '??'
                                        : militaryEstimate.label;
                                return (
                                    <button
                                        key={nation.id}
                                        onClick={() => {
                                            setSelectedNationId(nation.id);
                                            setShowNationModal(true);
                                        }}
                                        className="w-full rounded-xl border border-ancient-gold/20 bg-gray-900/60 p-3 text-left transition-all hover:border-ancient-gold/40 shadow-sm active:bg-gray-800"
                                    >
                                        {/* 第一行：国家名称和关系标签 */}
                                        <div className="flex items-center gap-2 mb-2">
                                            <Icon name="Flag" size={16} className={nation.color || 'text-gray-300'} />
                                            <span className="text-sm font-semibold text-white flex-1">{nation.name || '未知国家'}</span>
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] flex-shrink-0 ${relation.bg} ${relation.color} font-epic`}>
                                                {relation.label}
                                            </span>
                                            {nation.vassalOf === 'player' && (
                                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-900 text-purple-200 font-epic flex-shrink-0">
                                                    {VASSAL_TYPE_LABELS[nation.vassalType] || '附庸'}
                                                </span>
                                            )}
                                            {nation.isRebelNation && (
                                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-900 text-red-100 font-epic flex-shrink-0">
                                                    叛乱
                                                </span>
                                            )}
                                            <Icon
                                                name={(nation.isAtWar === true) ? 'Swords' : 'ShieldCheck'}
                                                size={14}
                                                className={(nation.isAtWar === true) ? 'text-red-400 flex-shrink-0' : 'text-green-400 flex-shrink-0'}
                                            />
                                        </div>
                                        {/* 第二行：数值统计 */}
                                        <div className="flex items-center justify-start gap-4 text-[11px] text-gray-200 font-body">
                                            <span className="flex items-center gap-1">
                                                <Icon name="Users" size={12} className="text-blue-300" />
                                                <span className="font-mono text-blue-100 font-semibold font-epic">
                                                    {formatStatValue(nation?.population, '')}
                                                </span>
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Icon name="Coins" size={12} className="text-amber-300" />
                                                <span className="font-mono text-amber-100 font-semibold font-epic">
                                                    {formatStatValue(nation?.wealth, '')}
                                                </span>
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Icon name="Swords" size={12} className="text-red-300" />
                                                <span className={`font-mono font-semibold font-epic ${militaryEstimate.colorClass}`}>
                                                    {compactMilitaryLabel}
                                                </span>
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                            {visibleNations.length === 0 && (
                                <div className="p-3 text-xs text-gray-400 font-body text-center">当前时代暂无可接触的国家。</div>
                            )}
                        </div>
                    </div>
                )}

                {mobileTab === 'world' && (
                    <div className="pb-20">
                        <RebellionPanel
                            nations={visibleNations}
                            onIntervene={(nationId, action) => onDiplomaticAction(nationId, 'foreign_intervention', { interventionType: action })}
                            playerResources={resources}
                        />
                    </div>
                )}

                {mobileTab === 'organizations' && renderMobileOrganizations()}

                {mobileTab === 'migration' && (
                    <div className="pb-20">
                        <MigrationPanel
                            currentPolicy={gameState.borderPolicy}
                            onPolicyChange={(policy) => onDiplomaticAction('player', 'set_border_policy', { policy })}
                            migrationStats={gameState.migrationStats}
                            recentFlows={gameState.recentMigrationFlows}
                            population={population}
                        />
                    </div>
                )}
            </div>

            <div className="hidden md:grid grid-cols-1 xl:grid-cols-3 gap-3 h-[calc(var(--real-viewport-height,100vh)-260px)] md:h-[900px]">
                <div className="glass-ancient rounded-xl border border-ancient-gold/30 flex flex-col overflow-hidden">
                    <div className="px-2 py-1.5 border-b border-gray-700/80 text-[15px] uppercase tracking-wide text-gray-400 font-decorative font-bold">
                        国家列表
                    </div>
                    <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-900 hover:scrollbar-thumb-gray-500">
                        {visibleNations.map((nation, idx) => {
                            if (!nation) return null;
                            const relation = relationInfo(nation.relation || 0, nation.alliedWithPlayer === true);
                            const isSelected = nation.id === selectedNation?.id;
                            return (
                                <button
                                    key={nation.id}
                                    onClick={() => setSelectedNationId(nation.id)}
                                    className={`w-full flex items-center gap-2 px-2 py-1.5 text-left transition-colors border-b border-gray-700/60 focus:outline-none font-body ${isSelected ? 'bg-blue-900/30 border-l-2 border-l-blue-400' : 'hover:bg-gray-800/60'
                                        } ${idx === visibleNations.length - 1 ? 'border-b-0' : ''}`}
                                >
                                    <Icon name="Flag" size={14} className={nation.color || 'text-gray-300'} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-xs font-semibold text-white truncate">{nation.name || '未知国家'}</span>
                                            <span className={`px-1 py-0.5 rounded text-[9px] ${relation.bg} ${relation.color} font-epic`}>
                                                {relation.label}
                                            </span>
                                            {nation.isRebelNation && (
                                                <span className="px-1 py-0.5 rounded text-[9px] bg-red-900 text-red-100 font-epic">
                                                    叛乱
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <Icon
                                        name={(nation.isAtWar === true) ? 'Swords' : 'ShieldCheck'}
                                        size={12}
                                        className={(nation.isAtWar === true) ? 'text-red-400' : 'text-green-400'}
                                    />
                                </button>
                            );
                        })}
                        {visibleNations.length === 0 && (
                            <div className="p-3 text-xs text-gray-400 font-body">当前时代暂无可接触的国家。</div>
                        )}
                    </div>
                </div>

                <div className="xl:col-span-2 space-y-2 max-h-[calc(var(--real-viewport-height,100vh)-180px)] md:max-h-[900px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 hover:scrollbar-thumb-gray-500">
                    {selectedNation ? (
                        <React.Fragment>
                            <div className="bg-gray-800/60 p-2 rounded-lg border border-gray-700">
                                <div className="flex items-center justify-between gap-2 mb-2">
                                    <div className="flex items-center gap-1.5">
                                        <Icon name="Globe" size={14} className="text-amber-300" />
                                        <h3 className="text-sm font-bold text-white font-decorative">{selectedNation?.name || '未知国家'}</h3>
                                        {selectedNation?.type && (
                                            <span className="px-1.5 py-0.5 text-[9px] rounded bg-indigo-900/40 text-indigo-300 border border-indigo-500/30 font-epic">
                                                {selectedNation.type}
                                            </span>
                                        )}
                                        {selectedRelation && (
                                            <span className={`px-1.5 py-0.5 text-[9px] rounded ${selectedRelation.bg} ${selectedRelation.color} font-epic`}>
                                                {selectedRelation.label}
                                            </span>
                                        )}
                                    </div>
                                    <Icon
                                        name={(selectedNation?.isAtWar === true) ? 'Swords' : 'ShieldCheck'}
                                        size={14}
                                        className={(selectedNation?.isAtWar === true) ? 'text-red-400' : 'text-green-400'}
                                    />
                                </div>

                                {/* 国家描述 */}
                                {selectedNation?.desc && (
                                    <div className="mb-2 p-2 bg-gray-900/40 rounded border border-gray-700/50">
                                        <p className="text-[11px] text-gray-300 leading-relaxed font-body">
                                            <Icon name="BookOpen" size={10} className="inline mr-1 text-amber-300" />
                                            {selectedNation.desc}
                                        </p>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-1 mb-2 text-xs font-body">
                                    <div className="p-2 rounded border border-blue-500/20 bg-blue-900/10 flex items-center justify-between">
                                        <div className="flex items-center gap-1 text-blue-200 font-body">
                                            <Icon name="Users" size={12} />
                                            人口
                                        </div>
                                        <span className="font-mono text-blue-100 font-semibold font-epic">
                                            {formatStatValue(selectedNation?.population, '')}
                                        </span>
                                    </div>
                                    <div className="p-2 rounded border border-amber-500/20 bg-amber-900/10 flex items-center justify-between">
                                        <div className="flex items-center gap-1 text-amber-200 font-body">
                                            <Icon name="Coins" size={12} />
                                            财富
                                        </div>
                                        <span className="font-mono text-amber-100 font-semibold font-epic">
                                            {formatStatValue(selectedNation?.wealth, ' 银')}
                                        </span>
                                    </div>
                                </div>

                                {/* 大致兵力估算 - 使用真实战力计算，关系越好越准确 */}
                                {(() => {
                                    const strengthEstimate = getEstimatedMilitaryStrength(selectedNation, epoch, daysElapsed);
                                    return (
                                        <div className="p-2 rounded border border-red-500/20 bg-red-900/10 flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-1 text-red-200 font-body">
                                                <Icon name="Swords" size={12} />
                                                军事力量
                                            </div>
                                            <span className={`font-mono font-semibold font-epic ${strengthEstimate.colorClass}`}>
                                                {strengthEstimate.label}
                                            </span>
                                        </div>
                                    );
                                })()}

                                {/* 当前战争状态 */}
                                {selectedNation?.foreignWars && Object.keys(selectedNation.foreignWars).some(
                                    id => selectedNation.foreignWars[id]?.isAtWar && visibleNations.find(n => n.id === id)
                                ) && (
                                        <div className="p-2 rounded border border-orange-500/20 bg-orange-900/10 mb-2">
                                            <div className="flex items-center gap-1 text-orange-200 font-body mb-1">
                                                <Icon name="Flame" size={12} />
                                                正在与其他国家交战
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                                {Object.keys(selectedNation.foreignWars)
                                                    .filter(id => selectedNation.foreignWars[id]?.isAtWar)
                                                    .map(enemyId => {
                                                        const enemy = visibleNations.find(n => n.id === enemyId);
                                                        return enemy ? (
                                                            <span key={enemyId} className="px-1.5 py-0.5 rounded bg-red-900/40 text-red-200 text-[10px] font-body">
                                                                ⚔️ {enemy.name}
                                                            </span>
                                                        ) : null;
                                                    })}
                                            </div>
                                        </div>
                                    )}

                                {/* 附庸状态显示 */}
                                {selectedNation?.vassalOf === 'player' && (
                                    <div className="p-2 rounded border border-purple-500/30 bg-purple-900/20 mb-2">
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-1 text-purple-200 font-body">
                                                <Icon name="Crown" size={12} />
                                                {VASSAL_TYPE_LABELS[selectedNation.vassalType] || '附庸国'}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    className="px-2 py-0.5 text-[10px] rounded bg-blue-600 hover:bg-blue-500 text-white font-body"
                                                    onClick={() => {
                                                        setVassalPolicyTarget(selectedNation);
                                                        setShowVassalPolicyModal(true);
                                                    }}
                                                    title="调整该附庸国的外交控制、贸易政策、自主度和朝贡率"
                                                >
                                                    调整政策
                                                </button>
                                                <button
                                                    className="px-2 py-0.5 text-[10px] rounded bg-purple-600 hover:bg-purple-500 text-white font-body"
                                                    onClick={() => onDiplomaticAction(selectedNation.id, 'release_vassal')}
                                                    title="释放该附庸国，对方关系将大幅提升"
                                                >
                                                    释放
                                                </button>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-1 text-[10px]">
                                            <div className="flex justify-between text-gray-300">
                                                <span>自主度</span>
                                                <span className="text-purple-200">{Math.round(selectedNation.autonomy || 0)}%</span>
                                            </div>
                                            <div className="flex justify-between text-gray-300">
                                                <span>朝贡率</span>
                                                <span className="text-amber-200">{Math.round((selectedNation.tributeRate || 0) * 100)}%</span>
                                            </div>
                                            <div className="flex justify-between text-gray-300">
                                                <span>独立倾向</span>
                                                <span className={`${(selectedNation.independencePressure || 0) > 60 ? 'text-red-300' : 'text-gray-200'}`}>
                                                    {Math.round(selectedNation.independencePressure || 0)}%
                                                </span>
                                            </div>
                                            <div className="flex justify-between text-gray-300">
                                                <span>预计朝贡</span>
                                                <span className="text-amber-200">{formatNumberShortCN(calculateEnhancedTribute(selectedNation, resources.silver || 10000).silver)}银/月</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* 可建立附庸关系（战争状态下通过战争分数判断） */}
                                {selectedNation?.isAtWar && !selectedNation?.vassalOf && (selectedNation?.warScore || 0) >= 30 && (() => {
                                    const warScore = Math.abs(selectedNation?.warScore || 0);
                                    const availableTypes = Object.entries(VASSAL_TYPE_CONFIGS)
                                        .filter(([type, config]) => {
                                            const requirements = { protectorate: 30, tributary: 50, puppet: 80, colony: 100 };
                                            return isDiplomacyUnlocked('sovereignty', type, epoch) && warScore >= requirements[type];
                                        });
                                    if (availableTypes.length === 0) return null;
                                    return (
                                        <div className="p-2 rounded border border-teal-500/30 bg-teal-900/20 mb-2">
                                            <div className="flex items-center gap-1 text-teal-200 font-body mb-1 text-[11px]">
                                                <Icon name="Flag" size={12} />
                                                战争分数足够，可要求成为附庸
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                                {availableTypes.map(([type, config]) => (
                                                    <button
                                                        key={type}
                                                        className="px-2 py-1 text-[10px] rounded bg-teal-600 hover:bg-teal-500 text-white font-body"
                                                        onClick={() => onDiplomaticAction(selectedNation.id, 'establish_vassal', { vassalType: type })}
                                                        title={config.description}
                                                    >
                                                        {config.name}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* 海外投资管理面板（对附庸国或签有投资协议的国家显示） */}
                                {(() => {
                                    // 检查是否签有投资协议
                                    const hasInvestmentPact = Array.isArray(selectedNation?.treaties) &&
                                        selectedNation.treaties.some(t => t.type === 'investment_pact' && (!t.endDay || daysElapsed < t.endDay));
                                    const canInvest = (selectedNation?.vassalOf === 'player' || hasInvestmentPact) && epoch >= 3;
                                    if (!canInvest || !selectedNation) return null;
                                    const nationInvestments = getInvestmentsInNation(overseasInvestments, selectedNation.id);
                                    const totalInvestmentValue = nationInvestments.reduce((sum, inv) => sum + (inv.investmentAmount || 0), 0);
                                    const monthlyProfit = nationInvestments.reduce((sum, inv) => sum + ((inv.operatingData?.profit || 0) * 30), 0);
                                    const operatingModeConfigs = {
                                        local: { name: '当地运营', desc: '使用当地资源和市场', icon: '🏠', color: 'text-green-400' },
                                        dumping: { name: '倾销模式', desc: '本国资源低价销售当地', icon: '📦', color: 'text-orange-400' },
                                        buyback: { name: '回购模式', desc: '产出运回本国销售', icon: '🚢', color: 'text-blue-400' },
                                    };
                                    const stratumLabels = { capitalist: '资本家', merchant: '商人', landowner: '地主' };
                                    const stratumIcons = { capitalist: '🏭', merchant: '🛒', landowner: '🌾' };

                                    return (
                                        <div className="p-2 rounded border border-amber-500/30 bg-amber-900/20 mb-2">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Icon name="Building2" size={14} className="text-amber-400" />
                                                    <div>
                                                        <div className="text-[11px] text-amber-200 font-semibold">
                                                            海外投资 ({nationInvestments.length}项)
                                                        </div>
                                                        <div className="text-[9px] text-gray-400">
                                                            总值: {formatNumberShortCN(totalInvestmentValue)} ·
                                                            月利: <span className={monthlyProfit >= 0 ? 'text-green-400' : 'text-red-400'}>
                                                                {monthlyProfit >= 0 ? '+' : ''}{formatNumberShortCN(monthlyProfit)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    className="px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-semibold flex items-center gap-1"
                                                    onClick={() => {
                                                        setInvestmentPanelNation(selectedNation);
                                                        setShowOverseasInvestmentPanel(true);
                                                    }}
                                                >
                                                    <Icon name="Settings" size={12} />
                                                    管理投资
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })()}

                                <div className="flex gap-1.5 text-xs font-body">
                                    {(() => {
                                        const giftCooldown = getDiplomaticCooldown(selectedNation, 'gift');
                                        return (
                                            <button
                                                className={`flex-1 px-2 py-1.5 rounded text-white flex items-center justify-center gap-1 font-semibold font-body ${giftCooldown.isOnCooldown ? 'bg-gray-600 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500'}`}
                                                onClick={() => handleSimpleAction(selectedNation.id, 'gift')}
                                                disabled={giftCooldown.isOnCooldown}
                                                title={giftCooldown.isOnCooldown ? `冷却中（还需${giftCooldown.remainingDays}天）` : '赠送礼物提升关系'}
                                            >
                                                <Icon name="Gift" size={12} />
                                                {giftCooldown.isOnCooldown ? `礼物(${giftCooldown.remainingDays}天)` : '礼物'}
                                            </button>
                                        );
                                    })()}
                                    {(() => {
                                        const demandCooldown = getDiplomaticCooldown(selectedNation, 'demand');
                                        return (
                                            <button
                                                className={`flex-1 px-2 py-1.5 rounded text-white flex items-center justify-center gap-1 font-semibold font-body ${demandCooldown.isOnCooldown ? 'bg-gray-600 cursor-not-allowed' : 'bg-yellow-600 hover:bg-yellow-500'}`}
                                                onClick={() => handleSimpleAction(selectedNation.id, 'demand')}
                                                disabled={demandCooldown.isOnCooldown}
                                                title={demandCooldown.isOnCooldown ? `冷却中（还需${demandCooldown.remainingDays}天）` : '向该国索要贡品'}
                                            >
                                                <Icon name="ShieldAlert" size={12} />
                                                {demandCooldown.isOnCooldown ? `索要(${demandCooldown.remainingDays}天)` : '索要'}
                                            </button>
                                        );
                                    })()}
                                    <button
                                        className={`flex-1 px-2 py-1.5 rounded text-white flex items-center justify-center gap-1 font-semibold font-body ${selectedNation.isAtWar ? 'bg-purple-600 hover:bg-purple-500' : 'bg-red-600 hover:bg-red-500'
                                            }`}
                                        onClick={() => {
                                            if (selectedNation?.isAtWar === true) {
                                                // 求和操作直接执行
                                                handleSimpleAction(selectedNation.id, 'peace');
                                            } else {
                                                // 宣战时显示确认模态框
                                                setShowDeclareWarModal(true);
                                            }
                                        }}
                                    >
                                        <Icon name={(selectedNation?.isAtWar === true) ? 'Flag' : 'Swords'} size={12} />
                                        {(selectedNation?.isAtWar === true) ? '求和' : '宣战'}
                                    </button>
                                </div>

                                {/* 挑拨关系按钮 */}
                                <div className="mt-1.5 flex gap-1.5 text-xs font-body">
                                    {(() => {
                                        const provokeCooldown = getDiplomaticCooldown(selectedNation, 'provoke');
                                        return (
                                            <button
                                                className={`flex-1 px-2 py-1.5 rounded text-white flex items-center justify-center gap-1 font-semibold font-body ${provokeCooldown.isOnCooldown ? 'bg-gray-600 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500'}`}
                                                onClick={() => {
                                                    setProvokeTargetId(null);
                                                    setShowProvokeModal(true);
                                                }}
                                                disabled={provokeCooldown.isOnCooldown}
                                                title={provokeCooldown.isOnCooldown ? `冷却中（还需${provokeCooldown.remainingDays}天）` : '花费银币离间该国与另一国家的关系'}
                                            >
                                                <Icon name="MessageSquareWarning" size={12} />
                                                {provokeCooldown.isOnCooldown ? `挑拨(${provokeCooldown.remainingDays}天)` : '挑拨关系'}
                                            </button>
                                        );
                                    })()}
                                </div>

                                {/* 结盟/解除联盟按钮 */}
                                <div className="mt-1.5 flex gap-1.5 text-xs font-body">
                                    {selectedNation?.alliedWithPlayer === true ? (
                                        <button
                                            className="flex-1 px-2 py-1.5 bg-red-700 hover:bg-red-600 rounded text-white flex items-center justify-center gap-1 font-semibold font-body"
                                            onClick={() => handleSimpleAction(selectedNation.id, 'break_alliance')}
                                            title="解除与该国的同盟关系"
                                        >
                                            <Icon name="UserMinus" size={12} /> 解除同盟
                                        </button>
                                    ) : (() => {
                                        const allianceCooldown = getDiplomaticCooldown(selectedNation, 'propose_alliance');
                                        const relationOk = (selectedNation?.relation || 0) >= 60;
                                        const notAtWar = !selectedNation?.isAtWar;
                                        const canPropose = relationOk && notAtWar && !allianceCooldown.isOnCooldown;

                                        let titleText = '请求与该国建立正式同盟';
                                        if (allianceCooldown.isOnCooldown) {
                                            titleText = `冷却中（还需${allianceCooldown.remainingDays}天）`;
                                        } else if (!relationOk) {
                                            titleText = `关系需达到60才能请求结盟（当前：${Math.round(selectedNation?.relation || 0)}）`;
                                        } else if (!notAtWar) {
                                            titleText = '无法与交战国结盟';
                                        }

                                        return (
                                            <button
                                                className={`flex-1 px-2 py-1.5 rounded text-white flex items-center justify-center gap-1 font-semibold font-body ${canPropose ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-gray-600 cursor-not-allowed'}`}
                                                onClick={() => handleSimpleAction(selectedNation.id, 'propose_alliance')}
                                                disabled={!canPropose}
                                                title={titleText}
                                            >
                                                <Icon name="Users" size={12} />
                                                {allianceCooldown.isOnCooldown ? `结盟(${allianceCooldown.remainingDays}天)` : '请求结盟'}
                                            </button>
                                        );
                                    })()}
                                </div>

                                {/* Treaty Center MVP - HIDDEN: Diplomatic negotiation button removed as it duplicates 条约中心 below */}

                                <div className="mt-2 bg-gray-900/30 p-2 rounded border border-gray-700/60">
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="text-[10px] text-gray-300 flex items-center gap-1 font-decorative">
                                            <Icon name="FileText" size={10} className="text-amber-300" />
                                            条约中心
                                        </div>
                                        <div className="text-[9px] text-gray-500 font-body">玩家可主动提出条约</div>
                                    </div>

                                    <div className="flex gap-1.5 text-[10px]">
                                        {(() => {
                                            const treatyCooldown = getDiplomaticCooldown(selectedNation, 'propose_treaty');
                                            const isPeaceActive = selectedNation?.peaceTreatyUntil && daysElapsed < selectedNation.peaceTreatyUntil;
                                            const isOpenMarketActive = selectedNation?.openMarketUntil && daysElapsed < selectedNation.openMarketUntil;

                                            const blocked = selectedNation?.isAtWar || treatyCooldown.isOnCooldown || isPeaceActive;

                                            let titleText = '提出互不侵犯条约（1年）';
                                            if (selectedNation?.isAtWar) titleText = '交战期间无法签署互不侵犯';
                                            else if (treatyCooldown.isOnCooldown) titleText = `冷却中（还需${treatyCooldown.remainingDays}天）`;
                                            else if (isPeaceActive) titleText = '互不侵犯/和平协议已生效中，无法重复提出';

                                            return (
                                                <button
                                                    className={`flex-1 px-2 py-1 rounded text-white flex items-center justify-center gap-1 font-semibold font-body ${blocked ? 'bg-gray-600 cursor-not-allowed' : 'bg-green-700 hover:bg-green-600'}`}
                                                    onClick={() => handleSimpleAction(selectedNation.id, 'propose_treaty', { type: 'non_aggression', durationDays: 365 })}
                                                    disabled={blocked}
                                                    title={titleText}
                                                >
                                                    <Icon name="Shield" size={12} />
                                                    {treatyCooldown.isOnCooldown ? `互不侵(${treatyCooldown.remainingDays}天)` : '互不侵犯'}
                                                </button>
                                            );
                                        })()}

                                        {(() => {
                                            const treatyCooldown = getDiplomaticCooldown(selectedNation, 'propose_treaty');
                                            const isOpenMarketActive = selectedNation?.openMarketUntil && daysElapsed < selectedNation.openMarketUntil;

                                            const blocked = selectedNation?.isAtWar || treatyCooldown.isOnCooldown || isOpenMarketActive;

                                            let titleText = '提出开放市场条约（2年）';
                                            if (selectedNation?.isAtWar) titleText = '交战期间无法签署开放市场';
                                            else if (treatyCooldown.isOnCooldown) titleText = `冷却中（还需${treatyCooldown.remainingDays}天）`;
                                            else if (isOpenMarketActive) titleText = '开放市场协议已生效中，无法重复提出';

                                            return (
                                                <button
                                                    className={`flex-1 px-2 py-1 rounded text-white flex items-center justify-center gap-1 font-semibold font-body ${blocked ? 'bg-gray-600 cursor-not-allowed' : 'bg-blue-700 hover:bg-blue-600'}`}
                                                    onClick={() => handleSimpleAction(selectedNation.id, 'propose_treaty', { type: 'open_market', durationDays: 730 })}
                                                    disabled={blocked}
                                                    title={titleText}
                                                >
                                                    <Icon name="Store" size={12} />
                                                    {treatyCooldown.isOnCooldown ? `市场(${treatyCooldown.remainingDays}天)` : '开放市场'}
                                                </button>
                                            );
                                        })()}
                                    </div>

                                    {/* 第二行条约按钮 */}
                                    <div className="flex gap-1.5 text-[10px] mt-1.5">
                                        {/* 贸易协定 */}
                                        {(() => {
                                            const treatyCooldown = getDiplomaticCooldown(selectedNation, 'propose_treaty');
                                            const isUnlocked = isDiplomacyUnlocked('treaties', 'trade_agreement', epoch);
                                            const hasActive = Array.isArray(selectedNation?.treaties) &&
                                                selectedNation.treaties.some(t => t.type === 'trade_agreement' && (!t.endDay || daysElapsed < t.endDay));
                                            const blocked = !isUnlocked || selectedNation?.isAtWar || treatyCooldown.isOnCooldown || hasActive;

                                            let titleText = '提出贸易协定（关税-25%, 商路+3）';
                                            if (!isUnlocked) titleText = `需要${EPOCHS[2]?.name || '古典时代'}解锁`;
                                            else if (selectedNation?.isAtWar) titleText = '交战期间无法签署';
                                            else if (treatyCooldown.isOnCooldown) titleText = `冷却中（还需${treatyCooldown.remainingDays}天）`;
                                            else if (hasActive) titleText = '贸易协定已生效中';

                                            return (
                                                <button
                                                    className={`flex-1 px-2 py-1 rounded text-white flex items-center justify-center gap-1 font-semibold font-body ${blocked ? 'bg-gray-600 cursor-not-allowed opacity-60' : 'bg-amber-700 hover:bg-amber-600'}`}
                                                    onClick={() => onDiplomaticAction(selectedNation.id, 'propose_treaty', { type: 'trade_agreement', durationDays: getTreatyDuration('trade_agreement', epoch) })}
                                                    disabled={blocked}
                                                    title={titleText}
                                                >
                                                    <Icon name="TrendingUp" size={12} />
                                                    {!isUnlocked ? '🔒贸易' : '贸易协定'}
                                                </button>
                                            );
                                        })()}

                                        {/* 自由贸易协定 */}
                                        {(() => {
                                            const treatyCooldown = getDiplomaticCooldown(selectedNation, 'propose_treaty');
                                            const isUnlocked = isDiplomacyUnlocked('treaties', 'free_trade', epoch);
                                            const hasActive = Array.isArray(selectedNation?.treaties) &&
                                                selectedNation.treaties.some(t => t.type === 'free_trade' && (!t.endDay || daysElapsed < t.endDay));
                                            const blocked = !isUnlocked || selectedNation?.isAtWar || treatyCooldown.isOnCooldown || hasActive;

                                            let titleText = '提出自由贸易协定（关税=0, 商路无限）';
                                            if (!isUnlocked) titleText = `需要${EPOCHS[4]?.name || '探索时代'}解锁`;
                                            else if (selectedNation?.isAtWar) titleText = '交战期间无法签署';
                                            else if (treatyCooldown.isOnCooldown) titleText = `冷却中（还需${treatyCooldown.remainingDays}天）`;
                                            else if (hasActive) titleText = '自由贸易协定已生效中';

                                            return (
                                                <button
                                                    className={`flex-1 px-2 py-1 rounded text-white flex items-center justify-center gap-1 font-semibold font-body ${blocked ? 'bg-gray-600 cursor-not-allowed opacity-60' : 'bg-cyan-700 hover:bg-cyan-600'}`}
                                                    onClick={() => onDiplomaticAction(selectedNation.id, 'propose_treaty', { type: 'free_trade', durationDays: getTreatyDuration('free_trade', epoch) })}
                                                    disabled={blocked}
                                                    title={titleText}
                                                >
                                                    <Icon name="Globe" size={12} />
                                                    {!isUnlocked ? '🔒自贸' : '自由贸易'}
                                                </button>
                                            );
                                        })()}
                                    </div>

                                    {/* 第三行条约按钮 */}
                                    <div className="flex gap-1.5 text-[10px] mt-1.5">
                                        {/* 学术交流 */}
                                        {(() => {
                                            const treatyCooldown = getDiplomaticCooldown(selectedNation, 'propose_treaty');
                                            const isUnlocked = isDiplomacyUnlocked('treaties', 'academic_exchange', epoch);
                                            const hasActive = Array.isArray(selectedNation?.treaties) &&
                                                selectedNation.treaties.some(t => t.type === 'academic_exchange' && (!t.endDay || daysElapsed < t.endDay));
                                            const blocked = !isUnlocked || selectedNation?.isAtWar || treatyCooldown.isOnCooldown || hasActive;

                                            let titleText = '提出学术交流协定（科技+5%）';
                                            if (!isUnlocked) titleText = `需要${EPOCHS[3]?.name || '封建时代'}解锁`;
                                            else if (selectedNation?.isAtWar) titleText = '交战期间无法签署';
                                            else if (treatyCooldown.isOnCooldown) titleText = `冷却中（还需${treatyCooldown.remainingDays}天）`;
                                            else if (hasActive) titleText = '学术交流协定已生效中';

                                            return (
                                                <button
                                                    className={`flex-1 px-2 py-1 rounded text-white flex items-center justify-center gap-1 font-semibold font-body ${blocked ? 'bg-gray-600 cursor-not-allowed opacity-60' : 'bg-purple-700 hover:bg-purple-600'}`}
                                                    onClick={() => onDiplomaticAction(selectedNation.id, 'propose_treaty', { type: 'academic_exchange', durationDays: getTreatyDuration('academic_exchange', epoch) })}
                                                    disabled={blocked}
                                                    title={titleText}
                                                >
                                                    <Icon name="BookOpen" size={12} />
                                                    {!isUnlocked ? '🔒学术' : '学术交流'}
                                                </button>
                                            );
                                        })()}

                                        {/* 共同防御 */}
                                        {(() => {
                                            const treatyCooldown = getDiplomaticCooldown(selectedNation, 'propose_treaty');
                                            const isUnlocked = isDiplomacyUnlocked('treaties', 'defensive_pact', epoch);
                                            const hasActive = Array.isArray(selectedNation?.treaties) &&
                                                selectedNation.treaties.some(t => t.type === 'defensive_pact' && (!t.endDay || daysElapsed < t.endDay));
                                            const blocked = !isUnlocked || selectedNation?.isAtWar || treatyCooldown.isOnCooldown || hasActive;

                                            let titleText = '提出共同防御条约（互相保护）';
                                            if (!isUnlocked) titleText = `需要${EPOCHS[3]?.name || '封建时代'}解锁`;
                                            else if (selectedNation?.isAtWar) titleText = '交战期间无法签署';
                                            else if (treatyCooldown.isOnCooldown) titleText = `冷却中（还需${treatyCooldown.remainingDays}天）`;
                                            else if (hasActive) titleText = '共同防御条约已生效中';

                                            return (
                                                <button
                                                    className={`flex-1 px-2 py-1 rounded text-white flex items-center justify-center gap-1 font-semibold font-body ${blocked ? 'bg-gray-600 cursor-not-allowed opacity-60' : 'bg-red-700 hover:bg-red-600'}`}
                                                    onClick={() => onDiplomaticAction(selectedNation.id, 'propose_treaty', { type: 'defensive_pact', durationDays: getTreatyDuration('defensive_pact', epoch) })}
                                                    disabled={blocked}
                                                    title={titleText}
                                                >
                                                    <Icon name="Shield" size={12} />
                                                    {!isUnlocked ? '🔒防御' : '共同防御'}
                                                </button>
                                            );
                                        })()}

                                        {/* 投资协议 */}
                                        {(() => {
                                            const treatyCooldown = getDiplomaticCooldown(selectedNation, 'propose_treaty');
                                            const isUnlocked = isDiplomacyUnlocked('treaties', 'investment_pact', epoch);
                                            const hasActive = Array.isArray(selectedNation?.treaties) &&
                                                selectedNation.treaties.some(t => t.type === 'investment_pact' && (!t.endDay || daysElapsed < t.endDay));
                                            const blocked = !isUnlocked || selectedNation?.isAtWar || treatyCooldown.isOnCooldown || hasActive;

                                            let titleText = '提出投资协议（解锁海外投资）';
                                            if (!isUnlocked) titleText = `需要${EPOCHS[4]?.name || '探索时代'}解锁`;
                                            else if (selectedNation?.isAtWar) titleText = '交战期间无法签署';
                                            else if (treatyCooldown.isOnCooldown) titleText = `冷却中（还需${treatyCooldown.remainingDays}天）`;
                                            else if (hasActive) titleText = '投资协议已生效中';

                                            return (
                                                <button
                                                    className={`flex-1 px-2 py-1 rounded text-white flex items-center justify-center gap-1 font-semibold font-body ${blocked ? 'bg-gray-600 cursor-not-allowed opacity-60' : 'bg-emerald-700 hover:bg-emerald-600'}`}
                                                    onClick={() => onDiplomaticAction(selectedNation.id, 'propose_treaty', { type: 'investment_pact', durationDays: getTreatyDuration('investment_pact', epoch) })}
                                                    disabled={blocked}
                                                    title={titleText}
                                                >
                                                    <Icon name="Building2" size={12} />
                                                    {!isUnlocked ? '🔒投资' : '投资协议'}
                                                </button>
                                            );
                                        })()}
                                    </div>

                                    {/* 当前条约 */}
                                    {(() => {
                                        const activeTreaties = Array.isArray(selectedNation?.treaties)
                                            ? selectedNation.treaties.filter(t => !Number.isFinite(t.endDay) || daysElapsed < t.endDay)
                                            : [];
                                        if (activeTreaties.length === 0) return null;
                                        return (
                                            <div className="mt-2 text-[10px] text-gray-300 font-body">
                                                <div className="text-[9px] text-gray-500 mb-1 font-decorative flex items-center gap-1">
                                                    <Icon name="FileText" size={10} className="text-amber-300" />
                                                    当前生效条约 ({activeTreaties.length})
                                                </div>
                                                <div className="space-y-1 max-h-24 overflow-y-auto">
                                                    {activeTreaties.map((t) => (
                                                        <div key={t.id || `${t.type}-${t.endDay}`} className="flex items-center justify-between bg-gray-800/40 border border-gray-700/60 rounded px-2 py-1">
                                                            <span className="text-gray-200">
                                                                {getTreatyLabel(t.type)}
                                                            </span>
                                                            <span className="text-gray-400 font-epic text-[9px]">
                                                                {Number.isFinite(t.endDay) ? `剩${Math.max(0, t.endDay - daysElapsed)}天` : '永久'}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                                {/* 条约效果汇总 */}
                                                {(() => {
                                                    const hasTrade = activeTreaties.some(t => ['trade_agreement', 'free_trade', 'open_market'].includes(t.type));
                                                    if (!hasTrade) return null;
                                                    const tariffMult = activeTreaties.reduce((min, t) => {
                                                        if (t.type === 'free_trade') return 0;
                                                        if (t.type === 'trade_agreement') return Math.min(min, 0.75);
                                                        if (t.type === 'open_market') return Math.min(min, 0.80);
                                                        return min;
                                                    }, 1.0);
                                                    const extraSlots = activeTreaties.reduce((sum, t) => {
                                                        if (t.type === 'free_trade') return Infinity;
                                                        if (t.type === 'trade_agreement') return sum + 3;
                                                        if (t.type === 'open_market') return sum + 2;
                                                        return sum;
                                                    }, 0);
                                                    return (
                                                        <div className="mt-1 pt-1 border-t border-gray-700/40 text-[9px] text-green-400 flex gap-2 flex-wrap">
                                                            {tariffMult < 1 && <span>📉 关税{tariffMult === 0 ? '免除' : `-${Math.round((1 - tariffMult) * 100)}%`}</span>}
                                                            {extraSlots > 0 && <span>🚢 商路{extraSlots === Infinity ? '无限' : `+${extraSlots}`}</span>}
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        );
                                    })()}
                                </div>

                                {/* 国际组织面板 */}
                                {(() => {
                                    const organizations = Array.isArray(diplomacyOrganizations?.organizations)
                                        ? diplomacyOrganizations.organizations
                                        : [];
                                    const playerOrgs = organizations.filter(org =>
                                        Array.isArray(org?.members) && org.members.includes('player')
                                    );
                                    const nationOrgs = organizations.filter(org =>
                                        Array.isArray(org?.members) && org.members.includes(selectedNation?.id)
                                    );
                                    const sharedOrgs = playerOrgs.filter(org =>
                                        nationOrgs.some(no => no.id === org.id)
                                    );

                                    const ORG_TYPES = [
                                        { type: 'military_alliance', name: '军事联盟', icon: 'Shield', era: 3, color: 'red' },
                                        { type: 'economic_bloc', name: '经济共同体', icon: 'TrendingUp', era: 5, color: 'amber' },
                                        { type: 'trade_zone', name: '自贸区', icon: 'Globe', era: 5, color: 'cyan' },
                                    ];

                                    return (
                                        <div className="mt-2 bg-gray-900/30 p-2 rounded border border-gray-700/60">
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="text-[10px] text-gray-300 flex items-center gap-1 font-decorative">
                                                    <Icon name="Users" size={10} className="text-purple-300" />
                                                    国际组织
                                                </div>
                                                <div className="text-[9px] text-gray-500 font-body">创建或邀请加入组织</div>
                                            </div>

                                            {/* 共同组织列表 */}
                                            {sharedOrgs.length > 0 && (
                                                <div className="mb-2">
                                                    <div className="text-[9px] text-gray-500 mb-1">共同成员</div>
                                                    <div className="space-y-1">
                                                        {sharedOrgs.map(org => {
                                                            const orgType = ORG_TYPES.find(t => t.type === org.type);
                                                            return (
                                                                <div key={org.id} className="flex items-center justify-between bg-gray-800/40 border border-purple-500/30 rounded px-2 py-1">
                                                                    <span className="text-[10px] text-purple-200 flex items-center gap-1">
                                                                        <Icon name={orgType?.icon || 'Users'} size={10} />
                                                                        {org.name}
                                                                    </span>
                                                                    <span className="text-[9px] text-gray-400">{org.members?.length || 0}成员</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {/* 创建/邀请按钮 */}
                                            <div className="flex gap-1.5 text-[10px] flex-wrap">
                                                {ORG_TYPES.map(orgType => {
                                                    const isUnlocked = isDiplomacyUnlocked('organizations', orgType.type, epoch);
                                                    const playerHasOrg = playerOrgs.some(o => o.type === orgType.type);
                                                    const nationInOrg = nationOrgs.some(o => o.type === orgType.type);
                                                    const playerOrg = playerOrgs.find(o => o.type === orgType.type);
                                                    const nationAlreadyInPlayerOrg = playerOrg && Array.isArray(playerOrg.members) && playerOrg.members.includes(selectedNation?.id);

                                                    const blocked = !isUnlocked || selectedNation?.isAtWar;

                                                    // 决定显示什么按钮
                                                    let buttonText = '';
                                                    let action = '';
                                                    let canClick = !blocked;

                                                    if (!isUnlocked) {
                                                        buttonText = `🔒${orgType.name.substring(0, 2)}`;
                                                        canClick = false;
                                                    } else if (nationAlreadyInPlayerOrg) {
                                                        buttonText = `移除${orgType.name.substring(0, 2)}`;
                                                        action = 'leave_org';
                                                    } else if (playerHasOrg && !nationInOrg) {
                                                        buttonText = `邀请${orgType.name.substring(0, 2)}`;
                                                        action = 'join_org';
                                                    } else if (!playerHasOrg) {
                                                        buttonText = `创建${orgType.name.substring(0, 2)}`;
                                                        action = 'create_org';
                                                    } else {
                                                        buttonText = orgType.name.substring(0, 2);
                                                        canClick = false;
                                                    }

                                                    const colorClasses = {
                                                        red: canClick ? 'bg-red-700 hover:bg-red-600' : 'bg-gray-600',
                                                        amber: canClick ? 'bg-amber-700 hover:bg-amber-600' : 'bg-gray-600',
                                                        cyan: canClick ? 'bg-cyan-700 hover:bg-cyan-600' : 'bg-gray-600',
                                                    };

                                                    return (
                                                        <button
                                                            key={orgType.type}
                                                            className={`flex-1 px-2 py-1 rounded text-white flex items-center justify-center gap-1 font-semibold font-body ${colorClasses[orgType.color]} ${!canClick ? 'cursor-not-allowed opacity-60' : ''}`}
                                                            onClick={() => {
                                                                if (!canClick || !action) return;
                                                                onDiplomaticAction(selectedNation.id, action, {
                                                                    type: orgType.type,
                                                                    orgId: playerOrg?.id,
                                                                });
                                                            }}
                                                            disabled={!canClick}
                                                            title={!isUnlocked
                                                                ? `需要${EPOCHS[orgType.era]?.name || `Era ${orgType.era}`}解锁`
                                                                : blocked
                                                                    ? '交战期间无法操作'
                                                                    : `${buttonText} - ${orgType.name}`
                                                            }
                                                        >
                                                            <Icon name={orgType.icon} size={12} />
                                                            {buttonText}
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            {/* 玩家已加入的组织列表 */}
                                            {playerOrgs.length > 0 && (
                                                <div className="mt-2 pt-2 border-t border-gray-700/40">
                                                    <div className="text-[9px] text-gray-500 mb-1">你的组织</div>
                                                    <div className="space-y-1 max-h-20 overflow-y-auto">
                                                        {playerOrgs.map(org => {
                                                            const orgType = ORG_TYPES.find(t => t.type === org.type);
                                                            const hasNation = Array.isArray(org.members) && org.members.includes(selectedNation?.id);
                                                            return (
                                                                <div key={org.id} className="flex items-center justify-between bg-gray-800/40 border border-gray-700/60 rounded px-2 py-1">
                                                                    <span className="text-[10px] text-gray-200 flex items-center gap-1">
                                                                        <Icon name={orgType?.icon || 'Users'} size={10} className={hasNation ? 'text-green-400' : 'text-gray-400'} />
                                                                        {org.name}
                                                                    </span>
                                                                    <span className="text-[9px] text-gray-400">
                                                                        {hasNation && <span className="text-green-400 mr-1">✓</span>}
                                                                        {org.members?.length || 0}国
                                                                    </span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}

                                <div className="mt-1 text-[10px] text-gray-400 flex items-center justify-between font-epic">
                                    <span className="flex items-center gap-1">
                                        <Icon name="Coins" size={10} className="text-amber-300" />
                                        礼物成本：{calculateDynamicGiftCost(resources.silver || 0, selectedNation?.wealth || 0)} 银币 | 挑拨成本：{calculateProvokeCost(resources.silver || 0, selectedNation?.wealth || 0)} 银币
                                    </span>
                                </div>
                                {selectedPreferences.length > 0 && (
                                    <div className="mt-2">
                                        <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 flex items-center gap-1 font-decorative">
                                            <Icon name="Package" size={10} className="text-amber-300" />
                                            偏好资源
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {selectedPreferences.slice(0, 4).map((pref) => (
                                                <span
                                                    key={pref.key}
                                                    className="px-2 py-0.5 rounded-full bg-gray-900/40 border border-amber-500/30 text-[10px] text-amber-100 flex items-center gap-1 font-body"
                                                    title={`倾向度 x${pref.bias.toFixed(1)}`}
                                                >
                                                    <Icon name={pref.icon} size={10} className={pref.color || 'text-amber-200'} />
                                                    <span className="font-body">{pref.name}</span>
                                                    <span className="text-amber-300 font-mono text-[9px] font-epic">x{pref.bias.toFixed(1)}</span>
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* 特殊能力 */}
                                {selectedNation?.specialAbilities && selectedNation.specialAbilities.length > 0 && (
                                    <div className="mt-2">
                                        <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 flex items-center gap-1 font-decorative">
                                            <Icon name="Sparkles" size={10} className="text-purple-300" />
                                            国家特色
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {selectedNation.specialAbilities.map((ability, idx) => (
                                                <span
                                                    key={idx}
                                                    className="px-2 py-0.5 rounded-full bg-purple-900/30 border border-purple-500/30 text-[10px] text-purple-200 flex items-center gap-1 font-body"
                                                    title={ability.desc}
                                                >
                                                    <Icon name="Zap" size={10} className="text-purple-300" />
                                                    <span className="font-body">{ability.desc}</span>
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* 文化特性 */}
                                {/*selectedNation?.culturalTraits && Object.keys(selectedNation.culturalTraits).length > 0 && (
                  <div className="mt-2">
                    <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 flex items-center gap-1">
                      <Icon name="Landmark" size={10} className="text-cyan-300" />
                      文化特性
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(selectedNation.culturalTraits).map(([trait, value]) => {
                        const fallbackName = trait.replace(/([A-Z])/g, ' $1').trim();
                        const normalizedName = fallbackName
                          ? fallbackName.charAt(0).toUpperCase() + fallbackName.slice(1)
                          : trait;
                        const traitLabel = CULTURAL_TRAIT_LABELS[trait] || normalizedName;
                        const traitValueLabel = formatCulturalTraitValue(trait, value);

                        return (
                          <span
                            key={trait}
                            className="px-2 py-0.5 rounded-full bg-cyan-900/30 border border-cyan-500/30 text-[10px] text-cyan-200"
                            title={`${traitLabel}${traitValueLabel}`}
                          >
                            {traitLabel}
                            {traitValueLabel}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )*/}
                            </div>

                            <div className="bg-gray-800/60 p-2 rounded-lg border border-gray-700">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-xs font-bold text-white flex items-center gap-1 font-decorative">
                                        <Icon name="BarChart2" size={12} className="text-blue-300" />
                                        国外市场
                                    </h3>
                                    <button
                                        onClick={() => setShowTradeRoutesModal(true)}
                                        className="px-3 py-1 rounded bg-amber-600/80 hover:bg-amber-500 text-white text-xs font-body"
                                    >
                                        派驻商人
                                    </button>
                                </div>

                                <div className="space-y-1">
                                    {tradableResources.map(([key, res]) => {
                                        if (!selectedNation) return null;

                                        const local = getLocalPrice(key);
                                        const foreign = calculateForeignPrice(key, selectedNation, daysElapsed);
                                        const diff = foreign - local;
                                        const tradeStatus = calculateTradeStatus(key, selectedNation, daysElapsed) || {};

                                        const rawShortage = Math.floor(tradeStatus.shortageAmount || 0);
                                        const rawSurplus = Math.floor(tradeStatus.surplusAmount || 0);
                                        const shortageCapacity = rawShortage > 9999 ? '9999+' : rawShortage;
                                        const surplusCapacity = rawSurplus > 9999 ? '9999+' : rawSurplus;

                                        const isUnlocked = (res.unlockEpoch ?? 0) <= epoch;
                                        if (!isUnlocked) return null;

                                        return (
                                            <div key={key} className="bg-gray-900/40 rounded p-1.5 border border-gray-700/50">
                                                <div className="flex items-center justify-between mb-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <Icon name={res.icon || 'Box'} size={12} className={res.color || 'text-gray-400'} />
                                                        <span className="text-xs font-semibold text-white font-body">{res.name}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1 text-[10px] font-epic">
                                                        {tradeStatus.isShortage && (
                                                            <span className="text-red-400 font-mono">缺{shortageCapacity}</span>
                                                        )}
                                                        {tradeStatus.isSurplus && (
                                                            <span className="text-green-400 font-mono">余{surplusCapacity}</span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between text-[10px]">
                                                    <div className="flex gap-2 text-gray-400 font-body">
                                                        <span>本地: <span className="text-white font-mono font-epic">{local.toFixed(1)}</span></span>
                                                        <span>外国: <span className={`font-mono font-epic ${diff > 0 ? 'text-green-300' : 'text-red-300'}`}>{foreign.toFixed(1)}</span></span>
                                                    </div>

                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {selectedNation.peaceTreatyUntil && daysElapsed < selectedNation.peaceTreatyUntil && (
                                <div className="bg-green-900/20 p-2 rounded-lg border border-green-600/30 mb-2">
                                    <h3 className="text-xs font-bold text-white flex items-center gap-1 mb-1.5 font-decorative">
                                        <Icon name="HandHeart" size={12} className="text-green-300" />
                                        和平协议
                                    </h3>
                                    <p className="text-[10px] text-gray-300 font-body">
                                        剩余天数: <span className="text-green-300 font-semibold font-epic">{selectedNation.peaceTreatyUntil - daysElapsed}</span>
                                    </p>
                                    {selectedNation.installmentPayment && (
                                        <p className="text-[10px] text-gray-300 mt-1 font-body">
                                            分期支付: 每天 <span className="text-yellow-300 font-semibold font-epic">{selectedNation.installmentPayment.amount}</span> 银币
                                            （剩余 <span className="text-white font-semibold font-epic">{selectedNation.installmentPayment.remainingDays}</span> 天）
                                        </p>
                                    )}
                                </div>
                            )}

                            {selectedNation.isAtWar && (
                                <div className="bg-red-900/20 p-2 rounded-lg border border-red-600/30">
                                    <h3 className="text-xs font-bold text-white flex items-center gap-1 mb-1.5 font-decorative">
                                        <Icon name="AlertTriangle" size={12} className="text-red-300" />
                                        战争状态
                                    </h3>
                                    <div className="flex items-center justify-between text-[10px] mb-1.5 font-body">
                                        <div className="flex gap-2 text-gray-300 font-body">
                                            <span>分数: <span className="text-red-300 font-semibold font-epic">{selectedNation.warScore?.toFixed(0) || 0}</span></span>
                                            <span>天数: <span className="text-white font-semibold font-epic">{selectedNation.warDuration || 0}</span></span>
                                            <span>损失: <span className="text-white font-semibold font-epic">{selectedNation.enemyLosses || 0}</span></span>
                                            <span>实力: <span className={`font-semibold font-epic ${(selectedNation.militaryStrength ?? 1.0) > 0.7 ? 'text-green-300' : (selectedNation.militaryStrength ?? 1.0) > 0.4 ? 'text-yellow-300' : 'text-red-300'}`}>{Math.floor((selectedNation.militaryStrength ?? 1.0) * 100)}%</span></span>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-gray-400 mb-1.5 font-body">{renderPeaceHint(selectedNation)}</p>
                                    <button
                                        className="w-full px-2 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded text-xs font-semibold font-body"
                                        onClick={() => handleSimpleAction(selectedNation.id, 'peace')}
                                    >
                                        提出和平协议
                                    </button>
                                </div>
                            )}

                            {playerInstallmentPayment && playerInstallmentPayment.nationId === selectedNation.id && (
                                <div className="bg-yellow-900/20 p-2 rounded-lg border border-yellow-600/30 mt-2">
                                    <h3 className="text-xs font-bold text-white flex items-center gap-1 mb-1.5 font-decorative">
                                        <Icon name="Coins" size={12} className="text-yellow-300" />
                                        你的分期支付
                                    </h3>
                                    <p className="text-[10px] text-gray-300 font-body">
                                        每天支付: <span className="text-yellow-300 font-semibold font-epic">{playerInstallmentPayment.amount}</span> 银币
                                    </p>
                                    <p className="text-[10px] text-gray-300 mt-1 font-body">
                                        剩余天数: <span className="text-white font-semibold font-epic">{playerInstallmentPayment.remainingDays}</span>
                                    </p>
                                    <p className="text-[10px] text-gray-300 mt-1 font-body">
                                        已支付: <span className="text-green-300 font-semibold font-epic">{playerInstallmentPayment.paidAmount}</span> /
                                        <span className="text-white font-semibold font-epic"> {playerInstallmentPayment.totalAmount}</span> 银币
                                    </p>
                                </div>
                            )}
                        </React.Fragment>
                    ) : (
                        <div className="glass-ancient p-4 rounded-xl border border-ancient-gold/30 text-sm text-gray-400 font-body">
                            请选择一个国家以查看贸易与谈判选项。
                        </div>
                    )}
                </div>
            </div>

            {/* Provoke Target Selection Modal */}
            <Modal
                isOpen={showProvokeModal}
                onClose={() => {
                    setShowProvokeModal(false);
                    setProvokeTargetId(null);
                }}
                title={`挑拨 ${selectedNation?.name || ''} 的关系`}
                footer={
                    <div className="flex gap-2 justify-end">
                        <button
                            className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded text-white text-sm font-body"
                            onClick={() => {
                                setShowProvokeModal(false);
                                setProvokeTargetId(null);
                            }}
                        >
                            取消
                        </button>
                        <button
                            className={`px-3 py-1.5 rounded text-white text-sm font-body ${provokeTargetId
                                ? 'bg-indigo-600 hover:bg-indigo-500'
                                : 'bg-gray-500 cursor-not-allowed'
                                }`}
                            onClick={handleProvokeWithTarget}
                            disabled={!provokeTargetId}
                        >
                            确认挑拨 ({calculateProvokeCost(resources.silver || 0, selectedNation?.wealth || 0)}银币)
                        </button>
                    </div>
                }
            >
                <div className="space-y-2">
                    <p className="text-sm text-gray-300 font-body mb-3">
                        选择要离间的目标国家。挑拨成功后，{selectedNation?.name} 与目标国家的关系将会恶化。
                    </p>
                    <div className="max-h-[50vh] overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-gray-600">
                        {provokeTargetNations.map(nation => {
                            const nationRelation = relationInfo(nation.relation || 0, nation.alliedWithPlayer === true);
                            const foreignRelation = selectedNation?.foreignRelations?.[nation.id] ?? 50;
                            // Check if these two AI nations are formally allied
                            const areAllied = (selectedNation?.allies || []).includes(nation.id) ||
                                (nation.allies || []).includes(selectedNation?.id);
                            const foreignRelationInfo = (() => {
                                if (areAllied) return { label: '盟友', color: 'text-green-300' };
                                if (foreignRelation >= 80) return { label: '亲密', color: 'text-emerald-300' };
                                if (foreignRelation >= 60) return { label: '友好', color: 'text-blue-300' };
                                if (foreignRelation >= 40) return { label: '中立', color: 'text-gray-300' };
                                if (foreignRelation >= 20) return { label: '冷淡', color: 'text-yellow-300' };
                                return { label: '敌对', color: 'text-red-300' };
                            })();

                            return (
                                <button
                                    key={nation.id}
                                    onClick={() => setProvokeTargetId(nation.id)}
                                    className={`w-full flex items-center justify-between p-2 rounded border transition-colors ${provokeTargetId === nation.id
                                        ? 'bg-indigo-900/50 border-indigo-500'
                                        : 'bg-gray-800/60 border-gray-700 hover:bg-gray-700/60'
                                        }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <Icon name="Flag" size={14} className={nation.color || 'text-gray-300'} />
                                        <span className="text-sm text-white font-body">{nation.name}</span>
                                        <span className={`text-[10px] px-1 py-0.5 rounded ${nationRelation.bg} ${nationRelation.color}`}>
                                            与你:{nationRelation.label}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1 text-[10px]">
                                        <span className="text-gray-400">两国关系:</span>
                                        <span className={foreignRelationInfo.color}>{foreignRelationInfo.label}</span>
                                        <span className="text-gray-500">({Math.round(foreignRelation)})</span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                    {provokeTargetNations.length === 0 && (
                        <p className="text-sm text-gray-400 text-center py-4 font-body">
                            没有其他可选择的国家
                        </p>
                    )}
                </div>
            </Modal>

            {/* 外交谈判模态框 */}
            <Modal
                isOpen={showNegotiationModal}
                onClose={closeNegotiationModal}
                title={`与 ${selectedNation?.name || ''} 外交谈判`}
                footer={(() => {
                    const treatyUnlocked = isDiplomacyUnlocked('treaties', negotiationDraft.type, epoch);
                    const canSubmit = !!selectedNation && negotiationUnlocked && treatyUnlocked && !selectedNation?.isAtWar;
                    if (negotiationCounter) {
                        return (
                            <div className="flex gap-2 justify-end">
                                <button
                                    className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded text-white text-sm font-body"
                                    onClick={closeNegotiationModal}
                                >
                                    取消
                                </button>
                                <button
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded text-white text-sm font-body"
                                    onClick={() => submitNegotiation({ ...negotiationCounter, stance: negotiationDraft.stance }, { forceAccept: true, round: negotiationRound })}
                                    disabled={!canSubmit}
                                >
                                    接受反提案
                                </button>
                                <button
                                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 rounded text-white text-sm font-body"
                                    onClick={() => submitNegotiation(negotiationDraft, { round: negotiationRound })}
                                    disabled={!canSubmit}
                                >
                                    再次提案
                                </button>
                            </div>
                        );
                    }
                    return (
                        <div className="flex gap-2 justify-end">
                            <button
                                className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded text-white text-sm font-body"
                                onClick={closeNegotiationModal}
                            >
                                取消
                            </button>
                            <button
                                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 rounded text-white text-sm font-body"
                                onClick={() => submitNegotiation(negotiationDraft, { round: negotiationRound })}
                                disabled={!canSubmit}
                            >
                                发起谈判
                            </button>
                        </div>
                    );
                })()}
            >
                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-600">
                    {/* 谈判状态栏 */}
                    <div className="flex items-center justify-between text-xs text-gray-300 font-body">
                        <span>第 {negotiationRound}/{NEGOTIATION_MAX_ROUNDS} 轮</span>
                        <span>预估接受率: <span className="text-amber-300 font-semibold font-epic">{Math.round((negotiationEvaluation.acceptChance || 0) * 100)}%</span></span>
                    </div>
                    {negotiationEvaluation.relationGate && (
                        <div className="text-[11px] text-orange-300 font-body">⚠️ 关系过低会大幅降低接受率</div>
                    )}

                    {/* 对方反提案 */}
                    {negotiationCounter && (
                        <div className="p-2 rounded-lg bg-amber-900/30 border border-amber-600/50">
                            <div className="text-xs text-amber-200 font-decorative mb-2 flex items-center gap-1">
                                <Icon name="MessageSquare" size={12} />
                                对方反提案
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-200 font-body">
                                <div>期限: <span className="text-white font-epic">{negotiationCounter.durationDays}</span> 天</div>
                                <div>维护费: <span className="text-white font-epic">{negotiationCounter.maintenancePerDay || 0}</span>/天</div>
                                <div>签约金: <span className="text-amber-300 font-epic">{negotiationCounter.signingGift || 0}</span> 银币</div>
                                <div>资源: {negotiationCounter.resourceKey ? <span className="text-cyan-300 font-epic">{RESOURCES[negotiationCounter.resourceKey]?.name || negotiationCounter.resourceKey} ×{negotiationCounter.resourceAmount || 0}</span> : <span className="text-gray-500">无</span>}</div>
                            </div>
                        </div>
                    )}

                    {/* 条约类型选择 */}
                    <div className="space-y-2">
                        <label className="text-xs text-gray-400 font-decorative flex items-center gap-1">
                            <Icon name="FileText" size={12} className="text-amber-300" />
                            条约类型
                        </label>
                        <select
                            className="w-full bg-gray-900/60 border border-gray-700 rounded px-2 py-1.5 text-sm text-white font-body"
                            value={negotiationDraft.type}
                            onChange={(e) => {
                                const nextType = e.target.value;
                                setNegotiationDraft((prev) => ({ ...prev, type: nextType, durationDays: getTreatyDuration(nextType, epoch) }));
                            }}
                        >
                            {NEGOTIABLE_TREATY_TYPES.map((type) => {
                                const locked = !isDiplomacyUnlocked('treaties', type, epoch);
                                const label = getTreatyLabel(type);
                                return (
                                    <option key={type} value={type} disabled={locked}>
                                        {locked ? `🔒 ${label} (需要${getTreatyUnlockEraName(type)})` : label}
                                    </option>
                                );
                            })}
                        </select>
                    </div>

                    {/* 条约内容 */}
                    <div className="p-2 rounded-lg bg-gray-800/40 border border-gray-700/60">
                        <div className="text-xs text-gray-400 font-decorative mb-2 flex items-center gap-1">
                            <Icon name="Settings" size={12} className="text-blue-300" />
                            条约内容
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <label className="text-[10px] text-gray-500 font-body">期限（天）</label>
                                <input
                                    type="number"
                                    min="30"
                                    className="w-full bg-gray-900/60 border border-gray-700 rounded px-2 py-1 text-sm text-white font-body"
                                    value={negotiationDraft.durationDays}
                                    onChange={(e) => setNegotiationDraft((prev) => ({ ...prev, durationDays: Number(e.target.value) }))}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-gray-500 font-body">每日维护费</label>
                                <input
                                    type="number"
                                    min="0"
                                    className="w-full bg-gray-900/60 border border-gray-700 rounded px-2 py-1 text-sm text-white font-body"
                                    value={negotiationDraft.maintenancePerDay}
                                    onChange={(e) => setNegotiationDraft((prev) => ({ ...prev, maintenancePerDay: Number(e.target.value) }))}
                                />
                            </div>
                        </div>
                    </div>

                    {/* 我方筹码 */}
                    <div className="p-2 rounded-lg bg-green-900/20 border border-green-700/40">
                        <div className="text-xs text-green-300 font-decorative mb-2 flex items-center gap-1">
                            <Icon name="Gift" size={12} />
                            我方筹码
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <label className="text-[10px] text-gray-500 font-body">签约赠金（银币）</label>
                                <input
                                    type="number"
                                    min="0"
                                    className="w-full bg-gray-900/60 border border-gray-700 rounded px-2 py-1 text-sm text-white font-body"
                                    value={negotiationDraft.signingGift}
                                    onChange={(e) => setNegotiationDraft((prev) => ({ ...prev, signingGift: Number(e.target.value) }))}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-gray-500 font-body">赠送资源</label>
                                <div className="flex gap-1">
                                    <select
                                        className="flex-1 bg-gray-900/60 border border-gray-700 rounded px-2 py-1 text-sm text-white font-body"
                                        value={negotiationDraft.resourceKey}
                                        onChange={(e) => setNegotiationDraft((prev) => ({ ...prev, resourceKey: e.target.value }))}
                                    >
                                        <option value="">无</option>
                                        {tradableResources.map(([key, res]) => (
                                            <option key={key} value={key}>{res.name}</option>
                                        ))}
                                    </select>
                                    <input
                                        type="number"
                                        min="0"
                                        className="w-16 bg-gray-900/60 border border-gray-700 rounded px-2 py-1 text-sm text-white font-body"
                                        value={negotiationDraft.resourceAmount}
                                        onChange={(e) => setNegotiationDraft((prev) => ({ ...prev, resourceAmount: Number(e.target.value) }))}
                                        placeholder="数量"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 谈判姿态 */}
                    <div className="space-y-1">
                        <label className="text-xs text-gray-400 font-decorative flex items-center gap-1">
                            <Icon name="Users" size={12} className="text-purple-300" />
                            谈判姿态
                        </label>
                        <div className="flex gap-2">
                            {[
                                { key: 'normal', label: '中立', color: 'gray', desc: '普通谈判' },
                                { key: 'friendly', label: '友好', color: 'green', desc: '关系+5' },
                                { key: 'threat', label: '威胁', color: 'red', desc: '关系-20' }
                            ].map(({ key, label, color, desc }) => (
                                <button
                                    key={key}
                                    className={`flex-1 px-2 py-1.5 rounded text-xs font-body border flex flex-col items-center ${negotiationDraft.stance === key
                                        ? `border-amber-400 bg-amber-700/40 text-white`
                                        : `border-gray-600 bg-gray-800/60 text-gray-300 hover:bg-gray-700/60`
                                        }`}
                                    onClick={() => setNegotiationDraft((prev) => ({ ...prev, stance: key }))}
                                    type="button"
                                >
                                    <span className="font-semibold">{label}</span>
                                    <span className={`text-[9px] ${key === 'friendly' ? 'text-green-400' : key === 'threat' ? 'text-red-400' : 'text-gray-500'}`}>{desc}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Declare War Modal */}
            {
                showDeclareWarModal && selectedNation && (
                    <DeclareWarModal
                        targetNation={selectedNation}
                        allies={targetNationAllies}
                        onConfirm={() => {
                            handleSimpleAction(selectedNation.id, 'declare_war');
                            setShowDeclareWarModal(false);
                        }}
                        onCancel={() => setShowDeclareWarModal(false)}
                    />
                )
            }

            {
                showTradeRoutesModal && (
                    <TradeRoutesModal
                        tradeRoutes={tradeRoutes}
                        nations={visibleNations}
                        resources={resources}
                        market={market}
                        taxPolicies={taxPolicies}
                        daysElapsed={daysElapsed}
                        epoch={epoch}
                        merchantCount={merchantCount}
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
                            // Legacy trade-route create (when merchants not unlocked) + new mode payload
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
                )
            }

            <BottomSheet
                isOpen={showNationModal}
                onClose={() => setShowNationModal(false)}
                title={`${selectedNation?.name || '外交'} 互动`}
                wrapperClassName="z-40"
                showHeader={false}
            >
                <div className="p-0">
                    {selectedNation ? (
                        <div className="space-y-4">
                            {/* --- HEADER --- */}
                            <div className="p-3 glass-ancient border border-ancient-gold/30 rounded-xl shadow-metal-md">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-3">
                                        <Icon name="Flag" size={24} className={selectedNation.color || 'text-gray-300'} />
                                        <h3 className="text-xl text-white font-decorative">{selectedNation?.name || '未知国家'}</h3>
                                    </div>
                                    <Icon
                                        name={selectedNation.isAtWar ? 'Swords' : 'ShieldCheck'}
                                        size={20}
                                        className={selectedNation.isAtWar ? 'text-red-400' : 'text-green-400'}
                                    />
                                </div>
                                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                                    {selectedNation?.type && (
                                        <span className="px-2 py-1 rounded-full bg-indigo-900/60 text-indigo-200 border border-indigo-500/50 font-epic">
                                            {selectedNation.type}
                                        </span>
                                    )}
                                    {selectedRelation && (
                                        <span className={`px-2 py-1 rounded-full ${selectedRelation.bg} ${selectedRelation.color} font-epic`}>
                                            {selectedRelation.label}
                                        </span>
                                    )}
                                    {selectedNation.isRebelNation && (
                                        <span className="px-2 py-1 rounded-full bg-red-900 text-red-100 font-epic">
                                            叛乱
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* --- TABS --- */}
                            <div className="px-3">
                                <div className="flex items-center gap-1 text-sm rounded-lg glass-ancient border border-ancient-gold/30 p-1 shadow-metal-sm flex-wrap">
                                    <button
                                        className={`flex-1 min-w-[60px] py-2 rounded-lg border-2 transition-all ${sheetSection === 'diplomacy'
                                            ? 'bg-ancient-gold/20 border-ancient-gold/70 text-ancient-parchment shadow-gold-metal'
                                            : 'border-transparent text-ancient-stone hover:text-ancient-parchment'}`}
                                        onClick={() => setSheetSection('diplomacy')}
                                    >
                                        <span className="flex items-center justify-center gap-1 font-bold text-xs">
                                            <Icon name="Handshake" size={12} />
                                            外交
                                        </span>
                                    </button>
                                    <button
                                        className={`flex-1 min-w-[60px] py-2 rounded-lg border-2 transition-all ${sheetSection === 'trade'
                                            ? 'bg-blue-900/50 border-ancient-gold/50 text-blue-100 shadow-metal-sm'
                                            : 'border-transparent text-ancient-stone hover:text-ancient-parchment'}`}
                                        onClick={() => setSheetSection('trade')}
                                    >
                                        <span className="flex items-center justify-center gap-1 font-bold text-xs">
                                            <Icon name="Coins" size={12} />
                                            贸易
                                        </span>
                                    </button>
                                </div>
                            </div>

                            <div className="px-3 pb-3 space-y-4">
                                {/* --- STATS --- */}
                                <div className="grid grid-cols-3 gap-2 text-xs">
                                    <div className="p-2 rounded-lg border border-ancient-gold/30 bg-blue-900/20 text-center shadow-metal-sm">
                                        <div className="flex items-center justify-center gap-1 text-blue-200/80 uppercase tracking-wide text-[10px] font-bold">
                                            <Icon name="Users" size={12} />
                                            人口
                                        </div>
                                        <div className="mt-1 font-mono text-blue-100 font-semibold text-lg font-epic">
                                            {formatStatValue(selectedNation?.population, '')}
                                        </div>
                                    </div>
                                    <div className="p-2 rounded-lg border border-ancient-gold/30 bg-amber-900/20 text-center shadow-metal-sm">
                                        <div className="flex items-center justify-center gap-1 text-amber-200/80 uppercase tracking-wide text-[10px] font-bold">
                                            <Icon name="Coins" size={12} />
                                            财富
                                        </div>
                                        <div className="mt-1 font-mono text-amber-100 font-semibold text-lg font-epic">
                                            {formatStatValue(selectedNation?.wealth, '')}
                                        </div>
                                    </div>
                                    {(() => {
                                        const strengthEstimate = getEstimatedMilitaryStrength(selectedNation, epoch, daysElapsed);
                                        return (
                                            <div className="p-2 rounded-lg border border-ancient-gold/30 bg-red-900/20 text-center shadow-metal-sm">
                                                <div className="flex items-center justify-center gap-1 text-red-200/80 uppercase tracking-wide text-[10px] font-bold">
                                                    <Icon name="Swords" size={12} />
                                                    军事
                                                </div>
                                                <div className={`mt-1 font-mono font-semibold text-base font-epic ${strengthEstimate.colorClass}`}>
                                                    {strengthEstimate.label}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>

                                {sheetSection === 'diplomacy' && (
                                    <div className="space-y-4">
                                        {selectedNation?.desc && (
                                            <div className="p-2 glass-ancient rounded-lg border border-ancient-gold/20 shadow-metal-sm">
                                                <p className="text-xs text-gray-300 leading-relaxed font-body">
                                                    <Icon name="BookOpen" size={12} className="inline mr-1.5 text-amber-300" />
                                                    {selectedNation.desc}
                                                </p>
                                            </div>
                                        )}

                                        {/* 附庸状态显示 - 移动端 */}
                                        {selectedNation?.vassalOf === 'player' && (
                                            <div className="p-3 glass-ancient rounded-lg border border-purple-500/30 shadow-metal-sm">
                                                <div className="flex items-center justify-between mb-2">
                                                    <h4 className="text-base font-bold text-purple-200 font-decorative flex items-center gap-2">
                                                        <Icon name="Crown" size={14} className="text-purple-300" />
                                                        {VASSAL_TYPE_LABELS[selectedNation.vassalType] || '附庸国'}
                                                    </h4>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            className="px-2 py-1 text-xs rounded bg-blue-600 hover:bg-blue-500 text-white font-body"
                                                            onClick={() => {
                                                                setVassalPolicyTarget(selectedNation);
                                                                setShowVassalPolicyModal(true);
                                                            }}
                                                        >
                                                            调整政策
                                                        </button>
                                                        <button
                                                            className="px-2 py-1 text-xs rounded bg-purple-600 hover:bg-purple-500 text-white font-body"
                                                            onClick={() => onDiplomaticAction(selectedNation.id, 'release_vassal')}
                                                        >
                                                            释放
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                    <div className="p-2 rounded bg-purple-900/20 border border-purple-700/30">
                                                        <div className="text-gray-400 mb-1">自主度</div>
                                                        <div className="text-lg font-bold text-purple-200 font-epic">{Math.round(selectedNation.autonomy || 0)}%</div>
                                                    </div>
                                                    <div className="p-2 rounded bg-amber-900/20 border border-amber-700/30">
                                                        <div className="text-gray-400 mb-1">朝贡率</div>
                                                        <div className="text-lg font-bold text-amber-200 font-epic">{Math.round((selectedNation.tributeRate || 0) * 100)}%</div>
                                                    </div>
                                                    <div className="p-2 rounded bg-red-900/20 border border-red-700/30">
                                                        <div className="text-gray-400 mb-1">独立倾向</div>
                                                        <div className={`text-lg font-bold font-epic ${(selectedNation.independencePressure || 0) > 60 ? 'text-red-300' : 'text-gray-200'}`}>
                                                            {Math.round(selectedNation.independencePressure || 0)}%
                                                        </div>
                                                    </div>
                                                    <div className="p-2 rounded bg-green-900/20 border border-green-700/30">
                                                        <div className="text-gray-400 mb-1">预计朝贡</div>
                                                        <div className="text-lg font-bold text-green-200 font-epic">
                                                            {formatNumberShortCN(calculateEnhancedTribute(selectedNation, resources.silver || 10000).silver)}银/月
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="p-3 glass-ancient rounded-lg border border-ancient-gold/20 shadow-metal-sm">
                                            <h4 className="text-base font-bold text-ancient-parchment font-decorative flex items-center gap-2 mb-3">
                                                <Icon name="Sparkles" size={14} className="text-amber-300" />
                                                外交行动
                                            </h4>
                                            <div className="grid grid-cols-3 gap-2 text-sm">
                                                {(() => {
                                                    const giftCooldown = getDiplomaticCooldown(selectedNation, 'gift');
                                                    return (
                                                        <button
                                                            className={`p-3 rounded-lg text-white flex flex-col items-center justify-center gap-1 font-semibold border border-white/10 shadow-metal-sm ${giftCooldown.isOnCooldown ? 'bg-gray-600/80 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500'}`}
                                                            onClick={() => handleSimpleAction(selectedNation.id, 'gift')}
                                                            disabled={giftCooldown.isOnCooldown}
                                                            title={giftCooldown.isOnCooldown ? `冷却中 (${giftCooldown.remainingDays}天)` : '赠送礼物'}
                                                        >
                                                            <Icon name="Gift" size={14} />
                                                            <span>{giftCooldown.isOnCooldown ? `${giftCooldown.remainingDays}天` : '礼物'}</span>
                                                        </button>
                                                    );
                                                })()}
                                                {(() => {
                                                    const demandCooldown = getDiplomaticCooldown(selectedNation, 'demand');
                                                    return (
                                                        <button
                                                            className={`p-3 rounded-lg text-white flex flex-col items-center justify-center gap-1 font-semibold border border-white/10 shadow-metal-sm ${demandCooldown.isOnCooldown ? 'bg-gray-600/80 cursor-not-allowed' : 'bg-yellow-600 hover:bg-yellow-500'}`}
                                                            onClick={() => handleSimpleAction(selectedNation.id, 'demand')}
                                                            disabled={demandCooldown.isOnCooldown}
                                                            title={demandCooldown.isOnCooldown ? `冷却中 (${demandCooldown.remainingDays}天)` : '索要贡品'}
                                                        >
                                                            <Icon name="ShieldAlert" size={14} />
                                                            <span>{demandCooldown.isOnCooldown ? `${demandCooldown.remainingDays}天` : '索要'}</span>
                                                        </button>
                                                    );
                                                })()}
                                                <button
                                                    className={`p-3 rounded-lg text-white flex flex-col items-center justify-center gap-1 font-semibold border border-white/10 shadow-metal-sm ${selectedNation.isAtWar ? 'bg-purple-600 hover:bg-purple-500' : 'bg-red-600 hover:bg-red-500'}`}
                                                    onClick={() => selectedNation.isAtWar ? handleSimpleAction(selectedNation.id, 'peace') : setShowDeclareWarModal(true)}
                                                >
                                                    <Icon name={selectedNation.isAtWar ? 'Flag' : 'Swords'} size={14} />
                                                    <span>{selectedNation.isAtWar ? '求和' : '宣战'}</span>
                                                </button>
                                            </div>

                                            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                                                {(() => {
                                                    const provokeCooldown = getDiplomaticCooldown(selectedNation, 'provoke');
                                                    return (
                                                        <button
                                                            className={`p-3 rounded-lg text-white flex flex-col items-center justify-center gap-1 font-semibold border border-white/10 shadow-metal-sm ${provokeCooldown.isOnCooldown ? 'bg-gray-600/80 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500'}`}
                                                            onClick={() => { setProvokeTargetId(null); setShowProvokeModal(true); }}
                                                            disabled={provokeCooldown.isOnCooldown}
                                                            title={provokeCooldown.isOnCooldown ? `冷却中 (${provokeCooldown.remainingDays}天)` : '挑拨关系'}
                                                        >
                                                            <Icon name="MessageSquareWarning" size={14} />
                                                            <span>{provokeCooldown.isOnCooldown ? `挑拨(${provokeCooldown.remainingDays}天)` : '挑拨'}</span>
                                                        </button>
                                                    );
                                                })()}
                                                {selectedNation?.alliedWithPlayer === true ? (
                                                    <button
                                                        className="p-3 bg-red-700 hover:bg-red-600 rounded-lg text-white flex flex-col items-center justify-center gap-1 font-semibold border border-white/10 shadow-metal-sm"
                                                        onClick={() => handleSimpleAction(selectedNation.id, 'break_alliance')}
                                                        title="解除同盟"
                                                    >
                                                        <Icon name="UserMinus" size={14} />
                                                        <span>解盟</span>
                                                    </button>
                                                ) : (() => {
                                                    const allianceCooldown = getDiplomaticCooldown(selectedNation, 'propose_alliance');
                                                    const relationOk = (selectedNation?.relation || 0) >= 60;
                                                    const notAtWar = !selectedNation?.isAtWar;
                                                    const canPropose = relationOk && notAtWar && !allianceCooldown.isOnCooldown;

                                                    let titleText = '请求结盟';
                                                    if (allianceCooldown.isOnCooldown) titleText = `冷却中 (${allianceCooldown.remainingDays}天)`;
                                                    else if (!relationOk) titleText = `关系需达到60 (当前 ${Math.round(selectedNation?.relation || 0)})`;
                                                    else if (!notAtWar) titleText = '无法与交战国结盟';

                                                    return (
                                                        <button
                                                            className={`p-3 rounded-lg text-white flex flex-col items-center justify-center gap-1 font-semibold border border-white/10 shadow-metal-sm ${canPropose ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-gray-600/80 cursor-not-allowed'}`}
                                                            onClick={() => handleSimpleAction(selectedNation.id, 'propose_alliance')}
                                                            disabled={!canPropose}
                                                            title={titleText}
                                                        >
                                                            <Icon name="Users" size={14} />
                                                            <span>{allianceCooldown.isOnCooldown ? `结盟(${allianceCooldown.remainingDays}天)` : '结盟'}</span>
                                                        </button>
                                                    );
                                                })()}
                                            </div>

                                            {/* Mobile Treaty Center - Enabled */}
                                            <div className="mt-3 p-3 bg-gray-900/30 rounded-lg border border-ancient-gold/20 shadow-metal-sm">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="text-sm font-bold text-ancient-parchment font-decorative flex items-center gap-2">
                                                        <Icon name="FileText" size={14} className="text-amber-300" />
                                                        条约中心
                                                    </div>
                                                    <div className="text-[10px] text-gray-500 font-body">玩家可主动提出条约</div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-2 text-sm">
                                                    {/* 互不侵犯条约 */}
                                                    {(() => {
                                                        const treatyCooldown = getDiplomaticCooldown(selectedNation, 'propose_treaty');
                                                        const isPeaceActive = selectedNation?.peaceTreatyUntil && daysElapsed < selectedNation.peaceTreatyUntil;
                                                        const blocked = selectedNation?.isAtWar || treatyCooldown.isOnCooldown || isPeaceActive;
                                                        return (
                                                            <button
                                                                className={`p-2 rounded-lg text-white flex flex-col items-center justify-center gap-1 font-semibold border border-white/10 shadow-metal-sm ${blocked ? 'bg-gray-600/80 cursor-not-allowed' : 'bg-green-700 hover:bg-green-600'}`}
                                                                onClick={() => handleSimpleAction(selectedNation.id, 'propose_treaty', { type: 'non_aggression', durationDays: 365 })}
                                                                disabled={blocked}
                                                            >
                                                                <Icon name="Shield" size={14} />
                                                                <span className="text-xs">互不侵犯</span>
                                                            </button>
                                                        );
                                                    })()}

                                                    {/* 开放市场 */}
                                                    {(() => {
                                                        const treatyCooldown = getDiplomaticCooldown(selectedNation, 'propose_treaty');
                                                        const hasActive = Array.isArray(selectedNation?.treaties) && selectedNation.treaties.some(t => t.type === 'open_market' && (!t.endDay || daysElapsed < t.endDay));
                                                        const blocked = selectedNation?.isAtWar || treatyCooldown.isOnCooldown || hasActive;
                                                        return (
                                                            <button
                                                                className={`p-2 rounded-lg text-white flex flex-col items-center justify-center gap-1 font-semibold border border-white/10 shadow-metal-sm ${blocked ? 'bg-gray-600/80 cursor-not-allowed' : 'bg-blue-700 hover:bg-blue-600'}`}
                                                                onClick={() => handleSimpleAction(selectedNation.id, 'propose_treaty', { type: 'open_market', durationDays: 730 })}
                                                                disabled={blocked}
                                                            >
                                                                <Icon name="Store" size={14} />
                                                                <span className="text-xs">开放市场</span>
                                                            </button>
                                                        );
                                                    })()}

                                                    {/* 贸易协定 */}
                                                    {(() => {
                                                        const isUnlocked = isDiplomacyUnlocked('treaties', 'trade_agreement', epoch);
                                                        const treatyCooldown = getDiplomaticCooldown(selectedNation, 'propose_treaty');
                                                        const hasActive = Array.isArray(selectedNation?.treaties) && selectedNation.treaties.some(t => t.type === 'trade_agreement' && (!t.endDay || daysElapsed < t.endDay));
                                                        const blocked = !isUnlocked || selectedNation?.isAtWar || treatyCooldown.isOnCooldown || hasActive;
                                                        return (
                                                            <button
                                                                className={`p-2 rounded-lg text-white flex flex-col items-center justify-center gap-1 font-semibold border border-white/10 shadow-metal-sm ${blocked ? 'bg-gray-600/80 cursor-not-allowed' : 'bg-amber-700 hover:bg-amber-600'}`}
                                                                onClick={() => handleSimpleAction(selectedNation.id, 'propose_treaty', { type: 'trade_agreement', durationDays: getTreatyDuration('trade_agreement', epoch) })}
                                                                disabled={blocked}
                                                            >
                                                                <Icon name="Handshake" size={14} />
                                                                <span className="text-xs">{!isUnlocked ? '🔒贸易' : '贸易协定'}</span>
                                                            </button>
                                                        );
                                                    })()}

                                                    {/* 自由贸易 */}
                                                    {(() => {
                                                        const isUnlocked = isDiplomacyUnlocked('treaties', 'free_trade', epoch);
                                                        const treatyCooldown = getDiplomaticCooldown(selectedNation, 'propose_treaty');
                                                        const hasActive = Array.isArray(selectedNation?.treaties) && selectedNation.treaties.some(t => t.type === 'free_trade' && (!t.endDay || daysElapsed < t.endDay));
                                                        const blocked = !isUnlocked || selectedNation?.isAtWar || treatyCooldown.isOnCooldown || hasActive;
                                                        return (
                                                            <button
                                                                className={`p-2 rounded-lg text-white flex flex-col items-center justify-center gap-1 font-semibold border border-white/10 shadow-metal-sm ${blocked ? 'bg-gray-600/80 cursor-not-allowed' : 'bg-teal-700 hover:bg-teal-600'}`}
                                                                onClick={() => handleSimpleAction(selectedNation.id, 'propose_treaty', { type: 'free_trade', durationDays: getTreatyDuration('free_trade', epoch) })}
                                                                disabled={blocked}
                                                            >
                                                                <Icon name="Globe" size={14} />
                                                                <span className="text-xs">{!isUnlocked ? '🔒自贸' : '自由贸易'}</span>
                                                            </button>
                                                        );
                                                    })()}

                                                    {/* 学术交流 */}
                                                    {(() => {
                                                        const isUnlocked = isDiplomacyUnlocked('treaties', 'academic_exchange', epoch);
                                                        const treatyCooldown = getDiplomaticCooldown(selectedNation, 'propose_treaty');
                                                        const hasActive = Array.isArray(selectedNation?.treaties) && selectedNation.treaties.some(t => t.type === 'academic_exchange' && (!t.endDay || daysElapsed < t.endDay));
                                                        const blocked = !isUnlocked || selectedNation?.isAtWar || treatyCooldown.isOnCooldown || hasActive;
                                                        return (
                                                            <button
                                                                className={`p-2 rounded-lg text-white flex flex-col items-center justify-center gap-1 font-semibold border border-white/10 shadow-metal-sm ${blocked ? 'bg-gray-600/80 cursor-not-allowed' : 'bg-purple-700 hover:bg-purple-600'}`}
                                                                onClick={() => handleSimpleAction(selectedNation.id, 'propose_treaty', { type: 'academic_exchange', durationDays: getTreatyDuration('academic_exchange', epoch) })}
                                                                disabled={blocked}
                                                            >
                                                                <Icon name="BookOpen" size={14} />
                                                                <span className="text-xs">{!isUnlocked ? '🔒学术' : '学术交流'}</span>
                                                            </button>
                                                        );
                                                    })()}

                                                    {/* 共同防御 */}
                                                    {(() => {
                                                        const isUnlocked = isDiplomacyUnlocked('treaties', 'defensive_pact', epoch);
                                                        const treatyCooldown = getDiplomaticCooldown(selectedNation, 'propose_treaty');
                                                        const hasActive = Array.isArray(selectedNation?.treaties) && selectedNation.treaties.some(t => t.type === 'defensive_pact' && (!t.endDay || daysElapsed < t.endDay));
                                                        const blocked = !isUnlocked || selectedNation?.isAtWar || treatyCooldown.isOnCooldown || hasActive;
                                                        return (
                                                            <button
                                                                className={`p-2 rounded-lg text-white flex flex-col items-center justify-center gap-1 font-semibold border border-white/10 shadow-metal-sm ${blocked ? 'bg-gray-600/80 cursor-not-allowed' : 'bg-red-700 hover:bg-red-600'}`}
                                                                onClick={() => handleSimpleAction(selectedNation.id, 'propose_treaty', { type: 'defensive_pact', durationDays: getTreatyDuration('defensive_pact', epoch) })}
                                                                disabled={blocked}
                                                            >
                                                                <Icon name="ShieldCheck" size={14} />
                                                                <span className="text-xs">{!isUnlocked ? '🔒防御' : '共同防御'}</span>
                                                            </button>
                                                        );
                                                    })()}

                                                    {/* 投资协议 */}
                                                    {(() => {
                                                        const isUnlocked = isDiplomacyUnlocked('treaties', 'investment_pact', epoch);
                                                        const treatyCooldown = getDiplomaticCooldown(selectedNation, 'propose_treaty');
                                                        const hasActive = Array.isArray(selectedNation?.treaties) && selectedNation.treaties.some(t => t.type === 'investment_pact' && (!t.endDay || daysElapsed < t.endDay));
                                                        const blocked = !isUnlocked || selectedNation?.isAtWar || treatyCooldown.isOnCooldown || hasActive;
                                                        return (
                                                            <button
                                                                className={`p-2 rounded-lg text-white flex flex-col items-center justify-center gap-1 font-semibold border border-white/10 shadow-metal-sm ${blocked ? 'bg-gray-600/80 cursor-not-allowed' : 'bg-emerald-700 hover:bg-emerald-600'}`}
                                                                onClick={() => handleSimpleAction(selectedNation.id, 'propose_treaty', { type: 'investment_pact', durationDays: getTreatyDuration('investment_pact', epoch) })}
                                                                disabled={blocked}
                                                            >
                                                                <Icon name="Building2" size={14} />
                                                                <span className="text-xs">{!isUnlocked ? '🔒投资' : '投资协议'}</span>
                                                            </button>
                                                        );
                                                    })()}

                                                    {/* 海外投资入口 */}
                                                    {(() => {
                                                        const hasInvestmentPact = Array.isArray(selectedNation?.treaties) && selectedNation.treaties.some(t => t.type === 'investment_pact' && (!t.endDay || daysElapsed < t.endDay));
                                                        const isVassal = selectedNation?.vassalOf === 'player';
                                                        const canInvest = hasInvestmentPact || isVassal;
                                                        return (
                                                            <button
                                                                className={`p-2 rounded-lg text-white flex flex-col items-center justify-center gap-1 font-semibold border border-white/10 shadow-metal-sm ${!canInvest ? 'bg-gray-600/80 cursor-not-allowed' : 'bg-cyan-700 hover:bg-cyan-600'}`}
                                                                onClick={() => {
                                                                    if (canInvest) {
                                                                        setInvestmentPanelNation(selectedNation);
                                                                        setShowOverseasInvestmentPanel(true);
                                                                    }
                                                                }}
                                                                disabled={!canInvest}
                                                                title={!canInvest ? '需要投资协议或附庸关系' : '管理海外投资'}
                                                            >
                                                                <Icon name="Factory" size={14} />
                                                                <span className="text-xs">{!canInvest ? '需协议' : '海外投资'}</span>
                                                            </button>
                                                        );
                                                    })()}
                                                </div>

                                                {Array.isArray(selectedNation?.treaties) && selectedNation.treaties.length > 0 && (
                                                    <div className="mt-3 text-xs text-gray-300 font-body">
                                                        <div className="text-[10px] text-gray-500 mb-1 font-decorative">当前条约</div>
                                                        <div className="space-y-1">
                                                            {selectedNation.treaties.slice(-3).reverse().map((t) => (
                                                                <div key={t.id || `${t.type}-${t.endDay}`} className="flex items-center justify-between bg-gray-800/40 border border-gray-700/60 rounded px-2 py-1">
                                                                    <span className="text-gray-200">
                                                                        {t.type === 'open_market' ? '开放市场' : t.type === 'non_aggression' ? '互不侵犯' : t.type}
                                                                    </span>
                                                                    <span className="text-gray-400 font-epic">
                                                                        {Number.isFinite(t.endDay) ? `剩${Math.max(0, t.endDay - daysElapsed)}天` : '生效中'}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="mt-2 text-center text-[10px] text-gray-400 font-epic">
                                                礼物成本: {calculateDynamicGiftCost(resources.silver || 0, selectedNation?.wealth || 0)} | 挑拨成本: {calculateProvokeCost(resources.silver || 0, selectedNation?.wealth || 0)}
                                            </div>
                                        </div>

                                        {selectedPreferences.length > 0 && (
                                            <div className="p-3 glass-ancient rounded-lg border border-ancient-gold/20 shadow-metal-sm">
                                                <h4 className="text-sm font-bold text-ancient-parchment font-decorative flex items-center gap-2 mb-2">
                                                    <Icon name="Package" size={12} className="text-amber-300" />
                                                    偏好资源
                                                </h4>
                                                <div className="flex flex-wrap gap-2">
                                                    {selectedPreferences.slice(0, 4).map((pref) => (
                                                        <span
                                                            key={pref.key}
                                                            className="px-2.5 py-1 rounded-full bg-ancient-ink/60 border border-ancient-gold/40 text-xs text-ancient-parchment flex items-center gap-1.5"
                                                            title={`倾向度 x${pref.bias.toFixed(1)}`}
                                                        >
                                                            <Icon name={pref.icon} size={12} className={pref.color || 'text-amber-200'} />
                                                            <span className="font-body">{pref.name}</span>
                                                            <span className="text-amber-300 font-mono text-xs font-epic">x{pref.bias.toFixed(1)}</span>
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {selectedNation.peaceTreatyUntil && daysElapsed < selectedNation.peaceTreatyUntil && (
                                            <div className="p-3 bg-green-900/20 rounded-lg border border-green-600/30 shadow-metal-sm">
                                                <h4 className="text-base font-bold text-white flex items-center gap-2 mb-2 font-decorative">
                                                    <Icon name="HandHeart" size={14} className="text-green-300" />
                                                    和平协议
                                                </h4>
                                                <p className="text-xs text-gray-300 font-body">
                                                    剩余天数: <span className="text-green-300 font-semibold font-epic">{selectedNation.peaceTreatyUntil - daysElapsed}</span>
                                                </p>
                                                {selectedNation.installmentPayment && (
                                                    <p className="text-xs text-gray-300 mt-1 font-body">
                                                        分期支付: 每天 <span className="text-yellow-300 font-semibold font-epic">{selectedNation.installmentPayment.amount}</span> 银币
                                                        （剩余 <span className="text-white font-semibold font-epic">{selectedNation.installmentPayment.remainingDays}</span> 天）
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        {selectedNation.isAtWar && (
                                            <div className="p-3 bg-red-900/30 rounded-lg border border-red-600/50 shadow-metal-sm">
                                                <h4 className="text-base font-bold text-white flex items-center gap-2 mb-2 font-decorative">
                                                    <Icon name="AlertTriangle" size={14} className="text-red-300" />
                                                    战争状态
                                                </h4>
                                                <div className="grid grid-cols-4 gap-2 text-center text-xs mb-2">
                                                    <div><div className="text-gray-400 text-[10px] uppercase">分数</div><div className="text-red-300 font-semibold font-epic">{selectedNation.warScore?.toFixed(0) || 0}</div></div>
                                                    <div><div className="text-gray-400 text-[10px] uppercase">天数</div><div className="text-white font-semibold font-epic">{selectedNation.warDuration || 0}</div></div>
                                                    <div><div className="text-gray-400 text-[10px] uppercase">损失</div><div className="text-white font-semibold font-epic">{selectedNation.enemyLosses || 0}</div></div>
                                                    <div><div className="text-gray-400 text-[10px] uppercase">实力</div><div className={`font-semibold font-epic ${(selectedNation.militaryStrength ?? 1.0) > 0.7 ? 'text-green-300' : (selectedNation.militaryStrength ?? 1.0) > 0.4 ? 'text-yellow-300' : 'text-red-300'}`}>{Math.floor((selectedNation.militaryStrength ?? 1.0) * 100)}%</div></div>
                                                </div>
                                                <p className="text-xs text-gray-300 mb-3 text-center">{renderPeaceHint(selectedNation)}</p>
                                                <button
                                                    className="w-full py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-semibold"
                                                    onClick={() => handleSimpleAction(selectedNation.id, 'peace')}
                                                >
                                                    提出和平协议
                                                </button>
                                            </div>
                                        )}

                                    </div>
                                )}

                                {sheetSection === 'trade' && (
                                    <div className="space-y-3">
                                        <div className="bg-gray-800/60 p-2 rounded-lg border border-gray-700">
                                            <div className="flex items-center justify-between mb-2">
                                                <h3 className="text-xs font-bold text-white flex items-center gap-1 font-decorative">
                                                    <Icon name="BarChart2" size={12} className="text-blue-300" />
                                                    国外市场
                                                </h3>
                                                <button
                                                    onClick={() => setShowTradeRoutesModal(true)}
                                                    className="px-3 py-1 rounded bg-amber-600/80 hover:bg-amber-500 text-white text-xs font-body"
                                                >
                                                    派驻商人
                                                </button>
                                            </div>

                                            <div className="space-y-1">
                                                {tradableResources.map(([key, res]) => {
                                                    if (!selectedNation) return null;

                                                    const local = getLocalPrice(key);
                                                    const foreign = calculateForeignPrice(key, selectedNation, daysElapsed);
                                                    const diff = foreign - local;
                                                    const tradeStatus = calculateTradeStatus(key, selectedNation, daysElapsed) || {};

                                                    const rawShortage = Math.floor(tradeStatus.shortageAmount || 0);
                                                    const rawSurplus = Math.floor(tradeStatus.surplusAmount || 0);
                                                    const shortageCapacity = rawShortage > 9999 ? '9999+' : rawShortage;
                                                    const surplusCapacity = rawSurplus > 9999 ? '9999+' : rawSurplus;

                                                    const isUnlocked = (res.unlockEpoch ?? 0) <= epoch;
                                                    if (!isUnlocked) return null;

                                                    return (
                                                        <div key={key} className="bg-gray-900/40 rounded p-1.5 border border-gray-700/50">
                                                            <div className="flex items-center justify-between mb-1">
                                                                <div className="flex items-center gap-1.5">
                                                                    <Icon name={res.icon || 'Box'} size={12} className={res.color || 'text-gray-400'} />
                                                                    <span className="text-xs font-semibold text-white font-body">{res.name}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1 text-[10px] font-epic">
                                                                    {tradeStatus.isShortage && (
                                                                        <span className="text-red-400 font-mono">缺{shortageCapacity}</span>
                                                                    )}
                                                                    {tradeStatus.isSurplus && (
                                                                        <span className="text-green-400 font-mono">余{surplusCapacity}</span>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center justify-between text-[10px]">
                                                                <div className="flex gap-2 text-gray-400 font-body">
                                                                    <span>本地: <span className="text-white font-mono font-epic">{local.toFixed(1)}</span></span>
                                                                    <span>外国: <span className={`font-mono font-epic ${diff > 0 ? 'text-green-300' : 'text-red-300'}`}>{foreign.toFixed(1)}</span></span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="p-6 text-center text-gray-400">暂无可交互的国家。</div>
                    )}
                </div>
            </BottomSheet>

            {/* 附庸政策调整模态框 */}
            {
                showVassalPolicyModal && vassalPolicyTarget && (
                    <VassalPolicyModal
                        nation={vassalPolicyTarget}
                        onClose={() => {
                            setShowVassalPolicyModal(false);
                            setVassalPolicyTarget(null);
                        }}
                        onApply={(policy) => {
                            onDiplomaticAction(vassalPolicyTarget.id, 'adjust_vassal_policy', { policy });
                        }}
                    />
                )
            }

            {/* 海外投资管理面板 */}
            <OverseasInvestmentPanel
                isOpen={showOverseasInvestmentPanel}
                onClose={() => {
                    setShowOverseasInvestmentPanel(false);
                    setInvestmentPanelNation(null);
                }}
                targetNation={investmentPanelNation}
                overseasInvestments={overseasInvestments}
                classWealth={classWealth}
                epoch={epoch}
                market={market}
                onInvest={(nationId, buildingId, ownerStratum) => {
                    onDiplomaticAction(nationId, 'establish_overseas_investment', {
                        buildingId,
                        ownerStratum,
                        operatingMode: 'local',
                    });
                }}
                onWithdraw={(investmentId) => {
                    if (investmentPanelNation) {
                        onDiplomaticAction(investmentPanelNation.id, 'withdraw_overseas_investment', { investmentId });
                    }
                }}
                onModeChange={(investmentIds, newMode) => {
                    if (investmentPanelNation) {
                        const payload = Array.isArray(investmentIds)
                            ? { investmentIds, operatingMode: newMode }
                            : { investmentId: investmentIds, operatingMode: newMode };
                        onDiplomaticAction(investmentPanelNation.id, 'change_investment_mode', payload);
                    }
                }}
            />
        </div >
    );
};

// Memoized for performance - prevents re-render when props unchanged
export const DiplomacyTab = memo(DiplomacyTabComponent);
