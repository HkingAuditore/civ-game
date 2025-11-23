// 文明崛起 - 主应用文件
// 使用拆分后的钩子和组件，保持代码简洁

import React, { useState } from 'react';
import { GAME_SPEEDS, EPOCHS, RESOURCES, calculateArmyFoodNeed } from './config';
import { getCalendarInfo } from './utils/calendar';
import { useGameState, useGameLoop, useGameActions } from './hooks';
import {
  Icon,
  FloatingText,
  ResourcePanel,
  StrataPanel,
  LogPanel,
  BuildTab,
  MilitaryTab,
  TechTab,
  PoliticsTab,
  DiplomacyTab,
  BattleResultModal,
  StratumDetailModal,
  AnnualFestivalModal,
  TutorialModal,
} from './components';

/**
 * 文明崛起主应用组件
 * 整合所有游戏系统和UI组件
 */
export default function RiseOfCivs() {
  // 使用自定义钩子管理状态
  const gameState = useGameState();
  
  // 调试：检查gameState是否正确初始化
  if (!gameState) {
    console.error('gameState is null or undefined');
    return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">游戏状态初始化失败</h1>
        <p>请检查浏览器控制台获取更多信息</p>
      </div>
    </div>;
  }
  
  // 添加日志函数
  const addLog = (msg) => {
    gameState.setLogs(prev => [msg, ...prev].slice(0, 8));
  };
  
  // 使用游戏循环钩子
  useGameLoop(gameState, addLog);
  
  // 使用操作函数钩子
  const actions = useGameActions(gameState, addLog);
  
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

  const [showTaxDetail, setShowTaxDetail] = useState(false);
  const taxes = gameState.taxes || { total: 0, breakdown: { headTax: 0, industryTax: 0, subsidy: 0 }, efficiency: 1 };
  const dayScale = Math.max(gameState.gameSpeed || 0, 0.0001);
  const taxesPerDay = taxes.total / dayScale;
  const armyFoodNeed = calculateArmyFoodNeed(gameState.army || {});
  const foodPrice = gameState.market?.prices?.food ?? (RESOURCES.food?.basePrice || 1);
  const wageRatio = gameState.militaryWageRatio || 1;
  const silverUpkeepPerDay = armyFoodNeed * foodPrice * wageRatio;
  const netSilverPerDay = taxesPerDay - silverUpkeepPerDay;
  const netSilverClass = netSilverPerDay >= 0 ? 'text-green-300' : 'text-red-300';
  const netChipClasses = netSilverPerDay >= 0
    ? 'text-green-300 bg-green-900/20 hover:bg-green-900/40'
    : 'text-red-300 bg-red-900/20 hover:bg-red-900/40';
  const netTrendIcon = netSilverPerDay >= 0 ? 'TrendingUp' : 'TrendingDown';
  const calendar = getCalendarInfo(gameState.daysElapsed || 0);

  return (
    <div className={`min-h-screen font-sans text-gray-100 ${EPOCHS[gameState.epoch].bg} transition-colors duration-1000 pb-20`}>
      {/* 浮动文本动画样式 */}
      <style>{`
        @keyframes float-up { 0% { opacity:1; transform:translateY(0); } 100% { opacity:0; transform:translateY(-30px); } }
        .animate-float-up { animation: float-up 0.8s ease-out forwards; }
      `}</style>

      {/* 浮动文本 */}
      {gameState.clicks.map(c => (
        <FloatingText 
          key={c.id} 
          {...c} 
          onComplete={() => gameState.setClicks(prev => prev.filter(x => x.id !== c.id))} 
        />
      ))}

      {/* 头部导航栏 */}
      <header className="bg-gray-900/90 backdrop-blur p-4 sticky top-0 z-20 border-b border-gray-700 shadow-xl">
        <div className="max-w-[1920px] mx-auto flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Logo和时代 */}
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-500/20">
                <Icon name="Globe" size={20} />
              </div>
              <div>
                <h1 className="font-bold text-lg leading-none text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">
                  文明崛起
                </h1>
                <span className={`text-xs font-bold uppercase ${EPOCHS[gameState.epoch].color}`}>
                  {EPOCHS[gameState.epoch].name}
                </span>
              </div>
            </div>

            {/* 时间显示 */}
            <div className="flex items-center gap-2 bg-gray-800/40 px-3 py-1.5 rounded-full border border-gray-700">
              <Icon name="Calendar" size={16} className="text-blue-300" />
              <div className="text-xs leading-tight">
                <div className="text-sm font-bold text-white">
                  第 {calendar.year} 年 · {calendar.season}
                </div>
                <div className="text-[10px] text-gray-400">
                  {calendar.monthName}{calendar.day}日 · 第 {calendar.totalDays} 天 · 速度 x{gameState.gameSpeed}
                </div>
              </div>
            </div>
          </div>

          {/* 财富、行政力和人口显示 */}
          <div className="relative flex items-center gap-4 bg-gray-800/50 px-4 py-1.5 rounded-full border border-gray-700">
            <div className="flex items-center gap-2" title="当前银币">
              <Icon name="Coins" size={16} className="text-yellow-300" />
              <span className="font-mono text-sm text-yellow-200">
                {(gameState.resources.silver || 0).toFixed(0)} 银币
              </span>
              <button
                type="button"
                onClick={() => setShowTaxDetail(prev => !prev)}
                className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full transition-colors ${netChipClasses}`}
                title="查看税收与支出详情"
              >
                <Icon name={netTrendIcon} size={12} />
                <span className="uppercase tracking-wide text-[10px] text-gray-300/80"></span>
                <span className={`font-mono ${netSilverClass}`}>
                  {netSilverPerDay >= 0 ? '+' : ''}{netSilverPerDay.toFixed(2)}/日
                </span>
              </button>
            </div>
            <div className="w-px h-4 bg-gray-600"></div>
            <div className="flex items-center gap-2 text-[11px] text-gray-400">
              <span>行政</span>
              <div className="flex gap-1" title="行政压力 / 行政容量">
                <Icon 
                  name="Scale" 
                  size={16} 
                  className={gameState.adminStrain > gameState.adminCap ? "text-red-400 animate-pulse" : "text-purple-400"} 
                />
                <span className="font-mono text-sm">
                  {gameState.adminStrain.toFixed(0)} / {gameState.adminCap}
                </span>
              </div>
            </div>
            <div className="w-px h-4 bg-gray-600"></div>
            <div className="flex items-center gap-2 text-[11px] text-gray-400">
              <span>人口</span>
              <div className="flex gap-1" title="当前人口 / 人口上限">
                <Icon name="Users" size={16} className="text-blue-400" />
                <span className="font-mono text-sm">
                  {gameState.population} / {gameState.maxPop}
                </span>
              </div>
            </div>

            {showTaxDetail && (
              <div className="absolute top-full right-0 mt-2 w-64 bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl z-30">
                <div className="flex items-center justify-between text-xs text-gray-300 mb-2">
                  <span className="font-semibold">税收 - 支出 (每日日均)</span>
                  <span className={`${netSilverClass} font-mono`}>
                    {netSilverPerDay >= 0 ? '+' : ''}{netSilverPerDay.toFixed(2)} 银币
                  </span>
                </div>
                <div className="text-xs text-gray-400 space-y-1">
                  <div className="flex justify-between">
                    <span>人头税</span>
                    <span className="text-yellow-200 font-mono">
                      {taxes.breakdown?.headTax?.toFixed(2) || '0.00'}
                    </span>
                  </div>
                  {taxes.breakdown?.subsidy > 0 && (
                    <div className="flex justify-between">
                      <span>补助</span>
                      <span className="text-teal-300 font-mono">
                        -{taxes.breakdown.subsidy.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>产业税</span>
                    <span className="text-yellow-200 font-mono">
                      {taxes.breakdown?.industryTax?.toFixed(2) || '0.00'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>军饷/维护</span>
                    <span className="text-red-300 font-mono">
                      -{silverUpkeepPerDay.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>行政效率</span>
                    <span className="text-blue-300 font-mono">
                      {(taxes.efficiency * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>净收益</span>
                    <span className={`${netSilverClass} font-mono`}>
                      {netSilverPerDay >= 0 ? '+' : ''}{netSilverPerDay.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 游戏速度控制和教程按钮 */}
          <div className="flex items-center gap-2">
            {/* 查看教程按钮 */}
            <button
              onClick={handleReopenTutorial}
              className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/30 rounded-lg transition-colors flex items-center gap-2 text-xs font-semibold text-blue-300"
              title="重新查看新手教程"
            >
              <Icon name="BookOpen" size={14} />
              <span className="hidden sm:inline">教程</span>
            </button>
            
            {/* 游戏速度控制 */}
            <div className="flex bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
              {GAME_SPEEDS.map(s => (
                <button
                  key={s}
                  onClick={() => gameState.setGameSpeed(s)}
                  className={`px-3 py-1 text-xs font-bold hover:bg-gray-700 transition-colors ${
                    gameState.gameSpeed === s ? 'bg-blue-600 text-white' : 'text-gray-400'
                  }`}
                >
                  {s === 1 ? (
                    <Icon name="Play" size={12} />
                  ) : (
                    <div className="flex items-center">
                      {s}x <Icon name="FastForward" size={12} className="ml-1"/>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* 主内容区域 */}
      <main className="max-w-[1920px] mx-auto p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* 左侧边栏 - 资源、阶层、日志 */}
        <aside className="lg:col-span-2 space-y-4 order-2 lg:order-1">
          {/* 资源面板 */}
          <ResourcePanel 
            resources={gameState.resources} 
            rates={gameState.rates} 
            market={gameState.market}
            epoch={gameState.epoch}
          />

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
            onDetailClick={(key) => gameState.setStratumDetailView(key)}
            dayScale={dayScale}
          />

          {/* 手动采集按钮 */}
          <button 
            onClick={manualGather} 
            className="w-full py-3 bg-gradient-to-r from-emerald-700 to-emerald-600 rounded-lg font-bold shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2"
          >
            <Icon name="Pickaxe" size={16} /> 手动采集
          </button>
        </aside>

        {/* 中间内容区 - 标签页 */}
        <section className="lg:col-span-8 space-y-4 order-1 lg:order-2">
          {/* 标签页容器 */}
          <div className="bg-gray-900/60 backdrop-blur rounded-xl border border-gray-700 shadow-xl overflow-hidden min-h-[500px]">
            {/* 标签页导航 */}
            <div className="flex border-b border-gray-700 bg-gray-800/30 overflow-x-auto">
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
                  className={`flex-1 min-w-[80px] py-3 flex items-center justify-center gap-2 text-sm font-bold transition-colors ${
                    gameState.activeTab === tab.id 
                      ? 'bg-gray-700/50 text-white border-b-2 border-blue-500' 
                      : 'text-gray-400 hover:bg-gray-800/30'
                  }`}
                >
                  <Icon name={tab.icon} size={16} /> {tab.label}
                </button>
              ))}
            </div>

            {/* 标签页内容 */}
            <div className="p-4">
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
                  market={gameState.market}
                  epoch={gameState.epoch}
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

        {/* 右侧边栏 - 日志和提示 */}
        <aside className="lg:col-span-2 order-3 space-y-4">
          {/* 日志面板 */}
          <LogPanel logs={gameState.logs} />
          
          {/* 游戏提示 */}
          <div className="bg-blue-900/20 border border-blue-500/20 p-4 rounded-xl text-xs text-gray-300 space-y-2">
            <h4 className="font-bold text-blue-300">统治指南</h4>
            <p>• <span className="text-white">阶层即兵源与劳力</span>：岗位由建筑创造，人口自动填补并转化为对应阶层，留意阶层需求免得怠工。</p>
            <p>• <span className="text-white">行政容量 vs 行政压力</span>：行政容量代表政府能处理的事务上限，行政压力则是当前消耗；若压力超过容量，税收与政策效率都会下降，记得通过建筑、科技或政令提升容量。</p>
            <p>• <span className="text-white">银币驱动经济</span>：绝大多数资源都在市场流通，你的仓库存货来自用银币在当前价格买入，银币短缺会导致供应断档。</p>
            <p>• <span className="text-white">掌控节奏</span>：在研究、政令、外交之间保持平衡，时代升级前先确保文化与行政容量足够，避免管理崩溃。</p>
          </div>

          <div className="bg-emerald-900/20 border border-emerald-500/20 p-4 rounded-xl text-xs text-gray-200 space-y-3">
            <h4 className="font-bold text-emerald-300">新手教程</h4>
            <div className="space-y-1">
              <p className="text-white font-semibold">1. 稳固开局</p>
              <p>在【建设】面板先补足农田与伐木场，保持粮食与木材正增长，同时关注人口上限。</p>
            </div>
            <div className="space-y-1">
              <p className="text-white font-semibold">2. 了解市场</p>
              <p>查看右下角的市场价格，记住：<span className="text-white">所有实物资源都在市场</span>，你的仓库只是用银币按价格买来的存货。每当建造、生产或研究需要材料时，系统会自动消耗库存；若库存不足，就会立刻用银币在市场补货。</p>
            </div>
            <div className="space-y-1">
              <p className="text-white font-semibold">3. 推进科技与时代</p>
              <p>用图书馆产生科研，研究能解锁新建筑与增益；满足时代要求后支付资源和银币升级，新的外交对手与产业链也会出现。</p>
            </div>
            <div className="space-y-1">
              <p className="text-white font-semibold">4. 调整政令与外交</p>
              <p>政令提供强大但有代价的加成，记得观察阶层好感；通过外交或贸易获取稀缺资源，比盲目扩军更省成本。</p>
            </div>
          </div>
        </aside>
      </main>

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
          onClose={() => gameState.setStratumDetailView(null)}
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
      />
    </div>
  );
}
