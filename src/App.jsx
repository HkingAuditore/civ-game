// 文明崛起 - 主应用文件
// 使用拆分后的钩子和组件，保持代码简洁

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { GAME_SPEEDS, EPOCHS, RESOURCES, STRATA, calculateArmyFoodNeed, calculateTotalArmyExpense, BUILDINGS, EVENTS, checkAndCreateCoalitionDemandEvent, LOG_STORAGE_LIMIT } from './config';
import { getCalendarInfo } from './utils/calendar';
import { calculateTotalDailySalary } from './logic/officials/manager';
import { enactDecree, getAllTimedDecrees } from './logic/officials/cabinetSynergy';
import { useGameState, useGameLoop, useGameActions, useSound, useEpicTheme, useViewportHeight, useDevicePerformance, useAchievements, useThrottledSelector, UI_THROTTLE_PRESETS } from './hooks';
import { useStoreSync } from './stores/useStoreSync';
import { useTutorialSystem } from './hooks/useTutorialSystem';
import { TutorialOverlay } from './components/tutorial/TutorialOverlay';
import {
    Icon,
    FloatingText
} from './components/common/UIComponents';
import { BattleNotification } from './components/common/BattleNotification';
import { EpicCard, DiamondDivider, AncientPattern } from './components/common/EpicDecorations';
import { MusicPlayer } from './components/common/MusicPlayer';
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
    OverviewTab,
    BattleResultModal,
    StratumDetailModal,
    ResourceDetailModal,
    PopulationDetailModal,
    AnnualFestivalModal,
    TutorialModal,
    WikiModal,
} from './components';
import { EconomicDashboard } from './components/modals/EconomicDashboard';
import { UnitDetailSheet } from './components/panels/UnitDetailSheet';
import { TechDetailSheet } from './components/panels/TechDetailSheet';
import { DecreeDetailSheet } from './components/panels/DecreeDetailSheet';
import { EventDetail } from './components/modals/EventDetail';
import { DifficultySelectionModal } from './components/modals/DifficultySelectionModal';
import { SaveSlotModal } from './components/modals/SaveSlotModal';
import { SaveTransferModal } from './components/modals/SaveTransferModal';
import { AchievementsModal } from './components/modals/AchievementsModal';
import { IdeologyEmergenceModal } from './components/modals/IdeologyEmergenceModal';
import OfficialOverstaffModal from './components/modals/OfficialOverstaffModal';
import { AchievementToast } from './components/common/AchievementToast';
import { DonateModal } from './components/modals/DonateModal';
import { executeStrategicAction, STRATEGIC_ACTIONS } from './logic/strategicActions';
import { assignCorpsToFront, removeCorpsFromFront, getPlayerSide } from './logic/diplomacy/frontSystem';
import { setTacticOrder, createBattle, processReinforcement, isBattleActive } from './logic/diplomacy/battleSystem';
import { getOrganizationStage, getPhaseFromStage } from './logic/organizationSystem';
import { createPromiseTask, PROMISE_CONFIG } from './logic/promiseTasks';
import { selectIdeology } from './logic/ideology/ideologyEmergence';
import { getEmergenceThreshold } from './logic/ideology/ideologyScoring';

const PerfOverlay = () => {
    const [stats, setStats] = useState(null);
    const [isVisible, setIsVisible] = useState(true);
    // 从localStorage读取debug设置
    const [debugEnabled, setDebugEnabled] = useState(() => {
        if (typeof window === 'undefined') return false;
        const stored = localStorage.getItem('debugPerfOverlay');
        return stored === 'true';
    });

    useEffect(() => {
        // 监听localStorage变化
        const handleStorageChange = () => {
            if (typeof window === 'undefined') return;
            const stored = localStorage.getItem('debugPerfOverlay');
            setDebugEnabled(stored === 'true');
        };

        window.addEventListener('storage', handleStorageChange);
        // 也监听自定义事件，用于同一页面内的更新
        window.addEventListener('debugSettingsChanged', handleStorageChange);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('debugSettingsChanged', handleStorageChange);
        };
    }, []);

    useEffect(() => {
        if (!debugEnabled) return;

        const timer = setInterval(() => {
            if (typeof window === 'undefined') return;
            const next = window.__PERF_STATS;
            if (next) {
                setStats(next);
            }
        }, 500);

        return () => clearInterval(timer);
    }, [debugEnabled]);

    if (!debugEnabled || !isVisible) return null;

    const sectionEntries = stats?.sections
        ? Object.entries(stats.sections)
            .filter(([, value]) => Number.isFinite(value) && value > 0)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4)
        : [];

    return (
        <div className="fixed right-2 top-16 z-[9999] bg-black/70 text-green-300 border border-green-600/40 rounded px-2 py-1 text-xs font-mono pointer-events-auto">
            <div className="flex items-center justify-between gap-2">
                <span>PERF</span>
                <button
                    type="button"
                    className="text-green-300 hover:text-white"
                    onClick={() => setIsVisible(false)}
                >
                    ✕
                </button>
            </div>
            <div>day: {stats?.day ?? '-'}</div>
            <div>total: {stats?.totalMs ? stats.totalMs.toFixed(1) : '-'} ms</div>
            <div>sim: {stats?.simMs ? stats.simMs.toFixed(1) : '-'} ms</div>
            <div>apply: {stats?.applyMs ? stats.applyMs.toFixed(1) : '-'} ms</div>
            <div>nations: {stats?.nations ?? '-'}</div>
            <div>overseas: {stats?.overseas ?? '-'}</div>
            <div>foreign: {stats?.foreign ?? '-'}</div>
            <div>other: {stats?.otherMs ? stats.otherMs.toFixed(1) : '-'} ms</div>
            {sectionEntries.map(([label, value]) => (
                <div key={label}>
                    {label}: {value.toFixed(1)} ms
                </div>
            ))}
        </div>
    );
};

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

    // 初始化动态视口高度（解决移动端 vh 不准确问题）
    useViewportHeight();

    // 初始化设备性能检测（自动启用低端设备优化）
    useDevicePerformance();

    // 将 gameState 同步到 Zustand stores（渐进迁移桥接层）
    useStoreSync(gameState);

    // 添加日志函数 - memoized to prevent unnecessary re-renders
    const addLog = useCallback((msg) => {
        if (gameState?.setLogs) {
            gameState.setLogs(prev => [msg, ...prev].slice(0, LOG_STORAGE_LIMIT));
        }
    }, [gameState]);

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

    // 交互式教程系统
    const tutorialSystem = useTutorialSystem({
        gameState,
        currentTab: gameState.activeTab,
        onComplete: () => {
            addLog('🎓 交互式新手教程完成！祝你建立伟大的文明！');
        },
    });

    const [showStrata, setShowStrata] = useState(false);
    const lastEventCheckDayRef = useRef(null);
    const [showMarket, setShowMarket] = useState(false);  // 新增：控制国内市场弹窗
    const [showSaveTransferModal, setShowSaveTransferModal] = useState(false); // 新增：控制存档传输弹窗
    const [showAchievementsModal, setShowAchievementsModal] = useState(false);
    const [showDonateModal, setShowDonateModal] = useState(false);
    const [showEconomicDashboard, setShowEconomicDashboard] = useState(false); // 新增：控制经济数据看板
    const [expandedFestival, setExpandedFestival] = useState(null);

    // 官员超编检测状态
    const [showOfficialOverstaffModal, setShowOfficialOverstaffModal] = useState(false);
    const prevCapacityRef = useRef(null);
    const overstaffModalShownRef = useRef(false); // Track if modal has been shown to prevent re-triggering

    // 检测官员超编情况
    // [FIX] Remove isPaused and showOfficialOverstaffModal from deps to prevent infinite loop
    useEffect(() => {
        const currentCapacity = gameState.officialCapacity ?? 2;
        const currentOfficials = gameState.officials || [];
        const officialCount = currentOfficials.length;

        // 首次加载时初始化
        if (prevCapacityRef.current === null) {
            prevCapacityRef.current = currentCapacity;
            return;
        }

        // 检测容量是否减少导致超编
        if (officialCount > currentCapacity && currentCapacity < prevCapacityRef.current) {
            // 容量减少且官员超编，且尚未显示弹窗
            if (!overstaffModalShownRef.current) {
                overstaffModalShownRef.current = true;
                setShowOfficialOverstaffModal(true);
                // 暂停游戏
                gameState.setIsPaused(true);
            }
        }

        prevCapacityRef.current = currentCapacity;
    }, [gameState.officialCapacity, gameState.officials, gameState.setIsPaused]);

    // 处理官员超编解雇
    const handleOfficialOverstaffFire = useCallback((officialId) => {
        if (actions.fireExistingOfficial) {
            actions.fireExistingOfficial(officialId);
        }
    }, [actions]);

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

        // 每经过 30 个游戏内日检查一次
        if (deltaDays >= 30) {
            lastEventCheckDayRef.current = currentDay;

            // 优先检查联盟诉求事件（在野阶层影响力>=20%）
            // 只传递可序列化的数据，避免 Worker 序列化错误
            const coalitionEventData = {
                rulingCoalition: gameState.rulingCoalition,
                classInfluence: gameState.classInfluence,
                totalInfluence: gameState.totalInfluence,
                popStructure: gameState.popStructure,
                classExpense: gameState.classExpense,
                daysElapsed: gameState.daysElapsed,
            };
            const coalitionEvent = checkAndCreateCoalitionDemandEvent(coalitionEventData, 60);
            if (coalitionEvent) {
                actions.triggerDiplomaticEvent(coalitionEvent);
                return;
            }

            // 10% 概率触发随机事件
            if (Math.random() < 0.1) {
                actions.triggerRandomEvent();
            }
        }
    }, [gameState.daysElapsed, gameState.isPaused, gameState.currentEvent, actions, gameState.rulingCoalition, gameState.classInfluence, gameState.totalInfluence, gameState.popStructure, gameState.classExpense]);

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isWikiOpen, setIsWikiOpen] = useState(false);
    const [showDifficultyModal, setShowDifficultyModal] = useState(false); // 难度选择弹窗
    const [showSaveSlotModal, setShowSaveSlotModal] = useState(false); // 存档槽位弹窗
    const [saveSlotModalMode, setSaveSlotModalMode] = useState('save'); // 'save' | 'load'
    const [showEmpireScene, setShowEmpireScene] = useState(false);
    const [activeSheet, setActiveSheet] = useState({ type: null, data: null });

    // Responsive detection: only render sidebars on desktop to avoid hidden components consuming resources
    const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 1024);
    const [isTablet, setIsTablet] = useState(() => window.innerWidth >= 768);

    useEffect(() => {
        const handleResize = () => {
            setIsDesktop(window.innerWidth >= 1024);
            setIsTablet(window.innerWidth >= 768);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Global keyboard shortcuts: Space to toggle pause, Escape to close menus
    useEffect(() => {
        const handleKeyDown = (event) => {
            // Ignore if typing in an input field, textarea, or contenteditable element
            const target = event.target;
            if (
                target.tagName === 'INPUT' ||
                target.tagName === 'TEXTAREA' ||
                target.isContentEditable
            ) {
                return;
            }

            // Space key: Toggle pause/play
            if (event.code === 'Space') {
                event.preventDefault(); // Prevent page scrolling
                gameState.setIsPaused(prev => !prev);
                return;
            }

            // Escape key: Close menus/modals in priority order
            if (event.key === 'Escape') {
                // Priority 1: Close activeSheet (building details, stratum details, etc.)
                if (activeSheet.type !== null) {
                    setActiveSheet({ type: null, data: null });
                    return;
                }

                // Priority 2: Close settings panel
                if (isSettingsOpen) {
                    setIsSettingsOpen(false);
                    return;
                }

                // Priority 3: Close wiki modal
                if (isWikiOpen) {
                    setIsWikiOpen(false);
                    return;
                }

                // Priority 4: Close battle result modal
                if (gameState.battleResult) {
                    gameState.setBattleResult(null);
                    return;
                }

                // Priority 5: Close stratum detail modal
                if (gameState.stratumDetailView) {
                    gameState.setStratumDetailView(null);
                    return;
                }

                // Priority 6: Close resource detail modal
                if (gameState.resourceDetailView) {
                    gameState.setResourceDetailView(null);
                    return;
                }

                // Priority 7: Close population detail modal
                if (gameState.populationDetailView) {
                    gameState.setPopulationDetailView(false);
                    return;
                }

                // Priority 8: Close strata panel (mobile)
                if (showStrata) {
                    setShowStrata(false);
                    return;
                }

                // Priority 9: Close market panel (mobile)
                if (showMarket) {
                    setShowMarket(false);
                    return;
                }

                // Priority 10: Close empire scene panel
                if (showEmpireScene) {
                    setShowEmpireScene(false);
                    return;
                }

                // Note: currentEvent and festivalModal have their own ESC handling via BottomSheet
                // and may have preventEscapeClose enabled, so we don't handle them here
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [
        gameState,
        activeSheet.type,
        isSettingsOpen,
        isWikiOpen,
        showStrata,
        showMarket,
        showEmpireScene
    ]);

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

    // 删除 GameControls 中的 confirm 对话框，使用弹窗替代
    // 参见 GameControls.jsx 中的重置按钮

    // 重新打开教程（同时支持原静态教程和新交互式教程）
    const handleReopenTutorial = () => {
        // 优先启动交互式教程
        tutorialSystem.resetTutorial();
        addLog('📖 重新打开交互式教程');
        // 如果还需要原静态教程：gameState.setShowTutorial(true);
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
        }), { reason: 'manual_gather_silver' });
    };

    // 新增：处理显示建筑详情的函数 - memoized
    const handleShowBuildingDetails = useCallback((buildingId, options = {}) => {
        const building = BUILDINGS.find(b => b.id === buildingId);
        if (building) {
            setActiveSheet({ type: 'building', data: building, options });
        }
    }, []);

    // 新增：关闭 BottomSheet 的函数 - memoized
    const closeSheet = useCallback(() => setActiveSheet({ type: null, data: null }), []);

    // 处理阶层详情点击 - memoized
    const handleStratumDetailClick = useCallback((stratumKey) => {
        setActiveSheet({ type: 'stratum', data: stratumKey });
    }, []);

    // 处理军事单位详情点击 - memoized
    const handleShowUnitDetails = useCallback((unit) => {
        setActiveSheet({ type: 'unit', data: unit });
    }, []);

    // 处理科技详情点击 - memoized
    const handleShowTechDetails = useCallback((tech, status) => {
        setActiveSheet({ type: 'tech', data: { tech, status } });
    }, []);

    // 处理政策详情点击 - memoized
    const handleShowDecreeDetails = useCallback((decree) => {
        setActiveSheet({ type: 'decree', data: decree });
    }, []);

    // === Military front/battle callbacks ===

    // Assign a corps to a front (update front.assignedCorps + corps.status)
    // If there's an active battle on the front, the corps joins as reinforcement
    const handleAssignCorpsToFront = useCallback((frontId, corpsId) => {
        const fronts = gameState.activeFronts || [];
        const front = fronts.find(f => f.id === frontId);
        if (!front) return;

        const playerSide = getPlayerSide(front);
        if (!playerSide) return;

        const updatedFront = assignCorpsToFront(front, corpsId, playerSide);
        gameState.setActiveFronts(prev => prev.map(f => f.id === frontId ? updatedFront : f));

        // Check if there's an active battle on this front
        const activeBattles = gameState.activeBattles || [];
        const frontBattle = activeBattles.find(b => b.frontId === frontId && isBattleActive(b));
        const corps = (gameState.militaryCorps || []).find(c => c.id === corpsId);

        if (frontBattle && corps) {
            // Reinforce the ongoing battle with the new corps' units
            const reinforcedBattle = processReinforcement(frontBattle, playerSide, corps.units || {}, corps);
            gameState.setActiveBattles(prev => prev.map(b =>
                b.id === frontBattle.id ? reinforcedBattle : b
            ));
            // Mark corps as in_combat since it's now part of the battle
            gameState.setMilitaryCorps(prev => prev.map(c =>
                c.id === corpsId ? { ...c, status: 'in_combat', assignedFrontId: frontId, frontTask: c.frontTask || 'assault' } : c
            ));
        } else {
            // No active battle: just deploy normally
            gameState.setMilitaryCorps(prev => prev.map(c =>
                c.id === corpsId ? { ...c, status: 'deployed', assignedFrontId: frontId, frontTask: c.frontTask || 'assault' } : c
            ));
        }
    }, [gameState]);

    // Remove a corps from a front (restore to idle)
    const handleRemoveCorpsFromFront = useCallback((frontId, corpsId) => {
        const fronts = gameState.activeFronts || [];
        const front = fronts.find(f => f.id === frontId);
        if (!front) return;

        const playerSide = getPlayerSide(front);
        if (!playerSide) return;

        const updatedFront = removeCorpsFromFront(front, corpsId, playerSide);
        gameState.setActiveFronts(prev => prev.map(f => f.id === frontId ? updatedFront : f));

        // Restore corps status to 'idle'
        gameState.setMilitaryCorps(prev => prev.map(c =>
            c.id === corpsId ? { ...c, status: 'idle', assignedFrontId: null } : c
        ));
    }, [gameState]);

    // Set battle tactic for the player side
    const handleSetBattleTactic = useCallback((battleId, side, tacticId) => {
        gameState.setActiveBattles(prev => prev.map(b => {
            if (b.id !== battleId) return b;
            return setTacticOrder(b, side, tacticId);
        }));
    }, [gameState]);

    // Create a new battle on a front
    const handleCreateBattle = useCallback((battleParams) => {
        if (!battleParams?.attackerCorps || !battleParams?.defenderCorps) return;
        const battle = createBattle(battleParams);
        if (!battle) return;
        gameState.setActiveBattles(prev => [...prev, battle]);
        if (battleParams.front?.id) {
            gameState.setActiveFronts(prev => prev.map(front =>
                front.id === battleParams.front.id ? { ...front, activeBattleId: battle.id } : front
            ));
        }
        // Mark participating corps as in combat
        const corpsIds = [battleParams.attackerCorps?.id, battleParams.defenderCorps?.id].filter(Boolean);
        if (corpsIds.length > 0) {
            gameState.setMilitaryCorps(prev => prev.map(c =>
                corpsIds.includes(c.id) ? { ...c, status: 'in_combat' } : c
            ));
        }
    }, [gameState]);

    // Set tactical posture for a front
    const handleSetPosture = useCallback((frontId, posture) => {
        gameState.setActiveFronts(prev => prev.map(f =>
            f.id === frontId ? { ...f, posture } : f
        ));
    }, [gameState]);

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
            }, { reason: 'strategic_action_cost', meta: { actionId, stratumKey } });
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
    // [FIX] Merge loose army + corps units for unified food/expense calculations
    const allPlayerMilitaryUnits = useMemo(() => {
        const merged = { ...(gameState.army || {}) };
        for (const corps of (gameState.militaryCorps || [])) {
            if (corps?.isAI) continue;
            for (const [unitId, count] of Object.entries(corps?.units || {})) {
                if (count > 0) merged[unitId] = (merged[unitId] || 0) + count;
            }
        }
        return merged;
    }, [gameState.army, gameState.militaryCorps]);
    const armyFoodNeed = calculateArmyFoodNeed(allPlayerMilitaryUnits);
    const wageRatio = gameState.militaryWageRatio || 1;
    // 新军费计算系统：使用完整的维护成本计算（包含规模惩罚和时代加成）
    const armyExpenseData = calculateTotalArmyExpense(
        allPlayerMilitaryUnits,
        gameState.market?.prices || {},
        gameState.epoch || 0,
        gameState.population || 100,
        wageRatio
    );
    // [FIX] 从window对象读取simulation返回的军费数据（临时方案）
    // 因为React state更新延迟，gameState.dailyMilitaryExpense总是undefined
    const simulationMilitaryExpense = gameState.dailyMilitaryExpense || window.__GAME_MILITARY_EXPENSE__;
    const militaryUpkeepMod = gameState.modifiers?.officialEffects?.militaryUpkeepMod || 0;
    // console.log('[App.jsx] Military expense final:', {
    //     simulationData: simulationMilitaryExpense,
    //     localCalc: armyExpenseData.dailyExpense,
    //     using: simulationMilitaryExpense?.dailyExpense || armyExpenseData.dailyExpense
    // });
    // 优先使用simulation数据，fallback到本地计算
    const silverUpkeepPerDay = simulationMilitaryExpense?.dailyExpense || armyExpenseData.dailyExpense;
    const tradeStats = gameState.tradeStats || { tradeTax: 0, tradeRouteTax: 0 };
    const tradeTax = tradeStats.tradeTax || 0;
    const tradeRouteTax = taxes.breakdown?.tradeRouteTax ?? tradeStats.tradeRouteTax ?? 0;
    const tradeTaxForAchievements = tradeTax + tradeRouteTax;
    const playerInstallmentExpense = (gameState.playerInstallmentPayment && gameState.playerInstallmentPayment.remainingDays > 0)
        ? gameState.playerInstallmentPayment.amount
        : 0;
    // 计算强制补贴支出
    const forcedSubsidyExpense = Array.isArray(gameState.activeEventEffects?.forcedSubsidy)
        ? gameState.activeEventEffects.forcedSubsidy.reduce((sum, s) => sum + (s.dailyAmount || 0), 0)
        : 0;

    // 计算官员薪水支出
    const officialSalaryPerDay = calculateTotalDailySalary(gameState.officials || []);

    // [FIX] 使用simulation返回的完整军队维护成本，包含资源购买、时代加成、规模惩罚
    const actualArmyUpkeep = gameState.dailyMilitaryExpense?.dailyExpense || silverUpkeepPerDay || 0;

    const baseFiscalIncome = typeof taxes.breakdown?.baseFiscalIncome === 'number'
        ? taxes.breakdown.baseFiscalIncome
        : (taxes.breakdown?.headTax || 0) + (taxes.breakdown?.industryTax || 0) +
        (taxes.breakdown?.businessTax || 0) + (taxes.breakdown?.tariff || 0) +
        (taxes.breakdown?.warIndemnity || 0);
    const incomePercentMultiplier = Number.isFinite(taxes.breakdown?.incomePercentMultiplier)
        ? Number(taxes.breakdown.incomePercentMultiplier)
        : 1;
    const totalFiscalIncome = typeof taxes.breakdown?.totalFiscalIncome === 'number'
        ? taxes.breakdown.totalFiscalIncome
        : baseFiscalIncome * incomePercentMultiplier;
    const fiscalIncomeBonus = totalFiscalIncome - baseFiscalIncome;
    const netSilverPerDay = taxes.total + fiscalIncomeBonus + tradeTax -
        actualArmyUpkeep - playerInstallmentExpense - forcedSubsidyExpense - officialSalaryPerDay;
    const netSilverClass = netSilverPerDay >= 0 ? 'text-green-300' : 'text-red-300';
    const netChipClasses = netSilverPerDay >= 0
        ? 'text-green-300 bg-green-900/20 hover:bg-green-900/40'
        : 'text-red-300 bg-red-900/20 hover:bg-red-900/40';
    const netTrendIcon = netSilverPerDay >= 0 ? 'TrendingUp' : 'TrendingDown';
    const calendar = getCalendarInfo(gameState.daysElapsed || 0);
    const autoSaveAvailable = gameState.hasAutoSave();
    useAchievements(gameState, { netSilverPerDay, tradeTax: tradeTaxForAchievements, taxes });

    const deferredResources = useThrottledSelector(
        gameState,
        state => state.resources,
        UI_THROTTLE_PRESETS.fast
    );
    const deferredMarket = useThrottledSelector(
        gameState,
        state => state.market,
        UI_THROTTLE_PRESETS.normal
    );
    const deferredBuildings = useThrottledSelector(
        gameState,
        state => state.buildings,
        UI_THROTTLE_PRESETS.slow
    );
    const deferredBuildingUpgrades = useThrottledSelector(
        gameState,
        state => state.buildingUpgrades,
        UI_THROTTLE_PRESETS.slow
    );
    const deferredJobFill = useThrottledSelector(
        gameState,
        state => state.jobFill,
        UI_THROTTLE_PRESETS.normal
    );
    const deferredBuildTabJobFill = useThrottledSelector(
        gameState,
        state => state.jobFill,
        UI_THROTTLE_PRESETS.slow
    );
    const deferredPopStructure = useThrottledSelector(
        gameState,
        state => state.popStructure,
        UI_THROTTLE_PRESETS.normal
    );
    const deferredBuildTabResources = useThrottledSelector(
        gameState,
        state => state.resources,
        UI_THROTTLE_PRESETS.slow
    );
    const deferredBuildTabMarket = useThrottledSelector(
        gameState,
        state => state.market,
        UI_THROTTLE_PRESETS.slow
    );
    const deferredBuildTabBuildingJobsRequired = useThrottledSelector(
        gameState,
        state => state.buildingJobsRequired,
        UI_THROTTLE_PRESETS.slow
    );
    const deferredBuildTabBuildingFinancialData = useThrottledSelector(
        gameState,
        state => state.buildingFinancialData,
        UI_THROTTLE_PRESETS.slow
    );
    const deferredLogs = useThrottledSelector(
        gameState,
        state => state.logs,
        UI_THROTTLE_PRESETS.slow
    );
    const deferredClassApproval = useThrottledSelector(
        gameState,
        state => state.classApproval,
        UI_THROTTLE_PRESETS.normal
    );
    const deferredClassInfluence = useThrottledSelector(
        gameState,
        state => state.classInfluence,
        UI_THROTTLE_PRESETS.normal
    );
    const deferredClassWealth = useThrottledSelector(
        gameState,
        state => state.classWealth,
        UI_THROTTLE_PRESETS.normal
    );
    const deferredClassIncomeWithSubsidy = useThrottledSelector(
        gameState,
        state => {
            const baseIncome = state.classIncome || {};
            const subsidies = state.activeEventEffects?.forcedSubsidy || [];
            if (subsidies.length === 0) return baseIncome;

            const merged = { ...baseIncome };
            subsidies.forEach(s => {
                if (s.stratumKey && s.dailyAmount) {
                    merged[s.stratumKey] = (merged[s.stratumKey] || 0) + s.dailyAmount;
                }
            });
            return merged;
        },
        UI_THROTTLE_PRESETS.normal
    );
    const deferredClassExpense = useThrottledSelector(
        gameState,
        state => state.classExpense,
        UI_THROTTLE_PRESETS.normal
    );
    const deferredClassShortages = useThrottledSelector(
        gameState,
        state => state.classShortages,
        UI_THROTTLE_PRESETS.normal
    );
    const deferredClassLivingStandard = useThrottledSelector(
        gameState,
        state => state.classLivingStandard,
        UI_THROTTLE_PRESETS.slow
    );
    const deferredRebellionStates = useThrottledSelector(
        gameState,
        state => state.rebellionStates,
        UI_THROTTLE_PRESETS.slow
    );

    const handleManualSave = () => {
        // 打开保存弹窗
        setSaveSlotModalMode('save');
        setShowSaveSlotModal(true);
    };

    const handleLoadManual = () => {
        // 打开加载弹窗
        setSaveSlotModalMode('load');
        setShowSaveSlotModal(true);
    };

    const handleSaveToSlot = (slotIndex) => {
        gameState.saveGame({ slotIndex });
        setShowSaveSlotModal(false);
    };

    const handleLoadFromSlot = (slotIndex) => {
        gameState.loadGame({ slotIndex });
        setShowSaveSlotModal(false);
    };

    const handleExportSave = async () => {
        if (typeof gameState.exportSaveToBinary === 'function') {
            try {
                await gameState.exportSaveToBinary();
            } catch (error) {
                console.error('Export save failed:', error);
            }
        }
    };

    const handleImportSave = async (file) => {
        if (typeof gameState.importSaveFromBinary === 'function') {
            return gameState.importSaveFromBinary(file);
        }
        return false;
    };

    const handleImportFromClipboard = async () => {
        if (typeof gameState.importSaveFromText === 'function') {
            return gameState.importSaveFromText();
        }
        return false;
    };

    const handleExportClipboard = async () => {
        if (typeof gameState.exportSaveToClipboard === 'function') {
            await gameState.exportSaveToClipboard();
        }
    };

    return (
        <div className="min-h-screen font-epic text-theme-text transition-all duration-1000 relative">
            {/* Dynamic Era Background */}
            <EraBackground epoch={gameState.epoch} opacity={0.08} />
            <MusicPlayer />
            <PerfOverlay />
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
                    silverUpkeepPerDay={silverUpkeepPerDay}
                    officialSalaryPerDay={officialSalaryPerDay}
                    playerInstallmentPayment={gameState.playerInstallmentPayment}
                    activeEventEffects={gameState.activeEventEffects}
                    onResourceDetailClick={(key) => {
                        if (key === 'silver') {
                            setShowEconomicDashboard(true); // 点击银币打开经济数据看板
                        } else {
                            gameState.setResourceDetailView(key);
                        }
                    }}
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
                            onLoad={handleLoadManual}
                            onSaveTransfer={() => setShowSaveTransferModal(true)}
                            onAchievements={() => setShowAchievementsModal(true)}
                            onSettings={() => setIsSettingsOpen(true)}
                            onReset={() => setShowDifficultyModal(true)}
                            onTutorial={handleReopenTutorial}
                            onWiki={() => setIsWikiOpen(true)}
                            onDonate={() => setShowDonateModal(true)}
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
                        onLoad={handleLoadManual}
                        onSaveTransfer={() => setShowSaveTransferModal(true)}
                        onAchievements={() => setShowAchievementsModal(true)}
                        onSettings={() => setIsSettingsOpen(true)}
                        onReset={() => setShowDifficultyModal(true)}
                        onTutorial={handleReopenTutorial}
                        onWiki={() => setIsWikiOpen(true)}
                        onDonate={() => setShowDonateModal(true)}
                        menuDirection="up"
                        onTriggerEvent={actions.triggerRandomEvent}
                    />
                </div>
            </div>

            {/* 占位符 - 避免内容被固定头部遮挡 */}
            <div
                className="h-14 sm:h-16 lg:h-20 header-placeholder-landscape header-safe-area-margin"
            ></div>

            {/* 移动端总览按钮 - 紧贴顶部状态栏下方，史诗金属风格 */}
            <div className="lg:hidden fixed left-1/2 -translate-x-1/2 z-40 overview-btn-safe-area">
                <button
                    type="button"
                    onClick={() => gameState.setActiveTab('overview')}
                    className={`
                        relative px-4 py-1.5 rounded-b-xl
                        flex items-center justify-center gap-1.5
                        transition-all duration-300 ease-out
                        backdrop-blur-md
                        ${gameState.activeTab === 'overview'
                            ? 'scale-105'
                            : 'active:scale-95 hover:scale-102'
                        }
                    `}
                    style={{
                        background: gameState.activeTab === 'overview'
                            ? `linear-gradient(to bottom, color-mix(in srgb, var(--theme-primary) 90%, white), var(--theme-primary), color-mix(in srgb, var(--theme-primary) 80%, black))`
                            : `linear-gradient(to bottom, rgba(55, 65, 81, 0.95), rgba(31, 41, 55, 0.95))`,
                        borderBottom: `2px solid ${gameState.activeTab === 'overview' ? 'var(--theme-accent)' : 'rgba(107, 114, 128, 0.5)'}`,
                        borderLeft: `1px solid ${gameState.activeTab === 'overview' ? 'var(--theme-accent)' : 'rgba(107, 114, 128, 0.3)'}`,
                        borderRight: `1px solid ${gameState.activeTab === 'overview' ? 'var(--theme-accent)' : 'rgba(107, 114, 128, 0.3)'}`,
                        boxShadow: gameState.activeTab === 'overview'
                            ? `0 4px 12px color-mix(in srgb, var(--theme-primary) 40%, transparent), inset 0 1px 0 rgba(255,255,255,0.2)`
                            : `0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)`,
                    }}
                >
                    {/* 金属高光效果 */}
                    <div
                        className="absolute top-0 left-2 right-2 h-px rounded-full"
                        style={{
                            background: gameState.activeTab === 'overview'
                                ? 'linear-gradient(to right, transparent, rgba(255,255,255,0.4), transparent)'
                                : 'linear-gradient(to right, transparent, rgba(255,255,255,0.1), transparent)'
                        }}
                    />

                    {/* 激活状态发光效果 */}
                    {gameState.activeTab === 'overview' && (
                        <div
                            className="absolute inset-0 rounded-b-xl opacity-20 blur-sm"
                            style={{ background: `var(--theme-primary)` }}
                        />
                    )}

                    {/* 图标 */}
                    <Icon
                        name="LayoutDashboard"
                        size={14}
                        className="relative z-10"
                        style={{
                            color: gameState.activeTab === 'overview'
                                ? 'var(--theme-text)'
                                : 'rgb(156, 163, 175)'
                        }}
                    />

                    {/* 标签 */}
                    <span
                        className="relative z-10 text-xs font-bold tab-title"
                        style={{
                            color: gameState.activeTab === 'overview'
                                ? 'var(--theme-text)'
                                : 'rgb(156, 163, 175)'
                        }}
                    >
                        总览
                    </span>
                </button>
            </div>

            {/* 主内容区域 - 移动端优先布局 */}
            <main className="max-w-[1920px] mx-auto px-2 sm:px-4 py-2 sm:py-4 pb-24 lg:pb-4 main-content-landscape" data-epoch={gameState.epoch}>
                {/* 移动端：单列布局，桌面端：三列布局 */}
                <div className="grid grid-cols-1 md:grid-cols-[2fr_8fr] lg:grid-cols-12 gap-3 sm:gap-4">

                    {/* 左侧边栏 - 桌面端显示 (使用条件渲染避免移动端渲染隐藏组件) */}
                    {isTablet && (
                        <aside className="md:col-span-1 lg:col-span-2 space-y-4 order-2 md:order-1 lg:order-1">
                            {/* 国内市场面板 - 紧凑设计 */}
                            <EpicCard variant="ancient" className="p-2 animate-fade-in-up">
                                <ResourcePanel
                                    resources={deferredResources}
                                    rates={gameState.rates}
                                    market={deferredMarket}
                                    epoch={gameState.epoch}
                                    onDetailClick={(key) => gameState.setResourceDetailView(key)}
                                />
                            </EpicCard>

                            {/* 社会阶层面板 */}
                            <StrataPanel
                                popStructure={deferredPopStructure}
                                classApproval={deferredClassApproval}
                                classInfluence={deferredClassInfluence}
                                stability={gameState.stability}
                                population={gameState.population}
                                activeBuffs={gameState.activeBuffs}
                                activeDebuffs={gameState.activeDebuffs}
                                classWealth={deferredClassWealth}
                                classWealthDelta={gameState.classWealthDelta}
                                classShortages={deferredClassShortages}
                                classIncome={deferredClassIncomeWithSubsidy}
                                classExpense={deferredClassExpense}
                                classLivingStandard={deferredClassLivingStandard}
                                rebellionStates={deferredRebellionStates}
                                officials={gameState.officials}
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
                    )}

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
                                    { id: 'tech', label: '知识', icon: 'Cpu' },
                                    { id: 'politics', label: '行政', icon: 'Gavel' },
                                    { id: 'diplo', label: '外交', icon: 'Globe' },
                                ].map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => gameState.setActiveTab(tab.id)}
                                        data-tutorial={`tab-${tab.id}`}
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
                                {/* 建设标签页 - 始终挂载以预热缓存，避免首次切换卡顿 */}
                                <div style={{ display: gameState.activeTab === 'build' ? 'block' : 'none' }}>
                                    <BuildTab
                                        buildings={deferredBuildings}
                                        resources={deferredBuildTabResources}
                                        epoch={gameState.epoch}
                                        techsUnlocked={gameState.techsUnlocked}
                                        popStructure={deferredPopStructure}
                                        jobFill={deferredBuildTabJobFill}
                                        buildingJobsRequired={deferredBuildTabBuildingJobsRequired}
                                        buildingUpgrades={deferredBuildingUpgrades}
                                        onBuy={actions.buyBuilding}
                                        onSell={actions.sellBuilding}
                                        market={deferredBuildTabMarket}
                                        buildingFinancialData={deferredBuildTabBuildingFinancialData}
                                        onShowDetails={handleShowBuildingDetails}
                                        difficulty={gameState.difficulty}
                                        buildingCostMod={gameState.modifiers?.officialEffects?.buildingCostMod || 0}
                                    />
                                </div>

                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={gameState.activeTab}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        transition={{ duration: 0.2 }}
                                    >
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
                                                day={gameState.daysElapsed}
                                                selectedTarget={gameState.selectedTarget}
                                                onRecruit={actions.recruitUnit}
                                                onDisband={actions.disbandUnit}
                                                onDisbandAll={actions.disbandAllUnits}
                                                onCancelTraining={actions.cancelTraining}
                                                onCancelAllTraining={actions.cancelAllTraining}
                                                onSelectTarget={gameState.setSelectedTarget}
                                                onLaunchBattle={actions.launchBattle}
                                                market={gameState.market}
                                                militaryWageRatio={gameState.militaryWageRatio}
                                                onUpdateWageRatio={gameState.setMilitaryWageRatio}
                                                techsUnlocked={gameState.techsUnlocked}
                                                onShowUnitDetails={handleShowUnitDetails}
                                                autoRecruitEnabled={gameState.autoRecruitEnabled}
                                                onToggleAutoRecruit={gameState.setAutoRecruitEnabled}
                                                targetArmyComposition={gameState.targetArmyComposition}
                                                onUpdateTargetComposition={gameState.setTargetArmyComposition}
                                                militaryBonus={gameState.modifiers?.militaryBonus}
                                                // [FIX] Pass unified expense data (simulation preferred for consistency with StatusBar)
                                                armyExpenseData={simulationMilitaryExpense || armyExpenseData}
                                                difficulty={gameState.difficulty}
                                                // [NEW] Military corps & front system props
                                                militaryCorps={gameState.militaryCorps}
                                                generals={gameState.generals}
                                                activeFronts={gameState.activeFronts}
                                                activeBattles={gameState.activeBattles}
                                                onUpdateCorps={gameState.setMilitaryCorps}
                                                onUpdateGenerals={gameState.setGenerals}
                                                onUpdateArmy={gameState.setArmy}
                                                onAssignCorpsToFront={handleAssignCorpsToFront}
                                                onRemoveCorpsFromFront={handleRemoveCorpsFromFront}
                                                onSetBattleTactic={handleSetBattleTactic}
                                                onCreateBattle={handleCreateBattle}
                                                onSetPosture={handleSetPosture}
                                                officials={gameState.officials}
                                                corpsReplenishQueue={gameState.corpsReplenishQueue}
                                                onUpdateCorpsReplenishQueue={gameState.setCorpsReplenishQueue}
                                                autoRecruitEnabled={gameState.autoRecruitEnabled}
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
                                                difficulty={gameState.difficulty}
                                                // 理念系统 props
                                                ideologyScore={gameState.ideologyScore}
                                                ideologyScoreSpent={gameState.ideologyScoreSpent}
                                                ideologyCollection={gameState.ideologyCollection}
                                                equippedIdeologies={gameState.equippedIdeologies}
                                                ideologySlotCount={gameState.ideologySlotCount}
                                                ideologyCooldowns={gameState.ideologyCooldowns}
                                                setEquippedIdeologies={gameState.setEquippedIdeologies}
                                                setIdeologyCooldowns={gameState.setIdeologyCooldowns}
                                                setIdeologySlotCount={gameState.setIdeologySlotCount}
                                            />
                                        )}

                                        {/* 政令标签页 */}
                                        {gameState.activeTab === 'politics' && (
                                            <PoliticsTab
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
                                                buildingFinancialData={gameState.buildingFinancialData}
                                                // 执政联盟 props
                                                rulingCoalition={gameState.rulingCoalition}
                                                onUpdateCoalition={gameState.setRulingCoalition}
                                                classInfluence={gameState.classInfluence}
                                                totalInfluence={gameState.totalInfluence}
                                                legitimacy={gameState.legitimacy}
                                                classApproval={gameState.classApproval}

                                                // 银币相关 props
                                                silver={gameState.resources?.silver || 0}
                                                onSpendSilver={(amount) => {
                                                    gameState.setResources(prev => ({
                                                        ...prev,
                                                        silver: Math.max(0, (prev.silver || 0) - amount)
                                                    }), { reason: 'politics_spend_silver', meta: { amount } });
                                                }}

                                                // 官员系统 props
                                                // 官员系统 props
                                                officials={gameState.officials}
                                                candidates={gameState.officialCandidates}
                                                capacity={Math.min(gameState.jobsAvailable?.official || 0, gameState.officialCapacity ?? 2)}
                                                // [NEW] 传递详细容量信息用于显示
                                                jobCapacity={gameState.jobsAvailable?.official || 0}
                                                maxCapacity={gameState.officialCapacity ?? 2}

                                                lastSelectionDay={gameState.lastSelectionDay}
                                                currentTick={gameState.daysElapsed}
                                                onTriggerSelection={actions.triggerOfficialSelection}
                                                onHire={actions.hireNewOfficial}
                                                onFire={actions.fireExistingOfficial}
                                                onDispose={actions.disposeExistingOfficial}
                                                onUpdateOfficialSalary={actions.updateOfficialSalary}
                                                onUpdateOfficialName={actions.updateOfficialName}
                                                ministerAssignments={gameState.ministerAssignments}
                                                ministerAutoExpansion={gameState.ministerAutoExpansion}
                                                lastMinisterExpansionDay={gameState.lastMinisterExpansionDay}
                                                onAssignMinister={actions.assignMinister}
                                                onClearMinister={actions.clearMinisterRole}
                                                onToggleMinisterAutoExpansion={actions.toggleMinisterAutoExpansion}
                                                resources={gameState.resources}

                                                // [NEW] 传递政治立场检查所需的上下文
                                                stanceContext={{
                                                    classApproval: gameState.classApproval,
                                                    classInfluence: gameState.classInfluence,
                                                    classLivingStandard: gameState.classLivingStandard,
                                                    classIncome: gameState.classWealth, // 近似替代，或需要从 history 获取
                                                    // classIncome: gameState.classIncome, // useGameLoop 如果导出了这个最好
                                                    stability: (gameState.stability ?? 50) / 100, // 转换为0-1范围，与simulation.js保持一致
                                                    legitimacy: gameState.legitimacy,
                                                    rulingCoalition: gameState.rulingCoalition,
                                                    taxPolicies: gameState.taxPolicies,
                                                    market: gameState.market,
                                                    prices: gameState.market?.prices,
                                                    population: gameState.population,
                                                    epoch: gameState.epoch,
                                                    atWar: gameState.atWar || gameState.nations?.some(n => n.isAtWar),
                                                    totalInfluence: gameState.totalInfluence,
                                                    polityEffects: gameState.polityEffects,
                                                }}

                                                // 内阁协同系统 props
                                                classWealth={gameState.classWealth}
                                                activeDecrees={gameState.activeDecrees}
                                                decreeCooldowns={gameState.decreeCooldowns}
                                                quotaTargets={gameState.quotaTargets}
                                                expansionSettings={gameState.expansionSettings}
                                                onUpdateQuotas={(newQuotas) => gameState.setQuotaTargets(newQuotas)}
                                                onUpdateExpansionSettings={(newSettings) => gameState.setExpansionSettings(newSettings)}
                                                // [NEW] 价格管制 props
                                                priceControls={gameState.priceControls}
                                                onUpdatePriceControls={(newControls) => gameState.setPriceControls(newControls)}
                                                onEnactDecree={(decreeId) => {
                                                    // 颁布法令逻辑
                                                    const decree = getAllTimedDecrees()[decreeId];
                                                    if (!decree) return;

                                                    const result = enactDecree(
                                                        decreeId,
                                                        gameState.activeDecrees,
                                                        gameState.decreeCooldowns,
                                                        gameState.daysElapsed
                                                    );

                                                    if (result.success) {
                                                        gameState.setActiveDecrees(result.newActiveDecrees);
                                                        gameState.setDecreeCooldowns(result.newCooldowns);
                                                        if (result.cost > 0) {
                                                            gameState.setResources(prev => ({
                                                                ...prev,
                                                                silver: Math.max(0, (prev.silver || 0) - result.cost)
                                                            }), { reason: 'decree_enact_cost', meta: { decreeId } });
                                                        }
                                                        gameState.setLogs(prev => [`颁布法令：${decree.name}`, ...prev].slice(0, 8));
                                                    }
                                                }}
                                                // [NEW] 忠诚度系统 UI 相关
                                                stability={gameState.stability}
                                                officialsPaid={(gameState.resources?.silver || 0) >= officialSalaryPerDay}

                                                // [NEW] Permanent policy decrees (legacy)
                                                decrees={gameState.decrees}
                                                onToggleDecree={actions.toggleDecree}
                                                generals={gameState.generals}
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
                                                tradeOpportunities={gameState.tradeOpportunities} // [NEW] Backend-driven opportunities
                                                onTradeRouteAction={actions.handleTradeRouteAction}
                                                merchantState={gameState.merchantState}
                                                onMerchantStateChange={gameState.setMerchantState}
                                                playerInstallmentPayment={gameState.playerInstallmentPayment}
                                                jobsAvailable={gameState.jobsAvailable}
                                                popStructure={gameState.popStructure}
                                                taxPolicies={gameState.taxPolicies}
                                                diplomaticCooldownMod={gameState.modifiers?.officialEffects?.diplomaticCooldown || 0}
                                                diplomacyOrganizations={gameState.diplomacyOrganizations}
                                                overseasInvestments={gameState.overseasInvestments}
                                                classWealth={gameState.classWealth}
                                                foreignInvestments={gameState.foreignInvestments}
                                                foreignInvestmentPolicy={gameState.foreignInvestmentPolicy}
                                                gameState={gameState}
                                                vassalDiplomacyQueue={gameState.vassalDiplomacyQueue}
                                                vassalDiplomacyHistory={gameState.vassalDiplomacyHistory}
                                                onApproveVassalDiplomacy={actions.approveVassalDiplomacyAction}
                                                onRejectVassalDiplomacy={actions.rejectVassalDiplomacyAction}
                                                onIssueVassalOrder={actions.issueVassalDiplomacyOrder}
                                            />
                                        )}

                                        {/* 总览标签页 - 移动端专属 */}
                                        {gameState.activeTab === 'overview' && (
                                            <OverviewTab
                                                // 阶层相关
                                                popStructure={deferredPopStructure}
                                                classApproval={deferredClassApproval}
                                                classInfluence={deferredClassInfluence}
                                                stability={gameState.stability}
                                                population={gameState.population}
                                                activeBuffs={gameState.activeBuffs}
                                                activeDebuffs={gameState.activeDebuffs}
                                                classWealth={deferredClassWealth}
                                                classWealthDelta={gameState.classWealthDelta}
                                                classShortages={deferredClassShortages}
                                                classIncome={deferredClassIncomeWithSubsidy}
                                                classExpense={deferredClassExpense}
                                                classLivingStandard={deferredClassLivingStandard}
                                                rebellionStates={deferredRebellionStates}
                                                officials={gameState.officials}
                                                onStratumDetailClick={handleStratumDetailClick}
                                                // 市场相关
                                                resources={deferredResources}
                                                rates={gameState.rates}
                                                market={deferredMarket}
                                                epoch={gameState.epoch}
                                                onResourceDetailClick={(key) => {
                                                    if (key === 'silver') {
                                                        setShowEconomicDashboard(true); // 点击银币打开经济数据看板
                                                    } else {
                                                        gameState.setResourceDetailView(key);
                                                    }
                                                }}
                                                // 日志
                                                logs={deferredLogs}
                                            />
                                        )}
                                    </motion.div>
                                </AnimatePresence>
                            </div>
                        </div>
                    </section>

                    {/* 右侧边栏 - 桌面端显示 (使用条件渲染避免移动端渲染隐藏组件) */}
                    {isDesktop && (
                        <aside className="lg:col-span-2 order-3 space-y-4">
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
                                    empireName={gameState.empireName}
                                    isVisible={true}  // 桌面端侧边栏始终可见
                                />
                            </div>

                            {/* 日志面板 */}
                            <LogPanel logs={deferredLogs} />

                            {/* 游戏提示 - 紧凑折叠设计 */}
                            <details className="glass-ancient rounded-xl border border-blue-500/20 shadow-md group">
                                <summary className="px-3 py-2 cursor-pointer flex items-center justify-between text-xs font-bold text-blue-300 hover:text-blue-200 transition-colors">
                                    <span className="flex items-center gap-2">
                                        <Icon name="Lightbulb" size={12} />
                                        统治指南
                                    </span>
                                    <Icon name="ChevronDown" size={12} className="transform group-open:rotate-180 transition-transform" />
                                </summary>
                                <div className="px-3 pb-3 text-xs text-gray-300 space-y-1.5">
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
                                <div className="px-3 pb-3 text-xs text-gray-200 space-y-1.5">
                                    <p><span className="text-white font-semibold">1.</span> 确保银币正增长</p>
                                    <p><span className="text-white font-semibold">2.</span> 在政令面板调整税率</p>
                                    <p><span className="text-white font-semibold">3.</span> 建设工业赚取税收</p>
                                    <p><span className="text-white font-semibold">4.</span> 满足阶层消费需求</p>
                                </div>
                            </details>
                        </aside>
                    )}
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
                        onUpgrade={actions.upgradeBuilding}
                        onDowngrade={actions.downgradeBuilding}
                        onBatchUpgrade={actions.batchUpgradeBuilding}
                        onBatchDowngrade={actions.batchDowngradeBuilding}
                        taxPolicies={gameState.taxPolicies}
                        onUpdateTaxPolicies={gameState.setTaxPolicies}
                        scrollToUpgrade={activeSheet.options?.scrollToUpgrade}
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
                        approvalBreakdown={gameState.approvalBreakdown}
                        classInfluence={gameState.classInfluence}
                        classWealth={gameState.classWealth}
                        classWealthDelta={gameState.classWealthDelta}
                        classIncome={deferredClassIncomeWithSubsidy}
                        classExpense={gameState.classExpense}
                        classFinancialData={gameState.classFinancialData}
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
                        market={gameState.market}
                        militaryPower={currentMilitaryPower}
                        promiseTasks={gameState.promiseTasks}
                        nations={gameState.nations}
                        epoch={gameState.epoch}
                        techsUnlocked={gameState.techsUnlocked}
                        officials={gameState.officials} // Pass officials data for average loyalty calculation

                        // Extra approval drivers (so UI can explain 'mysterious' drops)
                        legitimacyTaxModifier={gameState.legitimacyTaxModifier}
                        taxShock={gameState.taxShock}
                        eventApprovalModifiers={gameState.eventApprovalModifiers}
                        decreeApprovalModifiers={gameState.decreeApprovalModifiers}
                        legitimacyApprovalModifier={gameState.legitimacyApprovalModifier}

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
                        onDisbandAll={actions.disbandAllUnits}
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
                        difficulty={gameState.difficulty}
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
                    popStructure={deferredPopStructure}
                    classApproval={deferredClassApproval}
                    classInfluence={deferredClassInfluence}
                    stability={gameState.stability}
                    population={gameState.population}
                    activeBuffs={gameState.activeBuffs}
                    activeDebuffs={gameState.activeDebuffs}
                    classWealth={deferredClassWealth}
                    classWealthDelta={gameState.classWealthDelta}
                    classShortages={deferredClassShortages}
                    classIncome={deferredClassIncomeWithSubsidy}
                    classExpense={deferredClassExpense}
                    classLivingStandard={deferredClassLivingStandard}
                    rebellionStates={deferredRebellionStates}
                    officials={gameState.officials}
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
                    resources={deferredResources}
                    rates={gameState.rates}
                    market={deferredMarket}
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
                            empireName={gameState.empireName}
                            isVisible={showEmpireScene}  // 移动端只在打开时激活动画
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
                                                            <span className={`text-xs px-1.5 py-0.5 rounded ${isExpired
                                                                ? 'bg-gray-600/30 text-gray-400'
                                                                : isPermanent
                                                                    ? 'bg-purple-500/30 text-purple-300'
                                                                    : 'bg-yellow-500/30 text-yellow-300'
                                                                }`}>
                                                                {isExpired ? '已过期' : isPermanent ? '永久' : '短期'}
                                                            </span>
                                                        </div>
                                                        <div className="text-xs text-ancient-stone mt-0.5">
                                                            第 {activatedYear} 年选择
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => setExpandedFestival(isExpanded ? null : uniqueKey)}
                                                        className="text-xs text-gray-400 hover:text-white transition-colors p-1 rounded-md"
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
                            <p className="text-xs text-gray-500 mt-1">每年年初会触发庆典选择</p>
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

            <AchievementToast
                notifications={gameState.achievementNotifications || []}
                onDismiss={(notificationId) => {
                    gameState.dismissAchievementNotification(notificationId);
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
                    officials={gameState.officials}
                    onClose={() => gameState.setStratumDetailView(null)}
                />
            )}

            {/* 资源详情模态框 */}
            {gameState.resourceDetailView && (
                <ResourceDetailModal
                    resourceKey={gameState.resourceDetailView}
                    resources={gameState.resources}
                    treasuryChangeLog={gameState.treasuryChangeLog}
                    daysElapsed={gameState.daysElapsed}
                    market={gameState.market}
                    buildings={gameState.buildings}
                    popStructure={gameState.popStructure}
                    wealth={gameState.classWealth}
                    classIncome={deferredClassIncomeWithSubsidy}
                    classLivingStandard={gameState.classLivingStandard}
                    army={gameState.army}
                    dailyMilitaryExpense={gameState.dailyMilitaryExpense}
                    history={gameState.history}
                    epoch={gameState.epoch}
                    techsUnlocked={gameState.techsUnlocked}
                    onClose={() => gameState.setResourceDetailView(null)}
                    taxPolicies={gameState.taxPolicies}
                    onUpdateTaxPolicies={gameState.setTaxPolicies}
                    activeDebuffs={gameState.activeDebuffs}
                    buildingFinancialData={gameState.buildingFinancialData}
                    economicIndicators={gameState.economicIndicators}
                />
            )}

            {/* 经济数据看板 */}
            <EconomicDashboard
                isOpen={showEconomicDashboard}
                onClose={() => setShowEconomicDashboard(false)}
                economicIndicators={gameState.economicIndicators}
                history={gameState.history}
                marketPrices={gameState.market?.prices || {}}
                equilibriumPrices={gameState.equilibriumPrices || {}}
                classFinancialData={gameState.classFinancialData || {}}
                treasury={gameState.resources?.silver || 0}
                dailyTreasuryIncome={netSilverPerDay || 0}
            />

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
                wrapperClassName="z-[80]"
            >
                {gameState.currentEvent && (
                    <EventDetail
                        event={gameState.currentEvent}
                        onSelectOption={handleEventOption}
                        onClose={() => gameState.setCurrentEvent(null)}
                        nations={gameState.nations}
                        epoch={gameState.epoch}
                        techsUnlocked={gameState.techsUnlocked}
                        confirmationEnabled={gameState.eventConfirmationEnabled}
                    />
                )}
            </BottomSheet>

            {/* 新手教程模态框（原静态教程，已被交互式教程取代）
               如需恢复，设置 show={!tutorialSystem.isActive && gameState.showTutorial}
            */}
            {/* <TutorialModal
                show={gameState.showTutorial}
                onComplete={handleTutorialComplete}
                onSkip={handleTutorialSkip}
                onOpenWiki={() => setIsWikiOpen(true)}
            /> */}

            {/* 交互式新手教程 */}
            <TutorialOverlay
                isActive={tutorialSystem.isActive}
                currentStep={tutorialSystem.currentStep}
                stepNumber={tutorialSystem.stepNumber}
                totalSteps={tutorialSystem.totalSteps}
                targetRect={tutorialSystem.targetRect}
                onSkip={tutorialSystem.skipTutorial}
                onNext={tutorialSystem.nextStep}
                onClick={tutorialSystem.handleClick}
                isDetailOpen={activeSheet.type !== null}
            />

            {/* 百科模态框 */}
            <WikiModal
                show={isWikiOpen}
                onClose={() => setIsWikiOpen(false)}
            />

            {/* 官员超编强制解雇弹窗 */}
            {showOfficialOverstaffModal && (
                <OfficialOverstaffModal
                    officials={gameState.officials}
                    currentCount={gameState.officials?.length || 0}
                    maxCapacity={gameState.officialCapacity ?? 2}
                    onFireOfficial={handleOfficialOverstaffFire}
                    onClose={() => {
                        overstaffModalShownRef.current = false; // Reset ref to allow re-triggering
                        setShowOfficialOverstaffModal(false);
                    }}
                />
            )}

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
                            onExportSave={handleExportSave}
                            onImportSave={handleImportSave}
                            isSaving={gameState.isSaving}
                            timeSettings={gameState.eventEffectSettings}
                            onTimeSettingsChange={gameState.setEventEffectSettings}
                            difficulty={gameState.difficulty}
                            onDifficultyChange={gameState.setDifficulty}
                            onClose={() => setIsSettingsOpen(false)}
                            eventConfirmationEnabled={gameState.eventConfirmationEnabled}
                            onToggleEventConfirmation={gameState.setEventConfirmationEnabled}
                            showMerchantTradeLogs={gameState.eventEffectSettings?.logVisibility?.showMerchantTradeLogs ?? true}
                            onToggleMerchantTradeLogs={(enabled) => gameState.setEventEffectSettings(prev => ({
                                ...(prev || {}),
                                logVisibility: {
                                    ...((prev || {}).logVisibility || {}),
                                    showMerchantTradeLogs: enabled,
                                    showTradeRouteLogs: enabled,
                                },
                            }))}
                            showOfficialLogs={gameState.eventEffectSettings?.logVisibility?.showOfficialLogs ?? true}
                            onToggleOfficialLogs={(enabled) => gameState.setEventEffectSettings(prev => ({
                                ...(prev || {}),
                                logVisibility: {
                                    ...((prev || {}).logVisibility || {}),
                                    showOfficialLogs: enabled,
                                }
                            }))}
                        />
                    </div>
                </div>
            )}

            {/* 难度选择弹窗 */}
            <DifficultySelectionModal
                isOpen={showDifficultyModal}
                onConfirm={({ difficulty, scenarioId, empireName }) => {
                    setShowDifficultyModal(false);
                    gameState.resetGame({ difficulty, scenarioId, empireName });
                }}
                onCancel={() => setShowDifficultyModal(false)}
            />

            {/* 存档槽位选择弹窗 */}
            <SaveSlotModal
                isOpen={showSaveSlotModal}
                mode={saveSlotModalMode}
                onSelect={saveSlotModalMode === 'save' ? handleSaveToSlot : handleLoadFromSlot}
                onCancel={() => setShowSaveSlotModal(false)}
            />

            {/* 存档传输弹窗 */}
            <SaveTransferModal
                isOpen={showSaveTransferModal}
                onClose={() => setShowSaveTransferModal(false)}
                onExportFile={handleExportSave}
                onExportClipboard={handleExportClipboard}
                onImportFile={handleImportSave}
                onImportClipboard={handleImportFromClipboard}
            />

            {/* 成就弹窗 */}
            <AchievementsModal
                isOpen={showAchievementsModal}
                onClose={() => setShowAchievementsModal(false)}
                unlockedAchievements={gameState.unlockedAchievements}
            />

            {/* 打赏作者弹窗 */}
            <DonateModal
                isOpen={showDonateModal}
                onClose={() => setShowDonateModal(false)}
            />

            {/* 理念涌现弹窗 */}
            <IdeologyEmergenceModal
                show={!!gameState.pendingIdeologyEmergence}
                candidates={gameState.pendingIdeologyEmergence?.candidates || []}
                equippedIds={gameState.equippedIdeologies || []}
                onSelect={(ideologyId) => {
                    // 处理涌现选择
                    const result = selectIdeology(ideologyId, gameState.ideologyCollection || []);
                    gameState.setIdeologyCollection(result.updatedCollection);
                    // 消耗分数
                    const threshold = getEmergenceThreshold((gameState.ideologyCollection || []).length);
                    gameState.setIdeologyScoreSpent((gameState.ideologyScoreSpent || 0) + threshold);
                    // 清除涌现事件
                    gameState.setPendingIdeologyEmergence(null);
                }}
            />
        </div>
    );
}
