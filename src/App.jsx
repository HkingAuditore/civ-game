// 文明崛起 - 主应用文件
// 使用拆分后的钩子和组件，保持代码简洁

import React, { useState } from 'react';
import { GAME_SPEEDS, EPOCHS } from './config/gameData';
import { useGameState, useGameLoop, useGameActions } from './hooks';
import {
  Icon,
  FloatingText,
  CityMap,
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
} from './components';

/**
 * 文明崛起主应用组件
 * 整合所有游戏系统和UI组件
 */
export default function RiseOfCivs() {
  // 使用自定义钩子管理状态
  const gameState = useGameState();
  
  // 添加日志函数
  const addLog = (msg) => {
    gameState.setLogs(prev => [msg, ...prev].slice(0, 8));
  };
  
  // 使用游戏循环钩子
  useGameLoop(gameState, addLog);
  
  // 使用操作函数钩子
  const actions = useGameActions(gameState, addLog);
  
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
  const taxes = gameState.taxes || { total: 0, breakdown: { headTax: 0, industryTax: 0 }, efficiency: 1 };

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
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-4">
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
                className="flex items-center gap-1 text-[11px] text-green-300 bg-green-900/20 px-2 py-0.5 rounded-full hover:bg-green-900/40 transition-colors"
                title="查看税收详情"
              >
                <Icon name="TrendingUp" size={12} />
                +{taxes.total.toFixed(2)}/s
              </button>
            </div>
            <div className="w-px h-4 bg-gray-600"></div>
            <div className="flex gap-1" title="行政压力/容量">
              <Icon 
                name="Scale" 
                size={16} 
                className={gameState.adminStrain > gameState.adminCap ? "text-red-400 animate-pulse" : "text-purple-400"} 
              />
              <span className="font-mono text-sm">
                {gameState.adminStrain.toFixed(0)} / {gameState.adminCap}
              </span>
            </div>
            <div className="w-px h-4 bg-gray-600"></div>
            <div className="flex gap-1" title="总人口">
              <Icon name="Users" size={16} className="text-blue-400" />
              <span className="font-mono text-sm">
                {gameState.population} / {gameState.maxPop}
              </span>
            </div>

            {showTaxDetail && (
              <div className="absolute top-full right-0 mt-2 w-64 bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl">
                <div className="flex items-center justify-between text-xs text-gray-300 mb-2">
                  <span className="font-semibold">本轮税收</span>
                  <span className="text-green-300 font-mono">+{taxes.total.toFixed(2)} 银币</span>
                </div>
                <div className="text-xs text-gray-400 space-y-1">
                  <div className="flex justify-between">
                    <span>人头税</span>
                    <span className="text-yellow-200 font-mono">
                      {taxes.breakdown?.headTax?.toFixed(2) || '0.00'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>产业税</span>
                    <span className="text-yellow-200 font-mono">
                      {taxes.breakdown?.industryTax?.toFixed(2) || '0.00'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>行政效率</span>
                    <span className="text-blue-300 font-mono">
                      {(taxes.efficiency * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

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
      </header>

      {/* 主内容区域 */}
      <main className="max-w-7xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* 左侧边栏 - 资源、阶层、日志 */}
        <aside className="lg:col-span-3 space-y-4 order-2 lg:order-1">
          {/* 资源面板 */}
          <ResourcePanel 
            resources={gameState.resources} 
            rates={gameState.rates} 
            market={gameState.market}
            nations={gameState.nations}
            tradeRoutes={gameState.tradeRoutes}
            onCreateTradeRoute={actions.createTradeRoute}
            onCancelTradeRoute={actions.cancelTradeRoute}
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
          />

          {/* 手动采集按钮 */}
          <button 
            onClick={manualGather} 
            className="w-full py-3 bg-gradient-to-r from-emerald-700 to-emerald-600 rounded-lg font-bold shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2"
          >
            <Icon name="Pickaxe" size={16} /> 手动采集
          </button>
        </aside>

        {/* 中间内容区 - 城市地图和标签页 */}
        <section className="lg:col-span-6 space-y-6 order-1 lg:order-2">
          {/* 城市地图 */}
          <CityMap buildings={gameState.buildings} epoch={gameState.epoch} />

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
                />
              )}

              {/* 外交标签页 */}
              {gameState.activeTab === 'diplo' && (
                <DiplomacyTab
                  nations={gameState.nations}
                  onDiplomaticAction={actions.handleDiplomaticAction}
                />
              )}
            </div>
          </div>
        </section>

        {/* 右侧边栏 - 日志和提示 */}
        <aside className="lg:col-span-3 order-3 space-y-4">
          {/* 日志面板 */}
          <LogPanel logs={gameState.logs} />
          
          {/* 游戏提示 */}
          <div className="bg-blue-900/20 border border-blue-500/20 p-4 rounded-xl text-xs text-gray-400 space-y-2">
            <h4 className="font-bold text-blue-300">统治指南</h4>
            <p>• <span className="text-white">人口就是阶层</span>：建筑提供岗位，人口会自动填补岗位成为对应阶层。</p>
            <p>• <span className="text-white">平衡产出</span>：注意查看建筑卡片上的绿色（产出）和红色（消耗）数值。</p>
            <p>• <span className="text-white">外交</span>：初期可以通过掠夺邻国快速获取资源，但要小心报复。</p>
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
          totalInfluence={gameState.totalInfluence}
          totalWealth={gameState.totalWealth}
          activeBuffs={gameState.activeBuffs}
          activeDebuffs={gameState.activeDebuffs}
          epoch={gameState.epoch}
          onClose={() => gameState.setStratumDetailView(null)}
        />
      )}
    </div>
  );
}
