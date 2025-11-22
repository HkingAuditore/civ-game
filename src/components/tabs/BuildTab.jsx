// 建设标签页组件
// 显示可建造的建筑列表

import React from 'react';
import { Icon } from '../common/UIComponents';
import { BUILDINGS, RESOURCES, STRATA } from '../../config';
import { calculateSilverCost, formatSilverCost } from '../../utils/economy';

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
  popStructure = {},
  jobFill = {},
  onBuy, 
  onSell,
  market,
}) => {
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

  return (
    <div className="space-y-4">
      {Object.entries(categories).map(([catKey, catInfo]) => {
        const categoryBuildings = BUILDINGS.filter(b => b.cat === catKey);
        
        return (
          <div key={catKey} className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
            {/* 类别标题 */}
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-gray-300">
              <Icon name={catInfo.icon} size={16} className={catInfo.color} />
              {catInfo.name}
            </h3>

            {/* 建筑列表 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {categoryBuildings.filter(b => isBuildingAvailable(b)).map(b => {
                const cost = calculateCost(b);
                const silverCost = calculateSilverCost(cost, market);
                const hasMaterials = Object.entries(cost).every(([res, val]) => (resources[res] || 0) >= val);
                const hasSilver = (resources.silver || 0) >= silverCost;
                const affordable = hasMaterials && hasSilver;
                const count = buildings[b.id] || 0;
                const VisualIcon = Icon;

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
                        </div>
                      </div>
                    </div>

                    {/* 建筑描述 */}
                    <p className="text-xs text-gray-400 mb-2">{b.desc}</p>

                    {/* 建筑效果 */}
                    <div className="space-y-1 mb-2">
                      {/* 产出 */}
                      {b.output && Object.entries(b.output).map(([res, val]) => (
                        <div key={res} className="flex items-center justify-between text-xs">
                          <span className="text-gray-400">产出:</span>
                          <span className="text-green-400">+{val} {RESOURCES[res]?.name || res}/日</span>
                        </div>
                      ))}
                      
                      {/* 消耗 */}
                      {b.input && Object.entries(b.input).map(([res, val]) => (
                        <div key={res} className="flex items-center justify-between text-xs">
                          <span className="text-gray-400">消耗:</span>
                          <span className="text-red-400">-{val} {RESOURCES[res]?.name || res}/日</span>
                        </div>
                      ))}
                      
                      {/* 岗位 */}
                      {b.jobs && (
                        <div className="space-y-1">
                          {Object.entries(b.jobs).map(([job, perBuilding]) => {
                            const required = perBuilding * count;
                            const assignedRaw = jobFill?.[b.id]?.[job] ?? 0;
                            const assigned = Math.min(assignedRaw, required);
                            const fillPercent = required > 0 ? Math.min(1, assigned / required) : 0;
                            return (
                              <div key={job}>
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-gray-400">
                                    岗位: {STRATA[job]?.name || job}
                                  </span>
                                  <span className="text-blue-400 font-mono">
                                    {assigned}/{required}
                                  </span>
                                </div>
                                <div className="w-full bg-gray-600/60 rounded-full h-1.5">
                                  <div
                                    className="h-1.5 rounded-full bg-blue-400 transition-all"
                                    style={{ width: `${fillPercent * 100}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
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
