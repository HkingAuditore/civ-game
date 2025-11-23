// 军事标签页组件
// 显示可招募的兵种、当前军队和战斗功能

import React from 'react';
import { Icon } from '../common/UIComponents';
import { UNIT_TYPES, calculateArmyAdminCost, calculateArmyPopulation, calculateArmyMaintenance, calculateArmyFoodNeed, calculateBattlePower, RESOURCES, MILITARY_ACTIONS } from '../../config';
import { calculateSilverCost, formatSilverCost } from '../../utils/economy';
import { filterUnlockedResources } from '../../utils/resources';

/**
 * 军事标签页组件
 * 显示军事系统的所有功能
 * @param {Object} army - 当前军队对象
 * @param {Array} militaryQueue - 训练队列数组
 * @param {Object} resources - 资源对象
 * @param {number} epoch - 当前时代
 * @param {number} population - 总人口
 * @param {number} adminCap - 行政力上限
 * @param {Array} nations - 国家列表
 * @param {string} selectedTarget - 当前选中的战争目标
 * @param {Function} onRecruit - 招募单位回调
 * @param {Function} onDisband - 解散单位回调
 * @param {Function} onSelectTarget - 设置目标
 * @param {Function} onLaunchBattle - 发起战斗回调
 */
export const MilitaryTab = ({
  army,
  militaryQueue,
  resources,
  epoch,
  population,
  adminCap,
  nations = [],
  selectedTarget,
  onRecruit,
  onDisband,
  onSelectTarget,
  onLaunchBattle,
  market,
  militaryWageRatio = 1,
  onUpdateWageRatio,
  techsUnlocked = [],
}) => {
  // 计算军队统计信息
  const totalUnits = Object.values(army).reduce((sum, count) => sum + count, 0);
  const armyAdmin = calculateArmyAdminCost(army);
  const armyPop = calculateArmyPopulation(army);
  const maxArmyPop = Math.floor(population * 0.3);
  const maintenance = calculateArmyMaintenance(army);
  const totalFoodNeed = calculateArmyFoodNeed(army);
  const foodPrice = market?.prices?.food ?? (RESOURCES.food?.basePrice || 1);
  const totalWage = totalFoodNeed * foodPrice * militaryWageRatio;
  const playerPower = calculateBattlePower(army, epoch);
  const warringNations = (nations || []).filter((nation) => nation.isAtWar);
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
    
    // 检查行政力
    if (armyAdmin + unit.adminCost > adminCap) return false;
    
    // 检查人口
    if (armyPop + unit.populationCost > maxArmyPop) return false;
    
    return true;
  };

  return (
    <div className="space-y-4">
      {/* 军队概览 */}
      <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
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

          {/* 行政力消耗 */}
          <div className="bg-gray-700/50 p-3 rounded">
            <div className="flex items-center gap-2 mb-1">
              <Icon name="Briefcase" size={14} className="text-purple-400" />
              <span className="text-xs text-gray-400">行政力</span>
            </div>
            <p className="text-lg font-bold text-white">
              {armyAdmin} / {adminCap}
            </p>
          </div>

          {/* 人口占用 */}
          <div className="bg-gray-700/50 p-3 rounded">
            <div className="flex items-center gap-2 mb-1">
              <Icon name="UserCheck" size={14} className="text-green-400" />
              <span className="text-xs text-gray-400">人口占用</span>
            </div>
            <p className="text-lg font-bold text-white">
              {armyPop} / {maxArmyPop}
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
              min="0"
              step="0.1"
              value={militaryWageRatio}
              onChange={(e) => onUpdateWageRatio && onUpdateWageRatio(Math.max(0, parseFloat(e.target.value) || 0))}
              className="w-20 bg-gray-900/60 border border-gray-700 rounded px-2 py-0.5 text-xs text-gray-100"
            />
            <span className="text-gray-500">军饷 = 食粮需求 × 粮价 × 倍率</span>
          </div>
        </div>
      </div>

      {/* 招募单位 */}
      <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
        <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-gray-300">
          <Icon name="Plus" size={16} className="text-green-400" />
          招募单位
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(UNIT_TYPES).filter(([, unit]) => unit.epoch <= epoch).map(([unitId, unit]) => {
            const silverCost = calculateSilverCost(unit.recruitCost, market);
            const affordable = canRecruit(unit);

            return (
              <div
                key={unitId}
                className={`p-3 rounded-lg border transition-all ${
                  affordable
                    ? 'bg-gray-700 border-gray-600 hover:border-gray-500'
                    : 'bg-gray-700/50 border-gray-700'
                }`}
              >
                {/* 单位头部 */}
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="text-sm font-bold text-white">{unit.name}</h4>
                    <p className="text-xs text-gray-400">{unit.type}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">拥有</p>
                    <p className="text-sm font-bold text-white">{army[unitId] || 0}</p>
                  </div>
                </div>

                {/* 单位属性 */}
                <div className="grid grid-cols-2 gap-2 mb-2 text-xs">
                  <div className="flex items-center gap-1">
                    <Icon name="Sword" size={12} className="text-red-400" />
                    <span className="text-gray-400">攻击:</span>
                    <span className="text-white">{unit.attack}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Icon name="Shield" size={12} className="text-blue-400" />
                    <span className="text-gray-400">防御:</span>
                    <span className="text-white">{unit.defense}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Icon name="Zap" size={12} className="text-yellow-400" />
                    <span className="text-gray-400">速度:</span>
                    <span className="text-white">{unit.speed}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Icon name="Clock" size={12} className="text-purple-400" />
                    <span className="text-gray-400">训练:</span>
                    <span className="text-white">{unit.trainingTime} 天</span>
                  </div>
                  <div className="flex items-center gap-1 col-span-2">
                    <Icon name="Coins" size={12} className="text-yellow-400" />
                    <span className="text-gray-400">军饷:</span>
                    <span className="text-yellow-300">
                      {((unit.maintenanceCost?.food || 0) * foodPrice * militaryWageRatio).toFixed(2)} 银币/日
                    </span>
                  </div>
                </div>

                {/* 招募成本 */}
                <div className="flex flex-wrap gap-1 mb-2">
                  {Object.entries(unit.recruitCost).map(([resource, cost]) => (
                    <span
                      key={resource}
                      className={`text-xs px-1.5 py-0.5 rounded ${
                        (resources[resource] || 0) >= cost
                          ? 'bg-green-900/30 text-green-400'
                          : 'bg-red-900/30 text-red-400'
                      }`}
                    >
                      {RESOURCES[resource]?.name || resource}: {cost}
                    </span>
                  ))}
                </div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-gray-400">银币成本</span>
                  <span className={
                    (resources.silver || 0) >= silverCost
                      ? 'text-slate-100 font-semibold'
                      : 'text-red-400 font-semibold'
                  }>
                    {formatSilverCost(silverCost)}
                  </span>
                </div>

                {/* 操作按钮 */}
                <div className="flex gap-2">
                  <button
                    onClick={() => onRecruit(unitId)}
                    disabled={!affordable}
                    className={`flex-1 px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                      affordable
                        ? 'bg-green-600 hover:bg-green-500 text-white'
                        : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    招募
                  </button>

                  {(army[unitId] || 0) > 0 && (
                    <button
                      onClick={() => onDisband(unitId)}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded text-xs font-semibold transition-colors"
                    >
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
        <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
          <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-gray-300">
            <Icon name="Clock" size={16} className="text-yellow-400" />
            训练队列
          </h3>

          <div className="space-y-2">
            {militaryQueue.map((item, idx) => {
              const unit = UNIT_TYPES[item.unitId];
              return (
                <div
                  key={idx}
                  className="flex items-center justify-between bg-gray-700/50 p-2 rounded"
                >
                  <div className="flex items-center gap-2">
                    <Icon name="User" size={14} className="text-blue-400" />
                    <span className="text-sm text-white">{unit.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-32 bg-gray-600 rounded-full h-2">
                      <div
                        className="bg-yellow-500 h-2 rounded-full transition-all"
                        style={{
                          width: `${((unit.trainingTime - item.remainingTime) / unit.trainingTime) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 w-12 text-right">
                      {item.remainingTime}s
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 军事行动 */}
      <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
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
                return (
                  <div
                    key={action.id}
                    className="p-3 rounded-lg border border-gray-700 bg-gray-900/40 flex flex-col gap-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-base font-bold text-white flex items-center gap-2">
                          {action.name}
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-700 text-gray-200">
                            {action.difficulty}
                          </span>
                        </h4>
                        <p className="text-xs text-gray-400 mt-1">{action.desc}</p>
                      </div>
                      <Icon name="Target" size={18} className="text-red-300" />
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
                      disabled={totalUnits === 0 || !activeNation}
                      className="px-3 py-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-600 disabled:text-gray-300 disabled:cursor-not-allowed text-white rounded text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                      <Icon name="Sword" size={14} />
                      发起攻击
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
    </div>
  );
};
