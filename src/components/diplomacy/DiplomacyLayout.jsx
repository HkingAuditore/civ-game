import React, { useState, useEffect, useCallback, memo } from 'react';
import DiplomacyDashboard from './DiplomacyDashboard';
import NationList from './NationList';
import NationDetailView from './NationDetailView';
import { VassalManagementSheet } from '../panels/VassalManagementSheet';
import { INDEPENDENCE_CONFIG } from '../../config/diplomacy';
import { VassalOverviewPanel } from '../panels/VassalOverviewPanel';
// VassalDiplomacyPanel 已合并到 VassalManagementSheet 中
import { Icon } from '../common/UIComponents';
import { Button } from '../common/UnifiedUI';
import { COLORS } from '../../config/unifiedStyles';
import { BottomSheet } from '../tabs/BottomSheet';
import {
    TRADE_POLICY_DEFINITIONS,
    LABOR_POLICY_DEFINITIONS,
    GOVERNANCE_POLICY_DEFINITIONS,
    MILITARY_POLICY_DEFINITIONS,
} from '../../config/diplomacy';

// 外交控制政策（枚举值直接来自 adjustVassalPolicy 逻辑）
const DIPLOMATIC_CONTROL_DEFINITIONS = {
    autonomous: { id: 'autonomous', name: '自治', description: '附庸可自主开展外交' },
    guided:     { id: 'guided',     name: '引导', description: '宗主指导外交方向' },
    puppet:     { id: 'puppet',     name: '傀儡', description: '完全服从宗主外交意志' },
};
// 投资政策（枚举值直接来自 adjustVassalPolicy 逻辑）
const INVESTMENT_POLICY_DEFINITIONS = {
    autonomous: { id: 'autonomous', name: '自主投资', description: '附庸自主决定投资方向' },
    guided:     { id: 'guided',     name: '引导投资', description: '宗主提供投资建议' },
    forced:     { id: 'forced',     name: '强制投资', description: '宗主指令投资项目' },
};

// ==================== 附属国批量政策面板 ====================
/**
 * 附属国批量政策设置底部面板
 * 允许对所有附属国统一调整各维度政策
 */
const VASSAL_POLICY_DIMS = [
    {
        key: 'diplomaticControl',
        label: '外交控制',
        icon: 'Globe',
        color: 'text-blue-400',
        defs: DIPLOMATIC_CONTROL_DEFINITIONS,
        order: ['autonomous', 'guided', 'puppet'],
    },
    {
        key: 'tradePolicy',
        label: '贸易政策',
        icon: 'TrendingUp',
        color: 'text-green-400',
        defs: TRADE_POLICY_DEFINITIONS,
        order: ['free', 'preferential', 'monopoly', 'exclusive', 'dumping', 'looting'],
    },
    {
        key: 'labor',
        label: '劳工政策',
        icon: 'Hammer',
        color: 'text-orange-400',
        defs: LABOR_POLICY_DEFINITIONS,
        order: ['standard', 'exploitation', 'slavery'],
    },
    {
        key: 'governance',
        label: '治理政策',
        icon: 'Landmark',
        color: 'text-purple-400',
        defs: GOVERNANCE_POLICY_DEFINITIONS,
        order: ['autonomous', 'puppet_govt', 'direct_rule'],
    },
    {
        key: 'military',
        label: '军事政策',
        icon: 'Sword',
        color: 'text-red-400',
        defs: MILITARY_POLICY_DEFINITIONS,
        order: ['autonomous', 'call_to_arms', 'auto_join'],
    },
    {
        key: 'investmentPolicy',
        label: '投资政策',
        icon: 'BarChart2',
        color: 'text-yellow-400',
        defs: INVESTMENT_POLICY_DEFINITIONS,
        order: ['autonomous', 'guided', 'forced'],
    },
];

const VassalBatchSheet = memo(({ isOpen, onClose, nations = [], onDiplomaticAction }) => {
    const vassalNations = nations.filter(n => n.vassalOf === 'player' && !n.isAnnexed);
    const vassalCount = vassalNations.length;

    // 记录各维度草稿值
    const [batchPolicy, setBatchPolicy] = React.useState({});
    // 记录哪些维度被勾选（将被应用）
    const [enabledFields, setEnabledFields] = React.useState(new Set());
    // 朝贡率草稿（相对于基础值的百分比，50~150）
    const [tributePct, setTributePct] = React.useState(100);
    const [tributeEnabled, setTributeEnabled] = React.useState(false);
    const [feedback, setFeedback] = React.useState('');

    const showFeedback = (msg) => {
        setFeedback(msg);
        setTimeout(() => setFeedback(''), 2500);
    };

    const handleClose = () => {
        setBatchPolicy({});
        setEnabledFields(new Set());
        setTributePct(100);
        setTributeEnabled(false);
        setFeedback('');
        onClose();
    };

    const toggleField = (key) => {
        setEnabledFields(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const setDimValue = (key, value) => {
        setBatchPolicy(prev => ({ ...prev, [key]: value }));
        // 选择值时自动勾选该维度
        setEnabledFields(prev => {
            const next = new Set(prev);
            next.add(key);
            return next;
        });
    };

    const handleApply = () => {
        if (vassalCount === 0) { showFeedback('❌ 当前没有附属国'); return; }
        if (enabledFields.size === 0 && !tributeEnabled) { showFeedback('❌ 请至少选择一项要应用的政策'); return; }

        // 构建要应用的 policy 对象
        const filteredPolicy = {};
        enabledFields.forEach(key => {
            if (batchPolicy[key] !== undefined) {
                filteredPolicy[key] = batchPolicy[key];
            }
        });

        // 朝贡率：以基础值 0.1 为参考，范围 50%~150% → 0.05~0.15
        if (tributeEnabled) {
            const baseTributeRate = 0.1;
            filteredPolicy.tributeRate = baseTributeRate * (tributePct / 100);
        }

        if (Object.keys(filteredPolicy).length === 0) { showFeedback('❌ 请先为已勾选的维度选择值'); return; }

        vassalNations.forEach(n => {
            onDiplomaticAction?.(n.id, 'adjust_vassal_policy', { policy: filteredPolicy });
        });

        const policyKeys = Object.keys(filteredPolicy).join('、');
        showFeedback(`✅ 已对 ${vassalCount} 个附属国批量应用：${policyKeys}`);
    };

    const selectAllDims = () => {
        const allKeys = VASSAL_POLICY_DIMS.map(d => d.key);
        setEnabledFields(new Set(allKeys));
        setTributeEnabled(true);
    };
    const clearAllDims = () => {
        setEnabledFields(new Set());
        setTributeEnabled(false);
    };

    return (
        <BottomSheet isOpen={isOpen} onClose={handleClose} title="👑 附属国批量政策">
            <div className="space-y-4 p-1">
                {/* 反馈提示 */}
                {feedback && (
                    <div className="text-center text-sm text-green-300 bg-green-900/30 border border-green-700/40 rounded-lg py-2 px-3">
                        {feedback}
                    </div>
                )}

                {/* 附属国数量提示 */}
                <div className="flex items-center justify-between bg-purple-900/20 border border-purple-700/30 rounded-xl p-3">
                    <div className="flex items-center gap-2">
                        <Icon name="Crown" size={16} className="text-purple-400" />
                        <span className="text-sm font-bold text-purple-300">当前附属国</span>
                    </div>
                    <span className="text-lg font-bold text-white">{vassalCount} 个</span>
                </div>

                {vassalCount === 0 && (
                    <div className="text-center text-gray-400 text-sm py-4">
                        <Icon name="ShieldQuestion" size={32} className="mx-auto mb-2 opacity-50" />
                        暂无附属国，无法批量设置
                    </div>
                )}

                {vassalCount > 0 && (
                    <>
                        <p className="text-xs text-gray-400 leading-relaxed">
                            勾选要修改的维度，选择目标值，点击"批量应用"后将统一应用到所有 {vassalCount} 个附属国。
                        </p>

                        <div className="flex gap-2">
                            <button onClick={selectAllDims} className="flex-1 py-1.5 text-xs bg-gray-700/50 hover:bg-gray-600/60 border border-gray-600/50 text-gray-300 rounded-lg transition-colors">全选</button>
                            <button onClick={clearAllDims} className="flex-1 py-1.5 text-xs bg-gray-700/50 hover:bg-gray-600/60 border border-gray-600/50 text-gray-300 rounded-lg transition-colors">清除</button>
                        </div>

                        {/* 各维度选择器 */}
                        <div className="space-y-2">
                            {VASSAL_POLICY_DIMS.map(dim => {
                                const defs = dim.defs || {};
                                const isEnabled = enabledFields.has(dim.key);
                                const currentVal = batchPolicy[dim.key];
                                const options = dim.order.filter(k => defs[k]);
                                return (
                                    <div key={dim.key} className={`rounded-xl border p-3 transition-colors ${isEnabled ? 'border-ancient-gold/40 bg-gray-800/50' : 'border-gray-700/40 bg-gray-900/30 opacity-70'}`}>
                                        <div className="flex items-center gap-2 mb-2">
                                            <button
                                                onClick={() => toggleField(dim.key)}
                                                className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${isEnabled ? 'bg-yellow-500/80 border-yellow-400' : 'bg-gray-700 border-gray-500'}`}
                                            >
                                                {isEnabled && <Icon name="Check" size={10} className="text-white" />}
                                            </button>
                                            <Icon name={dim.icon} size={13} className={dim.color} />
                                            <span className="text-sm font-semibold text-gray-200">{dim.label}</span>
                                            {currentVal && (
                                                <span className="ml-auto text-xs text-ancient-gold bg-ancient-gold/10 px-2 py-0.5 rounded-full">
                                                    {defs[currentVal]?.name || currentVal}
                                                </span>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                                            {options.map(optKey => {
                                                const def = defs[optKey];
                                                if (!def) return null;
                                                const isSelected = currentVal === optKey;
                                                return (
                                                    <button
                                                        key={optKey}
                                                        onClick={() => setDimValue(dim.key, optKey)}
                                                        className={`text-left px-2 py-1.5 rounded-lg border text-xs transition-colors ${isSelected ? 'bg-ancient-gold/20 border-ancient-gold/60 text-ancient-parchment' : 'bg-gray-800/60 border-gray-700/50 text-gray-400 hover:border-gray-600 hover:text-gray-300'}`}
                                                    >
                                                        <div className="font-semibold">{def.name}</div>
                                                        {def.description && <div className="text-gray-500 mt-0.5 leading-tight text-xs">{def.description.slice(0, 20)}{def.description.length > 20 ? '…' : ''}</div>}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}

                            {/* 朝贡率滑块 */}
                            <div className={`rounded-xl border p-3 transition-colors ${tributeEnabled ? 'border-ancient-gold/40 bg-gray-800/50' : 'border-gray-700/40 bg-gray-900/30 opacity-70'}`}>
                                <div className="flex items-center gap-2 mb-2">
                                    <button
                                        onClick={() => setTributeEnabled(p => !p)}
                                        className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${tributeEnabled ? 'bg-yellow-500/80 border-yellow-400' : 'bg-gray-700 border-gray-500'}`}
                                    >
                                        {tributeEnabled && <Icon name="Check" size={10} className="text-white" />}
                                    </button>
                                    <Icon name="Coins" size={13} className="text-yellow-400" />
                                    <span className="text-sm font-semibold text-gray-200">朝贡率</span>
                                    <span className="ml-auto text-xs text-ancient-gold font-mono">{tributePct}% 基础值</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs text-gray-500 flex-shrink-0">50%</span>
                                    <input
                                        type="range"
                                        min={50}
                                        max={150}
                                        step={5}
                                        value={tributePct}
                                        onChange={e => { setTributePct(Number(e.target.value)); setTributeEnabled(true); }}
                                        className="flex-grow accent-yellow-500"
                                    />
                                    <span className="text-xs text-gray-500 flex-shrink-0">150%</span>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">基础朝贡率约为 GDP 增量的 10%，此处调整其倍率</p>
                            </div>
                        </div>

                        {/* 应用按钮 */}
                        <button
                            onClick={handleApply}
                            disabled={vassalCount === 0}
                            className="w-full py-3 bg-purple-700/60 hover:bg-purple-600/70 disabled:opacity-50 disabled:cursor-not-allowed border border-purple-600/50 text-purple-100 text-sm rounded-xl font-bold transition-colors active:scale-95 flex items-center justify-center gap-2"
                        >
                            <Icon name="Layers" size={16} />
                            批量应用到 {vassalCount} 个附属国
                        </button>
                    </>
                )}
            </div>
        </BottomSheet>
    );
});
VassalBatchSheet.displayName = 'VassalBatchSheet';

/**
 * 外交界面主布局 (DiplomacyLayout)
 * 管理左侧国家列表和右侧详细视图的布局
 * 负责移动端/桌面端的响应式切换
 */
const DiplomacyLayout = ({
    nations,
    visibleNations,
    selectedNationId,
    onSelectNation,
    selectedNation,
    gameState,
    relationInfo,

    // Context Props
    epoch,
    market,
    resources,
    daysElapsed,
    diplomaticCooldownMod,
    diplomacyOrganizations,
    overseasInvestments,
    foreignInvestments,
    tradeOpportunities,

    // Actions Handlers
    onDiplomaticAction,
    onNegotiate,
    onManageTrade,
    onManageInternationalEconomy,
    onDeclareWar,
    onProvoke,

    // Sub-Actions Handlers
    onOverseasInvestment,
    merchantState,
    onMerchantStateChange,

    // Organization Actions
    onViewOrganization,

    // Vassal diplomacy controls
    vassalDiplomacyQueue = [],
    vassalDiplomacyHistory = [],
    onApproveVassalDiplomacy,
    onRejectVassalDiplomacy,
    onIssueVassalOrder,
}) => {
    // 移动端视图控制
    const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);

    // 附庸管理面板状态
    const [vassalSheetOpen, setVassalSheetOpen] = useState(false);
    const [vassalSheetNationId, setVassalSheetNationId] = useState(null);

    // 附属国批量政策面板状态
    const [vassalBatchOpen, setVassalBatchOpen] = useState(false);

    // 实时获取最新的附庸国数据
    const vassalSheetNation = vassalSheetNationId
        ? nations.find(n => n.id === vassalSheetNationId)
        : null;

    // [PERF] 附庸管理面板使用快照，避免每帧随主循环重渲染
    const [vassalSheetSnapshot, setVassalSheetSnapshot] = useState(null);

    const buildVassalSnapshot = useCallback((nationId) => {
        if (!nationId) return null;
        const nation = nations.find(n => n.id === nationId) || null;
        const playerResources = resources || {};
        const playerWealth = playerResources.silver || gameState?.silver || 10000;
        const playerPopulation = gameState?.population || 1000000;
        
        // [DEBUG] 调试日志
        console.log(`%c🔵 [buildVassalSnapshot] ${nation?.name}`, 'color: blue; font-weight: bold', {
            playerWealth,
            'resources.silver': playerResources.silver,
            'gameState.silver': gameState?.silver,
            playerPopulation,
            vassalWealth: nation?.wealth,
        });
        
        const officials = gameState?.officials || [];
        const army = gameState?.army || {};
        const totalUnits = Object.values(army).reduce((sum, count) => sum + (count || 0), 0);
        const baseStrength = Math.max(0.5, totalUnits / 100);
        const garrisonFactor = INDEPENDENCE_CONFIG?.controlMeasures?.garrison?.militaryCommitmentFactor || 0;
        const garrisonCommitment = (nations || []).reduce((sum, n) => {
            if (n.vassalOf !== 'player') return sum;
            const garrison = n.vassalPolicy?.controlMeasures?.garrison;
            const isActive = garrison === true || (garrison && garrison.active !== false);
            if (!isActive) return sum;
            const vassalStrength = n.militaryStrength || 0.5;
            return sum + (vassalStrength * garrisonFactor);
        }, 0);
        const playerMilitary = Math.max(0.1, baseStrength - garrisonCommitment);

        return {
            nation,
            playerResources,
            playerWealth,
            playerPopulation,
            officials,
            playerMilitary,
            difficultyLevel: gameState?.difficulty || 'normal',
            nations,
            diplomacyOrganizations,
            vassalDiplomacyQueue,
            vassalDiplomacyHistory,
            currentDay: daysElapsed,
            epoch,
        };
    }, [
        nations,
        resources,
        gameState?.silver,
        gameState?.population,
        gameState?.officials,
        gameState?.army,
        gameState?.difficulty,
        diplomacyOrganizations,
        vassalDiplomacyQueue,
        vassalDiplomacyHistory,
        daysElapsed,
        epoch,
    ]);

    useEffect(() => {
        if (!vassalSheetOpen || !vassalSheetNationId) {
            setVassalSheetSnapshot(null);
            return;
        }

        setVassalSheetSnapshot(buildVassalSnapshot(vassalSheetNationId));

        const interval = setInterval(() => {
            setVassalSheetSnapshot(buildVassalSnapshot(vassalSheetNationId));
        }, 800);

        return () => clearInterval(interval);
    }, [vassalSheetOpen, vassalSheetNationId, buildVassalSnapshot]);

    // 附庸概览面板状态
    const [vassalOverviewOpen, setVassalOverviewOpen] = useState(false);

    // 打开附庸管理面板
    const handleOpenVassalSheet = (nation) => {
        setVassalSheetNationId(nation?.id);
        setVassalSheetOpen(true);
    };

    // 打开附庸概览面板
    const handleOpenVassalOverview = () => {
        setVassalOverviewOpen(true);
    };

    // 从附庸概览选择某个附庸后，打开详细管理
    const handleSelectVassal = (nation) => {
        setVassalOverviewOpen(false);
        setVassalSheetNationId(nation?.id);
        setVassalSheetOpen(true);
    };

    const handleApplyVassalPolicy = useCallback((nationId, policy) => {
        onDiplomaticAction?.(nationId, 'adjust_vassal_policy', { policy });
    }, [onDiplomaticAction]);

    // 当选中国家时，移动端自动打开详情页
    useEffect(() => {
        if (selectedNationId) {
            setIsMobileDetailOpen(true);
        }
    }, [selectedNationId]);

    // 处理返回列表（移动端）
    const handleBackToList = () => {
        setIsMobileDetailOpen(false);
        onSelectNation(null);
    };

    return (
        <div className="flex h-full gap-4 relative overflow-hidden">
            {/* 左侧：国家列表 */}
            <div className={`
                flex-shrink-0 w-full md:w-1/3 lg:w-80 h-full flex flex-col transition-all duration-300
                ${isMobileDetailOpen ? 'hidden md:flex' : 'flex'}
            `}>
                <NationList
                    nations={nations}
                    visibleNations={visibleNations}
                    selectedNationId={selectedNationId}
                    onSelectNation={(id) => {
                        onSelectNation(id);
                        setIsMobileDetailOpen(true);
                    }}
                    relationInfo={relationInfo}
                    diplomacyOrganizations={diplomacyOrganizations}
                    diplomacyRequests={vassalDiplomacyQueue} // [NEW] Pass queue for notifications
                />
            </div>

            {/* 右侧：详细视图/仪表盘 */}
            <div className={`
                flex-1 h-full min-w-0 transition-all duration-300 relative flex flex-col
                ${!isMobileDetailOpen ? 'hidden md:flex' : 'flex'}
            `}>
                {isMobileDetailOpen && (
                    <div className="md:hidden flex items-center mb-2 px-1 relative z-50">
                        <button
                            onClick={handleBackToList}
                            className={`flex items-center gap-1 text-ancient-gold font-bold px-3 py-2 rounded-lg border border-ancient-gold/30 ${COLORS.background.glass}`}
                        >
                            <Icon name="ArrowLeft" size={16} />
                            <span>返回列表</span>
                        </button>
                    </div>
                )}

                <div className="mb-2 rounded-lg border border-theme-border bg-theme-surface-trans px-3 py-2 flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-1.5">
                    <div className="text-xs uppercase tracking-wider text-theme-text opacity-70 font-bold sm:flex-none">
                        全局事务
                    </div>
                    <div className="grid grid-cols-1 gap-1.5 sm:ml-auto sm:flex sm:flex-wrap sm:justify-end">
                        <Button size="sm" variant="secondary" onClick={onManageTrade} className="w-full sm:w-auto">
                            商人派驻
                        </Button>
                        <Button size="sm" variant="secondary" onClick={onManageInternationalEconomy} className="w-full sm:w-auto">
                            国际经济概览
                        </Button>
                        <Button size="sm" variant="secondary" onClick={handleOpenVassalOverview} className="w-full sm:w-auto">
                            <Icon name="Crown" size={14} className="mr-1" />
                            附庸管理
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => setVassalBatchOpen(true)} className="w-full sm:w-auto">
                            <Icon name="Layers" size={14} className="mr-1" />
                            批量政策
                        </Button>
                    </div>
                </div>

                {selectedNationId && selectedNation ? (
                    <NationDetailView
                        nation={selectedNation}
                        gameState={gameState}
                        nations={nations}  // Pass nations array for AI-AI war lookup
                        epoch={epoch}
                        market={market}
                        resources={resources}
                        daysElapsed={daysElapsed}
                        relationInfo={relationInfo}
                        diplomaticCooldownMod={diplomaticCooldownMod}

                        onDiplomaticAction={onDiplomaticAction}
                        onNegotiate={onNegotiate}
                        onDeclareWar={onDeclareWar}
                        onProvoke={onProvoke}

                        onOverseasInvestment={onOverseasInvestment}
                        onOpenVassalSheet={handleOpenVassalSheet}
                        diplomacyOrganizations={diplomacyOrganizations}
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
                        popStructure={gameState?.popStructure} // Ensure popStructure is passed
                        overseasInvestments={overseasInvestments}
                        foreignInvestments={foreignInvestments}
                        taxPolicies={gameState?.taxPolicies}
                    />
                ) : (
                    <DiplomacyDashboard
                        nations={nations}
                        diplomacyOrganizations={diplomacyOrganizations}
                        overseasInvestments={overseasInvestments}
                        onSelectNation={onSelectNation}
                        epoch={epoch}
                        gameState={gameState}
                        market={market}
                        silver={resources?.silver || 0}
                        resources={resources}
                        daysElapsed={daysElapsed}
                        tradeOpportunities={tradeOpportunities}
                        onDiplomaticAction={onDiplomaticAction}
                        onViewOrganization={onViewOrganization}
                    />
                )}
            </div>

            {/* 附庸管理 Bottom Sheet */}
            <VassalManagementSheet
                isOpen={vassalSheetOpen}
                onClose={() => setVassalSheetOpen(false)}
                nation={vassalSheetSnapshot?.nation || vassalSheetNation}
                playerResources={vassalSheetSnapshot?.playerResources || resources}
                playerWealth={vassalSheetSnapshot?.playerWealth || (resources?.silver || gameState?.silver || 10000)}
                playerPopulation={vassalSheetSnapshot?.playerPopulation || (gameState?.population || 1000000)}
                onApplyVassalPolicy={handleApplyVassalPolicy}
                onDiplomaticAction={onDiplomaticAction}
                officials={vassalSheetSnapshot?.officials || gameState?.officials || []}
                playerMilitary={vassalSheetSnapshot?.playerMilitary ?? 1.0}
                epoch={vassalSheetSnapshot?.epoch ?? epoch}
                difficultyLevel={vassalSheetSnapshot?.difficultyLevel || (gameState?.difficulty || 'normal')}
                // 外交审批相关 props
                nations={vassalSheetSnapshot?.nations || nations}
                diplomacyOrganizations={vassalSheetSnapshot?.diplomacyOrganizations || diplomacyOrganizations}
                vassalDiplomacyQueue={vassalSheetSnapshot?.vassalDiplomacyQueue || vassalDiplomacyQueue}
                vassalDiplomacyHistory={vassalSheetSnapshot?.vassalDiplomacyHistory || vassalDiplomacyHistory}
                currentDay={vassalSheetSnapshot?.currentDay ?? daysElapsed}
                onApproveVassalDiplomacy={onApproveVassalDiplomacy}
                onRejectVassalDiplomacy={onRejectVassalDiplomacy}
                onIssueVassalOrder={onIssueVassalOrder}
            />

            {/* 附庸概览 Bottom Sheet */}
            <VassalOverviewPanel
                isOpen={vassalOverviewOpen}
                onClose={() => setVassalOverviewOpen(false)}
                nations={nations}
                playerResources={resources}
                onSelectVassal={handleSelectVassal}
                onAdjustPolicy={handleSelectVassal}
                onReleaseVassal={(nation) => onDiplomaticAction?.(nation.id, 'release_vassal')}
            />

            {/* 附属国批量政策 Bottom Sheet */}
            <VassalBatchSheet
                isOpen={vassalBatchOpen}
                onClose={() => setVassalBatchOpen(false)}
                nations={nations}
                onDiplomaticAction={onDiplomaticAction}
            />


        </div>
    );
};

export default DiplomacyLayout;
