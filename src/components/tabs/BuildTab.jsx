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

            {/* 建筑列表 - 紧凑布局 */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-2">
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
                    className={`group relative p-2 rounded-lg border transition-all ${
                      affordable 
                        ? 'bg-gray-700 border-gray-600 hover:border-blue-500 hover:shadow-lg' 
                        : 'bg-gray-700/50 border-gray-700'
                    }`}
                  >
                    {/* 建筑头部 - 紧凑版 */}
                    <div className="flex flex-col items-center mb-2">
                      <div className={`p-2 rounded ${b.visual.color} mb-1`}>
                        <VisualIcon name={b.visual.icon} size={20} className={b.visual.text} />
                      </div>
                      <h4 className="text-xs font-bold text-white text-center leading-tight">{b.name}</h4>
                      <p className="text-[10px] text-gray-400">×{count}</p>
                    </div>

                    {/* 简化的关键信息 */}
                    <div className="space-y-1 text-[10px] mb-2">
                      {(() => {
                        const unlockedOutput = filterUnlockedResources(b.output, epoch, techsUnlocked);
                        const unlockedInput = filterUnlockedResources(b.input, epoch, techsUnlocked);
                        const hasResources = Object.keys(unlockedOutput).length > 0 || Object.keys(unlockedInput).length > 0;
                        
                        return hasResources && (
                          <div className="bg-gray-900/40 rounded px-1.5 py-1 text-center">
                            {Object.entries(unlockedOutput).slice(0, 2).map(([res, val]) => (
                              <div key={`out-${res}`} className="text-green-400">
                                +{val} {RESOURCES[res]?.name || res}
                              </div>
                            ))}
                            {Object.keys(unlockedOutput).length > 2 && (
                              <div className="text-gray-500">+{Object.keys(unlockedOutput).length - 2}项...</div>
                            )}
                          </div>
                        );
                      })()}

                      {b.jobs && (
                        <div className="bg-gray-900/40 rounded px-1.5 py-1 text-center">
                          <div className="text-blue-400">
                            {Object.keys(b.jobs).length}个岗位
                          </div>
                          {ownerIncomePerBuilding !== 0 && (
                            <div className={ownerIncomePerBuilding >= 0 ? 'text-green-400' : 'text-red-400'}>
                              {ownerIncomePerBuilding >= 0 ? '+' : ''}{ownerIncomePerBuilding.toFixed(1)}银/日
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 操作按钮 - 紧凑版 */}
                    <div className="space-y-1">
                      <button
                        onClick={() => onBuy(b.id)}
                        disabled={!affordable}
                        className={`w-full px-2 py-1 rounded text-[10px] font-semibold transition-colors ${
                          affordable
                            ? 'bg-green-600 hover:bg-green-500 text-white'
                            : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <Icon name="Plus" size={10} />
                          <span className={!hasSilver ? 'text-red-300' : ''}>
                            {formatSilverCost(silverCost)}
                          </span>
                        </div>
                      </button>
                      
                      {count > 0 && (
                        <button
                          onClick={() => onSell(b.id)}
                          className="w-full px-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-[10px] font-semibold transition-colors flex items-center justify-center gap-1"
                        >
                          <Icon name="Minus" size={10} />
                          拆除
                        </button>
                      )}
                    </div>
                    
                    {/* 悬停显示详细信息 - 桌面端 */}
                    <div className="hidden lg:block absolute left-full top-0 ml-2 w-80 bg-gray-800 border border-gray-600 rounded-lg shadow-2xl p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none">
                      <h4 className="text-sm font-bold text-white mb-1">{b.name}</h4>
                      <p className="text-xs text-gray-400 mb-2">{b.desc}</p>
                      
                      {b.owner && (
                        <div className="text-[10px] text-yellow-300 bg-yellow-900/40 border border-yellow-600/40 rounded px-2 py-1 mb-2 inline-flex items-center gap-1">
                          <Icon name="User" size={10} className="text-yellow-400" />
                          业主: {STRATA[b.owner]?.name || b.owner}
                        </div>
                      )}
                      
                      {(() => {
                        const unlockedOutput = filterUnlockedResources(b.output, epoch, techsUnlocked);
                        const unlockedInput = filterUnlockedResources(b.input, epoch, techsUnlocked);
                        const hasResources = Object.keys(unlockedOutput).length > 0 || Object.keys(unlockedInput).length > 0;
                        
                        return hasResources && (
                          <div className="bg-gray-900/50 rounded px-2 py-1.5 mb-2">
                            <div className="text-[10px] text-gray-400 mb-1">资源流（每日）</div>
                            {Object.entries(unlockedOutput).map(([res, val]) => (
                              <div key={`out-${res}`} className="flex justify-between text-xs">
                                <span className="text-gray-300">{RESOURCES[res]?.name || res}</span>
                                <span className="text-green-400">+{val}</span>
                              </div>
                            ))}
                            {Object.entries(unlockedInput).map(([res, val]) => (
                              <div key={`in-${res}`} className="flex justify-between text-xs">
                                <span className="text-gray-300">{RESOURCES[res]?.name || res}</span>
                                <span className="text-red-400">-{val}</span>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                      
                      {b.jobs && (
                        <div className="bg-gray-900/50 rounded px-2 py-1.5 mb-2">
                          <div className="text-[10px] text-gray-400 mb-1">岗位与收益</div>
                          {Object.entries(b.jobs).map(([job, perBuilding]) => {
                            const requiredExact = perBuilding * count;
                            const assignedRaw = jobFill?.[b.id]?.[job] ?? 0;
                            const assignedExact = Math.min(assignedRaw, requiredExact);
                            const fillPercent = requiredExact > 0 ? Math.min(1, assignedExact / Math.max(requiredExact, 1)) : 0;
                            const requiredDisplay = Math.round(requiredExact);
                            const assignedDisplay = Math.min(requiredDisplay, Math.round(assignedExact));
                            const income = jobIncomePerBuilding.find(j => j.job === job)?.perCapitaIncome ?? 0;
                            return (
                              <div key={job} className="mb-1">
                                <div className="flex justify-between text-xs">
                                  <span className="text-gray-300">
                                    {STRATA[job]?.name || job} ({assignedDisplay}/{requiredDisplay})
                                  </span>
                                  <span className="text-blue-400">
                                    {income >= 0 ? '+' : ''}{income.toFixed(2)}银/日
                                  </span>
                                </div>
                                <div className="w-full bg-gray-700 rounded-full h-1 mt-0.5">
                                  <div className="h-1 rounded-full bg-blue-400" style={{ width: `${fillPercent * 100}%` }} />
                                </div>
                              </div>
                            );
                          })}
                          <div className="flex justify-between text-xs pt-1 border-t border-gray-700 mt-1">
                            <span className="text-gray-300">业主收益</span>
                            <span className={ownerIncomePerBuilding >= 0 ? 'text-green-400' : 'text-red-400'}>
                              {ownerIncomePerBuilding >= 0 ? '+' : ''}{ownerIncomePerBuilding.toFixed(2)}银/日
                            </span>
                          </div>
                        </div>
                      )}
                      
                      <div className="bg-gray-900/50 rounded px-2 py-1.5">
                        <div className="text-[10px] text-gray-400 mb-1">建造成本</div>
                        {Object.entries(cost).map(([res, val]) => (
                          <div key={res} className="flex justify-between text-xs">
                            <span className="text-gray-300">{RESOURCES[res]?.name || res}</span>
                            <span className={(resources[res] || 0) >= val ? 'text-green-400' : 'text-red-400'}>
                              {val} ({(resources[res] || 0).toFixed(1)})
                            </span>
                          </div>
                        ))}
                        <div className="flex justify-between text-xs pt-1 border-t border-gray-700 mt-1">
                          <span className="text-gray-300">总计</span>
                          <span className={hasSilver ? 'text-green-400' : 'text-red-400'}>
                            {formatSilverCost(silverCost)}
                          </span>
                        </div>
                      </div>
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
