// 军事标签页组件
// 显示可招募的兵种、当前军队和战斗功能

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../common/UIComponents';
import { UNIT_TYPES, BUILDINGS, calculateArmyCapacityNeed, calculateArmyPopulation, calculateArmyMaintenance, calculateArmyFoodNeed, calculateBattlePower, RESOURCES, MILITARY_ACTIONS, TECHS } from '../../config';
import { calculateSilverCost, formatSilverCost } from '../../utils/economy';
import { filterUnlockedResources } from '../../utils/resources';

/**
 * 军事单位悬浮提示框 (使用 Portal)
 */
const UnitTooltip = ({ unit, resources, market, militaryWageRatio, anchorElement }) => {
  if (!unit || !anchorElement) return null;

  const [position, setPosition] = useState({ top: 0, left: 0 });
  const tooltipRef = useRef(null);

  useEffect(() => {
    if (anchorElement && tooltipRef.current) {
      const anchorRect = anchorElement.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      
      let top = anchorRect.top;
      let left = anchorRect.right + 8; // 默认在右侧

      if (left + tooltipRect.width > window.innerWidth) {
        left = anchorRect.left - tooltipRect.width - 8;
      }

      if (top < 0) top = 0;
      if (top + tooltipRect.height > window.innerHeight) {
        top = window.innerHeight - tooltipRect.height;
      }

      setPosition({ top, left });
    }
  }, [anchorElement, unit]);

  const silverCost = calculateSilverCost(unit.recruitCost, market);
  const foodPrice = market?.prices?.food ?? (RESOURCES.food?.basePrice || 1);

  return createPortal(
    <div
      ref={tooltipRef}
      className="fixed w-72 bg-gray-800 border border-gray-600 rounded-lg shadow-2xl p-3 z-[9999] pointer-events-none animate-fade-in-fast"
      style={{ top: `${position.top}px`, left: `${position.left}px` }}
    >
      <h4 className="text-sm font-bold text-white mb-1">{unit.name}</h4>
      <p className="text-xs text-gray-400 mb-2">{unit.type}</p>

      <div className="bg-gray-900/50 rounded px-2 py-1.5 mb-2">
        <div className="text-[10px] text-gray-400 mb-1">单位属性</div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1"><Icon name="Sword" size={12} className="text-red-400" /><span className="text-gray-300">攻击:</span><span className="text-white">{unit.attack}</span></div>
          <div className="flex items-center gap-1"><Icon name="Shield" size={12} className="text-blue-400" /><span className="text-gray-300">防御:</span><span className="text-white">{unit.defense}</span></div>
          <div className="flex items-center gap-1"><Icon name="Zap" size={12} className="text-yellow-400" /><span className="text-gray-300">速度:</span><span className="text-white">{unit.speed}</span></div>
          <div className="flex items-center gap-1"><Icon name="Clock" size={12} className="text-purple-400" /><span className="text-gray-300">训练:</span><span className="text-white">{unit.trainingTime}天</span></div>
        </div>
        <div className="flex items-center gap-1 text-xs mt-2 pt-2 border-t border-gray-700">
          <Icon name="Coins" size={12} className="text-yellow-400" />
          <span className="text-gray-300">军饷:</span>
          <span className="text-yellow-300">{((unit.maintenanceCost?.food || 0) * foodPrice * militaryWageRatio).toFixed(2)} 银币/日</span>
        </div>
      </div>

      <div className="bg-gray-900/50 rounded px-2 py-1.5">
        <div className="text-[10px] text-gray-400 mb-1">招募成本</div>
        {Object.entries(unit.recruitCost).map(([resource, cost]) => (
          <div key={resource} className="flex justify-between text-xs">
            <span className="text-gray-300">{RESOURCES[resource]?.name || resource}</span>
            <span className={(resources[resource] || 0) >= cost ? 'text-green-400' : 'text-red-400'}>{cost} ({(resources[resource] || 0).toFixed(1)})</span>
          </div>
        ))}
        <div className="flex justify-between text-xs pt-1 border-t border-gray-700 mt-1">
          <span className="text-gray-300">总计</span>
          <span className={(resources.silver || 0) >= silverCost ? 'text-green-400' : 'text-red-400'}>{formatSilverCost(silverCost)}</span>
        </div>
      </div>
    </div>,
    document.body
  );
};

/**
 * 军事标签页组件
 * 显示军事系统的所有功能
 * @param {Object} army - 当前军队对象
 * @param {Array} militaryQueue - 训练队列数组
 * @param {Object} resources - 资源对象
 * @param {number} epoch - 当前时代
 * @param {number} population - 总人口
 * @param {Array} nations - 国家列表
 * @param {string} selectedTarget - 当前选中的战争目标
 * @param {Function} onRecruit - 招募单位回调
 * @param {Function} onDisband - 解散单位回调
 * @param {Function} onCancelTraining - 取消训练回调
 * @param {Function} onSelectTarget - 设置目标
 * @param {Function} onLaunchBattle - 发起战斗回调
 */
export const MilitaryTab = ({
  army,
  militaryQueue,
  resources,
  epoch,
  population,
  buildings = {}, // 新增：建筑列表，用于计算军事容量
  nations = [],
  selectedTarget,
  onRecruit,
  onDisband,
  onCancelTraining, // 新增：取消训练回调
  onSelectTarget,
  onLaunchBattle,
  market,
  militaryWageRatio = 1,
  onUpdateWageRatio,
  techsUnlocked = [],
  onShowUnitDetails, // 新增：显示单位详情回调
}) => {
  const [hoveredUnit, setHoveredUnit] = useState({ unit: null, element: null });
  const canHover = window.matchMedia('(hover: hover)').matches;

  const handleMouseEnter = (e, unit) => {
    if (canHover) setHoveredUnit({ unit, element: e.currentTarget });
  };

  // 计算军队统计信息
  const totalUnits = Object.values(army).reduce((sum, count) => sum + count, 0);
  const waitingCount = (militaryQueue || []).filter(item => item.status === 'waiting').length;
  const trainingCount = (militaryQueue || []).filter(item => item.status === 'training').length;
  const totalArmyCount = totalUnits + waitingCount + trainingCount;
  
  // 计算军事容量
  let militaryCapacity = 0;
  Object.entries(buildings).forEach(([buildingId, count]) => {
    const building = BUILDINGS.find(b => b.id === buildingId);
    if (building && building.output?.militaryCapacity) {
      militaryCapacity += building.output.militaryCapacity * count;
    }
  });
  
  const maintenance = calculateArmyMaintenance(army);
  // 军饷只计算实际在编军人（已完成训练的），不包括训练队列中的
  const totalFoodNeed = calculateArmyFoodNeed(army);
  const foodPrice = market?.prices?.food ?? (RESOURCES.food?.basePrice || 1);
  const totalWage = totalFoodNeed * foodPrice * militaryWageRatio;
  const playerPower = calculateBattlePower(army, epoch);
  // 只显示可见且处于战争状态的国家
  const warringNations = (nations || []).filter((nation) => 
    nation.isAtWar && 
    epoch >= (nation.appearEpoch ?? 0) && 
    (nation.expireEpoch == null || epoch <= nation.expireEpoch)
  );
  const activeNation =
    warringNations.find((nation) => nation.id === selectedTarget) || warringNations[0] || null;

  React.useEffect(() => {
    if (!activeNation && warringNations.length > 0 && onSelectTarget) {
      onSelectTarget(warringNations[0].id);
    }
  }, [activeNation, warringNations, onSelectTarget]);

  const formatLootRange = (range) => {
    if (!Array.isArray(range) || range.length < 2) return '';
    const [min, max] = range;
    return `${min}-${max}`;
  };

  /**
   * 检查单位是否可招募
   * @param {Object} unit - 单位对象
   * @returns {boolean}
   */
  const canRecruit = (unit) => {
    // 检查时代
    if (unit.epoch > epoch) return false;
    
    // 检查资源
    for (let resource in unit.recruitCost) {
      if ((resources[resource] || 0) < unit.recruitCost[resource]) return false;
    }

    const silverCost = calculateSilverCost(unit.recruitCost, market);
    if ((resources.silver || 0) < silverCost) return false;
    
    // 检查军事容量
    if (totalArmyCount + 1 > militaryCapacity) return false;
    
    return true;
  };

  /**
   * 获取不能招募的原因
   * @param {Object} unit - 单位对象
   * @returns {string} 不能招募的原因，如果可以招募则返回空字符串
   */
  const getRecruitDisabledReason = (unit) => {
    // 检查时代
    if (unit.epoch > epoch) {
      return `需要升级到 ${EPOCHS[unit.epoch].name}`;
    }
    
    // 检查资源
    for (let resource in unit.recruitCost) {
      if ((resources[resource] || 0) < unit.recruitCost[resource]) {
        return `资源不足：缺少 ${RESOURCES[resource]?.name || resource}`;
      }
    }

    const silverCost = calculateSilverCost(unit.recruitCost, market);
    if ((resources.silver || 0) < silverCost) {
      return `银币不足：需要 ${silverCost.toFixed(1)} 银币`;
    }
    
    // 检查军事容量
    if (totalArmyCount + 1 > militaryCapacity) {
      return `军事容量不足（${totalArmyCount}/${militaryCapacity}），需要建造更多兵营`;
    }
    
    return '';
  };

  return (
    <div className="space-y-4">
      {/* 军队概览 */}
      <div className="glass-ancient p-4 rounded-xl border border-ancient-gold/30">
        <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-gray-300">
          <Icon name="Shield" size={16} className="text-red-400" />
          军队概览
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* 总兵力 */}
          <div className="bg-gray-700/50 p-3 rounded">
            <div className="flex items-center gap-2 mb-1">
              <Icon name="Users" size={14} className="text-blue-400" />
              <span className="text-xs text-gray-400">总兵力</span>
            </div>
            <p className="text-lg font-bold text-white">{totalUnits}</p>
          </div>

          {/* 军事容量 */}
          <div className="bg-gray-700/50 p-3 rounded">
            <div className="flex items-center gap-2 mb-1">
              <Icon name="Castle" size={14} className="text-red-400" />
              <span className="text-xs text-gray-400">军事容量</span>
            </div>
            <p className={`text-lg font-bold ${totalArmyCount > militaryCapacity ? 'text-red-400' : 'text-white'}`}>
              {totalArmyCount} / {militaryCapacity}
            </p>
          </div>

          {/* 训练中 */}
          <div className="bg-gray-700/50 p-3 rounded">
            <div className="flex items-center gap-2 mb-1">
              <Icon name="Clock" size={14} className="text-yellow-400" />
              <span className="text-xs text-gray-400">训练中</span>
            </div>
            <p className="text-lg font-bold text-white">{militaryQueue.length}</p>
          </div>
        </div>

        {/* 维护成本 */}
        {(() => {
          const unlockedMaintenance = filterUnlockedResources(maintenance, epoch, techsUnlocked);
          return Object.keys(unlockedMaintenance).length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-700">
              <p className="text-xs text-gray-400 mb-2">维护成本（每日）：</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(unlockedMaintenance).map(([resource, cost]) => (
                  <span
                    key={resource}
                    className={`text-xs px-2 py-1 rounded ${
                      (resources[resource] || 0) >= cost
                        ? 'bg-green-900/30 text-green-400'
                        : 'bg-red-900/30 text-red-400'
                    }`}
                  >
                    {RESOURCES[resource]?.name || resource}: -{cost.toFixed(1)}/日
                  </span>
                ))}
              </div>
            </div>
          );
        })()}

        <div className="mt-3 pt-3 border-t border-gray-700">
          <p className="text-xs text-gray-400 mb-2">军饷（每日）：</p>
          <div className="flex items-center gap-2 text-sm">
            <Icon name="Coins" size={14} className="text-yellow-400" />
            <span className="text-yellow-300 font-mono">-{totalWage.toFixed(2)} 银币</span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-[11px] text-gray-400">
            <span>军饷倍率</span>
            <input
              type="number"
              step="0.1"
              value={militaryWageRatio}
              onChange={(e) => onUpdateWageRatio && onUpdateWageRatio(parseFloat(e.target.value) || 0)}
              className="w-20 bg-gray-900/60 border border-gray-700 rounded px-2 py-0.5 text-xs text-gray-100"
            />
            <span className="text-gray-500">军饷 = 食粮需求 × 粮价 × 倍率</span>
          </div>
        </div>
      </div>

      {/* 招募单位 */}
      <div className="glass-ancient p-4 rounded-xl border border-ancient-gold/30">
        <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-gray-300">
          <Icon name="Plus" size={16} className="text-green-400" />
          招募单位
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-2">
          {Object.entries(UNIT_TYPES).filter(([, unit]) => unit.epoch <= epoch).map(([unitId, unit]) => {
            const silverCost = calculateSilverCost(unit.recruitCost, market);
            const affordable = canRecruit(unit);

            return (
              <div
                key={unitId}
                onMouseEnter={(e) => handleMouseEnter(e, unit)}
                onMouseLeave={() => canHover && setHoveredUnit({ unit: null, element: null })}
                onClick={() => onShowUnitDetails && onShowUnitDetails(unit)}
                className={`group relative p-2 rounded-lg border transition-all cursor-pointer ${
                  affordable
                    ? 'glass-ancient border border-ancient-gold/30 hover:border-red-500/60 hover:shadow-glow-gold'
                    : 'bg-gray-700/50 border border-ancient-gold/20'
                }`}
              >
                {/* 单位头部 - 紧凑版 */}
                <div className="flex flex-col items-center mb-2">
                  <div className="w-12 h-12 icon-metal-container icon-metal-container-lg rounded-lg flex items-center justify-center mb-1">
                    <Icon name="Swords" size={24} className="text-red-400 icon-metal-red" />
                  </div>
                  <h4 className="text-xs font-bold text-white text-center leading-tight">{unit.name}</h4>
                  <p className="text-[10px] text-gray-400">×{army[unitId] || 0}</p>
                </div>

                {/* 简化的关键属性 */}
                <div className="space-y-1 text-[10px] mb-2">
                  <div className="bg-gray-900/40 rounded px-1.5 py-1 flex justify-between">
                    <span className="text-gray-400">攻/防</span>
                    <span className="text-white">{unit.attack}/{unit.defense}</span>
                  </div>
                  <div className="bg-gray-900/40 rounded px-1.5 py-1 flex justify-between">
                    <span className="text-gray-400">速度</span>
                    <span className="text-yellow-400">{unit.speed}</span>
                  </div>
                  <div className="bg-gray-900/40 rounded px-1.5 py-1 flex justify-between">
                    <span className="text-gray-400">军饷</span>
                    <span className="text-yellow-300">
                      {((unit.maintenanceCost?.food || 0) * foodPrice * militaryWageRatio).toFixed(1)}银/日
                    </span>
                  </div>
                </div>

                {/* 操作按钮 - 紧凑版 */}
                <div className="space-y-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); onRecruit(unitId); }}
                    disabled={!affordable}
                    title={!affordable ? getRecruitDisabledReason(unit) : '点击招募'}
                    className={`w-full px-2 py-1 rounded text-[10px] font-semibold transition-colors ${
                      affordable
                        ? 'bg-green-600 hover:bg-green-500 text-white'
                        : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <Icon name="Plus" size={10} />
                      <span className={(resources.silver || 0) < silverCost ? 'text-red-300' : ''}>
                        {formatSilverCost(silverCost)}
                      </span>
                    </div>
                  </button>

                  {(army[unitId] || 0) > 0 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onDisband(unitId); }}
                      className="w-full px-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-[10px] font-semibold transition-colors flex items-center justify-center gap-1"
                    >
                      <Icon name="Minus" size={10} />
                      解散
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 训练队列 */}
      {militaryQueue.length > 0 && (
        <div className="glass-ancient p-4 rounded-xl border border-ancient-gold/30">
          <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-gray-300">
            <Icon name="Clock" size={16} className="text-yellow-400" />
            训练队列
          </h3>

          <div className="space-y-2">
            {militaryQueue.map((item, idx) => {
              const unit = UNIT_TYPES[item.unitId];
              const isWaiting = item.status === 'waiting';
              const progress = isWaiting ? 0 : ((item.totalTime - item.remainingTime) / item.totalTime) * 100;
              
              return (
                <div
                  key={idx}
                  className={`flex items-center justify-between p-2 rounded ${
                    isWaiting ? 'bg-gray-700/30 border border-dashed border-gray-600' : 'bg-gray-700/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon 
                      name={isWaiting ? "UserPlus" : "User"} 
                      size={14} 
                      className={isWaiting ? "text-gray-400" : "text-blue-400"} 
                    />
                    <span className={`text-sm ${isWaiting ? 'text-gray-400' : 'text-white'}`}>
                      {unit.name}
                    </span>
                    {isWaiting && (
                      <span className="text-xs text-yellow-400">等待人员...</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {!isWaiting && (
                      <>
                        <div className="w-32 bg-gray-600 rounded-full h-2">
                          <div
                            className="bg-yellow-500 h-2 rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400 w-12 text-right">
                          {item.remainingTime}天
                        </span>
                      </>
                    )}
                    {isWaiting && (
                      <span className="text-xs text-gray-500 w-44 text-right">
                        需要人员填补军人岗位
                      </span>
                    )}
                    {/* 取消按钮 */}
                    <button
                      onClick={() => onCancelTraining && onCancelTraining(idx)}
                      className="ml-2 p-1 rounded hover:bg-red-900/30 text-red-400 hover:text-red-300 transition-colors"
                      title="取消训练（返还50%资源）"
                    >
                      <Icon name="X" size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 军事行动 */}
      <div className="glass-ancient p-4 rounded-xl border border-ancient-gold/30">
        <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-gray-300">
          <Icon name="Swords" size={16} className="text-red-400" />
          军事行动
        </h3>

        <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
          <span>
            当前战力评估：
            <span className="text-white font-semibold">{playerPower.toFixed(0)}</span>
          </span>
          <span>
            现役兵力：
            <span className="text-white font-semibold">{totalUnits}</span>
          </span>
        </div>

        {warringNations.length === 0 ? (
          <div className="p-3 rounded bg-gray-900/40 border border-gray-700 text-xs text-gray-400">
            暂无交战国。可在外交界面主动宣战或等待敌国挑衅。
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 mb-3">
              <div className="flex items-center gap-2">
                <span>目标国家</span>
                <select
                  value={activeNation?.id || ''}
                  onChange={(e) => onSelectTarget && onSelectTarget(e.target.value)}
                  className="bg-gray-900/60 border border-gray-700 text-white rounded px-2 py-1"
                >
                  {warringNations.map((nation) => (
                    <option key={nation.id} value={nation.id}>
                      {nation.name} · 战争分数 {nation.warScore || 0}
                    </option>
                  ))}
                </select>
              </div>
              {activeNation && (
                <div className="flex flex-wrap gap-3">
                  <span>战争分数：{activeNation.warScore || 0}</span>
                  <span>敌军损失：{activeNation.enemyLosses || 0}</span>
                  <span>财富：{Math.floor(activeNation.wealth || 0)}</span>
                  <span>军事实力：{Math.floor((activeNation.militaryStrength ?? 1.0) * 100)}%</span>
                  <span>人口：{Math.floor(activeNation.population || 1000)}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {MILITARY_ACTIONS.map((action) => {
                const totalEnemyMin = (action.enemyUnits || []).reduce(
                  (sum, unit) => sum + (unit.min || 0),
                  0
                );
                const totalEnemyMax = (action.enemyUnits || []).reduce(
                  (sum, unit) => sum + (unit.max || unit.min || 0),
                  0
                );
                // Check if required tech is unlocked
                const hasRequiredTech = !action.requiresTech || techsUnlocked.includes(action.requiresTech);
                const requiredTechName = action.requiresTech 
                  ? TECHS.find(t => t.id === action.requiresTech)?.name || action.requiresTech 
                  : null;
                
                return (
                  <div
                    key={action.id}
                    className={`p-3 rounded-lg border flex flex-col gap-3 ${
                      hasRequiredTech 
                        ? 'border-gray-700 bg-gray-900/40' 
                        : 'border-gray-800 bg-gray-900/20 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-base font-bold text-white flex items-center gap-2">
                          {action.name}
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-700 text-gray-200">
                            {action.difficulty}
                          </span>
                          {!hasRequiredTech && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-900/50 text-red-300">
                              <Icon name="Lock" size={10} className="inline mr-1" />
                              需要{requiredTechName}
                            </span>
                          )}
                        </h4>
                        <p className="text-xs text-gray-400 mt-1">{action.desc}</p>
                      </div>
                      <Icon name="Target" size={18} className={hasRequiredTech ? 'text-red-300' : 'text-gray-500'} />
                    </div>

                    <div className="space-y-2 text-xs text-gray-300">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">敌军规模</span>
                        <span>
                          {totalEnemyMin}-{totalEnemyMax} 人
                        </span>
                      </div>
                      <div>
                        <p className="text-gray-400 mb-1">可能战利品：</p>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(action.loot || {}).map(([resource, range]) => (
                            <span
                              key={resource}
                              className="px-2 py-0.5 bg-yellow-900/20 rounded border border-yellow-600/30 text-[11px] text-yellow-200"
                            >
                              {(RESOURCES[resource]?.name || resource)} {formatLootRange(range)}
                            </span>
                          ))}
                          {Object.keys(action.loot || {}).length === 0 && (
                            <span className="text-gray-500">无特殊战利品</span>
                          )}
                        </div>
                      </div>
                      {action.influence && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-gray-400">军人影响力</span>
                          <span className="text-green-400">胜利 +{action.influence.win}</span>
                          <span className="text-red-400">失败 {action.influence.lose}</span>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => onLaunchBattle(action.id, activeNation?.id)}
                      disabled={totalUnits === 0 || !activeNation || !hasRequiredTech}
                      className="px-3 py-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-600 disabled:text-gray-300 disabled:cursor-not-allowed text-white rounded text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                      <Icon name="Sword" size={14} />
                      {hasRequiredTech ? '发起攻击' : `需研发${requiredTechName}`}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {totalUnits === 0 && (
          <p className="text-xs text-yellow-400 mt-2">⚠️ 你需要先招募军队才能发起军事行动</p>
        )}
      </div>

      {/* 悬浮提示框 Portal */}
      <UnitTooltip
        unit={hoveredUnit.unit}
        anchorElement={hoveredUnit.element}
        resources={resources}
        market={market}
        militaryWageRatio={militaryWageRatio}
      />
    </div>
  );
};
