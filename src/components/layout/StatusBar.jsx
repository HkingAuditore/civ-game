// 顶部状态栏组件 - 玻璃拟态风格
// 移动端优先设计，显示关键游戏数据

import React, { useState } from 'react';
import { Icon } from '../common/UIComponents';
import { RESOURCES, EPOCHS } from '../../config';
import { getCalendarInfo } from '../../utils/calendar';

/**
 * 顶部状态栏组件
 * 使用玻璃拟态效果，固定在顶部
 * 包含游戏控制按钮，确保所有交互元素都在同一层级
 */
export const StatusBar = ({
  gameState,
  taxes,
  netSilverPerDay,
  armyFoodNeed,
  onResourceDetailClick,
  onPopulationDetailClick,
  onStrataClick,  // 新增：点击社会阶层按钮的回调
  onMarketClick,  // 新增：点击国内市场按钮的回调
  onEmpireSceneClick,  // 新增：点击日期按钮弹出帝国场景的回调
  // 游戏控制相关props
  gameControls,
}) => {
  const [showTaxDetail, setShowTaxDetail] = useState(false);
  const [showResourcesExpanded, setShowResourcesExpanded] = useState(false);
  
  const calendar = getCalendarInfo(gameState.daysElapsed || 0);
  // 移除 dayScale，因为 netSilverPerDay 已经是每日净收入
  const foodPrice = gameState.market?.prices?.food ?? (RESOURCES.food?.basePrice || 1);
  const wageRatio = gameState.militaryWageRatio || 1;
  // 军饷维护已经是每日计算好的
  const silverUpkeepPerDay = armyFoodNeed * foodPrice * wageRatio;
  
  const netSilverClass = netSilverPerDay >= 0 ? 'text-green-300' : 'text-red-300';
  const netChipClasses = netSilverPerDay >= 0
    ? 'text-green-300 bg-green-900/20 hover:bg-green-900/40'
    : 'text-red-300 bg-red-900/20 hover:bg-red-900/40';
  const netTrendIcon = netSilverPerDay >= 0 ? 'TrendingUp' : 'TrendingDown';
  
  // 获取当前时代的主题色
  const epochColor = EPOCHS[gameState.epoch]?.color || 'text-blue-400';
  
  // 格式化大数字
  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return Math.floor(num).toString();
  };
  
  // 获取可见的资源列表（已解锁且非虚拟）
  const visibleResources = Object.entries(RESOURCES)
    .filter(([key, info]) => {
      if (info.type === 'virtual' || info.type === 'currency') return false;
      if (typeof info.unlockEpoch === 'number' && info.unlockEpoch > gameState.epoch) return false;
      return true;
    })
    .slice(0, 6); // 移动端只显示前6个

  return (
    <header className="bg-gray-900/80 backdrop-blur-md border-b border-white/10 shadow-glass">
      <div className="max-w-[1920px] mx-auto px-3 sm:px-4 py-2 sm:py-3 relative">
        {/* 第一行：Logo、时代、时间 */}
        <div className="flex items-center justify-between gap-2 sm:gap-4 mb-2">
          {/* Logo 和时代 */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className={`bg-gradient-to-br from-blue-600 to-blue-800 p-1.5 sm:p-2 rounded-lg shadow-glow-sm`}>
              <Icon name="Globe" size={16} className="sm:w-5 sm:h-5" />
            </div>
            <div className="hidden sm:block">
              <h1 className="font-bold text-sm sm:text-lg leading-none text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">
                文明崛起
              </h1>
              <span className={`text-[10px] sm:text-xs font-bold uppercase ${epochColor}`}>
                {EPOCHS[gameState.epoch]?.name}
              </span>
            </div>
            <div className="sm:hidden">
              <span className={`text-xs font-bold ${epochColor}`}>
                {EPOCHS[gameState.epoch]?.name}
              </span>
            </div>
          </div>

          {/* 时间显示 - 移动端点击弹出帝国场景 */}
          <button
            onClick={() => {
              // 移动端点击弹出帝国场景，桌面端展开资源列表
              if (window.innerWidth < 1024 && onEmpireSceneClick) {
                onEmpireSceneClick();
              } else {
                // setShowResourcesExpanded(!showResourcesExpanded);
              }
            }}
            className="flex items-center gap-1.5 sm:gap-2 bg-gray-800/40 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full border border-gray-700/50 hover:bg-gray-800/60 transition-colors"
          >
            <Icon name="Calendar" size={14} className="text-blue-300 sm:w-4 sm:h-4" />
            <div className="text-[10px] sm:text-xs leading-tight">
              <div className="font-bold text-white">
                第 {calendar.year} 年 · {calendar.season}
              </div>
              <div className="text-[9px] sm:text-[10px] text-gray-400 hidden sm:block">
                {calendar.monthName}{calendar.day}日 · 速度 x{gameState.gameSpeed}
              </div>
            </div>
          </button>
        </div>

        {/* 第二行：关键数据胶囊 + 游戏控制（桌面端） */}
        <div className="flex items-center justify-between gap-1.5 sm:gap-3 pb-1">
          {/* 左侧：关键数据胶囊 - 使用flex-wrap确保换行而非滚动 */}
          <div className="relative flex items-center gap-1.5 sm:gap-3 flex-wrap flex-1">
            {/* 银币 - 移动端紧凑显示 */}
            <button
              onClick={() => onResourceDetailClick('silver')}
              onMouseEnter={() => setShowTaxDetail(true)}
              className="flex items-center gap-1 sm:gap-1.5 bg-gradient-to-r from-yellow-900/30 to-yellow-800/20 backdrop-blur-sm px-2 sm:px-3 py-1.5 rounded-full border border-yellow-600/30 hover:border-yellow-500/50 transition-all flex-shrink-0 group"
            >
              <Icon name="Coins" size={14} className="text-yellow-300 sm:w-4 sm:h-4" />
              <span className="font-mono text-xs sm:text-sm font-bold text-yellow-200">
                {formatNumber(gameState.resources.silver || 0)}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTaxDetail(prev => !prev);
                }}
                className={`flex items-center gap-0.5 text-[10px] px-1 sm:px-1.5 py-0.5 rounded-full transition-colors ${netChipClasses}`}
              >
                <Icon name={netTrendIcon} size={10} />
                <span className={`font-mono ${netSilverClass}`}>
                  {netSilverPerDay >= 0 ? '+' : ''}{netSilverPerDay.toFixed(0)}
                </span>
              </button>
            </button>

            {/* 税收详情弹窗 - 移到这里，并使用 left-0 定位 */}
            {showTaxDetail && (
              <div 
                onMouseLeave={() => setShowTaxDetail(false)}
                className="absolute top-full left-0 mt-2 w-72 bg-gray-900/95 backdrop-blur-md border border-gray-700/70 rounded-xl p-4 shadow-glass z-[40] animate-slide-up"
              >
                <div className="flex items-center justify-between text-sm text-gray-300 mb-3">
                  <span className="font-semibold">财政收支 (每日)</span>
                  <button onClick={() => setShowTaxDetail(false)}>
                    <Icon name="X" size={16} className="text-gray-400 hover:text-white" />
                  </button>
                </div>
                <div className="text-xs text-gray-400 space-y-2">
                  <div className="flex justify-between py-1 border-b border-gray-800">
                    <span>人头税</span>
                    <span className="text-yellow-200 font-mono">+{taxes.breakdown?.headTax?.toFixed(2) || '0.00'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-800">
                    <span>交易税</span>
                    <span className="text-yellow-200 font-mono">
                      +{taxes.breakdown?.industryTax?.toFixed(2) || '0.00'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-800">
                    <span>营业税</span>
                    <span className="text-yellow-200 font-mono">
                      +{taxes.breakdown?.businessTax?.toFixed(2) || '0.00'}
                    </span>
                  </div>
                  {taxes.breakdown?.subsidy > 0 && (
                    <div className="flex justify-between py-1 border-b border-gray-800">
                      <span>补助支出</span>
                      <span className="text-red-300 font-mono">
                        -{taxes.breakdown.subsidy.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between py-1 border-b border-gray-800">
                    <span>军饷维护</span>
                    <span className="text-red-300 font-mono">
                      -{silverUpkeepPerDay.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 font-semibold">
                    <span className="text-white">净收益</span>
                    <span className={`${netSilverClass} font-mono text-sm`}>
                      {netSilverPerDay >= 0 ? '+' : ''}{netSilverPerDay.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 人口 - 始终显示上限 */}
            <button
              onClick={onPopulationDetailClick}
              className="flex items-center gap-1 sm:gap-1.5 bg-gradient-to-r from-blue-900/30 to-blue-800/20 backdrop-blur-sm px-2 sm:px-3 py-1.5 rounded-full border border-blue-600/30 hover:border-blue-500/50 transition-all flex-shrink-0"
            >
              <Icon name="Users" size={14} className="text-blue-300 sm:w-4 sm:h-4" />
              <div className="flex items-baseline gap-0.5">
                <span className="font-mono text-xs sm:text-sm font-bold text-blue-200">
                  {formatNumber(gameState.population)}
                </span>
                <span className="text-[9px] sm:text-[10px] text-gray-400">
                  /{formatNumber(gameState.maxPop)}
                </span>
              </div>
            </button>

            {/* 社会阶层按钮 - 移动端必显 */}
            <button
              onClick={onStrataClick}
              className="lg:hidden flex items-center gap-1 bg-gradient-to-r from-purple-900/30 to-purple-800/20 backdrop-blur-sm px-2 py-1.5 rounded-full border border-purple-600/30 hover:border-purple-500/50 transition-all flex-shrink-0"
              title="社会阶层"
            >
              <Icon name="Users" size={14} className="text-purple-300" />
              <span className="text-[10px] text-purple-200 font-semibold">阶层</span>
            </button>

            {/* 国内市场按钮 - 移动端必显 */}
            <button
              onClick={onMarketClick}
              className="lg:hidden flex items-center gap-1 bg-gradient-to-r from-amber-900/30 to-amber-800/20 backdrop-blur-sm px-2 py-1.5 rounded-full border border-amber-600/30 hover:border-amber-500/50 transition-all flex-shrink-0"
              title="国内市场"
            >
              <Icon name="Package" size={14} className="text-amber-300" />
              <span className="text-[10px] text-amber-200 font-semibold">市场</span>
            </button>

            {/* 行政力 - 桌面端显示 */}
            <div className="hidden lg:flex items-center gap-1.5 bg-gradient-to-r from-indigo-900/30 to-indigo-800/20 backdrop-blur-sm px-2.5 sm:px-3 py-1.5 rounded-full border border-indigo-600/30 flex-shrink-0">
              <Icon 
                name="Scale" 
                size={14} 
                className={`${gameState.adminStrain > gameState.adminCap ? 'text-red-400 animate-pulse' : 'text-indigo-300'} sm:w-4 sm:h-4`}
              />
              <span className="font-mono text-xs sm:text-sm font-bold text-indigo-200">
                {Math.floor(gameState.adminStrain)}
              </span>
              <span className="text-[10px] text-gray-400 hidden sm:inline">
                / {gameState.adminCap}
              </span>
            </div>
          </div>

          {/* 右侧：游戏控制按钮（桌面端） */}
          {gameControls && (
            <div className="hidden lg:flex items-center flex-shrink-0">
              {gameControls}
            </div>
          )}
        </div>

      </div>
    </header>
  );
};