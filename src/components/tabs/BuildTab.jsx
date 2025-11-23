// 建设标签页组件
// 显示可建造的建筑列表

import React, { useState } from 'react';
import { Icon } from '../common/UIComponents';
import { BUILDINGS, RESOURCES, STRATA } from '../../config';
import { calculateSilverCost, formatSilverCost } from '../../utils/economy';
import { filterUnlockedResources } from '../../utils/resources';

/**
 * 建设标签页组件
 * 显示可建造的建筑列表
 * @param {Object} buildings - 已建造的建筑对象
 * @param {Object} resources - 资源对象
 * @param {number} epoch - 当前时代
 * @param {Array} techsUnlocked - 已解锁的科技数组
 * @param {Function} onBuy - 购买建筑回调
 * @param {Function} onSell - 出售建筑回调
 */
export const BuildTab = ({ 
  buildings, 
  resources, 
  epoch, 
  techsUnlocked, 
  popStructure: _popStructure = {}, // 保留以备将来使用
  jobFill = {},
  onBuy, 
  onSell,
  market,
}) => {
  const NON_TRADE_KEYS = new Set(['maxPop']);
  const getResourcePrice = (key) => {
    if (!key || key === 'silver') return 1;
    const def = RESOURCES[key];
    if (!def) return 0;
    if (NON_TRADE_KEYS.has(key)) return 0;
    return market?.prices?.[key] ?? def.basePrice ?? 0;
  };

  const getOwnerIncomePerBuilding = (building) => {
    const outputValue = Object.entries(building.output || {}).reduce((sum, [res, val]) => {
      const price = getResourcePrice(res);
      return sum + price * val;
    }, 0);
    const inputValue = Object.entries(building.input || {}).reduce((sum, [res, val]) => {
      const price = getResourcePrice(res);
      return sum + price * val;
    }, 0);
    const wageCost = Object.entries(building.jobs || {}).reduce((sum, [job, perBuilding]) => {
      const wage = market?.wages?.[job] ?? 0;
      return sum + wage * perBuilding;
    }, 0);
    return outputValue - inputValue - wageCost;
  };

  const getJobIncomePerBuilding = (building, ownerIncome) => {
    const jobEntries = Object.keys(building.jobs || {}).map(job => {
      const wage = market?.wages?.[job] ?? 0;
      return {
        job,
        perCapitaIncome: wage,
      };
    });
    if (building.owner && jobEntries.every(entry => entry.perCapitaIncome === 0)) {
      const ownerRole = jobEntries.find(entry => entry.job === building.owner);
      if (ownerRole) {
        // 修复：将总利润除以该岗位的工人数量，得到人均收入
        const workerCount = building.jobs[building.owner] || 1;
        ownerRole.perCapitaIncome = ownerIncome / workerCount;
      }
    }
    return jobEntries;
  };

  /**
   * 检查建筑是否可用
   * @param {Object} building - 建筑对象
   * @returns {boolean}
   */
  const isBuildingAvailable = (building) => {
    // 检查时代要求
    if (building.epoch > epoch) return false;
    
    if (building.requiresTech && !techsUnlocked.includes(building.requiresTech)) return false;
    
    return true;
  };

  /**
   * 计算建筑成本
   * @param {Object} building - 建筑对象
   * @returns {Object} 成本对象
   */
  const calculateCost = (building) => {
    const count = buildings[building.id] || 0;
    const cost = {};
    for (let k in building.baseCost) {
      cost[k] = Math.ceil(building.baseCost[k] * Math.pow(1.15, count));
    }
    return cost;
  };

  // 按类别分组建筑
  const categories = {
    gather: { name: '采集与农业', icon: 'Wheat', color: 'text-yellow-400' },
    industry: { name: '工业生产', icon: 'Factory', color: 'text-blue-400' },
    civic: { name: '居住与行政', icon: 'Home', color: 'text-green-400' },
    military: { name: '军事建筑', icon: 'Swords', color: 'text-red-400' },
  };
  const categoryFilters = [
    { key: 'all', label: '全部' },
    { key: 'gather', label: '采集' },
    { key: 'industry', label: '工业' },
    { key: 'civic', label: '居住' },
    { key: 'military', label: '军事' },
  ];
  const [activeCategory, setActiveCategory] = useState('all');
  const categoriesToRender =
    activeCategory === 'all'
      ? Object.entries(categories)
      : Object.entries(categories).filter(([key]) => key === activeCategory);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 pb-1 border-b border-gray-700/60 mb-3">
        {categoryFilters.map((filter) => {
          const isActive = filter.key === activeCategory;
          return (
            <button
              key={filter.key}
              onClick={() => setActiveCategory(filter.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white shadow-inner'
                  : 'bg-gray-700/70 text-gray-300 hover:bg-gray-600/60'
              }`}
              aria-pressed={isActive}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      {categoriesToRender.map(([catKey, catInfo]) => {
        const categoryBuildings = BUILDINGS.filter(b => b.cat === catKey);
        
        return (
          <div key={catKey} className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
            {/* 类别标题 */}
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-gray-300">
              <Icon name={catInfo.icon} size={16} className={catInfo.color} />
              {catInfo.name}
            </h3>

            {/* 建筑列表 */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {categoryBuildings.filter(b => isBuildingAvailable(b)).map(b => {
                const cost = calculateCost(b);
                const silverCost = calculateSilverCost(cost, market);
                const hasMaterials = Object.entries(cost).every(([res, val]) => (resources[res] || 0) >= val);
                const hasSilver = (resources.silver || 0) >= silverCost;
                const affordable = hasMaterials && hasSilver;
                const count = buildings[b.id] || 0;
                const VisualIcon = Icon;
                const ownerIncomePerBuilding = getOwnerIncomePerBuilding(b);
                const jobIncomePerBuilding = getJobIncomePerBuilding(b, ownerIncomePerBuilding);

                return (
                  <div 
                    key={b.id}
                    className={`p-3 rounded-lg border transition-all ${
                      affordable 
                        ? 'bg-gray-700 border-gray-600 hover:border-gray-500' 
                        : 'bg-gray-700/50 border-gray-700'
                    }`}
                  >
                    {/* 建筑头部 */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded ${b.visual.color}`}>
                          <VisualIcon name={b.visual.icon} size={16} className={b.visual.text} />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white">{b.name}</h4>
                          <p className="text-xs text-gray-400">拥有: {count}</p>
                          {b.owner && (
                            <span className="text-[10px] text-yellow-300 bg-yellow-900/40 border border-yellow-600/40 rounded px-1.5 py-0.5 inline-flex items-center gap-1 mt-0.5">
                              <Icon name="User" size={10} className="text-yellow-400" />
                              业主: {STRATA[b.owner]?.name || b.owner}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 建筑描述 */}
                    <p className="text-xs text-gray-400 mb-2">{b.desc}</p>

                    {/* 预计利润 */}
                    <div className={`mb-2 px-2 py-1.5 rounded border ${
                      ownerIncomePerBuilding >= 0 
                        ? 'bg-green-900/20 border-green-600/40' 
                        : 'bg-red-900/20 border-red-600/40'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          {ownerIncomePerBuilding >= 0 ? (
                            <Icon name="TrendingUp" size={12} className="text-green-400" />
                          ) : (
                            <Icon name="AlertTriangle" size={12} className="text-red-400" />
                          )}
                          <span className="text-[10px] text-gray-400">预计日净利</span>
                        </div>
                        <span className={`text-xs font-bold ${
                          ownerIncomePerBuilding >= 0 ? 'text-green-300' : 'text-red-300'
                        }`}>
                          {ownerIncomePerBuilding >= 0 ? '+' : ''}{ownerIncomePerBuilding.toFixed(2)} 银币/日
                        </span>
                      </div>
                    </div>

                    {/* 建筑详情 */}
                    <div className="space-y-2 text-[11px] mb-3">
                      {(() => {
                        const unlockedOutput = filterUnlockedResources(b.output, epoch, techsUnlocked);
                        const unlockedInput = filterUnlockedResources(b.input, epoch, techsUnlocked);
                        const hasResources = Object.keys(unlockedOutput).length > 0 || Object.keys(unlockedInput).length > 0;
                        
                        return hasResources && (
                          <div className="bg-gray-900/30 border border-gray-700/70 rounded px-2 py-1.5">
                            <div className="flex items-center justify-between text-[10px] text-gray-500 uppercase tracking-wide mb-1">
                              <span>资源流</span>
                              <span>每日</span>
                            </div>
                            <div className="space-y-0.5">
                              {Object.entries(unlockedOutput).map(([res, val]) => (
                                <div key={`out-${res}`} className="flex items-center justify-between">
                                  <span className="text-gray-300">{RESOURCES[res]?.name || res}</span>
                                  <span className="text-green-300 font-mono">+{val}</span>
                                </div>
                              ))}
                              {Object.entries(unlockedInput).map(([res, val]) => (
                                <div key={`in-${res}`} className="flex items-center justify-between">
                                  <span className="text-gray-300">{RESOURCES[res]?.name || res}</span>
                                  <span className="text-red-300 font-mono">-{val}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      {(b.jobs || b.owner) && (
                        <div className="bg-gray-900/30 border border-gray-700/70 rounded px-2 py-1.5 space-y-1">
                          <div className="flex items-center justify-between text-[10px] text-gray-500 uppercase tracking-wide">
                            <span>岗位与收益</span>
                            <span>银币/人·日</span>
                          </div>
                          {b.jobs && Object.entries(b.jobs).map(([job, perBuilding]) => {
                            const requiredExact = perBuilding * count;
                            const assignedRaw = jobFill?.[b.id]?.[job] ?? 0;
                            const assignedExact = Math.min(assignedRaw, requiredExact);
                            const fillPercent = requiredExact > 0 ? Math.min(1, assignedExact / Math.max(requiredExact, 1)) : 0;
                            const requiredDisplay = Math.round(requiredExact);
                            const assignedDisplay = Math.min(requiredDisplay, Math.round(assignedExact));
                            const income = jobIncomePerBuilding.find(j => j.job === job)?.perCapitaIncome ?? 0;
                            return (
                              <div key={job} className="space-y-0.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-gray-300">
                                    {STRATA[job]?.name || job}
                                    <span className="text-gray-500 ml-1">({assignedDisplay}/{requiredDisplay})</span>
                                  </span>
                                  <span className="text-blue-300 font-mono">
                                    {income >= 0 ? '+' : ''}{income.toFixed(2)}
                                  </span>
                                </div>
                                <div className="w-full bg-gray-700/70 rounded-full h-1">
                                  <div
                                    className="h-1 rounded-full bg-blue-400 transition-all"
                                    style={{ width: `${fillPercent * 100}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                          <div className="flex items-center justify-between text-gray-300 pt-1 border-t border-gray-700/60">
                            <span>业主</span>
                            <span className={`${ownerIncomePerBuilding >= 0 ? 'text-green-300' : 'text-red-300'} font-mono`}>
                              {ownerIncomePerBuilding >= 0 ? '+' : ''}{ownerIncomePerBuilding.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                    {/* 成本 */}
                    <div className="flex flex-wrap gap-1 mb-2">
                      {Object.entries(cost).map(([res, val]) => (
                        <span 
                          key={res}
                          className={`text-xs px-1.5 py-0.5 rounded ${
                            (resources[res] || 0) >= val 
                              ? 'bg-green-900/30 text-green-400' 
                              : 'bg-red-900/30 text-red-400'
                          }`}
                        >
                          {RESOURCES[res]?.name || res}: {val}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="text-gray-400">银币成本</span>
                      <span className={hasSilver ? 'text-slate-100 font-semibold' : 'text-red-400 font-semibold'}>
                        {formatSilverCost(silverCost)}
                      </span>
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => onBuy(b.id)}
                        disabled={!affordable}
                        className={`flex-1 px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                          affordable
                            ? 'bg-green-600 hover:bg-green-500 text-white'
                            : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        建造
                      </button>
                      
                      {count > 0 && (
                        <button
                          onClick={() => onSell(b.id)}
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded text-xs font-semibold transition-colors"
                        >
                          拆除
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
