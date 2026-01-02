
import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { OfficialCard } from './OfficialCard';
import { Icon } from '../../common/UIComponents';
import { calculateTotalDailySalary, getCabinetStatus } from '../../../logic/officials/manager';
import { isStanceSatisfied } from '../../../config/politicalStances';
import { CabinetSynergyDisplay } from './CabinetSynergyDisplay';
import { PlannedEconomyPanel } from './PlannedEconomyPanel';
import { FreeMarketPanel } from './FreeMarketPanel';
import { ReformDecreePanel } from './ReformDecreePanel';
import { DOMINANCE_EFFECTS, DOMINANCE_MIN_EPOCH } from '../../../logic/officials/cabinetSynergy';
import { EPOCHS } from '../../../config/epochs';

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
    onUpdateQuotas,
    onUpdateExpansionSettings,
    onEnactDecree,

    // [NEW] 额外上下文和详细容量
    jobCapacity = 0,
    maxCapacity = 3,
    stanceContext = {},
    prices = {},  // [NEW] 市场价格用于自由市场面板

    // [NEW] 价格管制相关
    priceControls = { enabled: false, governmentBuyPrices: {}, governmentSellPrices: {} },
    onUpdatePriceControls,
}) => {

    // 派系面板弹窗状态
    const [showDominancePanel, setShowDominancePanel] = useState(false);

    // Derived state
    const currentCount = officials.length;
    const isAtCapacity = currentCount >= capacity;
    const daysSinceSelection = currentTick - lastSelectionDay;
    const selectionReady = lastSelectionDay === 0 || daysSinceSelection >= selectionCooldown;
    const daysRemaining = Math.max(0, selectionCooldown - daysSinceSelection);

    const totalDailySalary = useMemo(() => calculateTotalDailySalary(officials), [officials]);
    const canAffordSalaries = (resources?.silver || 0) >= totalDailySalary;

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
                                {totalDailySalary} <Icon name="Coins" size={14} className="text-yellow-500" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. 内阁协同度显示 */}
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
                {officials.length === 0 ? (
                    <div className="text-center py-10 bg-gray-800/20 rounded-lg border border-dashed border-gray-700 text-gray-500">
                        <Icon name="UserX" size={32} className="mx-auto mb-2 opacity-50" />
                        <p className="text-sm">当前没有在任官员。</p>
                        <p className="text-xs opacity-70">雇佣候选人以获得加成。</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {officials.map(official => (
                            <OfficialCard
                                key={official.id}
                                official={official}
                                isCandidate={false}
                                onAction={onFire}
                                onDispose={onDispose}

                                currentDay={currentTick}
                                isStanceSatisfied={official.politicalStance ? isStanceSatisfied(official.politicalStance, stanceContext, official.stanceConditionParams) : null}
                            />
                        ))}
                    </div>
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
                                />
                            )}
                            {dominantPanel === 'reformDecree' && (
                                <ReformDecreePanel
                                    activeDecrees={activeDecrees}
                                    decreeCooldowns={decreeCooldowns}
                                    currentDay={currentTick}
                                    silver={resources?.silver || 0}
                                    onEnactDecree={onEnactDecree}
                                />
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}

        </div>
    );
};
