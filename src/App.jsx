// 文明崛起 - 主应用文件
// 使用拆分后的钩子和组件，保持代码简洁

import React, { useEffect, useRef, useState } from 'react';
import { GAME_SPEEDS, EPOCHS, RESOURCES, STRATA, calculateArmyFoodNeed, BUILDINGS } from './config';
import { getCalendarInfo } from './utils/calendar';
import { useGameState, useGameLoop, useGameActions, useSound } from './hooks';
import {
  Icon,
  FloatingText
} from './components/common/UIComponents';
import { StatusBar } from './components/layout/StatusBar';
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
  // 添加日志函数
  const addLog = (msg) => {
    if (gameState?.setLogs) {
      gameState.setLogs(prev => [msg, ...prev].slice(0, 8));
    }
  };

  // 现在 gameState 肯定存在，可以安全调用这些钩子
  useGameLoop(gameState, addLog);
  const actions = useGameActions(gameState, addLog);
  const { playSound, SOUND_TYPES } = useSound();
  const [showStrata, setShowStrata] = useState(false);
  const [showMarket, setShowMarket] = useState(false);  // 新增：控制国内市场弹窗

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
    gameState.setIsPaused(false);
    
    // 添加日志
    const effectType = selectedEffect.type === 'permanent' ? '永久' : '短期';
    addLog(`🎊 庆典效果「${selectedEffect.name}」已激活！（${effectType}）`);
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

  // 计算税收和军队相关数据
  const taxes = gameState.taxes || { total: 0, breakdown: { headTax: 0, industryTax: 0, subsidy: 0 }, efficiency: 1 };
  const dayScale = Math.max(gameState.gameSpeed || 0, 0.0001);
  const armyFoodNeed = calculateArmyFoodNeed(gameState.army || {});
  const foodPrice = gameState.market?.prices?.food ?? (RESOURCES.food?.basePrice || 1);
  const wageRatio = gameState.militaryWageRatio || 1;
  const silverUpkeepPerDay = armyFoodNeed * foodPrice * wageRatio;
  const netSilverPerDay = taxes.total - silverUpkeepPerDay;
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
    <div className={`min-h-screen font-sans text-gray-100 ${EPOCHS[gameState.epoch].bg} transition-colors duration-1000`}>
      {/* 浮动文本 */}
      {gameState.clicks.map(c => (
        <FloatingText 
          key={c.id} 
          {...c} 
          onComplete={() => gameState.setClicks(prev => prev.filter(x => x.id !== c.id))} 
        />
      ))}

      {/* 顶部状态栏 - 包含游戏控制（桌面端） */}
      <div className="fixed top-0 left-0 right-0 z-50">        <StatusBar
        gameState={gameState}
        taxes={taxes}
        netSilverPerDay={netSilverPerDay}
        armyFoodNeed={armyFoodNeed}
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
          />
        }
      />
      </div>
      {/* 移动端游戏控制 - 浮动按钮（移到底部，避免与顶部栏重叠） */}
      <div className="lg:hidden fixed bottom-24 right-4 z-40">
        {/* flex-col-reverse 会将子元素的堆叠顺序反转，从而使下拉菜单向上弹出 */}
        <div className="flex flex-col-reverse gap-2 scale-95 origin-bottom-right">
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
          />
        </div>
      </div>

      {/* 占位符 - 避免内容被固定头部遮挡 */}
      <div className="h-24 lg:h-32"></div>

      {/* 主内容区域 - 移动端优先布局 */}
      <main className="max-w-[1920px] mx-auto px-3 sm:px-4 py-4 pb-24 lg:pb-4">
        {/* 移动端：单列布局，桌面端：三列布局 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4">
          
          {/* 左侧边栏 - 桌面端显示 */}
          <aside className="hidden lg:block lg:col-span-2 space-y-4 order-2 lg:order-1">
            {/* 资源面板 - 使用 Grid 布局优化排版 */}
            <div className="bg-gray-900/60 backdrop-blur-md rounded-xl border border-white/10 shadow-glass p-3">
              <div className="flex items-center gap-2 mb-3">
                <Icon name="Package" size={16} className="text-amber-400" />
                <h3 className="text-sm font-bold text-white">国内市场</h3>
              </div>
              <div className="grid grid-cols-1 gap-1">
                <ResourcePanel 
                  resources={gameState.resources} 
                  rates={gameState.rates} 
                  market={gameState.market}
                  epoch={gameState.epoch}
                  onDetailClick={(key) => gameState.setResourceDetailView(key)}
                />
              </div>
            </div>

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
              dayScale={gameState.gameSpeed}
              onDetailClick={handleStratumDetailClick}
            />

            {/* 手动采集按钮 */}
            <button 
              onClick={manualGather} 
              className="w-full py-3 bg-gradient-to-r from-emerald-700 to-emerald-600 hover:from-emerald-600 hover:to-emerald-500 rounded-xl font-bold shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Icon name="Pickaxe" size={16} /> 手动采集
            </button>
          </aside>

          {/* 中间内容区 - 主操作面板 */}
          <section className="lg:col-span-8 space-y-3 sm:space-y-4 order-1 lg:order-2 relative z-10">
            {/* 标签页容器 */}
            <div className="bg-gray-900/60 backdrop-blur-md rounded-xl border border-white/10 shadow-glass overflow-hidden min-h-[500px] animate-fade-in">
              {/* 桌面端标签页导航 */}
              <div className="hidden lg:flex border-b border-white/10 bg-gray-800/30 overflow-x-auto">
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
                    className={`flex-1 min-w-[80px] py-3 flex items-center justify-center gap-2 text-sm font-bold transition-all ${
                      gameState.activeTab === tab.id 
                        ? 'bg-gray-700/50 text-white border-b-2 border-blue-500 shadow-glow-sm' 
                        : 'text-gray-400 hover:bg-gray-800/30 hover:text-gray-200'
                    }`}
                  >
                    <Icon name={tab.icon} size={16} /> {tab.label}
                  </button>
                ))}
              </div>

              {/* 标签页内容 */}
              <div className="p-3 sm:p-4">
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
                  adminCap={gameState.adminCap}
                  nations={gameState.nations}
                  selectedTarget={gameState.selectedTarget}
                  onRecruit={actions.recruitUnit}
                  onDisband={actions.disbandUnit}
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
                />
              )}
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
              />
            </div>
            
            {/* 日志面板 */}
            <LogPanel logs={gameState.logs} />
            
            {/* 游戏提示 */}
            <div className="bg-blue-900/20 backdrop-blur-sm border border-blue-500/20 p-4 rounded-xl text-xs text-gray-300 space-y-2 shadow-md">
              <h4 className="font-bold text-blue-300 flex items-center gap-2">
                <Icon name="Lightbulb" size={14} />
                统治指南
              </h4>
              <p>• <span className="text-white">市场是经济核心</span>：所有资源（除银币）都在市场流通。建筑产出资源会增加市场供应，而阶层与军队消耗资源会增加市场需求。供需关系决定价格，价格反过来影响阶层财富和国家税收。</p>
              <p>• <span className="text-white">国库与库存</span>：你的国库只储存银币。所有建设、研究、招募所需的资源，若库存不足，都会<span className="text-yellow-300">自动消耗银币</span>从市场按当前价格购买。因此，银币是维持国家运转的命脉。</p>
              <p>• <span className="text-white">三大税收来源</span>：在【政令】面板调整税率。<b>人头税</b>直接向各阶层收税，但会降低其财富和满意度；<b>交易税</b>对市场上的资源交易抽成，高价商品是主要税源；<b>营业税</b>对建筑每次产出征税，可精准打击高利润产业。</p>
              <p>• <span className="text-white">补贴亦是工具</span>：将税率设为负数即为补贴。补贴可以扶持关键产业、提升阶层满意度或压低某种生活必需品的价格，是重要的宏观调控手段。</p>
            </div>

            <div className="bg-emerald-900/20 backdrop-blur-sm border border-emerald-500/20 p-4 rounded-xl text-xs text-gray-200 space-y-3 shadow-md">
              <h4 className="font-bold text-emerald-300 flex items-center gap-2">
                <Icon name="BookOpen" size={14} />
                新手入门
              </h4>
              <div className="space-y-1">
                <p className="text-white font-semibold">1. 理解市场与银币</p>
                <p>你的首要目标是<span className="text-yellow-300">确保银币正增长</span>。点击顶部的银币收入，查看税收详情。初期税收主要来自人头税。记住，所有非银币资源都通过市场交易，你的任何消耗都会自动花费银币购买。</p>
              </div>
              <div className="space-y-1">
                <p className="text-white font-semibold">2. 调整税收</p>
                <p>前往【政令】面板的<span className="text-green-300">税收政策</span>。初期可适当提高富裕阶层（如地主）的<span className="text-white">人头税系数</span>来增加收入。观察顶部的银币净收入变化，找到平衡点，避免过度压榨导致阶层财富下降。</p>
              </div>
              <div className="space-y-1">
                <p className="text-white font-semibold">3. 发展产业链</p>
                <p>建设【工业】建筑（如砖厂、工具铺）来生产高价值商品。这不仅能满足后续发展需要，还能通过<span className="text-white">交易税</span>和<span className="text-white">营业税</span>创造巨额财政收入。高价商品是你的主要税基。</p>
              </div>
              <div className="space-y-1">
                <p className="text-white font-semibold">4. 关注阶层需求</p>
                <p>点击左侧的阶层可以查看详情。满足他们的<span className="text-blue-300">消费需求</span>能提升其财富和满意度，从而让你能征收更多的税。例如，为工匠提供啤酒和家具，他们会变得更富有，你的人头税收入也会随之增加。</p>
              </div>
            </div>
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
          />        )}
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
            classApproval={gameState.classApproval}
            classInfluence={gameState.classInfluence}
            classWealth={gameState.classWealth}
            classIncome={gameState.classIncome}
            classExpense={gameState.classExpense}
            classShortages={gameState.classShortages}
            activeBuffs={gameState.activeBuffs}
            activeDebuffs={gameState.activeDebuffs}
            dayScale={gameState.gameSpeed}
          taxPolicies={gameState.taxPolicies}
          onUpdateTaxPolicies={gameState.setTaxPolicies}
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
          dayScale={gameState.gameSpeed}
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
        <div className="space-y-2">
          <ResourcePanel 
            resources={gameState.resources} 
            rates={gameState.rates} 
            market={gameState.market}
            epoch={gameState.epoch}
            onDetailClick={(key) => {
              setShowMarket(false);
              gameState.setResourceDetailView(key);
            }}
          />
        </div>
      </BottomSheet>

      {/* 帝国场景底部面板（移动端） */}
      <BottomSheet
        isOpen={showEmpireScene}
        onClose={() => setShowEmpireScene(false)}
        title={`帝国场景 - ${calendar.season} · 第${calendar.year}年`}
        showHeader={true}
      >
        <div className="bg-gray-900/60 backdrop-blur-md rounded-lg border border-white/10 shadow-glass overflow-hidden">
          <EmpireScene
            daysElapsed={gameState.daysElapsed}
            season={calendar.season}
            population={gameState.population}
            stability={gameState.stability}
            wealth={gameState.resources.silver}
            epoch={gameState.epoch}
          />
        </div>
      </BottomSheet>

      {/* 战斗结果模态框 */}
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
          army={gameState.army}
          history={gameState.history}
          onClose={() => gameState.setResourceDetailView(null)}
          taxPolicies={gameState.taxPolicies}
          onUpdateTaxPolicies={gameState.setTaxPolicies}
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
              onClose={() => setIsSettingsOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
