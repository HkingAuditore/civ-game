import React, { useState, useEffect, useCallback } from 'react';
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
    tradeRoutes,
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
                            className={`flex items-center gap-1 text-ancient-gold font-bold px-3 py-1.5 rounded-lg border border-ancient-gold/30 ${COLORS.background.glass}`}
                        >
                            <Icon name="ArrowLeft" size={16} />
                            <span>返回列表</span>
                        </button>
                    </div>
                )}

                <div className="mb-2 rounded-lg border border-theme-border bg-theme-surface-trans px-2.5 py-1.5 flex flex-wrap items-center gap-1.5">
                    <div className="text-[9px] uppercase tracking-wider text-theme-text opacity-70 font-bold">
                        全局事务
                    </div>
                    <div className="ml-auto flex flex-wrap gap-1.5">
                        <Button size="sm" variant="secondary" onClick={onManageTrade}>
                            商人派驻
                        </Button>
                        <Button size="sm" variant="secondary" onClick={onManageInternationalEconomy}>
                            国际经济概览
                        </Button>
                        <Button size="sm" variant="secondary" onClick={handleOpenVassalOverview}>
                            <Icon name="Crown" size={14} className="mr-1" />
                            附庸管理
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
                        tradeRoutes={tradeRoutes}
                        merchantState={merchantState}
                        onMerchantStateChange={onMerchantStateChange}
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
                        tradeRoutes={tradeRoutes}
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


        </div>
    );
};

export default DiplomacyLayout;
