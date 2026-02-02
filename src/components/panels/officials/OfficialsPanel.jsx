import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { OfficialCard } from './OfficialCard';
import { Icon } from '../../common/UIComponents';
import { calculateTotalDailySalary, getCabinetStatus } from '../../../logic/officials/manager';
import { STRATA } from '../../../config';
import { isStanceSatisfied, POLITICAL_STANCES } from '../../../config/politicalStances';
import { CabinetSynergyDisplay } from './CabinetSynergyDisplay';
import { PlannedEconomyPanel } from './PlannedEconomyPanel';
import { FreeMarketPanel } from './FreeMarketPanel';
import { ReformDecreePanel } from './ReformDecreePanel';
import { DOMINANCE_EFFECTS, DOMINANCE_MIN_EPOCH, calculatePolicySlots, getCentristCabinetDecrees } from '../../../logic/officials/cabinetSynergy';
import { EPOCHS } from '../../../config/epochs';
import { OfficialDetailModal } from '../../modals/OfficialDetailModal';
import { formatNumberShortCN } from '../../../utils/numberFormat';
import {
    MINISTER_LABELS,
    MINISTER_ROLES,
    ECONOMIC_MINISTER_ROLES,
    buildMinisterRoster,
    getMinisterStatValue,
    getMinisterProductionBonus,
    getMinisterTradeBonus,
    getMinisterMilitaryBonus,
    getMinisterTrainingSpeedBonus,
    getMinisterDiplomaticBonus,
} from '../../../logic/officials/ministers';

export const OfficialsPanel = ({
    officials = [],
    candidates = [],
    capacity = 0,
    lastSelectionDay = 0,
    currentTick = 0,
    resources,
    onTriggerSelection,
    onHire,
    onFire,
    onDispose,
    selectionCooldown = 180,
    // 新增：内阁协同系统相关回调和数据
    epoch = 0, // 当前时代
    popStructure = {},
    classWealth = {},
    buildingCounts = {},
    quotaTargets = {},
    expansionSettings = {},
    activeDecrees = {},
    decreeCooldowns = {},
    decrees = [],
    onToggleDecree,
    onShowDecreeDetails,
    onUpdateQuotas,
    onUpdateExpansionSettings,
    onEnactDecree,
    onUpdateOfficialSalary,
    onUpdateOfficialName,
    ministerAssignments = {},
    ministerAutoExpansion = {},
    lastMinisterExpansionDay = 0,
    onAssignMinister,
    onClearMinister,
    onToggleMinisterAutoExpansion,

    // [NEW] 额外上下文和详细容量
    jobCapacity = 0,
    maxCapacity = 3,
    stanceContext = {},
    prices = {},  // [NEW] 市场价格用于自由市场面板
    market = {}, // [NEW] 完整市场数据（含 wages）
    taxPolicies = {}, // [NEW] 税收政策用于盈利计算
    buildingFinancialData = {}, // [NEW] 每建筑实际财务数据

    // [NEW] 价格管制相关
    priceControls = { enabled: false, governmentBuyPrices: {}, governmentSellPrices: {} },
    onUpdatePriceControls,

    // [NEW] 忠诚度系统相关
    stability = 50,        // 当前国家稳定度 (0-100)
    officialsPaid = true,  // 是否支付了全额薪水
}) => {

    const centristDecrees = useMemo(() => getCentristCabinetDecrees(decrees), [decrees]);

    // 派系面板弹窗状态
    const [showDominancePanel, setShowDominancePanel] = useState(false);
    const [selectedOfficial, setSelectedOfficial] = useState(null);
    const [searchText, setSearchText] = useState('');
    const [stanceFilter, setStanceFilter] = useState('all');
    const [stratumFilter, setStratumFilter] = useState('all');
    const [loyaltyFilter, setLoyaltyFilter] = useState('all');
    const [sortKey, setSortKey] = useState('loyalty');
    const [sortDir, setSortDir] = useState('desc');
    const [pageSize, setPageSize] = useState(12);
    const [page, setPage] = useState(1);
    const [showFilterPanel, setShowFilterPanel] = useState(false);
    useEffect(() => {
        if (!selectedOfficial?.id) return;
        const latest = officials.find(official => official.id === selectedOfficial.id);
        if (latest && latest !== selectedOfficial) {
            setSelectedOfficial(latest);
        }
    }, [officials, selectedOfficial]);

    // Derived state
    const currentCount = officials.length;
    const isAtCapacity = currentCount >= capacity;
    const daysSinceSelection = currentTick - lastSelectionDay;
    const selectionReady = lastSelectionDay === 0 || daysSinceSelection >= selectionCooldown;
    const daysRemaining = Math.max(0, selectionCooldown - daysSinceSelection);

    const totalDailySalary = useMemo(() => calculateTotalDailySalary(officials), [officials]);
    const canAffordSalaries = (resources?.silver || 0) >= totalDailySalary;

    const overviewStats = useMemo(() => {
        if (!officials.length) {
            return {
                avgLoyalty: 0,
                avgAdmin: 0,
                avgMilitary: 0,
                avgDiplomacy: 0,
                avgPrestige: 0,
                lowLoyaltyCount: 0,
            };
        }
        const totals = officials.reduce((acc, official) => {
            acc.loyalty += official?.loyalty ?? 75;
            acc.admin += official?.stats?.administrative ?? official?.administrative ?? 50;
            acc.military += official?.stats?.military ?? official?.military ?? 30;
            acc.diplomacy += official?.stats?.diplomacy ?? official?.diplomacy ?? 30;
            acc.prestige += official?.stats?.prestige ?? official?.prestige ?? 50;
            if ((official?.loyalty ?? 75) < 50) acc.lowLoyalty += 1;
            return acc;
        }, {
            loyalty: 0,
            admin: 0,
            military: 0,
            diplomacy: 0,
            prestige: 0,
            lowLoyalty: 0,
        });
        return {
            avgLoyalty: totals.loyalty / officials.length,
            avgAdmin: totals.admin / officials.length,
            avgMilitary: totals.military / officials.length,
            avgDiplomacy: totals.diplomacy / officials.length,
            avgPrestige: totals.prestige / officials.length,
            lowLoyaltyCount: totals.lowLoyalty,
        };
    }, [officials]);

    const ministerRoster = useMemo(() => buildMinisterRoster(officials), [officials]);
    const assignedMinisterIds = useMemo(() => {
        const ids = Object.values(ministerAssignments || {}).filter(Boolean);
        return new Set(ids);
    }, [ministerAssignments]);
    const daysUntilMinisterExpansion = useMemo(() => {
        if (!Number.isFinite(currentTick)) return null;
        const lastDay = Number.isFinite(lastMinisterExpansionDay) ? lastMinisterExpansionDay : 0;
        const delta = Math.max(0, 5 - (currentTick - lastDay));
        return delta;
    }, [currentTick, lastMinisterExpansionDay]);

    const filteredOfficials = useMemo(() => {
        const query = searchText.trim().toLowerCase();
        const filtered = officials.filter((official) => {
            if (!official) return false;
            if (query && !official.name?.toLowerCase().includes(query)) return false;

            const officialStratum = official.sourceStratum || official.stratum;
            if (stratumFilter !== 'all' && officialStratum !== stratumFilter) return false;

            if (stanceFilter !== 'all') {
                const spectrum = POLITICAL_STANCES[official.politicalStance]?.spectrum || 'none';
                if (spectrum !== stanceFilter) return false;
            }

            const loyaltyValue = official?.loyalty ?? 75;
            if (loyaltyFilter === 'low' && loyaltyValue >= 50) return false;
            if (loyaltyFilter === 'risk' && loyaltyValue >= 25) return false;
            if (loyaltyFilter === 'high' && loyaltyValue < 75) return false;

            return true;
        });

        const sorted = [...filtered].sort((a, b) => {
            const getValue = (target) => {
                switch (sortKey) {
                    case 'name':
                        return target?.name || '';
                    case 'salary':
                        return target?.salary ?? 0;
                    case 'prestige':
                        return target?.stats?.prestige ?? target?.prestige ?? 50;
                    case 'admin':
                        return target?.stats?.administrative ?? target?.administrative ?? 50;
                    case 'military':
                        return target?.stats?.military ?? target?.military ?? 30;
                    case 'diplomacy':
                        return target?.stats?.diplomacy ?? target?.diplomacy ?? 30;
                    case 'loyalty':
                    default:
                        return target?.loyalty ?? 75;
                }
            };

            const aValue = getValue(a);
            const bValue = getValue(b);

            if (typeof aValue === 'string' || typeof bValue === 'string') {
                return String(aValue).localeCompare(String(bValue), 'zh-Hans-CN', { numeric: true }) * (sortDir === 'asc' ? 1 : -1);
            }
            return (aValue - bValue) * (sortDir === 'asc' ? 1 : -1);
        });

        return sorted;
    }, [officials, searchText, stanceFilter, stratumFilter, loyaltyFilter, sortKey, sortDir]);

    const totalPages = Math.max(1, Math.ceil(filteredOfficials.length / pageSize));
    const safePage = Math.min(page, totalPages);

    const pagedOfficials = useMemo(() => {
        const start = (safePage - 1) * pageSize;
        return filteredOfficials.slice(start, start + pageSize);
    }, [filteredOfficials, safePage, pageSize]);

    useEffect(() => {
        setPage(1);
    }, [searchText, stanceFilter, stratumFilter, loyaltyFilter, sortKey, sortDir, pageSize]);

    useEffect(() => {
        if (page !== safePage) setPage(safePage);
    }, [page, safePage]);

    // 计算内阁状态（传递 capacity 和 epoch 用于主导判定）
    const cabinetStatus = useMemo(() =>
        getCabinetStatus(officials, activeDecrees, capacity, epoch),
        [officials, activeDecrees, capacity, epoch]
    );

    // 确定显示哪个派系面板
    const dominantPanel = cabinetStatus?.dominance?.panelType;
    const dominanceInfo = cabinetStatus?.dominance;
    const dominanceMinEpochName = EPOCHS[DOMINANCE_MIN_EPOCH]?.name || `时代${DOMINANCE_MIN_EPOCH}`;

    // 派系面板配置
    const panelConfig = {
        plannedEconomy: {
            icon: 'Users',
            label: '计划经济',
            color: 'red',
            bgClass: 'bg-red-600 hover:bg-red-500',
            borderClass: 'border-red-500/50',
        },
        freeMarket: {
            icon: 'TrendingUp',
            label: '自由市场',
            color: 'amber',
            bgClass: 'bg-amber-600 hover:bg-amber-500',
            borderClass: 'border-amber-500/50',
        },
        reformDecree: {
            icon: 'Scale',
            label: '改良法令',
            color: 'blue',
            bgClass: 'bg-blue-600 hover:bg-blue-500',
            borderClass: 'border-blue-500/50',
        },
    };
    const currentPanelConfig = dominantPanel ? panelConfig[dominantPanel] : null;

    return (
        <div className="space-y-6 p-2">

            {/* 1. 概览区域 */}
            <div className="bg-gray-900/60 rounded-xl p-4 border border-gray-700/50 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none">
                    <Icon name="Landmark" size={80} className="text-purple-400" />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 relative z-10">
                    <div>
                        <h3 className="text-lg font-bold text-gray-100 flex items-center gap-2">
                            <Icon name="Users" className="text-purple-400" />
                            官员管理
                        </h3>
                        <p className="text-xs text-gray-400 mt-1 max-w-md">
                            任命官员来管理你的国家事务。高级官员可提供显著加成，但需要支付每日薪俸。
                        </p>
                    </div>

                    <div className="flex items-center gap-4 bg-gray-800/50 p-2 rounded-lg border border-gray-700/30">
                        <div className="text-center px-2">
                            <div className="text-[10px] text-gray-500 uppercase tracking-wider">编制 (生效中)</div>
                            <div className={`text-xl font-mono font-bold ${isAtCapacity ? 'text-yellow-400' : 'text-gray-200'}`}>
                                {currentCount} <span className="text-gray-500 text-sm">/ {capacity}</span>
                            </div>
                            <div className="text-[9px] text-gray-400 flex items-center justify-center gap-2 mt-0.5">
                                <span title="当前可用职位数">岗位量: {jobCapacity}</span>
                                <span className="text-gray-600">|</span>
                                <span title="官僚机构最大承载力">上限: {maxCapacity}</span>
                            </div>
                        </div>
                        <div className="w-px h-8 bg-gray-700/50"></div>
                        <div className="text-center px-2">
                            <div className="text-[10px] text-gray-500 uppercase tracking-wider">每日开支</div>
                            <div className={`text-xl font-mono font-bold flex items-center gap-1 ${canAffordSalaries ? 'text-gray-200' : 'text-red-400'}`}>
                                {formatNumberShortCN(totalDailySalary, { decimals: 1 })} <Icon name="Coins" size={14} className="text-yellow-500" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. 内阁协同度显示 */}
            {officials.length > 0 && (
                <div className="bg-gray-900/40 rounded-xl p-3 border border-gray-700/40">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <div className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                            <Icon name="BarChart" size={14} className="text-emerald-400" />
                            官员数据概览
                        </div>
                        {overviewStats.lowLoyaltyCount > 0 && (
                            <div className="text-[10px] px-2 py-1 rounded bg-red-900/40 border border-red-700/40 text-red-300">
                                忠诚低人数: {overviewStats.lowLoyaltyCount}
                            </div>
                        )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-center">
                        <div className="bg-gray-900/60 border border-gray-700/40 rounded p-2">
                            <div className="text-[9px] text-gray-500">平均忠诚</div>
                            <div className="text-sm font-mono text-emerald-300">{overviewStats.avgLoyalty.toFixed(0)}</div>
                        </div>
                        <div className="bg-gray-900/60 border border-gray-700/40 rounded p-2">
                            <div className="text-[9px] text-gray-500">平均行政</div>
                            <div className="text-sm font-mono text-blue-300">{overviewStats.avgAdmin.toFixed(0)}</div>
                        </div>
                        <div className="bg-gray-900/60 border border-gray-700/40 rounded p-2">
                            <div className="text-[9px] text-gray-500">平均军事</div>
                            <div className="text-sm font-mono text-red-300">{overviewStats.avgMilitary.toFixed(0)}</div>
                        </div>
                        <div className="bg-gray-900/60 border border-gray-700/40 rounded p-2">
                            <div className="text-[9px] text-gray-500">平均外交</div>
                            <div className="text-sm font-mono text-green-300">{overviewStats.avgDiplomacy.toFixed(0)}</div>
                        </div>
                        <div className="bg-gray-900/60 border border-gray-700/40 rounded p-2">
                            <div className="text-[9px] text-gray-500">平均威望</div>
                            <div className="text-sm font-mono text-purple-300">{overviewStats.avgPrestige.toFixed(0)}</div>
                        </div>
                        <div className="bg-gray-900/60 border border-gray-700/40 rounded p-2">
                            <div className="text-[9px] text-gray-500">总薪俸/日</div>
                            <div className="text-sm font-mono text-yellow-300">
                                {formatNumberShortCN(totalDailySalary, { decimals: 1 })}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {officials.length > 0 && (
                <div className="bg-gray-900/40 rounded-xl p-3 border border-gray-700/40">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <div className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                            <Icon name="Briefcase" size={14} className="text-amber-400" />
                            部长任命
                        </div>
                    
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {MINISTER_ROLES.map((role) => {
                            const assignedId = ministerAssignments?.[role] || '';
                            const assigned = assignedId ? ministerRoster.get(assignedId) : null;
                            const assignedValue = assigned ? assignedId : '';
                            const statValue = assigned ? getMinisterStatValue(assigned, role) : 0;
                            const productionBonus = assigned ? getMinisterProductionBonus(role, statValue) : 0;
                            const tradeBonus = role === 'commerce' && assigned ? getMinisterTradeBonus(statValue) : 0;
                            const militaryBonus = role === 'military' && assigned ? getMinisterMilitaryBonus(statValue) : 0;
                            const trainingBonus = role === 'military' && assigned ? getMinisterTrainingSpeedBonus(statValue) : 0;
                            const diplomaticBonus = role === 'diplomacy' && assigned ? getMinisterDiplomaticBonus(statValue) : 0;
                            const isEconomic = ECONOMIC_MINISTER_ROLES.includes(role);

                            const formatPercent = (value) => `${value > 0 ? '+' : ''}${(value * 100).toFixed(0)}%`;
                            const formatDaily = (value) => `${value > 0 ? '+' : ''}${value.toFixed(2)}/日`;

                            const bonusLines = [];
                            if (assigned) {
                                if (isEconomic && productionBonus) {
                                    bonusLines.push(`产出 ${formatPercent(productionBonus)}`);
                                }
                                if (role === 'commerce' && tradeBonus) {
                                    bonusLines.push(`贸易收益 ${formatPercent(tradeBonus)}`);
                                }
                                if (role === 'military') {
                                    if (militaryBonus) bonusLines.push(`战力 ${formatPercent(militaryBonus)}`);
                                    if (trainingBonus) bonusLines.push(`训练速度 ${formatPercent(trainingBonus)}`);
                                }
                                if (role === 'diplomacy' && diplomaticBonus) {
                                    bonusLines.push(`外交关系 ${formatDaily(diplomaticBonus)}`);
                                }
                            }

                            // 获取官员的完整属性
                            let statsDisplay = '未任命';
                            if (assigned) {
                                const prestige = assigned.stats?.prestige ?? assigned.prestige ?? 50;
                                const admin = assigned.stats?.administrative ?? assigned.administrative ?? 50;
                                const military = assigned.stats?.military ?? assigned.military ?? 30;
                                const diplomacy = assigned.stats?.diplomacy ?? assigned.diplomacy ?? 30;
                                statsDisplay = `${assigned.name} (威${prestige}/政${admin}/军${military}/外${diplomacy})`;
                            }

                            return (
                                <div key={role} className="bg-gray-900/60 border border-gray-700/40 rounded p-2">
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="text-xs font-semibold text-gray-200">{MINISTER_LABELS[role] || role}</div>
                                        {assigned && (
                                            <button
                                                onClick={() => onClearMinister && onClearMinister(role)}
                                                className="text-[10px] text-gray-400 hover:text-gray-200"
                                            >
                                                撤换
                                            </button>
                                        )}
                                    </div>
                                    <div className="text-[10px] text-gray-500 mb-1">
                                        {statsDisplay}
                                    </div>
                                    <select
                                        value={assignedValue}
                                        onChange={(event) => {
                                            const nextId = event.target.value;
                                            if (!onAssignMinister) return;
                                            if (!nextId) {
                                                if (onClearMinister) onClearMinister(role);
                                                return;
                                            }
                                            onAssignMinister(role, nextId);
                                        }}
                                        className="w-full bg-gray-900/70 border border-gray-700/60 rounded px-2 py-1 text-[11px] text-gray-200"
                                    >
                                        <option value="">未任命</option>
                                        {officials.map((official) => {
                                            const isAssignedElsewhere = assignedMinisterIds.has(official.id) && official.id !== assignedId;
                                            const prestige = official.stats?.prestige ?? official.prestige ?? 50;
                                            const admin = official.stats?.administrative ?? official.administrative ?? 50;
                                            const military = official.stats?.military ?? official.military ?? 30;
                                            const diplomacy = official.stats?.diplomacy ?? official.diplomacy ?? 30;
                                            return (
                                                <option key={official.id} value={official.id} disabled={isAssignedElsewhere}>
                                                    {official.name} (威{prestige}/政{admin}/军{military}/外{diplomacy})
                                                </option>
                                            );
                                        })}
                                    </select>
                                    <div className="mt-1 min-h-[12px] text-[9px] text-emerald-300">
                                        {bonusLines.length > 0 ? bonusLines.join(' · ') : (assigned ? '暂无加成' : '')}
                                    </div>
                                    {isEconomic && assigned && (
                                        <div className="mt-2 pt-2 border-t border-gray-700/40">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={ministerAutoExpansion?.[role] ?? true}
                                                    onChange={(e) => {
                                                        if (onToggleMinisterAutoExpansion) {
                                                            onToggleMinisterAutoExpansion(role, e.target.checked);
                                                        }
                                                    }}
                                                    className="w-3 h-3 rounded border-gray-600 bg-gray-800 text-emerald-500 focus:ring-emerald-500/50"
                                                />
                                                <span className="text-[10px] text-gray-400">
                                                    允许自动扩建
                                                </span>
                                            </label>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {officials.length > 0 && (
                <CabinetSynergyDisplay
                    officials={officials}
                    cabinetStatus={cabinetStatus}
                />
            )}

            {/* 3. 主导派系入口按钮 */}
            {dominantPanel && currentPanelConfig ? (
                <div className={`bg-gray-900/60 rounded-xl p-4 border ${currentPanelConfig.borderClass} shadow-lg`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-lg ${currentPanelConfig.bgClass} text-white`}>
                                <Icon name={currentPanelConfig.icon} size={24} />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-100 flex items-center gap-2">
                                    {dominanceInfo?.name || '派系主导'}
                                    <span className={`text-xs px-2 py-0.5 rounded-full bg-${currentPanelConfig.color}-900/50 text-${currentPanelConfig.color}-300`}>
                                        {dominanceInfo?.percentage}% 占比
                                    </span>
                                </h4>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    {dominanceInfo?.description || '解锁特殊政策工具'}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowDominancePanel(true)}
                            className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-all text-white shadow-lg hover:scale-105 active:scale-95 ${currentPanelConfig.bgClass}`}
                        >
                            <Icon name="Settings" size={14} />
                            {currentPanelConfig.label}
                        </button>
                    </div>
                </div>
            ) : (
                /* 显示潜在的主导派系（如果有派系占比超过阈值但其他条件未满足） */
                (() => {
                    const potential = cabinetStatus?.distribution;
                    if (!potential) return null;
                    const total = officials.length;
                    if (total === 0) return null;

                    // 检测是否有派系占比很高但未触发主导
                    const DOMINANCE_THRESHOLD = 0.4; // 稍微放宽显示阈值
                    const sorted = Object.entries(potential).sort((a, b) => b[1] - a[1]);
                    const [topFaction, count] = sorted[0];
                    const ratio = count / total;

                    if (ratio >= DOMINANCE_THRESHOLD) {
                        const factionName = topFaction === 'left' ? '计划经济' : (topFaction === 'right' ? '自由市场' : '改良法令');
                        const factionColor = topFaction === 'left' ? 'red' : (topFaction === 'right' ? 'amber' : 'blue');
                        const missingCapacity = capacity * 0.5 - total; // 恢复基于 0.5 的阈值提示
                        const isEpochLocked = epoch < DOMINANCE_MIN_EPOCH;
                        const needMoreOfficials = missingCapacity > 0;
                        const lockMessageParts = [];

                        if (isEpochLocked) {
                            lockMessageParts.push(`需达到${dominanceMinEpochName}后解锁主导效应`);
                        }
                        if (needMoreOfficials) {
                            lockMessageParts.push(`还需 ${Math.ceil(missingCapacity)} 名官员`);
                        }

                        return (
                            <div className={`bg-gray-900/40 rounded-xl p-4 border border-gray-700/30 border-dashed`}>
                                <div className="flex items-center justify-between opacity-75">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2.5 rounded-lg bg-gray-800 text-gray-400`}>
                                            <Icon name="Lock" size={24} />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-300 flex items-center gap-2">
                                                {factionName} (未激活)
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">
                                                    {Math.round(ratio * 100)}% 占比
                                                </span>
                                            </h4>
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                {lockMessageParts.length > 0
                                                    ? lockMessageParts.join('，')
                                                    : '内阁协同度或占比不足'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    }
                    return null;
                })()
            )}

            {/* 4. 候选人选拔区域 */}
            <div className="flex items-center justify-between bg-gray-800/30 p-3 rounded-lg border border-gray-700/30">
                <div className="flex items-center gap-3">
                    <div className="bg-purple-900/20 p-2 rounded-lg text-purple-400">
                        <Icon name="Scroll" size={24} />
                    </div>
                    <div>
                        <h4 className="font-bold text-gray-200 text-sm">候选人选拔</h4>
                        <p className="text-xs text-gray-500">
                            {selectionReady
                                ? "可以召集新的候选人。"
                                : `距离下次选拔还需 ${daysRemaining} 天。`
                            }
                        </p>
                    </div>
                </div>
                <button
                    onClick={onTriggerSelection}
                    disabled={!selectionReady}
                    className={`
                        px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-all shadow-lg
                        ${selectionReady
                            ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-900/20 hover:scale-105 active:scale-95'
                            : 'bg-gray-700 text-gray-400 cursor-not-allowed opacity-70'}
                    `}
                >
                    <Icon name="RefreshCw" size={14} className={selectionReady ? '' : 'animate-none'} />
                    {selectionReady ? '召集候选人' : '冷却中'}
                </button>
            </div>

            {/* 5. 候选人列表 */}
            {candidates.length > 0 && (
                <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 display-inline-block"></span>
                        待选候选人
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {candidates.map(candidate => (
                            <OfficialCard
                                key={candidate.id}
                                official={candidate}
                                isCandidate={true}
                                onAction={onHire}
                                canAfford={(resources?.silver || 0) >= candidate.salary}
                                actionDisabled={isAtCapacity}
                                compact={true}
                                onViewDetail={setSelectedOfficial}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* 6. 在任官员列表 */}
            <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 display-inline-block"></span>
                    在任官员
                </h4>
                <div className="bg-gray-800/30 p-3 rounded-lg border border-gray-700/30 mb-3 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex-1 min-w-[160px]">
                            <input
                                value={searchText}
                                onChange={(event) => setSearchText(event.target.value)}
                                placeholder="搜索官员"
                                className="w-full bg-gray-900/60 border border-gray-700/60 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:ring-1 focus:ring-emerald-400/40"
                            />
                        </div>
                        <div className="flex items-center gap-1">
                            <select
                                value={sortKey}
                                onChange={(event) => setSortKey(event.target.value)}
                                className="bg-gray-900/60 border border-gray-700/60 rounded px-2 py-1 text-xs text-gray-200"
                            >
                                <option value="loyalty">忠诚</option>
                                <option value="prestige">威望</option>
                                <option value="salary">薪俸</option>
                                <option value="admin">行政</option>
                                <option value="military">军事</option>
                                <option value="diplomacy">外交</option>
                                <option value="name">姓名</option>
                            </select>
                            <button
                                onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
                                className="px-2 py-1 text-xs rounded bg-gray-900/60 border border-gray-700/60 text-gray-300 hover:text-white"
                            >
                                {sortDir === 'asc' ? '↑' : '↓'}
                            </button>
                        </div>
                        <select
                            value={pageSize}
                            onChange={(event) => setPageSize(Number(event.target.value))}
                            className="bg-gray-900/60 border border-gray-700/60 rounded px-2 py-1 text-xs text-gray-200"
                        >
                            <option value={8}>8</option>
                            <option value={12}>12</option>
                            <option value={16}>16</option>
                            <option value={24}>24</option>
                        </select>
                        <button
                            onClick={() => setShowFilterPanel(prev => !prev)}
                            className="px-2 py-1 text-xs rounded bg-gray-900/60 border border-gray-700/60 text-gray-300 hover:text-white"
                        >
                            {showFilterPanel ? '收起筛选' : '筛选'}
                        </button>
                        <div className="ml-auto text-[10px] text-gray-500">
                            {filteredOfficials.length} / {officials.length}
                        </div>
                    </div>
                    {showFilterPanel && (
                        <div className="flex flex-wrap items-center gap-2">
                            <select
                                value={stanceFilter}
                                onChange={(event) => setStanceFilter(event.target.value)}
                                className="bg-gray-900/60 border border-gray-700/60 rounded px-2 py-1 text-xs text-gray-200"
                            >
                                <option value="all">全部派系</option>
                                <option value="left">左派</option>
                                <option value="center">建制派</option>
                                <option value="right">右派</option>
                                <option value="none">无立场</option>
                            </select>
                            <select
                                value={stratumFilter}
                                onChange={(event) => setStratumFilter(event.target.value)}
                                className="bg-gray-900/60 border border-gray-700/60 rounded px-2 py-1 text-xs text-gray-200"
                            >
                                <option value="all">全部出身</option>
                                {Object.entries(STRATA).map(([key, value]) => (
                                    <option key={key} value={key}>{value?.name || key}</option>
                                ))}
                            </select>
                            <select
                                value={loyaltyFilter}
                                onChange={(event) => setLoyaltyFilter(event.target.value)}
                                className="bg-gray-900/60 border border-gray-700/60 rounded px-2 py-1 text-xs text-gray-200"
                            >
                                <option value="all">全部忠诚</option>
                                <option value="high">高于 75</option>
                                <option value="low">低于 50</option>
                                <option value="risk">低于 25</option>
                            </select>
                        </div>
                    )}
                </div>
                {officials.length === 0 ? (
                    <div className="text-center py-10 bg-gray-800/20 rounded-lg border border-dashed border-gray-700 text-gray-500">
                        <Icon name="UserX" size={32} className="mx-auto mb-2 opacity-50" />
                        <p className="text-sm">当前没有在任官员。</p>
                        <p className="text-xs opacity-70">雇佣候选人以获得加成。</p>
                    </div>
                ) : filteredOfficials.length === 0 ? (
                    <div className="text-center py-10 bg-gray-800/20 rounded-lg border border-dashed border-gray-700 text-gray-500">
                        <Icon name="Search" size={32} className="mx-auto mb-2 opacity-50" />
                        <p className="text-sm">没有符合条件的官员</p>
                        <p className="text-xs opacity-70">请调整搜索或筛选条件。</p>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                            {pagedOfficials.map(official => (
                                <OfficialCard
                                    key={official.id}
                                    official={official}
                                    isCandidate={false}
                                    onAction={onFire}
                                    onDispose={onDispose}
                                    onViewDetail={setSelectedOfficial}
                                    compact={true}
                                    currentDay={currentTick}
                                    isStanceSatisfied={official.politicalStance ? isStanceSatisfied(official.politicalStance, stanceContext, official.stanceConditionParams) : null}
                                />
                            ))}
                        </div>
                        {/* [FIX] 添加 pb-16 md:pb-3 为移动端底部导航栏留出空间 */}
                        <div className="mt-3 pb-16 md:pb-3 flex items-center justify-between">
                            <button
                                onClick={() => setPage(prev => Math.max(1, prev - 1))}
                                disabled={safePage <= 1}
                                className="px-3 py-1 text-xs rounded border border-gray-700/60 bg-gray-800/60 text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                上一页
                            </button>
                            <div className="text-[10px] text-gray-500">
                                第 {safePage} / {totalPages} 页
                            </div>
                            <button
                                onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={safePage >= totalPages}
                                className="px-3 py-1 text-xs rounded border border-gray-700/60 bg-gray-800/60 text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                下一页
                            </button>
                        </div>
                    </>
                )}
            </div>

            {!canAffordSalaries && officials.length > 0 && (
                <div className="mt-4 p-3 bg-red-900/20 border border-red-800/50 rounded-lg flex items-start gap-3">
                    <Icon name="AlertTriangle" className="text-red-400 mt-0.5" />
                    <div>
                        <div className="text-sm font-bold text-red-300">国库资金不足</div>
                        <div className="text-xs text-red-400/80">
                            无法支付全额薪俸，官员效果将降低 50%，直到薪俸补齐为止。
                        </div>
                    </div>
                </div>
            )}

            {/* 派系面板弹窗 - 使用 Portal 渲染到 body 顶层 */}
            {showDominancePanel && dominantPanel && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center">
                    {/* 背景遮罩 */}
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => setShowDominancePanel(false)}
                    />

                    {/* 弹窗内容 */}
                    <div className="relative w-full max-w-2xl max-h-[85vh] bg-gray-900 rounded-t-2xl sm:rounded-2xl border border-gray-700 shadow-2xl overflow-hidden animate-slide-up">
                        {/* 弹窗头部 */}
                        <div className={`flex items-center justify-between p-4 border-b border-gray-700 bg-gradient-to-r from-${currentPanelConfig?.color}-900/30 to-gray-900`}>
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${currentPanelConfig?.bgClass} text-white`}>
                                    <Icon name={currentPanelConfig?.icon} size={20} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-100">{currentPanelConfig?.label}</h3>
                                    <p className="text-xs text-gray-400">{dominanceInfo?.description}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowDominancePanel(false)}
                                className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-gray-200 transition-colors"
                            >
                                <Icon name="X" size={20} />
                            </button>
                        </div>

                        {/* 弹窗内容区域 */}
                        <div className="p-4 overflow-y-auto max-h-[70vh]">
                            {dominantPanel === 'plannedEconomy' && (
                                <PlannedEconomyPanel
                                    popStructure={popStructure}
                                    quotaTargets={quotaTargets}
                                    onUpdateQuotas={onUpdateQuotas}
                                    priceControls={priceControls}
                                    onUpdatePriceControls={onUpdatePriceControls}
                                    marketPrices={prices}
                                />
                            )}
                            {dominantPanel === 'freeMarket' && (
                                <FreeMarketPanel
                                    buildingCounts={buildingCounts}
                                    classWealth={classWealth}
                                    expansionSettings={expansionSettings}
                                    onUpdateSettings={onUpdateExpansionSettings}
                                    prices={prices}
                                    market={market}
                                    taxPolicies={taxPolicies}
                                />
                            )}
                            {dominantPanel === 'reformDecree' && (
                                <ReformDecreePanel
                                    activeDecrees={activeDecrees}
                                    decreeCooldowns={decreeCooldowns}
                                    currentDay={currentTick}
                                    silver={resources?.silver || 0}
                                    onEnactDecree={onEnactDecree}

                                    decrees={decrees}
                                    policySlots={calculatePolicySlots({
                                        officials,
                                        officialCapacity: maxCapacity,
                                        epoch,
                                        polityEffects: stanceContext?.polityEffects || {},
                                    })}
                                    onTogglePolicyDecree={onToggleDecree}
                                />
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}

            <OfficialDetailModal
                isOpen={!!selectedOfficial}
                onClose={() => setSelectedOfficial(null)}
                official={selectedOfficial}
                onUpdateSalary={onUpdateOfficialSalary}
                onUpdateName={onUpdateOfficialName}
                currentDay={currentTick}
                isStanceSatisfied={selectedOfficial?.politicalStance ? isStanceSatisfied(selectedOfficial.politicalStance, stanceContext, selectedOfficial.stanceConditionParams) : null}
                stability={stability}
                officialsPaid={officialsPaid}
                market={market}
                taxPolicies={taxPolicies}
                buildingCounts={buildingCounts}
                buildingFinancialData={buildingFinancialData}
            />

        </div>
    );
};
