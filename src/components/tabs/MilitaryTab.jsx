// 军事标签页组件
// 显示可招募的兵种、当前军队和战斗功能

import React from 'react';
import { Icon } from '../common/UIComponents';
import { UNIT_TYPES, calculateArmyAdminCost, calculateArmyPopulation, calculateArmyMaintenance } from '../../config/militaryUnits';
import { EPOCHS } from '../../config/gameData';
import { RESOURCES } from '../../config/gameConstants';

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
 * @param {Object} selectedTarget - 选中的目标国家
 * @param {Function} onRecruit - 招募单位回调
 * @param {Function} onDisband - 解散单位回调
 * @param {Function} onSelectTarget - 选择目标回调
 * @param {Function} onLaunchBattle - 发起战斗回调
 */
export const MilitaryTab = ({
  army,
  militaryQueue,
  resources,
  epoch,
  population,
  adminCap,
  nations,
  selectedTarget,
  onRecruit,
  onDisband,
  onSelectTarget,
  onLaunchBattle,
}) => {
  // 计算军队统计信息
  const totalUnits = Object.values(army).reduce((sum, count) => sum + count, 0);
  const armyAdmin = calculateArmyAdminCost(army);
  const armyPop = calculateArmyPopulation(army);
  const maxArmyPop = Math.floor(population * 0.3);
  const maintenance = calculateArmyMaintenance(army);

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
        {Object.keys(maintenance).length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-700">
            <p className="text-xs text-gray-400 mb-2">维护成本（每秒）：</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(maintenance).map(([resource, cost]) => (
                <span
                  key={resource}
                  className={`text-xs px-2 py-1 rounded ${
                    (resources[resource] || 0) >= cost
                      ? 'bg-green-900/30 text-green-400'
                      : 'bg-red-900/30 text-red-400'
                  }`}
                >
                  {RESOURCES[resource]?.name || resource}: -{cost.toFixed(1)}/s
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 招募单位 */}
      <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
        <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-gray-300">
          <Icon name="Plus" size={16} className="text-green-400" />
          招募单位
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(UNIT_TYPES).filter(([_, unit]) => unit.epoch <= epoch).map(([unitId, unit]) => {
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
                    <span className="text-white">{unit.trainingTime}s</span>
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

        {/* 选择目标 */}
        <div className="mb-3">
          <label className="text-xs text-gray-400 mb-2 block">选择目标国家：</label>
          <select
            value={selectedTarget?.id || ''}
            onChange={(e) => {
              const nation = nations.find((n) => n.id === e.target.value);
              onSelectTarget(nation);
            }}
            className="w-full bg-gray-700 text-white px-3 py-2 rounded text-sm border border-gray-600 focus:border-blue-500 focus:outline-none"
          >
            <option value="">-- 选择目标 --</option>
            {nations.map((nation) => (
              <option key={nation.id} value={nation.id}>
                {nation.name} (关系: {nation.relation})
              </option>
            ))}
          </select>
        </div>

        {/* 行动按钮 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <button
            onClick={() => onLaunchBattle('raid')}
            disabled={!selectedTarget || totalUnits === 0}
            className="px-3 py-2 bg-orange-600 hover:bg-orange-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded text-xs font-semibold transition-colors flex items-center justify-center gap-1"
          >
            <Icon name="Coins" size={14} />
            掠夺
          </button>

          <button
            onClick={() => onLaunchBattle('conquer')}
            disabled={!selectedTarget || totalUnits === 0}
            className="px-3 py-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded text-xs font-semibold transition-colors flex items-center justify-center gap-1"
          >
            <Icon name="Flag" size={14} />
            征服
          </button>

          <button
            onClick={() => onLaunchBattle('defend')}
            disabled={!selectedTarget || totalUnits === 0}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded text-xs font-semibold transition-colors flex items-center justify-center gap-1"
          >
            <Icon name="Shield" size={14} />
            防御
          </button>

          <button
            onClick={() => onLaunchBattle('scout')}
            disabled={!selectedTarget || totalUnits === 0}
            className="px-3 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded text-xs font-semibold transition-colors flex items-center justify-center gap-1"
          >
            <Icon name="Eye" size={14} />
            侦察
          </button>
        </div>

        {totalUnits === 0 && (
          <p className="text-xs text-yellow-400 mt-2">
            ⚠️ 你需要先招募军队才能发起军事行动
          </p>
        )}
      </div>
    </div>
  );
};
