// 文明崛起 - 主应用文件
// 使用拆分后的钩子和组件，保持代码简洁

import React, { useEffect, useRef, useState } from 'react';
import { GAME_SPEEDS, EPOCHS, RESOURCES, STRATA, calculateArmyFoodNeed, BUILDINGS, EVENTS } from './config';
import { getCalendarInfo } from './utils/calendar';
import { useGameState, useGameLoop, useGameActions, useSound, useEpicTheme } from './hooks';
import {
    Icon,
    FloatingText
} from './components/common/UIComponents';
import { BattleNotification } from './components/common/BattleNotification';
import { EpicCard, DiamondDivider, AncientPattern } from './components/common/EpicDecorations';
import { AnimatePresence, motion } from 'framer-motion';
import { StatusBar } from './components/layout/StatusBar';
import { EraBackground } from './components/layout/EraBackground';
import { BottomNav } from './components/layout/BottomNav';
import { GameControls } from './components/layout/GameControls';
import { BottomSheet } from './components/tabs/BottomSheet';
import { BuildingDetails } from './components/tabs/BuildingDetails';
import {
    StrataPanel,
    StratumDetailSheet,
    LogPanel,
    SettingsPanel,
    EmpireScene,
    BuildTab,
    MilitaryTab,
    ResourcePanel,
    TechTab,
    PoliticsTab,
    DiplomacyTab,
    BattleResultModal,
    StratumDetailModal,
    ResourceDetailModal,
    PopulationDetailModal,
    AnnualFestivalModal,
    TutorialModal,
    WikiModal,
} from './components';
import { UnitDetailSheet } from './components/panels/UnitDetailSheet';
import { TechDetailSheet } from './components/panels/TechDetailSheet';
import { DecreeDetailSheet } from './components/panels/DecreeDetailSheet';
import { EventDetail } from './components/modals/EventDetail';
import { executeStrategicAction, STRATEGIC_ACTIONS } from './logic/strategicActions';
import { getOrganizationStage, getPhaseFromStage } from './logic/organizationSystem';
import { createPromiseTask, PROMISE_CONFIG } from './logic/promiseTasks';

/**
 * 文明崛起主应用组件
 * 整合所有游戏系统和UI组件
 */
export default function App() {
    // 使用自定义钩子管理状态
    const gameState = useGameState();

    // 调试：检查gameState是否正确初始化（所有 Hooks 调用完毕后再进行条件判断）
    if (!gameState) {
        console.error('gameState is null or undefined');
        return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
            <div className="text-center">
                <h1 className="text-2xl font-bold mb-4">游戏状态初始化失败</h1>
                <p>请检查浏览器控制台获取更多信息</p>
            </div>
        </div>;
    }

    // 将所有依赖 gameState 的逻辑移到这个组件中
    return <GameApp gameState={gameState} />;
}

/**
 * 游戏主应用渲染组件
 * 仅在 gameState 初始化成功后渲染
 */
function GameApp({ gameState }) {
    // 应用史诗主题
    const epicTheme = useEpicTheme(gameState.epoch);

    // 添加日志函数
    const addLog = (msg) => {
        if (gameState?.setLogs) {
            gameState.setLogs(prev => [msg, ...prev].slice(0, 8));
        }
    };

    const formatFestivalEffects = (effects) => {
        if (!effects) return '无特殊效果。';

        const formatValue = (key, value) => {
            const positive = value > 0 ? '+' : '';
            if (['production', 'industry', 'cultureBonus', 'scienceBonus', 'taxIncome', 'militaryBonus', 'stability'].includes(key)) {
                return `${positive}${(value * 100).toFixed(0)}%`;
            }
            return `${positive}${value}`;
        };

        const effectStrings = Object.entries(effects).map(([key, value]) => {
            switch (key) {
                case 'categories':
                    return Object.entries(value).map(([cat, val]) => {
                        const catName = BUILDINGS.find(b => b.category === cat)?.categoryName || cat;
                        return `${catName}类建筑产出 ${formatValue(key, val)}`;
                    }).join('，');
                case 'maxPop':
                    return `人口上限 ${formatValue(key, value)}`;
                default:
                    const label = {
                        production: '全局生产',
                        industry: '工业产出',
                        cultureBonus: '文化产出',
                        scienceBonus: '科研产出',
                        taxIncome: '税收收入',
                        militaryBonus: '军事力量',
                        stability: '稳定度',
                    }[key] || key;
                    return `${label} ${formatValue(key, value)}`;
            }
        });

        return effectStrings.join('；');
    };

    // 现在 gameState 肯定存在，可以安全调用这些钩子
    const actions = useGameActions(gameState, addLog);
    useGameLoop(gameState, addLog, actions);
    const { playSound, SOUND_TYPES } = useSound();
    const [showStrata, setShowStrata] = useState(false);
    const lastEventCheckDayRef = useRef(null);
    const [showMarket, setShowMarket] = useState(false);  // 新增：控制国内市场弹窗
    const [expandedFestival, setExpandedFestival] = useState(null);

    // 事件系统：按游戏内天数定期触发随机事件
    useEffect(() => {
        const currentDay = gameState.daysElapsed || 0;

        // 初始化参考天数（避免刚载入就立刻触发）
        if (lastEventCheckDayRef.current == null) {
            lastEventCheckDayRef.current = currentDay;
            return;
        }

        // 游戏暂停或已有事件时不触发新的随机事件
        if (gameState.isPaused || gameState.currentEvent) return;

        const deltaDays = currentDay - lastEventCheckDayRef.current;

        // 每经过 20 个游戏内日检查一次，并以 10% 概率触发事件
        if (deltaDays >= 30) {
            lastEventCheckDayRef.current = currentDay;
            if (Math.random() < 0.1) {
                actions.triggerRandomEvent();
            }
        }
    }, [gameState.daysElapsed, gameState.isPaused, gameState.currentEvent, actions]);


    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isWikiOpen, setIsWikiOpen] = useState(false);
    const [showEmpireScene, setShowEmpireScene] = useState(false);
    const [activeSheet, setActiveSheet] = useState({ type: null, data: null });

    // 处理庆典效果选择
    const handleFestivalSelect = (selectedEffect) => {
        if (!selectedEffect) return;

        // 添加到激活的庆典效果列表
        const effectWithTimestamp = {
            ...selectedEffect,
            activatedAt: gameState.daysElapsed || 0,
        };

        gameState.setActiveFestivalEffects(prev => [...prev, effectWithTimestamp]);

        // 关闭模态框
        gameState.setFestivalModal(null);

        // 恢复事件触发前的暂停状态
        gameState.setIsPaused(gameState.pausedBeforeEvent);

        // 添加日志
        const effectType = selectedEffect.type === 'permanent' ? '永久' : '短期';
        const effectsDetail = formatFestivalEffects(selectedEffect.effects);
        addLog(`🎊 庆典「${selectedEffect.name}」(${effectType})激活：${effectsDetail}`);
    };

    // 处理事件选项选择
    const handleEventOption = (eventId, option) => {
        const selectedOption = option || {};
        const currentEvent =
            gameState.currentEvent && gameState.currentEvent.id === eventId
                ? gameState.currentEvent
                : null;
        const fallbackEvent = currentEvent || EVENTS.find(evt => evt.id === eventId);
        const eventName = fallbackEvent?.name;
        const optionText = selectedOption.text;

        actions.handleEventOption(eventId, option);
        playSound(SOUND_TYPES.CLICK);
        // 恢复事件触发前的暂停状态，而不是无条件取消暂停
        gameState.setIsPaused(gameState.pausedBeforeEvent);

        if (eventName) {
            const detail = optionText ? `「${optionText}」` : '所选方案';
            addLog(`📜 事件「${eventName}」已执行${detail}`);
        } else if (optionText) {
            addLog(`📜 已执行事件选项「${optionText}」`);
        }
    };

    // 处理教程完成
    const handleTutorialComplete = () => {
        gameState.setShowTutorial(false);
        localStorage.setItem('tutorial_completed', 'true');
        addLog('🎓 新手引导完成！祝你建立伟大的文明！');
    };

    // 处理跳过教程
    const handleTutorialSkip = () => {
        gameState.setShowTutorial(false);
        localStorage.setItem('tutorial_completed', 'true');
        addLog('ℹ️ 已跳过教程，可以在右侧查看统治指南。');
    };

    // 重新打开教程
    const handleReopenTutorial = () => {
        gameState.setShowTutorial(true);
        addLog('📖 重新打开新手教程');
    };

    // 手动采集函数
    const manualGather = (e) => {
        gameState.setClicks(prev => [...prev, {
            id: Date.now(),
            x: e.clientX,
            y: e.clientY,
            text: "+1",
            color: "text-white"
        }]);
        gameState.setResources(prev => ({
            ...prev,
            silver: (prev.silver || 0) + 1
        }));
    };

    // 新增：处理显示建筑详情的函数
    const handleShowBuildingDetails = (buildingId) => {
        const building = BUILDINGS.find(b => b.id === buildingId);
        if (building) {
            setActiveSheet({ type: 'building', data: building });
        }
    };

    // 新增：关闭 BottomSheet 的函数
    const closeSheet = () => setActiveSheet({ type: null, data: null });

    // 处理阶层详情点击
    const handleStratumDetailClick = (stratumKey) => {
        setActiveSheet({ type: 'stratum', data: stratumKey });
    };

    // 处理军事单位详情点击
    const handleShowUnitDetails = (unit) => {
        setActiveSheet({ type: 'unit', data: unit });
    };

    // 处理科技详情点击
    const handleShowTechDetails = (tech, status) => {
        setActiveSheet({ type: 'tech', data: { tech, status } });
    };

    // 处理政策详情点击
    const handleShowDecreeDetails = (decree) => {
        setActiveSheet({ type: 'decree', data: decree });
    };

    const estimateMilitaryPower = () => {
        const army = gameState.army || {};
        const totalUnits = Object.values(army).reduce((sum, count) => sum + (count || 0), 0);
        let capacity = 0;
        Object.entries(gameState.buildings || {}).forEach(([buildingId, count]) => {
            if (!count) return;
            const building = BUILDINGS.find(b => b.id === buildingId);
            if (building?.output?.militaryCapacity) {
                capacity += building.output.militaryCapacity * count;
            }
        });
        if (capacity <= 0) {
            return totalUnits > 0 ? 0.5 : 0;
        }
        return Math.min(1, totalUnits / capacity);
    };

    const clampOrganization = (value) => Math.max(0, Math.min(100, value ?? 0));

    // 处理策略行动
    const handleStrategicAction = (actionId, stratumKey) => {
        console.log('[STRATEGIC ACTION] Executing:', actionId, 'on', stratumKey);

        const action = STRATEGIC_ACTIONS[actionId];
        if (!action) {
            addLog(`❌无效的策略行动 ${actionId}`);
            return;
        }

        const stratumName = STRATA[stratumKey]?.name || stratumKey;
        const cooldownKey = `${actionId}_${stratumKey}`;

        // 构建简化的游戏状况用于检查
        const simpleGameState = {
            resources: gameState.resources,
            organizationStates: gameState.rebellionStates,
            popStructure: gameState.popStructure,
            actionCooldowns: gameState.actionCooldowns || {},
            actionUsage: gameState.actionUsage || {},
            population: gameState.population || 0,
            militaryPower: estimateMilitaryPower(),
            classApproval: gameState.classApproval || {},
            classInfluence: gameState.classInfluence || {},
            nations: gameState.nations || [],
        };

        // 执行策略行动
        const result = executeStrategicAction(actionId, stratumKey, simpleGameState);

        if (!result.success) {
            addLog(`❌${stratumName}: ${result.message}`);
            return;
        }

        // 扣除资源
        if (result.effects.resourceCost) {
            gameState.setResources(prev => {
                const newRes = { ...prev };
                if (result.effects.resourceCost.silver) {
                    newRes.silver = Math.max(0, (newRes.silver || 0) - result.effects.resourceCost.silver);
                }
                if (result.effects.resourceCost.culture) {
                    newRes.culture = Math.max(0, (newRes.culture || 0) - result.effects.resourceCost.culture);
                }
                return newRes;
            });
        }

        if (action.cooldown > 0) {
            gameState.setActionCooldowns(prev => ({
                ...(prev || {}),
                [cooldownKey]: action.cooldown,
            }));
        }
        gameState.setActionUsage(prev => ({
            ...(prev || {}),
            [cooldownKey]: ((prev && prev[cooldownKey]) || 0) + 1,
        }));

        if ((result.effects.organizationChanges && Object.keys(result.effects.organizationChanges).length > 0) || result.effects.resistanceChange) {
            gameState.setRebellionStates(prev => {
                const newStates = { ...prev };

                // 处理组织度变化
                if (result.effects.organizationChanges) {
                    Object.entries(result.effects.organizationChanges).forEach(([key, change]) => {
                        const currentState = newStates[key] || {};
                        const nextValue = clampOrganization((currentState.organization || 0) + change);
                        const stage = getOrganizationStage(nextValue);
                        newStates[key] = {
                            ...currentState,
                            organization: nextValue,
                            stage,
                            phase: getPhaseFromStage(stage),
                        };
                    });
                }

                // 处理抵抗力增加
                if (result.effects.resistanceChange) {
                    const key = stratumKey; // 抵抗力应用到当前目标阶层
                    const currentState = newStates[key] || {};
                    const currentResistance = currentState.resistance || 0;
                    newStates[key] = {
                        ...currentState,
                        resistance: Math.min(100, currentResistance + result.effects.resistanceChange),
                    };
                }

                return newStates;
            });
        }

        if (Array.isArray(result.effects.specialEffects)) {
            result.effects.specialEffects.forEach(effect => {
                if (!effect) return;
                if (effect.type === 'organizationPause' && effect.stratum && effect.duration) {
                    gameState.setRebellionStates(prev => ({
                        ...prev,
                        [effect.stratum]: {
                            ...(prev?.[effect.stratum] || {}),
                            organizationPaused: Math.max(effect.duration, prev?.[effect.stratum]?.organizationPaused || 0),
                        },
                    }));
                } else if (effect.type === 'promiseTask' && effect.stratum) {
                    const targetName = STRATA[effect.stratum]?.name || effect.stratum;
                    // 构建上下文供智能选择承诺类型
                    const promiseContext = {
                        nations: gameState.nations,
                        taxPolicies: gameState.taxPolicies,
                        market: gameState.market,
                        classWealth: gameState.classWealth,
                        classApproval: gameState.classApproval,
                        needsReport: {},
                        tradeRoutes: gameState.tradeRoutes,
                        classIncome: gameState.classIncome || {},
                        popStructure: gameState.popStructure,
                        classShortages: gameState.classShortages || {},
                        epoch: gameState.epoch,
                        techsUnlocked: gameState.techsUnlocked || [],
                    };
                    const task = createPromiseTask({
                        stratumKey: effect.stratum,
                        stratumName: targetName,
                        currentDay: gameState.daysElapsed || 0,
                        failurePenalty: effect.failurePenalty || { organization: 50 },
                        context: promiseContext,
                    });
                    if (task) {
                        gameState.setPromiseTasks(prev => [...(prev || []), task]);
                        const maintainInfo = task.maintainDuration > 0
                            ? `（需保持${task.maintainDuration}天）`
                            : '';
                        addLog(`📜 你向${targetName}承诺：${task.description}${maintainInfo}`);
                    }
                } else if (effect.type === 'divideEffect' && effect.target && effect.rival) {
                    const targetLabel = STRATA[effect.target]?.name || effect.target;
                    const rivalLabel = STRATA[effect.rival]?.name || effect.rival;
                    addLog(`🪓 ${targetLabel} 与 ${rivalLabel} 的矛盾被挑起。`);
                }
            });
        }

        if (result.effects.approvalChanges && Object.keys(result.effects.approvalChanges).length > 0) {
            Object.entries(result.effects.approvalChanges).forEach(([key, change]) => {
                if (change.value !== 0) {
                    gameState.setActiveEventEffects(prev => ({
                        ...prev,
                        approval: {
                            ...(prev.approval || {}),
                            [key]: {
                                value: (prev.approval?.[key]?.value || 0) + change.value,
                                duration: change.duration || 30,
                                source: `策略行动:${action.name}`,
                            },
                        },
                    }));
                }
            });
        }

        if (result.effects.stabilityChange) {
            gameState.setStability(prev => Math.max(0, Math.min(100, prev + result.effects.stabilityChange)));
        }

        const costParts = [];
        if (result.effects.resourceCost?.silver) costParts.push(`${result.effects.resourceCost.silver}银币`);
        if (result.effects.resourceCost?.culture) costParts.push(`${result.effects.resourceCost.culture}文化`);
        const costStr = costParts.length > 0 ? ` (消耗${costParts.join('、')})` : '';
        addLog(`⚡${result.message}${costStr}`);
    };

    const currentMilitaryPower = estimateMilitaryPower();

    // 计算税收和军队相关数据
    const taxes = gameState.taxes || { total: 0, breakdown: { headTax: 0, industryTax: 0, subsidy: 0 }, efficiency: 1 };
    const dayScale = 1; // 收入计算已不受gameSpeed影响，固定为1
    const armyFoodNeed = calculateArmyFoodNeed(gameState.army || {});
    const foodPrice = gameState.market?.prices?.food ?? (RESOURCES.food?.basePrice || 1);
    const wageRatio = gameState.militaryWageRatio || 1;
    const silverUpkeepPerDay = armyFoodNeed * foodPrice * wageRatio;
    const tradeStats = gameState.tradeStats || { tradeTax: 0 };
    const tradeTax = tradeStats.tradeTax || 0;
    const playerInstallmentExpense = (gameState.playerInstallmentPayment && gameState.playerInstallmentPayment.remainingDays > 0)
        ? gameState.playerInstallmentPayment.amount
        : 0;
    const netSilverPerDay = taxes.total + tradeTax - silverUpkeepPerDay - playerInstallmentExpense;
    const netSilverClass = netSilverPerDay >= 0 ? 'text-green-300' : 'text-red-300';
    const netChipClasses = netSilverPerDay >= 0
        ? 'text-green-300 bg-green-900/20 hover:bg-green-900/40'
        : 'text-red-300 bg-red-900/20 hover:bg-red-900/40';
    const netTrendIcon = netSilverPerDay >= 0 ? 'TrendingUp' : 'TrendingDown';
    const calendar = getCalendarInfo(gameState.daysElapsed || 0);
    const autoSaveAvailable = gameState.hasAutoSave();

    const handleManualSave = () => {
        gameState.saveGame();
    };

    const handleLoadManual = () => {
        gameState.loadGame({ source: 'manual' });
    };

    const handleLoadAuto = () => {
        if (!gameState.hasAutoSave()) {
            addLog('⚠️ 暂未检测到自动存档。');
            return;
        }
        gameState.loadGame({ source: 'auto' });
    };

    return (
        <div className="min-h-screen font-epic text-theme-text transition-all duration-1000 relative">
            {/* Dynamic Era Background */}
            <EraBackground epoch={gameState.epoch} opacity={0.08} />
            {/* 浮动文本 */}
            {gameState.clicks.map(c => (
                <FloatingText
                    key={c.id}
                    {...c}
                    onComplete={() => gameState.setClicks(prev => prev.filter(x => x.id !== c.id))}
                />
            ))}

            {/* 顶部状态栏 - 史诗风格 */}
            <div className="fixed top-0 left-0 right-0 z-50">
                <StatusBar
                    gameState={gameState}
                    taxes={taxes}
                    netSilverPerDay={netSilverPerDay}
                    tradeStats={tradeStats}
                    armyFoodNeed={armyFoodNeed}
                    playerInstallmentPayment={gameState.playerInstallmentPayment}
                    onResourceDetailClick={(key) => gameState.setResourceDetailView(key)}
                    onPopulationDetailClick={() => gameState.setPopulationDetailView(true)}
                    onStrataClick={() => setShowStrata(true)}  // 新增：打开社会阶层弹窗
                    onMarketClick={() => setShowMarket(true)}  // 新增：打开国内市场弹窗
                    onEmpireSceneClick={() => setShowEmpireScene(true)}  // 新增：点击日期按钮弹出帝国场景
                    gameControls={
                        <GameControls
                            isPaused={gameState.isPaused}
                            gameSpeed={gameState.gameSpeed}
                            onPauseToggle={() => gameState.setIsPaused(!gameState.isPaused)}
                            onSpeedChange={(speed) => gameState.setGameSpeed(speed)}
                            onSave={handleManualSave}
                            onLoadManual={handleLoadManual}
                            onLoadAuto={handleLoadAuto}
                            onSettings={() => setIsSettingsOpen(true)}
                            onReset={() => gameState.resetGame()}
                            onTutorial={handleReopenTutorial}
                            onWiki={() => setIsWikiOpen(true)}
                            autoSaveAvailable={autoSaveAvailable}
                            onTriggerEvent={actions.triggerRandomEvent}
                        />
                    }
                />
            </div>
            {/* 移动端游戏控制 - 位于底部导航栏右上方，留有间距 */}
            <div className="lg:hidden fixed bottom-[68px] right-2 z-40 game-controls-landscape" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
                <div className="scale-[0.9] origin-bottom-right">
                    <GameControls
                        isPaused={gameState.isPaused}
                        gameSpeed={gameState.gameSpeed}
                        onPauseToggle={() => gameState.setIsPaused(!gameState.isPaused)}
                        onSpeedChange={(speed) => gameState.setGameSpeed(speed)}
                        onSave={handleManualSave}
                        onLoadManual={handleLoadManual}
                        onLoadAuto={handleLoadAuto}
                        onSettings={() => setIsSettingsOpen(true)}
                        onReset={() => gameState.resetGame()}
                        onTutorial={handleReopenTutorial}
                        onWiki={() => setIsWikiOpen(true)}
                        menuDirection="up"
                        autoSaveAvailable={autoSaveAvailable}
                        onTriggerEvent={actions.triggerRandomEvent}
                    />
                </div>
            </div>

            {/* 占位符 - 避免内容被固定头部遮挡 */}
            <div
                className="h-14 sm:h-16 lg:h-20 header-placeholder-landscape header-safe-area-margin"
            ></div>

            {/* 主内容区域 - 移动端优先布局 */}
            <main className="max-w-[1920px] mx-auto px-2 sm:px-4 py-2 sm:py-4 pb-24 lg:pb-4 main-content-landscape" data-epoch={gameState.epoch}>
                {/* 移动端：单列布局，桌面端：三列布局 */}
                <div className="grid grid-cols-1 md:grid-cols-[2fr_8fr] lg:grid-cols-12 gap-3 sm:gap-4">

                    {/* 左侧边栏 - 桌面端显示 */}
                    <aside className="hidden md:block md:col-span-1 lg:col-span-2 space-y-4 order-2 md:order-1 lg:order-1">
                        {/* 国内市场面板 - 紧凑设计 */}
                        <EpicCard variant="ancient" className="p-2 animate-fade-in-up">
                            <ResourcePanel
                                resources={gameState.resources}
                                rates={gameState.rates}
                                market={gameState.market}
                                epoch={gameState.epoch}
                                onDetailClick={(key) => gameState.setResourceDetailView(key)}
                            />
                        </EpicCard>

                        {/* 社会阶层面板 */}
                        <StrataPanel
                            popStructure={gameState.popStructure}
                            classApproval={gameState.classApproval}
                            classInfluence={gameState.classInfluence}
                            stability={gameState.stability}
                            population={gameState.population}
                            activeBuffs={gameState.activeBuffs}
                            activeDebuffs={gameState.activeDebuffs}
                            classWealth={gameState.classWealth}
                            classWealthDelta={gameState.classWealthDelta}
                            classShortages={gameState.classShortages}
                            classIncome={gameState.classIncome}
                            classExpense={gameState.classExpense}
                            classLivingStandard={gameState.classLivingStandard}
                            rebellionStates={gameState.rebellionStates}
                            dayScale={1}
                            onDetailClick={handleStratumDetailClick}
                        />

                        {/* 手动采集按钮 */}
                        <button
                            onClick={manualGather}
                            className="relative w-full py-3 btn-epic rounded-xl font-bold shadow-epic active:scale-95 transition-all flex items-center justify-center gap-2 overflow-hidden group"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/20 via-emerald-500/30 to-emerald-600/20 animate-shimmer" />
                            <Icon name="Pickaxe" size={16} className="relative z-10" />
                            <span className="relative z-10">手动采集</span>
                        </button>
                    </aside>

                    {/* 中间内容区 - 主操作面板 */}
                    <section className="md:col-span-1 lg:col-span-8 space-y-3 sm:space-y-4 order-1 md:order-2 lg:order-2">
                        {/* 标签页容器 */}
                        <div className="relative glass-epic rounded-2xl border border-theme-border shadow-monument overflow-hidden min-h-[500px] animate-epic-entrance tab-container-landscape">
                            {/* 背景装饰 */}
                            <AncientPattern opacity={0.02} className="absolute inset-0 text-ancient-gold" />
                            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-ancient-gold/50 to-transparent" />
                            {/* 桌面端标签页导航 - 使用时代主题色 */}
                            <div className="hidden lg:flex border-b border-theme-border bg-gradient-to-r from-theme-surface/60 via-theme-surface-alt/40 to-theme-surface/60 overflow-x-auto relative">
                                <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-theme-accent/40 to-transparent" />
                                {[
                                    { id: 'build', label: '建设', icon: 'Hammer' },
                                    { id: 'military', label: '军事', icon: 'Swords' },
                                    { id: 'tech', label: '科技', icon: 'Cpu' },
                                    { id: 'politics', label: '政令', icon: 'Gavel' },
                                    { id: 'diplo', label: '外交', icon: 'Globe' },
                                ].map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => gameState.setActiveTab(tab.id)}
                                        className={`relative flex-1 min-w-[80px] py-2.5 flex items-center justify-center gap-2 text-sm font-bold transition-all group ${gameState.activeTab === tab.id
                                            ? 'border-b-2 shadow-glow'
                                            : 'text-gray-400 hover:text-theme-accent'
                                            }`}
                                        style={gameState.activeTab === tab.id ? {
                                            color: 'var(--theme-accent)',
                                            borderColor: 'var(--theme-primary)',
                                        } : {}}
                                    >
                                        {gameState.activeTab === tab.id && (
                                            <div className="absolute inset-0 bg-gradient-to-b from-theme-primary/15 to-transparent" />
                                        )}
                                        <Icon name={tab.icon} size={16} className="relative z-10" />
                                        <span className="relative z-10 tab-title-serif">{tab.label}</span>
                                        {gameState.activeTab !== tab.id && (
                                            <div className="absolute inset-0 bg-theme-primary/0 group-hover:bg-theme-primary/5 transition-colors" />
                                        )}
                                    </button>
                                ))}
                            </div>

                            {/* 标签页内容 */}
                            <div className="p-3 sm:p-4 relative">
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={gameState.activeTab}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        {/* 建设标签页 */}
                                        {gameState.activeTab === 'build' && (
                                            <BuildTab
                                                buildings={gameState.buildings}
                                                resources={gameState.resources}
                                                epoch={gameState.epoch}
                                                techsUnlocked={gameState.techsUnlocked}
                                                popStructure={gameState.popStructure}
                                                jobFill={gameState.jobFill}
                                                onBuy={actions.buyBuilding}
                                                onSell={actions.sellBuilding}
                                                market={gameState.market}
                                                onShowDetails={handleShowBuildingDetails} // 补上缺失的 onShowDetails 属性
                                            />
                                        )}

                                        {/* 军事标签页 */}
                                        {gameState.activeTab === 'military' && (
                                            <MilitaryTab
                                                army={gameState.army}
                                                militaryQueue={gameState.militaryQueue}
                                                resources={gameState.resources}
                                                epoch={gameState.epoch}
                                                population={gameState.population}
                                                buildings={gameState.buildings}
                                                nations={gameState.nations}
                                                selectedTarget={gameState.selectedTarget}
                                                onRecruit={actions.recruitUnit}
                                                onDisband={actions.disbandUnit}
                                                onCancelTraining={actions.cancelTraining}
                                                onSelectTarget={gameState.setSelectedTarget}
                                                onLaunchBattle={actions.launchBattle}
                                                market={gameState.market}
                                                militaryWageRatio={gameState.militaryWageRatio}
                                                onUpdateWageRatio={gameState.setMilitaryWageRatio}
                                                techsUnlocked={gameState.techsUnlocked}
                                                onShowUnitDetails={handleShowUnitDetails}
                                            />
                                        )}

                                        {/* 科技标签页 */}
                                        {gameState.activeTab === 'tech' && (
                                            <TechTab
                                                techsUnlocked={gameState.techsUnlocked}
                                                epoch={gameState.epoch}
                                                resources={gameState.resources}
                                                population={gameState.population}
                                                onResearch={actions.researchTech}
                                                onUpgradeEpoch={actions.upgradeEpoch}
                                                canUpgradeEpoch={actions.canUpgradeEpoch}
                                                market={gameState.market}
                                                onShowTechDetails={handleShowTechDetails}
                                            />
                                        )}

                                        {/* 政令标签页 */}
                                        {gameState.activeTab === 'politics' && (
                                            <PoliticsTab
                                                decrees={gameState.decrees}
                                                onToggle={actions.toggleDecree}
                                                taxPolicies={gameState.taxPolicies}
                                                onUpdateTaxPolicies={gameState.setTaxPolicies}
                                                popStructure={gameState.popStructure}
                                                buildings={gameState.buildings}
                                                market={gameState.market}
                                                epoch={gameState.epoch}
                                                techsUnlocked={gameState.techsUnlocked}
                                                onShowDecreeDetails={handleShowDecreeDetails}
                                                jobFill={gameState.jobFill}
                                                jobsAvailable={gameState.jobsAvailable}
                                            />
                                        )}

                                        {/* 外交标签页 */}
                                        {gameState.activeTab === 'diplo' && (
                                            <DiplomacyTab
                                                nations={gameState.nations}
                                                epoch={gameState.epoch}
                                                market={gameState.market}
                                                resources={gameState.resources}
                                                daysElapsed={gameState.daysElapsed}
                                                onDiplomaticAction={actions.handleDiplomaticAction}
                                                tradeRoutes={gameState.tradeRoutes}
                                                onTradeRouteAction={actions.handleTradeRouteAction}
                                                playerInstallmentPayment={gameState.playerInstallmentPayment}
                                                jobsAvailable={gameState.jobsAvailable}
                                                popStructure={gameState.popStructure}
                                                taxPolicies={gameState.taxPolicies}
                                            />
                                        )}
                                    </motion.div>
                                </AnimatePresence>
                            </div>
                        </div>
                    </section>

                    {/* 右侧边栏 - 桌面端显示 */}
                    <aside className="hidden lg:block lg:col-span-2 order-3 space-y-4">
                        {/* 帝国场景可视化 */}
                        <div className="bg-gray-900/60 backdrop-blur-md rounded-xl border border-white/10 shadow-glass overflow-hidden">
                            <EmpireScene
                                daysElapsed={gameState.daysElapsed}
                                season={calendar.season}
                                population={gameState.population}
                                stability={gameState.stability}
                                wealth={gameState.resources.silver}
                                epoch={gameState.epoch}
                                builds={gameState.buildings}
                            />
                        </div>

                        {/* 日志面板 */}
                        <LogPanel logs={gameState.logs} />

                        {/* 游戏提示 - 紧凑折叠设计 */}
                        <details className="glass-ancient rounded-xl border border-blue-500/20 shadow-md group">
                            <summary className="px-3 py-2 cursor-pointer flex items-center justify-between text-xs font-bold text-blue-300 hover:text-blue-200 transition-colors">
                                <span className="flex items-center gap-2">
                                    <Icon name="Lightbulb" size={12} />
                                    统治指南
                                </span>
                                <Icon name="ChevronDown" size={12} className="transform group-open:rotate-180 transition-transform" />
                            </summary>
                            <div className="px-3 pb-3 text-[10px] text-gray-300 space-y-1.5">
                                <p>• <span className="text-white">市场是经济核心</span>：供需关系决定价格，影响税收。</p>
                                <p>• <span className="text-white">国库与库存</span>：银币是命脉，资源不足会自动购买。</p>
                                <p>• <span className="text-white">三大税收</span>：人头税、交易税、营业税各有作用。</p>
                            </div>
                        </details>

                        <details className="glass-ancient rounded-xl border border-emerald-500/20 shadow-md group">
                            <summary className="px-3 py-2 cursor-pointer flex items-center justify-between text-xs font-bold text-emerald-300 hover:text-emerald-200 transition-colors">
                                <span className="flex items-center gap-2">
                                    <Icon name="BookOpen" size={12} />
                                    新手入门
                                </span>
                                <Icon name="ChevronDown" size={12} className="transform group-open:rotate-180 transition-transform" />
                            </summary>
                            <div className="px-3 pb-3 text-[10px] text-gray-200 space-y-1.5">
                                <p><span className="text-white font-semibold">1.</span> 确保银币正增长</p>
                                <p><span className="text-white font-semibold">2.</span> 在政令面板调整税率</p>
                                <p><span className="text-white font-semibold">3.</span> 建设工业赚取税收</p>
                                <p><span className="text-white font-semibold">4.</span> 满足阶层消费需求</p>
                            </div>
                        </details>
                    </aside>
                </div>
            </main>

            {/* 底部导航栏 - 移动端专用 */}
            <BottomNav
                activeTab={gameState.activeTab}
                onTabChange={(tab) => gameState.setActiveTab(tab)}
                epoch={gameState.epoch}
            />

            {/* 渲染 BottomSheet/Modal */}
            <BottomSheet
                isOpen={activeSheet.type === 'building'}
                onClose={closeSheet}
                title={activeSheet.data?.name || '建筑详情'}
                showHeader={false}
            >
                {activeSheet.type === 'building' && (
                    <BuildingDetails
                        building={activeSheet.data}
                        gameState={gameState}
                        onBuy={actions.buyBuilding}
                        onSell={actions.sellBuilding}
                        taxPolicies={gameState.taxPolicies}
                        onUpdateTaxPolicies={gameState.setTaxPolicies}
                    />)}
            </BottomSheet>

            {/* 阶层详情 BottomSheet */}
            <BottomSheet
                isOpen={activeSheet.type === 'stratum'}
                onClose={closeSheet}
                title="阶层详情"
                showHeader={true}
            >
                {activeSheet.type === 'stratum' && (
                    <StratumDetailSheet
                        stratumKey={activeSheet.data}
                        popStructure={gameState.popStructure}
                        population={gameState.population}
                        classApproval={gameState.classApproval}
                        classInfluence={gameState.classInfluence}
                        classWealth={gameState.classWealth}
                        classWealthDelta={gameState.classWealthDelta}
                        classIncome={gameState.classIncome}
                        classExpense={gameState.classExpense}
                        classShortages={gameState.classShortages}
                        classLivingStandard={gameState.classLivingStandard}
                        rebellionStates={gameState.rebellionStates}
                        actionCooldowns={gameState.actionCooldowns}
                        actionUsage={gameState.actionUsage}
                        activeBuffs={gameState.activeBuffs}
                        activeDebuffs={gameState.activeDebuffs}
                        dayScale={1}
                        daysElapsed={gameState.daysElapsed || 0}
                        taxPolicies={gameState.taxPolicies}
                        onUpdateTaxPolicies={gameState.setTaxPolicies}
                        onStrategicAction={handleStrategicAction}
                        resources={gameState.resources}
                        militaryPower={currentMilitaryPower}
                        promiseTasks={gameState.promiseTasks}
                        nations={gameState.nations}
                        epoch={gameState.epoch}
                        techsUnlocked={gameState.techsUnlocked}
                        onClose={closeSheet}
                    />
                )}
            </BottomSheet>

            {/* 军事单位详情底部面板 */}
            <BottomSheet
                isOpen={activeSheet.type === 'unit'}
                onClose={closeSheet}
                title="单位详情"
                showHeader={true}
            >
                {activeSheet.type === 'unit' && (
                    <UnitDetailSheet
                        unit={activeSheet.data}
                        resources={gameState.resources}
                        market={gameState.market}
                        militaryWageRatio={gameState.militaryWageRatio}
                        army={gameState.army}
                        onRecruit={actions.recruitUnit}
                        onDisband={actions.disbandUnit}
                        onClose={closeSheet}
                    />
                )}
            </BottomSheet>

            {/* 科技详情底部面板 */}
            <BottomSheet
                isOpen={activeSheet.type === 'tech'}
                onClose={closeSheet}
                title="科技详情"
                showHeader={true}
            >
                {activeSheet.type === 'tech' && activeSheet.data && (
                    <TechDetailSheet
                        tech={activeSheet.data.tech}
                        status={activeSheet.data.status}
                        resources={gameState.resources}
                        market={gameState.market}
                        onResearch={actions.researchTech}
                        onClose={closeSheet}
                    />
                )}
            </BottomSheet>

            {/* 政策详情底部面板 */}
            <BottomSheet
                isOpen={activeSheet.type === 'decree'}
                onClose={closeSheet}
                title="政策详情"
                showHeader={true}
            >
                {activeSheet.type === 'decree' && (
                    <DecreeDetailSheet
                        decree={activeSheet.data}
                        onToggle={actions.toggleDecree}
                        onClose={closeSheet}
                    />
                )}
            </BottomSheet>

            {/* 社会阶层底部面板（移动端） */}
            <BottomSheet
                isOpen={showStrata}
                onClose={() => setShowStrata(false)}
                title="社会阶层"
                showHeader={true}
            >
                <StrataPanel
                    popStructure={gameState.popStructure}
                    classApproval={gameState.classApproval}
                    classInfluence={gameState.classInfluence}
                    stability={gameState.stability}
                    population={gameState.population}
                    activeBuffs={gameState.activeBuffs}
                    activeDebuffs={gameState.activeDebuffs}
                    classWealth={gameState.classWealth}
                    classWealthDelta={gameState.classWealthDelta}
                    classShortages={gameState.classShortages}
                    classIncome={gameState.classIncome}
                    classExpense={gameState.classExpense}
                    classLivingStandard={gameState.classLivingStandard}
                    rebellionStates={gameState.rebellionStates}
                    dayScale={1}
                    onDetailClick={handleStratumDetailClick}
                    hideTitle={true}
                />
            </BottomSheet>

            {/* 国内市场底部面板（移动端） */}
            <BottomSheet
                isOpen={showMarket}
                onClose={() => setShowMarket(false)}
                title="国内市场"
                showHeader={true}
            >
                <ResourcePanel
                    resources={gameState.resources}
                    rates={gameState.rates}
                    market={gameState.market}
                    epoch={gameState.epoch}
                    title="资源总览"
                    showDetailedMobile={true}
                    onDetailClick={(key) => {
                        setShowMarket(false);
                        gameState.setResourceDetailView(key);
                    }}
                />
            </BottomSheet>

            {/* 帝国场景底部面板（移动端） */}
            <BottomSheet
                isOpen={showEmpireScene}
                onClose={() => setShowEmpireScene(false)}
                title={`帝国场景 - ${calendar.season} · 第${calendar.year}年`}
                showHeader={true}
            >
                <div className="space-y-4">
                    {/* 帝国场景 */}
                    <div className="bg-gray-900/60 backdrop-blur-md rounded-lg border border-white/10 shadow-glass overflow-hidden">
                        <EmpireScene
                            daysElapsed={gameState.daysElapsed}
                            season={calendar.season}
                            population={gameState.population}
                            stability={gameState.stability}
                            wealth={gameState.resources.silver}
                            epoch={gameState.epoch}
                            builds={gameState.buildings}
                        />
                    </div>

                    {/* 庆典历史列表 */}
                    {gameState.activeFestivalEffects && gameState.activeFestivalEffects.length > 0 && (
                        <div className="bg-gray-900/60 backdrop-blur-md rounded-lg border border-ancient-gold/30 shadow-glass overflow-hidden">
                            <div className="px-3 py-2 border-b border-ancient-gold/20 bg-gradient-to-r from-ancient-gold/10 to-transparent">
                                <div className="flex items-center gap-2">
                                    <Icon name="Sparkles" size={14} className="text-ancient-gold" />
                                    <span className="text-sm font-bold text-ancient-gold">庆典历史</span>
                                </div>
                            </div>
                            <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
                                {[...gameState.activeFestivalEffects]
                                    .sort((a, b) => (b.activatedAt || 0) - (a.activatedAt || 0))
                                    .map((effect, index) => {
                                        const activatedYear = Math.floor((effect.activatedAt || 0) / 360) + 1;
                                        const isPermanent = effect.type === 'permanent';
                                        const isExpired = !isPermanent && (gameState.daysElapsed - (effect.activatedAt || 0)) >= (effect.duration || 360);
                                        const uniqueKey = `${effect.id}-${index}`;
                                        const isExpanded = expandedFestival === uniqueKey;

                                        return (
                                            <div
                                                key={uniqueKey}
                                                className={`p-2 rounded-lg border transition-all ${isExpired
                                                    ? 'bg-gray-800/40 border-gray-600/30 opacity-60'
                                                    : isPermanent
                                                        ? 'bg-purple-900/20 border-purple-500/30'
                                                        : 'bg-yellow-900/20 border-yellow-500/30'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isPermanent ? 'bg-purple-500/20' : 'bg-yellow-500/20'
                                                        }`}>
                                                        <Icon name={effect.icon || 'Star'} size={14} className={isPermanent ? 'text-purple-400' : 'text-yellow-400'} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-semibold text-ancient-parchment truncate">{effect.name}</span>
                                                            <span className={`text-[9px] px-1.5 py-0.5 rounded ${isExpired
                                                                ? 'bg-gray-600/30 text-gray-400'
                                                                : isPermanent
                                                                    ? 'bg-purple-500/30 text-purple-300'
                                                                    : 'bg-yellow-500/30 text-yellow-300'
                                                                }`}>
                                                                {isExpired ? '已过期' : isPermanent ? '永久' : '短期'}
                                                            </span>
                                                        </div>
                                                        <div className="text-[10px] text-ancient-stone mt-0.5">
                                                            第 {activatedYear} 年选择
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => setExpandedFestival(isExpanded ? null : uniqueKey)}
                                                        className="text-[10px] text-gray-400 hover:text-white transition-colors p-1 rounded-md"
                                                    >
                                                        <Icon name={isExpanded ? "ChevronUp" : "ChevronDown"} size={12} />
                                                    </button>
                                                </div>
                                                {isExpanded && (
                                                    <div className="mt-2 pt-2 border-t border-white/10 text-xs text-gray-300">
                                                        <p><strong>效果：</strong>{formatFestivalEffects(effect.effects)}</p>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    )}

                    {/* 无庆典历史提示 */}
                    {(!gameState.activeFestivalEffects || gameState.activeFestivalEffects.length === 0) && (
                        <div className="bg-gray-900/60 backdrop-blur-md rounded-lg border border-gray-700/30 shadow-glass p-4 text-center">
                            <Icon name="Calendar" size={24} className="text-ancient-stone mx-auto mb-2 opacity-50" />
                            <p className="text-xs text-ancient-stone">暂无庆典历史记录</p>
                            <p className="text-[10px] text-gray-500 mt-1">每年年初会触发庆典选择</p>
                        </div>
                    )}
                </div>
            </BottomSheet>

            {/* 战斗通知（非阻断式，页面顶部提示） */}
            <BattleNotification
                notifications={gameState.battleNotifications || []}
                onViewDetail={(notification) => {
                    // 点击查看详情时，显示完整的战斗结果模态框
                    gameState.setBattleResult(notification.result);
                    // 从通知队列中移除该通知
                    actions.dismissBattleNotification(notification.id);
                }}
                onDismiss={(notificationId) => {
                    actions.dismissBattleNotification(notificationId);
                }}
                onDismissAll={() => {
                    actions.dismissAllBattleNotifications();
                }}
            />

            {/* 战斗结果模态框（点击通知后显示详情） */}
            {gameState.battleResult && (
                <BattleResultModal
                    result={gameState.battleResult}
                    onClose={() => gameState.setBattleResult(null)}
                />
            )}

            {/* 阶层详情模态框 */}
            {gameState.stratumDetailView && (
                <StratumDetailModal
                    stratumKey={gameState.stratumDetailView}
                    popStructure={gameState.popStructure}
                    classApproval={gameState.classApproval}
                    classInfluence={gameState.classInfluence}
                    classWealth={gameState.classWealth}
                    classWealthHistory={gameState.classWealthHistory}
                    totalInfluence={gameState.totalInfluence}
                    totalWealth={gameState.totalWealth}
                    activeBuffs={gameState.activeBuffs}
                    activeDebuffs={gameState.activeDebuffs}
                    epoch={gameState.epoch}
                    techsUnlocked={gameState.techsUnlocked}
                    history={gameState.history}
                    stability={gameState.stability}
                    onClose={() => gameState.setStratumDetailView(null)}
                />
            )}

            {/* 资源详情模态框 */}
            {gameState.resourceDetailView && (
                <ResourceDetailModal
                    resourceKey={gameState.resourceDetailView}
                    resources={gameState.resources}
                    market={gameState.market}
                    buildings={gameState.buildings}
                    popStructure={gameState.popStructure}
                    wealth={gameState.classWealth}
                    army={gameState.army}
                    history={gameState.history}
                    onClose={() => gameState.setResourceDetailView(null)}
                    taxPolicies={gameState.taxPolicies}
                    onUpdateTaxPolicies={gameState.setTaxPolicies}
                    activeDebuffs={gameState.activeDebuffs}
                />
            )}

            {gameState.populationDetailView && (
                <PopulationDetailModal
                    isOpen={gameState.populationDetailView}
                    onClose={() => gameState.setPopulationDetailView(false)}
                    population={gameState.population}
                    maxPop={gameState.maxPop}
                    popStructure={gameState.popStructure}
                    history={gameState.history}
                />
            )}

            {/* 年度庆典模态框 */}
            {gameState.festivalModal && (
                <AnnualFestivalModal
                    festivalOptions={gameState.festivalModal.options}
                    year={gameState.festivalModal.year}
                    epoch={gameState.epoch}
                    onSelect={handleFestivalSelect}
                />
            )}

            {/* 事件系统底部面板 */}
            <BottomSheet
                isOpen={!!gameState.currentEvent}
                onClose={() => gameState.setCurrentEvent(null)}
                title="事件"
                showHeader={true}
                preventBackdropClose={true}
                showCloseButton={!Boolean(gameState.currentEvent?.options?.length)}
                preventEscapeClose={Boolean(gameState.currentEvent?.options?.length)}
            >
                {gameState.currentEvent && (
                    <EventDetail
                        event={gameState.currentEvent}
                        onSelectOption={handleEventOption}
                        onClose={() => gameState.setCurrentEvent(null)}
                        nations={gameState.nations}
                    />
                )}
            </BottomSheet>

            {/* 新手教程模态框 */}
            <TutorialModal
                show={gameState.showTutorial}
                onComplete={handleTutorialComplete}
                onSkip={handleTutorialSkip}
                onOpenWiki={() => setIsWikiOpen(true)}
            />

            {/* 百科模态框 */}
            <WikiModal
                show={isWikiOpen}
                onClose={() => setIsWikiOpen(false)}
            />

            {/* 设置弹窗 */}
            {isSettingsOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/70"
                        onClick={() => setIsSettingsOpen(false)}
                        aria-hidden="true"
                    />
                    <div className="relative w-full max-w-lg z-10">
                        <SettingsPanel
                            isAutoSaveEnabled={gameState.isAutoSaveEnabled}
                            autoSaveInterval={gameState.autoSaveInterval}
                            onToggleAutoSave={gameState.setIsAutoSaveEnabled}
                            onIntervalChange={gameState.setAutoSaveInterval}
                            lastAutoSaveTime={gameState.lastAutoSaveTime}
                            onManualSave={handleManualSave}
                            onManualLoad={handleLoadManual}
                            onAutoLoad={handleLoadAuto}
                            autoSaveAvailable={autoSaveAvailable}
                            isSaving={gameState.isSaving}
                            timeSettings={gameState.eventEffectSettings}
                            onTimeSettingsChange={gameState.setEventEffectSettings}
                            onClose={() => setIsSettingsOpen(false)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
